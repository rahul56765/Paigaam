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
  // Preload only in the disposable child: intercept every HTTPS request so
  // these regressions can never reach the live gateway (or another HTTPS host).
  const fixturePath = path.join(dir, 'gateway.json');
  const callsPath = path.join(dir, 'gateway-calls.jsonl');
  const preloadPath = path.join(dir, 'mock-https.cjs');
  const setGateway = value => fs.writeFileSync(fixturePath, JSON.stringify(value));
  const gatewayCalls = () => fs.existsSync(callsPath) ? fs.readFileSync(callsPath, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  setGateway({ payments: {} });
  fs.writeFileSync(preloadPath, `
'use strict';
const https = require('node:https'), fs = require('node:fs');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
let sequence = 0;
https.request = (options, callback) => {
  assert.equal(options.hostname, 'api.razorpay.com', 'no live HTTPS allowed');
  assert.equal(options.auth, process.env.RAZORPAY_KEY_ID + ':' + process.env.RAZORPAY_KEY_SECRET);
  assert.ok((options.method === 'POST' && options.path === '/v1/orders') ||
    (options.method === 'GET' && options.path.startsWith('/v1/payments/')), 'unexpected gateway request');
  const req = new EventEmitter(); let payload = '';
  req.write = data => { payload += data.toString(); };
  req.destroy = err => { if (err) req.emit('error', err); };
  req.end = () => queueMicrotask(() => {
    assert.equal(options.headers['Content-Length'], Buffer.byteLength(payload));
    const body = payload ? JSON.parse(payload) : null;
    fs.appendFileSync(${JSON.stringify(callsPath)}, JSON.stringify({ method: options.method, path: options.path, body }) + '\\n');
    const fixtures = JSON.parse(fs.readFileSync(${JSON.stringify(fixturePath)}, 'utf8'));
    if (fixtures.failOrders && options.method === 'POST') return req.emit('error', new Error('local simulated gateway failure'));
    const entity = options.method === 'POST' ? { ...body, id: 'order_local_' + (++sequence) } :
      fixtures.payments[decodeURIComponent(options.path.slice('/v1/payments/'.length))];
    const res = new EventEmitter(); res.statusCode = entity ? 200 : 404;
    callback(res);
    res.emit('data', Buffer.from(JSON.stringify(entity || { error: { code: 'payment_not_found' } })));
    res.emit('end');
  });
  return req;
};
`);

  async function start() {
    server = spawn(process.execPath, ['--require', preloadPath, 'server.js'], {
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

    r = await fetch(base + '/pay/' + paidId, { redirect: 'manual' });
    assert.equal(r.status, 303, '/pay redirects to preview (inline checkout)');
    // A legacy, cookie-less buyer still gets a real INR order and snapshot.
    r = await fetch(base + '/api/razorpay/order', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: paidId })
    });
    assert.equal(r.status, 200, 'cookie-less order succeeds with local gateway');
    const checkout = await r.json();
    const { q, db } = require('../db');
    const pgRow = q.paigaamById(paidId);
    assert.equal(checkout.currency, 'INR');
    assert.equal(checkout.amount, pgRow.template_price * 100);
    const reservation = require('../lib/creators/store').getOrder(checkout.orderId);
    assert.equal(reservation.creator_id, null, 'no attribution without cookie');
    assert.equal(reservation.visitor_hash, '', 'no fabricated visitor hash');
    assert.equal(q.orderByRazorpayOrderId(checkout.orderId).currency, 'INR');
    const sentOrder = gatewayCalls().at(-1);
    assert.equal(sentOrder.path, '/v1/orders');
    assert.equal(sentOrder.body.amount, checkout.amount);
    assert.equal(sentOrder.body.currency, 'INR');

    /* ---- 3. verify endpoint: signature plus matching captured payment required ---- */
    r = await fetch(base + '/api/razorpay/verify', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ razorpay_order_id: 'order_fake', razorpay_payment_id: 'pay_fake', razorpay_signature: 'deadbeef' }),
    });
    assert.equal(r.status, 400, 'bad signature rejected');

    assert.equal(gatewayCalls().filter(x => x.method === 'GET').length, 0, 'bad signature never fetches payment');
    const orderId = checkout.orderId, paymentId = 'pay_test123';
    const captured = { id: paymentId, order_id: orderId, status: 'captured', amount: checkout.amount, currency: 'INR' };
    const sig = crypto.createHmac('sha256', KEY_SECRET).update(orderId + '|' + paymentId).digest('hex');
    const verify = () => fetch(base + '/api/razorpay/verify', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sig }),
    });
    // A valid HMAC alone is insufficient: gateway capture must match every field.
    for (const patch of [{ status: 'authorized' }, { amount: checkout.amount + 1 },
      { currency: 'USD' }, { order_id: 'order_other' }, { id: 'pay_other' }]) {
      setGateway({ payments: { [paymentId]: { ...captured, ...patch } } });
      r = await verify();
      assert.equal(r.status, 409, 'signed but mismatched capture rejected: ' + JSON.stringify(patch));
      assert.equal((await r.json()).error, 'payment_mismatch');
      assert.notEqual(q.paigaamById(paidId).payment_status, 'paid');
      assert.notEqual(q.orderByRazorpayOrderId(orderId).status, 'paid');
      assert.equal(gatewayCalls().at(-1).path, '/v1/payments/' + paymentId);
    }
    setGateway({ payments: { [paymentId]: captured } });
    r = await verify();
    assert.equal(r.status, 200, 'matching captured payment settles');
    const settled = await r.json();
    assert.ok(settled.url && settled.url.includes('/p/'), 'settlement returns live url');

    const pgAfter = q.paigaamById(paidId);
    assert.equal(pgAfter.payment_status, 'paid', 'paigaam marked paid');
    assert.equal(pgAfter.status, 'published', 'paigaam auto-published on payment');
    const paidPg = await fetch(settled.url);
    assert.equal(paidPg.status, 200, 'published paigaam serves');

    // Idempotent: replaying the same verify must not throw or double-publish.
    r = await verify();
    assert.equal(r.status, 200, 'verify is idempotent');
    const settledRow = q.orderByRazorpayOrderId(orderId);
    assert.equal(settledRow.razorpay_payment_id, paymentId);
    const generatedCount = () => db.prepare("SELECT COUNT(*) n FROM events WHERE event = 'paigaam_generated'").get().n;
    const generatedBeforeReplay = generatedCount();

    /* ---- 4. webhook replay uses the same real capture, not a conflicting id ---- */
    const wbBody = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: captured } } });
    const wbSigLive = crypto.createHmac('sha256', 'whsec_placeholder').update(wbBody).digest('hex');
    for (let i = 0; i < 2; i++) {
      r = await fetch(base + '/api/razorpay/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-razorpay-signature': wbSigLive }, body: wbBody });
      assert.equal(r.status, 200, 'same captured payment webhook replay accepted');
    }
    assert.equal(q.orderByRazorpayOrderId(orderId).razorpay_payment_id, paymentId);
    assert.equal(q.paigaamById(paidId).slug, pgAfter.slug, 'replays preserve publication');
    assert.equal(generatedCount(), generatedBeforeReplay, 'replays do not emit another publication');
    const wbBad = await fetch(base + '/api/razorpay/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-razorpay-signature': 'nope' }, body: wbBody });
    assert.equal(wbBad.status, 400, 'webhook bad signature rejected');

    // Tab-closed fallback: a different unpaid checkout is fulfilled by webhook
    // alone, then replayed with that SAME payment id.
    const fallbackPg = q.paigaamInsert({ template_id: pgRow.template_id, customer_name: 'Webhook buyer' });
    r = await fetch(base + '/api/razorpay/order', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: fallbackPg.id }),
    });
    assert.equal(r.status, 200);
    const fallbackOrder = await r.json();
    const fallbackCapture = { id: 'pay_webhook1', order_id: fallbackOrder.orderId, status: 'captured', amount: fallbackOrder.amount, currency: fallbackOrder.currency };
    const postWebhook = entity => {
      const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity } } });
      return fetch(base + '/api/razorpay/webhook', { method: 'POST', headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': crypto.createHmac('sha256', 'whsec_placeholder').update(raw).digest('hex'),
      }, body: raw });
    };
    r = await postWebhook({ ...fallbackCapture, amount: fallbackCapture.amount + 1 });
    assert.equal(r.status, 409, 'signed webhook with wrong amount rejected');
    assert.notEqual(q.paigaamById(fallbackPg.id).payment_status, 'paid');
    const beforeFallback = generatedCount();
    for (let i = 0; i < 2; i++) {
      r = await postWebhook(fallbackCapture);
      assert.equal(r.status, 200, 'webhook fallback and exact payment replay succeed');
    }
    assert.equal(q.paigaamById(fallbackPg.id).payment_status, 'paid');
    assert.equal(q.paigaamById(fallbackPg.id).status, 'published');
    assert.equal(q.orderByRazorpayOrderId(fallbackOrder.orderId).razorpay_payment_id, 'pay_webhook1');
    assert.equal(generatedCount(), beforeFallback + 1, 'webhook fallback publishes only once');

    // Legacy manual rail must not reference an undefined gateway order variable.
    r = await fetch(base + '/go/whatsapp/' + paidId, { redirect: 'manual' });
    assert.equal(r.status, 303, 'legacy WhatsApp handoff redirects without crashing');
    assert.match(r.headers.get('location'), /^https:\/\/wa\.me\//);
    const manual = q.ordersAll().find(o => o.paigaam_id === paidId && !o.razorpay_order_id);
    assert.ok(manual, 'legacy manual order exists');
    assert.equal(manual.amount, pgRow.template_price);
    assert.equal(manual.currency, 'INR');

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
