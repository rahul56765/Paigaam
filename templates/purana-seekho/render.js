'use strict';
/**
 * Purana Seekho — the lemon-gingham, sticker-cat boyfriend's-day gift site.
 *
 * "Purana Seekho" — the old lesson, taught sweetly: the way to his heart is
 * a password he already knows. A cream card on lemon gingham, cat stickers
 * with thick white outlines, hot-pink bubble headlines.
 *
 * The ceremony (6 beats, all server-rendered; purana-seekho.js adds motion):
 *   ① the gate — "Enter the password to view", decorative fake reCAPTCHA,
 *      purple Continue. Light theme by design: cream field on gingham, zero
 *      Raaz dark tokens.
 *   ② the tease — a wrong guess is never an error state: "HOW DARE YOU!?"
 *      in pink bubble letters with a white sticker outline, the winking cat
 *      tilted −4°, a springy TRY AGAIN pill. A third wrong guess loops here
 *      forever — a gift site never locks anyone out. The field keeps its
 *      content so the retry is one tap.
 *   ③ the pick — the excited cat asks "ARE YOU REALLY EXCITED?"; three cat
 *      gift boxes. Tapping opens a box (lid off, dimmed inert). All three
 *      open → 900ms → auto-advance. Opened boxes survive a reload via
 *      sessionStorage.
 *   ④ the reveals — (a) the hero: blushing cat + "happy Boyfriend's Day";
 *      (b) the word cloud: the kitten surrounded by six labelled reasons
 *      (pills in a centered column under 380px); (c) the memories photo
 *      strip: 2×3 ≥480px, a vertical strip below, the red banner overhangs
 *      the frame's bottom edge.
 *   ⑤ the closer — "You complete me" in script, the couple illustration,
 *      the song playing right on the page.
 *
 * The gate is the same salted-SHA-256 gesture gate as Raaz (see that
 * renderer's header): the page carries a hash, never the answer. Every
 * piece of sender text is HTML-escaped here.
 */
const crypto = require('node:crypto');
const config = require('./config');
const schema = require('./schema');
const { resolve } = require('../../lib/bfday/fields');
const { escape, multiline, jsonPayload, head, previewBadge } = require('../../lib/bfday/page');
const { bgmMarkup, bgmScript } = require('../../lib/bfday/bgm');

/** One word-cloud label + its little handwritten arrow. */
function cloudLabel(item, i) {
  return `<li class="ps-cloud__item" style="--i:${i}">
      <span class="ps-cloud__arrow" aria-hidden="true">${CLOUD_ARROWS[i % CLOUD_ARROWS.length]}</span>
      <span class="ps-cloud__label">${escape(item)}</span>
    </li>`;
}

/** Hand-drawn SVG arrows for the word cloud (decorative, pointer-events:none). */
const CLOUD_ARROWS = [
  '<svg viewBox="0 0 40 24" aria-hidden="true"><path d="M3 20 C 14 18, 26 12, 36 4 M 36 4 l-7 .8 M 36 4 l-2.5 6.4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  '<svg viewBox="0 0 40 24" aria-hidden="true"><path d="M4 6 C 14 10, 26 14, 36 20 M 36 20 l-1.2 -6.8 M 36 20 l-6.9 1.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
];

/** One memory photo in the booth strip. */
function memoryPhoto(url, i) {
  return `<figure class="ps-strip__shot" style="--i:${i}">
      <img src="${escape(url)}" alt="one of our memories" loading="lazy" decoding="async">
    </figure>`;
}

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id, … })
 * @param opts     { baseUrl, isPreview }
 */
