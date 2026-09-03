'use strict';
const { page, esc } = require('../lib/layout');
const { renderPaigaamPage, shareTitle } = require('../lib/renderPaigaam');
const { displayNames, displayDate } = require('../templates/registry');

function previewPage(paigaam, settings) {
  const tpl = {
    slug: paigaam.template_slug, category: paigaam.template_category,
    config: paigaam.template_config,
  };
  const d = paigaam.customer_data || {};
  const names = displayNames(paigaam.template_slug, d).join(' & ');
  const html = renderPaigaamPage(tpl, paigaam, { isPreview: true });
  const srcdoc = html.replace(/"/g, '&quot;');

  return page('Your Paigaam is ready', `
<main class="preview-page">
  <div class="wrap-narrow">
    <span class="kicker">Beautifully done</span>
    <h1 class="section__title">Your Paigaam is ready.</h1>
    <p class="section__sub" style="margin-top:14px">This is exactly what they'll see when they open it.</p>

    <div class="phone">
      <div class="phone__screen">
        <iframe title="Your personalized Paigaam" srcdoc="${srcdoc}" style="width:100%;height:100%;border:0"></iframe>
      </div>
    </div>

    <div class="preview-meta">
      <div><span>Template</span><strong>${esc(paigaam.template_name)}</strong></div>
      <div><span>Personalized for</span><strong>${esc(names)}</strong></div>
      ${d.eventDate ? `<div><span>The day</span><strong>${esc(displayDate(d.eventDate))}</strong></div>` : ''}
      <div><span>Price</span><strong>₹${esc(paigaam.template_price)}</strong></div>
    </div>

    <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap">
      <a class="btn btn--whatsapp" href="/go/whatsapp/${esc(paigaam.id)}">Continue on WhatsApp</a>
      <a class="btn btn--ghost" href="/create/${esc(paigaam.template_slug)}?draft=${esc(paigaam.id)}">Edit Paigaam</a>
    </div>
    <p style="margin-top:34px;color:var(--taupe);font-size:14px;font-family:var(--serif);font-style:italic;font-size:16px">
      We'll confirm your Paigaam on WhatsApp and send your personal link once it's live.
    </p>
  </div>
</main>`);
}

module.exports = { previewPage };
