'use strict';
/**
 * Maafi renderer.
 *
 * Emits the whole experience as server-rendered HTML: the plea, the buttons
 * and the celebration live in the document (so they survive a failed script,
 * a screen reader, or a share preview) while /maafi/maafi.js only drives the
 * two interactions — the running "No" button (which dodges, shrinks and
 * sparkles while the message ladder climbs) and the "Yes" button (which
 * celebrates).
 *
 * The mechanic is ported 1:1 from ThisWasAryan/interactive-apology-page: the
 * No button teleports to a random non-overlapping spot on every approach,
 * shrinking to a floor of 0.3; Yes grows by 1.1 + attempts*0.05 once the
 * resistance passes three; the same fifteen-message pity ladder, the same
 * attempt counter tiers, the same heart-rain celebration.
 */

const escape = value => String(value == null ? '' : value)
  .replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const text = (value, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const DEFAULTS = {
  recipientName: 'you',
  headline: 'I’m really sorry ❤️',
  yesLabel: 'Okay baby, I forgive you 💖',
  noLabel: 'No, I’m still angry 😠',
  celebration: 'Yay! You forgave me! 😍💖🥳',
};

/**
 * The pity ladder: every escaped "No" advances the plea. [0] is the sender's
 * own opening line; the rest are the template's — fixed copy, part of the
 * design. (Rendered with innerHTML by the script because several carry emoji
 * markup the original shipped; the sender's line never does — it is set with
 * textContent.)
 */
const LADDER = [
  null,
  'I promise I’ll never do it again 😢💕',
  'You mean the world to me 🌍💖',
  'I can’t stop thinking about how sorry I am 😭',
  'Please give me another chance 🙏❤️',
  'I’ll do anything to make it up to you 💝',
  'You’re the most important person to me 🥰',
  'I messed up, but I love you so much 💕😔',
  'Life isn’t the same without your smile 😢💖',
  'I promise to be better for you 🌟❤️',
  'Forgive me please? I’ll buy you ice cream 🍦💕',
  'I’m so so so sorry baby 😭❤️',
  'You deserve the world and I’ll give it to you 🌹💖',
  'Pretty please with a cherry on top? 🍒🥺',
  'I’ll never let you down again, I promise 💍❤️',
];

/* ------------------------------------------------------------------- page */

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id })
 * @param opts     { baseUrl, isPreview }
 */
function renderMaafi(paigaam = {}, opts = {}) {
  const d = paigaam.customer_data && typeof paigaam.customer_data === 'object' ? paigaam.customer_data : {};
  const preview = !!opts.isPreview;
  let origin = '';
  try { const url = new URL(opts.baseUrl); if (['http:', 'https:'].includes(url.protocol)) origin = url.origin; } catch { /* relative is fine */ }
  const canonical = !preview && paigaam.slug ? `${origin}/p/${encodeURIComponent(paigaam.slug)}` : '';

  const who = text(d.recipientName, DEFAULTS.recipientName);
  const sender = text(d.senderName);
  const headline = text(d.headline, DEFAULTS.headline);
  const yesLabel = text(d.yesLabel, DEFAULTS.yesLabel);
  const noLabel = text(d.noLabel, DEFAULTS.noLabel);
  const celebration = text(d.celebration, DEFAULTS.celebration);

  const title = `I’m Really Sorry ❤️ · Paigaam`;
  const description = sender
    ? `A little apology for ${who}, from ${sender}. The Yes button is the only way out.`
    : `A little apology for ${who}. The Yes button is the only way out.`;

  /**
   * Personalised copy. JSON inside a <script> block needs only the </script>
   * break-out neutralised (<\u002f...); HTML-escaping the whole string would
   * corrupt it, because the browser decodes entities before the script reads
   * textContent.
   */
  const payload = JSON.stringify({
    headline,
    ladder: LADDER.filter(Boolean),
    yesLabel,
    noLabel,
    celebration,
  }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#E73C7E">
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
<link rel="stylesheet" href="/maafi/maafi.css">
<script src="/maafi/maafi.js" defer></script>
</head>
<body class="mm" data-preview="${preview}">
<script type="application/json" id="mmPayload">${payload}</script>
${preview ? '<div class="mm-previewbadge">Preview</div>' : ''}
<div class="mm-bgheart" style="top:10%;left:10%;animation-delay:0s" aria-hidden="true">❤️</div>
<div class="mm-bgheart" style="top:70%;left:80%;animation-delay:2s" aria-hidden="true">💖</div>
<div class="mm-bgheart" style="top:30%;left:85%;animation-delay:4s" aria-hidden="true">💕</div>
<div class="mm-bgheart" style="top:60%;left:15%;animation-delay:6s" aria-hidden="true">💗</div>
<div class="mm-bgheart" style="top:20%;left:50%;animation-delay:8s" aria-hidden="true">💝</div>
<main class="mm-backdrop">
  <section class="mm-card">
    <p class="mm-topline">A little apology for <b>${escape(who)}</b></p>
    <h1 class="mm-text" id="mmText">${escape(headline)}</h1>
    <div class="mm-buttons" id="mmButtons">
      <button type="button" id="mmYes" class="mm-btn mm-btn--yes">${escape(yesLabel)}</button>
      <button type="button" id="mmNo" class="mm-btn mm-btn--no">${escape(noLabel)}</button>
    </div>
    <p class="mm-count" id="mmCount"></p>
    <p class="mm-emoji hidden" id="mmEmoji" aria-hidden="true"></p>
    <p class="mm-signature">${sender ? `— ${escape(sender)}` : ''}</p>
  </section>
</main>
<noscript>
  <style>
    .mm-buttons { display: none !important; }
    .mm-noscript { display: block !important; }
  </style>
  <p class="mm-noscript">This apology needs JavaScript — enable it and the Yes button will do the rest.</p>
</noscript>
</body>
</html>`;
}

module.exports = { renderMaafi, DEFAULTS, LADDER, escape };
