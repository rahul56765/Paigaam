'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const http = require('node:http'), https = require('node:https');
const { EventEmitter } = require('node:events');
const crypto = require('node:crypto');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-payment-'));
process.env.DATA_DIR = dir;
process.env.RAZORPAY_ENABLED = '1';
process.env.RAZORPAY_KEY_ID = 'rzp_test_local_only';
process.env.RAZORPAY_KEY_SECRET = 'local-checkout-secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'local-webhook-secret';
const tracking = require('../lib/creators/tracking');
const store = require('../lib/creators/store');
const razorpay = require('../lib/razorpay');
const { db, q } = require('../db');
const calls = [], payments = new Map(), pending = [], missingProducts = new Set();
const realRequest = https.request;
let sequence = 0, held = false, gatewayOverride = null, server, origin;
// No network escape hatch: every HTTPS request must be a supported fake gateway call.
https.request = (options, callback) => {
  assert.equal(options.hostname, 'api.razorpay.com');
  assert.equal(options.auth, 'rzp_test_local_only:local-checkout-secret');
  assert.ok((options.method === 'POST' && options.path === '/v1/orders') || (options.method === 'GET' && options.path.startsWith('/v1/payments/')), 'unexpected HTTPS request');
  const req = new EventEmitter(); let payload = '';
  req.write = data => { payload += data.toString(); };
  req.destroy = err => { if (err) req.emit('error', err); };
  req.end = () => {
    const body = payload ? JSON.parse(payload) : null;
    calls.push({ method: options.method, path: options.path, body });
    assert.equal(options.headers['Content-Length'], Buffer.byteLength(payload));
    const deliver = () => {
      const res = new EventEmitter(); res.statusCode = 200;
      let entity = options.method === 'POST' ? { ...body, id: `order_fake_${++sequence}` } : payments.get(decodeURIComponent(options.path.slice('/v1/payments/'.length)));
      assert.ok(entity, 'payment fixture must exist');
      if (gatewayOverride) { entity = gatewayOverride(entity); gatewayOverride = null; }
      callback(res); res.emit('data', Buffer.from(JSON.stringify(entity))); res.emit('end');
    };
    if (held && options.method === 'POST') pending.push(deliver); else queueMicrotask(deliver);
  };
  return req;
};
function creator(extra = {}) {
  const username = `paytest${++sequence}`;
  return store.createCreator({ username, display_name: username, password: 'payment-test-password', commission_bps: 1250, coupon_code: username.toUpperCase(), discount_bps: 1234, ...extra }, 'test');
}
function options(extra = {}) { return { amount: 10001, currency: 'INR', receipt: 'receipt-' + sequence, notes: { paigaam_id: `product-${++sequence}`, template: 'payment-test' }, ...extra }; }
function checkout(c, opts = options()) { return tracking.runRequest({ headers: { cookie: `pg_partner_visitor=${'a'.repeat(64)}${c ? `; pg_partner_coupon=${c.coupon_code}` : ''}` } }, () => razorpay.createOrderFor(opts)); }
const captured = (order, id = `pay_fake_${++sequence}`) => ({ id, order_id: order.id, status: 'captured', amount: order.amount, currency: order.currency });
const hmac = (text, webhook = false) => crypto.createHmac('sha256', webhook ? process.env.RAZORPAY_WEBHOOK_SECRET : process.env.RAZORPAY_KEY_SECRET).update(text).digest('hex');
async function post(route, body, signature) {
  return fetch(origin + route, { method: 'POST', headers: { 'content-type': 'application/json', ...(signature ? { 'x-razorpay-signature': signature } : {}) }, body: typeof body === 'string' ? body : JSON.stringify(body) });
}
async function webhook(event, signature) { const raw = JSON.stringify(event); return post('/api/razorpay/webhook', raw, signature === undefined ? hmac(raw, true) : signature); }
function paymentEvent(entity, event = 'payment.captured') { return { event, payload: { payment: { entity } } }; }
function refundEvent(payment, id, amount, status = 'processed') { return { event: 'refund.processed', payload: { refund: { entity: { id, payment_id: payment, amount, status } } } }; }
function attachLegacy(order, amount = order.amount / 100) {
  const slug = `payment-template-${++sequence}`;
  const template = q.templateInsert({ name: slug, slug, category: 'birthday', price: 199, status: 'published' });
  const pg = q.paigaamInsert({ template_id: template.id, customer_name: 'Local buyer' });
  const row = q.orderInsert({ paigaam_id: pg.id, amount, currency: order.currency, razorpay_order_id: order.id });
  return { pg, row };
}

