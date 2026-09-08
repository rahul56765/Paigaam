'use strict';
/**
 * Love Album renderer.
 *
 * Emits the whole experience as server-rendered HTML: the intro copy, the
 * card data (photos + hidden messages) and the final letter live in the
 * document while /love-album/album.js only drives the interactions —
 * dragging/flipping cards, the reveal threshold and the letter modal.
 *
 * Ported from ziddi-shop/love-you (MIT). The mechanic is 1:1: cards scatter
 * with random rotations, drag them and they tilt in 3D, pass 90° and they
 * flip to their back, touch any card and it counts as "read"; once 70% of
 * cards are read the final button appears, opening a letter over an
 * overlay. Differences, all deliberate: the "gif" cards of the original
 * pointed at a dead placeholder service and became message cards; GSAP and
 * Tailwind were replaced with vanilla CSS/JS; "Ziddi" branding became
 * Paigaam; every piece of copy is personalisable; the heart cursor trail
 * is gone (it fought with touch screens).
 */

const escape = value => String(value == null ? '' : value)
  .replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const text = (value, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const DEFAULTS = {
  recipientName: 'Pookie',
  introLine: 'Hey Pookie, I made something special just for you! 💫💕\nA little surprise is waiting—wrapped in love and magic.\nAre you ready to step into a world full of smiles and memories?',
  continueLabel: "Let's Go!",
  message1: 'You make my heart smile every day! ❤️',
  message2: 'I love the way your eyes crinkle when you laugh! 😊',
  message3: 'Every moment with you is a gift I cherish! 💝',
  letterTitle: 'To My Dearest',
  letterBody: "Thank you for being the most incredible person in my world. Every moment with you is a treasure, and I'm so grateful to share this journey with you. I love you more than words can express, and I always will. Here's to creating countless more beautiful memories together!",
  finalLabel: 'One last thing for you! 💕 Click here!',
};

/** Same heart path the original used everywhere. */
const HEART_PATH = 'M50,88.9C29.9,73.2,16.2,59.1,9.3,47C2.5,35.1,3.5,26.6,12.4,20.8c8-5.2,15.2-4.4,21.6,2.4c3.5,3.7,6.3,8.7,8.4,15c0.6,1.9,1.1,3.2,1.5,3.9c0.4,0.6,0.9,0.9,1.4,0.9c0.5,0,1-0.3,1.3-0.9c0.4-0.6,0.9-1.9,1.5-3.9c2.1-6.3,4.9-11.3,8.4-15c6.4-6.8,13.6-7.6,21.6-2.4c8.9,5.8,10,14.3,3.2,26.3C74.4,59.1,60.7,73.2,50,88.9z';

function safeImage(value) {
  if (typeof value !== 'string' || /[\u0000-\u0020\\]/.test(value)) return '';
  if (/^\/love-album\/uploads\/[a-f0-9]{48}\.(?:webp|jpg|png)$/.test(value)) return value;
  // Demo placeholder photos (served from DATA_DIR, validated by the demo-media route).
  if (/^\/love-album\/demo-media\/demo-[1-6]\.jpg$/.test(value)) return value;
  return '';
}

/**
 * Build the deck: photos interleaved with the three message cards.
 * With N photos and 3 messages the deck is N+3 cards. The first card is
 * always a photo, the messages are spread through the middle, and the last
 * card is a photo whenever N ≥ 2 (the original opened and closed with
 * photos too).
 */
function buildDeck(photos, d) {
  const messages = [text(d.message1, DEFAULTS.message1), text(d.message2, DEFAULTS.message2), text(d.message3, DEFAULTS.message3)];
  const deck = [];
  const gap = Math.max(1, Math.floor((photos.length - 1) / 3)); // photos per gap
  let m = 0;
  photos.forEach((photo, index) => {
    deck.push({ type: 'photo', url: photo.url, alt: text(photo.alt, `A shared memory · ${index + 1}`) });
    const afterPhoto = index + 1;
    if (m < messages.length && index > 0 && afterPhoto < photos.length && afterPhoto % gap === 0) {
      deck.push({ type: 'message', message: messages[m++] });
    }
  });
  // Anything left over lands between the last two photos.
  while (m < messages.length && deck.length > 1) {
    deck.splice(deck.length - 1, 0, { type: 'message', message: messages[m++] });
  }
  return deck;
}

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id })
 * @param opts     { baseUrl, isPreview }
 */
