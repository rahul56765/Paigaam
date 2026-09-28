'use strict';
/**
 * Razorpay payments — the paid-template rail (no WhatsApp handoff).
 *
 * Zero-dependency by design, like the rest of Paigaam:
 *  - Orders API is called with node:https (POST /v1/orders, basic auth).
 *  - Checkout uses Razorpay's hosted checkout.js (their CDN, loaded on
 *    /pay/:id — the only third-party script in the whole app).
 *  - Success is trusted only after HMAC-SHA256 verification of
 *    `razorpay_order_id|razorpay_payment_id` against the key secret
 *    (standard checkout handler signature).
 *  - A signed webhook (/api/razorpay/webhook, X-Razorpay-Signature over the
 *    raw body) is the safety net: if the buyer closes the tab before the
 *    verify call lands, the webhook still marks the order paid and publishes
 *    the paigaam.
 *
 * Env: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET (optional
 * but strongly recommended), RAZORPAY_ENABLED=1 to turn the rail on. Without
 * them the module reports disabled and /pay/:id explains the state instead of
 * failing cryptically.
 */
const crypto = require('node:crypto');
const https = require('node:https');
const { page, esc } = require('./layout');

const KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const ENABLED = process.env.RAZORPAY_ENABLED === '1' && KEY_ID && KEY_SECRET;

/* ------------------------------------------------------------- API client */

function apiCall(method, path, body) {
  if (!ENABLED) return Promise.reject(Object.assign(new Error('razorpay_disabled'), { code: 'razorpay_disabled' }));
  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = https.request({
      hostname: 'api.razorpay.com', path, method,
      auth: `${KEY_ID}:${KEY_SECRET}`,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload ? payload.length : 0,
      },
      timeout: 15000,
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; if (data.length > 1e6) req.destroy(); });
      res.on('end', () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : null; } catch { /* non-JSON error body */ }
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(parsed);
        const err = new Error((parsed && parsed.error && parsed.error.description) || `razorpay_http_${res.statusCode}`);
        err.code = (parsed && parsed.error && parsed.error.code) || `http_${res.statusCode}`;
        reject(err);
      });
    });
    req.on('timeout', () => { req.destroy(new Error('razorpay_timeout')); });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** Create a Razorpay order for a paigaam (amount in paise). */
function createOrder(paigaam, settings) {
  return apiCall('POST', '/v1/orders', {
    amount: Number(paigaam.template_price) * 100,
    currency: paigaam.template_currency || settings.currency || 'INR',
    receipt: paigaam.id.slice(0, 40),
    notes: { paigaam_id: paigaam.id, template: paigaam.template_slug },
  });
}

/* --------------------------------------------------------- verification */

const safeEqual = (a, b) => {
  const ab = Buffer.from(String(a || '')), bb = Buffer.from(String(b || ''));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
};

