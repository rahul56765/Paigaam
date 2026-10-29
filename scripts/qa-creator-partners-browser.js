'use strict';
/** Reusable, entirely local partner-console browser QA.
 * Run: node scripts/qa-creator-partners-browser.js
 * Optional: QA_CREATOR_OUTPUT=/absolute/output/path PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path
 * No production files/data/accounts or real gateway are used. Only the isolated
 * child receives a fail-closed node:https preload; the browser blocks external
 * traffic and replaces checkout.js with a deterministic SDK handler.
 */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const output = process.env.QA_CREATOR_OUTPUT || '/agent/workspace/creator-browser-qa';
const key = 'qa_creator_local_secret_only', webhookKey = 'qa_creator_webhook_only';
const password = 'Disposable-QA-partner-123!', newPassword = 'Disposable-QA-reset-456!';
const adminEmail = 'browser-qa@example.invalid', adminPassword = 'Disposable-QA-admin-789!';
const round = (v, n, d = 10000) => Number((BigInt(v) * BigInt(n) + BigInt(d) / 2n) / BigInt(d));
const money = v => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v / 100);
const report = { started: new Date().toISOString(), checks: [], findings: [], screenshots: [], errors: [], requests: [], externalBlocked: [] };
const check = (name, data = {}) => { report.checks.push({ name, ...data }); console.log('PASS:', name, JSON.stringify(data)); };
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-creator-browser-'));
  const fixtures = path.join(dir, 'gateway.json'), calls = path.join(dir, 'gateway-calls.jsonl');
  const preload = path.join(dir, 'mock-https.cjs');
  fs.writeFileSync(fixtures, JSON.stringify({ payments: {} }));
  fs.writeFileSync(preload, `
'use strict';
const https=require('node:https'),fs=require('node:fs'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
let sequence=0;
https.request=(options,callback)=>{
 assert.equal(options.hostname,'api.razorpay.com','External HTTPS forbidden in disposable QA child');
 assert.equal(options.auth,process.env.RAZORPAY_KEY_ID+':'+process.env.RAZORPAY_KEY_SECRET);
 assert.ok(options.method==='POST'&&options.path==='/v1/orders'||options.method==='GET'&&options.path.startsWith('/v1/payments/'),'Unexpected gateway operation');
 const req=new EventEmitter();let payload='';req.write=d=>{payload+=d.toString();};req.destroy=e=>{if(e)req.emit('error',e);};
 req.end=()=>queueMicrotask(()=>{assert.equal(options.headers['Content-Length'],Buffer.byteLength(payload));
 const body=payload?JSON.parse(payload):null;
 fs.appendFileSync(${JSON.stringify(calls)},JSON.stringify({method:options.method,path:options.path,body})+'\\n');
 const fixture=JSON.parse(fs.readFileSync(${JSON.stringify(fixtures)},'utf8'));
 const entity=options.method==='POST'?{...body,id:'order_browser_'+(++sequence)}:fixture.payments[decodeURIComponent(options.path.slice('/v1/payments/'.length))];
 const res=new EventEmitter();res.statusCode=entity?200:404;callback(res);res.emit('data',Buffer.from(JSON.stringify(entity||{error:{code:'local_fixture_missing'}})));res.emit('end');});return req;
};
// No other native HTTPS API may bypass the fail-closed request interceptor.
https.get=()=>{throw new Error('External HTTPS GET forbidden in QA');};
`);
  let child, browser, logs = '', base;
  const livePages = [];
  async function navigate(page, url) {
    const r = await page.goto(url.startsWith('http') ? url : base + url, { waitUntil: 'domcontentloaded' });
    assert.ok(r && r.status() < 400, `${url}: ${r?.status()}`);
    if (/^\/(?:admin\/creators|creator)(?:\/|$)/.test(new URL(r.url()).pathname)) {
      assert.equal(r.headers()['referrer-policy'], 'same-origin', `Served policy for ${r.url()}`);
    }
    return r;
  }
  async function assertInputValidity(form, name, invalid, valid) {
    const input = form.locator(`[name=${name}]`), original = await input.inputValue();
    assert.equal(await input.getAttribute('minlength'), '3');
    assert.equal(await input.getAttribute('maxlength'), '32');
    try {
      for (const [values, expected] of [[invalid, false], [valid, true]]) {
        for (const value of values) {
          await input.fill(value);
          const state = await input.evaluate(e => ({ valid: e.checkValidity(), patternMismatch: e.validity.patternMismatch }));
          assert.equal(state.valid, expected, `${name} HTML validity for ${JSON.stringify(value)}`);
          if (!expected) assert.equal(state.patternMismatch, true, `${name} malformed value must fail pattern`);
        }
      }
    } finally { await input.fill(original); }
    check('native HTML input validity: ' + name, { malformed: invalid.length, valid: valid.length });
  }
  async function snapshot(page, name) {
    for (const width of [320, 390, 430, 1440]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      await page.waitForTimeout(100);
      const layout = await page.evaluate(() => ({ viewport: innerWidth, client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
        offenders: [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1) && getComputedStyle(e).position !== 'fixed' && !e.closest('.pc-table-wrap'); }).slice(0, 12).map(e => ({ tag: e.tagName, cls: String(e.className).slice(0, 100), text: e.textContent.trim().slice(0, 70) })) }));
      try { assert.ok(layout.scroll <= layout.client + 1, `${name} ${width}px: ${layout.scroll}px document width`); }
      catch (e) { report.findings.push({ type: 'horizontal-overflow', message: e.message, ...layout }); }
      const file = path.join(output, `${name}-${width}.png`);
      await page.screenshot({ path: file, fullPage: true }); report.screenshots.push(file);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    check('responsive screenshots and overflow assertions: ' + name);
  }
  async function context(label) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
    await ctx.route('**/*', async route => {
      const u = route.request().url();
      if (u.startsWith(base + '/')) {
        return route.continue();
      }
      if (/^(data:|blob:|about:)/.test(u)) return route.continue();
      if (u === 'https://checkout.razorpay.com/v1/checkout.js') {
        return route.fulfill({ contentType: 'application/javascript', body: `window.Razorpay=function(options){this.open=async function(){try{var response=await window.qaCapture(options.order_id);options.handler(response);}catch(e){window.qaSdkError=String(e);}};};` });
      }
      report.externalBlocked.push({ label, url: u });
      // Deterministic empty font CSS and transparent remote image stand-ins; no external IO.
      if (route.request().resourceType() === 'stylesheet') return route.fulfill({ contentType: 'text/css', body: '' });
      if (route.request().resourceType() === 'image') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' });
      return route.abort('blockedbyclient');
    });
    ctx.on('page', page => {
      livePages.push(page);
      page.on('pageerror', e => report.errors.push({ label, type: 'pageerror', message: e.message, url: page.url() }));
      page.on('console', m => { if (m.type() === 'error') report.errors.push({ label, type: 'console', message: m.text(), url: page.url() }); });
      page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 400) report.requests.push({ label, status: response.status(), url: response.url() }); });
    });
    return ctx;
  }
  async function creatorLogin(page, username, pw = password) {
    await navigate(page, '/creator/login');
    assert.ok(await page.locator('input[name=csrf]').inputValue());
    await page.locator('[name=username]').fill(username); await page.locator('[name=password]').fill(pw);
    const posted = page.waitForResponse(r => r.url() === base + '/creator/login' && r.request().method() === 'POST');
    await page.getByRole('button', { name: /Enter your workspace/ }).click();
    assert.equal((await posted).status(), 303, 'Normal creator login must return 303 (403 is fatal)');
    await page.waitForURL(base + '/creator');
    assert.match(await page.locator('body').innerText(), /Outstanding balance/);
  }
  async function createPartner(page, username, display, coupon) {
    await navigate(page, '/admin/creators');
    const f = page.locator('form[action="/admin/creators"]');
    for (const [name, value] of Object.entries({ username, display_name: display, commission_percent: '12.5', discount_percent: '7.25', coupon_code: coupon, password })) await f.locator(`[name=${name}]`).fill(value);
    const posted = page.waitForResponse(r => r.url() === base + '/admin/creators' && r.request().method() === 'POST');
    await f.getByRole('button', { name: 'Create partner' }).click();
    const submitted = await posted;
    assert.equal(submitted.status(), 303);
    await page.waitForURL(/\/admin\/creators\/[^/?]+\?saved=1$/);
    assert.equal(await page.locator('[name=commission_percent]').inputValue(), '12.5');
    assert.equal(await page.locator('[name=discount_percent]').inputValue(), '7.25');
    check('actual admin form creates partner with decimal percentages', { username });
    return page.url().split('?')[0];
  }
  const metric = (page, heading) => page.locator('.pc-metric').filter({ has: page.getByRole('heading', { name: heading, exact: true }) }).locator('strong').innerText();
  try {
    const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening'); const port = socket.address().port; await new Promise(r => socket.close(r)); base = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, ['--require', preload, 'server.js'], { cwd: root, env: { ...process.env, NODE_OPTIONS: '', HOST: '127.0.0.1', PORT: String(port), BASE_URL: base, DATA_DIR: dir,
      ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword, RAZORPAY_ENABLED: '1', RAZORPAY_KEY_ID: 'rzp_test_browser_disposable', RAZORPAY_KEY_SECRET: key, RAZORPAY_WEBHOOK_SECRET: webhookKey }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', b => { logs += b; }); child.stderr.on('data', b => { logs += b; });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server startup timeout: ' + logs)), 20000);
      const ready = () => { if (logs.includes('admin →')) { clearTimeout(timer); resolve(); } };
      child.stdout.on('data', ready); child.once('exit', code => { clearTimeout(timer); reject(new Error('Server exit ' + code + ': ' + logs)); }); ready();
    });
    browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
    const adminCtx = await context('admin'), creatorCtx = await context('creator'), buyerCtx = await context('buyer'), otherCtx = await context('other-creator');
    const admin = await adminCtx.newPage(), creator = await creatorCtx.newPage(), buyer = await buyerCtx.newPage(), other = await otherCtx.newPage();
    await navigate(admin, '/admin/login'); await admin.locator('[name=email]').fill(adminEmail); await admin.locator('[name=password]').fill(adminPassword);
    await Promise.all([admin.waitForURL(base + '/admin'), admin.locator('button[type=submit]').click()]);
    await navigate(admin, '/admin/creators');
    const createForm = admin.locator('form[action="/admin/creators"]');
    await assertInputValidity(createForm, 'username', ['ab', '_abc', 'Uppercase', 'bad!name'], ['abc', 'qa-shares', 'qa_shares', 'a'.repeat(32)]);
    await assertInputValidity(createForm, 'coupon_code', ['ab', '_ABC', 'BAD!CODE', 'bad code'], ['ABC', 'browser725', 'QA-CODE_725', 'A'.repeat(32)]);
    check('served partner pages use same-origin referrer policy without response correction');
    await snapshot(admin, 'admin-empty-create');
    const detailUrl = await createPartner(admin, 'qa-shares', 'Browser QA Creator', 'BROWSER725');
    // Real admin file input + upload handler, not an API replacement or injected avatar.
    async function uploadPhoto(color) {
      const bytes = await sharp({ create: { width: 720, height: 540, channels: 3, background: color } }).png().toBuffer();
      await admin.locator('input[name=photo]').setInputFiles({ name: 'disposable-profile.png', mimeType: 'image/png', buffer: bytes });
      const response = admin.waitForResponse(r => r.url() === detailUrl + '/photo' && r.request().method() === 'POST');
      await admin.getByRole('button', { name: 'Upload photo', exact: true }).click();
      assert.equal((await response).status(), 200);
      await admin.waitForFunction(() => /saved/.test(document.querySelector('.pc-photo-status')?.textContent || '') || !!document.querySelector('.pc-photo-remove'));
      // Reload the persisted admin representation, including the private URL.
      await navigate(admin, detailUrl);
      const src = await admin.locator('.pc-photo-preview img').getAttribute('src');
      assert.match(src, /^\/creator\/photos\/[^/]+\/[a-f0-9]{64}\.jpg$/);
      const saved = await adminCtx.request.get(base + src); assert.equal(saved.status(), 200);
      const metadata = await sharp(await saved.body()).metadata();
      assert.equal(metadata.format, 'jpeg'); assert.equal(metadata.width, 512); assert.equal(metadata.height, 512);
      assert.equal(metadata.exif, undefined);
      return src;
    }
    const firstPhoto = await uploadPhoto('#b03f71');
    const replacementPhoto = await uploadPhoto('#147c8a'); assert.notEqual(replacementPhoto, firstPhoto);
    assert.equal((await adminCtx.request.get(base + firstPhoto)).status(), 404, 'Replaced photo is no longer served');
    const removed = admin.waitForResponse(r => r.url() === detailUrl + '/photo/remove' && r.request().method() === 'POST');
    await admin.getByRole('button', { name: 'Remove profile photo', exact: true }).click(); assert.equal((await removed).status(), 303);
    await admin.waitForURL(detailUrl + '?saved=1'); assert.equal(await admin.locator('.pc-photo-preview img').count(), 0);
    assert.equal((await adminCtx.request.get(base + replacementPhoto)).status(), 404, 'Removed photo is no longer served');
    const privatePhoto = await uploadPhoto('#5e47a3');
    await snapshot(admin, 'admin-real-photo');
    check('actual admin DP upload, replace, remove and re-upload persist sanitized private 512px JPEG');
    await snapshot(admin, 'admin-partner-created');
    await createPartner(admin, 'qa-other', 'Isolated Other Creator', 'OTHER725');
    await navigate(creator, '/creator/login'); await snapshot(creator, 'creator-login');
    const loginCsrf = await creator.locator('[name=csrf]').inputValue();
    let negative = await creatorCtx.request.post(base + '/creator/login', { form: { username: 'qa-shares', password, csrf: 'tampered' } }); assert.equal(negative.status(), 403);
    assert.ok(loginCsrf.length > 40); check('served creator login CSRF token exists and tampered POST rejected');
    const rawCtx = await context('raw-creator'), rawPage = await rawCtx.newPage();
    await navigate(rawPage, '/creator/login'); await rawPage.locator('[name=username]').fill('qa-shares'); await rawPage.locator('[name=password]').fill(password);
    const rawLogin = rawPage.waitForResponse(r => r.url() === base + '/creator/login' && r.request().method() === 'POST'); await rawPage.getByRole('button', { name: /Enter your workspace/ }).click();
    const rawResponse = await rawLogin;
    assert.equal(rawResponse.status(), 303, 'Untouched raw-creator login must redirect normally (403 is fatal)');
    assert.equal(rawResponse.request().headers().origin, base, 'Raw login retains same-origin Origin header');
    await rawPage.waitForURL(base + '/creator');
    assert.match(await rawPage.locator('body').innerText(), /Outstanding balance/);
    check('raw-creator normal browser login returns 303 without header correction');
    await rawCtx.close();
    await creatorLogin(creator, 'qa-shares'); await creatorLogin(other, 'qa-other');
    await navigate(admin, '/admin/creators');
    const activityRow = admin.locator('.pc-table tbody tr').filter({hasText:'qa-shares'});
    assert.equal(await activityRow.count(), 1);
    assert.match(await activityRow.innerText(), /Last login|Android|Linux|Chrome|Successful|Sessions/i);
    assert.match(await admin.locator('body').innerText(), /Last login/i);
    assert.match(await admin.locator('body').innerText(), /Device/i);
    assert.match(await admin.locator('body').innerText(), /Logins/i);
    assert.doesNotMatch(await admin.locator('body').innerText(), /Mozilla\/5\.0|Chrome\/\d+|User-Agent:/);
    await admin.getByRole('link', {name:'Manage Browser QA Creator'}).click();
    await admin.waitForURL(u => u.pathname.startsWith('/admin/creators/') && !u.search);
    assert.match(await admin.locator('body').innerText(), /SIGN-IN & SESSION ACTIVITY/i);
    assert.match(await admin.locator('.pc-login-analytics').innerText(), /Successful logins/i);
    assert.match(await admin.locator('.pc-login-analytics').innerText(), /Last active/i);
    assert.match(await admin.locator('.pc-login-analytics').innerText(), /Valid sessions/i);
    check('admin analytics show login time, coarse device/browser/OS, last activity, count and valid sessions; raw UA withheld');
    await navigate(admin, '/admin/creators');
    assert.equal((await buyerCtx.request.get(base + privatePhoto)).status(), 404, 'Anonymous buyer cannot read private DP');
    assert.equal((await otherCtx.request.get(base + privatePhoto)).status(), 404, 'Other creator cannot read private DP');
    const ownPhoto = await creatorCtx.request.get(base + privatePhoto); assert.equal(ownPhoto.status(), 200);
    assert.match(ownPhoto.headers()['cache-control'], /private.*no-store/);
    for (const width of [320, 390, 430]) {
      await creator.setViewportSize({ width, height: 844 });
      const greeting = creator.locator('.pc-mobile-profile img'); await greeting.waitFor({ state: 'visible' });
      assert.equal(await greeting.getAttribute('src'), privatePhoto);
      const decoded = await greeting.evaluate(async img => { await img.decode(); return { width: img.naturalWidth, height: img.naturalHeight, complete: img.complete }; });
      assert.deepEqual(decoded, { width: 512, height: 512, complete: true });
    }
    await creator.setViewportSize({ width: 1440, height: 1000 });
    check('creator mobile DP decoded at 320/390/430px; anonymous and other creator private photo access denied');
    await snapshot(creator, 'creator-empty-overview');
    await creator.getByRole('link', { name: /Find something to share/ }).click(); await creator.waitForURL(base + '/creator/templates');
    await snapshot(creator, 'creator-catalogue');
    await creator.getByLabel('Find a published template').fill('noor'); await creator.getByRole('button', { name: 'Search', exact: true }).click(); await creator.waitForURL(/q=noor/);
    const card = creator.locator('.pc-template').filter({ has: creator.locator('input[value*="%2Ftemplates%2Fnoor"]') }); assert.equal(await card.count(), 1);
    await card.getByRole('button', { name: 'Copy link', exact: true }).click();
    await creator.waitForFunction(() => document.querySelector('.pc-copy-status').textContent.includes('has been copied'));
    const tracked = await creator.evaluate(() => navigator.clipboard.readText()); assert.match(tracked, /\/r\/qa-shares\?to=%2Ftemplates%2Fnoor$/);
    check('catalogue GET search and real Copy link clipboard click', { tracked });
    await navigate(buyer, tracked); assert.equal(new URL(buyer.url()).pathname, '/templates/noor');
    const buyerCookies = await buyerCtx.cookies(); assert.ok(buyerCookies.some(c => /partner|ref/.test(c.name)), 'referral cookie set');
    assert.equal((await buyerCtx.request.get(base + '/creator')).url(), base + '/creator/login');
    assert.equal((await creatorCtx.request.get(base + '/admin/creators')).url(), base + '/admin/login');
    assert.equal((await adminCtx.request.get(base + '/creator')).url(), base + '/creator/login');
    check('buyer/admin/creator authorization remains isolated across contexts');
    await buyer.locator('a[href="/create/noor"]').first().click(); await buyer.waitForURL(base + '/create/noor');
    assert.equal(await buyer.locator('.pc-checkout-dialog').count(),0,'coupon input is absent while browsing/creating');
    const couponCsrf=(await (await buyerCtx.request.get(base+'/api/creator-coupon')).json()).csrf;
    negative = await buyerCtx.request.post(base + '/api/creator-coupon', { data: { code: 'BROWSER725', csrf: 'tampered' } }); assert.equal(negative.status(), 403);
    check('coupon input is deferred until checkout; coupon API rejects tampered CSRF');
    // Drive the actual generic builder, using its rendered controls and Next button.
    const steps = await buyer.locator('.bstep').count(); assert.ok(steps > 0);
    for (let i = 0; i < steps; i++) {
      const step = buyer.locator('.bstep').nth(i); await step.waitFor({ state: 'visible' });
      for (const field of await step.locator('input:not([type=file]),textarea,select').all()) {
        if (!(await field.isVisible())) continue;
        const tag = await field.evaluate(e => e.tagName), type = await field.getAttribute('type'), id = await field.getAttribute('data-field');
        if (tag === 'SELECT') { const options = await field.locator('option').evaluateAll(els => els.map(e => e.value).filter(Boolean)); if (options.length) await field.selectOption(options[0]); }
        else if (type === 'checkbox' || type === 'radio') await field.check();
        else if (type === 'date') await field.fill('2026-12-12');
        else if (type === 'time') await field.fill('18:30');
        else if (type !== 'hidden' && type !== 'range' && type !== 'color') await field.fill(({ brideName: 'Meher', groomName: 'Raghav', eventDate: '2026-12-12' })[id] || (type === 'number' ? '12' : 'Browser QA celebration'));
      }
      await buyer.locator('#btnNext').click();
    }
    await buyer.waitForURL(/\/preview\/[^/]+$/, { timeout: 30000 }); const draftId = new URL(buyer.url()).pathname.split('/').pop();
    assert.ok(await buyer.locator('#payPublish').isVisible()); assert.equal(await buyer.locator('.pc-checkout-dialog').count(),0); check('standard noor draft created through actual builder navigation; coupon remains hidden before checkout', { draftId, steps });

    let capturedOrder, payment;
    await buyer.exposeFunction('qaCapture', async orderId => {
      const rows = fs.readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse); const order = rows.filter(r => r.path === '/v1/orders').at(-1).body;
      capturedOrder = { orderId, ...order }; payment = { id: 'pay_browser_qa', order_id: orderId, status: 'captured', amount: order.amount, currency: order.currency };
      fs.writeFileSync(fixtures, JSON.stringify({ payments: { [payment.id]: payment } }));
      return { razorpay_order_id: orderId, razorpay_payment_id: payment.id, razorpay_signature: crypto.createHmac('sha256', key).update(orderId + '|' + payment.id).digest('hex') };
    });
    await buyer.locator('#payPublish').click();
    const checkoutDialog=buyer.locator('.pc-checkout-dialog');await checkoutDialog.waitFor({state:'visible'});
    await snapshot(buyer,'buyer-checkout-price-before-code');
    await checkoutDialog.locator('details summary').click();
    await checkoutDialog.locator('#pc-checkout-input').fill('INVALID-QA');await checkoutDialog.locator('#pc-checkout-apply').click();
    await buyer.waitForFunction(()=>document.querySelector('.pc-checkout-dialog #pc-checkout-status').textContent.includes('invalid'));
    assert.equal(await checkoutDialog.locator('#pc-checkout-continue').isDisabled(),true);
    await checkoutDialog.locator('#pc-checkout-input').fill('browser725');await checkoutDialog.locator('#pc-checkout-apply').click();
    await buyer.waitForFunction(()=>document.querySelector('.pc-checkout-dialog #pc-checkout-total')?.textContent.includes('₹462.82'));
    assert.match(await checkoutDialog.locator('#pc-checkout-continue').innerText(),/₹462.82/);
    await snapshot(buyer,'buyer-checkout-price-after-code');
    let orderResponse=buyer.waitForResponse(r=>r.url()===base+'/api/razorpay/order'&&r.request().method()==='POST');
    const verifyResponse = buyer.waitForResponse(r => r.url() === base + '/api/razorpay/verify' && r.request().method() === 'POST');
    await checkoutDialog.locator('#pc-checkout-continue').click();
    const orderRes = await orderResponse; assert.equal(orderRes.status(), 200); const checkout = await orderRes.json();
    const verifyRes = await verifyResponse; assert.equal(verifyRes.status(), 200); const settled = await verifyRes.json();
    await buyer.locator('#paidDone').waitFor({ state: 'visible' }); assert.ok(settled.url.startsWith(base + '/p/'));
    assert.equal(checkout.amount, capturedOrder.amount); assert.ok(fs.readFileSync(calls, 'utf8').includes('/v1/payments/pay_browser_qa'));
    await snapshot(buyer, 'buyer-published');
    await navigate(buyer, settled.url); assert.equal(await buyer.locator('.pc-checkout-dialog').count(),0); check('actual Pay & publish / SDK handler / real verify capture fetch / published recipient', { checkout, settled });
    await navigate(creator, '/creator');
    let earned = round(checkout.amount, 1250); assert.equal(await metric(creator, 'Commission earned'), money(earned)); assert.equal(await metric(creator, 'Outstanding balance'), money(earned));
    const row = creator.locator('tr').filter({ hasText: capturedOrder.orderId }); assert.match(await row.innerText(), /BROWSER725/); assert.match(await row.innerText(), /12.5%/);
    assert.equal(checkout.amount, 46282, 'Original ₹499 Noor minus 7.25% remains fixed');
    const gross = Math.round(checkout.amount / .9275); assert.equal(gross, 49900); assert.equal(gross - round(gross, 725), checkout.amount, 'discounted checkout reconciles');
    await snapshot(creator, 'creator-earned'); check('creator sees earned commission and attributed coupon order', { amountPaise: checkout.amount, earnedPaise: earned });
    await navigate(other, '/creator'); assert.equal(await metric(other, 'Commission earned'), money(0)); assert.ok(!(await other.locator('body').innerText()).includes(capturedOrder.orderId));
    const csrf = await creator.locator('form[action="/creator/logout"] [name=csrf]').inputValue();
    negative = await otherCtx.request.post(base + '/creator/logout', { form: { csrf } }); assert.equal(negative.status(), 403);
    check('second creator cannot see first creator finances; cross-session CSRF rejected');
    await navigate(admin, detailUrl); const payout = admin.locator('form[action$="/payout"]');
    negative = await adminCtx.request.post(detailUrl, { form: { csrf: 'tampered' } }); assert.equal(negative.status(), 403);
    const payoutPaise = Math.min(100, earned), payoutCsrf = await payout.locator('[name=csrf]').inputValue(), idem = await payout.locator('[name=idempotency_key]').inputValue();
    await payout.locator('[name=amount]').fill((payoutPaise / 100).toFixed(2)); await payout.locator('[name=reference]').fill('QA-NO-MONEY-TRANSFER'); await payout.locator('[name=note]').fill('Disposable test record, no bank transfer or real money.');
    await Promise.all([admin.waitForURL(detailUrl + '?saved=1'), payout.getByRole('button', { name: 'Record completed transfer' }).click()]);
    const replay = await adminCtx.request.post(detailUrl + '/payout', { form: { csrf: payoutCsrf, idempotency_key: idem, amount: (payoutPaise / 100).toFixed(2), reference: 'QA-NO-MONEY-TRANSFER', note: 'Disposable test record, no bank transfer or real money.' } }); assert.equal(replay.status(), 200);
    await navigate(creator, '/creator'); assert.equal(await metric(creator, 'Payouts recorded'), money(payoutPaise)); assert.equal(await metric(creator, 'Outstanding balance'), money(earned - payoutPaise));
    assert.equal(await creator.locator('tr').filter({ hasText: 'QA-NO-MONEY-TRANSFER' }).count(), 1);
    await snapshot(creator, 'creator-payout-history'); check('manual payout form, idempotent replay and creator history (no money transfer)', { payoutPaise });
    const refundAmount = Math.min(1001, checkout.amount - 1), refundBody = JSON.stringify({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_browser_partial', payment_id: payment.id, amount: refundAmount, status: 'processed' } } } });
    for (let i = 0; i < 2; i++) { const r = await fetch(base + '/api/razorpay/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-razorpay-signature': crypto.createHmac('sha256', webhookKey).update(refundBody).digest('hex') }, body: refundBody }); assert.equal(r.status, 200); }
    await navigate(creator, '/creator'); const reversed = round(earned, refundAmount, checkout.amount);
    assert.equal(await metric(creator, 'Outstanding balance'), money(earned - payoutPaise - reversed));
    const text = await creator.locator('body').innerText(); assert.ok(text.includes(money(refundAmount))); assert.ok(text.includes(money(reversed)));
    await snapshot(creator, 'creator-partial-refund'); check('signed partial refund webhook and replay update creator balance exactly once', { refundPaise: refundAmount, reversedPaise: reversed, balancePaise: earned - payoutPaise - reversed });
    // Site-wide Paigaam coupon remains distinct from the creator coupon; referral attribution still earns commission.
    await navigate(admin,'/admin/coupons');const promoForm=admin.locator('form[action="/admin/coupons"]');
    for(const [field,value] of Object.entries({code:'PAIGAAM20',description:'QA site-wide campaign',discount_percent:'20',discount_flat:'0',discount_min:'0',discount_max:'0'}))await promoForm.locator(`[name=${field}]`).fill(value);
    await promoForm.locator('[name=discount_type]').selectOption('percentage');
    const promoCreated=admin.waitForResponse(r=>r.url()===base+'/admin/coupons'&&r.request().method()==='POST');await promoForm.getByRole('button',{name:'Create Paigaam offer'}).click();assert.equal((await promoCreated).status(),303);
    await admin.waitForURL(base+'/admin/coupons?saved=1');check('admin creates Paigaam-wide coupon independently from creator coupon');
    const promoCtx=await context('paigaam-promo-buyer'),promoBuyer=await promoCtx.newPage();
    await navigate(promoBuyer,base+'/r/qa-shares?to=%2Ftemplates%2Fnoor');
    const promoDraftResponse=await promoCtx.request.post(base+'/api/drafts',{data:{template:'noor',customer_data:{brideName:'Promo Meher',groomName:'Promo Raghav',eventDate:'2026-12-12'}}});assert.equal(promoDraftResponse.status(),200);const promoDraft=await promoDraftResponse.json();await navigate(promoBuyer,'/preview/'+promoDraft.id);
    let promoOrder,promoPayment;await promoBuyer.exposeFunction('qaCapture',async orderId=>{const order=fs.readFileSync(calls,'utf8').trim().split('\n').map(JSON.parse).filter(r=>r.path==='/v1/orders').at(-1).body;promoOrder={orderId,...order};promoPayment={id:'pay_browser_paigaam_coupon',order_id:orderId,status:'captured',amount:order.amount,currency:order.currency};const fixture=JSON.parse(fs.readFileSync(fixtures,'utf8'));fixture.payments[promoPayment.id]=promoPayment;fs.writeFileSync(fixtures,JSON.stringify(fixture));return{razorpay_order_id:orderId,razorpay_payment_id:promoPayment.id,razorpay_signature:crypto.createHmac('sha256',key).update(orderId+'|'+promoPayment.id).digest('hex')};});
    await promoBuyer.locator('#payPublish').click();const promoDialog=promoBuyer.locator('.pc-checkout-dialog');await promoDialog.waitFor({state:'visible'});await promoDialog.locator('details summary').click();await promoDialog.locator('#pc-checkout-input').fill('paigaam20');await promoDialog.locator('#pc-checkout-apply').click();await promoBuyer.waitForFunction(()=>document.querySelector('.pc-checkout-dialog #pc-checkout-status').textContent.includes('Paigaam offer applied'));
    assert.match(await promoDialog.locator('#pc-checkout-price').innerText(),/Subtotal\s+₹499\.00/);assert.match(await promoDialog.locator('#pc-checkout-price').innerText(),/Discount\s+−₹99\.80/);assert.match(await promoDialog.locator('#pc-checkout-price').innerText(),/Total to pay\s+₹399\.20/);
    const promoOrderResponse=promoBuyer.waitForResponse(r=>r.url()===base+'/api/razorpay/order'&&r.request().method()==='POST'),promoVerifyResponse=promoBuyer.waitForResponse(r=>r.url()===base+'/api/razorpay/verify'&&r.request().method()==='POST');await promoDialog.locator('#pc-checkout-continue').click();assert.equal((await promoOrderResponse).status(),200);assert.equal((await promoVerifyResponse).status(),200);await promoBuyer.locator('#paidDone').waitFor({state:'visible'});assert.equal(promoOrder.amount,39920);
    earned+=round(promoOrder.amount,1250);assert.equal(earned,10775);await navigate(creator,'/creator');assert.equal(await metric(creator,'Commission earned'),money(earned));assert.equal(await metric(creator,'Outstanding balance'),money(earned-payoutPaise-reversed));assert.match(await creator.locator('tr').filter({hasText:promoOrder.orderId}).innerText(),/PAIGAAM20/);check('site-wide promo applies actual ₹399.20 checkout and referred creator still earns ₹49.90',{order:promoOrder.orderId,commissionPaise:round(promoOrder.amount,1250)});
    await navigate(admin,'/admin/coupons');assert.match(await admin.locator('body').innerText(),/PAIGAAM20/);assert.match(await admin.locator('body').innerText(),/1 paid orders/);check('admin site-wide coupon analytics report the redeemed paid order');
    // Fixture-only unpaid magazine exercises the shared checkout modal without a Canva export or live payment.
    const {DatabaseSync}=require('node:sqlite'),magDb=new DatabaseSync(path.join(dir,'paigaam.db'));
    const magazine=require('../lib/magazines/registry').bySlug('birthday-collage'),magId=crypto.randomBytes(16).toString('hex'),magOwner=crypto.randomBytes(32).toString('hex'),magOwnerHash=crypto.createHash('sha256').update(magOwner).digest('hex');
    magDb.prepare("UPDATE magazine_templates SET status='published',price=499,currency='INR',published_at=? WHERE slug=?").run(Date.now(),'birthday-collage');
    magDb.prepare("INSERT INTO magazine_orders (id,template_slug,owner_hash,status,fields_json,mapping_json,created_at,updated_at) VALUES (?,?,?,'draft','{}',?,?,?)").run(magId,magazine.slug,magOwnerHash,JSON.stringify(magazine),Date.now(),Date.now());magDb.close();
    const magBuyerCtx=await context('magazine-checkout'),magBuyer=await magBuyerCtx.newPage();await magBuyerCtx.addCookies([{name:'paigaam_mag',value:magOwner,url:base,httpOnly:true,sameSite:'Lax'}]);
    await navigate(magBuyer,'/magazines/m/'+magId);assert.equal(await magBuyer.locator('.pc-checkout-dialog').count(),0);const gatewaysBefore=fs.readFileSync(calls,'utf8').trim().split('\n').filter(Boolean).length;
    await magBuyer.locator('#magPay').click();const magDialog=magBuyer.locator('.pc-checkout-dialog');await magDialog.waitFor({state:'visible'});await magDialog.locator('details summary').click();await magDialog.locator('#pc-checkout-input').fill('PAIGAAM20');await magDialog.locator('#pc-checkout-apply').click();await magBuyer.waitForFunction(()=>document.querySelector('.pc-checkout-dialog #pc-checkout-status').textContent.includes('Paigaam offer applied'));
    const magTotals=await magDialog.locator('#pc-checkout-price').innerText();assert.match(magTotals,/Subtotal\s+₹499\.00/);assert.match(magTotals,/Total to pay\s+₹399\.20/);assert.equal(await magBuyer.locator('script[src*="checkout.razorpay.com"]').count(),0);
    await magDialog.locator('#pc-checkout-cancel').click();await magBuyer.waitForFunction(()=>!document.querySelector('.pc-checkout-dialog'));assert.equal(fs.readFileSync(calls,'utf8').trim().split('\n').filter(Boolean).length,gatewaysBefore,'cancel does not create Razorpay order');await magBuyerCtx.close();
    check('magazine checkout review displays updated Paigaam coupon total and cancel avoids creating a Razorpay order');
    await creator.locator('#pc-days').selectOption('7'); await creator.getByRole('button', { name: 'Apply', exact: true }).click(); await creator.waitForURL(/days=7/); assert.equal(await metric(creator, 'Commission earned'), money(earned));
    await creator.getByRole('button', { name: /Sign out/ }).click(); await creator.waitForURL(base + '/creator/login'); assert.equal((await creatorCtx.request.get(base + '/creator/templates')).url(), base + '/creator/login');
    await creatorLogin(creator, 'qa-shares'); await navigate(admin, detailUrl);
    await admin.locator('form:not([action$="/payout"]) [name=password]').fill(newPassword);
    await Promise.all([admin.waitForURL(detailUrl + '?saved=1'), admin.getByRole('button', { name: 'Save partner settings' }).click()]);
    await navigate(creator, '/creator'); assert.equal(creator.url(), base + '/creator/login');
    await creatorLogin(creator, 'qa-shares', newPassword); await navigate(admin, detailUrl); await admin.locator('[name=active]').uncheck();
    await Promise.all([admin.waitForURL(detailUrl + '?saved=1'), admin.getByRole('button', { name: 'Save partner settings' }).click()]);
    await navigate(creator, '/creator'); assert.equal(creator.url(), base + '/creator/login');
    await navigate(creator, '/creator/login');
    await creator.locator('[name=username]').fill('qa-shares'); await creator.locator('[name=password]').fill(newPassword);
    const disabled = creator.waitForResponse(r => r.url() === base + '/creator/login' && r.request().method() === 'POST'); await creator.getByRole('button', { name: /Enter your workspace/ }).click(); assert.equal((await disabled).status(), 401);
    assert.match(await creator.locator('[role=alert]').innerText(), /Unable to sign in/);
    await navigate(admin, detailUrl); assert.equal(await metric(admin, 'Commission earned'), money(earned));
    check('date-range lifetime invariance, logout, password reset and disable revoke sessions; history preserved');
    await navigate(other, '/creator'); assert.equal(await metric(other, 'Outstanding balance'), money(0));
    check('unrelated creator remains signed in and financially isolated after reset/disable');
    // A separate creator/buyer preserves all original ₹499 percentage, balance,
    // refund and isolation assertions above. Flat coupon is created via admin UI.
    const flatDetail = await createPartner(admin, 'qa-flat', 'Flat Coupon Creator', 'FLAT12551');
    const flatSettings = admin.locator('form.pc-editor').filter({ has: admin.locator('[name=discount_type]') });
    async function saveFlatSettings(enabled) {
      await flatSettings.locator('[name=coupon_enabled]').setChecked(enabled);
      const posted = admin.waitForResponse(r => r.url() === flatDetail && r.request().method() === 'POST');
      await flatSettings.getByRole('button', { name: 'Save partner settings' }).click();
      assert.equal((await posted).status(), 303); await admin.waitForURL(flatDetail + '?saved=1');
      // Explicit GET proves every control persisted rather than merely retaining DOM state.
      await navigate(admin, flatDetail);
      assert.equal(await flatSettings.locator('[name=discount_type]').inputValue(), 'flat');
      for (const [name, expected] of Object.entries({ discount_percent: '0', discount_flat: '125.51', discount_min: '49', discount_max: '25.02', coupon_expires_at: '2090-05-20T23:59' })) {
        assert.equal(await flatSettings.locator(`[name=${name}]`).inputValue(), expected, name + ' persisted');
      }
      assert.equal(await flatSettings.locator('[name=coupon_enabled]').isChecked(), enabled);
      assert.equal(await flatSettings.locator('[name=active]').isChecked(), true, 'Coupon toggle is not account disable');
    }
    await flatSettings.locator('[name=discount_type]').selectOption('flat');
    for (const [name, value] of Object.entries({ discount_percent: '0', discount_flat: '125.51', discount_min: '49', discount_max: '25.02', coupon_expires_at: '2090-05-20T23:59' })) await flatSettings.locator(`[name=${name}]`).fill(value);
    await saveFlatSettings(true); await saveFlatSettings(false);
    const flatBuyerCtx = await context('flat-buyer'), flatBuyer = await flatBuyerCtx.newPage();
    const flatCreatorCtx = await context('flat-creator'), flatCreator = await flatCreatorCtx.newPage();
    await creatorLogin(flatCreator, 'qa-flat'); // Coupon-disabled partner can still sign in.
    await navigate(flatBuyer, '/create/noor');
    assert.equal(await flatBuyer.locator('.pc-checkout-dialog').count(),0,'coupon option is hidden before a pay action');
    // HTTP creates a local disposable draft. The coupon prompt appears only when its actual checkout button is clicked.
    const flatDraftResponse = await flatBuyerCtx.request.post(base + '/api/drafts', { data: { template: 'noor', customer_data: { brideName: 'Flat Meher', groomName: 'Flat Raghav', eventDate: '2026-12-12' } } });
    assert.equal(flatDraftResponse.status(), 200); const flatDraft = await flatDraftResponse.json(); assert.notEqual(flatDraft.id, draftId);
    await navigate(flatBuyer, '/preview/' + flatDraft.id);
    await flatBuyer.locator('#payPublish').click();
    let flatDialog=flatBuyer.locator('.pc-checkout-dialog');await flatDialog.waitFor({state:'visible'});
    await flatDialog.locator('details summary').click();await flatDialog.locator('#pc-checkout-input').fill('FLAT12551');await flatDialog.locator('#pc-checkout-apply').click();
    await flatBuyer.waitForFunction(()=>/invalid, disabled or expired/.test(document.querySelector('.pc-checkout-dialog #pc-checkout-status').textContent));
    await flatDialog.locator('#pc-checkout-cancel').click();
    await saveFlatSettings(true);
    await snapshot(admin, 'admin-flat-coupon-controls');
    check('site coupon option is hidden before checkout; disabled creator coupon rejected at checkout without disabling partner access');
    await flatBuyer.locator('#payPublish').click();flatDialog=flatBuyer.locator('.pc-checkout-dialog');await flatDialog.waitFor({state:'visible'});
    await flatDialog.locator('details summary').click();await flatDialog.locator('#pc-checkout-input').fill('flat12551');
    const applied = flatBuyer.waitForResponse(r => r.url() === base + '/api/creator-coupon' && r.request().method() === 'POST');
    await flatDialog.locator('#pc-checkout-apply').click(); assert.equal((await applied).status(), 200);
    await flatBuyer.waitForFunction(() => document.querySelector('.pc-checkout-dialog #pc-checkout-status').textContent.includes('Creator code applied'));
    async function assertFlatCheckout() {
      const total = await flatDialog.locator('#pc-checkout-price').innerText();
      assert.match(total, /Subtotal\s+₹499\.00/);assert.match(total,/Discount\s+−₹125\.51/);assert.match(total,/Total to pay\s+₹373\.49/);
      assert.match(await flatDialog.locator('#pc-checkout-continue').innerText(),/₹373\.49/);
      const state = await (await flatBuyerCtx.request.get(base + '/api/creator-coupon')).json();
      assert.equal(state.discount_type, 'flat'); assert.equal(state.discount_bps, 0); assert.equal(state.discount_flat_paise, 12551);
      assert.equal(state.discount_min_paise, 4900); assert.equal(state.discount_max_paise, 2502);
      assert.equal(state.coupon_expires_at, '2090-05-20T18:29:00.000Z');
    }
    await assertFlatCheckout(); await snapshot(flatBuyer, 'buyer-flat-checkout-price');
    check('checkout-only flat coupon updates exact payable price before Razorpay');
    let flatOrder, flatPayment;
    await flatBuyer.exposeFunction('qaCapture', async orderId => {
      const entries = fs.readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse);
      const order = entries.filter(r => r.path === '/v1/orders').at(-1).body;
      flatOrder = { orderId, ...order };
      flatPayment = { id: 'pay_browser_flat_qa', order_id: orderId, status: 'captured', amount: order.amount, currency: order.currency };
      const fixture = JSON.parse(fs.readFileSync(fixtures, 'utf8')); fixture.payments[flatPayment.id] = flatPayment;
      fs.writeFileSync(fixtures, JSON.stringify(fixture));
      return { razorpay_order_id: orderId, razorpay_payment_id: flatPayment.id, razorpay_signature: crypto.createHmac('sha256', key).update(orderId + '|' + flatPayment.id).digest('hex') };
    });
    assert.equal(await flatBuyer.evaluate(() => typeof window.PaigaamPay?.open), 'function');
    const flatOrderResponse = flatBuyer.waitForResponse(r => r.url() === base + '/api/razorpay/order' && r.request().method() === 'POST');
    const flatVerifyResponse = flatBuyer.waitForResponse(r => r.url() === base + '/api/razorpay/verify' && r.request().method() === 'POST');
    await flatDialog.locator('#pc-checkout-continue').click();
    const flatOrderRes = await flatOrderResponse; assert.equal(flatOrderRes.status(), 200); const flatCheckout = await flatOrderRes.json();
    const flatVerifyRes = await flatVerifyResponse; assert.equal(flatVerifyRes.status(), 200); const flatSettled = await flatVerifyRes.json();
    await flatBuyer.locator('#paidDone').waitFor({ state: 'visible' });
    assert.equal(flatCheckout.amount, 49900 - 12551); assert.equal(flatOrder.amount, flatCheckout.amount);
    assert.equal(flatOrder.notes.paigaam_id, flatDraft.id); assert.equal(flatOrder.notes.template, 'noor');
    assert.ok(fs.readFileSync(calls, 'utf8').includes('/v1/payments/' + flatPayment.id), 'Real verify fetched captured payment through local gateway');
    await snapshot(flatBuyer, 'buyer-flat-published');
    await navigate(flatBuyer, flatSettled.url); assert.equal(await flatBuyer.locator('.pc-checkout-dialog').count(), 0);
    await navigate(flatCreator, '/creator');
    const flatEarned = round(flatCheckout.amount, 1250); assert.equal(flatEarned, 4669);
    assert.equal(await metric(flatCreator, 'Commission earned'), money(flatEarned));
    assert.equal(await metric(flatCreator, 'Outstanding balance'), money(flatEarned));
    const flatRow = flatCreator.locator('tr').filter({ hasText: flatOrder.orderId });
    assert.match(await flatRow.innerText(), /FLAT12551/); assert.match(await flatRow.innerText(), /12.5%/);
    assert.equal((await flatCreator.locator('body').innerText()).includes(capturedOrder.orderId), false);
    await snapshot(flatCreator, 'creator-flat-earned');
    await navigate(other, '/creator'); assert.equal(await metric(other, 'Outstanding balance'), money(0));
    check('second generic Noor flat checkout via PaigaamPay SDK and real server verify snaps ₹373.49, earns ₹46.69 and isolates attribution', { draftId: flatDraft.id, checkout: flatCheckout, order: flatOrder, earnedPaise: flatEarned, settled: flatSettled });
    // Checkout-error regression: the previous browser-QA author has finished;
    // these isolated extra purchases run after all financial-isolation assertions.
    await navigate(admin, flatDetail);
    await flatSettings.locator('[name=discount_min]').fill('9999');
    await Promise.all([admin.waitForURL(flatDetail + '?saved=1'), flatSettings.getByRole('button', { name: 'Save partner settings' }).click()]);
    const errorCtx = await context('coupon-errors'), errorBuyer = await errorCtx.newPage();
    async function applyErrorCoupon(page) {
      const dialog=page.locator('.pc-checkout-dialog');
      await dialog.waitFor({state:'visible'});
      if(!(await dialog.locator('details').evaluate(el=>el.open)))await dialog.locator('details summary').click();
      await dialog.locator('#pc-checkout-input').fill('FLAT12551');await dialog.locator('#pc-checkout-apply').click();
      await page.waitForFunction(()=>document.querySelector('.pc-checkout-dialog #pc-checkout-status').textContent.includes('minimum spend'));
      return dialog;
    }
    async function removeErrorCoupon(dialog) {
      await dialog.locator('#pc-checkout-remove').click();
      await dialog.locator('#pc-checkout-remove').waitFor({state:'hidden'});
      await dialog.locator('#pc-checkout-continue').waitFor({state:'visible'});
    }
    let errorPaymentSequence = 0;
    await errorBuyer.exposeFunction('qaCapture', async orderId => {
      const order = fs.readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse).filter(r => r.path === '/v1/orders').at(-1).body;
      const payment = { id: 'pay_coupon_retry_' + (++errorPaymentSequence), order_id: orderId, status: 'captured', amount: order.amount, currency: order.currency };
      const fixture = JSON.parse(fs.readFileSync(fixtures, 'utf8')); fixture.payments[payment.id] = payment;
      fs.writeFileSync(fixtures, JSON.stringify(fixture));
      return { razorpay_order_id: orderId, razorpay_payment_id: payment.id, razorpay_signature: crypto.createHmac('sha256', key).update(orderId + '|' + payment.id).digest('hex') };
    });
    const errorDraftRes = await errorCtx.request.post(base + '/api/drafts', { data: { template: 'noor', customer_data: { brideName: 'Retry Meher', groomName: 'Retry Raghav', eventDate: '2026-12-12' } } });
    assert.equal(errorDraftRes.status(), 200); const errorDraft = await errorDraftRes.json();
    await navigate(errorBuyer, '/preview/' + errorDraft.id);await errorBuyer.locator('#payPublish').click();
    const genericDialog=await applyErrorCoupon(errorBuyer);
    assert.equal(await genericDialog.locator('#pc-checkout-continue').isDisabled(),true);
    assert.match(await genericDialog.locator('#pc-checkout-price').innerText(),/Total to pay\s+₹499\.00/);
    await snapshot(errorBuyer,'buyer-checkout-minimum-decline');
    await removeErrorCoupon(genericDialog);
    await errorBuyer.waitForFunction(()=>document.querySelector('.pc-checkout-dialog #pc-checkout-status').textContent.includes('Coupon removed'));
    assert.match(await genericDialog.locator('#pc-checkout-status').innerText(),/Coupon removed/);
    assert.match(await genericDialog.locator('#pc-checkout-continue').innerText(),/₹499\.00/);
    const genericOrder=errorBuyer.waitForResponse(r=>r.url()===base+'/api/razorpay/order'&&r.request().method()==='POST');
    const genericVerify=errorBuyer.waitForResponse(r=>r.url()===base+'/api/razorpay/verify'&&r.request().method()==='POST');
    await genericDialog.locator('#pc-checkout-continue').click();assert.equal((await genericOrder).status(),200);assert.equal((await genericVerify).status(),200);
    await errorBuyer.locator('#paidDone').waitFor({ state: 'visible' });
    check('below-minimum creator coupon is declined before gateway order, shows guidance, and removing restores full-price Razorpay checkout');
    // Price a real bfday-family template through the existing admin form.
    await navigate(admin, '/admin/templates');
    const bfEdit = await admin.locator('tr').filter({ has: admin.locator('a[href="/templates/unrejectable"]') }).getByRole('link', { name: 'Edit', exact: true }).getAttribute('href');
    await navigate(admin, bfEdit); await admin.locator('[name=price]').fill('499');
    await Promise.all([admin.waitForURL(base + '/admin/templates'), admin.getByRole('button', { name: 'Save changes', exact: true }).click()]);
    await navigate(errorBuyer, '/create/unrejectable');
    await errorBuyer.locator('[name=senderName]').fill('Browser retry');
    const bfStepCount = await errorBuyer.locator('#bfForm .step').count();
    for (let i = 0; i < bfStepCount - 1; i++) await errorBuyer.locator('#next').click();
    const bfPublish = errorBuyer.waitForResponse(r => r.url() === base + '/api/unrejectable/publish' && r.request().method() === 'POST');
    await errorBuyer.locator('#publish').click();assert.equal((await bfPublish).status(),200);
    const bfDialog=await applyErrorCoupon(errorBuyer);await snapshot(errorBuyer,'buyer-bfday-minimum-spend');
    assert.equal(await bfDialog.locator('#pc-checkout-continue').isDisabled(),true);
    await removeErrorCoupon(bfDialog);
    const bfVerify=errorBuyer.waitForResponse(r=>r.url()===base+'/api/razorpay/verify'&&r.request().method()==='POST');
    await bfDialog.locator('#pc-checkout-continue').click();assert.equal((await bfVerify).status(),200);
    await errorBuyer.locator('#publishedResult').waitFor({ state: 'visible' });
    check('actual bfday Lajja below-minimum code is declined at checkout; remove and continue through normal Razorpay');
    // Negative UI operations intentionally log HTTP 400/401 to the browser console.
    const patterns = report.errors.filter(e => /Pattern attribute value/.test(e.message));
    if (patterns.length) report.findings.push({ type: 'invalid-html-pattern', message: 'Username and coupon pattern use unescaped hyphens rejected by Chromium HTML pattern v-mode; browser validation is bypassed, server validation remains.', samples: [...new Set(patterns.map(e => e.message))] });
    const unexpected = report.errors.filter(e => !patterns.includes(e) && !(e.type === 'console' && /Failed to load resource: the server responded with a status of (400|401|403)/.test(e.message)));
    if (unexpected.length) report.findings.push({ type: 'browser-errors', errors: unexpected });
    check('console/pageerror audit', { total: report.errors.length, unexpected: unexpected.length });
    assert.equal(Object.hasOwn(report, 'coverageWorkarounds'), false, 'No coverage workarounds may be recorded');
    check('coverageWorkarounds absent; unmodified same-context coverage completed');
    report.completed = true;
  } catch (e) {
    report.fatal = e.stack; console.error(e.stack);
    for (let i = 0; i < livePages.length; i++) { try { await livePages[i].screenshot({ path: path.join(output, `failure-page-${i}.png`), fullPage: true }); fs.writeFileSync(path.join(output, `failure-page-${i}.txt`), await livePages[i].locator('body').innerText()); } catch {} }
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (child && child.exitCode === null) { const exited = once(child, 'exit'); child.kill('SIGTERM'); const timer = setTimeout(() => child.kill('SIGKILL'), 5000); await exited; clearTimeout(timer); }
    report.gatewayCalls = fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
    fs.writeFileSync(path.join(output, 'server.log'), logs); report.finished = new Date().toISOString();
    fs.rmSync(dir, { recursive: true, force: true }); report.cleaned = true;
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log('Report:', path.join(output, 'report.json')); console.log('Findings:', report.findings.length);
    if (report.findings.length) process.exitCode = 1;
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