before(async () => {
  // Exercise the actual verify/webhook/settlement source, not a copied reimplementation.
  // A narrow harness avoids server.js boot-time asset generation and listening/seed side effects.
  const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  const start = source.indexOf("    if (method === 'POST' && p === '/api/razorpay/verify')");
  const end = source.indexOf('    /* ---------- Legal pages', start);
  assert.ok(start > 0 && end > start, 'server integration boundaries present');
  const makeHandler = new Function('require', 'razorpay', 'q', 'creatorTracking', 'magazines', 'publishPaigaam', 'BASE_URL', 'readBody', 'json', `return async function(req,res) { const method=req.method, p=new URL(req.url,BASE_URL).pathname; ${source.slice(start, end)} res.writeHead(404); res.end(); };`);
  const handler = makeHandler(require('node:module').createRequire(path.join(__dirname, '../server.js')), razorpay, { ...q, paigaamById: id => missingProducts.has(id) ? null : q.paigaamById(id) }, tracking, {
    // An unknown legacy order is not a magazine; production returns no URL.
    settleRazorpayOrder(orderId) { assert.equal(store.getOrder(orderId)?.product_type, 'paigaam'); return ''; }
  }, pg => q.paigaamUpdate(pg.id, { status: 'published', payment_status: 'paid', slug: pg.slug || `paid-${pg.id}` }), 'http://local.example.test', async req => { let raw = ''; for await (const chunk of req) raw += chunk; return raw; }, (res, status, value) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); });
  server = http.createServer((req, res) => tracking.runRequest(req, async () => {
    try { await handler(req, res); } catch (err) { res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: err.code || err.message })); }
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { https.request = realRequest; if (server) await new Promise(resolve => server.close(resolve)); db.close(); fs.rmSync(dir, { recursive: true, force: true }); });

test('gateway gets discounted integer paise and immutable magazine/paigaam snapshots', async () => {
  const c = creator({ commission_bps: 4321 });
  const opts = options({ receipt: 'r'.repeat(80), notes: { magazine_order_id: 'magazine-product', magazine: 'test-magazine' } });
  const order = await checkout(c, opts), sent = calls.at(-1).body, snapshot = store.getOrder(order.id);
  assert.equal(sent.amount, 8767); assert.equal(order.amount, 8767); assert.equal(sent.currency, 'INR');
  assert.equal(sent.receipt.length, 40); assert.deepEqual(sent.notes, opts.notes);
  assert.equal(snapshot.product_type, 'magazine'); assert.equal(snapshot.product_id, 'magazine-product'); assert.equal(snapshot.template_slug, 'test-magazine');
  assert.equal(snapshot.gross_paise, 10001); assert.equal(snapshot.discount_paise, 1234); assert.equal(snapshot.amount_paise, 8767);
  assert.equal(snapshot.commission_paise, Number((8767n * 4321n + 5000n) / 10000n));
  store.updateCreator(c.id, { commission_bps: 9999, discount_bps: 8000, coupon_code: `CHANGED${sequence}`, active: false }, 'test');
  assert.deepEqual(store.getOrder(order.id), snapshot);
  const entity = captured(order); assert.equal(razorpay.validateCapturedEntity(order.id, entity), entity);
  tracking.settle(order.id, entity.id); tracking.settle(order.id, entity.id);
  assert.equal(store.dashboard(c.id).totals.earned_paise, snapshot.commission_paise);
  assert.equal(store.getOrder(order.id).commission_bps, 4321);
});

