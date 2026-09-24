'use strict';
/**
 * Sau Wajah renderer.
 *
 * Emits the whole four-scene experience as ONE server-rendered document:
 * the copy lives in the HTML (so it survives a failed script, a screen
 * reader, or a share preview) while /sau-wajah/sauwajah.js only drives the
 * choreography — scene switching, the polaroid gallery, the auto-scrolling
 * reasons list, the typewriter letter, the confetti, the persistent song
 * and the little note.
 *
 * Ported from felisaans/cute-birthday-website (MIT). The original was four
 * HTML pages linked with blur transitions; here the scenes are sections of
 * one document, so the music and the note the original kept alive with
 * sessionStorage/localStorage across reloads simply persist. The original's
 * placeholder GIFs and photos (pastel "REPLACE ME" boxes) are not ported —
 * the hero wears a hand-drawn cake-and-balloons SVG and empty photo slots
 * render pastel placeholder polaroids that invite the sender to upload.
 */

const escape = value => String(value == null ? '' : value)
  .replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const text = (value, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const DEFAULTS = {
  recipientName: 'you',
  heroTitle: 'happy birthday my girlfriend!!',
  heroSubtitle: 'yess, this is your special day <3',
  galleryHeading: 'our little moments',
  reasonsHeading: '100 reasons why i love you',
  letterTitle: 'Happy Birthday My Girl!!! <33',
  signature: '— your biggest fan',
};

/** The original's letter, kept as the default letterBody. */
const DEFAULT_LETTER = `My love,

Happy birthday to the most wonderful person I know. I don't think words can fully capture how grateful I am to have you in my life, but I'm going to try anyway.

You make every ordinary day feel special just by being in it. Your smile, your laugh, the way you care about everyone around you... it all makes me fall for you more every single day.

I hope this year brings you every single thing you've been hoping for, and so much more. I promise to be right beside you for all of it — the big moments and the tiny, quiet ones too.

Thank you for being exactly who you are. I love you more than words can say.

Happy birthday, my girl. Here's to you.`;

/** The original's four gallery captions, kept as defaults. */
const CAPTIONS = [
  'Thank you for being a part of my life... every day with you feels like a gift.',
  'I hope that on this special day, you are surrounded by happiness and love.',
  'Every laugh, every hug, every little moment with you means the world to me.',
  'Here\u2019s to many more birthdays, adventures, and memories together, my love.',
];

const FLOATIES = ['\u{1F496}', '\u2728', '\u{1F497}', '\u{1F4AB}', '\u{1F499}', '\u{1F49C}'];

/** Cake with three candles, hand-drawn — stands in for the original's hero.gif. */
function cakeSVG() {
  return `<svg class="sw-cake" viewBox="0 0 240 220" width="240" height="220" aria-hidden="true" focusable="false" style="overflow:visible">
  <defs>
    <linearGradient id="swCakeTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFF3F7"></stop><stop offset="100%" stop-color="#FFD9E8"></stop></linearGradient>
    <linearGradient id="swCakeBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFE4EE"></stop><stop offset="100%" stop-color="#FBC6DC"></stop></linearGradient>
    <radialGradient id="swFlame" cx="50%" cy="70%" r="60%"><stop offset="0%" stop-color="#FFF4D0"></stop><stop offset="55%" stop-color="#FFC76B"></stop><stop offset="100%" stop-color="#F09A3E"></stop></radialGradient>
  </defs>
  <ellipse cx="120" cy="204" rx="86" ry="10" fill="#5b4a5a" opacity="0.08"></ellipse>
  <g class="sw-cake__candles">
    <g transform="translate(86,96)"><rect x="-4" y="0" width="8" height="30" rx="3" fill="#A8D8FF"></rect><ellipse class="sw-flame" cx="0" cy="-9" rx="5" ry="9" fill="url(#swFlame)"></ellipse></g>
    <g transform="translate(120,88)"><rect x="-4" y="0" width="8" height="38" rx="3" fill="#C7A9FF"></rect><ellipse class="sw-flame" cx="0" cy="-9" rx="5" ry="9" fill="url(#swFlame)"></ellipse></g>
    <g transform="translate(154,96)"><rect x="-4" y="0" width="8" height="30" rx="3" fill="#FFB3D1"></rect><ellipse class="sw-flame" cx="0" cy="-9" rx="5" ry="9" fill="url(#swFlame)"></ellipse></g>
  </g>
  <path d="M 52 130 Q 52 126 56 126 L 184 126 Q 188 126 188 130 L 188 150 Q 170 162 152 150 Q 134 162 120 150 Q 106 162 88 150 Q 70 162 52 150 Z" fill="url(#swCakeTop)"></path>
  <rect x="52" y="148" width="136" height="54" rx="6" fill="url(#swCakeBody)"></rect>
  <rect x="52" y="166" width="136" height="6" fill="#FFD6E8" opacity="0.8"></rect>
  <circle cx="86" cy="186" r="4" fill="#FF9FC7"></circle>
  <circle cx="120" cy="192" r="4" fill="#A8D8FF"></circle>
  <circle cx="154" cy="184" r="4" fill="#C7A9FF"></circle>
</svg>`;
}

/** Pastel placeholder shown when the sender uploads fewer photos than slots. */
function placeholderPolaroid(index) {
  const palettes = [
    ['#FFD6E8', '#FF9FC7'], ['#D6ECFF', '#A8D8FF'], ['#E6D9FF', '#C7A9FF'],
    ['#FFE8D6', '#FFC7A9'], ['#D6FFE9', '#A9FFCF'], ['#FFF3D6', '#FFDFA0'],
  ];
  const [bg, fg] = palettes[index % palettes.length];
  return `<svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true" focusable="false">
  <rect width="200" height="200" rx="14" fill="${bg}"></rect>
  <circle cx="76" cy="82" r="20" fill="${fg}" opacity="0.55"></circle>
  <path d="M 30 158 Q 66 108 96 138 Q 122 164 150 128 Q 172 104 190 128" fill="none" stroke="${fg}" stroke-width="8" stroke-linecap="round" opacity="0.7"></path>
  <path d="M 148 52 q 8 -14 16 0 q 10 -12 16 0 q 6 12 -16 26 q -22 -14 -16 -26 Z" fill="${fg}" opacity="0.8"></path>
</svg>`;
}

function safeImage(value) {
  if (typeof value !== 'string' || /[\u0000-\u0020\\]/.test(value)) return '';
  if (/^\/sau-wajah\/uploads\/[a-f0-9]{48}\.(?:webp|jpg|png)$/.test(value)) return value;
  // Demo placeholder photos (served from DATA_DIR, validated by the demo-media route).
  if (/^\/sau-wajah\/demo-media\/demo-[1-6]\.png$/.test(value)) return value;
  return '';
}

/**
 * Photo slots: the sender's uploads (if any) laid over the fixed four-slot
 * gallery of the original. Uploads fill slots 1..N in order; empty slots
 * show the pastel placeholder. The clothesline reuses the same list.
 */
function photoSlots(photos) {
  const slots = [];
  for (let i = 0; i < 4; i++) {
    const photo = photos[i];
    slots.push(photo
      ? { url: photo.url, alt: photo.alt || `A shared memory · ${i + 1}`, placeholder: false, caption: CAPTIONS[i % CAPTIONS.length] }
      : { url: '', alt: '', placeholder: true, caption: CAPTIONS[i % CAPTIONS.length] });
  }
  return slots;
}

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id })
 * @param opts     { baseUrl, isPreview }
 */
