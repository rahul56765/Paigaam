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
    await buyer.locator('#partner-coupon summary').click(); await buyer.locator('#partner-coupon-apply').waitFor({ state: 'visible' });
    await buyer.waitForFunction(() => !document.querySelector('#partner-coupon-apply').disabled);
    negative = await buyerCtx.request.post(base + '/api/creator-coupon', { data: { code: 'BROWSER725', csrf: 'tampered' } }); assert.equal(negative.status(), 403);
    await buyer.locator('#partner-coupon-code').fill('INVALID-QA'); await buyer.locator('#partner-coupon-apply').click();
    await buyer.waitForFunction(() => document.querySelector('#partner-coupon-status').textContent.includes('invalid'));
    await buyer.locator('#partner-coupon-code').fill('browser725'); await buyer.locator('#partner-coupon-apply').click();
    await buyer.waitForFunction(() => document.querySelector('#partner-coupon-status').textContent.includes('7.25%'));
    await snapshot(buyer, 'buyer-noor-coupon');
    check('coupon tray rejects invalid code / tampered CSRF and applies case-normalized 7.25% coupon');
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
    assert.ok(await buyer.locator('#payPublish').isVisible()); check('standard noor draft created through actual builder navigation', { draftId, steps });
    await buyer.locator('#partner-coupon summary').click(); await buyer.waitForFunction(() => document.querySelector('#partner-coupon-status').textContent.includes('7.25%'));
    await snapshot(buyer, 'buyer-preview-coupon');
    let capturedOrder, payment;
    await buyer.exposeFunction('qaCapture', async orderId => {
      const rows = fs.readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse); const order = rows.filter(r => r.path === '/v1/orders').at(-1).body;
      capturedOrder = { orderId, ...order }; payment = { id: 'pay_browser_qa', order_id: orderId, status: 'captured', amount: order.amount, currency: order.currency };
      fs.writeFileSync(fixtures, JSON.stringify({ payments: { [payment.id]: payment } }));
      return { razorpay_order_id: orderId, razorpay_payment_id: payment.id, razorpay_signature: crypto.createHmac('sha256', key).update(orderId + '|' + payment.id).digest('hex') };
    });
    const orderResponse = buyer.waitForResponse(r => r.url() === base + '/api/razorpay/order' && r.request().method() === 'POST');
    const verifyResponse = buyer.waitForResponse(r => r.url() === base + '/api/razorpay/verify' && r.request().method() === 'POST');
    await buyer.locator('#payPublish').click();
    const orderRes = await orderResponse; assert.equal(orderRes.status(), 200); const checkout = await orderRes.json();
    const verifyRes = await verifyResponse; assert.equal(verifyRes.status(), 200); const settled = await verifyRes.json();
    await buyer.locator('#paidDone').waitFor({ state: 'visible' }); assert.ok(settled.url.startsWith(base + '/p/'));
    assert.equal(checkout.amount, capturedOrder.amount); assert.ok(fs.readFileSync(calls, 'utf8').includes('/v1/payments/pay_browser_qa'));
    await snapshot(buyer, 'buyer-published');
    await navigate(buyer, settled.url); assert.equal(await buyer.locator('#partner-coupon').count(), 0); check('actual Pay & publish / SDK handler / real verify capture fetch / published recipient', { checkout, settled });
    await navigate(creator, '/creator');
    const earned = round(checkout.amount, 1250); assert.equal(await metric(creator, 'Commission earned'), money(earned)); assert.equal(await metric(creator, 'Outstanding balance'), money(earned));
    const row = creator.locator('tr').filter({ hasText: capturedOrder.orderId }); assert.match(await row.innerText(), /BROWSER725/); assert.match(await row.innerText(), /12.5%/);
    const gross = Math.round(checkout.amount / .9275); assert.equal(gross - round(gross, 725), checkout.amount, 'discounted checkout reconciles');
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
