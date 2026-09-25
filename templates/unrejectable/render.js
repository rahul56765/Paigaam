'use strict';
/**
 * Lajja (The Unrejectable Card) renderer.
 *
 * Emits the full experience as server-rendered HTML — the question screen
 * and the celebration screen, both fully populated from the sender's data.
 * The No-button dodge mechanic lives entirely in public/unrejectable/
 * unrejectable.js. The renderer injects one small JSON payload (the give-up
 * caption) that the script needs to set dynamically.
 *
 * All sender text is HTML-escaped here; there is no client-side templating.
 * The arch shows the sender's uploaded photo when provided, or the original
 * inline-SVG heart illustration when blank.
 */
const config = require('./config');
const schema = require('./schema');
const { resolve } = require('../../lib/bfday/fields');
const { bgmMarkup, bgmScript } = require('../../lib/bfday/bgm');
const { escape, multiline, jsonPayload, head, previewBadge } = require('../../lib/bfday/page');

/* ---- SVG defs shared between both arches ---- */
const SVG_DEFS = `<defs>
          <linearGradient id="ucBgGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#F7DDD3"/>
            <stop offset="1" stop-color="#F2C4BC"/>
          </linearGradient>
          <linearGradient id="ucHeartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#B85C48"/>
            <stop offset="1" stop-color="#C9A86A"/>
          </linearGradient>
        </defs>`;

/* ---- SVG placeholder for the ask screen (two hearts) ---- */
const SVG_ASK = `<svg viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Arch illustration">
        ${SVG_DEFS}
        <rect width="300" height="400" fill="url(#ucBgGrad)"/>
        <path d="M118 170c-16-14-42-8-46 12-4 22 22 44 46 62 24-18 50-40 46-62-4-20-30-26-46-12z"
              fill="url(#ucHeartGrad)" opacity="0.9"/>
        <path d="M182 210c-12-10-30-6-33 9-3 16 16 32 33 45 17-13 36-29 33-45-3-15-21-19-33-9z"
              fill="#2B2118" opacity="0.85"/>
        <text x="150" y="360" text-anchor="middle"
              font-family="Caveat, cursive" font-size="24" fill="#2B2118" opacity="0.55">your photo here</text>
      </svg>`;

/* ---- SVG placeholder for the celebrate screen (big heart) ---- */
const SVG_CELEBRATE = `<svg viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Arch illustration">
        ${SVG_DEFS}
        <rect width="300" height="400" fill="url(#ucBgGrad)"/>
        <path d="M150 150c-24-21-63-12-69 18-6 33 33 66 69 93 36-27 75-60 69-93-6-30-45-39-69-18z"
              fill="url(#ucHeartGrad)" class="uc-heart"/>
        <text x="150" y="360" text-anchor="middle"
              font-family="Caveat, cursive" font-size="24" fill="#2B2118" opacity="0.55">your photo here</text>
      </svg>`;

/**
 * Returns the arch content — photo if provided, inline SVG otherwise.
 * @param {string} photo  validated upload path or ''
 * @param {string} alt    alt text for the img
 * @param {boolean} isCelebrate  which placeholder SVG to show
 */
function archInner(photo, alt, isCelebrate) {
  if (photo) {
    return `<img src="${escape(photo)}" alt="${escape(alt)}" style="width:100%;height:100%;object-fit:cover;display:block;">`;
  }
  return isCelebrate ? SVG_CELEBRATE : SVG_ASK;
}

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id })
 * @param opts     { baseUrl, isPreview }
 */
function render(paigaam = {}, opts = {}) {
  const d = resolve(config, paigaam && paigaam.customer_data, schema);
  const bgm = d.bgmSong || '';
  const preview = !!opts.isPreview;

  const photoAlt = d.senderName ? `Photo from ${d.senderName}` : 'Our photo';

  const title = 'The Unrejectable Card — for you · Paigaam';
  const description = d.senderName
    ? `${d.senderName} has a question. The No button is very shy.`
    : 'A question, and a No button that really doesn\'t want to be pressed.';

  const ogImage = d.photo || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
${head({ paigaam, opts, title, description, themeColor: '#FFFDF8', image: ogImage })}
<link rel="stylesheet" href="/bfday/bgm.css">
<style>:root { --bgm-accent: #B85C48; }</style>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,900&family=Caveat:wght@600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/unrejectable/unrejectable.css">
<script src="/unrejectable/unrejectable.js" defer></script>
</head>
<body data-preview="${preview}">
${previewBadge(opts)}
${jsonPayload('ucPayload', { giveUpCaption: d.giveUpCaption })}

<main class="uc-card">
  <!-- ============ QUESTION SCREEN ============ -->
  <section id="ucAskScreen">
    <div class="uc-arch" aria-hidden="true">
      ${archInner(d.photo, photoAlt, false)}
    </div>

    <h1 class="uc-question" id="ucQuestionBlock">${escape(d.question)}</h1>

    <div class="uc-buttons" id="ucButtonRow">
      <button id="ucYesBtn" class="uc-yes" type="button">${escape(d.yesLabel)}</button>
      <div class="uc-no-wrap" id="ucNoWrap">
        <button id="ucNoBtn" class="uc-no" type="button" aria-describedby="ucNoCaption">${escape(d.noLabel)}</button>
        <span class="uc-caption" id="ucNoCaption">${escape(d.noLabel.toLowerCase())}</span>
      </div>
    </div>

    <p class="uc-no-message" id="ucNoMessage" hidden>${escape(d.noMessage)}</p>

    <p class="uc-share-hint">${escape(d.shareHint)}</p>
  </section>

  <!-- ============ CELEBRATION SCREEN ============ -->
  <section id="ucCelebrateScreen" hidden>
    <div class="uc-arch" aria-hidden="true">
      ${archInner(d.photo, photoAlt, true)}
    </div>

    <h1 class="uc-headline">${escape(d.celebHeadline)} <span class="uc-heart" aria-hidden="true">❤️</span></h1>

    <p class="uc-celebrate-msg">${multiline(d.celebMessage)}</p>

    <p class="uc-celebrate-hint">${escape(d.shareHint)}</p>
  </section>
</main>

<canvas id="ucConfetti" aria-hidden="true"></canvas>
${bgmMarkup(bgm, 'our song')}
${bgmScript(bgm)}
</body>
</html>`;
}

module.exports = { render };
