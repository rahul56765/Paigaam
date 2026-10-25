'use strict';
const config = require('./config');
const schema = require('./schema');
const { resolve } = require('../../lib/bfday/fields');
const { escape: esc, head, previewBadge } = require('../../lib/bfday/page');
const safeJSON = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
function renderDivya(paigaam = {}, opts = {}) {
  const d = resolve(config, paigaam.customer_data, schema);
  const t = id => esc(d[id]);
  const q = encodeURIComponent(d.mapQuery || [d.venueName, d.venueAddress.replace(/\n/g, ', ')].filter(Boolean).join(', '));
  const map = 'https://www.google.com/maps?q=' + q + '&output=embed';
  const directions = 'https://www.google.com/maps/dir/?api=1&destination=' + q;
  const title = `${d.groomName} ${d.joiner} ${d.brideName} · शुभविवाह`;
  return `<!doctype html>
<html lang="mr" class="dv-html"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${head({ paigaam, opts, title, description: `${d.weddingHeading} · ${d.venueName} · ${d.venueAddress}`, themeColor: '#e4e2df', image: config.ogImage })}
<link rel="preload" as="font" type="font/ttf" crossorigin href="/divya-vivah/fonts/TiroDevanagariMarathi-Regular.ttf">
<link rel="preload" as="font" type="font/ttf" crossorigin href="/divya-vivah/fonts/Amita-Regular.ttf">
<link rel="preload" as="image" href="/divya-vivah/invitation.webp">
<link rel="stylesheet" href="/divya-vivah/invite.css?v=1"><script defer src="/divya-vivah/invite.js?v=1"></script>
</head><body class="dv-body" data-preview="${!!opts.isPreview}">
${previewBadge(opts)}
<main id="dv-main" class="dv-main" inert>
<section class="dv-page dv-invitation" id="dv-invitation" tabindex="-1" aria-label="${t('weddingHeading')}">
 <div class="dv-card">
  <img class="dv-art" src="/divya-vivah/invitation.webp" alt="गणपती, दिव्य हात आणि पारंपरिक महाराष्ट्रीय वधू-वर यांची चित्रकला" fetchpriority="high" width="1104" height="1656">
  <p class="dv-copy dv-prayer" data-fit>${t('prayer')}</p>
  <p class="dv-copy dv-introduction" data-fit>${t('introduction')}</p>
  <div class="dv-copy dv-names"><h1 class="dv-name" data-fit>${t('groomName')}</h1><span class="dv-joiner" data-fit>${t('joiner')}</span><h2 class="dv-name" data-fit>${t('brideName')}</h2></div>
  <p class="dv-copy dv-wedding-heading" data-fit>${t('weddingHeading')}</p>
  <div class="dv-copy dv-particulars" data-fit>
   <div class="dv-date"><span data-fit>${t('dateLabel')}</span><span data-fit>${t('weekday')}</span><strong data-fit>${t('dayText')}</strong><span data-fit>${t('monthYearText')}</span></div>
   <div class="dv-time"><span data-fit>${t('timeLabel')}</span><span data-fit>${t('timePeriod')}</span><strong data-fit>${t('timeText')}</strong><span data-fit>${t('timeSuffix')}</span></div>
   <div class="dv-venue"><span data-fit>${t('venueLabel')}</span><strong data-fit>${t('venueName')}</strong><p data-fit>${t('venueAddress')}</p></div>
  </div>
  <p class="dv-copy dv-presence" data-fit>${t('presenceMessage')}</p>
  <div class="dv-copy dv-hosts" data-fit><p data-fit>${t('hostsLabel')}</p><p data-fit>${t('familyDetails')}</p><p data-fit>${t('contactText')}</p></div>
 </div>
 <a class="dv-next" href="#dv-details">${t('nextLabel')}<span aria-hidden="true">↓</span></a>
</section>
<section class="dv-page dv-details" id="dv-details" tabindex="-1" aria-label="${t('countdownHeading')}">
 <div class="dv-detail-art" aria-hidden="true"></div>
 <div class="dv-detail-inner">
  <span class="dv-ornament" aria-hidden="true">❦</span>
  <p class="dv-detail-names">${t('groomName')} <span>${t('joiner')}</span> ${t('brideName')}</p>
  <h2>${t('countdownHeading')}</h2><p class="dv-detail-intro">${t('countdownDescription')}</p>
  <time class="dv-target" datetime="${t('weddingDate')}T${t('weddingTime')}:00+05:30"></time>
  <div class="dv-countdown" role="timer" aria-label="${t('countdownHeading')}">
   ${[['days','daysLabel'],['hours','hoursLabel'],['minutes','minutesLabel'],['seconds','secondsLabel']].map(([unit,label])=>`<div class="dv-unit"><strong data-unit="${unit}">००</strong><span>${t(label) || {days:'दिवस',hours:'तास',minutes:'मिनिटे',seconds:'सेकंद'}[unit]}</span></div>`).join('')}
  </div>
  <p id="dv-count-status" class="dv-count-status" aria-live="polite"></p>
  <div class="dv-venue-panel"><span class="dv-ornament" aria-hidden="true">❦</span><h2>${t('locationHeading')}</h2><h3>${t('venueName')}</h3><p class="dv-address">${t('venueAddress')}</p>
   <div class="dv-map-wrap"><iframe id="dv-map" title="${t('locationHeading')} — ${t('venueName')}" data-src="${esc(map)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe><a class="dv-map-fallback" href="${esc(directions)}" target="_blank" rel="noopener noreferrer">Google Maps ↗</a></div>
   <a class="dv-directions" href="${esc(directions)}" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 9-9 9-9-9 9-9Zm0 5v4H8m4-4 4 4"/></svg>${t('directionsLabel')}</a>
  </div>
  <a class="dv-back" href="#dv-invitation">↑ ${t('backLabel')}</a>
  <a class="dv-brand" href="https://paigaam.cc/" target="_blank" rel="noopener noreferrer">PAIGAAM</a>
 </div>
</section>
</main>
<div class="dv-gate" id="dv-gate">
 <video id="dv-video" class="dv-video" playsinline preload="metadata" poster="/divya-vivah/opening-poster.jpg" aria-hidden="true"><source src="/divya-vivah/opening.mp4" type="video/mp4"></video>
 <div class="dv-gate-border" aria-hidden="true"></div>
 <button class="dv-open" id="dv-open" type="button"><span class="dv-gate-label">${t('gateLabel')}</span><span class="dv-gate-names">${t('groomName')} <small>${t('joiner')}</small> ${t('brideName')}</span><span class="dv-touch" aria-hidden="true"><svg viewBox="0 0 64 80" fill="none"><path d="M25 43V15a5 5 0 0 1 10 0v21-7a5 5 0 0 1 10 0v9-4a5 5 0 0 1 10 0v16c0 17-9 24-21 24-11 0-15-8-19-14L6 47c-4-7 3-12 8-6l11 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 15a17 17 0 0 1 34 0M20 15a10 10 0 0 1 20 0" stroke="currentColor" stroke-width="1" opacity=".5"/></svg></span><span class="dv-tap-label">${t('tapLabel')}</span></button>
 <button class="dv-skip" id="dv-skip" type="button" hidden>${t('backLabel')} ↗</button>
 <p class="dv-video-status" id="dv-video-status" role="status"></p>
</div>
<div class="dv-glow" id="dv-glow" aria-hidden="true"></div>
<script type="application/json" id="dv-data">${safeJSON({date:d.weddingDate,time:d.weddingTime,dayMessage:d.weddingDayMessage,afterMessage:d.afterWeddingMessage,preview:!!opts.isPreview})}</script>
<noscript><style>.dv-gate,.dv-glow{display:none}.dv-main{visibility:visible;opacity:1}.dv-countdown,.dv-target{display:none}</style><p class="dv-noscript">${t('groomName')} ${t('joiner')} ${t('brideName')} · ${t('venueName')} · ${t('venueAddress')} <a href="${esc(directions)}">${t('directionsLabel')}</a></p></noscript>
</body></html>`;
}
module.exports = { renderDivya, render: renderDivya };
