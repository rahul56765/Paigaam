'use strict';
/**
 * Kashf (Reasons I Love You — Scratch Edition) renderer.
 *
 * Emits the full experience as server-rendered HTML so it survives a failed
 * script, a screen reader or a share-preview crawler. The header, all card
 * content, and the finale letter are in the HTML; scratch.js only adds the
 * <canvas> overlay to each card and drives the foil mechanic.
 *
 * Markup and class names match the original design exactly. Every piece of
 * sender text is HTML-escaped here; there is no client-side templating.
 *
 * The inline SVGs (doodle rule and sparkle icon on each card) are
 * template-authored static markup — they are not sender data.
 */
const config  = require('./config');
const schema  = require('./schema');
const { resolve }                        = require('../../lib/bfday/fields');
const { escape, multiline, head, previewBadge } = require('../../lib/bfday/page');

/* Template-authored SVG decorations — not sender data, no escaping needed. */
const DOODLE_SVG =
  '<svg class="doodle" width="120" height="14" viewBox="0 0 120 14" fill="none" aria-hidden="true">' +
  '<path d="M4 9 C 24 3, 44 12, 62 7 S 100 4, 116 9" stroke="#C9A86A" stroke-width="2.4" stroke-linecap="round"/>' +
  '<path d="M14 12 C 34 8, 58 13, 88 10" stroke="#B85C48" stroke-width="1.6" stroke-linecap="round" opacity="0.55"/>' +
  '</svg>';

const SPARKLE_SVG =
  '<svg class="sparkle-icon" width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">' +
  '<path d="M11 1 L12.8 8.2 L20 10 L12.8 11.8 L11 19 L9.2 11.8 L2 10 L9.2 8.2 Z" fill="#C9A86A"/>' +
  '<path d="M18.5 15.5 L19.1 17.6 L21.2 18.2 L19.1 18.8 L18.5 20.9 L17.9 18.8 L15.8 18.2 L17.9 17.6 Z" fill="#B85C48" opacity="0.8"/>' +
  '</svg>';

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id })
 * @param opts     { baseUrl, isPreview }
 */
function render(paigaam = {}, opts = {}) {
  const d       = resolve(config, paigaam && paigaam.customer_data, schema);
  const preview = !!opts.isPreview;
  const count   = d.reasons.length;

  const title = `${count} Reasons — Scratch Edition · Paigaam`;
  const description = d.senderName
    ? `${d.senderName} made you ${count} scratch cards. Reveal every reason, one by one.`
    : `${count} scratch cards, each hiding a reason. Reveal them one by one.`;

  /* Server-render one card-section per reason. scratch.js adds the <canvas>
     overlay and attaches pointer events without touching the reason text. */
  const cardSections = d.reasons.map((reason, i) => `
    <section class="card-section">
      <div class="card">
        <div class="card-inner">
          <p class="reason"><span class="num">REASON ${i + 1} OF ${count}</span>${escape(reason)}</p>
          ${DOODLE_SVG}
          ${SPARKLE_SVG}
        </div>
        <div class="ghost">scratch me</div>
      </div>
    </section>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
${head({ paigaam, opts, title, description, themeColor: '#FBF3E4' })}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,9..144,400;1,9..144,500;1,9..144,600&family=Inter:wght@400;500;600&family=Caveat:wght@500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/scratch-reasons/scratch.css">
<script src="/scratch-reasons/scratch.js" defer></script>
<noscript><style>
  .ghost { display: none !important; }
  .card-inner { pointer-events: auto !important; }
  .reveal-all-row { display: none; }
</style></noscript>
</head>
<body data-preview="${preview}">
${previewBadge(opts)}

<div class="wrap">
  <header>
    <h1>${count} reasons.<span class="sub">scratch to find out.</span></h1>
    <div class="counter" id="counter" aria-live="polite"><b>0</b>/${count}</div>
  </header>

  <main id="cards" aria-label="Scratch cards">${cardSections}
  </main>

  <div class="reveal-all-row">
    <button class="reveal-all-btn" id="revealAllBtn" type="button">reveal all</button>
  </div>

  <section class="finale" id="finale" aria-live="polite">
    <p class="letter">${multiline(d.finaleText)}</p>
    <p class="finale-from">— ${escape(d.senderName)}</p>
    <hr class="rule">
    <button class="replay-btn" id="replayBtn" type="button">scratch them again</button>
  </section>
</div>

</body>
</html>`;
}

module.exports = { render };
