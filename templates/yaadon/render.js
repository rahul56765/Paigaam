'use strict';
/**
 * Yaadon renderer.
 *
 * Emits the whole scrapbook server-rendered — the kraft cover, the title
 * spread, every polaroid page (photos AND captions), the reason strips and
 * the final letter — so it survives a failed script, a screen reader or a
 * share-preview crawler. yaadon.js only adds the motion: the seal lift, the
 * book flip, the peel mechanic and the page walking.
 *
 * The book is built as spreads: on capable devices the flip is a 3D transform;
 * on low-end Android (device-memory / no-3D-transform heuristics) the spreads
 * lay out as a horizontal scroll-snap strip — same content, no transform
 * budget (Director's ruling: verify on a slow-device profile, not a throttle).
 *
 * Every piece of sender text is HTML-escaped here; there is no client-side
 * text templating. Reason text is server-rendered under the peel strips.
 */
const config = require('./config');
const schema = require('./schema');
const { resolve } = require('../../lib/bfday/fields');
const { bgmMarkup, bgmScript } = require('../../lib/bfday/bgm');
const { escape, multiline, jsonPayload, head, previewBadge } = require('../../lib/bfday/page');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** YYYY-MM-DD → "3 October 2026", or ''. */
function humanDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  return `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}`;
}

/** Polaroid tilt: ≤3°, alternating direction per page (Director's ruling). */
const TILTS = [2.4, -2.2, 2.8, -1.8, 2.2, -2.6];

const WASHI = ['pink-hearts', 'sage-dashes', 'cream-script', 'terracotta-dots'];
const DOODLES = ['arrow', 'heart', 'note', 'sparkle', 'swirl'];
const FLOWERS = ['daisy', 'babysbreath', 'fern'];
const STICKERS = ['ticket', 'stamp', 'paperclip'];

function polaroidPages(photos) {
  return photos.map((p, i) => {
    const tilt = TILTS[i % TILTS.length];
    const washi = WASHI[i % WASHI.length];
    return `
      <figure class="yd-page" style="--tilt:${tilt}deg" role="listitem">
        <div class="yd-polaroid">
          ${p.photo
            ? `<img class="yd-polaroid__img" src="${escape(p.photo)}" alt="${escape(p.caption || 'a scrapbook memory')}" loading="lazy" decoding="async">`
            : '<div class="yd-polaroid__ph" aria-hidden="true"><span>♥</span></div>'}
          <img class="yd-polaroid__frame" src="/assets/yaadon/polaroid-frame.png" alt="" aria-hidden="true" draggable="false">
          <img class="yd-polaroid__tape" src="/assets/yaadon/washi-${washi}.png" alt="" aria-hidden="true" draggable="false">
        </div>
        ${p.caption ? `<figcaption class="yd-page__cap">${escape(p.caption)}</figcaption>` : ''}
      </figure>`;
  }).join('\n');
}

function reasonStrips(reasons) {
  return reasons.map((r, i) => `
      <div class="yd-strip" data-reason="${i}">
        <p class="yd-strip__text">${escape(r)}</p>
        <span class="yd-strip__peel" aria-hidden="true"></span>
        <span class="yd-strip__hint" aria-hidden="true">peel</span>
      </div>`).join('\n');
}

function scatteredDoodles() {
  return DOODLES.map((name, i) =>
    `<img class="yd-doodle yd-doodle--${i}" src="/assets/yaadon/doodle-${name}.png" alt="" aria-hidden="true" loading="lazy" decoding="async" draggable="false">`).join('\n  ');
}

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id, … })
 * @param opts     { baseUrl, isPreview }
 */
