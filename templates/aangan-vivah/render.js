'use strict';

const config = require('./config');
const schema = require('./schema');
const { resolve } = require('../../lib/bfday/fields');
const { escape, head, previewBadge } = require('../../lib/bfday/page');

const EVENT_ART = Object.freeze({
  haldi: { title: 'Haldi Ceremony', image: 'haldi.webp', alt: 'Purple wisteria and marigold garlands above a sunflower-yellow sofa' },
  sangeet: { title: 'Sangeet Night', image: 'sangeet.webp', alt: 'Chandeliers and disco balls above a black-and-white checkerboard floor' },
  wedding: { title: 'Wedding Ceremony', image: 'wedding.webp', alt: 'A floral arch around a pink-draped wedding mandap' },
  reception: { title: 'Wedding Reception', image: 'reception.webp', alt: 'Pink curtains behind a champagne tower on a small table' },
});

function dateLabel(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!m) return escape(value || '');
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return escape(value);
  return escape(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }));
}
function textLines(value) { return escape(value || '').replace(/\n/g, '<br>'); }
function initial(value, name, fallback) {
  const raw = String(value || '').trim() || String(name || '').trim().slice(0, 1) || fallback;
  return escape(raw.toLocaleUpperCase('en-IN'));
}
function pageStart(index, type, label) {
  const inactive = index ? ' aria-hidden="true" inert' : ' aria-hidden="false"';
  return `<section class="aw-page aw-page--${escape(type)} ${index ? 'is-future' : 'is-current'}" data-aw-page data-aw-index="${index}" data-kind="${escape(type)}" aria-label="${escape(label)}"${inactive}>`;
}
function art(image, alt, loading = 'lazy', extra = '') {
  return `<img class="aw-art ${extra}" src="/aangan-vivah/${escape(image)}" alt="${escape(alt)}" loading="${loading}" decoding="async">`;
}
function eventTiming(event) {
  if (event.kind === 'wedding') {
    const lines = [];
    if (event.baraatTime) lines.push(`<span><small>Baraat</small>${escape(event.baraatTime)}</span>`);
    if (event.pheraTime) lines.push(`<span><small>Pheras</small>${escape(event.pheraTime)}</span>`);
    if (!lines.length && event.time) lines.push(`<span>${escape(event.time)}</span>`);
    return lines.length ? `<div class="aw-event__times aw-reveal" style="--aw-order:3">${lines.join('')}</div>` : '';
  }
  return event.time ? `<p class="aw-event__time aw-reveal" style="--aw-order:3">${escape(event.time)}</p>` : '';
}
function eventPage(event, index) {
  const visual = EVENT_ART[event.kind] || EVENT_ART.wedding;
  const title = event.pageTitle || visual.title;
  const date = dateLabel(event.date);
  const times = eventTiming(event);
  return `${pageStart(index, event.kind, title)}
    ${art(visual.image, visual.alt)}
    <div class="aw-event__copy aw-copy">
      <p class="aw-event__eyebrow aw-reveal" style="--aw-order:0">${escape(title)}</p>
      ${event.themeLine ? `<h2 class="aw-event__theme aw-reveal" style="--aw-order:1">${textLines(event.themeLine)}</h2>` : ''}
      <p class="aw-event__date aw-reveal" style="--aw-order:2">${date}</p>
      ${times}
      <p class="aw-event__venue aw-reveal" style="--aw-order:4">${escape(event.venue)}</p>
      ${event.dressCode ? `<p class="aw-event__dress aw-reveal" style="--aw-order:5"><span>Dress code</span>${escape(event.dressCode)}</p>` : ''}
    </div>
  </section>`;
}

