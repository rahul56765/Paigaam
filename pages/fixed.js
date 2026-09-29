'use strict';
const { page, esc } = require('../lib/layout');

/**
 * Purchase page for a fully-fixed (uneditable) custom template.
 * No personalization form — just who it's from + where to reach them,
 * then straight to WhatsApp. The published Paigaam renders the fixed app.
 */
function fixedPage(tpl) {
  const appPath = (tpl.config && tpl.config.appPath) || tpl.appPath || '';
  return page(`Get ${tpl.name}`, `
<main>
  <div class="wrap">
    <div class="create">
      <div>
        <span class="kicker">Make it yours</span>
        <h1 style="font-size:clamp(34px,5vw,48px);margin-bottom:8px;letter-spacing:0.12em">${esc(tpl.name.toUpperCase())}</h1>
        <p style="color:var(--ink-soft);font-family:var(--serif);font-style:italic;font-size:18px;margin-bottom:14px">A fixed experience, exactly as designed — nothing to edit.</p>
        <p style="color:var(--ink-soft);font-size:16px;margin-bottom:46px;max-width:480px">Tell us who it's from and where to reach you, then pay securely — your personal link arrives instantly.</p>

        <form id="fixedForm" data-template="${esc(tpl.slug)}">
          <div class="field"><label for="senderName">Your name <span class="req" aria-hidden="true">*</span></label>
            <input class="input" id="senderName" name="senderName" type="text" required placeholder="Aarav"></div>
          <div class="field"><label for="recipientName">It's for <span style="font-size:13px;color:var(--taupe)">(optional)</span></label>
            <input class="input" id="recipientName" name="recipientName" type="text" placeholder="Someone you owe an apology"></div>
          <div class="field"><label for="whatsapp">Your WhatsApp number <span class="req" aria-hidden="true">*</span></label>
            <input class="input" id="whatsapp" name="whatsapp" type="tel" inputmode="tel" required placeholder="98765 43210">
            <p class="hint">So we can send your live Paigaam link.</p></div>
          <div class="create__nav" style="margin-top:44px">
            <a class="btn btn--ghost" href="/templates/${esc(tpl.slug)}">Back</a>
            <button type="submit" class="btn btn--primary" id="fixedGo">Pay &amp; get my link</button>
          </div>
          <p id="formError" class="form-error" hidden>Please add your name and WhatsApp number.</p>
          <div id="fixedDone" hidden style="margin-top:34px;text-align:center">
            <p style="font-family:var(--serif);font-style:italic;font-size:22px;margin-bottom:16px">Payment received — it's live. Share it.</p>
            <div id="fixedQR" style="display:flex;justify-content:center;margin-bottom:14px"></div>
            <input id="fixedUrl" readonly style="width:100%;max-width:420px;margin:0 auto 14px;display:block;text-align:center">
            <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
              <button type="button" class="btn btn--primary btn--small" id="fixedCopy">Copy link</button>
              <a class="btn btn--small" id="fixedWa" href="#" target="_blank" rel="noopener">Send on WhatsApp</a>
            </div>
          </div>
        </form>
      </div>

      <div class="create__preview">
        <span class="kicker kicker--muted" style="text-align:center;display:block;margin-bottom:20px">The experience, as they'll see it</span>
        <div class="phone">
          <div class="phone__screen">
            <iframe title="Preview of ${esc(tpl.name)}" src="${esc(appPath)}" style="width:100%;height:100%;border:0" loading="lazy" allow="autoplay"></iframe>
          </div>
        </div>
      </div>
    </div>
  </div>
</main>
<script src="/js/paigaam-pay.js?v=1" defer></script>
<script>
(function () {
  var form = document.getElementById('fixedForm');
  var err = document.getElementById('formError');
  var result = document.getElementById('fixedDone');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = form.senderName.value.trim();
    var wa = form.whatsapp.value.trim();
    if (!name || !wa) { err.hidden = false; return; }
    err.hidden = true;
    var btn = document.getElementById('fixedGo');
    btn.disabled = true; btn.textContent = 'Opening checkout…';
    fetch('/api/drafts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template: form.dataset.template,
        customer_name: name,
        whatsapp: wa,
        customer_data: { senderName: name, recipientName: form.recipientName.value.trim(), whatsapp: wa }
      })
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (!res || !res.id) throw new Error('no id');
      // Inline checkout — the modal opens right here; no separate page.
      return fetch('/api/razorpay/order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ id: res.id })
      }).then(function (r2) { return r2.json().catch(function () { return {}; }).then(function (b2) {
        if (!r2.ok) throw { code: (b2 && b2.error) || 'request_failed' };
        return window.PaigaamPay.open({ order: b2 });
      }); });
    }).then(function (pay) {
      // Paid + published: show the link and QR — never auto-open the paigaam.
      if (result) result.hidden = false;
      var input = document.getElementById('fixedUrl');
      var short = pay.url.replace(/^https?:\\/\\//, '');
      if (input) input.value = pay.url;
      var qr = document.getElementById('fixedQR');
      if (qr) fetch('/api/qr?url=' + encodeURIComponent(pay.url)).then(function (r) { return r.text(); }).then(function (svg) { qr.innerHTML = svg; });
      var copy = document.getElementById('fixedCopy');
      if (copy) copy.addEventListener('click', function () {
        if (navigator.clipboard) navigator.clipboard.writeText(pay.url).then(function () {
          copy.textContent = 'Copied'; setTimeout(function () { copy.textContent = 'Copy link'; }, 1500);
        });
      });
      var wa = document.getElementById('fixedWa');
      if (wa) wa.href = 'https://wa.me/?text=' + encodeURIComponent('I made you something. ' + pay.url);
      if (result) result.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }).catch(function (e2) {
      btn.disabled = false; btn.textContent = 'Pay & get my link';
      if (e2 && e2.code === 'dismissed') return;
      alert((e2 && e2.code === 'payments_offline') ? 'Payments are being switched on — check back shortly.' : "Checkout didn't open. Please try again in a moment.");
    });
  });
})();
</script>`);
}

module.exports = { fixedPage };
