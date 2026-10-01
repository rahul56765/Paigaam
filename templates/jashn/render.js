'use strict';
/**
 * Jashn renderer.
 *
 * Emits the whole ceremony server-rendered — the intro beat, the cake with
 * its candles, the blow stage, the photo reel and the letter — so it survives
 * a failed script, a screen reader or a share-preview crawler. jashn.js only
 * adds the motion: the beat walk, the candle blow (mic with a visible tap
 * fallback), the confetti and the reel drift.
 *
 * Candle count comes from the sender's age field: 1–9 candles are rendered
 * as individual flames; above 9 the cake shows a fixed "9+" candle set
 * (Director's ruling — never an infinity joke). A blank age renders the cake
 * with a single hero candle so the blow beat always has something to blow.
 *
 * Every piece of sender text is HTML-escaped here; there is no client-side
 * text templating.
 */
const config = require('./config');
const schema = require('./schema');
const { resolve } = require('../../lib/bfday/fields');
const { bgmMarkup, bgmScript } = require('../../lib/bfday/bgm');
const { escape, multiline, jsonPayload, head, previewBadge } = require('../../lib/bfday/page');

const SPRINKLES = ['star-pink', 'heart-sage', 'bow-cream', 'moon-gold', 'spiral-pink'];

/** Candle plan: individual flames up to 9, then the fixed "9+" set. */
function candlePlan(age) {
  const n = Number(age);
  if (!Number.isInteger(n) || n < 1) return { count: 1, plus: false }; // blank/invalid → one hero candle
  if (n <= 9) return { count: n, plus: false };
  return { count: 9, plus: true };
}

function candles(plan) {
  const flames = [];
  for (let i = 0; i < plan.count; i++) {
    flames.push(`
      <span class="js-candle" style="--i:${i}">
        <img class="js-flame" src="/assets/jashn/flame-on.png" alt="" width="66" height="100" draggable="false" aria-hidden="true">
        <img class="js-smoke" src="/assets/jashn/smoke-wisp.png" alt="" width="39" height="87" draggable="false" aria-hidden="true">
        <button class="js-flame-btn" type="button" data-flame="${i}" aria-label="Flame ${i + 1} of ${plan.count} — tap to blow it out"></button>
      </span>`);
  }
  return flames.join('\n');
}

function reelSlides(photos) {
  return photos.map((p, i) => `
      <figure class="js-slide" style="--i:${i}">
        ${p.photo
          ? `<img src="${escape(p.photo)}" alt="${escape(p.caption || 'a birthday memory')}" loading="lazy" decoding="async">`
          : '<div class="js-slide__ph" aria-hidden="true"><span>♥</span></div>'}
        ${p.caption ? `<figcaption class="js-slide__cap">${escape(p.caption)}</figcaption>` : ''}
      </figure>`).join('\n');
}

function sprinkles() {
  return SPRINKLES.map((name, i) =>
    `<img class="js-sprinkle js-sprinkle--${i}" src="/assets/jashn/${name}.png" alt="" aria-hidden="true" loading="lazy" decoding="async">`).join('\n  ');
}

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id, … })
 * @param opts     { baseUrl, isPreview }
 */
