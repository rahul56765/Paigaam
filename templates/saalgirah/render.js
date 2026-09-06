'use strict';
/**
 * Saalgirah renderer.
 *
 * Emits the whole four-scene experience as server-rendered HTML: the copy lives
 * in the document (so it survives a failed script, a screen reader, or a share
 * preview) while /saalgirah/letter.js only drives timing, sound and the two
 * interactions — opening the envelope and blowing out the candles.
 *
 * The artwork is a faithful port of the uploaded React components; every path,
 * gradient stop and radius is carried over unchanged. Gradients are declared
 * once in a hidden sprite and referenced by id from each scene.
 */

const escape = value => String(value == null ? '' : value)
  .replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const text = (value, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const DEFAULTS = {
  line1: 'I was going to write something normal…',
  line2: 'but you’re not exactly a normal person to me.',
  line3: 'So… I made you this.',
  attentionLine: 'Okay… now that I have your attention.',
  closingLine: 'I LOVE YOU.',
  recipientName: 'you',
};

const HEART_PATH = 'M12 21s-7-4.5-9.5-9C0.5 8 2 4 6 4c2.5 0 4 1.5 6 3.5C14 5.5 15.5 4 18 4c4 0 5.5 4 3.5 8-2.5 4.5-9.5 9-9.5 9z';

/** Inline heart glyph. `fill` is a literal colour or a gradient url. */
const heart = (size, fill, cls = '') =>
  `<svg class="sg-heart${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${HEART_PATH}" fill="${fill}"></path></svg>`;

/* ---------------------------------------------------------------- gradients */

/**
 * Every gradient the scenes reference, declared once. Kept in the document
 * (not display:none) so Safari resolves the url(#id) references reliably.
 */
function defsSprite() {
  return `<svg class="sg-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
<radialGradient id="bearBody" cx="50%" cy="40%" r="65%"><stop offset="0%" stop-color="#FFFCF6"></stop><stop offset="60%" stop-color="#FAF3E7"></stop><stop offset="100%" stop-color="#F0E5D2"></stop></radialGradient>
<radialGradient id="bearBelly" cx="50%" cy="50%" r="60%"><stop offset="0%" stop-color="#FFFDF8"></stop><stop offset="100%" stop-color="#F8EEDC"></stop></radialGradient>
<radialGradient id="bearEar" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#FBE0DA"></stop><stop offset="100%" stop-color="#F3CDC4"></stop></radialGradient>
<radialGradient id="bearCheek" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#F7C5BC" stop-opacity="0.85"></stop><stop offset="100%" stop-color="#F7C5BC" stop-opacity="0"></stop></radialGradient>
<radialGradient id="bearShadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#3a2418" stop-opacity="0.18"></stop><stop offset="100%" stop-color="#3a2418" stop-opacity="0"></stop></radialGradient>
<radialGradient id="heldHeart" cx="40%" cy="35%" r="65%"><stop offset="0%" stop-color="#E89090"></stop><stop offset="60%" stop-color="#C75A5A"></stop><stop offset="100%" stop-color="#9C3B3B"></stop></radialGradient>
<radialGradient id="loveHeart" cx="40%" cy="35%" r="65%"><stop offset="0%" stop-color="#E89090"></stop><stop offset="60%" stop-color="#C75A5A"></stop><stop offset="100%" stop-color="#9C3B3B"></stop></radialGradient>
<linearGradient id="hatGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F4B8B0"></stop><stop offset="100%" stop-color="#D9A7A0"></stop></linearGradient>
<linearGradient id="envBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FBF1E0"></stop><stop offset="100%" stop-color="#F0E2C8"></stop></linearGradient>
<linearGradient id="envFlap" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F4E6CB"></stop><stop offset="100%" stop-color="#E8D5B0"></stop></linearGradient>
<linearGradient id="envInner" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FDF6E6"></stop><stop offset="100%" stop-color="#F5E8CC"></stop></linearGradient>
<radialGradient id="envGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#FFE9B0" stop-opacity="0.8"></stop><stop offset="100%" stop-color="#FFE9B0" stop-opacity="0"></stop></radialGradient>
<linearGradient id="cakeTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FBEDE9"></stop><stop offset="100%" stop-color="#F4D8CE"></stop></linearGradient>
<linearGradient id="cakeBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F7E2DD"></stop><stop offset="100%" stop-color="#E8C8BF"></stop></linearGradient>
<linearGradient id="cakePlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FBF6EE"></stop><stop offset="100%" stop-color="#E8D5B0"></stop></linearGradient>
<radialGradient id="flameGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#FFE4A0" stop-opacity="0.95"></stop><stop offset="100%" stop-color="#FFE4A0" stop-opacity="0"></stop></radialGradient>
<radialGradient id="flame" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#FFF4D0"></stop><stop offset="50%" stop-color="#FFC76B"></stop><stop offset="100%" stop-color="#E8893A"></stop></radialGradient>
</defs></svg>`;
}

/* -------------------------------------------------------------------- bear */

function bearEyes(happy) {
  if (happy) {
    return `<g><path d="M 48 46 Q 51 43 54 46" fill="none" stroke="#3a2a1c" stroke-width="1.6" stroke-linecap="round"></path><path d="M 66 46 Q 69 43 72 46" fill="none" stroke="#3a2a1c" stroke-width="1.6" stroke-linecap="round"></path></g>`;
  }
  return `<g class="sg-blink"><ellipse cx="51" cy="46" rx="1.8" ry="2.6" fill="#3a2a1c"></ellipse><ellipse cx="69" cy="46" rx="1.8" ry="2.6" fill="#3a2a1c"></ellipse><circle cx="51.6" cy="45.2" r="0.55" fill="#FFFCF6"></circle><circle cx="69.6" cy="45.2" r="0.55" fill="#FFFCF6"></circle></g>`;
}

function bearArms(pose) {
  if (pose === 'celebrating' || pose === 'waving') {
    return `<g class="sg-wave">
      <path d="M 80 72 Q 90 60 88 48" fill="none" stroke="#E4D2B8" stroke-width="8" stroke-linecap="round"></path>
      <path d="M 80 72 Q 90 60 88 48" fill="none" stroke="url(#bearBody)" stroke-width="6" stroke-linecap="round"></path>
      <circle cx="88" cy="46" r="5.5" fill="url(#bearBody)" stroke="#E4D2B8" stroke-width="0.4"></circle>
      <ellipse cx="42" cy="78" rx="6" ry="9" fill="url(#bearBody)" stroke="#E4D2B8" stroke-width="0.4" transform="rotate(-15 42 78)"></ellipse>
    </g>`;
  }
  if (pose === 'holding-heart') {
    return `<g>
      <path d="M 42 78 Q 52 84 58 80" fill="none" stroke="url(#bearBody)" stroke-width="7" stroke-linecap="round"></path>
      <path d="M 78 78 Q 68 84 62 80" fill="none" stroke="url(#bearBody)" stroke-width="7" stroke-linecap="round"></path>
    </g>`;
  }
  return `<g>
    <ellipse cx="42" cy="80" rx="6" ry="9" fill="url(#bearBody)" stroke="#E4D2B8" stroke-width="0.4" transform="rotate(-18 42 80)"></ellipse>
    <ellipse cx="78" cy="80" rx="6" ry="9" fill="url(#bearBody)" stroke="#E4D2B8" stroke-width="0.4" transform="rotate(18 78 80)"></ellipse>
  </g>`;
}

/**
 * The white bear. `pose` drives a small body tilt, the eyes and the arms —
 * exactly as the uploaded component did.
 */
function bear(pose = 'sitting', size = 110, hasHat = false) {
  const tilt = pose === 'celebrating' ? -4 : pose === 'peeking' ? 6 : pose === 'waving' ? 2 : 0;
  const happyEyes = pose === 'celebrating' || pose === 'holding-heart' || pose === 'waving';
  return `<div class="sg-bear sg-bear--${escape(pose)}" style="width:${size}px;height:${size}px">
  <svg viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true" focusable="false" style="overflow:visible">
    <ellipse cx="60" cy="106" rx="28" ry="4.5" fill="url(#bearShadow)"></ellipse>
    <g style="transform:rotate(${tilt}deg);transform-origin:60px 80px">
      <g>
        <ellipse cx="36" cy="32" rx="11" ry="11" fill="url(#bearBody)" stroke="#E4D2B8" stroke-width="0.4"></ellipse>
        <ellipse cx="36" cy="33" rx="6" ry="6" fill="url(#bearEar)"></ellipse>
        <ellipse cx="84" cy="32" rx="11" ry="11" fill="url(#bearBody)" stroke="#E4D2B8" stroke-width="0.4"></ellipse>
        <ellipse cx="84" cy="33" rx="6" ry="6" fill="url(#bearEar)"></ellipse>
      </g>
      <ellipse cx="60" cy="80" rx="32" ry="26" fill="url(#bearBody)" stroke="#E4D2B8" stroke-width="0.5"></ellipse>
      <ellipse cx="60" cy="84" rx="20" ry="16" fill="url(#bearBelly)"></ellipse>
      <ellipse cx="48" cy="101" rx="8" ry="5" fill="url(#bearBody)" stroke="#E4D2B8" stroke-width="0.4"></ellipse>
      <ellipse cx="72" cy="101" rx="8" ry="5" fill="url(#bearBody)" stroke="#E4D2B8" stroke-width="0.4"></ellipse>
      <ellipse cx="48" cy="101" rx="3.5" ry="2.2" fill="#F3CDC4" opacity="0.7"></ellipse>
      <ellipse cx="72" cy="101" rx="3.5" ry="2.2" fill="#F3CDC4" opacity="0.7"></ellipse>
      <ellipse cx="60" cy="46" rx="28" ry="25" fill="url(#bearBody)" stroke="#E4D2B8" stroke-width="0.5"></ellipse>
      <ellipse cx="44" cy="54" rx="7" ry="5" fill="url(#bearCheek)"></ellipse>
      <ellipse cx="76" cy="54" rx="7" ry="5" fill="url(#bearCheek)"></ellipse>
      ${bearEyes(happyEyes)}
      <path d="M 57 50 Q 60 53 63 50 Q 62 53 60 54 Q 58 53 57 50 Z" fill="#4a3a2c"></path>
      <path d="M 60 54 Q 58 58 55 57" fill="none" stroke="#7a6655" stroke-width="0.9" stroke-linecap="round"></path>
      <path d="M 60 54 Q 62 58 65 57" fill="none" stroke="#7a6655" stroke-width="0.9" stroke-linecap="round"></path>
      ${bearArms(pose)}
    </g>
  </svg>
  ${pose === 'holding-heart' ? `<div class="sg-bear__held">${heart(26, 'url(#heldHeart)')}<svg class="sg-bear__gloss" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><ellipse cx="9" cy="9" rx="2" ry="1.5" fill="#FFFCF6" opacity="0.5"></ellipse></svg></div>` : ''}
  ${(pose === 'celebrating' || hasHat) ? `<div class="sg-bear__hat"><svg viewBox="0 0 40 40" width="30" height="30" aria-hidden="true">
    <path d="M 20 2 L 30 28 L 10 28 Z" fill="url(#hatGrad)" stroke="#Bf8980" stroke-width="0.6"></path>
    <ellipse cx="20" cy="28" rx="11" ry="2.5" fill="#D9B581"></ellipse>
    <circle cx="20" cy="3" r="2.5" fill="#FFFDF8" stroke="#E4C8C2" stroke-width="0.4"></circle>
    <circle cx="17" cy="20" r="0.8" fill="#FFFDF8" opacity="0.8"></circle>
    <circle cx="22" cy="14" r="0.8" fill="#FFFDF8" opacity="0.8"></circle>
  </svg></div>` : ''}
</div>`;
}

/* ----------------------------------------------------------------- scenery */

function envelopeSVG() {
  return `<svg class="sg-env__svg" viewBox="0 0 320 220" width="100%" height="100%" aria-hidden="true" style="overflow:visible">
  <ellipse cx="160" cy="208" rx="120" ry="8" fill="#3a2418" opacity="0.15"></ellipse>
  <rect x="30" y="60" width="260" height="140" rx="8" fill="url(#envBody)" stroke="#D9B581" stroke-width="0.6"></rect>
  <rect x="42" y="70" width="236" height="120" rx="4" fill="url(#envInner)" opacity="0.7"></rect>
  <g>
    <circle cx="160" cy="130" r="14" fill="#B85454" opacity="0.92"></circle>
    <circle cx="160" cy="130" r="14" fill="none" stroke="#9C3B3B" stroke-width="0.8"></circle>
    <path d="M 160 134 Q 153 128 155 124 Q 158 121 160 125 Q 162 121 165 124 Q 167 128 160 134 Z" fill="#FBF6EE" opacity="0.85"></path>
  </g>
  <g class="sg-env__flap">
    <path d="M 30 60 L 160 150 L 290 60 Z" fill="url(#envFlap)" stroke="#D9B581" stroke-width="0.6"></path>
    <path d="M 30 60 L 160 150 L 290 60 Z" fill="url(#envGlow)" opacity="0.3"></path>
  </g>
  <g class="sg-env__flap sg-env__flap--under">
    <path d="M 30 60 L 290 60 L 160 0 Z" fill="#E8D5B0" opacity="0.9"></path>
  </g>
</svg>`;
}

function cakeSVG() {
  const candle = x => `<g>
    <rect x="${x - 3}" y="88" width="6" height="32" rx="1.5" fill="#F7E2DD" stroke="#D9A7A0" stroke-width="0.4"></rect>
    <rect x="${x - 3}" y="92" width="6" height="2" fill="#D9A7A0" opacity="0.5"></rect>
    <rect x="${x - 3}" y="100" width="6" height="2" fill="#D9A7A0" opacity="0.5"></rect>
    <rect x="${x - 3}" y="108" width="6" height="2" fill="#D9A7A0" opacity="0.5"></rect>
    <line x1="${x}" y1="88" x2="${x}" y2="84" stroke="#5a4538" stroke-width="1"></line>
    <g class="sg-cake__flame">
      <circle cx="${x}" cy="76" r="14" fill="url(#flameGlow)"></circle>
      <g class="sg-flicker" style="transform-origin:${x}px 80px">
        <path d="M ${x} 68 Q ${x + 5} 74 ${x + 3} 80 Q ${x} 84 ${x - 3} 80 Q ${x - 5} 74 ${x} 68 Z" fill="url(#flame)"></path>
        <ellipse cx="${x}" cy="78" rx="1.4" ry="2" fill="#FFFDF8" opacity="0.85"></ellipse>
      </g>
    </g>
  </g>`;
  return `<svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true" style="overflow:visible">
  <ellipse cx="100" cy="178" rx="74" ry="6" fill="#3a2418" opacity="0.18"></ellipse>
  <ellipse cx="100" cy="172" rx="72" ry="9" fill="url(#cakePlate)" stroke="#D9B581" stroke-width="0.6"></ellipse>
  <ellipse cx="100" cy="170" rx="72" ry="7" fill="#FBF6EE"></ellipse>
  <rect x="42" y="118" width="116" height="50" rx="4" fill="url(#cakeBody)" stroke="#D9A7A0" stroke-width="0.6"></rect>
  <ellipse cx="100" cy="118" rx="58" ry="9" fill="url(#cakeTop)" stroke="#D9A7A0" stroke-width="0.6"></ellipse>
  <ellipse cx="100" cy="118" rx="58" ry="7" fill="#FBEDE9"></ellipse>
  <path d="M 42 124 Q 50 134 56 124 Q 62 134 68 124 Q 74 134 80 124 Q 86 134 92 124 Q 98 134 104 124 Q 110 134 116 124 Q 122 134 128 124 Q 134 134 140 124 Q 146 134 152 124 Q 158 134 158 124 L 158 118 L 42 118 Z" fill="#FBF6EE" opacity="0.95"></path>
  <circle cx="60" cy="140" r="2.5" fill="#D9A7A0" opacity="0.8"></circle>
  <circle cx="80" cy="150" r="2.5" fill="#D9B581" opacity="0.8"></circle>
  <circle cx="100" cy="140" r="2.5" fill="#B85454" opacity="0.7"></circle>
  <circle cx="120" cy="150" r="2.5" fill="#D9A7A0" opacity="0.8"></circle>
  <circle cx="140" cy="140" r="2.5" fill="#D9B581" opacity="0.8"></circle>
  ${[78, 100, 122].map(candle).join('')}
</svg>`;
}

/* ------------------------------------------------------------------ scenes */

function envelopeScene(d) {
  const addressee = text(d.recipientName);
  return `<section class="sg-scene sg-scene--envelope is-active" data-scene="envelope" aria-label="A letter, unopened">
  <div class="sg-glow sg-glow--envelope" aria-hidden="true"></div>
  <div class="sg-env">
    <div class="sg-env__bear">${bear('sitting', 84)}</div>
    <div class="sg-env__paper">
      ${envelopeSVG()}
      ${addressee ? `<p class="sg-env__addressee"><span class="sg-env__for">for</span> ${escape(addressee)}</p>` : ''}
      <div class="sg-env__burst" aria-hidden="true"><span></span></div>
    </div>
  </div>
  <h1 class="sg-env__headline">You have a Paigaam.</h1>
  <button type="button" class="sg-open" id="sgOpen" aria-label="Open Paigaam">
    <span class="sg-open__inner"><span>open</span>${heart(14, '#B85454')}</span>
  </button>
  <div class="sg-hint">
    <div class="sg-hint__dots" aria-hidden="true"><span></span><span></span><span></span></div>
    <span class="sg-hint__label">tap to open</span>
  </div>
</section>`;
}

function revealScene(d) {
  const line = (n, value) => `<p class="sg-line sg-line--${n}" data-step="${n}">${escape(value)}${n === 3 ? heart(22, '#B85454', 'sg-heart--beat') : ''}</p>`;
  return `<section class="sg-scene sg-scene--reveal" data-scene="reveal" aria-label="A quiet word before the wish">
  <div class="sg-reveal__bear">${bear('peeking', 92)}</div>
  <div class="sg-glow sg-glow--reveal" aria-hidden="true"></div>
  <div class="sg-lines" aria-live="polite">
    ${line(1, text(d.line1, DEFAULTS.line1))}
    ${line(2, text(d.line2, DEFAULTS.line2))}
    ${line(3, text(d.line3, DEFAULTS.line3))}
  </div>
  <div class="sg-keepgoing"><span>keep going</span></div>
</section>`;
}

function birthdayScene(d) {
  const who = text(d.recipientName, DEFAULTS.recipientName);
  const wish = text(d.wishLine, `HAPPY BIRTHDAY, ${who.toUpperCase()}.`);
  return `<section class="sg-scene sg-scene--birthday" data-scene="birthday" aria-label="The wish">
  <div class="sg-glow sg-glow--birthday" aria-hidden="true"></div>
  <div class="sg-cake" data-step="1">
    <div class="sg-cake__bear">${bear('sitting', 78, true)}</div>
    <div class="sg-cake__bear sg-cake__bear--wished">${bear('celebrating', 78, true)}</div>
    <div class="sg-cake__art" id="sgCake" role="button" tabindex="0" aria-label="Birthday cake — tap the candles to make a wish">
      ${cakeSVG()}
      <div class="sg-confetti" id="sgConfetti" aria-hidden="true"></div>
    </div>
  </div>
  <div class="sg-birthday__copy" aria-live="polite">
    <p class="sg-attention" data-step="2">${escape(text(d.attentionLine, DEFAULTS.attentionLine))}</p>
    <h2 class="sg-wish" data-step="3">${escape(wish)} ${heart(20, '#B85454', 'sg-heart--beat')}</h2>
    <div class="sg-makewish" data-step="4">
      <p class="sg-makewish__title">Make a wish.</p>
      <p class="sg-makewish__hint">tap the candles</p>
    </div>
    <p class="sg-cametrue">May it come true. ${heart(20, '#B85454', 'sg-heart--beat')}</p>
  </div>
</section>`;
}

function closingScene(d) {
  const sender = text(d.senderName);
  const note = text(d.note);
  return `<section class="sg-scene sg-scene--love" data-scene="love" aria-label="The last words">
  <div class="sg-glow sg-glow--love" aria-hidden="true"></div>
  <div class="sg-love__bear">${bear('holding-heart', 130)}</div>
  <h2 class="sg-love">${escape(text(d.closingLine, DEFAULTS.closingLine))} ${heart(32, 'url(#loveHeart)', 'sg-heart--beat')}</h2>
  ${note ? `<p class="sg-note">${escape(note)}</p>` : ''}
  <div class="sg-signature">
    ${sender ? `<p class="sg-signature__from">— ${escape(sender)}</p>` : ''}
    <div class="sg-signature__mark">
      <span class="sg-signature__dot">·</span>
      <h3>PAIGAAM</h3>
      ${heart(16, '#B85454')}
      <span class="sg-signature__dot">·</span>
    </div>
    <p class="sg-signature__line">A little Paigaam, made with love.</p>
  </div>
</section>`;
}

/* ------------------------------------------------------------------- shell */

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id })
 * @param opts     { baseUrl, isPreview }
 */
