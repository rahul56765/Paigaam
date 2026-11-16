import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutMode, razorpayCreateOrder, fetchPayment, verifyCheckoutSignature,
  verifyWebhookSignature, validateCapturedPayment } from '../src/payments.mjs';

const env = { CHECKOUT_ENABLED: 'true', RAZORPAY_KEY_ID: 'rzp_test_abc123',
  RAZORPAY_KEY_SECRET: 'server-secret', RAZORPAY_WEBHOOK_SECRET: 'webhook-secret' };
const encoder = new TextEncoder();
const quote = { orderId: 'order_abc123', amount: 49900, currency: 'INR' };
const captured = { id: 'pay_abc123', order_id: quote.orderId, amount: quote.amount,
  currency: 'INR', status: 'captured', captured: true, amount_refunded: 0 };
const code = expected => error => error.code === expected && error.message === expected;
async function sign(secret, bytes) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, bytes)),
    byte => byte.toString(16).padStart(2, '0')).join('');
}
function mockFetch(t, implementation = () => { throw new Error('Unexpected gateway call'); }) {
  t.mock.method(globalThis, 'fetch', implementation);
}

test('checkout defaults disabled; only exact flags and recognized configured keys enable it', () => {
  assert.deepEqual(checkoutMode(), { enabled: false, mode: 'disabled' });
  assert.deepEqual(checkoutMode(env), { enabled: true, mode: 'test' });
  for (const patch of [ { CHECKOUT_ENABLED: undefined }, { CHECKOUT_ENABLED: true },
    { CHECKOUT_ENABLED: '1' }, { CHECKOUT_ENABLED: 'TRUE' }, { RAZORPAY_KEY_ID: 'unknown' },
    { RAZORPAY_KEY_SECRET: '' }, { RAZORPAY_KEY_SECRET: ' ' } ]) {
    assert.deepEqual(checkoutMode({ ...env, ...patch }), { enabled: false, mode: 'disabled' });
  }
  const live = { ...env, RAZORPAY_KEY_ID: 'rzp_live_abc123' };
  for (const flag of [undefined, false, true, 'false', '1', 'TRUE']) {
    assert.deepEqual(checkoutMode({ ...live, ALLOW_LIVE_PAYMENTS: flag }), { enabled: false, mode: 'disabled' });
  }
  assert.deepEqual(checkoutMode({ ...live, ALLOW_LIVE_PAYMENTS: 'true' }), { enabled: true, mode: 'live' });
  assert.deepEqual(checkoutMode({ ...live, ALLOW_LIVE_PAYMENTS: 'true', CHECKOUT_ENABLED: 'false' }),
    { enabled: false, mode: 'disabled' });
});

test('disabled and unapproved live credentials cannot create gateway orders', async t => {
  mockFetch(t);
  for (const config of [{}, { ...env, CHECKOUT_ENABLED: 'false' }, { ...env, RAZORPAY_KEY_ID: 'rzp_live_abc' }]) {
    await assert.rejects(razorpayCreateOrder(config, { amount: 100 }), code('razorpay_disabled'));
  }
  await assert.rejects(fetchPayment({}, 'pay_abc'), code('razorpay_disabled'));
  assert.equal(fetch.mock.callCount(), 0);
});

test('read-only reconciliation fetch works with checkout paused but never creates orders', async t => {
  const paused = { ...env, CHECKOUT_ENABLED:'false', RAZORPAY_KEY_ID:'rzp_live_abc123' };
  mockFetch(t, async (url, options) => {
    assert.equal(url, 'https://api.razorpay.com/v1/payments/pay_abc123');
    assert.equal(options.method, 'GET'); assert.equal(options.body, undefined);
    return Response.json(captured);
  });
  assert.deepEqual(await fetchPayment(paused, captured.id),captured);
  await assert.rejects(razorpayCreateOrder(paused,{amount:100}),code('razorpay_disabled'));
  assert.equal(fetch.mock.callCount(),1);
});

