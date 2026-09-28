'use strict';
// Razorpay rail: signature verification, paid flow settlement, webhook
// fallback, recovery tokens. The Razorpay API itself is stubbed (no network);
// the server runs for real on a disposable port.
// Run: node scripts/test-razorpay.js
const { spawn } = require('node:child_process'), { once } = require('node:events');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), net = require('node:net');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');

const KEY_SECRET = 'test_secret_key_placeholder';
// The module reads env at require time — set these in THIS process too.
process.env.RAZORPAY_KEY_ID = 'rzp_test_placeholder';
process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_placeholder';
process.env.RAZORPAY_ENABLED = '1';

(async () => {
  const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(r => socket.close(r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-rzp-test-')), base = 'http://127.0.0.1:' + port;
  // The test process opens the SAME sqlite file the server uses (cross-process
  // verification of orders/paigaams). Must be set before require('../db').
  process.env.DATA_DIR = dir;
  let server;

  async function start() {
    server = spawn(process.execPath, ['server.js'], {
      cwd: root,
      env: {
        ...process.env, PORT: String(port), HOST: '127.0.0.1', BASE_URL: base, DATA_DIR: dir,
        RAZORPAY_ENABLED: '1', RAZORPAY_KEY_ID: 'rzp_test_placeholder', RAZORPAY_KEY_SECRET: KEY_SECRET,
        RAZORPAY_WEBHOOK_SECRET: 'whsec_placeholder',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stderr.on('data', x => process.stderr.write(x));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Test server startup timeout')), 15000);
      server.stdout.on('data', chunk => { if (chunk.toString().includes('admin →')) { clearTimeout(timer); resolve(); } });
      server.on('exit', code => { clearTimeout(timer); reject(new Error('Test server exited ' + code)); });
    });
  }
  async function stop() { if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); } }

  try {
    await start();

    /* ---- 1. module-level crypto checks ---- */
    const rzp = require('../lib/razorpay');
    const goodSig = crypto.createHmac('sha256', KEY_SECRET).update('order_abc|pay_xyz').digest('hex');
    assert.equal(rzp.verifyCheckoutSignature('order_abc', 'pay_xyz', goodSig), true, 'valid checkout sig accepted');
    assert.equal(rzp.verifyCheckoutSignature('order_abc', 'pay_xyz', goodSig.slice(0, -1) + '0'), false, 'tampered sig rejected');
    assert.equal(rzp.verifyCheckoutSignature('', 'pay_xyz', goodSig), false, 'missing fields rejected');
    const wbSig = crypto.createHmac('sha256', 'whsec_placeholder').update('{"event":"payment.captured"}').digest('hex');
    process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_placeholder';
    assert.equal(rzp.verifyWebhookSignature('{"event":"payment.captured"}', wbSig), true, 'valid webhook sig accepted');
    assert.equal(rzp.verifyWebhookSignature('{"event":"evil"}', wbSig), false, 'wrong body rejected');

    /* ---- 2. paid draft → /pay (checkout page renders with order) ---- */
    // noor is a classic paid template using the generic endpoints.
    let r = await fetch(base + '/api/drafts', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ template: 'noor', customer_data: { brideName: 'Meher', groomName: 'Raghav', eventDate: '2026-12-12' } }),
    });
    assert.equal(r.status, 200);
    const { id: paidId } = await r.json();
    assert.ok(paidId, 'draft created');

    r = await fetch(base + '/preview/' + paidId);
    assert.equal(r.status, 200);
    const previewHtml = await r.text();
    assert.match(previewHtml, /Pay &amp; publish/, 'razorpay CTA on paid preview');
    assert.doesNotMatch(previewHtml, /go\/whatsapp/, 'no WhatsApp handoff on paid preview');
    assert.match(previewHtml, /\/recover\/[a-f0-9]{32}/, 'recovery link nudged on preview');

    // /pay/:id would create a real Razorpay order — without network it 502s,
    // which is the correct failure shape (checkout page with explanation).
    r = await fetch(base + '/pay/' + paidId);
    assert.equal(r.status, 502, 'pay page degrades gracefully when gateway unreachable');
    const payHtml = await r.text();
    assert.match(payHtml, /Checkout is not open|payment gateway/, 'friendly error, no crash');

    /* ---- 3. verify endpoint: bad signature rejected, good signature settles ---- */
    r = await fetch(base + '/api/razorpay/verify', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ razorpay_order_id: 'order_fake', razorpay_payment_id: 'pay_fake', razorpay_signature: 'deadbeef' }),
    });
    assert.equal(r.status, 400, 'bad signature rejected');

    // Seed an order with a known rzp order id + craft a valid signature.
    const { q } = require('../db');
    const pgRow = q.paigaamById(paidId);
    q.orderInsert({ paigaam_id: paidId, customer_name: 'Meher & Raghav', amount: pgRow.template_price, currency: 'INR', razorpay_order_id: 'order_test123' });
    const sig = crypto.createHmac('sha256', KEY_SECRET).update('order_test123|pay_test123').digest('hex');
    r = await fetch(base + '/api/razorpay/verify', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ razorpay_order_id: 'order_test123', razorpay_payment_id: 'pay_test123', razorpay_signature: sig }),
    });
    assert.equal(r.status, 200, 'good signature settles');
    const settled = await r.json();
    assert.ok(settled.url && settled.url.includes('/p/'), 'settlement returns live url');

    const pgAfter = q.paigaamById(paidId);
    assert.equal(pgAfter.payment_status, 'paid', 'paigaam marked paid');
    assert.equal(pgAfter.status, 'published', 'paigaam auto-published on payment');
    const paidPg = await fetch(settled.url);
    assert.equal(paidPg.status, 200, 'published paigaam serves');

    // Idempotent: replaying the same verify must not throw or double-publish.
    r = await fetch(base + '/api/razorpay/verify', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ razorpay_order_id: 'order_test123', razorpay_payment_id: 'pay_test123', razorpay_signature: sig }),
    });
    assert.equal(r.status, 200, 'verify is idempotent');

    /* ---- 4. webhook fallback (tab closed before verify) ---- */
    const wbBody = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_webhook1', order_id: 'order_test123', status: 'captured' } } } });
    const wbSigLive = crypto.createHmac('sha256', 'whsec_placeholder').update(wbBody).digest('hex');
    r = await fetch(base + '/api/razorpay/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-razorpay-signature': wbSigLive }, body: wbBody });
    assert.equal(r.status, 200, 'webhook accepted');
    const wbBad = await fetch(base + '/api/razorpay/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-razorpay-signature': 'nope' }, body: wbBody });
    assert.equal(wbBad.status, 400, 'webhook bad signature rejected');

    /* ---- 5. recovery token ---- */
    const recToken = pgAfter.recovery_token || q.paigaamById(paidId).recovery_token;
    assert.match(recToken || '', /^[a-f0-9]{32}$/, 'recovery token exists after settlement');
    r = await fetch(base + '/recover/' + recToken);
    assert.equal(r.status, 200);
    const recHtml = await r.text();
    assert.match(recHtml, /Here's your Paigaam/, 'recover page renders');
    assert.match(recHtml, new RegExp(pgAfter.slug), 'recover page links the live paigaam');

    // Unknown token → friendly 404, no enumeration.
    r = await fetch(base + '/recover/' + '0'.repeat(32));
    assert.equal(r.status, 404, 'unknown token 404s');

    /* ---- 6. free flow untouched ---- */
    r = await fetch(base + '/api/drafts', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ template: 'aashi', customer_data: { yourName: 'Rahul', partnerName: 'Aashi' } }),
    });
    const { id: freeId } = await r.json();
    r = await fetch(base + '/api/free-publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: freeId }) });
    assert.equal(r.status, 200, 'free publish still works');

    console.log('\nALL RAZORPAY TESTS GREEN');
  } finally {
    await stop();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
})().catch(e => { console.error(e); process.exit(1); });
