'use strict';
/**
 * Shaadi Paigaam — server HTML for the invitation runtime.
 * The page ships the validated data as JSON; public/shaadi-paigaam/invite.js
 * renders everything (so preview == published). Palette variables are inlined
 * for a correct first paint, and share/SEO tags are rendered here.
 */
const C = require('../../public/shaadi-paigaam/core.js');
const I = require('../../public/shaadi-paigaam/i18n.js');

const ASSET_V = '1';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const jsonSafe = obj => JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

function names(d, lang) {
  const order = d.couple.order === 'bride' ? ['bride', 'groom'] : ['groom', 'bride'];
  return order.map(s => C.txt(d, lang || d.lang.default, `couple.${s}.first`)).filter(Boolean).join(' & ');
}
function head(d, o) {
  const lang = d.lang.default;
  const built = C.buildPalette(d.palette);
  const vars = Object.entries(built.vars).map(([k, v]) => `${k}:${v}`).join(';');
  const f = C.FONT_BY_ID[d.font] || C.FONTS[0];
  const title = o.title || `${names(d, lang)} · ${I.t(lang, 'gettingMarried')}`;
  const desc = o.description || [C.fmtDate(d.wedding.date, lang, 'full'), [d.venue.name, d.venue.city].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  const L = I.LANGS[lang] || I.LANGS.en;
  return `<!doctype html>
<html lang="${esc(lang)}" dir="${L.dir}" style="${esc(vars)};--f-script:${esc(f.script)};--f-serif:${esc(f.serif)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="${esc(built.palette.primary)}">
${o.noindex ? '<meta name="robots" content="noindex,nofollow">' : ''}
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${o.ogImage ? `<meta property="og:image" content="${esc(o.ogImage)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:image" content="${esc(o.ogImage)}">` : ''}
${o.url ? `<meta property="og:url" content="${esc(o.url)}"><link rel="canonical" href="${esc(o.url)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link id="sp-fonts" rel="stylesheet" href="${esc(C.googleFontsHref(d.font, d.lang.enabled))}">
<link rel="preload" as="image" href="/shaadi-paigaam/art/door-relief.webp">
<link rel="stylesheet" href="/shaadi-paigaam/invite.css?v=${ASSET_V}">`;
}

/**
 * @param data validated data (core.validate(...).data)
 * @param o { mode: guest|demo|preview|live|thumb, id, slug, url, rsvpUrl, ogImage, noindex, mapsKey, autoOpen }
 */
function renderInvitation(data, o = {}) {
  const boot = { mode: o.mode || 'guest', id: o.id || '', slug: o.slug || '', url: o.url || '', rsvpUrl: o.rsvpUrl || '', mapsKey: o.mapsKey || '', autoOpen: !!o.autoOpen, data };
  return `${head(data, o)}
</head>
<body>
<noscript><div style="padding:40px 24px;text-align:center;font-family:Georgia,serif"><h1>${esc(names(data))}</h1><p>${esc(C.fmtDate(data.wedding.date, 'en', 'full'))} · ${esc(C.fmtTime(data.wedding.time, 'en'))}</p><p>${esc([data.venue.name, data.venue.address, data.venue.city].filter(Boolean).join(', '))}</p><p>Please enable JavaScript to open the invitation.</p></div></noscript>
<script id="sp-boot" type="application/json">${jsonSafe(boot)}</script>
<script src="/shaadi-paigaam/i18n.js?v=${ASSET_V}"></script>
<script src="/shaadi-paigaam/core.js?v=${ASSET_V}"></script>
<script src="/shaadi-paigaam/art.js?v=${ASSET_V}"></script>
<script src="/shaadi-paigaam/invite.js?v=${ASSET_V}"></script>
</body>
</html>`;
}

/** Private invitation: ask for the passcode before any detail is sent. */
function renderGate(data, o = {}) {
  const lang = data.lang.default, t = k => I.t(lang, k);
  return `${head(data, Object.assign({ noindex: true, title: names(data), description: t('passTitle') }, o))}
<style>body{background:var(--sp-bg);color:var(--sp-body);font-family:var(--f-serif),Georgia,serif}</style>
</head><body>
<div class="gate"><form class="box" method="post" action="${esc(o.action)}">
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--sp-line)" stroke-width="1.3" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="1.6"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>
  <h1>${esc(names(data))}</h1>
  <p>${esc(t('passTitle'))}</p>
  <label class="sr" for="pc">${esc(t('passHint'))}</label>
  <input id="pc" name="passcode" type="password" autocomplete="off" required maxlength="24" placeholder="${esc(t('passHint'))}" autofocus>
  ${o.wrong ? `<p role="alert" style="color:#B3261E;margin:-4px 0 12px">${esc(t('passWrong'))}</p>` : ''}
  <button class="btn wide" type="submit">${esc(t('passBtn'))}</button>
</form></div></body></html>`;
}

function renderEnded(data, o = {}) {
  const lang = data.lang.default, t = k => I.t(lang, k);
  return `${head(data, Object.assign({ noindex: true }, o))}
<style>body{background:var(--sp-bg);color:var(--sp-body);font-family:var(--f-serif),Georgia,serif}</style>
</head><body><div class="gate"><div class="box"><h1>${esc(names(data))}</h1><p>${esc(t('ended'))}</p><p style="margin-top:28px;font-size:13px">${esc(t('madeWith'))} · <a href="https://paigaam.cc">paigaam.cc</a></p></div></div></body></html>`;
}

module.exports = { renderInvitation, renderGate, renderEnded, names, ASSET_V };
