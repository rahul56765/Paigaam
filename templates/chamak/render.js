'use strict';
/**
 * Chamak renderer.
 *
 * Emits the whole disco server-rendered — the ball stage, the name reveal,
 * the gift box, the gold-frame gallery and the wish card — so it survives a
 * failed script, a screen reader or a share-preview crawler. chamak.js only
 * adds the motion: the ball spin + dot drift (the ONLY two animated layers),
 * the letter stagger, the box pop and the foil confetti.
 *
 * Every piece of sender text is HTML-escaped here; there is no client-side
 * text templating.
 */
const config = require('./config');
const schema = require('./schema');
const { resolve } = require('../../lib/bfday/fields');
const { bgmMarkup, bgmScript } = require('../../lib/bfday/bgm');
const { escape, multiline, jsonPayload, head, previewBadge } = require('../../lib/bfday/page');

const STAMPS = ['star', 'badge', 'crown', 'heart'];

const TILTS = [-3, 2.4, -2.2, 2.8, -1.8]; // ≤3°, alternating

/** The name in gold italic, one span per letter (per-letter stagger). */
function nameLetters(name) {
  return Array.from(name).map((ch, i) =>
    ch === ' ' ? '<span class="cm-sp" aria-hidden="true">&nbsp;</span>'
      : `<span class="cm-ch" style="--i:${i}">${escape(ch)}</span>`).join('');
}

function goldFrames(photos) {
  return photos.map((p, i) => {
    const stamp = STAMPS[i % STAMPS.length];
    return `
      <figure class="cm-frame" style="--tilt:${TILTS[i % TILTS.length]}deg" role="listitem">
        <img class="cm-frame__img" src="${escape(p.photo)}" alt="${escape(p.caption || 'a party memory')}" loading="lazy" decoding="async">
        <img class="cm-frame__gold" src="/assets/chamak/gold-frame.png" alt="" aria-hidden="true" draggable="false">
        <img class="cm-frame__stamp" src="/assets/chamak/sticker-${stamp}.png" alt="" aria-hidden="true" loading="lazy" decoding="async" draggable="false">
        ${p.caption ? `<figcaption class="cm-frame__cap">${escape(p.caption)}</figcaption>` : ''}
      </figure>`;
  }).join('\n');
}

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id, … })
 * @param opts     { baseUrl, isPreview }
 */
function render(paigaam = {}, opts = {}) {
  const d = resolve(config, paigaam && paigaam.customer_data, schema);
  const preview = !!opts.isPreview;
  const name = d.recipientName || 'you';

  const title = `${d.recipientName ? `${d.recipientName}'s disco birthday` : 'Chamak — the disco birthday'} · Paigaam`;
  const description = `${d.senderName ? `${d.senderName} made ` : 'Someone made '}your night: a mirror ball, your name in gold, a gift box to pop, and photos in gold frames. Black stage, neon everything.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
${head({ paigaam, opts, title, description, themeColor: '#111111', image: (d.photos.find(p => p.photo) || {}).photo || config.ogImage })}
<link rel="stylesheet" href="/bfday/bgm.css">
<style>:root { --bgm-accent: #FF4FA3; }</style>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,9..144,900&family=Bricolage+Grotesque:opsz,wght@12..96,700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/chamak/chamak.css?v=2">
<script src="/chamak/chamak.js?v=2" defer></script>
<noscript><style>
  /* No JS: the whole night is one readable, still page. */
  .cm-stage { position: static !important; min-height: auto; }
  .cm-dots { display: none !important; }
  .cm-ch { opacity: 1 !important; transform: none !important; }
  .cm-boxline { display: none !important; }
  .cm-replay { display: none !important; }
</style></noscript>
</head>
<body data-preview="${preview}">
${previewBadge(opts)}

<main class="cm" id="cm">

  <!-- ① the ball stage: TWO animated layers only (ball spin + dot drift) -->
  <section class="cm-stage cm-stage--ball" id="ball" aria-labelledby="cmName">
    <img class="cm-ball" id="cmBall" src="/assets/chamak/disco-ball.png" alt="A chrome mirror ball, illustrated" width="1494" height="1674" draggable="false" decoding="async">
    <div class="cm-dots" id="cmDots" aria-hidden="true"></div>
    <div class="cm-name-wrap">
      <p class="cm-eyebrow">the night is yours,</p>
      <h1 class="cm-name" id="cmName" aria-label="${escape(name)}">${nameLetters(name)}</h1>
    </div>
    <div class="cm-marquee" aria-hidden="true">
      <span class="cm-marquee__track"><span>${escape(d.marqueeText || "IT'S YOUR DAY")}&nbsp;&nbsp;★&nbsp;&nbsp;</span><span>${escape(d.marqueeText || "IT'S YOUR DAY")}&nbsp;&nbsp;★&nbsp;&nbsp;</span></span>
    </div>
  </section>

  <!-- ② the gift box -->
  <section class="cm-stage cm-stage--gift" id="gift" aria-labelledby="cmBoxLine" hidden>
    <button class="cm-box-btn" id="cmBoxBtn" type="button" aria-label="Open the gift box">
      <img class="cm-box__img" id="cmBoxImg" src="/assets/chamak/gift-box-closed.png" alt="" width="1476" height="1171" draggable="false">
    </button>
    <p class="cm-boxline" id="cmBoxLine" data-line="${escape(d.boxLine || 'OPEN IT')}">${escape(d.boxLine || 'OPEN IT')}</p>
    <div class="cm-confetti" id="cmConfetti" aria-hidden="true"></div>
  </section>

  <!-- ③ the gold-frame gallery -->
  <section class="cm-stage cm-stage--gallery" id="gallery" aria-label="Party photos" hidden>
    <div class="cm-gallery">
${goldFrames(d.photos)}
    </div>
    <p class="cm-gallery__cue" aria-hidden="true">the night, in gold</p>
  </section>

  <!-- ④ the wish card -->
  <section class="cm-stage cm-stage--wish" id="wish" aria-labelledby="cmWish" hidden>
    <img class="cm-vip" src="/assets/chamak/sticker-badge.png" alt="A gold VIP badge sticker" width="773" height="772" loading="lazy" decoding="async" draggable="false">
    <div class="cm-wish">
      <h2 class="cm-wish__text" id="cmWish">${multiline(d.wishLine)}</h2>
      <p class="cm-wish__sign">— ${escape(d.senderName || 'the party crew')}</p>
    </div>
    <p class="cm-foot">Made with love on <a href="/">Paigaam</a></p>
    <button class="cm-replay" id="cmReplayBtn" type="button">Celebrate again</button>
  </section>

</main>
${bgmMarkup(d.bgmSong || '', 'the party song')}
${bgmScript(d.bgmSong || '')}
</body>
</html>`;
}

module.exports = { render, nameLetters, TILTS };
