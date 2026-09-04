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
        <p style="color:var(--ink-soft);font-size:16px;margin-bottom:46px;max-width:480px">Tell us who it's from and where to reach you, and we'll prepare your personal link and send it on WhatsApp once it's live.</p>

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
            <button type="submit" class="btn btn--whatsapp" id="fixedGo">Continue on WhatsApp</button>
          </div>
          <p id="formError" class="form-error" hidden>Please add your name and WhatsApp number.</p>
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
<script>
(function () {
  var form = document.getElementById('fixedForm');
  var err = document.getElementById('formError');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = form.senderName.value.trim();
    var wa = form.whatsapp.value.trim();
    if (!name || !wa) { err.hidden = false; return; }
    err.hidden = true;
    var btn = document.getElementById('fixedGo');
    btn.disabled = true; btn.textContent = 'Preparing…';
    fetch('/api/drafts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template: form.dataset.template,
        customer_name: name,
        whatsapp: wa,
        customer_data: { senderName: name, recipientName: form.recipientName.value.trim(), whatsapp: wa }
      })
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (res && res.id) window.location.href = '/go/whatsapp/' + res.id;
      else { btn.disabled = false; btn.textContent = 'Continue on WhatsApp'; alert('Something went quiet. Please try again.'); }
    }).catch(function () { btn.disabled = false; btn.textContent = 'Continue on WhatsApp'; });
  });
})();
</script>`);
}

module.exports = { fixedPage };
