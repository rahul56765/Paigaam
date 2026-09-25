'use strict';
/**
 * Mohar (Sealed With A Kiss) renderer.
 *
 * Emits the whole experience as server-rendered HTML — the envelope, and the
 * complete letter behind it — so it survives a failed script, a screen
 * reader or a share-preview crawler. /sealed-with-a-kiss/sealed.js only
 * toggles the open / read-again classes; the line-by-line reveal is CSS,
 * staggered by each line's --i.
 *
 * Markup and class names are the original design's, unchanged. Every piece
 * of sender text is HTML-escaped here; there is no client-side templating.
 */
const config = require('./config');
const schema = require('./schema');
const { resolve } = require('../../lib/bfday/fields');
const { escape, multiline, head, previewBadge } = require('../../lib/bfday/page');

/** First visible character(s) of the name, for the wax seal. */
function initialOf(name) {
  const first = Array.from(String(name || '').trim())[0] || '';
  return first.toLocaleUpperCase();
}

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id })
 * @param opts     { baseUrl, isPreview }
 */
function render(paigaam = {}, opts = {}) {
  const d = resolve(config, paigaam && paigaam.customer_data, schema);
  const preview = !!opts.isPreview;

  const sender = d.senderName || 'me';
  const initial = d.sealInitial || initialOf(d.senderName) || '♥';
  const lines = d.paragraphs;
  const signoffIndex = lines.length + 1;

  const title = 'Sealed With A Kiss — a letter for you · Paigaam';
  const description = d.senderName
    ? `${d.senderName} sent you a letter, sealed with a kiss. Break the seal to read it.`
    : 'A letter, sealed with a kiss. Break the seal to read it.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
${head({ paigaam, opts, title, description, themeColor: '#FBF3E4' })}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&family=Caveat:wght@400..700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/sealed-with-a-kiss/sealed.css">
<script src="/sealed-with-a-kiss/sealed.js" defer></script>
<noscript><style>
  .stage-wrap { display: none; }
  .letter-screen, .letter-screen .letter-paper, .letter-paper .salutation, .letter-paper p, .signoff {
    opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; transform: none !important; transition: none !important;
  }
  .flourish path { stroke-dashoffset: 0 !important; }
  .replay { display: none; }
</style></noscript>
</head>
<body data-preview="${preview}">
${previewBadge(opts)}
  <div class="grain" aria-hidden="true"></div>
  <div class="vignette" aria-hidden="true"></div>

  <!-- SCREEN 1 · SEALED ENVELOPE -->
  <div class="stage-wrap" id="stageWrap">
    <div class="stage">
      <button class="envelope-btn" id="envelopeBtn" type="button" aria-label="Open your letter">
        <div class="envelope-scene" id="envelopeScene">
          <div class="envelope">
            <div class="env-back"></div>
            <div class="letter-mini" aria-hidden="true"></div>
            <div class="env-front"></div>
            <div class="env-flap">
              <div class="wax-seal" aria-hidden="true" data-initial="${escape(initial)}"></div>
            </div>
          </div>
        </div>
      </button>
      <p class="sender">from <strong>${escape(sender)}</strong></p>
      <p class="hint" aria-hidden="true">tap to open</p>
    </div>
  </div>

  <!-- SCREENS 2 & 3 · THE LETTER -->
  <article class="letter-screen" id="letterScreen" aria-label="A letter from ${escape(sender)}">
    <div class="letter-paper">
      <p class="salutation" style="--i:0">${escape(d.salutation)}</p>
      <div class="letter-body">
${lines.map((line, i) => `        <p style="--i:${i + 1}">${multiline(line)}</p>`).join('\n')}
      </div>
      <div class="signoff" style="--i:${signoffIndex}">
        <svg class="flourish" viewBox="0 0 190 26" aria-hidden="true">
          <path pathLength="1" d="M4 16 C 30 4, 44 24, 68 14 S 112 4, 132 15 S 168 22, 186 9"/>
        </svg>
        <span class="forever">${escape(d.closing)}</span>
        <span class="who">${escape(d.signature)}</span>
        <p class="date-line">${d.senderName ? `${escape(d.senderName)} &nbsp;·&nbsp; ` : ''}${escape(d.dateLine)}</p>
        <button class="replay" id="replayBtn" type="button">read it again</button>
      </div>
    </div>
  </article>
</body>
</html>`;
}

module.exports = { render, initialOf };
