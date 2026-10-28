'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-onboarding-'));
process.env.DATA_DIR = dir;
const routes = require('../lib/creators/routes'), store = require('../lib/creators/store'), { db } = require('../db');
let server, origin, csrf;
const cookie = 'paigaam_session=onboarding-test', password = 'Disposable-test-password-123';
before(async () => {
  server = http.createServer(async (req, res) => {
    try { if (!await routes.handle(req, res, new URL(req.url, origin), { baseUrl: origin, admin: req.headers.cookie === cookie ? { id: 'onboarding-admin' } : null })) { res.writeHead(404); res.end(); } }
    catch { res.writeHead(500); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
  csrf = (await (await fetch(origin + '/admin/creators', { headers: { cookie } })).text()).match(/name="csrf" value="([^"]+)"/)[1];
});
after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); fs.rmSync(dir, { recursive: true, force: true }); });
function create(username, accept) {
  return fetch(origin + '/admin/creators', { method: 'POST', redirect: 'manual', headers: { cookie, origin, 'content-type': 'application/x-www-form-urlencoded', ...(accept ? { accept } : {}) }, body: new URLSearchParams({ csrf, username, display_name: 'Onboarding creator', password, commission_percent: '10', discount_percent: '10', coupon_code: username.toUpperCase(), active: '1' }) });
}
test('JSON opt-in creates one account with only server-generated URLs/id and no secrets', async () => {
  const response = await create('json-creator', 'application/json'); assert.equal(response.status, 201);
  const result = await response.json(); assert.deepEqual(Object.keys(result).sort(), ['id', 'photo_upload_url', 'url']);
  assert.equal(result.url, `/admin/creators/${result.id}?saved=1`); assert.equal(result.photo_upload_url, `/admin/creators/${result.id}/photo`);
  assert.ok(!JSON.stringify(result).includes(password)); assert.ok(store.authenticate('json-creator', password));
  const duplicate = await create('json-creator', 'application/json'); assert.equal(duplicate.status, 400); assert.ok(!JSON.stringify(await duplicate.json()).includes(password));
  assert.equal(store.listCreators().length, 1);
  const detail = await (await fetch(origin + result.url, { headers: { cookie } })).text();
  assert.ok(!detail.includes(password)); assert.match(detail, /id="pc-admin-password" type="password" name="password"/);
  assert.match(detail, /aria-controls="pc-admin-password" aria-pressed="false"/);
});
test('ordinary and no-photo native creation remain 303; admin-only UI presents photo before username', async () => {
  const response = await create('native-creator'); assert.equal(response.status, 303); assert.match(response.headers.get('location'), /\?saved=1$/);
  const page = await fetch(origin + '/admin/creators', { headers: { cookie } }); const html = await page.text();
  assert.ok(html.indexOf('id="pc-new-photo"') < html.indexOf('name="username"'));
  assert.match(html, /Photo upload requires JavaScript/); assert.match(html, /creators\.js\?v=3/); assert.match(html, /creators\.css\?v=3/);
  assert.match(page.headers.get('content-security-policy'), /img-src[^;]*blob:/);
  const login = await (await fetch(origin + '/creator/login')).text(); assert.ok(!login.includes('data-password-toggle'));
});
test('photo failure query is strictly allowlisted and never echoes arbitrary query text', async () => {
  const c = store.creatorByUsername('json-creator');
  const html = await (await fetch(`${origin}/admin/creators/${c.id}?photo=failed`, { headers: { cookie } })).text();
  assert.match(html, /account was created, but its profile photo could not be confirmed/); assert.match(html, /id="profile-photo"/);
  const unknown = await (await fetch(`${origin}/admin/creators/${c.id}?photo=arbitrary-injected-notice`, { headers: { cookie } })).text();
  assert.ok(!unknown.includes('arbitrary-injected-notice')); assert.ok(!unknown.includes('account was created, but its profile photo could not be confirmed'));
});
