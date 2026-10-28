'use strict';
/** Local real-server onboarding QA. No production credentials/data or third-party network.
 * Run: node scripts/qa-creator-onboarding-browser.js
 * Optional: PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path QA_CREATOR_ONBOARDING_OUTPUT=/path
 */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net');
const { chromium } = require('playwright');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const password = 'Disposable-onboarding-123!', adminPassword = 'Disposable-admin-456!';
let checks = 0;
const check = name => { checks++; console.log('PASS:', name); };
async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-onboarding-browser-'));
  let child, browser, logs = '';
  try {
    const socket = net.createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
    const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
    const base = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, NODE_OPTIONS: '', DATA_DIR: dir, HOST: '127.0.0.1', PORT: String(port), BASE_URL: base, ADMIN_EMAIL: 'onboarding@example.invalid', ADMIN_PASSWORD: adminPassword, RAZORPAY_ENABLED: '0', RAZORPAY_KEY_ID: '', RAZORPAY_KEY_SECRET: '', RAZORPAY_WEBHOOK_SECRET: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', b => { logs += b; }); child.stderr.on('data', b => { logs += b; });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Local server startup timeout')), 20000);
      const ready = () => { if (logs.includes('admin →')) { clearTimeout(timer); resolve(); } };
      child.stdout.on('data', ready); child.once('exit', code => { clearTimeout(timer); reject(new Error('Local server exited: ' + code)); }); ready();
    });
    browser = await chromium.launch({ headless: true, args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'], ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
    async function context(options = {}) {
      const ctx = await browser.newContext({ viewport: { width: 320, height: 844 }, ...options });
      await ctx.route(url => url.origin !== base && !['blob:', 'data:', 'about:'].includes(url.protocol), route => route.fulfill({ contentType: 'text/css', body: '' }));
      return ctx;
    }
    const ctx = await context(), page = await ctx.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/admin/login'); await page.locator('[name=email]').fill('onboarding@example.invalid'); await page.locator('[name=password]').fill(adminPassword);
    await Promise.all([page.waitForURL(base + '/admin'), page.locator('button[type=submit]').click()]);
    async function form(username) {
      await page.goto(base + '/admin/creators'); const f = page.locator('[data-creator-onboarding]');
      for (const [name, value] of Object.entries({ username, display_name: 'Local onboarding QA', coupon_code: username.toUpperCase(), password })) await f.locator(`[name=${name}]`).fill(value);
      return f;
    }
    const bytes = await sharp({ create: { width: 240, height: 320, channels: 3, background: '#8a6573' } }).png().toBuffer();
    const photo = { name: 'private-dp.png', mimeType: 'image/png', buffer: bytes };
    let f = await form('chosen-photo');
    assert.equal(await f.locator('[name=photo]').getAttribute('required'), null);
    const order = await f.evaluate(el => el.querySelector('[name=photo]').compareDocumentPosition(el.querySelector('[name=username]')) & Node.DOCUMENT_POSITION_FOLLOWING); assert.ok(order);
    const toggle = f.locator('[data-password-toggle]'), pw = f.locator('[name=password]');
    await pw.focus(); await toggle.click(); assert.equal(await pw.getAttribute('type'), 'text'); assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    await toggle.click(); assert.equal(await pw.getAttribute('type'), 'password');
    await toggle.focus(); await page.keyboard.press('Enter'); assert.equal(await pw.getAttribute('type'), 'text');
    await f.locator('[name=display_name]').focus(); assert.equal(await pw.getAttribute('type'), 'password');
    await toggle.click(); await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); assert.equal(await pw.getAttribute('type'), 'password');
    check('initial password Show/Hide, keyboard, blur and pagehide remask');
    await page.evaluate(() => { window.revokedUrls = []; const revoke = URL.revokeObjectURL.bind(URL); URL.revokeObjectURL = url => { window.revokedUrls.push(url); revoke(url); }; });
    await f.locator('[name=photo]').setInputFiles(photo); assert.match(await f.locator('[data-photo-preview]').getAttribute('src'), /^blob:/);
    await f.locator('[data-clear-photo]').click(); assert.equal(await f.locator('[data-photo-preview]').isVisible(), false); assert.equal(await page.evaluate(() => window.revokedUrls.length), 1);
    await f.locator('[name=photo]').setInputFiles(photo);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    if (process.env.QA_CREATOR_ONBOARDING_OUTPUT) { fs.mkdirSync(process.env.QA_CREATOR_ONBOARDING_OUTPUT, { recursive: true }); await f.screenshot({ path: path.join(process.env.QA_CREATOR_ONBOARDING_OUTPUT, 'create-320.png') }); }
    check('prominent optional picker, local preview/revocation and 320px layout');
    let createPosts = 0;
    page.on('request', req => { if (req.url() === base + '/admin/creators' && req.method() === 'POST') createPosts++; });
    const created = page.waitForResponse(r => r.url() === base + '/admin/creators' && r.request().method() === 'POST');
    await f.getByRole('button', { name: 'Create partner', exact: true }).click(); const response = await created;
    assert.equal(response.status(), 201); const result = await response.json(); assert.deepEqual(Object.keys(result).sort(), ['id', 'photo_upload_url', 'url']);
    assert.ok(!JSON.stringify(result).includes(password));
    const post = response.request(); assert.match(post.headers()['content-type'], /application\/x-www-form-urlencoded/); assert.ok(!new URLSearchParams(post.postData()).has('photo'));
    await page.waitForURL(base + result.url); assert.equal(createPosts, 1);
    const src = await page.locator('.pc-photo-preview img').getAttribute('src'); assert.ok(src);
    const reset = page.locator('#pc-admin-password'); assert.equal(await reset.inputValue(), ''); assert.equal(await reset.getAttribute('type'), 'password');
    assert.ok(!(await page.content()).includes(password));
    const anonymous = await context(); assert.equal((await anonymous.request.get(base + src)).status(), 404);
    const partner = await context(), cp = await partner.newPage(); await cp.goto(base + '/creator/login');
    await cp.locator('[name=username]').fill('chosen-photo'); await cp.locator('[name=password]').fill(password);
    await Promise.all([cp.waitForURL(base + '/creator'), cp.locator('button[type=submit]').click()]);
    assert.equal(await cp.locator('.pc-mobile-profile img').getAttribute('src'), src); assert.equal((await partner.request.get(base + src)).status(), 200);
    check('one create with chosen photo persists private creator DP; URL-only response; reset blank/no echo');
    await reset.fill('Disposable-reset-password-789!'); const resetToggle = page.locator('[data-password-toggle]');
    await reset.focus(); await resetToggle.click(); assert.equal(await reset.getAttribute('type'), 'text'); await resetToggle.click(); assert.equal(await reset.getAttribute('type'), 'password');
    const settings = page.locator(`form[action="/admin/creators/${result.id}"]`);
    await Promise.all([page.waitForURL(base + result.url), settings.getByRole('button', { name: 'Save partner settings' }).click()]);
    await page.waitForLoadState(); assert.equal(await page.locator('#pc-admin-password').inputValue(), ''); assert.ok(!(await page.content()).includes('Disposable-reset-password-789!'));
    check('reset Show/Hide saves without password echo and returns blank masked input');
    f = await form('invalid-photo'); await f.locator('[name=photo]').setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('bad') });
    await f.getByRole('button', { name: 'Create partner', exact: true }).click(); assert.match(await f.locator('[data-photo-selection]').innerText(), /JPG, PNG or WebP/); assert.equal(createPosts, 1);
    await f.locator('[name=photo]').setInputFiles({ name: 'huge.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) }); await f.getByRole('button', { name: 'Create partner', exact: true }).click(); assert.match(await f.locator('[data-photo-selection]').innerText(), /exceeds 5 MB/); assert.equal(createPosts, 1);
    await f.locator('[data-clear-photo]').click(); const native = page.waitForResponse(r => r.url() === base + '/admin/creators' && r.request().method() === 'POST');
    await f.getByRole('button', { name: 'Create partner', exact: true }).click(); assert.equal((await native).status(), 303); await page.waitForURL(/\/admin\/creators\/[^/?]+\?saved=1$/);
    check('invalid MIME/oversize rejected before account POST; clear recovers to native no-photo 303');
    f = await form('chosen-photo'); await f.locator('[name=photo]').setInputFiles(photo);
    await f.getByRole('button', { name: 'Create partner', exact: true }).click(); await page.waitForFunction(() => !document.querySelector('[data-creator-onboarding] button[type=submit]').disabled);
    assert.match(await f.locator('[data-onboarding-status]').innerText(), /already|unique|exists|taken/i); assert.equal(await f.locator('[data-photo-preview]').isVisible(), true);
    await f.locator('[name=username]').fill('duplicate-recovery'); await f.locator('[name=coupon_code]').fill('DUPLICATE_RECOVERY');
    await Promise.all([page.waitForURL(/\/admin\/creators\/[^/?]+\?saved=1$/), f.getByRole('button', { name: 'Create partner', exact: true }).click()]);
    check('duplicate username preserves photo and editable form for successful recovery');
    f = await form('failed-photo'); await f.locator('[name=photo]').setInputFiles(photo);
    await ctx.route('**/admin/creators/*/photo', route => route.fulfill({ status: 400, body: 'Invalid image' }));
    await Promise.all([page.waitForURL(/photo=failed#profile-photo$/), f.getByRole('button', { name: 'Create partner', exact: true }).click()]);
    assert.match(await page.locator('.pc-alert').innerText(), /account was created/); assert.equal(await page.locator('#pc-admin-password').inputValue(), '');
    assert.equal(await page.locator('.pc-photo-preview img').count(), 0); await ctx.unroute('**/admin/creators/*/photo');
    check('post-create photo failure opens persisted account with truthful allowlisted notice, not duplicate create');
    f = await form('uncertain-create'); await f.locator('[name=photo]').setInputFiles(photo);
    const beforeUncertain = createPosts;
    await ctx.route('**/admin/creators', async route => { if (route.request().method() !== 'POST') return route.continue(); await route.fetch(); return route.abort('connectionfailed'); });
    await f.getByRole('button', { name: 'Create partner', exact: true }).click(); await page.waitForFunction(() => document.querySelector('[data-onboarding-status]').textContent.includes('uncertain'));
    assert.equal(await f.locator('[name=password]').inputValue(), ''); assert.equal(await f.locator('button[type=submit]').isDisabled(), true); assert.equal(createPosts, beforeUncertain + 1);
    await ctx.unroute('**/admin/creators'); await f.getByRole('link', { name: 'Check existing partners' }).click(); await page.getByText('@uncertain-create', { exact: true }).waitFor(); assert.equal(await page.getByText('@uncertain-create', { exact: true }).count(), 1);
    check('lost create response acknowledges uncertainty, clears password, blocks retry, links to persisted account list');
    const nojs = await browser.newContext({ javaScriptEnabled: false, storageState: await ctx.storageState() }); const nj = await nojs.newPage(); await nj.goto(base + '/admin/creators');
    const nf = nj.locator('[data-creator-onboarding]'); for (const [name, value] of Object.entries({ username: 'nojs-creator', display_name: 'No JS QA', coupon_code: 'NOJS_CREATOR', password })) await nf.locator(`[name=${name}]`).fill(value);
    await nf.locator('[name=photo]').setInputFiles(photo); assert.match(await nf.locator('noscript').innerText(), /requires JavaScript/);
    const [nojsResponse] = await Promise.all([nj.waitForResponse(r => r.url() === base + '/admin/creators' && r.request().method() === 'POST'), nf.getByRole('button', { name: 'Create partner', exact: true }).click()]);
    assert.equal(nojsResponse.status(), 303); await nj.waitForURL(/\?saved=1$/); assert.equal(await nj.locator('.pc-photo-preview img').count(), 0);
    check('no-JS form with photo selection explains requirement and creates natively with 303 without upload');
    assert.deepEqual(errors, []); check('no browser JavaScript errors');
    console.log(`All ${checks} onboarding browser checks passed.`);
  } finally {
    if (browser) await browser.close();
    if (child && child.exitCode === null) { await new Promise(resolve => { child.once('exit', resolve); child.kill('SIGTERM'); }); }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