test('overlapped gateway responses preserve AsyncLocalStorage buyer isolation (including buyer without coupon)', async () => {
  const a = creator({ discount_bps: 1000 }), b = creator({ discount_bps: 2500 });
  held = true;
  const requests = [a, b, null].map(c => checkout(c, options()));
  try {
    assert.equal(pending.length, 3);
    // Deliberately resolve in reverse order, with no timers or live gateway.
    while (pending.length) pending.pop()();
    const orders = await Promise.all(requests);
    assert.deepEqual(orders.map(o => o.amount), [9001, 7501, 10001]);
    assert.deepEqual(orders.map(o => store.getOrder(o.id).creator_id), [a.id, b.id, null]);
    assert.deepEqual(orders.map(o => store.getOrder(o.id).coupon_code), [a.coupon_code, b.coupon_code, '']);
    assert.equal(tracking.checkoutQuote({ amount: 10001, currency: 'INR' }), null);
  } finally { held = false; pending.length = 0; }
});

test('no-context legacy checkout and non-INR bypass remain compatible; stale saved codes fall back to the full price', async () => {
  const legacy = await razorpay.createOrderFor(options()); assert.equal(legacy.amount, 10001); assert.equal(store.getOrder(legacy.id), null);
  const usd = await checkout(null, options({ currency: 'USD' })); assert.equal(usd.currency, 'USD'); assert.equal(usd.amount, 10001); assert.equal(store.getOrder(usd.id), null);
  const before = calls.length;
  const staleInr = await tracking.runRequest({ headers: { cookie: 'pg_partner_coupon=MISSING' } }, () => razorpay.createOrderFor(options()));
  assert.equal(staleInr.amount,10001);assert.equal(store.getOrder(staleInr.id).coupon_code,'');assert.equal(store.getOrder(staleInr.id).amount_paise,10001);
  const staleUsd = await tracking.runRequest({ headers: { cookie: 'pg_partner_coupon=MISSING' } }, () => razorpay.createOrderFor(options({ currency: 'USD' })));
  assert.equal(staleUsd.currency,'USD');assert.equal(staleUsd.amount,10001);assert.equal(store.getOrder(staleUsd.id),null);
  for (const amount of [0, 99, 100.5, NaN, Infinity]) await assert.rejects(razorpay.createOrderFor(options({ amount })), { code: 'invalid_amount' });
  assert.equal(calls.length, before+2);
});

test('old no-cookie HTTP buyer can still create an unattributed INR checkout', async () => {
  const order = await tracking.runRequest({ headers: {} }, () => razorpay.createOrderFor(options()));
  assert.equal(order.amount, 10001);
  assert.equal(store.getOrder(order.id).creator_id, null);
  assert.equal(store.getOrder(order.id).visitor_hash, '');
});

