'use strict';
/**
 * Love Awaits renderer.
 *
 * Emits the whole experience as server-rendered HTML: the intro, the question
 * and the finale live in the document (so they survive a failed script, a
 * screen reader, or a share preview) while /love-awaits/awaits.js drives the
 * three states — tap to begin, the plea ladder, and the celebration — over a
 * canvas heart field.
 *
 * The mechanic is ported 1:1 from ft976/97 ("Love Awaits"): the same six
 * messages, the same image ladder, the same dodge-the-button finale, the same
 * "tap anywhere to begin" gate and the same permanent-acceptance localStorage.
 * The three.js particle heart is re-expressed as a hand-rolled canvas 2D
 * simulation of the same size (7,000 points condensing from a scatter into
 * the same parametric heart curve), and GSAP's particle burst becomes a
 * canvas confetti of the same 100 particles. The copyrighted MP3 soundtrack
 * is replaced with a generative Web Audio score (lib/loveAwaitsAudio inline).
 */

const escape = value => String(value == null ? '' : value)
  .replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const text = (value, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const DEFAULTS = {
  recipientName: 'you',
  senderName: '',
  introTitle: 'Love Awaits',
  question: 'Will You Be My Forever?',
  questionNote: 'In a universe of billions, my heart chose you. You are my clarity in chaos. Will you walk this life with me?',
  yesLabel: 'Yes, Forever',
  noLabel: 'No',
  finaleTitle: 'Forever & Always',
  finaleLine: 'You are my today and all of my tomorrows.',
};

/** The plea ladder — messages[0] is the question, the rest escalate per "No". */
const MESSAGES = [
  { t: 'Will You Be My Forever?', s: 'In a universe of billions, my heart chose you. You are my clarity in chaos. Will you walk this life with me?' },
  { t: 'Wait... Really? 🥺', s: 'Is this real? My heart skipped a beat when you hesitated. Please don’t close the book on us.' },
  { t: 'Don’t Break My Heart 💔', s: 'I promise laughter, strength, and a love that never fades. Please, give us a chance to shine.' },
  { t: 'I’m Pleading With You 🙏', s: 'I will cross oceans just to see you smile. You are the only one I want, today and always.' },
  { t: 'Please... Don’t Do This 😭', s: 'This silence is deafening. We are two halves of the same whole. Tell me you feel it too!' },
  { t: 'LAST CHANCE! 🌹', s: 'Destiny brought us here. I am fighting for us because we are rare and magical. Say YES! 💖' },
];

/** The image ladder — [0] the opener, then one reaction per "No", last is success. */
const IMAGES = [1, 2, 3, 4, 5, 6, 7].map(n => `/love-awaits/media/loveawaits-${n}.${n === 1 ? 'gif' : 'webp'}`);

const ALT_TEXTS = [
  'A comic: a small cat asking “do u like me?”',
  'A cat hiding its face, heartbroken',
  'A cat pleading with paws together',
  'A very grumpy, unimpressed cat',
  'An angry cartoon cat holding a knife',
  'A cat holding a tiny golden gun',
  'A cat blowing a kiss — MWAH',
];

/* ------------------------------------------------------------------- page */

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id })
 * @param opts     { baseUrl, isPreview }
 */
