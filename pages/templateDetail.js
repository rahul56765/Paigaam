'use strict';
const { page, esc } = require('../lib/layout');
const { renderPaigaamPage } = require('../lib/renderPaigaam');

/** Sample data so the preview always looks alive. */
function sampleData(tpl) {
  const d = {};
  for (const f of tpl.config.fields || []) {
    if (f.type === 'image') continue;
    if (f.id === 'brideName') d[f.id] = 'Ayesha';
    else if (f.id === 'groomName') d[f.id] = 'Imran';
    else if (f.id === 'personName') d[f.id] = 'Meher';
    else if (f.id === 'partnerOne') d[f.id] = 'Aashi';
    else if (f.id === 'partnerTwo') d[f.id] = 'Raghav';
    else if (f.type === 'date') d[f.id] = '2026-12-12';
    else if (f.type === 'time') d[f.id] = '19:00';
    else if (f.type === 'number') d[f.id] = f.id === 'years' ? '10' : '30';
    else if (f.id === 'venue') d[f.id] = 'The Roseate, New Delhi';
    else if (f.id === 'address') d[f.id] = 'NH-8, Samalka, New Delhi';
    else if (f.type === 'textarea') d[f.id] = 'Some moments arrive quietly and change everything. Ours did. We would be honoured to have you there when we say the words that make it forever.';
    else d[f.id] = f.placeholder || '';
  }
  return d;
}

function templateDetail(tpl) {
  const sample = sampleData(tpl);
  const previewHTML = renderPaigaamPage(
    { slug: tpl.slug, category: tpl.category, config: tpl.config },
    { customer_data: sample, slug: null },
    { isPreview: true }
  );
  const srcdoc = previewHTML.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').length < 200000
    ? previewHTML.replace(/"/g, '&quot;') : '';

  return page(tpl.name, `
<main>
  <div class="wrap">
    <div class="detail">
      <div class="reveal in">
        <div class="phone" role="img" aria-label="Live preview of the ${esc(tpl.name)} Paigaam on a phone">
          <div class="phone__screen">
            <iframe title="Preview of ${esc(tpl.name)}" srcdoc="${srcdoc}" style="width:100%;height:100%;border:0" loading="lazy"></iframe>
          </div>
        </div>
      </div>
      <div class="reveal in">
        <span class="kicker">${esc(tpl.category)}</span>
        <h1 class="section__title" style="letter-spacing:0.14em">${esc(tpl.name.toUpperCase())}</h1>
        <p style="font-family:var(--serif);font-style:italic;font-size:20px;color:var(--ink-soft);margin-top:16px;line-height:1.5">${esc(tpl.description)}</p>
        <div class="detail__price"><small>One Paigaam</small>₹${esc(tpl.price)}</div>
        <div class="detail__actions">
          <a class="btn btn--primary" href="/create/${esc(tpl.slug)}">Personalize this Paigaam</a>
          <a class="btn btn--ghost" href="/templates">Back to templates</a>
        </div>
        <p class="detail__note">You'll see your Paigaam come alive as you fill it in — and receive your own link to share.</p>
      </div>
    </div>
  </div>
</main>`, { current: '/templates' });
}

module.exports = { templateDetail, sampleData };
