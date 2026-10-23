'use strict';
/**
 * Suvarna Vivah — an original ceremony-led wedding invitation.
 * The Paigaam data schema and editor are shared; this page composition is not.
 */
const C = require('../../public/shaadi-paigaam/core.js');
const I = C.I18N;
const ASSET_V = '3';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const jsonSafe = x => JSON.stringify(x).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
function names(d, lang) {
  const sides = d.couple.order === 'bride' ? ['bride', 'groom'] : ['groom', 'bride'];
  return sides.map(side => C.txt(d, lang || d.lang.default, `couple.${side}.first`)).filter(Boolean).join(' & ');
}
function head(data, o = {}) {
  const lang = data.lang.default || 'en';
  const L = I.LANGS[lang] || I.LANGS.en;
  const palette = C.buildPalette(data.palette || {}).palette;
  const vars = Object.entries(C.buildPalette(data.palette || {}).vars).map(([k, v]) => `${k}:${v}`).join(';');
  const font = C.FONT_BY_ID[data.font] || C.FONTS[0];
  const title = o.title || `${names(data, lang)} · Suvarna Vivah`;
  const desc = o.description || C.fillNames(C.txt(data, lang, 'welcome.text'), data, lang) || 'A wedding invitation, made for your celebration.';
  return `<!doctype html>
<html lang="${esc(lang)}" dir="${L.dir}" style="${esc(vars)};--f-script:${esc(font.script)};--f-serif:${esc(font.serif)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="${esc(palette.deep)}">
${o.noindex ? '<meta name="robots" content="noindex,nofollow">' : ''}
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${o.ogImage ? `<meta property="og:image" content="${esc(o.ogImage)}"><meta name="twitter:image" content="${esc(o.ogImage)}">` : ''}
${o.url ? `<meta property="og:url" content="${esc(o.url)}"><link rel="canonical" href="${esc(o.url)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link id="sv-fonts" rel="stylesheet" href="${esc(C.googleFontsHref(data.font, data.lang.enabled))}">
<link rel="preload" as="image" href="/suvarna-vivah/ceremony-still-life.webp">
<link rel="stylesheet" href="/suvarna-vivah/site.css?v=${ASSET_V}">
${o.openingVideo ? `<link rel="stylesheet" href="/suvarna-vivah/opening.css?v=2"><script src="/suvarna-vivah/opening.js?v=2" defer></script>` : ''}
</head>`;
}
function renderInvitation(data, o = {}) {
  const boot = { mode: o.mode || 'guest', id: o.id || '', slug: o.slug || '', url: o.url || '', rsvpUrl: o.rsvpUrl || '', mapsKey: o.mapsKey || '', autoOpen: !!o.autoOpen, openingVideo: !!o.openingVideo, data };
  const lang = data.lang.default || 'en';
  return `${head(data, o)}
<body class="sv-body">
<div id="sv-app"><div class="sv-loading" aria-live="polite">${esc(I.t(lang, 'gettingMarried'))}</div></div>
<noscript><main class="sv-noscript"><p>SUVARNA VIVAH</p><h1>${esc(names(data, lang))}</h1><p>${esc(C.fmtDate(data.wedding.date, lang, 'full'))} · ${esc(C.fmtTime(data.wedding.time, lang))}</p><p>${esc([data.venue.name, data.venue.address, data.venue.city].filter(Boolean).join(', '))}</p><p>Please enable JavaScript to open this invitation.</p></main></noscript>
<script id="sp-boot" type="application/json">${jsonSafe(boot)}</script>
<script src="/shaadi-paigaam/i18n.js?v=2"></script>
<script src="/shaadi-paigaam/core.js?v=2"></script>
<script src="/suvarna-vivah/site.js?v=${ASSET_V}"></script>
</body></html>`;
}
function renderGate(data, o = {}) {
  const lang = data.lang.default || 'en';
  const t = k => I.t(lang, k);
  return `${head(data, { noindex: true, title: 'A private wedding invitation · Suvarna Vivah', description: t('passTitle') })}
<body class="sv-body sv-gate-body"><main class="sv-gate"><div class="sv-gate__mark" aria-hidden="true">${lotusSvg()}</div><p class="sv-kicker">SUVARNA VIVAH</p><h1>${esc(t('passTitle'))}</h1><p class="sv-gate__copy">${esc(t('passHint'))}</p><form method="post" action="${esc(o.action)}"><label class="sv-sr" for="sv-pass">${esc(t('passHint'))}</label><input id="sv-pass" name="passcode" type="password" required maxlength="24" autocomplete="off" placeholder="${esc(t('passHint'))}" autofocus>${o.wrong ? `<p class="sv-gate__error" role="alert">${esc(t('passWrong'))}</p>` : ''}<button class="sv-button" type="submit">${esc(t('passBtn'))}</button></form><p class="sv-gate__foot">A private gathering, shared with love.</p></main></body></html>`;
}
function renderEnded(data, o = {}) {
  const lang = data.lang.default || 'en';
  return `${head(data, { noindex: true, title: 'With gratitude · Suvarna Vivah', description: I.t(lang, 'ended') })}
<body class="sv-body sv-gate-body"><main class="sv-gate"><div class="sv-gate__mark" aria-hidden="true">${lotusSvg()}</div><p class="sv-kicker">SUVARNA VIVAH</p><h1>${esc(I.t(lang, 'ended'))}</h1><p class="sv-gate__foot">${esc(I.t(lang, 'withLove'))} · PAIGAAM</p></main></body></html>`;
}
function lotusSvg() {
  return `<svg viewBox="0 0 72 72" fill="none" width="58" height="58" aria-hidden="true"><circle cx="36" cy="36" r="30" stroke="currentColor" stroke-opacity=".6"/><path d="M36 53c-1-9-9-13-9-20 4 2 8 5 9 10 1-7 6-13 12-16-1 9-2 15-8 22M36 53c-5-7-13-9-19-7 4 5 10 8 19 7Zm0 0c5-7 13-9 19-7-4 5-10 8-19 7ZM24 56h24M31 60h10" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
module.exports = { renderInvitation, renderGate, renderEnded, names, ASSET_V };