test('gateway response amount/currency mismatch never reserves or credits', async () => {
  const c = creator();
  for (const patch of [{ amount: 10001 }, { currency: 'USD' }, { id: null }]) {
    gatewayOverride = entity => ({ ...entity, ...patch });
    await assert.rejects(checkout(c), /Gateway order did not match/);
  }
  assert.equal(store.dashboard(c.id).totals.earned_paise, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM partner_orders WHERE creator_id=?').get(c.id).n, 0);
});

test('signatures bind order/payment or exact webhook bytes and reject missing/altered values', () => {
  const signature = hmac('order_signature|pay_signature');
  assert.equal(razorpay.verifyCheckoutSignature('order_signature', 'pay_signature', signature), true);
  for (const bad of ['', 'short', signature.toUpperCase(), '0'.repeat(64)]) assert.equal(razorpay.verifyCheckoutSignature('order_signature', 'pay_signature', bad), false);
  assert.equal(razorpay.verifyCheckoutSignature('order_other', 'pay_signature', signature), false);
  assert.equal(razorpay.verifyCheckoutSignature('order_signature', 'pay_other', signature), false);
  const raw = '{"event":"payment.captured"}';
  assert.equal(razorpay.verifyWebhookSignature(raw, hmac(raw, true)), true);
  assert.equal(razorpay.verifyWebhookSignature(raw + ' ', hmac(raw, true)), false);
  assert.equal(razorpay.verifyWebhookSignature(raw, ''), false);
});

test('API payment fetch requires matching id/order/currency/amount and captured (not authorized)', async () => {
  const c = creator(), order = await checkout(c), entity = captured(order);
  payments.set(entity.id, entity);
  assert.deepEqual(await razorpay.verifyCapturedPayment(order.id, entity.id), entity);
  assert.equal(calls.at(-1).method, 'GET'); assert.equal(calls.at(-1).path, '/v1/payments/' + entity.id);
  for (const patch of [{ status: 'authorized' }, { amount: order.amount + 1 }, { amount: order.amount / 100 }, { currency: 'USD' }, { order_id: 'wrong_order' }, { id: 'wrong_payment' }]) {
    payments.set(entity.id, { ...entity, ...patch });
    await assert.rejects(razorpay.verifyCapturedPayment(order.id, entity.id), { code: 'payment_mismatch' });
  }
  const before = calls.length;
  await assert.rejects(razorpay.verifyCapturedPayment(order.id, '../private'), { code: 'invalid_payment' }); assert.equal(calls.length, before);
  assert.throws(() => razorpay.validateCapturedEntity('unknown', entity), { code: 'order_not_found' });
  assert.equal(store.getOrder(order.id).status, 'reserved');
});

test('decimal legacy rupee rows round to integer paise and snapshots override mutable legacy amount', async () => {
  for (const [rupees, paise] of [[199.99, 19999], [0.29, 29], [10.01, 1001], [1.005, 100]]) {
    const order = { id: `order_legacy_${++sequence}`, amount: paise, currency: 'INR' }; attachLegacy(order, rupees);
    const entity = captured(order); assert.equal(razorpay.validateCapturedEntity(order.id, entity), entity);
    assert.throws(() => razorpay.validateCapturedEntity(order.id, { ...entity, amount: paise + 1 }), { code: 'payment_mismatch' });
  }
  const order = await checkout(creator()); attachLegacy(order, 999);
  assert.equal(razorpay.validateCapturedEntity(order.id, captured(order)).amount, 8767);
});

test('real verify/webhook handlers reject invalid capture, settle once, replay and reverse refunds exactly', async () => {
  const c = creator(), order = await checkout(c), { pg } = attachLegacy(order), entity = captured(order);
  const verifyBody = { razorpay_order_id: order.id, razorpay_payment_id: entity.id, razorpay_signature: hmac(`${order.id}|${entity.id}`) };
  const before = calls.length;
  assert.equal((await post('/api/razorpay/verify', { ...verifyBody, razorpay_signature: 'bad' })).status, 400); assert.equal(calls.length, before);
  payments.set(entity.id, { ...entity, status: 'authorized' });
  assert.equal((await post('/api/razorpay/verify', verifyBody)).status, 409);
  assert.equal(q.paigaamById(pg.id).status, 'draft'); assert.equal(store.dashboard(c.id).totals.earned_paise, 0);
  assert.equal((await webhook(paymentEvent(entity), 'bad')).status, 400);
  assert.equal((await webhook(paymentEvent({ ...entity, amount: entity.amount + 1 }))).status, 409);
  assert.equal((await webhook({ event: 'order.paid', payload: { order: { entity: { id: order.id } } } })).status, 503);
  payments.set(entity.id, entity);
  const good = await post('/api/razorpay/verify', verifyBody); assert.equal(good.status, 200); assert.equal((await good.json()).ok, true);
  assert.equal(q.paigaamById(pg.id).status, 'published'); assert.equal(q.orderByRazorpayOrderId(order.id).status, 'paid');
  const earned = store.getOrder(order.id).commission_paise; assert.equal(earned, 1096);
  for (const event of [paymentEvent(entity), paymentEvent(entity, 'order.paid'), paymentEvent(entity)]) assert.equal((await webhook(event)).status, 200);
  assert.equal((await post('/api/razorpay/verify', verifyBody)).status, 200);
  assert.equal(store.dashboard(c.id).totals.earned_paise, earned);
  const refund = refundEvent(entity.id, `refund_${++sequence}`, 1001);
  assert.equal((await webhook(refund)).status, 200); assert.equal((await webhook(refund)).status, 200);
  assert.equal(store.dashboard(c.id).totals.balance_paise, earned - Number((BigInt(earned) * 1001n + BigInt(Math.floor(order.amount / 2))) / BigInt(order.amount)));
  assert.equal((await webhook(refundEvent(entity.id, `refund_${++sequence}`, order.amount - 1001))).status, 200);
  assert.equal(store.dashboard(c.id).totals.balance_paise, 0); assert.equal(store.getOrder(order.id).status, 'refunded');
  assert.equal((await webhook(paymentEvent(entity))).status, 200); assert.equal(store.dashboard(c.id).totals.balance_paise, 0);
  assert.equal((await webhook(refundEvent(entity.id, `refund_${++sequence}`, 0.5))).status, 400);
  assert.equal((await webhook(refundEvent(entity.id, `refund_${++sequence}`, 1, 'pending'))).status, 400);
  assert.equal((await post('/api/razorpay/webhook', '{', hmac('{', true))).status, 400);
});

test('webhook-first capture and refund-before-capture reconcile once without double commission', async () => {
  const c = creator(), order = await checkout(c), { pg } = attachLegacy(order), entity = captured(order);
  const refund = refundEvent(entity.id, `refund_${++sequence}`, order.amount);
  assert.equal((await webhook(refund)).status, 200); assert.equal((await webhook(refund)).status, 200);
  assert.equal((await webhook(paymentEvent(entity))).status, 200);
  assert.equal(q.paigaamById(pg.id).payment_status, 'paid'); assert.equal(store.getOrder(order.id).status, 'refunded');
  assert.equal(store.dashboard(c.id).totals.balance_paise, 0);
  assert.equal((await webhook(paymentEvent(entity))).status, 200); assert.equal(store.dashboard(c.id).totals.balance_paise, 0);
});

for (const missing of ['legacy order', 'product']) {
  test(`captured snapshot survives missing ${missing}; webhook retries fulfillment without duplicate commission`, async () => {
    const c = creator(), order = await checkout(c), entity = captured(order);
    let legacy = missing === 'product' ? attachLegacy(order) : null;
    // Simulate an unavailable product lookup without disabling database foreign keys.
    if (legacy) missingProducts.add(legacy.pg.id);
    const fulfillment = () => db.prepare('SELECT * FROM partner_fulfillment WHERE gateway_order_id=?').get(order.id);
    const commissions = () => db.prepare("SELECT COUNT(*) n FROM partner_ledger WHERE gateway_order_id=? AND kind='commission'").get(order.id).n;
    const generated = () => db.prepare("SELECT COUNT(*) n FROM events WHERE event='paigaam_generated'").get().n;
    const initialEvents = generated();
    try {
      assert.equal(store.getOrder(order.id).status, 'reserved');
      assert.equal(fulfillment(), undefined);
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await webhook(paymentEvent(entity));
        assert.equal(response.status, 503, 'capture is not successful fulfillment');
        assert.deepEqual(await response.json(), { error: 'fulfillment_pending' });
        assert.equal(store.getOrder(order.id).status, 'paid');
        assert.equal(store.getOrder(order.id).payment_id, entity.id);
        assert.equal(store.dashboard(c.id).totals.earned_paise, store.getOrder(order.id).commission_paise);
        assert.equal(commissions(), 1);
        assert.equal(fulfillment().status, 'pending');
        assert.equal(generated(), initialEvents);
      }
      if (legacy) missingProducts.delete(legacy.pg.id);
      else legacy = attachLegacy(order);
      for (let attempt = 0; attempt < 3; attempt++) {
        const response = await webhook(paymentEvent(entity));
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { ok: true });
        assert.equal(fulfillment().status, 'complete');
        assert.equal(q.orderByRazorpayOrderId(order.id).status, 'paid');
        assert.equal(q.paigaamById(legacy.pg.id).status, 'published');
        assert.equal(q.paigaamById(legacy.pg.id).payment_status, 'paid');
        assert.equal(commissions(), 1);
        assert.equal(store.dashboard(c.id).totals.earned_paise, store.getOrder(order.id).commission_paise);
        assert.equal(generated(), initialEvents + 1, 'repair publishes exactly one generation event');
      }
      assert.equal(db.prepare('SELECT COUNT(*) n FROM partner_fulfillment WHERE gateway_order_id=?').get(order.id).n, 1);
    } finally { if (legacy) missingProducts.delete(legacy.pg.id); }
  });
}