function renderLetter(paigaam = {}, opts = {}) {
  const d = paigaam.customer_data && typeof paigaam.customer_data === 'object' ? paigaam.customer_data : {};
  const preview = !!opts.isPreview;
  let origin = '';
  try { const url = new URL(opts.baseUrl); if (['http:', 'https:'].includes(url.protocol)) origin = url.origin; } catch { /* relative is fine */ }
  const canonical = !preview && paigaam.slug ? `${origin}/p/${encodeURIComponent(paigaam.slug)}` : '';

  const who = text(d.recipientName, DEFAULTS.recipientName);
  const sender = text(d.senderName);
  const title = `Happy birthday, ${who} · Paigaam`;
  const description = sender
    ? `A little birthday Paigaam for ${who}, from ${sender}. Open with care.`
    : `A little birthday Paigaam for ${who}. Open with care.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1a1310">
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
<link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Quicksand:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/saalgirah/letter.css">
<script src="/saalgirah/audio.js" defer></script>
<script src="/saalgirah/letter.js" defer></script>
</head>
<body class="sg" data-preview="${preview}">
${defsSprite()}
${preview ? '<div class="sg-previewbadge">Preview</div>' : ''}
<div class="sg-backdrop">
  <div class="sg-square">
    <div class="sg-stage sg-vignette sg-grain">
      <div class="sg-bg" data-bg="envelope"></div>
      <div class="sg-bg" data-bg="reveal"></div>
      <div class="sg-bg" data-bg="birthday"></div>
      <div class="sg-bg" data-bg="love"></div>
      <div class="sg-particles" id="sgParticles" aria-hidden="true"><div class="sg-sweep"></div></div>
      <main class="sg-scenes">
${envelopeScene(d)}
${revealScene(d)}
${birthdayScene(d)}
${closingScene(d)}
      </main>
    </div>
  </div>
</div>
<button type="button" class="sg-music" id="sgMusic" aria-label="Mute music" aria-pressed="false" title="Mute music">
  <span class="sg-music__note" aria-hidden="true">♪</span>
  <span class="sg-music__ring" aria-hidden="true"></span>
  <svg class="sg-music__slash" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="5" y1="5" x2="19" y2="19" stroke="#9C3B3B" stroke-width="1.6" stroke-linecap="round"></line></svg>
</button>
<noscript><style>
.sg-backdrop{position:static;display:block;padding:0}
.sg-square{width:auto!important;height:auto!important;max-width:none!important;max-height:none!important}
.sg-stage{aspect-ratio:auto;height:auto;border-radius:0;box-shadow:none;background:#FBF6EE}
.sg-particles,.sg-music,.sg-open,.sg-hint,.sg-keepgoing,.sg-makewish,.sg-env__burst{display:none!important}
.sg-scenes{position:static}
.sg-scene{position:static!important;opacity:1!important;transform:none!important;filter:none!important;visibility:visible!important;padding:56px 24px;display:flex}
.sg-scene [data-step],.sg-attention,.sg-wish,.sg-cametrue,.sg-line,.sg-signature,.sg-love,.sg-note,.sg-cake{opacity:1!important;transform:none!important;filter:none!important;visibility:visible!important}
.sg-cake__bear--wished{display:none}
</style></noscript>
</body>
</html>`;
}

module.exports = { renderLetter, DEFAULTS, bear, escape };