/** Standard checkout-handler signature: HMAC_SHA256(order_id + '|' + payment_id, key_secret). */
function verifyCheckoutSignature(orderId, paymentId, signature) {
  if (!orderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqual(expected, signature);
}

/** Webhook signature: HMAC_SHA256(rawBody, webhook_secret). */
function verifyWebhookSignature(rawBody, signature) {
  if (!WEBHOOK_SECRET || !signature) return false;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}

/* --------------------------------------------------------- recovery link */

function ensureRecoveryToken(pg) {
  if (pg.recovery_token && /^[a-f0-9]{32}$/.test(pg.recovery_token)) return pg.recovery_token;
  const token = crypto.randomBytes(16).toString('hex');
  const { q } = require('../db');
  q.paigaamSetRecoveryToken(pg.id, token);
  return token;
}

/* --------------------------------------------------------- checkout page */

function payPage(pg, { keyId, rzpOrder, baseUrl, alreadyPaid, error } = {}) {
  const isFree = Number(pg.template_price) <= 0;
  const d = pg.customer_data || {};
  const recoveryToken = ensureRecoveryToken(pg);
  const recoverUrl = `${baseUrl}/recover/${recoveryToken}`;

  const body = alreadyPaid ? `
    <span class="kicker">Already taken care of</span>
    <h1 class="section__title">This Paigaam is already paid for.</h1>
    <p class="section__sub">If your live link is missing, recover it below — no payment is due.</p>
    <a class="btn btn--primary" href="/recover/${esc(recoveryToken)}">Recover my Paigaam</a>`
    : isFree || !ENABLED || !rzpOrder ? `
    <span class="kicker">Checkout</span>
    <h1 class="section__title">Checkout is not open for this Paigaam yet.</h1>
    <p class="section__sub">Payments are being switched on. Please check back shortly${error ? ' — ' + esc(error) : ''}.</p>
    <a class="btn btn--ghost" href="/preview/${esc(pg.id)}">Back to my Paigaam</a>`
    : `
    <span class="kicker">Secure checkout</span>
    <h1 class="section__title">Pay & publish your Paigaam.</h1>
    <p class="section__sub">The moment payment succeeds, your Paigaam goes live and you get the link — no waiting, no WhatsApp.</p>

    <div class="preview-meta" style="margin:26px auto;max-width:440px;text-align:left">
      <div><span>Template</span><strong>${esc(pg.template_name)}</strong></div>
      <div><span>Personalized for</span><strong>${esc(pg.customer_name || '—')}</strong></div>
      <div><span>Amount</span><strong>&#8377;${esc(pg.template_price)}</strong></div>
      <div><span>Order</span><strong style="font-family:ui-monospace,monospace;font-size:13px">#${esc(rzpOrder.id.slice(0, 14))}</strong></div>
    </div>

    <button class="btn btn--primary" id="payNow">Pay &#8377;${esc(pg.template_price)} securely</button>
    <p style="margin-top:14px;font-size:13px;color:var(--taupe)">Payments powered by Razorpay · UPI, cards, netbanking</p>
    <p class="hint" style="margin-top:26px">Bookmark this page, or keep the recovery link — it always brings you back to this Paigaam:<br>
      <a href="/recover/${esc(recoveryToken)}" style="word-break:break-all">${esc(recoverUrl)}</a></p>

    <script src="https://checkout.razorpay.com/v1/checkout.js" defer></script>
    <script>
    (function () {
      var btn = document.getElementById('payNow');
      if (window.paTrack) window.paTrack('purchase_started', { template: '${esc(pg.template_slug)}', via: 'razorpay' });
      btn.addEventListener('click', function () {
        btn.disabled = true; btn.textContent = 'Opening checkout…';
        var rzp = new Razorpay({
          key: '${esc(keyId)}',
          order_id: '${esc(rzpOrder.id)}',
          name: 'Paigaam',
          description: '${esc(pg.template_name)}',
          theme: { color: '#8F1018' },
          prefill: { name: '${esc(pg.customer_name || '')}' },
          handler: function (resp) {
            btn.textContent = 'Verifying…';
            fetch('/api/razorpay/verify', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(resp)
            }).then(function (r) { return r.json(); }).then(function (res) {
              if (res && res.url) { window.location.href = res.url; return; }
              btn.disabled = false; btn.textContent = 'Pay again';
              alert('Payment received but verification failed — your Paigaam is safe. Use the recovery link on this page in a minute.');
            }).catch(function () {
              btn.disabled = false; btn.textContent = 'Pay again';
              alert('Network hiccup after payment — do not pay again. Use the recovery link on this page; your Paigaam publishes automatically.');
            });
          },
          modal: { ondismiss: function () { btn.disabled = false; btn.textContent = 'Pay ₹${esc(pg.template_price)} securely'; } }
        });
        rzp.open();
      });
    })();
    </script>`;

  return page('Checkout', `
<main class="preview-page">
  <div class="wrap-narrow" style="text-align:center">
    ${body}
  </div>
</main>`);
}

/* --------------------------------------------------------- success page */

function paidPage(pg, { baseUrl } = {}) {
  const url = pg.slug ? `${baseUrl}/p/${pg.slug}` : '';
  const recoveryToken = pg.recovery_token || ensureRecoveryToken(pg);
  return page('Your Paigaam is live', `
<main class="preview-page">
  <div class="wrap-narrow" style="text-align:center">
    <span class="kicker">Payment received</span>
    <h1 class="section__title">Your Paigaam is live.</h1>
    <p class="section__sub">Thank you — payment confirmed. This link is yours forever.</p>
    <div class="preview-meta" style="margin:26px auto;max-width:440px">
      <div><span>Template</span><strong>${esc(pg.template_name)}</strong></div>
      <div><span>Personalized for</span><strong>${esc(pg.customer_name || '—')}</strong></div>
      <div><span>Payment</span><strong style="color:#3E6B40">Confirmed ✓</strong></div>
    </div>
    <div class="qr-card" style="margin:0 auto 22px">
      <div id="paidQR" style="display:flex;justify-content:center"></div>
      <p class="qr-url" style="word-break:break-all">${esc(url.replace(/^https?:\/\//, ''))}</p>
    </div>
    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
      <a class="btn btn--primary" href="${esc(url)}">Open my Paigaam</a>
      <button class="btn" id="paidCopy">Copy link</button>
      <a class="btn btn--ghost" href="https://wa.me/?text=${encodeURIComponent('Our Paigaam: ' + url)}" target="_blank" rel="noopener">Send on WhatsApp</a>
    </div>
    <p class="hint" style="margin-top:30px">Lost this page? Save the recovery link — it always works:<br>
      <a href="/recover/${esc(recoveryToken)}" style="word-break:break-all">${esc(baseUrl)}/recover/${esc(recoveryToken)}</a></p>
    <script src="/js/qr-card.js" defer></script>
    <script>
    (function () {
      var url = '${esc(url)}';
      fetch('/api/qr?url=' + encodeURIComponent(url)).then(function (r) { return r.text(); }).then(function (svg) {
        document.getElementById('paidQR').innerHTML = svg;
      });
      document.getElementById('paidCopy').addEventListener('click', function () {
        var b = this;
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () {
          b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy link'; }, 1500);
        });
      });
    })();
    </script>
  </div>
</main>`);
}

/* --------------------------------------------------------- recover page */

function recoverPage(pg, { baseUrl, deleted } = {}) {
  if (deleted) {
    return page('Paigaam not found', `
<main class="preview-page"><div class="wrap-narrow" style="text-align:center">
  <span class="kicker">Recovery</span>
  <h1 class="section__title">This Paigaam is no longer available.</h1>
  <p class="section__sub">It may have been removed by the sender. Contact us and we'll sort it out.</p>
  <a class="btn btn--ghost" href="/contact">Contact Paigaam</a>
</div></main>`);
  }
  const url = pg.slug ? `${baseUrl}/p/${pg.slug}` : '';
  const isPaid = pg.payment_status === 'paid';
  return page('Recover your Paigaam', `
<main class="preview-page">
  <div class="wrap-narrow" style="text-align:center">
    <span class="kicker">Welcome back</span>
    <h1 class="section__title">Here's your Paigaam.</h1>
    <div class="preview-meta" style="margin:26px auto;max-width:440px">
      <div><span>Template</span><strong>${esc(pg.template_name)}</strong></div>
      <div><span>Personalized for</span><strong>${esc(pg.customer_name || '—')}</strong></div>
      <div><span>Status</span><strong>${pg.status === 'published' ? 'Live ✓' : (isPaid ? 'Paid — publishing…' : 'Draft / awaiting payment')}</strong></div>
    </div>
    ${pg.status === 'published' && url ? `
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <a class="btn btn--primary" href="${esc(url)}">Open my Paigaam</a>
        <button class="btn" id="recCopy">Copy link</button>
      </div>
      <p class="hint" style="margin-top:26px">Keep this recovery link safe — it's how you get back without an account.<br>
        <a href="/recover/${esc(pg.recovery_token)}" style="word-break:break-all">${esc(baseUrl)}/recover/${esc(pg.recovery_token)}</a></p>
      <script>
      document.getElementById('recCopy').addEventListener('click', function () {
        var b = this;
        if (navigator.clipboard) navigator.clipboard.writeText('${esc(url)}').then(function () {
          b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy link'; }, 1500);
        });
      });
      </script>`
    : isPaid ? `
      <p class="section__sub">Payment confirmed — finishing up. Refresh in a moment.</p>
      <meta http-equiv="refresh" content="3">`
    : pg.template_price > 0 ? `
      <p class="section__sub">This one is awaiting payment.</p>
      <a class="btn btn--primary" href="/pay/${esc(pg.id)}">Continue to checkout</a>`
    : `
      <p class="section__sub">This Paigaam isn't published yet.</p>
      <a class="btn btn--primary" href="/preview/${esc(pg.id)}">Continue where you left off</a>`}
  </div>
</main>`);
}

/* --------------------------------------------------------- webhook */

/** Handle a verified webhook payload. Returns the order id handled, or null. */
function handleWebhookEvent(event) {
  const { q } = require('../db');
  const type = event && event.event;
  if (type !== 'payment.captured' && type !== 'order.paid') return null;
  const entity = (event.payload && event.payload.payment && event.payload.payment.entity) || {};
  const rzpOrderId = entity.order_id || (type === 'order.paid' && event.payload.order && event.payload.order.entity && event.payload.order.entity.id);
  if (!rzpOrderId) return null;
  return rzpOrderId;
}

module.exports = {
  ENABLED, KEY_ID,
  createOrder, verifyCheckoutSignature, verifyWebhookSignature,
  ensureRecoveryToken, handleWebhookEvent,
  payPage, paidPage, recoverPage,
};