function render(paigaam = {}, opts = {}) {
  const d = resolve(config, paigaam && paigaam.customer_data, schema);
  const preview = !!opts.isPreview;
  const name = d.recipientName || 'you';
  const plan = candlePlan(d.age);

  const title = `${d.recipientName ? `Happy birthday ${d.recipientName}` : 'Jashn — blow the candles'} · Paigaam`;
  const description = `${d.senderName ? `${d.senderName} made ` : 'Someone made '}you a birthday surprise: blow the candles out, watch the confetti, and read your letter.`;

  const ogImage = (d.photos.find(p => p.photo) || {}).photo || config.ogImage;

  const payload = { candles: plan.count, plus: plan.plus, preview };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
${head({ paigaam, opts, title, description, themeColor: '#F7F0E6', image: ogImage })}
<link rel="stylesheet" href="/bfday/bgm.css">
<style>:root { --bgm-accent: #C9A227; }</style>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,800&family=Caveat:wght@500;600;700&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/jashn/jashn.css?v=4">
<script src="/jashn/jashn.js?v=4" defer></script>
<noscript><style>
  /* No JS: the whole ceremony is one readable, still page. */
  .js-beat { position: static !important; opacity: 1 !important; transform: none !important; min-height: auto; }
  #jsLetter { display: block !important; }
  .js-intro__hint, .js-blow__mic, .js-flame-btn { display: none !important; }
  .js-flame { opacity: 1 !important; }
  .js-smoke { opacity: 0 !important; }
  .js-replay { display: none !important; }
</style></noscript>
</head>
<body data-preview="${preview}">
${previewBadge(opts)}
${jsonPayload('jsData', payload)}

<main class="js" id="js">

  <!-- ① the intro: balloons drift in, tap to open -->
  <section class="js-beat js-beat--intro is-active" id="jsIntro" aria-labelledby="jsIntroH">
    ${sprinkles()}
    <img class="js-intro__balloon js-intro__balloon--pink" src="/assets/jashn/balloon-pink.png" alt="" width="430" height="560" aria-hidden="true" loading="lazy" decoding="async">
    <img class="js-intro__balloon js-intro__balloon--sage" src="/assets/jashn/balloon-sage.png" alt="" width="339" height="580" aria-hidden="true" loading="lazy" decoding="async">
    <div class="js-intro__inner">
      <p class="js-eyebrow">a little celebration, made for you</p>
      <h1 class="js-intro__h" id="jsIntroH">Something is waiting for you, ${escape(name)}.</h1>
      <button class="js-open-btn" id="jsOpenBtn" type="button">Tap to open your surprise</button>
      <p class="js-intro__hint" aria-hidden="true">it's worth it, promise</p>
    </div>
  </section>

  <!-- ② the cake entrance -->
  <section class="js-beat js-beat--cake" id="jsCake" aria-labelledby="jsCakeH" aria-hidden="true">
    <img class="js-cake__balloon js-cake__balloon--pink" src="/assets/jashn/balloon-pink.png" alt="" width="430" height="560" aria-hidden="true" loading="lazy" decoding="async">
    <img class="js-cake__balloon js-cake__balloon--sage" src="/assets/jashn/balloon-sage.png" alt="" width="339" height="580" aria-hidden="true" loading="lazy" decoding="async">
    <div class="js-cake__inner">
      <h2 class="js-cake__name" id="jsCakeH">Happy Birthday,<br>${escape(name)}</h2>
      <div class="js-cake-wrap" id="jsCakeWrap">
        <div class="js-candles" id="jsCandles" role="group" aria-label="${plan.count}${plan.plus ? '+' : ''} candles on the cake">${candles(plan)}</div>
        <img class="js-cake" src="/assets/jashn/cake.png" alt="A three-tier birthday cake, illustrated" width="703" height="908" draggable="false" decoding="async">
      </div>
      <p class="js-cake__cue" id="jsCakeCue" aria-hidden="true">look at those candles…</p>
      <button class="js-next-btn" id="jsNextBtn" type="button">Ready to blow them out</button>
    </div>
  </section>

  <!-- ③ the blow: mic with the tap fallback always visible -->
  <section class="js-beat js-beat--blow" id="jsBlow" aria-labelledby="jsBlowH" aria-hidden="true">
    <div class="js-blow__inner">
      <h2 class="js-blow__h" id="jsBlowH">Make a wish — now blow!</h2>
      <p class="js-blow__status" id="jsBlowStatus" role="status" aria-live="polite"></p>
      <div class="js-blow__stage" id="jsBlowStage">
        <div class="js-candles js-candles--blow" id="jsCandlesBlow" role="group" aria-label="The candles to blow out"></div>
        <img class="js-cake js-cake--blow" src="/assets/jashn/cake.png" alt="" width="703" height="908" draggable="false" decoding="async">
      </div>
      <button class="js-mic-btn" id="jsMicBtn" type="button">Blow with your voice 🎤</button>
      <p class="js-blow__fallback">or tap the flames one by one</p>
    </div>
  </section>

  <!-- ④ confetti + the photo reel -->
  <section class="js-beat js-beat--reel" id="jsReel" aria-labelledby="jsReelH" aria-hidden="true">
    <div class="js-confetti" id="jsConfetti" aria-hidden="true"></div>
    <div class="js-reel__inner">
      <h2 class="js-reel__h" id="jsReelH">The wish is out —<br>now the memories</h2>
      <div class="js-reel" id="jsReelTrack" role="list" aria-label="Birthday memories">
${reelSlides(d.photos)}
      </div>
      <div class="js-dots" id="jsDots" aria-hidden="true"></div>
    </div>
  </section>

  <!-- ⑤ the letter finale -->
  <section class="js-beat js-beat--letter" id="jsLetter" aria-hidden="true">
    <div class="js-paper">
      <article class="js-letter">
        <p class="js-letter__to">Dear ${escape(name)},</p>
        ${String(d.letterText || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(p => `<p>${multiline(p)}</p>`).join('\n        ')}
        ${d.signoff ? `<p class="js-letter__signoff">${escape(d.signoff)}</p>` : ''}
        ${d.senderName ? `<p class="js-letter__name">${escape(d.senderName)}</p>` : ''}
      </article>
      <p class="js-foot">Made with love on <a href="/">Paigaam</a></p>
      <button class="js-replay" id="jsReplayBtn" type="button">Celebrate again</button>
    </div>
  </section>

</main>
${bgmMarkup(d.bgmSong || '', 'the party song')}
${bgmScript(d.bgmSong || '')}
</body>
</html>`;
}

module.exports = { render, candlePlan };