function render(paigaam = {}, opts = {}) {
  const d = resolve(config, paigaam && paigaam.customer_data, schema);
  const preview = !!opts.isPreview;
  const bgm = d.bgmSong || '';

  const him = d.recipientName || 'you';
  const her = d.senderName || 'me';

  const title = d.recipientName
    ? `Purana Seekho — something for ${d.recipientName}`
    : 'Purana Seekho — I made something for you';
  const description = 'I made something for you… enter the password to view it.';

  /* ---- the gate payload: salted hash, never the answer ---- */
  const password = String(d.password || '').trim();
  const salt = (!preview && paigaam && paigaam.slug) ? `purana-seekho:${paigaam.slug}` : 'purana-seekho:demo';
  const passHash = crypto.createHash('sha256').update(`${salt}:${password.toLowerCase()}`).digest('hex');
  const hint = String(d.hint || '').trim();
  const hintB64 = hint ? Buffer.from(hint, 'utf8').toString('base64') : '';

  /* ---- "happy Boyfriend's Day" with per-word sticker pops ---- */
  const heroLine = 'happy Boyfriend’s Day';
  const heroWords = heroLine.split(' ').map((w, i) =>
    `<span class="ps-hero__word" style="--i:${i}">${escape(w)}</span>`).join(' ');

  const cloud = d.cloudLabels.slice(0, 6);
  const photos = d.photos.slice(0, 6);

  const payload = {
    h: passHash,
    s: salt,
    hint: hintB64,
    preview,
    previewPassword: preview ? password : '',
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
${head({ paigaam, opts, title, description, themeColor: '#FFF9EF', image: config.ogImage })}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Caveat:wght@500;600&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/purana-seekho/purana-seekho.css">
<script src="/purana-seekho/purana-seekho.js" defer></script>
<noscript><style>
  /* No JS: there is no gate without the script, so show the ceremony plainly. */
  .ps-gate, .ps-tease { display: none !important; }
  .ps-site { display: block !important; }
  .ps-pop { opacity: 1 !important; transform: none !important; }
</style></noscript>
</head>
<body data-preview="${preview}">
${previewBadge(opts)}
${jsonPayload('psData', payload)}

<div class="ps-gingham" aria-hidden="true"></div>

<main class="ps" id="ps">

  <!-- ① THE GATE -->
  <section class="ps-gate is-active" id="psGate" aria-labelledby="psGateTitle">
    <div class="ps-card ps-gate__card">
      <h1 class="ps-gate__title" id="psGateTitle">I made something for you…</h1>
      <p class="ps-gate__sub">enter the password to view</p>
      <form class="ps-gate__form" id="psForm" autocomplete="off" novalidate>
        <label class="sr-only" for="psInput">The password</label>
        <input class="ps-gate__input" id="psInput" name="psInput" type="text"
               placeholder="our password" autocomplete="off" autocapitalize="none"
               spellcheck="false" enterkeyhint="go" aria-describedby="psHint">
        <button class="ps-gate__go" id="psGo" type="submit">Continue</button>
      </form>
      <p class="ps-gate__hint" id="psHint" aria-live="polite"></p>
      <div class="ps-captcha" aria-hidden="true">
        <span class="ps-captcha__box">
          <svg class="ps-captcha__tick" viewBox="0 0 24 24" fill="none"><path d="M4 12.5l5.2 5.2L20 6.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        <span class="ps-captcha__text">I’m not a robot (mostly)</span>
      </div>
      ${preview && password ? `<p class="ps-gate__peek">Preview password: <b>${escape(password)}</b></p>` : ''}
    </div>
  </section>

  <!-- ② THE TEASE -->
  <section class="ps-tease" id="psTease" hidden role="alert" aria-label="Wrong guess">
    <img class="ps-tease__cat" src="/assets/purana-seekho/wink-cat.png" alt="a winking cat, thoroughly unimpressed" width="1024" height="1024" draggable="false">
    <p class="ps-tease__line">HOW DARE YOU!?</p>
    <button type="button" class="ps-tease__retry" id="psRetry">Try again</button>
  </section>

  <div class="ps-site" id="psSite" hidden>

    <!-- ③ THE PICK -->
    <section class="ps-beat ps-pick" aria-label="Pick a gift">
      <img class="ps-pick__cat ps-pop" src="/assets/purana-seekho/excited-cat.png" alt="a very excited little cat" width="1024" height="1024" draggable="false">
      <h2 class="ps-pick__headline ps-pop">ARE YOU REALLY EXCITED?</h2>
      <p class="ps-pick__sub ps-pop">for ${escape(him)} — click on the gifts</p>
      <ul class="ps-gifts" id="psGifts">
        <li class="ps-gift">
          <button type="button" class="ps-gift__btn" data-gift="1" aria-label="Open gift 1">
            <img src="/assets/purana-seekho/gift-box.png" alt="" width="1024" height="1024" draggable="false">
          </button>
        </li>
        <li class="ps-gift">
          <button type="button" class="ps-gift__btn" data-gift="2" aria-label="Open gift 2">
            <img src="/assets/purana-seekho/gift-box.png" alt="" width="1024" height="1024" draggable="false">
          </button>
        </li>
        <li class="ps-gift">
          <button type="button" class="ps-gift__btn" data-gift="3" aria-label="Open gift 3">
            <img src="/assets/purana-seekho/gift-box.png" alt="" width="1024" height="1024" draggable="false">
          </button>
        </li>
      </ul>
    </section>

    <!-- ④a THE HERO -->
    <section class="ps-beat ps-hero" aria-label="Happy Boyfriend's Day">
      <img class="ps-hero__cat ps-pop" src="/assets/purana-seekho/blush-cat.png" alt="a blushing cat holding its cheeks" width="1024" height="1024" draggable="false">
      <h2 class="ps-hero__line" aria-label="${escape(heroLine)}">${heroWords}</h2>
      <p class="ps-hero__doodle"><img src="/assets/purana-seekho/doodle-sparkles.png" alt="" width="1024" height="1024" draggable="false"></p>
    </section>

    <!-- ④b THE WORD CLOUD -->
    <section class="ps-beat ps-cloud" aria-label="You are my best friend">
      <img class="ps-cloud__kitten ps-pop" src="/assets/purana-seekho/wordcloud-kitten.png" alt="a small kitten looking up at you" width="1024" height="1024" draggable="false">
      <h2 class="ps-cloud__title ps-pop">YOU ARE MY bestfriend</h2>
      <ul class="ps-cloud__list" id="psCloud">
        ${cloud.map((w, i) => cloudLabel(w, i)).join('\n        ')}
      </ul>
      <p class="ps-cloud__sign ps-pop">— ${escape(her)}</p>
    </section>

    <!-- ④c THE MEMORIES -->
    <section class="ps-beat ps-memories" aria-label="Our memories">
      <div class="ps-strip ps-pop">
        <div class="ps-strip__grid">
          ${photos.map((p, i) => memoryPhoto(p, i)).join('\n          ')}
        </div>
        <span class="ps-strip__banner">OUR MEMORIES</span>
      </div>
      <p class="ps-memories__caption ps-pop">every single one, my favourite</p>
    </section>

    <!-- ⑤ THE CLOSER -->
    <section class="ps-beat ps-closer" aria-label="You complete me">
      <img class="ps-closer__doodle" src="/assets/purana-seekho/doodle-rainbow.png" alt="" width="1024" height="1024" draggable="false" aria-hidden="true">
      <p class="ps-closer__oval ps-pop"><span>You complete me</span></p>
      <img class="ps-closer__couple ps-pop" src="/assets/purana-seekho/couple-illustration.png" alt="an illustrated couple under rainbow doodles" width="1024" height="1024" draggable="false">
      <p class="ps-closer__sign ps-pop">forever yours, ${escape(her)}</p>
      <footer class="ps-closer__foot ps-pop">made with love on <a href="/">Paigaam</a></footer>
    </section>

  </div>
</main>
${bgmMarkup(bgm, 'your song')}
${bgmScript(bgm)}
</body>
</html>`;
}

module.exports = { render };