function renderAlbum(paigaam = {}, opts = {}) {
  const d = paigaam.customer_data && typeof paigaam.customer_data === 'object' ? paigaam.customer_data : {};
  const preview = !!opts.isPreview;
  let origin = '';
  try { const url = new URL(opts.baseUrl); if (['http:', 'https:'].includes(url.protocol)) origin = url.origin; } catch { /* relative is fine */ }
  const canonical = !preview && paigaam.slug ? `${origin}/p/${encodeURIComponent(paigaam.slug)}` : '';

  const who = text(d.recipientName, DEFAULTS.recipientName);
  const sender = text(d.senderName);
  const intro = text(d.introLine, DEFAULTS.introLine);
  const continueLabel = text(d.continueLabel, DEFAULTS.continueLabel);
  const letterTitle = text(d.letterTitle, DEFAULTS.letterTitle);
  const letterBody = text(d.letterBody, DEFAULTS.letterBody);
  const finalLabel = text(d.finalLabel, DEFAULTS.finalLabel);

  const photos = (Array.isArray(d.photos) ? d.photos : []).map(p => ({ url: safeImage(p && p.url), alt: typeof (p && p.alt) === 'string' ? p.alt.slice(0, 120) : '' })).filter(p => p.url);
  const deck = buildDeck(photos, d);

  const title = `${who}, a little world for you · Paigaam`;
  const description = sender
    ? `A little gallery of shared memories for ${who}, from ${sender}. Drag the cards — some hide messages.`
    : `A little gallery of shared memories for ${who}. Drag the cards — some hide messages.`;

  /** Deck data for album.js — photos are server-verified URLs, copy is escaped at render. */
  const payload = JSON.stringify({ deck, letterTitle, letterBody, sender, revealAt: 0.7 }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#FFD1E5">
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
<link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500;700&family=Montserrat:wght@400;500&display=swap" rel="stylesheet">
${photos.map(p => `<link rel="preload" as="image" href="${p.url}">`).join('\n')}
<link rel="stylesheet" href="/love-album/album.css">
<script src="/love-album/album.js" defer></script>
</head>
<body class="la" data-stage="intro" data-preview="${preview}">
<script type="application/json" id="laPayload">${payload}</script>
${preview ? '<div class="la-previewbadge">Preview</div>' : ''}

<!-- ------------------------------------------------- stage 1 · intro -->
<section class="la-intro" id="laIntro" aria-label="A little introduction">
  <div class="la-intro__hearts" aria-hidden="true" id="laIntroHearts"></div>
  <div class="la-intro__card">
    <h1 class="la-intro__text">${escape(intro).replace(/\n/g, '<br>')}</h1>
    <button type="button" class="la-btn" id="laContinue">${escape(continueLabel)}</button>
    ${sender ? `<p class="la-intro__sig">💖 Made with love by ${escape(sender)} 💖</p>` : ''}
  </div>
</section>

<!-- ----------------------------------------------- stage 2 · gallery -->
<section class="la-gallery" id="laGallery" aria-label="A gallery of memories" hidden>
  <header class="la-gallery__heading">
    <h1>✨ ${escape(who)}’s world ✨</h1>
    <p>Drag a card to spin it — slide it far enough and it flips. Some backs hide little notes.</p>
  </header>
  <div class="la-deck" id="laDeck" role="group" aria-label="Draggable photo cards"></div>
  <div class="la-final" id="laFinal" hidden>
    <button type="button" class="la-btn" id="laFinalBtn">${escape(finalLabel)}</button>
  </div>
</section>

<!-- --------------------------------------------- letter modal (shared) -->
<dialog class="la-letter" id="laLetter" aria-labelledby="laLetterTitle">
  <div class="la-letter__hearts" aria-hidden="true">
    ${'<span>❤️</span><span>💖</span><span>💕</span><span>💓</span><span>💗</span><span>💘</span>'}
  </div>
  <h2 id="laLetterTitle">${escape(letterTitle)}</h2>
  <p>${escape(letterBody)}</p>
  <button type="button" class="la-btn" id="laLetterClose">Close with love</button>
</dialog>

<noscript><style>.la-intro__card{opacity:1!important;transform:none!important}</style></noscript>
</body>
</html>`;
}

module.exports = { renderAlbum, DEFAULTS, buildDeck, safeImage, escape };