function renderAwaits(paigaam = {}, opts = {}) {
  const d = paigaam.customer_data && typeof paigaam.customer_data === 'object' ? paigaam.customer_data : {};
  const preview = !!opts.isPreview;
  let origin = '';
  try { const url = new URL(opts.baseUrl); if (['http:', 'https:'].includes(url.protocol)) origin = url.origin; } catch { /* relative is fine */ }
  const canonical = !preview && paigaam.slug ? `${origin}/p/${encodeURIComponent(paigaam.slug)}` : '';

  const who = text(d.recipientName, DEFAULTS.recipientName);
  const sender = text(d.senderName);
  const introTitle = text(d.introTitle, DEFAULTS.introTitle);
  const yesLabel = text(d.yesLabel, DEFAULTS.yesLabel);
  const noLabel = text(d.noLabel, DEFAULTS.noLabel);
  const finaleTitle = text(d.finaleTitle, DEFAULTS.finaleTitle);
  const finaleLine = text(d.finaleLine, DEFAULTS.finaleLine);

  // The ladder's first rung is the personalised question + note; the rest are
  // the template's own escalation (they are the experience).
  const question = text(d.question, MESSAGES[0].t);
  const questionNote = text(d.questionNote, MESSAGES[0].s);
  const ladder = [
    { t: question, s: questionNote },
    ...MESSAGES.slice(1).map(m => ({ t: m.t, s: m.s })),
  ];

  const title = `${question} · Paigaam`;
  const description = sender
    ? `A question waiting for ${who}, from ${sender}. Tap to begin.`
    : `A question waiting for ${who}. Tap to begin.`;

  /**
   * The full client payload — ladder, images, labels, finale.
   * JSON inside a <script> block needs only the </script> break-out neutralised
   * (<\u003c...); HTML-escaping the whole string would corrupt it, because the
   * browser decodes entities before the script reads textContent.
   */
  const payload = JSON.stringify({
    who,
    sender,
    introTitle,
    ladder,
    images: IMAGES,
    alts: ALT_TEXTS,
    yesLabel,
    noLabel,
    finaleTitle,
    finaleLine,
  }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#020202">
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
${preview ? '<meta name="robots" content="noindex, nofollow, noarchive">' : canonical ? `<link rel="canonical" href="${escape(canonical)}">` : ''}
<meta property="og:type" content="website">
<meta property="og:title" content="A Surprise For You 💖">
<meta property="og:description" content="${escape(description)}">
${canonical ? `<meta property="og:url" content="${escape(canonical)}">` : ''}
${origin ? `<meta property="og:image" content="${escape(origin)}/brand/favicon-512.png">` : ''}
<meta name="twitter:card" content="summary">
<link rel="icon" href="/brand/favicon-512.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,500;1,700&family=Dancing+Script:wght@600;700&family=Outfit:wght@300;400;500&display=swap" rel="stylesheet">
${IMAGES.map(src => `<link rel="preload" as="image" href="${src}">`).join('\n')}
<link rel="stylesheet" href="/love-awaits/awaits.css">
<script src="/love-awaits/awaits.js" defer></script>
</head>
<body class="law" data-preview="${preview}">
<script type="application/json" id="lawPayload">${payload}</script>
${preview ? '<div class="law-previewbadge">Preview</div>' : ''}
<canvas id="lawHeart" aria-hidden="true"></canvas>
<div id="lawDecor" aria-hidden="true"></div>
<noscript>
  <style>.law-gate,.law-buttons{display:none!important}.law-noscript{display:block!important}</style>
  <p class="law-noscript">This question needs JavaScript — enable it and the stars will do the rest.</p>
</noscript>

<!-- the opening gate: tap anywhere to begin (the audio-unlock gesture) -->
<main class="law-stage" id="lawGate">
  <h1 class="law-title law-gate">${escape(introTitle)}</h1>
  <p class="law-gate-hint law-gate">Tap to Begin Our Story</p>
</main>

<!-- the question -->
<main class="law-stage" id="lawAsking" hidden>
  <section class="law-card">
    <h1 class="law-question" id="lawMsgTitle">${escape(question)}</h1>
    <p class="law-note"><span id="lawMsgNote">${escape(questionNote)}</span></p>
    <div class="law-photo">
      <span class="law-tape" aria-hidden="true"></span>
      <img id="lawImage" src="${IMAGES[0]}" alt="${ALT_TEXTS[0]}" width="300" height="300" draggable="false">
    </div>
    <div class="law-buttons" id="lawButtons">
      <button type="button" id="lawYes" class="law-btn law-btn--yes">${escape(yesLabel)}</button>
      <button type="button" id="lawNo" class="law-btn law-btn--no">${escape(noLabel)}</button>
    </div>
    <p class="law-signature">${sender ? `— ${escape(sender)}${who ? `, for ${escape(who)}` : ''}` : ''}</p>
  </section>
</main>

<!-- the celebration -->
<main class="law-stage" id="lawSuccess" hidden>
  <section class="law-card law-card--finale">
    <h1 class="law-finale-title">${escape(finaleTitle)}</h1>
    <div class="law-photo law-photo--polaroid">
      <span class="law-tape" aria-hidden="true"></span>
      <img src="${IMAGES[IMAGES.length - 1]}" alt="${ALT_TEXTS[ALT_TEXTS.length - 1]}" width="300" height="300" draggable="false">
    </div>
    <p class="law-finale-line">“${escape(finaleLine)}”</p>
    <button type="button" id="lawReplay" class="law-replay">↺ Replay Memory</button>
  </section>
</main>

<canvas id="lawConfetti" aria-hidden="true"></canvas>
</body>
</html>`;
}

module.exports = { renderAwaits, DEFAULTS, MESSAGES, IMAGES, ALT_TEXTS, escape };
