'use strict';
const { page, esc } = require('../lib/layout');
const { renderPaigaamPage } = require('../lib/renderPaigaam');
const bfday = require('../lib/bfday/family');

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

/** A family member's own share card (config.ogImage, site-relative) as og:image / twitter:image. */
function shareImage(tpl, baseUrl) {
  const member = bfday.bySlug(tpl.slug);
  const image = member && member.config.ogImage;
  if (typeof image !== 'string' || !image.startsWith('/')) return '';
  let origin = '';
  try { origin = new URL(baseUrl).origin; } catch { return ''; }
  const url = esc(origin + image);
  return `<meta property="og:image" content="${url}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${url}">`;
}

function templateDetail(tpl, { baseUrl = '' } = {}) {
  const isCustom = !!(tpl.config && tpl.config.custom) || !!tpl.custom;
  const appPath = (tpl.config && tpl.config.appPath) || tpl.appPath || '';
  // Every template with a /<slug>/demo route gets the live iframe preview.
  // (Per-template modules mount /<slug>/demo; custom webapps iframe their app.)
  const DEMO_PATHS = {
    'ganapati-aagman': 'ganapati',                    // historic route: /ganapati/demo
    'lavender-tic-tac-toe-bloom': 'lavender-bloom',   // demo route differs from slug
  };
  const demoPath = DEMO_PATHS[tpl.slug] || tpl.slug;
  const hasDemo = !isCustom && (bfday.has(tpl.slug) || [
    'ganapati-aagman', 'saalgirah', 'lavender-tic-tac-toe-bloom', 'ganpati-courtyard',
    'maafi', 'love-awaits', 'sawaal', 'love-album', 'valentine-say-yes', 'sau-wajah',
  ].includes(tpl.slug));
  let previewInner;
  if (hasDemo) {
    previewInner = `<iframe title="${esc(tpl.name)} live preview" src="/${esc(demoPath)}/demo" style="width:100%;height:100%;border:0" loading="lazy" allow="autoplay"></iframe>`;
  } else if (isCustom) {
    const sample = sampleData(tpl);
    const previewHTML = renderPaigaamPage(
      { slug: tpl.slug, category: tpl.category, config: tpl.config },
      { customer_data: sample, slug: null },
      { isPreview: true }
    );
    const srcdoc = previewHTML.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').length < 200000
      ? previewHTML.replace(/"/g, '&quot;') : '';
    previewInner = `<iframe title="Preview of ${esc(tpl.name)}" srcdoc="${srcdoc}" style="width:100%;height:100%;border:0" loading="lazy"></iframe>`;
  }

  const cta = isCustom
    ? `<a class="btn btn--primary" href="/create/${esc(tpl.slug)}">Get this Paigaam</a>`
    : `<a class="btn btn--primary" href="/create/${esc(tpl.slug)}" data-track="template_create_clicked" data-template="${esc(tpl.slug)}">Create this Paigaam &rarr;</a>`;
  const note = isCustom
    ? `A fixed, ready-made experience — exactly as designed. Get yours and share the link.`
    : `You'll see your Paigaam come alive as you fill it in — and receive your own link to share.`;
  const free = Number(tpl.price) === 0;
  const priceHTML = bfday.has(tpl.slug) ? '' : (free
    ? `<div class="detail__price"><small>One Paigaam</small><span style="font-size:26px;letter-spacing:0.18em;color:#3E6B40">FREE</span></div>`
    : `<div class="detail__price"><small>One Paigaam</small>&#8377;${esc(tpl.price)}</div>`);

  return page(tpl.name, `
<main data-topened="${esc(tpl.slug)}">
  <div class="wrap">
    <div class="detail">
      <div class="reveal in">
        <div class="phone" role="img" aria-label="Live preview of the ${esc(tpl.name)} Paigaam on a phone">
          <div class="phone__screen">
            ${previewInner}
          </div>
        </div>
      </div>
      <div class="reveal in">
        <span class="kicker">${esc(tpl.category)}</span>
        <h1 class="section__title" style="letter-spacing:0.14em">${esc(tpl.name.toUpperCase())}</h1>
        <p style="font-family:var(--serif);font-style:italic;font-size:20px;color:var(--ink-soft);margin-top:16px;line-height:1.5">${esc(tpl.description)}</p>
        ${priceHTML}
        <div class="detail__actions">
          ${cta}
          ${hasDemo ? `<a class="btn btn--ghost" href="/${esc(demoPath)}/demo" target="_blank" rel="noopener">Experience full preview</a>` : ''}
          <a class="btn btn--ghost" href="/templates">Back to templates</a>
        </div>
        <p class="detail__note">${note}</p>
      </div>
    </div>
  </div>
</main>
<!-- sticky mobile create bar -->
<div class="sticky-cta" id="stickyCta" aria-hidden="false">
  <div class="sticky-cta__inner">
    <div class="sticky-cta__info">
      <strong>${esc(tpl.name)}</strong>
      <span>${free ? 'FREE' : '&#8377;' + esc(tpl.price) + ' &middot; one-time'}</span>
    </div>
    <a class="btn btn--primary" href="/create/${esc(tpl.slug)}" data-track="template_create_clicked" data-template="${esc(tpl.slug)}" data-label="sticky_bar">Create &rarr;</a>
  </div>
</div>
<script>
/* Mobile sticky create bar: appears when the main CTA scrolls out of view. */
(function () {
  var bar = document.getElementById('stickyCta');
  if (!bar) return;
  if (window.matchMedia && window.matchMedia('(min-width: 721px)').matches) return;
  var anchor = document.querySelector('.detail__actions');
  if (!anchor || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { bar.classList.toggle('show', !e.isIntersecting); });
  }, { threshold: 0 }).observe(anchor);
})();
</script>`, { current: '/templates', canonical: `/templates/${tpl.slug}`, description: `${tpl.name} — a ${String(tpl.category).toLowerCase()} Paigaam. ${tpl.description}`, headExtra: shareImage(tpl, baseUrl) });
}

module.exports = { templateDetail, sampleData };