function render(paigaam = {}, opts = {}) {
  const d = resolve(config, paigaam && paigaam.customer_data, schema);
  const preview = !!opts.isPreview;
  const name = d.recipientName || 'you';
  const date = humanDate(d.scrapbookDate);

  const title = `${d.recipientName ? `A scrapbook for ${d.recipientName}` : 'Yaadon — a memory scrapbook'} · Paigaam`;
  const description = `${d.senderName ? `${d.senderName} made ` : 'Someone made '}you a scrapbook: polaroids, pressed flowers, reasons under peel-strips, and a letter on lined paper. Open slowly.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
${head({ paigaam, opts, title, description, themeColor: '#F5EEE3', image: (d.photos.find(p => p.photo) || {}).photo || config.ogImage })}
<link rel="stylesheet" href="/bfday/bgm.css">
<style>:root { --bgm-accent: #9A5B4D; }</style>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;1,9..144,600&family=Caveat:wght@600;700&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/yaadon/yaadon.css?v=1">
<script src="/yaadon/yaadon.js?v=1" defer></script>
<noscript><style>
  /* No JS: the whole book is one readable, still page. */
  .yd-cover { display: none !important; }
  .yd-book, .yd-spread { position: static !important; opacity: 1 !important; transform: none !important; min-height: auto; }
  .yd-strip { position: static; }
  .yd-strip__peel, .yd-strip__hint { display: none !important; }
  .yd-strip__text { opacity: 1 !important; }
  .yd-replay { display: none !important; }
</style></noscript>
</head>
<body data-preview="${preview}">
${previewBadge(opts)}
${jsonPayload('ydData', { preview })}

<main class="yd" id="yd">

  <!-- ① the kraft cover: seal, washi corner, "open slowly" -->
  <section class="yd-cover" id="ydCover" aria-labelledby="ydCoverLine">
    ${scatteredDoodles()}
    <div class="yd-cover__inner">
      <button class="yd-seal-btn" id="ydSealBtn" type="button" aria-label="Lift the wax seal and open the scrapbook">
        <img class="yd-seal" src="/assets/yaadon/wax-seal.png" alt="" width="519" height="511" draggable="false">
        <span class="yd-seal-btn__hint" aria-hidden="true">tap to open</span>
      </button>
      <p class="yd-cover__line" id="ydCoverLine">${escape(d.coverLine || 'For you — open slowly.')}</p>
      <p class="yd-cover__for">for <strong>${escape(name)}</strong></p>
    </div>
  </section>

  <!-- the book: title spread → polaroid pages → reasons → letter -->
  <div class="yd-book" id="ydBook" hidden>

    <!-- ② the title spread -->
    <section class="yd-spread yd-spread--title" id="ydTitle" aria-labelledby="ydTitleH">
      <img class="yd-title__flower yd-title__flower--daisy" src="/assets/yaadon/flower-daisy.png" alt="" aria-hidden="true" loading="lazy" decoding="async" draggable="false">
      <img class="yd-title__flower yd-title__flower--fern" src="/assets/yaadon/flower-fern.png" alt="" aria-hidden="true" loading="lazy" decoding="async" draggable="false">
      <div class="yd-title__inner">
        <p class="yd-title__eyebrow">a scrapbook of small hours</p>
        <h1 class="yd-title__h" id="ydTitleH">${escape(name)}</h1>
        ${date ? `<p class="yd-title__date">${escape(date)}</p>` : ''}
        <img class="yd-title__tape" src="/assets/yaadon/washi-cream-script.png" alt="" aria-hidden="true" draggable="false">
        <p class="yd-title__cue" aria-hidden="true">keep going →</p>
      </div>
    </section>

    <!-- ③ the polaroid pages -->
    <section class="yd-spread yd-spread--pages" id="ydPages" aria-label="Scrapbook pages">
      <img class="yd-pages__flower yd-pages__flower--babysbreath" src="/assets/yaadon/flower-babysbreath.png" alt="" aria-hidden="true" loading="lazy" decoding="async" draggable="false">
      <img class="yd-pages__sticker" src="/assets/yaadon/sticker-${STICKERS[0]}.png" alt="" aria-hidden="true" loading="lazy" decoding="async" draggable="false">
      <div class="yd-pages" id="ydPagesTrack" role="list">
${polaroidPages(d.photos)}
      </div>
      <div class="yd-dots" id="ydDots" aria-hidden="true"></div>
      <p class="yd-pages__cue" aria-hidden="true">swipe through the pages</p>
    </section>

    <!-- ④ the reasons: peel-strips, Kashf pattern -->
    <section class="yd-spread yd-spread--reasons" id="ydReasons" aria-labelledby="ydReasonsH">
      <img class="yd-reasons__sticker" src="/assets/yaadon/sticker-${STICKERS[1]}.png" alt="" aria-hidden="true" loading="lazy" decoding="async" draggable="false">
      <img class="yd-reasons__flower" src="/assets/yaadon/flower-${FLOWERS[2]}.png" alt="" aria-hidden="true" loading="lazy" decoding="async" draggable="false">
      <h2 class="yd-reasons__h" id="ydReasonsH">a few things,<br>under the paper</h2>
      <div class="yd-strips">
${reasonStrips(d.reasons)}
      </div>
      <p class="yd-reasons__cue" id="ydReasonsCue" aria-hidden="true">peel each strip — gently</p>
      <button class="yd-reveal-all" id="ydRevealAllBtn" type="button" hidden>peel them all</button>
    </section>

    <!-- ⑤ the letter on lined paper -->
    <section class="yd-spread yd-spread--letter" id="ydLetter" aria-labelledby="ydLetterH" hidden>
      <img class="yd-letter__sticker" src="/assets/yaadon/sticker-${STICKERS[2]}.png" alt="" aria-hidden="true" loading="lazy" decoding="async" draggable="false">
      <div class="yd-letter__paper">
        <h2 class="yd-visuallyhidden" id="ydLetterH">A letter</h2>
        <article class="yd-letter">
          <p class="yd-letter__to">Dear ${escape(name)},</p>
          ${String(d.letterText || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(p => `<p>${multiline(p)}</p>`).join('\n          ')}
          ${d.signoff ? `<p class="yd-letter__signoff">${escape(d.signoff)}</p>` : ''}
          ${d.senderName ? `<p class="yd-letter__name">${escape(d.senderName)}</p>` : ''}
        </article>
        <p class="yd-foot">Made with love on <a href="/">Paigaam</a></p>
        <button class="yd-replay" id="ydReplayBtn" type="button">Read it again</button>
      </div>
    </section>

  </div>

</main>
${bgmMarkup(d.bgmSong || '', 'the scrapbook song')}
${bgmScript(d.bgmSong || '')}
</body>
</html>`;
}

module.exports = { render, humanDate, TILTS };
