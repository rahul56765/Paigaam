'use strict';
/**
 * Valentine "Say Yes" renderer.
 *
 * Emits the whole experience as server-rendered HTML: the question, the pleas
 * and the celebration live in the document (so they survive a failed script, a
 * screen reader, or a share preview) while /valentine-say-yes/ask.js only drives
 * the two interactions — clicking "No" (which swaps the GIF, grows the Yes
 * button and escalates the plea) and clicking "Yes" (which celebrates).
 *
 * The mechanic is ported 1:1 from CodeKageHQ/Ask-out-your-Valentine: five
 * clicks of resistance, +35px of button per click, the same plea ladder. The
 * heart confetti is a hand-rolled canvas simulation (the original used the
 * canvas-confetti CDN) drawing the same heart shape at the same three scales.
 */

const escape = value => String(value == null ? '' : value)
  .replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const text = (value, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const DEFAULTS = {
  recipientName: 'you',
  question: 'Will you be my Valentine?',
  yesLabel: 'Yes',
  noLabel: 'No',
  celebration: 'Yayyy!! :3',
};

/** The plea ladder: each "No" is a little more desperate than the last. */
const PLEAS = ['No', 'Are you sure?', 'Pookie please', "Don't do this to me :(", "You're breaking my heart", "I'm gonna cry..."];

const ALT_TEXTS = [
  'Cute kitten with flowers',
  'Sad kitten looking up',
  'Kitten begging',
  'Heartbroken kitten',
  'Crying kitten',
  'Devastated kitten',
  'Happy kitten celebrating',
];

const IMAGES = [1, 2, 3, 4, 5, 6, 7].map(n => `/valentine-say-yes/media/valentine-${n}.gif`);

/** The heart path shared by the confetti and the footer flourish. */
const HEART_PATH = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

/* ------------------------------------------------------------------- page */

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id })
 * @param opts     { baseUrl, isPreview }
 */
function renderValentine(paigaam = {}, opts = {}) {
  const d = paigaam.customer_data && typeof paigaam.customer_data === 'object' ? paigaam.customer_data : {};
  const preview = !!opts.isPreview;
  let origin = '';
  try { const url = new URL(opts.baseUrl); if (['http:', 'https:'].includes(url.protocol)) origin = url.origin; } catch { /* relative is fine */ }
  const canonical = !preview && paigaam.slug ? `${origin}/p/${encodeURIComponent(paigaam.slug)}` : '';

  const who = text(d.recipientName, DEFAULTS.recipientName);
  const sender = text(d.senderName);
  const question = text(d.question, DEFAULTS.question);
  const yesLabel = text(d.yesLabel, DEFAULTS.yesLabel);
  const noLabel = text(d.noLabel, PLEAS[0]);
  const celebration = text(d.celebration, DEFAULTS.celebration);

  const title = `${question} · Paigaam`;
  const description = sender
    ? `A little question for ${who}, from ${sender}. The Yes button is waiting.`
    : `A little question for ${who}. The Yes button is waiting.`;

  /** The plea ladder, personalised — [0] is the resting label of the No button. */
  const pleas = [noLabel, ...PLEAS.slice(1)];
  const payload = escape(JSON.stringify({
    images: IMAGES,
    alts: ALT_TEXTS,
    pleas,
    yesLabel,
    question,
    celebration,
  })).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#FFD0E5">
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
<link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&family=Caveat:wght@600;700&display=swap" rel="stylesheet">
${IMAGES.map(src => `<link rel="preload" as="image" href="${src}">`).join('\n')}
<link rel="stylesheet" href="/valentine-say-yes/ask.css">
<script src="/valentine-say-yes/ask.js" defer></script>
</head>
<body class="vy" data-preview="${preview}">
<script type="application/json" id="vyPayload">${payload}</script>
${preview ? '<div class="vy-previewbadge">Preview</div>' : ''}
<canvas class="vy-confetti" id="vyConfetti" aria-hidden="true"></canvas>
<main class="vy-backdrop">
  <section class="vy-card">
    <p class="vy-topline">A little question for <b>${escape(who)}</b> <span class="vy-heartglyph" aria-hidden="true"><svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path d="${HEART_PATH}" fill="#BD1E59"></path></svg></span></p>
    <div class="vy-photo">
      <img id="vyImage" src="${IMAGES[0]}" alt="${ALT_TEXTS[0]}" width="300" height="300" draggable="false">
    </div>
    <h1 class="vy-question" id="vyQuestion">${escape(question)}</h1>
    <div class="vy-buttons" id="vyButtons">
      <button type="button" id="vyYes" class="vy-btn vy-btn--yes">${escape(yesLabel)}</button>
      <button type="button" id="vyNo" class="vy-btn vy-btn--no">${escape(noLabel)}</button>
    </div>
    <p class="vy-signature">${sender ? `— ${escape(sender)}` : ''}</p>
  </section>
</main>
<noscript>
  <style>
    .vy-buttons { display: none !important; }
    .vy-noscript { display: block !important; }
  </style>
  <p class="vy-noscript">This question needs JavaScript — enable it and the Yes button will do the rest.</p>
</noscript>
</body>
</html>`;
}

module.exports = { renderValentine, DEFAULTS, PLEAS, IMAGES, escape };
