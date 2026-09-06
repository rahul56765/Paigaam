'use strict';
/**
 * Lavender Bloom Surprise renderer.
 *
 * Emits the whole four-stage experience as server-rendered HTML: the copy lives
 * in the document (so it survives a failed script, a screen reader, or a share
 * preview) while /lavender-bloom/bloom.js only drives timing and the three
 * interactions — opening the envelope, playing the (rigged) game, and tapping
 * the gift.
 *
 * The artwork is hand-drawn inline SVG; the tic-tac-toe board is nine real
 * buttons (keyboard reachable) with an SVG win-line layer on top; the lavender
 * bloom is pure SVG with CSS-driven stem growth. Colours are derived from the
 * chosen flower preset, so a rose Paigaam blooms rose — never lavender.
 */

const escape = value => String(value == null ? '' : value)
  .replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const text = (value, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const DEFAULTS = {
  recipientName: 'you',
  title: 'For You!',
  message: 'Because you make every day as bright as a blooming flower. I miss you more than words can say!',
  flowerColor: 'lavender',
};

/* Flower presets: buds (three tints), the title ink and the heart colour. */
const PALETTES = {
  lavender: { buds: ['#8A5CF5', '#B57EDC', '#C8A2FF'], title: '#8A5CF5', hearts: '#8A5CF5' },
  rose:     { buds: ['#E05C7E', '#F08CA6', '#F7B8C8'], title: '#D14D6E', hearts: '#E05C7E' },
  sunbeam:  { buds: ['#F0A13A', '#F5C044', '#FFE8A3'], title: '#C07F1E', hearts: '#F0A13A' },
};

const HEART_PATH = 'M12 21s-7-4.5-9.5-9C0.5 8 2 4 6 4c2.5 0 4 1.5 6 3.5C14 5.5 15.5 4 18 4c4 0 5.5 4 3.5 8-2.5 4.5-9.5 9-9.5 9z';

/** Inline heart glyph. */
const heart = (size, fill, cls = '') =>
  `<svg class="lb-heart${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${HEART_PATH}" fill="${fill}"></path></svg>`;

/* ---------------------------------------------------------------- gradients */

function defsSprite() {
  return `<svg class="lb-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
<linearGradient id="lbEnvBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFFFFF"></stop><stop offset="100%" stop-color="#F4F8FE"></stop></linearGradient>
<linearGradient id="lbEnvFlap" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#B9D4F5"></stop><stop offset="100%" stop-color="#A9CCF3"></stop></linearGradient>
<linearGradient id="lbGiftBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4C8DF6"></stop><stop offset="100%" stop-color="#2D7DF4"></stop></linearGradient>
<linearGradient id="lbGiftLid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5E9BF8"></stop><stop offset="100%" stop-color="#3B82F6"></stop></linearGradient>
<radialGradient id="lbGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.85"></stop><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"></stop></radialGradient>
</defs></svg>`;
}

/* ------------------------------------------------------------- stage 1 */

function envelopeSVG() {
  return `<svg class="lb-env__svg" viewBox="0 0 320 220" width="100%" height="100%" aria-hidden="true" style="overflow:visible">
  <ellipse cx="160" cy="210" rx="118" ry="7" fill="#1E3A5F" opacity="0.12"></ellipse>
  <rect x="30" y="60" width="260" height="140" rx="14" fill="url(#lbEnvBody)" stroke="#DCEAFB" stroke-width="1"></rect>
  <path d="M 30 74 L 160 152 L 290 74 L 290 186 Q 290 200 276 200 L 44 200 Q 30 200 30 186 Z" fill="#EAF2FD"></path>
  <path d="M 30 74 L 160 152 L 290 74" fill="none" stroke="#DCEAFB" stroke-width="1"></path>
  <g class="lb-env__flap">
    <path d="M 30 62 L 160 148 L 290 62 L 290 68 Q 290 74 284 76 L 166 156 Q 160 160 154 156 L 36 76 Q 30 74 30 68 Z" fill="url(#lbEnvFlap)"></path>
    <path d="M 30 62 L 160 148 L 290 62 Z" fill="#C9DEF7"></path>
  </g>
</svg>`;
}

function envelopeStage(d) {
  return `<section class="lb-stage lb-stage--envelope is-active" data-stage="envelope" aria-label="A sealed envelope">
  <p class="lb-topline">Wait till the flowers open <span aria-hidden="true">🌷</span></p>
  <div class="lb-env" id="lbEnvelope" role="button" tabindex="0" aria-label="Open when you miss me — tap to open">
    <div class="lb-env__art">${envelopeSVG()}</div>
    <p class="lb-env__inside">Open when you miss me</p>
    <div class="lb-env__burst" aria-hidden="true"><span></span></div>
  </div>
  <div class="lb-hint"><span class="lb-hint__dot"></span><span class="lb-hint__dot"></span><span class="lb-hint__dot"></span><span class="lb-hint__label">tap to open</span></div>
</section>`;
}

/* ------------------------------------------------------------- stage 2 */

const MARK_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5 L19 19 M19 5 L5 19" stroke="#2D7DF4" stroke-width="3.4" stroke-linecap="round" fill="none"></path></svg>';
const MARK_O = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7.4" stroke="#8BB8E8" stroke-width="3.2" fill="none"></circle></svg>';

function gameStage() {
  let cells = '';
  for (let i = 0; i < 9; i++) {
    cells += `<button type="button" class="lb-cell" data-cell="${i}" aria-label="Cell ${i + 1}"><span class="lb-mark lb-mark--x" data-mark="x">${MARK_X}</span><span class="lb-mark lb-mark--o" data-mark="o">${MARK_O}</span></button>`;
  }
  return `<section class="lb-stage lb-stage--game" data-stage="game" aria-label="A game of tic-tac-toe">
  <p class="lb-topline">Wait till the flowers open <span aria-hidden="true">🌷</span></p>
  <p class="lb-subtitle">Win for a surprise! <span aria-hidden="true">✨</span></p>
  <div class="lb-board" role="group" aria-label="Tic-tac-toe board. You are the blue crosses.">
    ${cells}
    <svg class="lb-winline" viewBox="0 0 300 300" aria-hidden="true"><line id="lbWinLine" x1="0" y1="0" x2="0" y2="0" stroke="#2D7DF4" stroke-width="7" stroke-linecap="round"></line></svg>
  </div>
  <p class="lb-game__status" id="lbGameStatus" aria-live="polite">Your turn — you’re <b>✕</b>.</p>
</section>`;
}

/* ------------------------------------------------------------- stage 3 */

function giftSVG() {
  return `<svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true" style="overflow:visible">
  <ellipse cx="100" cy="176" rx="62" ry="6.5" fill="#1E3A5F" opacity="0.14"></ellipse>
  <g class="lb-gift__box">
    <rect x="48" y="88" width="104" height="84" rx="10" fill="url(#lbGiftBody)"></rect>
    <rect x="94" y="88" width="12" height="84" fill="#C2DCF9"></rect>
    <rect x="40" y="66" width="120" height="30" rx="8" fill="url(#lbGiftLid)"></rect>
    <rect x="94" y="66" width="12" height="30" fill="#D6E6FB"></rect>
    <g class="lb-gift__bow">
      <path d="M 100 66 C 84 44 62 46 64 60 C 66 72 88 72 100 66 Z" fill="#C2DCF9" stroke="#9CC0EE" stroke-width="1"></path>
      <path d="M 100 66 C 116 44 138 46 136 60 C 134 72 112 72 100 66 Z" fill="#C2DCF9" stroke="#9CC0EE" stroke-width="1"></path>
      <circle cx="100" cy="66" r="7" fill="#A9CCF3" stroke="#9CC0EE" stroke-width="1"></circle>
    </g>
  </g>
</svg>`;
}

function giftStage() {
  return `<section class="lb-stage lb-stage--gift" data-stage="gift" aria-label="A gift, waiting to be opened">
  <div class="lb-gift" id="lbGift" role="button" tabindex="0" aria-label="Tap to open the gift">
    <div class="lb-gift__art">${giftSVG()}</div>
    <div class="lb-gift__burst" id="lbGiftBurst" aria-hidden="true"></div>
  </div>
  <p class="lb-gift__label">TAP TO OPEN!</p>
</section>`;
}

/* ------------------------------------------------------------- stage 4 */

function flowerSVG(palette) {
  const [deep, mid, light] = palette.buds;
  // One lavender sprig: green stem, two leaves, and a column of stacked buds.
  const bud = (x, y, s, fill) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="-3.2" cy="0" rx="3.4" ry="4.6" fill="${fill}"></ellipse><ellipse cx="3.2" cy="0" rx="3.4" ry="4.6" fill="${fill}"></ellipse><ellipse cx="0" cy="-3.4" rx="3.6" ry="4.8" fill="${light}"></ellipse></g>`;
  return `<svg class="lb-flower__svg" viewBox="0 0 200 220" width="100%" height="100%" aria-hidden="true" style="overflow:visible">
  <ellipse cx="100" cy="212" rx="46" ry="5" fill="#1E3A5F" opacity="0.12"></ellipse>
  <g class="lb-flower__stem">
    <path d="M 100 212 C 98 168 102 132 100 88" fill="none" stroke="#4A7C59" stroke-width="3.4" stroke-linecap="round"></path>
    <path d="M 100 168 C 86 162 78 152 76 140 C 90 144 98 154 100 168 Z" fill="#5E9370"></path>
    <path d="M 100 148 C 114 142 122 132 124 120 C 110 124 102 134 100 148 Z" fill="#6BA37E"></path>
    <g class="lb-flower__head">
      ${bud(100, 84, 1.15, deep)}
      ${bud(99, 72, 1.08, mid)}
      ${bud(101, 60, 1.0, deep)}
      ${bud(99, 48, 0.92, mid)}
      ${bud(100, 37, 0.82, deep)}
      ${bud(100, 27, 0.68, mid)}
      ${bud(100, 18, 0.52, deep)}
    </g>
  </g>
</svg>`;
}

function bloomStage(d, palette) {
  const title = text(d.title, DEFAULTS.title);
  const message = text(d.message, DEFAULTS.message);
  const sender = text(d.senderName);
  return `<section class="lb-stage lb-stage--bloom" data-stage="bloom" aria-label="A lavender bloom, grown for them">
  <div class="lb-sparkles" id="lbSparkles" aria-hidden="true"></div>
  <div class="lb-flower" id="lbFlower">
    <div class="lb-flower__art">${flowerSVG(palette)}</div>
  </div>
  <div class="lb-finale" aria-live="polite">
    <h2 class="lb-finale__title" style="color:${palette.title}">${escape(title)}</h2>
    <p class="lb-finale__message">${escape(message)}</p>
    <p class="lb-finale__hearts" aria-label="Three purple hearts">${heart(26, palette.hearts)}${heart(26, palette.hearts)}${heart(26, palette.hearts)}</p>
    ${sender ? `<p class="lb-finale__signature">— ${escape(sender)}</p>` : ''}
  </div>
</section>`;
}

/* ------------------------------------------------------------------- shell */

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id })
 * @param opts     { baseUrl, isPreview }
 */
function renderBloom(paigaam = {}, opts = {}) {
  const d = paigaam.customer_data && typeof paigaam.customer_data === 'object' ? paigaam.customer_data : {};
  const preview = !!opts.isPreview;
  let origin = '';
  try { const url = new URL(opts.baseUrl); if (['http:', 'https:'].includes(url.protocol)) origin = url.origin; } catch { /* relative is fine */ }
  const canonical = !preview && paigaam.slug ? `${origin}/p/${encodeURIComponent(paigaam.slug)}` : '';

  const who = text(d.recipientName, DEFAULTS.recipientName);
  const sender = text(d.senderName);
  const palette = PALETTES[text(d.flowerColor, DEFAULTS.flowerColor)] || PALETTES.lavender;
  const title = `A little surprise for ${who} · Paigaam`;
  const description = sender
    ? `A lavender surprise for ${who}, from ${sender}. Open when you miss me.`
    : `A lavender surprise for ${who}. Open when you miss me.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#F0F7FF">
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
${preview ? '<meta name="robots" content="noindex, nofollow, noarchive">' : canonical ? `<link rel="canonical" href="${escape(canonical)}">` : ''}
<meta property="og:type" content="website">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
${canonical ? `<meta property="og:url" content="${escape(canonical)}">` : ''}
${origin ? `<meta property="og:image" content="${escape(origin)}/brand/favicon-512.png">` : ''}
<meta name="twitter:card" content="summary">
<link rel="icon" href="/brand/favicon-512.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/lavender-bloom/bloom.css">
<script src="/lavender-bloom/bloom.js" defer></script>
</head>
<body class="lb" data-preview="${preview}" data-color="${escape(text(d.flowerColor, DEFAULTS.flowerColor))}">
${defsSprite()}
${preview ? '<div class="lb-previewbadge">Preview</div>' : ''}
<div class="lb-backdrop">
  <div class="lb-square">
    <div class="lb-stage-shell">
      <canvas class="lb-confetti" id="lbConfetti" aria-hidden="true"></canvas>
      <main class="lb-stages">
${envelopeStage(d)}
${gameStage()}
${giftStage()}
${bloomStage(d, palette)}
      </main>
    </div>
  </div>
</div>
<noscript><style>
.lb-backdrop{position:static;display:block;padding:0}
.lb-square{width:auto!important;height:auto!important;max-width:none!important;max-height:none!important}
.lb-stage-shell{aspect-ratio:auto;height:auto;border-radius:0;box-shadow:none;background:#F0F7FF}
.lb-confetti,.lb-hint,.lb-env__burst{display:none!important}
.lb-stages{position:static}
.lb-stage{position:static!important;opacity:1!important;transform:none!important;filter:none!important;visibility:visible!important;padding:48px 24px;display:flex}
.lb-stage [data-step],.lb-finale,.lb-finale__title,.lb-finale__message,.lb-finale__hearts,.lb-finale__signature{opacity:1!important;transform:none!important;filter:none!important;visibility:visible!important}
.lb-cell{cursor:default}
</style></noscript>
</body>
</html>`;
}

module.exports = { renderBloom, DEFAULTS, PALETTES, escape };