test('order uses server-side Basic auth, paise, receipt and notes; valid small amount accepted', async t => {
  mockFetch(t, async (url, options) => {
    assert.equal(url, 'https://api.razorpay.com/v1/orders');
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, `Basic ${btoa('rzp_test_abc123:server-secret')}`);
    assert.equal(options.headers['Content-Type'], 'application/json');
    const body = JSON.parse(options.body);
    assert.deepEqual(body, { amount: 1, currency: 'INR', receipt: 'receipt1', notes: { product: 'greeting' } });
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ id: quote.orderId, ...body });
  });
  const result = await razorpayCreateOrder(env, { amount: 1, receipt: 'receipt1', notes: { product: 'greeting' } });
  assert.equal(result.id, quote.orderId);
  assert.equal(fetch.mock.callCount(), 1);
});

test('invalid amounts, currencies, receipts, notes and IDs fail without network', async t => {
  mockFetch(t);
  for (const amount of [0, -1, 1.1, NaN, Infinity, '100', Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(razorpayCreateOrder(env, { amount }), code('invalid_amount'));
  }
  for (const currency of ['USD', 'inr', '', null]) {
    await assert.rejects(razorpayCreateOrder(env, { amount: 100, currency }), code('unsupported_currency'));
  }
  for (const receipt of [1, null, 'r'.repeat(41)]) {
    await assert.rejects(razorpayCreateOrder(env, { amount: 100, receipt }), code('invalid_receipt'));
  }
  for (const notes of [[], null, 'notes', new Date(), { key: 123 }, { key: 'x'.repeat(257) },
    Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`key${i}`, 'value']))]) {
    await assert.rejects(razorpayCreateOrder(env, { amount: 100, notes }), code('invalid_notes'));
  }
  for (const id of ['', undefined, 123, 'order_abc', 'pay_../secret', 'pay_abc?secret', 'pay_', 'pay_' + 'x'.repeat(121)]) {
    await assert.rejects(fetchPayment(env, id), code('invalid_payment'));
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('order amount, currency and ID must match the gateway result', async t => {
  let result;
  mockFetch(t, async () => Response.json(result));
  for (result of [null, {}, { id: 'not-an-order', amount: 100, currency: 'INR' },
    { id: quote.orderId, amount: 101, currency: 'INR' }, { id: quote.orderId, amount: 100, currency: 'USD' }]) {
    await assert.rejects(razorpayCreateOrder(env, { amount: 100 }), code('gateway_order_mismatch'));
  }
});

test('payment fetch validates identity and uses a bodyless GET', async t => {
  let payment = captured;
  mockFetch(t, async (url, options) => {
    assert.equal(url, 'https://api.razorpay.com/v1/payments/pay_abc123');
    assert.equal(options.method, 'GET');
    assert.equal(options.body, undefined);
    return Response.json(payment);
  });
  assert.deepEqual(await fetchPayment(env, captured.id), captured);
  payment = { ...captured, id: 'pay_another' };
  await assert.rejects(fetchPayment(env, captured.id), code('payment_mismatch'));
});

test('gateway failures are bounded, sanitized and never expose upstream secrets', async t => {
  let respond;
  mockFetch(t, async () => respond());
  for (const [factory, expected] of [
    [() => Response.json({ error: { description: env.RAZORPAY_KEY_SECRET } }, { status: 401 }), 'gateway_error'],
    [() => new Response('s'.repeat(70000)), 'gateway_invalid_response'],
    [() => new Response('invalid JSON ' + env.RAZORPAY_KEY_SECRET), 'gateway_invalid_response'],
    [() => { throw new Error('fetch leaked ' + env.RAZORPAY_KEY_SECRET); }, 'gateway_unreachable'],
  ]) {
    respond = factory;
    await assert.rejects(fetchPayment(env, captured.id), error => {
      assert.equal(error.code, expected);
      assert.equal(error.status, 502);
      assert.equal(error.message, expected);
      assert.ok(!String(error.stack).includes(env.RAZORPAY_KEY_SECRET));
      return true;
    });
  }
});

test('oversized streamed success is cancelled; failed response body is not read', async t => {
  let cancelled = false;
  let response;
  mockFetch(t, async () => response);
  response = new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(33000)); },
    cancel() { cancelled = true; },
  }));
  await assert.rejects(fetchPayment(env, captured.id), code('gateway_invalid_response'));
  assert.equal(cancelled, true);
  cancelled = false;
  response = new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status: 500 });
  await assert.rejects(fetchPayment(env, captured.id), code('gateway_error'));
  assert.equal(cancelled, true);
});

