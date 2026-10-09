'use strict';
/**
 * Shaadi Paigaam — the customer-facing customizer (editor).
 * A thin HTML shell: public/shaadi-paigaam/editor.js renders the seven steps
 * from the shared core (public/shaadi-paigaam/core.js), so the editor, the
 * preview and the server all validate with the very same rules.
 */
const C = require('../public/shaadi-paigaam/core.js');
const V = '1';
const json = o => JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

function shaadiPaigaamCreatePage(opts = {}) {
  const boot = { price: opts.price || 0, listPrice: opts.listPrice || 0, open: opts.open || null, resume: opts.resume || null, mapsProvider: opts.mapsProvider || 'osm' };
  const fonts = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Cormorant+Garamond:wght@500;600&family=Noto+Sans+Devanagari:wght@400;600&family=Noto+Sans+Gujarati:wght@400;600&family=Noto+Sans+Tamil:wght@400;600&family=Noto+Sans+Telugu:wght@400;600&family=Noto+Naskh+Arabic:wght@400;600&' + C.FONTS.map(f => 'family=' + f.google).join('&') + '&display=swap';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Create your wedding invitation · Paigaam</title>
<meta name="description" content="Make your own wedding invitation website on Paigaam: doors that open, a scratch-to-reveal date, maps, events, RSVP and 8 languages. Free to create and preview.">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#F7F1E6">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
<link rel="stylesheet" href="/shaadi-paigaam/editor.css?v=${V}">
</head>
<body>
<div class="app" id="app"><div style="padding:40px;text-align:center;font:16px Georgia,serif;color:#6F6266">Opening your editor…</div></div>
<div class="modal" id="modal"></div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<noscript><p style="padding:24px;text-align:center">Please turn on JavaScript to create your invitation.</p></noscript>
<script id="spe-boot" type="application/json">${json(boot)}</script>
<script src="/shaadi-paigaam/i18n.js?v=${V}"></script>
<script src="/shaadi-paigaam/core.js?v=${V}"></script>
<script src="/shaadi-paigaam/art.js?v=${V}"></script>
<script src="/js/paigaam-pay.js?v=1" defer></script>
<script src="/shaadi-paigaam/editor.js?v=${V}"></script>
</body>
</html>`;
}
module.exports = { shaadiPaigaamCreatePage };
