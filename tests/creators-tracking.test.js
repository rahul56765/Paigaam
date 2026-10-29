'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const http = require('node:http'), crypto = require('node:crypto');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-tracking-'));
process.env.DATA_DIR = dir;
const tracking = require('../lib/creators/tracking');
const store = require('../lib/creators/store');
const { db, q } = require('../db');
let server, origin, seq = 0;
const hash = v => crypto.createHash('sha256').update(v).digest('hex');
function creator(extra = {}) {
  const username = `track${++seq}`;
  return store.createCreator({ username, display_name: username, password: 'tracking-test-password', commission_bps: 1250, coupon_code: username.toUpperCase(), discount_bps: 1234, ...extra }, 'test');
}
function cookie(res, name) {
  const raw = res.headers.getSetCookie().find(v => v.startsWith(name + '='));
  assert.ok(raw, `missing ${name}`); return raw.split(';')[0];
}
function get(url, headers = {}, method = 'GET') { return fetch(origin + url, { method, redirect: 'manual', headers }); }
function post(body, jar, headers = {}) {
  return fetch(origin + '/api/creator-coupon', { method: 'POST', headers: { 'content-type': 'application/json', origin, cookie: jar, ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
}
before(async () => {
  server = http.createServer((req, res) => tracking.runRequest(req, async () => {
    try {
      if (await tracking.handle(req, res, new URL(req.url, origin), { baseUrl: req.headers['x-test-secure'] ? 'https://shop.example.test' : origin })) return;
      res.writeHead(404); res.end();
    } catch (err) { res.writeHead(500); res.end(err.message); }
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); db.close(); fs.rmSync(dir, { recursive: true, force: true }); });

test('human referrals redirect locally, hash persistent tokens, and count repeat/unique visitors', async () => {
  const c = creator();
  const first = await get(`/r/${c.username}?to=%2Ftemplates`, { 'x-test-secure': '1' });
  assert.equal(first.status, 302); assert.equal(first.headers.get('location'), '/templates');
  assert.equal(first.headers.get('cache-control'), 'private, no-store');
  assert.equal(first.headers.get('vary'), 'Cookie'); assert.equal(first.headers.get('referrer-policy'), 'no-referrer');
  assert.match(first.headers.get('x-robots-tag'), /noindex/);
  for (const raw of first.headers.getSetCookie()) {
    assert.match(raw, /HttpOnly/); assert.match(raw, /SameSite=Lax/); assert.match(raw, /; Secure/); assert.match(raw, /Max-Age=2592000/);
  }
  const visitor = cookie(first, 'pg_partner_visitor'), ref = cookie(first, 'pg_partner_ref');
  const token = ref.split('=')[1]; assert.match(token, /^[a-f0-9]{64}$/);
  const row = db.prepare('SELECT * FROM partner_referrals WHERE token_hash=?').get(hash(token));
  assert.equal(row.creator_id, c.id); assert.notEqual(row.token_hash, token);
  assert.ok(row.expires_at > Date.now() + 29 * 86400000);
  assert.equal(tracking.runRequest({ headers: { cookie: ref } }, () => tracking.checkoutQuote({ amount: 10001, currency: 'INR' })).creator_id, c.id);
  const second = await get(`/r/${c.username}`, { cookie: visitor });
  assert.notEqual(cookie(second, 'pg_partner_ref'), ref);
  assert.equal(second.headers.getSetCookie().some(v => v.startsWith('pg_partner_visitor=')), false);
  await get(`/r/${c.username}`);
  const totals = store.dashboard(c.id).totals;
  assert.equal(totals.clicks, 3); assert.equal(totals.unique_visitors, 2);
  const click = db.prepare('SELECT * FROM partner_clicks WHERE creator_id=? LIMIT 1').get(c.id);
  assert.equal(click.visitor_hash, hash(visitor.split('=')[1])); assert.equal(click.path, '/templates');
});

test('HEAD and preview bots never set attribution cookies or inflate clicks', async () => {
  const c = creator();
  const head = await get(`/r/${c.username}`, {}, 'HEAD'); assert.equal(head.status, 302); assert.equal(await head.text(), '');
  assert.deepEqual(head.headers.getSetCookie(), []);
  for (const ua of ['Googlebot', 'facebookexternalhit', 'WhatsApp', 'TelegramBot', 'Slackbot-LinkExpanding', 'preview crawler']) {
    const res = await get(`/r/${c.username}`, { 'user-agent': ua });
    assert.equal(res.status, 302); assert.deepEqual(res.headers.getSetCookie(), []);
  }
  assert.equal(store.dashboard(c.id).totals.clicks, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM partner_referrals WHERE creator_id=?').get(c.id).n, 0);
});

test('redirect allowlist rejects external, protocol-relative, traversal, query and unpublished destinations', async () => {
  const c = creator();
  for (const to of ['https://evil.example', '//evil.example', '/\\evil.example', '/templates/../admin', '/templates?next=https://evil.example', '/admin', '/templates/not-published', '/magazines/not-published']) {
    const res = await get(`/r/${c.username}?to=${encodeURIComponent(to)}`);
    assert.equal(res.status, 400, to); assert.deepEqual(res.headers.getSetCookie(), []);
    assert.equal(res.headers.get('location'), null);
  }
  const slug = `track-published-${++seq}`;
  q.templateInsert({ name: 'Tracking published', slug, category: 'birthday', price: 199, status: 'published' });
  assert.equal((await get(`/r/${c.username}?to=${encodeURIComponent('/templates/' + slug)}`)).headers.get('location'), '/templates/' + slug);
  assert.equal((await get('/r/missingcreator')).status, 404);
  store.updateCreator(c.id, { active: false }, 'test'); assert.equal((await get(`/r/${c.username}`)).status, 404);
  assert.equal((await get('/unrelated')).status, 404);
});

test('coupon API normalizes explicit coupon, validates CSRF/origin/body, and supports removal', async () => {
  const c = creator(), first = await get('/api/creator-coupon'), body = await first.json();
  assert.equal(body.valid, true); assert.equal(body.code, ''); assert.match(body.csrf, /^[a-f0-9]{64}$/);
  const jar = cookie(first, 'pg_partner_coupon_csrf');
  assert.equal((await post({ code: c.coupon_code }, jar)).status, 403);
  assert.equal((await post({ csrf: body.csrf, code: c.coupon_code }, jar, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await post({ csrf: body.csrf, code: c.coupon_code }, jar, { 'sec-fetch-site': 'cross-site' })).status, 403);
  assert.equal((await post({}, jar, { 'content-type': 'text/plain' })).status, 415);
  for (const payload of ['{', JSON.stringify({ csrf: body.csrf, code: 'x'.repeat(5000) })]) assert.equal((await post(payload, jar)).status, 400);
  for (const code of ['MISSING', '<script>', 'A'.repeat(33)]) {
    const bad = await post({ csrf: body.csrf, code }, jar); assert.equal(bad.status, 400); assert.deepEqual(bad.headers.getSetCookie(), []);
  }
  const valid = await post({ csrf: body.csrf, code: ` ${c.coupon_code.toLowerCase()} ` }, jar);
  assert.equal(valid.status, 200); assert.equal((await valid.json()).discount_bps, 1234);
  assert.equal(cookie(valid, 'pg_partner_coupon'), `pg_partner_coupon=${c.coupon_code}`);
  const saved = await get('/api/creator-coupon', { cookie: `${jar}; pg_partner_coupon=${c.coupon_code}` });
  assert.equal((await saved.json()).code, c.coupon_code); assert.deepEqual(saved.headers.getSetCookie(), []);
  const removed = await post({ csrf: body.csrf, code: '' }, jar);
  assert.equal(removed.status, 200); assert.match(removed.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await get('/api/creator-coupon', {}, 'PUT')).status, 405);
});

test('coupon priority never stacks referral discount; expired, forged and disabled referrals get no credit', async () => {
  const a = creator(), b = creator({ commission_bps: 4321 });
  const landing = await get(`/r/${a.username}`), ref = cookie(landing, 'pg_partner_ref');
  const quote = jar => tracking.runRequest({ headers: { cookie: jar } }, () => tracking.checkoutQuote({ amount: 10001, currency: 'INR' }));
  const referred = quote(ref); assert.equal(referred.creator_id, a.id); assert.equal(referred.amount_paise, 10001); assert.equal(referred.discount_paise, 0);
  const explicit = quote(`${ref}; pg_partner_coupon=${b.coupon_code}`);
  assert.equal(explicit.creator_id, b.id); assert.equal(explicit.discount_paise, 1234); assert.equal(explicit.amount_paise, 8767); assert.equal(explicit.commission_bps, 4321);
  const expiredCodeFallsBack=quote(`${ref}; pg_partner_coupon=NOTREAL`);assert.equal(expiredCodeFallsBack.creator_id,a.id);assert.equal(expiredCodeFallsBack.coupon_code,'');assert.equal(expiredCodeFallsBack.discount_paise,0);
  assert.equal(quote('pg_partner_ref=' + 'f'.repeat(64)).creator_id, null);
  db.prepare('UPDATE partner_referrals SET expires_at=? WHERE creator_id=?').run(Date.now() - 1, a.id);
  assert.equal(quote(ref).creator_id, null);
  const again = await get(`/r/${a.username}`); store.updateCreator(a.id, { active: false }, 'test');
  assert.equal(quote(cookie(again, 'pg_partner_ref')).creator_id, null);
  store.updateCreator(b.id, { active: false }, 'test');
  const disabledCodeFallsBack=quote(`pg_partner_coupon=${b.coupon_code}`);assert.equal(disabledCodeFallsBack.creator_id,null);assert.equal(disabledCodeFallsBack.coupon_code,'');
});

test('expired saved coupon is cleared with a checkout notice and falls back to normal full-price checkout',()=>{
  const headers=new Map(),res={getHeader(name){return headers.get(name);},setHeader(name,value){headers.set(name,value);}};
  const req={headers:{cookie:'pg_partner_coupon=OLDPROMO; pg_partner_ref=not-a-valid-token'}};
  const quote=tracking.runRequest(req,res,'https://checkout.example.test',()=>tracking.checkoutQuote({amount:10001,currency:'INR'}));
  assert.equal(quote.amount_paise,10001);assert.equal(quote.discount_paise,0);assert.equal(quote.coupon_code,'');
  const cookies=headers.get('Set-Cookie');assert.ok(Array.isArray(cookies));assert.ok(cookies.some(c=>c.startsWith('pg_partner_coupon=')&&c.includes('Max-Age=0')));assert.ok(cookies.some(c=>c.startsWith('pg_partner_coupon_notice=invalid_coupon')));
});

test('legacy no-context and non-INR requests bypass attribution, but explicit non-INR coupon rejects', () => {
  assert.equal(tracking.checkoutQuote({ amount: 10001, currency: 'INR' }), null);
  const run = (cookie, currency) => tracking.runRequest({ headers: { cookie } }, () => tracking.checkoutQuote({ amount: 10001, currency }));
  assert.equal(run('', 'INR').creator_id, null);
  assert.equal(run('pg_partner_ref=' + 'a'.repeat(64), 'USD'), null);
  assert.equal(run('pg_partner_coupon=INVALID', 'USD'),null,'an invalid saved coupon is discarded and a non-INR order remains unchanged');
  assert.deepEqual({ ...tracking.cookies({ headers: { cookie: 'bad=%ZZ; pg_partner_coupon=TRACK%31; noequals; x=a=b' } }) }, { pg_partner_coupon: 'TRACK1', x: 'a=b' });
});
