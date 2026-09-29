'use strict';
/**
 * PaigaamPay — inline Razorpay checkout, shared by every seller surface.
 *
 * window.PaigaamPay.open({ prefillName }) → Promise<{ url }>
 *   1. POST /api/razorpay/order { id: <paigaamId from the button/URL> }
 *   2. lazy-loads checkout.js once, opens the Razorpay modal
 *   3. verifies the signature server-side (which settles + publishes)
 *   4. resolves with the live paigaam URL — the CALLER paints the share UI.
 *
 * The paigaam id is read from [data-paigaam-id] (button) or
 * data-paigaam-id on <body>. The buyer never leaves the page and the
 * paigaam never auto-opens — showing the link/QR is the page's job.
 */
(function () {
  var SDK = 'https://checkout.razorpay.com/v1/checkout.js';
  var sdkLoading = null;

  function loadSdk() {
    if (window.Razorpay) return Promise.resolve();
    if (sdkLoading) return sdkLoading;
    sdkLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = SDK; s.async = true;
      s.onload = resolve;
      s.onerror = function () { sdkLoading = null; reject(new Error('sdk')); };
      document.head.appendChild(s);
    });
    return sdkLoading;
  }

  function paigaamId() {
    var btn = document.querySelector('[data-paigaam-id]');
    return (btn && btn.getAttribute('data-paigaam-id')) || (document.body && document.body.getAttribute('data-paigaam-id')) || '';
  }

  function open(opts) {
    opts = opts || {};
    // Two entry paths:
    //  a) caller already has an order payload (from the template's publish
    //     endpoint) → pass it as opts.order
    //  b) fetch one ourselves for the given paigaam id
    function start(order) {
      if (order.alreadyPaid) return Promise.resolve({ url: order.url, alreadyPaid: true });
      return loadSdk().then(function () {
        return new Promise(function (resolve, reject) {
          var rzp = new window.Razorpay({
            key: order.keyId,
            order_id: order.orderId,
            name: order.name || 'Paigaam',
            description: order.description || 'Your Paigaam',
            theme: { color: '#8F1018' },
            prefill: { name: opts.prefillName || order.prefillName || '' },
            handler: function (resp) {
              fetch('/api/razorpay/verify', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(resp)
              }).then(function (r) { return r.json(); }).then(function (res) {
                if (res && res.url) return resolve({ url: res.url });
                reject({ code: 'verify_failed' });
              }).catch(function () { reject({ code: 'network' }); });
            },
            modal: { ondismiss: function () { reject({ code: 'dismissed' }); } }
          });
          rzp.open();
        });
      });
    }
    if (opts.order) return start(opts.order);
    var id = opts.id || paigaamId();
    if (!id) return Promise.reject({ code: 'not_found' });
    return fetch('/api/razorpay/order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ id: id, prefillName: opts.prefillName || '' })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) {
        if (!r.ok) { throw { code: (b && b.error) || 'request_failed', status: r.status }; }
        return b;
      });
    }).then(start);
  }

  window.PaigaamPay = { open: open, paigaamId: paigaamId };
})();