function renderSauWajah(paigaam = {}, opts = {}) {
  const d = paigaam.customer_data && typeof paigaam.customer_data === 'object' ? paigaam.customer_data : {};
  const preview = !!opts.isPreview;
  let origin = '';
  try { const url = new URL(opts.baseUrl); if (['http:', 'https:'].includes(url.protocol)) origin = url.origin; } catch { /* relative is fine */ }
  const canonical = !preview && paigaam.slug ? `${origin}/p/${encodeURIComponent(paigaam.slug)}` : '';

  const who = text(d.recipientName, DEFAULTS.recipientName);
  const sender = text(d.senderName);
  const heroTitle = text(d.heroTitle, DEFAULTS.heroTitle);
  const heroSubtitle = text(d.heroSubtitle, DEFAULTS.heroSubtitle);
  const galleryHeading = text(d.galleryHeading, DEFAULTS.galleryHeading);
  const reasonsHeading = text(d.reasonsHeading, DEFAULTS.reasonsHeading);
  const letterTitle = text(d.letterTitle, DEFAULTS.letterTitle);
  const letterBody = text(d.letterBody, DEFAULT_LETTER);
  const signature = text(d.signature, DEFAULTS.signature);

  const photos = (Array.isArray(d.photos) ? d.photos : [])
    .map(p => ({ url: safeImage(p && p.url), alt: typeof (p && p.alt) === 'string' ? p.alt.slice(0, 120) : '' }))
    .filter(p => p.url);
  const slots = photoSlots(photos);

  // The reasons list: one per line, falling back to a gentle starter set.
  const reasonItems = (d.reasons || '').split('\n').map(s => s.trim()).filter(Boolean);
  const reasons = reasonItems.length ? reasonItems : [
    'the way you laugh at your own jokes',
    'how you scrunch your nose when you smile',
    'that you always save me the last bite',
    'the little voice you use when you talk to animals',
    'how you fall asleep mid-sentence and wake up denying it',
    'that you remember the small things everyone else forgets',
    'the way you dance when nobody is watching',
    'how warm your hand always is',
    'that you believe in me louder than I doubt myself',
    'simply — that you are you',
  ];

  const title = `${who}, a hundred reasons · Paigaam`;
  const description = sender
    ? `A birthday letter, a gallery and a hundred reasons for ${who}, from ${sender}.`
    : `A birthday letter, a gallery and a hundred reasons for ${who}.`;

  /** Scene data for sauwajah.js — photos are server-verified URLs, copy is escaped at render. */
  const payload = JSON.stringify({
    photos: slots.filter(s => !s.placeholder).map(s => ({ url: s.url, alt: s.alt })),
    captions: CAPTIONS,
    music: '/sau-wajah/media/music.mp3',
  }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#FFFAF9">
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
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Quicksand:wght@500;600;700&display=swap" rel="stylesheet">
${slots.filter(s => !s.placeholder).map(s => `<link rel="preload" as="image" href="${s.url}">`).join('\n')}
<link rel="stylesheet" href="/sau-wajah/sauwajah.css">
<script src="/sau-wajah/sauwajah.js" defer></script>
</head>
<body class="sw" data-stage="hero" data-preview="${preview}">
<script type="application/json" id="swPayload">${payload}</script>
${preview ? '<div class="sw-previewbadge">Preview</div>' : ''}
<div id="swFloatingBg" aria-hidden="true"></div>

<nav class="sw-page-nav" aria-label="Scenes">
  <button type="button" data-goto="hero" class="active" aria-label="The greeting"></button>
  <button type="button" data-goto="gallery" aria-label="The gallery"></button>
  <button type="button" data-goto="reasons" aria-label="The reasons"></button>
  <button type="button" data-goto="letter" aria-label="The letter"></button>
</nav>

<!-- ------------------------------------------- scene 1 · hero -->
<section class="sw-page sw-hero" id="swHero" aria-label="The greeting">
  <div class="sw-hero__content">
    <div class="sw-gif-frame">${cakeSVG()}</div>
    <h1 class="sw-hero__title">${escape(heroTitle)} <span class="sw-hero__sparkle">💖</span></h1>
    <p class="sw-hero__subtitle">${escape(heroSubtitle)}</p>
    <button type="button" class="sw-btn" data-goto="gallery">open it &lt;3</button>
  </div>
</section>

<!-- ----------------------------------------- scene 2 · gallery -->
<section class="sw-page sw-gallery" id="swGallery" aria-label="A gallery of memories" hidden>
  <h2 class="sw-heading">${escape(galleryHeading)} <span class="sw-heart">🩷</span></h2>
  <p class="sw-sub">tap the arrows (or swipe!) to see more</p>
  <div class="sw-slideshow">
    <div class="sw-corner-deco" aria-hidden="true">
      <svg viewBox="0 0 60 60" width="44" height="44" class="sw-sparkle"><g fill="none" stroke="#C7A9FF" stroke-width="3" stroke-linecap="round"><path d="M30 8 v14 M30 38 v14 M8 30 h14 M38 30 h14"></path></g><circle cx="30" cy="30" r="5" fill="#C7A9FF"></circle></svg>
    </div>
    <div class="sw-slide-stage">
      <button type="button" class="sw-arrow" id="swPrev" aria-label="previous photo">‹</button>
      <div class="sw-photo-stage" id="swPhotoStage">
        <div class="sw-polaroid" id="swPolaroid">
          <div class="sw-photo-frame" id="swPhotoFrame"></div>
        </div>
        <div class="sw-bottom-left-deco" aria-hidden="true">
          <svg viewBox="0 0 60 60" width="34" height="34" class="sw-sparkle sw-sparkle--slow"><g fill="none" stroke="#A8D8FF" stroke-width="3" stroke-linecap="round"><path d="M30 10 v12 M30 38 v12 M10 30 h12 M38 30 h12"></path></g><circle cx="30" cy="30" r="4" fill="#A8D8FF"></circle></svg>
        </div>
      </div>
      <button type="button" class="sw-arrow" id="swNext" aria-label="next photo">›</button>
    </div>
    <p class="sw-caption" id="swCaption"></p>
    <div class="sw-dots" id="swDots"></div>
    <p class="sw-counter" id="swCounter"></p>
  </div>
  <div class="sw-page-buttons">
    <button type="button" class="sw-btn sw-btn--ghost" data-goto="hero">&lt; back</button>
    <button type="button" class="sw-btn" data-goto="reasons">keep going &lt;3</button>
  </div>
</section>

<!-- ----------------------------------------- scene 3 · reasons -->
<section class="sw-page sw-reasons" id="swReasons" aria-label="A hundred reasons" hidden>
  <h2 class="sw-heading">${escape(reasonsHeading)} <span class="sw-heart">💙</span></h2>
  <p class="sw-sub">tap a photo to see it bigger — scroll pauses itself while you read</p>
  <div class="sw-clothesline">
    <div class="sw-clothesline__rope"></div>
    <div class="sw-hanging" id="swHanging"></div>
  </div>
  <div class="sw-reasons-wrap">
    <div class="sw-reasons-corner" aria-hidden="true">
      <svg viewBox="0 0 60 60" width="38" height="38" class="sw-sparkle"><g fill="none" stroke="#FFB3D1" stroke-width="3" stroke-linecap="round"><path d="M30 8 v14 M30 38 v14 M8 30 h14 M38 30 h14"></path></g><circle cx="30" cy="30" r="5" fill="#FFB3D1"></circle></svg>
    </div>
    <div class="sw-reasons-box" id="swReasonsBox" tabindex="0" aria-label="The reasons, auto-scrolling">
      <div class="sw-reasons-gif-top" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="52" height="52"><g><ellipse cx="32" cy="34" rx="18" ry="16" fill="#FFE4EE"></ellipse><circle cx="24" cy="22" r="8" fill="#FFE4EE"></circle><circle cx="40" cy="22" r="8" fill="#FFE4EE"></circle><circle cx="24" cy="23" r="4.5" fill="#FBC6DC"></circle><circle cx="40" cy="23" r="4.5" fill="#FBC6DC"></circle><circle cx="26" cy="33" r="1.8" fill="#5B4A5A"></circle><circle cx="38" cy="33" r="1.8" fill="#5B4A5A"></circle><path d="M 29 38 Q 32 41 35 38" fill="none" stroke="#5B4A5A" stroke-width="1.4" stroke-linecap="round"></path><ellipse cx="20" cy="37" rx="3.4" ry="2.2" fill="#FFB3D1" opacity="0.6"></ellipse><ellipse cx="44" cy="37" rx="3.4" ry="2.2" fill="#FFB3D1" opacity="0.6"></ellipse></g></svg>
      </div>
      <ol class="sw-reasons-list">
        ${reasons.map(r => `<li>${escape(r)}</li>`).join('\n        ')}
      </ol>
    </div>
  </div>
  <div class="sw-page-buttons">
    <button type="button" class="sw-btn sw-btn--ghost" data-goto="gallery">&lt; back to photos</button>
    <button type="button" class="sw-btn" data-goto="letter">one last thing &lt;3</button>
  </div>
</section>

<!-- ------------------------------------------ scene 4 · letter -->
<section class="sw-page sw-letter" id="swLetter" aria-label="A birthday letter" hidden>
  <canvas id="swConfettiCanvas" aria-hidden="true"></canvas>
  <div class="sw-letter-card">
    <h2 class="sw-letter__title">${escape(letterTitle)}</h2>
    <div class="sw-celebration-frame" aria-hidden="true">
      <svg viewBox="0 0 200 130" width="180" height="117">
        <g class="sw-bear-wave">
          <ellipse cx="100" cy="120" rx="42" ry="7" fill="#5b4a5a" opacity="0.08"></ellipse>
          <circle cx="74" cy="42" r="13" fill="#FFF7EE"></circle><circle cx="74" cy="44" r="7" fill="#FFE9D6"></circle>
          <circle cx="126" cy="42" r="13" fill="#FFF7EE"></circle><circle cx="126" cy="44" r="7" fill="#FFE9D6"></circle>
          <ellipse cx="100" cy="72" rx="38" ry="32" fill="#FFF7EE"></ellipse>
          <ellipse cx="100" cy="80" rx="24" ry="19" fill="#FFFDF8"></ellipse>
          <ellipse cx="100" cy="56" rx="33" ry="30" fill="#FFF7EE"></ellipse>
          <circle cx="89" cy="52" r="2.6" fill="#5b4a5a"></circle><circle cx="111" cy="52" r="2.6" fill="#5b4a5a"></circle>
          <ellipse cx="82" cy="62" rx="6" ry="4" fill="#FFC9D6" opacity="0.7"></ellipse><ellipse cx="118" cy="62" rx="6" ry="4" fill="#FFC9D6" opacity="0.7"></ellipse>
          <path d="M 96 60 Q 100 64 104 60" fill="none" stroke="#5b4a5a" stroke-width="1.6" stroke-linecap="round"></path>
          <path d="M 100 63 Q 98 68 94 67" fill="none" stroke="#c9a98f" stroke-width="1" stroke-linecap="round"></path>
          <path d="M 100 63 Q 102 68 106 67" fill="none" stroke="#c9a98f" stroke-width="1" stroke-linecap="round"></path>
          <path d="M 66 84 Q 52 74 50 62" fill="none" stroke="#FFF7EE" stroke-width="9" stroke-linecap="round"></path>
          <circle cx="50" cy="58" r="6.5" fill="#FFF7EE"></circle>
          <ellipse cx="76" cy="92" rx="7" ry="10" fill="#FFF7EE" transform="rotate(-16 76 92)"></ellipse>
          <ellipse cx="124" cy="92" rx="7" ry="10" fill="#FFF7EE" transform="rotate(16 124 92)"></ellipse>
        </g>
        <path d="M 158 30 q 6 -12 12 0 q 8 -10 13 0 q 5 11 -13 24 q -18 -13 -12 -24 Z" fill="#FF9FC7"></path>
        <path d="M 26 78 q 4 -8 9 0 q 6 -7 9 0 q 4 8 -9 17 q -13 -9 -9 -17 Z" fill="#C7A9FF"></path>
        <g fill="#FFD6E8"><circle cx="42" cy="28" r="3"></circle><circle cx="180" cy="76" r="3"></circle><circle cx="64" cy="16" r="2.4"></circle></g>
      </svg>
    </div>
    <div class="sw-letter-box"><p id="swLetterText" data-letter="${escape(letterBody)}">${escape(letterBody)}</p></div>
    <p class="sw-signature">${escape(signature)}${sender ? ` <span class="sw-signature__name">— ${escape(sender)} 💌</span>` : ''}</p>
  </div>
  <div class="sw-page-buttons">
    <button type="button" class="sw-btn sw-btn--ghost" data-goto="reasons">&lt; back to photos</button>
  </div>
  <footer class="sw-footer">made with love, just for you 🩶 · <a href="/" target="_blank" rel="noopener">Paigaam</a></footer>
</section>

<noscript>
  <style>
    .sw-page[hidden]{ display:flex !important; position:static; }
    .sw-letter-box p{ visibility:visible; }
  </style>
</noscript>
</body>
</html>`;
}

module.exports = { renderSauWajah, DEFAULTS, DEFAULT_LETTER, CAPTIONS, safeImage, escape };
