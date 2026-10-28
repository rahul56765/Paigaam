'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const sharp = require('sharp');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-creator-extension-'));
process.env.DATA_DIR = dir;
const store = require('../lib/creators/store');
const routes = require('../lib/creators/routes');
const views = require('../pages/creators');
const { db } = require('../db');
let server, origin, seq = 0;
const admin = { id: 'photo-test-admin' }, cookie = 'paigaam_session=photo-test-session';
before(async () => {
  server = http.createServer(async (req, res) => {
    try {
      const handled = await routes.handle(req, res, new URL(req.url, origin), { baseUrl: origin, admin: req.headers.cookie === cookie ? admin : null });
      if (!handled) { res.writeHead(404); res.end('Not handled'); }
    } catch (err) { res.writeHead(500); res.end('Unexpected error'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); db.close(); fs.rmSync(dir, { recursive: true, force: true }); });
function creator(extra = {}) { const n = `extension${++seq}`; return store.createCreator({ username: n, display_name: 'Creator photo test', password: 'Private creator password', coupon_code: n.toUpperCase(), commission_bps: 1250, discount_bps: 1500, ...extra }, admin.id); }
const request = (url, options = {}) => fetch(origin + url, { redirect: 'manual', ...options });
async function token(c) { const page = await request(`/admin/creators/${c.id}`, { headers: { cookie } }); assert.equal(page.status, 200); return (await page.text()).match(/name="csrf" value="([^"]+)"/)[1]; }
async function form(url, fields, headers = {}) { return request(url, { method: 'POST', headers: { cookie, origin, 'content-type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(fields) }); }
async function upload(c, csrf, bytes, headers = {}) { return request(`/admin/creators/${c.id}/photo`, { method: 'POST', headers: { cookie, origin, 'content-type': 'image/png', 'x-csrf-token': csrf, ...headers }, body: bytes }); }
async function png() { return sharp({ create: { width: 240, height: 360, channels: 3, background: '#875064' } }).png().toBuffer(); }
const oldFields = c => ({ display_name: c.display_name, coupon_code: c.coupon_code, commission_percent: '12.5', discount_percent: '15', active: '1' });

test('actual upload/replace/remove is protected, private, owner scoped, and atomic with metadata removed', async () => {
  const a = creator(), b = creator(), csrf = await token(a), bytes = await png();
  const response = await upload(a, csrf, bytes); assert.equal(response.status, 200);
  const first = (await response.json()).profile_image; assert.equal(store.getCreator(a.id).profile_image, first);
  const ownCookie = `pg_partner_session=${store.createSession(a.id)}`, otherCookie = `pg_partner_session=${store.createSession(b.id)}`;
  assert.equal((await request(first)).status, 404);
  assert.equal((await request(first, { headers: { cookie: otherCookie } })).status, 404);
  const own = await request(first, { headers: { cookie: ownCookie } });
  assert.equal(own.status, 200); assert.equal(own.headers.get('content-type'), 'image/jpeg');
  assert.equal(own.headers.get('cache-control'), 'private, no-store'); assert.equal(own.headers.get('vary'), 'Cookie'); assert.equal(own.headers.get('x-content-type-options'), 'nosniff');
  const meta = await sharp(Buffer.from(await own.arrayBuffer())).metadata(); assert.equal(meta.width, 512); assert.equal(meta.height, 512); assert.equal(meta.exif, undefined);
  const head = await request(first, { method: 'HEAD', headers: { cookie } }); assert.equal(head.status, 200); assert.equal(await head.text(), ''); assert.ok(Number(head.headers.get('content-length')) > 0);
  const dashboard = await (await request('/creator', { headers: { cookie: ownCookie } })).text();
  assert.ok(dashboard.includes('pc-mobile-profile')); assert.ok(dashboard.includes(`src="${first}"`));
  assert.ok((dashboard.match(new RegExp(first, 'g')) || []).length >= 2, 'photo rendered in sidebar and mobile greeting');
  assert.ok((await (await request('/admin/creators', { headers: { cookie } })).text()).includes(`src="${first}"`));
  const replaced = await upload(a, csrf, bytes); assert.equal(replaced.status, 200); const second = (await replaced.json()).profile_image; assert.notEqual(second, first);
  assert.equal((await request(first, { headers: { cookie } })).status, 404, 'stale profile paths not served');
  assert.equal((await form(`/admin/creators/${a.id}/photo/remove`, { csrf: 'wrong' })).status, 403);
  assert.equal(store.getCreator(a.id).profile_image, second);
  const removed = await form(`/admin/creators/${a.id}/photo/remove`, { csrf }); assert.equal(removed.status, 303); assert.equal(store.getCreator(a.id).profile_image, '');
  assert.equal((await request(second, { headers: { cookie: ownCookie } })).status, 404);
});

test('photo endpoint rejects customer/partner auth, methods, CSRF/origin bypass, MIME spoof and oversized binary', async () => {
  const c = creator(), csrf = await token(c), bytes = await png(), url = `/admin/creators/${c.id}/photo`;
  assert.equal((await upload(c, csrf, bytes, { cookie: '' })).status, 303);
  assert.equal((await upload(c, csrf, bytes, { cookie: `pg_partner_session=${store.createSession(c.id)}` })).status, 303);
  assert.equal((await request(url, { headers: { cookie } })).status, 405);
  assert.equal((await upload(c, 'wrong', bytes)).status, 403);
  assert.equal((await upload(c, csrf, bytes, { origin: 'https://evil.test' })).status, 403);
  assert.equal((await upload(c, csrf, bytes, { 'sec-fetch-site': 'cross-site' })).status, 403);
  assert.equal((await upload(c, csrf, bytes, { 'content-type': 'image/svg+xml' })).status, 415);
  assert.equal((await upload(c, csrf, bytes, { 'content-type': 'image/jpeg' })).status, 400);
  assert.equal((await upload(c, csrf, Buffer.from('bad image'))).status, 400);
  assert.equal((await upload(c, csrf, Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413);
  assert.equal((await form(`/admin/creators/${c.id}`, oldFields(c), { 'x-csrf-token': csrf })).status, 403, 'header cannot bypass form CSRF');
  assert.equal(store.getCreator(c.id).profile_image, '');
});

test('failed store persistence cleans new file and leaves existing profile intact; disabled sessions cannot read photos', async () => {
  const c = creator(), csrf = await token(c), bytes = await png();
  const success = await upload(c, csrf, bytes); assert.equal(success.status, 200); const url = (await success.json()).profile_image;
  const before = fs.readdirSync(path.join(dir, 'creator-photos')).sort();
  const original = store.updateProfileImage;
  store.updateProfileImage = () => { throw new Error('Private DB exception'); };
  try { const failed = await upload(c, csrf, bytes); assert.equal(failed.status, 500); assert.ok(!(await failed.text()).includes('Private DB exception')); }
  finally { store.updateProfileImage = original; }
  assert.equal(store.getCreator(c.id).profile_image, url); assert.deepEqual(fs.readdirSync(path.join(dir, 'creator-photos')).sort(), before);
  const session = store.createSession(c.id); store.updateCreator(c.id, { active: false }, admin.id);
  assert.equal((await request(url, { headers: { cookie: `pg_partner_session=${session}` } })).status, 404);
  assert.equal((await request(url, { headers: { cookie } })).status, 200, 'admin can manage disabled account photo');
});

test('flexible coupon form stores exact rupees and IST expiry; old fields preserve extension values', async () => {
  const c = creator(), csrf = await token(c), url = `/admin/creators/${c.id}`;
  const flexible = { ...oldFields(c), csrf, discount_type: 'flat', discount_flat: '125.51', discount_min: '500.25', discount_max: '25.02', coupon_expires_at: '2090-05-20T23:59', coupon_controls_present: '1', coupon_enabled: '1' };
  assert.equal((await form(url, flexible)).status, 303);
  const updated = store.getCreator(c.id);
  assert.equal(updated.discount_type, 'flat'); assert.equal(updated.discount_flat_paise, 12551); assert.equal(updated.discount_min_paise, 50025); assert.equal(updated.discount_max_paise, 2502);
  assert.equal(updated.coupon_expires_at, '2090-05-20T18:29:00.000Z'); assert.equal(updated.coupon_enabled, true);
  const html = await (await request(url, { headers: { cookie } })).text(); assert.match(html, /name="coupon_expires_at" value="2090-05-20T23:59"/); assert.match(html, /value="flat" selected/);
  assert.equal((await form(url, { ...oldFields(c), csrf })).status, 303); assert.deepEqual(store.getCreator(c.id), updated);
  const unchecked = { ...flexible }; delete unchecked.coupon_enabled;
  assert.equal((await form(url, unchecked)).status, 303); assert.equal(store.getCreator(c.id).coupon_enabled, false);
  assert.equal((await form(url, { ...flexible, coupon_expires_at: '' })).status, 303); assert.equal(store.getCreator(c.id).coupon_expires_at, '');
});

test('invalid coupon fields are rejected atomically and legacy creates get safe defaults', async () => {
  const c = creator(), csrf = await token(c), url = `/admin/creators/${c.id}`;
  for (const extra of [{ discount_type: 'other' }, { discount_flat: '1.005' }, { discount_min: '-1' }, { discount_max: '1e3' }, { coupon_expires_at: '2090-02-30T12:00' }, { coupon_expires_at: '2090-05-20T25:00' }, { discount_type: 'flat', discount_flat: '0' }]) {
    const before = store.getCreator(c.id);
    assert.equal((await form(url, { ...oldFields(c), csrf, ...extra, display_name: 'Must not save' })).status, 400);
    assert.deepEqual(store.getCreator(c.id), before);
  }
  const n = `legacy${++seq}`;
  const made = await form('/admin/creators', { ...oldFields(c), csrf, username: n, coupon_code: n.toUpperCase(), password: 'Private creator password' });
  assert.equal(made.status, 303); const old = store.creatorByUsername(n); assert.equal(old.discount_type, 'percentage'); assert.equal(old.coupon_enabled, true); assert.equal(old.discount_flat_paise, 0);
});

test('discountLabel distinguishes flat/percent, caps, minimums, disable and IST expiry; unsafe photos use initials', () => {
  assert.match(views.discountLabel({ discount_type: 'flat', discount_flat_paise: 10000, discount_min_paise: 20000 }), /up to ₹100\.00 off · minimum spend ₹200\.00/);
  const label = views.discountLabel({ discount_bps: 1250, discount_max_paise: 5000, coupon_enabled: false, coupon_expires_at: '2000-01-01T00:00:00Z' });
  assert.match(label, /12\.5% off/); assert.match(label, /capped at ₹50\.00/); assert.match(label, /coupon disabled/); assert.match(label, /expired.*IST/);
  const c = creator();
  const html = views.templatesPage({ creator: { ...c, profile_image: 'https://evil.test/private.jpg', discount_type: 'flat', discount_flat_paise: 10000 }, templates: [], csrf: 'csrf', baseUrl: origin, search: '' });
  assert.ok(!html.includes('src="https://evil.test/private.jpg"')); assert.match(html, /up to ₹100\.00 off/); assert.ok(!html.includes('15% off'));
});

test('photo upload attempts are bounded per admin/IP', async () => {
  const c = creator(), csrf = await token(c); let response;
  for (let i = 0; i < 21; i++) response = await upload(c, csrf, Buffer.from('bad'));
  assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '900');
});