test('checkout HMAC validates IDs, hex and both binding values without enabling checkout', async () => {
  const signature = await sign(env.RAZORPAY_KEY_SECRET, encoder.encode(`${quote.orderId}|${captured.id}`));
  const data = { orderId: quote.orderId, paymentId: captured.id, signature };
  const disabled = { ...env, CHECKOUT_ENABLED: 'false' };
  assert.equal(await verifyCheckoutSignature(disabled, data), true);
  assert.equal(await verifyCheckoutSignature(env, { ...data, signature: signature.toUpperCase() }), true);
  for (const patch of [{ orderId: 'order_other' }, { paymentId: 'pay_other' }, { orderId: '../invalid' },
    { signature: 'x'.repeat(64) }, { signature: signature.slice(1) }, { signature: '' },
    { signature: (signature[0] === '0' ? '1' : '0') + signature.slice(1) },
    { signature: signature.slice(0, 63) + (signature[63] === '0' ? '1' : '0') }]) {
    assert.equal(await verifyCheckoutSignature(env, { ...data, ...patch }), false);
  }
  assert.equal(await verifyCheckoutSignature({}, data), false);
});

test('webhook HMAC binds exact raw bytes including whitespace, Unicode and view offsets', async () => {
  const raw = encoder.encode('{ "event": "payment.captured", "note": "नमस्ते" }\n');
  const signature = await sign(env.RAZORPAY_WEBHOOK_SECRET, raw);
  assert.equal(await verifyWebhookSignature(env, raw, signature), true);
  assert.equal(await verifyWebhookSignature(env, raw.buffer, signature), true);
  const padded = new Uint8Array(raw.length + 4);
  padded.set(raw, 2);
  assert.equal(await verifyWebhookSignature(env, padded.subarray(2, -2), signature), true);
  assert.equal(await verifyWebhookSignature(env, new DataView(padded.buffer, 2, raw.length), signature), true);
  const normalized = encoder.encode(JSON.stringify(JSON.parse(new TextDecoder().decode(raw))));
  assert.equal(await verifyWebhookSignature(env, normalized, signature), false);
  const altered = raw.slice(); altered[5] ^= 1;
  assert.equal(await verifyWebhookSignature(env, altered, signature), false);
  assert.equal(await verifyWebhookSignature(env, new TextDecoder().decode(raw), signature), false);
  assert.equal(await verifyWebhookSignature({}, raw, signature), false);
  assert.equal(await verifyWebhookSignature(env, raw, 'g'.repeat(64)), false);
});

test('capture validator strictly binds order, amount, INR, status and captured boolean', () => {
  assert.equal(validateCapturedPayment(captured, quote), captured);
  for (const patch of [{ id: 'bad' }, { order_id: 'order_another' }, { amount: 1 },
    { amount: String(quote.amount) }, { currency: 'USD' }, { status: 'authorized' },
    { status: 'refunded' }, { captured: false }, { captured: undefined }, { captured: 'true' },
    { amount_refunded: 1 }]) {
    assert.throws(() => validateCapturedPayment({ ...captured, ...patch }, quote), code('payment_mismatch'));
  }
  for (const value of [undefined, null, {}]) {
    assert.throws(() => validateCapturedPayment(value, quote), code('payment_mismatch'));
  }
  assert.throws(() => validateCapturedPayment(captured, { ...quote, amount: 0 }), code('invalid_amount'));
  assert.throws(() => validateCapturedPayment(captured, { ...quote, currency: 'USD' }), code('unsupported_currency'));
  assert.throws(() => validateCapturedPayment(captured, { ...quote, orderId: '../bad' }), code('invalid_order'));
});
