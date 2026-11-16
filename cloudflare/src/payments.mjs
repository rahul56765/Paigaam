/** Cloudflare Workers payment primitives; Fetch + WebCrypto only.
 * Amounts are integer paise. No credentials or upstream error bodies escape.
 * checkoutMode is fail-closed: exact string flags, configured recognized keys.
 * Test keys need CHECKOUT_ENABLED='true'; live keys additionally require
 * ALLOW_LIVE_PAYMENTS='true'. Both gateway operations enforce this gate.
 * Signature verification deliberately remains available while checkout is off,
 * so existing payments/webhooks can still be reconciled safely.
 */
const API = 'https://api.razorpay.com/v1';
const MAX_RESPONSE_BYTES = 65536;
const encoder = new TextEncoder();
const ORDER_ID = /^order_[A-Za-z0-9]{1,120}$/;
const PAYMENT_ID = /^pay_[A-Za-z0-9]{1,120}$/;
const KEY_ID = /^rzp_(test|live)_[A-Za-z0-9]{1,120}$/;
const HEX_SIGNATURE = /^[a-fA-F0-9]{64}$/;

function failure(code, status = 400) {
  return Object.assign(new Error(code), { code, status });
}
function secretPresent(value) {
  return typeof value === 'string' && value.length > 0 && value.trim().length > 0;
}
function validId(value, pattern) {
  return typeof value === 'string' && pattern.test(value);
}
function validateQuote(amount, currency) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw failure('invalid_amount');
  if (currency !== 'INR') throw failure('unsupported_currency');
}

/** @returns {{enabled:boolean,mode:'disabled'|'test'|'live'}} */
export function checkoutMode(env = {}) {
  const key = typeof env.RAZORPAY_KEY_ID === 'string' && KEY_ID.exec(env.RAZORPAY_KEY_ID);
  if (env.CHECKOUT_ENABLED !== 'true' || !key || !secretPresent(env.RAZORPAY_KEY_SECRET)) {
    return { enabled: false, mode: 'disabled' };
  }
  if (key[1] === 'live' && env.ALLOW_LIVE_PAYMENTS !== 'true') {
    return { enabled: false, mode: 'disabled' };
  }
  return { enabled: true, mode: key[1] };
}

// Read incrementally: neither successful nor failed gateway bodies can allocate
// unbounded memory. Never trust Content-Length, nor reflect gateway descriptions.
async function readJSON(response) {
  if (!response.body) throw failure('gateway_invalid_response', 502);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        throw failure('gateway_invalid_response', 502);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw failure('gateway_invalid_response', 502); }
}

async function apiCall(env, method, path, body) {
  if (!checkoutMode(env).enabled) throw failure('razorpay_disabled', 503);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    // Encode UTF-8 before btoa, which otherwise only accepts Latin-1.
    const credentials = encoder.encode(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
    const authorization = `Basic ${btoa(String.fromCharCode(...credentials))}`;
    const response = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
      redirect: 'error', // Never forward Basic auth through a gateway redirect.
    });
    if (!response.ok) {
      if (response.body) await response.body.cancel().catch(() => {});
      throw failure('gateway_error', 502);
    }
    return await readJSON(response);
  } catch (error) {
    // Whitelist only our own stable codes, not arbitrary fetch exception text.
    if (error?.code === 'gateway_error' || error?.code === 'gateway_invalid_response') {
      throw failure(error.code, 502);
    }
    throw failure(controller.signal.aborted ? 'gateway_timeout' : 'gateway_unreachable', 502);
  } finally { clearTimeout(timer); }
}

/** Create a server-side order. Returns the validated gateway order or throws. */
export async function razorpayCreateOrder(env, { amount, currency = 'INR', receipt = '', notes = {} } = {}) {
  validateQuote(amount, currency);
  if (typeof receipt !== 'string' || receipt.length > 40) throw failure('invalid_receipt');
  if (!notes || typeof notes !== 'object' || Array.isArray(notes) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(notes))) throw failure('invalid_notes');
  const entries = Object.entries(notes);
  if (entries.length > 15 || entries.some(([key, value]) =>
    key.length === 0 || key.length > 256 || typeof value !== 'string' || value.length > 256)) {
    throw failure('invalid_notes');
  }
  const order = await apiCall(env, 'POST', '/orders', { amount, currency, receipt, notes });
  if (!order || !validId(order.id, ORDER_ID) || order.amount !== amount || order.currency !== currency) {
    throw failure('gateway_order_mismatch', 502);
  }
  return order;
}

/** Fetch one payment, binding the gateway result to the requested payment ID. */
export async function fetchPayment(env, id) {
  if (!validId(id, PAYMENT_ID)) throw failure('invalid_payment');
  const payment = await apiCall(env, 'GET', `/payments/${encodeURIComponent(id)}`);
  if (!payment || payment.id !== id) throw failure('payment_mismatch', 502);
  return payment;
}

/** Throws unless a captured payment exactly matches a trusted server-side quote.
 * Returns the same payment. A valid signature alone does NOT prove capture.
 * Require Razorpay's captured boolean as well as status; reject refunded money.
 */
export function validateCapturedPayment(payment, { orderId, amount, currency = 'INR' } = {}) {
  validateQuote(amount, currency);
  if (!validId(orderId, ORDER_ID)) throw failure('invalid_order');
  if (!payment || !validId(payment.id, PAYMENT_ID) || payment.order_id !== orderId ||
      payment.status !== 'captured' || payment.captured !== true ||
      payment.amount !== amount || payment.currency !== currency ||
      (payment.amount_refunded !== undefined && payment.amount_refunded !== 0)) {
    throw failure('payment_mismatch');
  }
  return payment;
}

async function verifyHMAC(secret, bytes, signature) {
  if (!secretPresent(secret) || typeof signature !== 'string' || !HEX_SIGNATURE.test(signature)) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, bytes));
  // All valid signatures are exactly 32 bytes; no data-dependent early exit.
  let difference = 0;
  for (let i = 0; i < 32; i++) difference |= expected[i] ^ parseInt(signature.slice(i * 2, i * 2 + 2), 16);
  return difference === 0;
}

/** HMAC-SHA256(orderId + '|' + paymentId, key secret); Promise<boolean>. */
export async function verifyCheckoutSignature(env, { orderId, paymentId, signature } = {}) {
  if (!validId(orderId, ORDER_ID) || !validId(paymentId, PAYMENT_ID)) return false;
  return verifyHMAC(env?.RAZORPAY_KEY_SECRET, encoder.encode(`${orderId}|${paymentId}`), signature);
}

/** HMAC over ORIGINAL request bytes, never parsed/re-serialized JSON.
 * rawBytes must be ArrayBuffer or ArrayBufferView (e.g. Uint8Array).
 */
export async function verifyWebhookSignature(env, rawBytes, signature) {
  let bytes;
  if (rawBytes instanceof ArrayBuffer) bytes = new Uint8Array(rawBytes);
  else if (ArrayBuffer.isView(rawBytes)) bytes = new Uint8Array(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
  else return false;
  return verifyHMAC(env?.RAZORPAY_WEBHOOK_SECRET, bytes, signature);
}
