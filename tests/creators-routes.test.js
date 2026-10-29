'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-partner-routes-'));
process.env.DATA_DIR = dir;
const store = require('../lib/creators/store');
const routes = require('../lib/creators/routes');
const views = require('../pages/creators');
const { db, q } = require('../db');
let server, origin, adminToken, admin, sequence = 0;
const password = 'Route tests password 2026';
before(async () => {
  const id = q.adminCreate('route-admin@example.test', 'test-admin-password');
  admin = q.adminById(typeof id === 'string' ? id : id.id);
  adminToken = q.sessionCreate(admin.id);
  server = http.createServer(async (req, res) => {
    const jar = Object.fromEntries((req.headers.cookie || '').split(';').map(p => p.trim().split('=')));
    try {
      const handled = await routes.handle(req, res, new URL(req.url, origin), { baseUrl: req.headers['x-test-https'] ? 'https://partners.example.test' : origin, admin: jar.paigaam_session === adminToken ? admin : null });
      if (!handled) { res.statusCode = 404; res.end('Not handled'); }
    } catch (err) { res.statusCode = 500; res.end(err.stack); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  db.close(); fs.rmSync(dir, { recursive: true, force: true });
});
function creator(extra = {}) {
  const username = `routetest${++sequence}`;
  return store.createCreator({ username, display_name: `Partner ${sequence}`, password, commission_bps: 1250, coupon_code: username.toUpperCase(), discount_bps: 500, ...extra }, 'admin');
}
function csrf(html) { const m = html.match(/name="csrf" value="([^"]+)"/); assert.ok(m, 'CSRF input present'); return m[1]; }
function cookieValue(response, name) {
  const raw = response.headers.getSetCookie().find(s => s.startsWith(name + '='));
  assert.ok(raw, `${name} cookie present`); return raw.split(';')[0];
}
async function get(url, cookie, headers = {}) { return fetch(origin + url, { redirect: 'manual', headers: { ...(cookie ? { cookie } : {}), ...headers } }); }
async function post(url, values, cookie, headers = {}) {
  return fetch(origin + url, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', origin, ...(cookie ? { cookie } : {}), ...headers }, body: new URLSearchParams(values) });
}
async function login(c) {
  const page = await get('/creator/login');
  const cookie = cookieValue(page, 'pg_partner_login_csrf');
  const token = csrf(await page.text());
  const response = await post('/creator/login', { username: c.username, password, csrf: token }, cookie);
  assert.equal(response.status, 303); assert.equal(response.headers.get('location'), '/creator');
  return { cookie: cookieValue(response, 'pg_partner_session'), response };
}
function paid(c, amount = 10000) {
  const id = `route-order-${++sequence}`;
  store.reserveOrder({ gateway_order_id: id, product_id: `product-${sequence}`, product_type: 'greeting', template_slug: 'route-birthday', ...store.quote({ amount_paise: amount, currency: 'INR', referral_creator_id: c.id }) });
  store.settleOrder(id, `payment-${sequence}`);
  return id;
}
const fields = c => ({ display_name: c.display_name, commission_bps: String(c.commission_bps), coupon_code: c.coupon_code, discount_bps: String(c.discount_bps), active: '1' });

test('unrelated routes are not handled; private pages require separate partner/admin authentication', async () => {
  assert.equal((await get('/not-a-partner-route')).status, 404);
  const customer = await get('/creator', 'paigaam_creator=customer-owner-token');
  assert.equal(customer.status, 303); assert.equal(customer.headers.get('location'), '/creator/login');
  const c = creator(); const partnerCookie = `pg_partner_session=${store.createSession(c.id)}`;
  const response = await get('/admin/creators', partnerCookie);
  assert.equal(response.status, 303); assert.equal(response.headers.get('location'), '/admin/login');
});

test('login is CSRF protected and carries privacy/security headers', async () => {
  const response = await get('/creator/login');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('vary'), 'Cookie');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'same-origin');
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(response.headers.get('x-robots-tag'), /noindex/);
  const c = creator();
  assert.equal((await post('/creator/login', { username: c.username, password })).status, 403);
  const html = await response.text();
  const cookie = cookieValue(response, 'pg_partner_login_csrf');
  assert.equal((await post('/creator/login', { username: c.username, password, csrf: csrf(html) }, cookie, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await post('/creator/login', { username: c.username, password, csrf: csrf(html) }, cookie, { 'sec-fetch-site': 'cross-site' })).status, 403);
});

test('successful partner login records coarse device analytics visible only to admin', async () => {
  const c = creator();
  const loginPage = await get('/creator/login');
  const loginCookie = cookieValue(loginPage, 'pg_partner_login_csrf');
  const token = csrf(await loginPage.text());
  const ua = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/131.0.0.0 Mobile TEST-UA-RAW-NEVER-STORE';
  const result = await post('/creator/login', { username:c.username,password,csrf:token }, loginCookie, { 'user-agent':ua });
  assert.equal(result.status,303);
  const adminPage = await get('/admin/creators',`paigaam_session=${adminToken}`);
  const html = await adminPage.text();
  assert.equal(adminPage.status,200);
  assert.match(html,/Last login/); assert.match(html,/Android/); assert.match(html,/Chrome/); assert.match(html,/Phone/); assert.match(html,/>Logins</);
  assert.doesNotMatch(html,/TEST-UA-RAW-NEVER-STORE/);
  assert.equal(store.creatorAnalytics(c.id).login_count,1);
});

test('login creates a separate HttpOnly session, rotates session and logout requires CSRF', async () => {
  const c = creator(); const { cookie, response } = await login(c);
  assert.ok(store.getSession(cookie.split('=')[1]));
  const rawCookie = response.headers.getSetCookie().find(s => s.startsWith('pg_partner_session='));
  assert.match(rawCookie, /HttpOnly/); assert.match(rawCookie, /SameSite=Lax/); assert.match(rawCookie, /Max-Age=604800/);
  assert.equal((await get('/creator/logout', cookie)).status, 405);
  assert.equal((await post('/creator/logout', {}, cookie)).status, 403);
  const page = await get('/creator', cookie); const html = await page.text();
  assert.equal(page.status, 200); assert.match(html, /Lifetime financial totals/);
  const response2 = await post('/creator/logout', { csrf: csrf(html) }, cookie);
  assert.equal(response2.status, 303); assert.match(response2.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal(store.getSession(cookie.split('=')[1]), null);
});

test('HTTPS sets Secure on login and partner session cookies, appending existing cookie headers', async () => {
  const c = creator(); const page = await get('/creator/login', null, { 'x-test-https': '1' });
  assert.match(page.headers.get('set-cookie'), /; Secure/);
  const response = await post('/creator/login', { username: c.username, password, csrf: csrf(await page.text()) }, cookieValue(page, 'pg_partner_login_csrf'), { origin: 'https://partners.example.test', 'x-test-https': '1' });
  assert.equal(response.status, 303); assert.equal(response.headers.getSetCookie().length, 2);
  for (const raw of response.headers.getSetCookie()) assert.match(raw, /; Secure/);
  const req = new (require('node:stream').Readable)({ read() { this.push(null); } });
  Object.assign(req, { method: 'GET', headers: {}, socket: { remoteAddress: 'test' } });
  const headers = new Map([['Set-Cookie', 'other=keep; HttpOnly']]);
  const res = { setHeader: (k,v) => headers.set(k,v), getHeader: k => headers.get(k), writeHead() {}, end() {} };
  await routes.handle(req, res, new URL('/creator/login', origin), { baseUrl: origin });
  assert.equal(headers.get('Set-Cookie')[0], 'other=keep; HttpOnly');
});

test('anonymized creator dashboard is owner scoped and escapes all untrusted text', async () => {
  const a = creator({ display_name: '<script>alert("unsafe")</script>' }), b = creator();
  const ownOrder = paid(a), otherOrder = paid(b);
  store.recordClick(a.id, { visitor_hash: 'a'.repeat(64), path: '/templates/route-birthday' });
  const token = store.createSession(a.id);
  const response = await get('/creator?days=7&creator_id=' + b.id, `pg_partner_session=${token}`);
  const html = await response.text();
  assert.equal(response.status, 200); assert.ok(html.includes(ownOrder)); assert.ok(!html.includes(otherOrder));
  assert.ok(!html.includes('<script>alert')); assert.match(html, /&lt;script&gt;/); assert.match(html, /LAST 7 DAYS/);
  assert.ok(!html.includes('customer_name')); assert.ok(!html.includes('whatsapp')); assert.ok(!html.includes('password_hash'));
  assert.match(html, /Unique browser visitors/); assert.match(html, /30 days/);
  const invalidRange = await get('/creator?days=999', `pg_partner_session=${token}`);
  assert.match(await invalidRange.text(), /LAST 30 DAYS/);
});

test('published catalogue supports search, tracked copy/share links and escaped content', async () => {
  const slug = `published-${++sequence}`;
  q.templateInsert({ name: 'Route catalogue & card', slug, category: 'birthday', description: '<img onerror=alert(1)>', price: 199, status: 'published' });
  q.templateInsert({ name: 'Never publish secret template', slug: `draft-${sequence}`, category: 'birthday', price: 199, status: 'draft' });
  const c = creator(); const cookie = `pg_partner_session=${store.createSession(c.id)}`;
  const response = await get('/creator/templates?q=Route%20catalogue', cookie);
  const html = await response.text();
  assert.equal(response.status, 200); assert.match(html, /Route catalogue &amp; card/); assert.match(html, /data-copy=/);
  assert.ok(html.includes(`/r/${c.username}?to=%2Ftemplates%2F${slug}`));
  assert.ok(!html.includes('Never publish secret template')); assert.ok(!html.includes('<img onerror='));
  assert.match(html, /https:\/\/wa.me/); assert.match(html, /readonly/);
  assert.match(await (await get('/creator/templates?q=no-such-template-123', cookie)).text(), /No templates match/);
});

test('all partner mutations reject wrong methods, content types, oversized forms and stale sessions', async () => {
  const c = creator(), token = store.createSession(c.id), cookie = `pg_partner_session=${token}`;
  assert.equal((await post('/creator', {}, cookie)).status, 405);
  assert.equal((await post('/creator/templates', {}, cookie)).status, 405);
  const json = await fetch(origin + '/creator/logout', { method: 'POST', headers: { cookie, origin, 'content-type': 'application/json' }, body: '{}' });
  assert.equal(json.status, 415);
  assert.equal((await post('/creator/logout', { csrf: store.getSession(token).csrf, large: 'x'.repeat(17000) }, cookie)).status, 413);
  store.updateCreator(c.id, { active: false }, admin.id);
  assert.equal((await get('/creator', cookie)).status, 303);
});

test('Paigaam-wide coupons are admin-managed with CSRF, collision protection and enabled toggles', async () => {
  const unauthorized=await get('/admin/coupons');assert.equal(unauthorized.status,303);assert.equal(unauthorized.headers.get('location'),'/admin/login');
  const c=creator();
  const page=await get('/admin/coupons',`paigaam_session=${adminToken}`);assert.equal(page.status,200);const html=await page.text();const token=csrf(html);assert.match(html,/site-wide codes/i);
  const fields={csrf:token,code:'PAIGAAM15',description:'Paigaam campaign',discount_type:'percentage',discount_percent:'15',discount_flat:'0',discount_min:'0',discount_max:'0',coupon_expires_at:'',enabled:'1'};
  let saved=await post('/admin/coupons',fields,`paigaam_session=${adminToken}`);assert.equal(saved.status,303);assert.equal(store.couponOffer('paigaam15').source,'paigaam');assert.equal(store.quote({amount_paise:10000,currency:'INR',coupon_code:'paigaam15'}).discount_paise,1500);
  saved=await post('/admin/coupons/PAIGAAM15',{...fields,discount_type:'flat',discount_percent:'0',discount_flat:'25.50'},`paigaam_session=${adminToken}`);assert.equal(saved.status,303);const updated=store.couponOffer('PAIGAAM15');assert.equal(updated.discount_type,'flat');assert.equal(updated.discount_flat_paise,2550);
  saved=await post('/admin/coupons/PAIGAAM15',{...fields,enabled:'0'},`paigaam_session=${adminToken}`);assert.equal(saved.status,303);assert.equal(store.couponOffer('PAIGAAM15'),null);assert.equal(store.creatorByUsername(c.username).active,true);
  const collision=await post('/admin/coupons',{...fields,code:c.coupon_code},`paigaam_session=${adminToken}`);assert.equal(collision.status,400);assert.match(await collision.text(),/reserved by a creator/);
  const noCsrf=await post('/admin/coupons',{...fields,csrf:'forged'},`paigaam_session=${adminToken}`);assert.equal(noCsrf.status,403);
});

test('admin list/create/edit/reset/disable require admin-session-bound CSRF', async () => {
  const cookie = `paigaam_session=${adminToken}`;
  const page = await get('/admin/creators', cookie); const token = csrf(await page.text());
  const username = `new-admin-created-${++sequence}`;
  const data = { username, display_name: 'Created via admin', password, commission_bps: '1500', coupon_code: username.toUpperCase(), discount_bps: '1000', active: '1' };
  assert.equal((await post('/admin/creators', data, cookie)).status, 403);
  const invalid = await post('/admin/creators', { ...data, commission_bps: '1.5', csrf: token }, cookie);
  assert.equal(invalid.status, 400); assert.ok(!(await invalid.text()).includes(`value="${password}"`));
  const made = await post('/admin/creators', { ...data, csrf: token }, cookie);
  assert.equal(made.status, 303);
  const c = store.creatorByUsername(username); assert.ok(c);
  const activeSession = store.createSession(c.id);
  const detail = await get(`/admin/creators/${c.id}`, cookie); const detailToken = csrf(await detail.text());
  const edited = await post(`/admin/creators/${c.id}`, { ...fields(c), display_name: 'Renamed partner', password: 'replacement secure password', csrf: detailToken }, cookie);
  assert.equal(edited.status, 303); assert.equal(store.getCreator(c.id).display_name, 'Renamed partner'); assert.equal(store.getSession(activeSession), null);
  assert.ok(store.authenticate(username, 'replacement secure password'));
  const disable = { ...fields(c), csrf: detailToken }; delete disable.active;
  assert.equal((await post(`/admin/creators/${c.id}`, disable, cookie)).status, 303);
  assert.equal(store.getCreator(c.id).active, false);
  assert.equal((await get('/admin/creators/no-such-id', cookie)).status, 404);
  const oldAdminToken = adminToken; adminToken = q.sessionCreate(admin.id);
  const stale = await post('/admin/creators', { ...data, username: 'stale-token-test', csrf: token }, `paigaam_session=${adminToken}`);
  assert.equal(stale.status, 403); adminToken = oldAdminToken;
});

test('manual payouts are protected, exact-paise, idempotent and cannot exceed balance', async () => {
  const c = creator(); paid(c);
  const cookie = `paigaam_session=${adminToken}`;
  const page = await get(`/admin/creators/${c.id}`, cookie); const html = await page.text();
  const data = { amount: '5.01', reference: 'bank-transfer-route-1', note: 'Internal only: never show this to creator', csrf: csrf(html), idempotency_key: html.match(/name="idempotency_key" value="([^"]+)"/)[1] };
  const payoutUrl = `/admin/creators/${c.id}/payout`;
  assert.equal((await get(payoutUrl, cookie)).status, 405);
  assert.equal((await post(payoutUrl, { ...data, csrf: 'invalid' }, cookie)).status, 403);
  assert.equal((await post(payoutUrl, data, cookie)).status, 303);
  assert.equal((await post(payoutUrl, data, cookie)).status, 303);
  const d = store.dashboard(c.id); assert.equal(d.payouts.length, 1); assert.equal(d.payouts[0].amount_paise, 501);
  assert.equal((await post(payoutUrl, { ...data, idempotency_key: 'another-key', amount: '999' }, cookie)).status, 400);
  assert.equal((await post(payoutUrl, { ...data, idempotency_key: 'fraction-key', amount: '0.001' }, cookie)).status, 400);
  const partner = await get('/creator', `pg_partner_session=${store.createSession(c.id)}`); const partnerHtml = await partner.text();
  assert.match(partnerHtml, /bank-transfer-route-1/); assert.ok(!partnerHtml.includes('Internal only:'));
});

test('login errors are generic, IP/username attempts are bounded and forwarded IP ignored by default', async () => {
  const c = creator();
  const page = await get('/creator/login'); const token = csrf(await page.text()); const cookie = cookieValue(page, 'pg_partner_login_csrf');
  let last;
  for (let i=0; i<9; i++) last = await post('/creator/login', { username: c.username, password: 'wrong-password-1234', csrf: token }, cookie, { 'x-forwarded-for': `203.0.113.${i}` });
  assert.equal(last.status, 429); assert.equal(last.headers.get('retry-after'), '900');
  assert.match(await last.text(), /Too many sign-in attempts/);
  const absent = await post('/creator/login', { username: 'not-a-real-partner', password: 'wrong-password-1234', csrf: token }, cookie);
  assert.equal(absent.status, 401); assert.match(await absent.text(), /Unable to sign in with those details/);
});

test('views whitelist orders and payouts; unsafe images and strings never become executable markup', () => {
  const c = creator();
  const html = views.dashboardPage({ csrf: 'token', days: 30, data: { creator: c, totals: {}, daily: [], templates: [], recent_orders: [{ gateway_order_id: 'safe-id', customer_name: 'PII-SENTINEL', whatsapp: 'PHONE-SENTINEL', template_slug: '<svg onload=evil()>', status: '<script>evil()</script>' }], payouts: [{ amount_paise: 100, reference: 'safe-reference', note: 'INTERNAL-SENTINEL' }] } });
  for (const secret of ['PII-SENTINEL','PHONE-SENTINEL','INTERNAL-SENTINEL','<svg onload=evil()>','<script>evil()</script>']) assert.ok(!html.includes(secret));
  const catalogue = views.templatesPage({ creator: c, csrf: 'token', search: '', baseUrl: origin, templates: [{ slug: 'safe', name: '<img onerror=evil()>', thumbnail_url: 'javascript:evil()', price: 100 }] });
  assert.ok(!catalogue.includes('src="javascript:')); assert.ok(!catalogue.includes('<img onerror=evil()>'));
});

test('admin human percentage forms convert exact decimals to basis points on create and edit', async () => {
  const cookie = `paigaam_session=${adminToken}`;
  const page = await get('/admin/creators', cookie), token = csrf(await page.text());
  const username = `percent-form-${++sequence}`;
  const data = { username, display_name: 'Decimal percentage partner', password, coupon_code: username.toUpperCase(), active: '1', commission_percent: '12.34', discount_percent: '10.5', csrf: token };
  assert.equal((await post('/admin/creators', data, cookie)).status, 303);
  const c = store.creatorByUsername(username);
  assert.equal(c.commission_bps, 1234); assert.equal(c.discount_bps, 1050);
  const detail = await get(`/admin/creators/${c.id}`, cookie), html = await detail.text();
  assert.match(html, /name="commission_percent"[^>]*value="12\.34"/);
  assert.match(html, /name="discount_percent"[^>]*value="10\.5"/);
  const edit = { display_name: c.display_name, coupon_code: c.coupon_code, active: '1', commission_percent: '0.01', discount_percent: '0.1', csrf: csrf(html) };
  assert.equal((await post(`/admin/creators/${c.id}`, edit, cookie)).status, 303);
  assert.equal(store.getCreator(c.id).commission_bps, 1); assert.equal(store.getCreator(c.id).discount_bps, 10);
  assert.equal((await post(`/admin/creators/${c.id}`, { ...edit, commission_percent: '12.34', discount_percent: '10.5' }, cookie)).status, 303);
  assert.equal(store.getCreator(c.id).commission_bps, 1234); assert.equal(store.getCreator(c.id).discount_bps, 1050);
});

test('admin percentage forms reject excess precision, invalid decimals and out-of-range values atomically', async () => {
  const cookie = `paigaam_session=${adminToken}`, c = creator();
  const page = await get('/admin/creators', cookie), createToken = csrf(await page.text());
  const detail = await get(`/admin/creators/${c.id}`, cookie), editToken = csrf(await detail.text());
  const valid = { display_name: c.display_name, coupon_code: c.coupon_code, active: '1', commission_percent: '12.34', discount_percent: '10.5' };
  for (const field of ['commission_percent', 'discount_percent']) {
    for (const value of ['12.345', '10.500', '', 'NaN', 'Infinity', '1e1', '1,5', '.5', '1.', '-1', '+1', ' 1.5 ', field === 'commission_percent' ? '100.01' : '90.01']) {
      const username = `bad-percent-${++sequence}`;
      const invalid = { ...valid, [field]: value };
      // Supplying valid legacy bps must not allow an invalid human percentage to fall back.
      const fallback = { commission_bps: '1250', discount_bps: '500' };
      const made = await post('/admin/creators', { ...invalid, ...fallback, username, coupon_code: username.toUpperCase(), password, csrf: createToken }, cookie);
      assert.equal(made.status, 400, `create ${field}=${JSON.stringify(value)}`);
      assert.equal(store.creatorByUsername(username), null);
      const before = store.getCreator(c.id);
      const edited = await post(`/admin/creators/${c.id}`, { ...invalid, ...fallback, display_name: 'Must not be persisted', csrf: editToken }, cookie);
      assert.equal(edited.status, 400, `edit ${field}=${JSON.stringify(value)}`);
      assert.deepEqual(store.getCreator(c.id), before, 'invalid form must not partially update the creator');
    }
  }
});