function render(paigaam = {}, opts = {}) {
  const d = resolve(config, paigaam && paigaam.customer_data, schema);
  const couple = `${d.brideName} & ${d.groomName}`;
  const title = opts.title || `${couple} · Aangan Vivah`;
  const date = dateLabel(d.weddingDate);
  const description = `${couple} invite you to celebrate their wedding on ${date} at ${d.mainVenue}.`;
  const logoZoom = Math.min(2.2, Math.max(1, (Number(d.monogramZoom) || 100) / 100));
  const logoX = Math.min(80, Math.max(20, Number(d.monogramPositionX) || 50));
  const logoY = Math.min(80, Math.max(20, Number(d.monogramPositionY) || 50));
  const monogramMark = d.monogramLogo
    ? `<div class="aw-monogram__logo-frame aw-reveal" style="--aw-order:0"><img class="aw-monogram__logo" src="${escape(d.monogramLogo)}" alt="Couple logo or monogram" style="--aw-logo-zoom:${logoZoom};--aw-logo-x:${logoX}%;--aw-logo-y:${logoY}%"></div>`
    : `<p class="aw-monogram__initials aw-reveal" style="--aw-order:0"><span>${initial(d.brideInitial, d.brideName, 'A')}</span><i>&amp;</i><span>${initial(d.groomInitial, d.groomName, 'R')}</span></p>`;
  const events = (d.events || []).filter(event => EVENT_ART[event.kind]);
  const pages = [];

  pages.push(`${pageStart(0, 'door', 'A carved golden wedding door')}
    ${art('door.webp', 'Carved golden wooden double doors framed by pink blossoms and greenery', 'eager', 'aw-art--door')}
    <div class="aw-door-glow" aria-hidden="true"></div>
    <img class="aw-door-leaf aw-door-leaf--left" src="/aangan-vivah/door-left.webp" alt="" aria-hidden="true" decoding="async">
    <img class="aw-door-leaf aw-door-leaf--right" src="/aangan-vivah/door-right.webp" alt="" aria-hidden="true" decoding="async">
    <button class="aw-door-open" type="button" data-aw-open aria-label="Tap to open the wedding invitation">Tap to open</button>
  </section>`);

  pages.push(`${pageStart(1, 'monogram', 'Couple monogram, date and venue')}
    ${art('monogram.webp', 'A flower-ringed monogram with two peacocks and a golden courtyard')}
    <div class="aw-monogram aw-copy">
      ${monogramMark}
      <p class="aw-monogram__date aw-reveal" style="--aw-order:1">${date}</p>
      <p class="aw-monogram__venue aw-reveal" style="--aw-order:2">${escape(d.mainVenue)}</p>
    </div>
  </section>`);

  pages.push(`${pageStart(2, 'invitation', 'Wedding invitation and family names')}
    ${art('invitation.webp', 'Pale courtyard invitation with the Ganesh symbol above the text')}
    <div class="aw-invitation aw-copy">
      <p class="aw-invitation__line aw-reveal" style="--aw-order:0">${escape(d.invitationLine)}</p>
      <p class="aw-invitation__request aw-reveal" style="--aw-order:1">${textLines(d.invitationRequest)}</p>
      <h2 class="aw-invitation__names aw-reveal" style="--aw-order:2">${escape(d.brideName)} <span>&amp;</span> ${escape(d.groomName)}</h2>
      <div class="aw-invitation__families aw-reveal" style="--aw-order:3">
        <p><span>Bride</span>${escape(d.brideParents)}</p>
        <p><span>Groom</span>${escape(d.groomParents)}</p>
      </div>
      <p class="aw-invitation__details aw-reveal" style="--aw-order:4">${date}<br>${escape(d.mainVenue)}</p>
    </div>
  </section>`);

  events.forEach((event, i) => pages.push(eventPage(event, i + 3)));

  const closeIndex = pages.length;
  pages.push(`${pageStart(closeIndex, 'closing', 'Thank-you message from the family')}
    ${art('closing.webp', 'Two white peacocks on a lawn beside a white fence and flower beds')}
    <div class="aw-closing aw-copy">
      <p class="aw-closing__line aw-reveal" style="--aw-order:0">${textLines(d.closingLine)}</p>
      <p class="aw-closing__family aw-reveal" style="--aw-order:1">${escape(d.familyName)}</p>
    </div>
  </section>`);

  const pageMarkup = pages.join('\n');
  const dotMarkup = pages.map((_, i) => `<button type="button" class="aw-dot${i === 0 ? ' is-current' : ''}" data-aw-dot="${i}" aria-label="Go to page ${i + 1}"${i === 0 ? ' aria-current="page"' : ''}></button>`).join('');

  return `<!doctype html>
<html lang="en" class="aw-html">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${head({ paigaam, opts, title, description, themeColor: '#edf1f2', image: config.ogImage })}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Great+Vibes&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/aangan-vivah/aangan.css?v=1">
<script src="/aangan-vivah/aangan.js?v=1" defer></script>
</head>
<body class="aw-body" data-preview="${!!opts.isPreview}">
${previewBadge(opts)}
<main class="aw-app" id="awApp" data-kind="door" aria-label="${escape(couple)} wedding invitation">
  <div class="aw-stage" id="awStage" data-aw-stage>
    ${pageMarkup}
    <div class="aw-golden-overlay" aria-hidden="true">
      <div class="aw-golden-rays"></div>
      <div class="aw-golden-sparkles"><i></i><i></i><i></i><i></i><i></i></div>
    </div>
  </div>
  <nav class="aw-controls" aria-label="Invitation page navigation">
    <button class="aw-nav aw-nav--prev" type="button" data-aw-prev aria-label="Previous page" disabled><span aria-hidden="true">‹</span></button>
    <div class="aw-control-center">
      <span class="aw-counter" aria-live="polite"><span data-aw-current>1</span><i>/</i><span data-aw-total>${pages.length}</span></span>
      <div class="aw-dots" data-aw-dots>${dotMarkup}</div>
    </div>
    <button class="aw-nav aw-nav--next" type="button" data-aw-next aria-label="Next page"><span aria-hidden="true">›</span></button>
  </nav>
</main>
<noscript><style>html.aw-html,body.aw-body{height:auto!important;min-height:100%!important;overflow:auto!important}.aw-page{opacity:1!important;position:relative!important;transform:none!important;pointer-events:auto!important;inset:auto!important;margin:1rem auto}.aw-stage{position:relative!important;height:auto!important;overflow:visible!important}.aw-app{height:auto!important;overflow:visible!important}.aw-controls,.aw-door-open{display:none!important}</style><p class="aw-no-script">JavaScript is off. Scroll through the invitation pages.</p></noscript>
</body>
</html>`;
}

module.exports = { render, dateLabel, EVENT_ART };
