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

/** Brand glyph shown on non-YouTube play links (tiny inline SVG). */
function serviceGlyph(svc) {
  if (svc === 'spotify') return '<svg class="ps-svc-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="#1DB954" d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm5.5 17.3a.75.75 0 0 1-1.03.25c-2.83-1.73-6.39-2.12-10.58-1.16a.75.75 0 0 1-.33-1.46c4.55-1.04 8.45-.59 11.6 1.34.36.22.46.68.24 1.03Zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.24-1.99-8.18-2.57-12-1.4a.94.94 0 1 1-.55-1.8c4.25-1.29 9.62-.66 13.33 1.6.44.27.58.85.31 1.29Zm.13-3.4C15.24 8.3 8.9 8.08 5.16 9.22a1.13 1.13 0 0 1-.66-2.16c4.18-1.27 11.2-1.02 15.6 1.58a1.13 1.13 0 0 1-1.17 1.99Z"/></svg>';
  if (svc === 'apple') return '<svg class="ps-svc-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="#FA243C" d="M16.37 12.56c.03 3.08 2.7 4.1 2.73 4.11-.02.07-.43 1.46-1.41 2.89-.85 1.24-1.73 2.48-3.12 2.5-1.36.03-1.8-.8-3.35-.8-1.55 0-2.04.78-3.32.77-1.33-.02-2.36-1.34-3.22-2.58C2.93 16.9 1.55 12.06 3.3 8.87a5.6 5.6 0 0 1 4.72-2.86c1.47-.03 2.86.99 3.76.99.9 0 2.59-1.23 4.37-1.05.74.03 2.83.3 4.17 2.26-.11.07-2.49 1.45-2.46 4.35ZM13.8 4.25c.71-.86 1.19-2.05 1.06-3.25-1.02.04-2.26.68-3 1.54-.66.76-1.24 1.98-1.08 3.15 1.14.09 2.31-.58 3.02-1.44Z"/></svg>';
  return '';
}

/** "Open in <service>" label for non-YouTube song links (display text). */
function linkService(url) {
  const m = /^https?:\/\/(?:www\.)?([^/?#]+)/i.exec(String(url || '').trim());
  const h = m ? m[1].toLowerCase() : '';
  if (/spotify/.test(h)) return 'Spotify';
  if (/music\.apple\.|itunes/.test(h)) return 'Apple Music';
  if (/jiosaavn/.test(h)) return 'JioSaavn';
  return 'the app';
}

/** CSS class key for brand styling, derived independently of the label. */
function linkBrand(url) {
  const m = /^https?:\/\/(?:www\.)?([^/?#]+)/i.exec(String(url || '').trim());
  const h = m ? m[1].toLowerCase() : '';
  if (/spotify/.test(h)) return 'spotify';
  if (/music\.apple\.|itunes/.test(h)) return 'apple';
  return '';
}

/** Extract a YouTube video ID from watch / youtu.be / shorts / embed URLs. */
function youtubeId(url) {
  const m = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?[^#]*v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/i.exec(String(url || '').trim());
  return m ? m[1] : null;
}

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

/** The shipped sample memories (shared family demo dir). */
const PHOTO_DEMOS = [
  '/assets/bfday-demo/purana-seekho-demo-1.jpg',
  '/assets/bfday-demo/purana-seekho-demo-2.jpg',
  '/assets/bfday-demo/purana-seekho-demo-3.jpg',
  '/assets/bfday-demo/purana-seekho-demo-4.jpg',
  '/assets/bfday-demo/purana-seekho-demo-5.jpg',
  '/assets/bfday-demo/purana-seekho-demo-6.jpg',
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
  /* the memories strip: sender photos, else the shipped sample shots */
  const photos = (d.photos.length ? d.photos : PHOTO_DEMOS).slice(0, 6);

  /* ---- the closer song: YouTube embeds, everything else gets a branded pill ---- */
  const songUrl = d.closerSongUrl || '';
  const ytId = youtubeId(songUrl);
  const svc = (!ytId && songUrl) ? linkBrand(songUrl) : '';
  const songEmbed = ytId
    ? `<div class="ps-song__embed"><iframe src="https://www.youtube-nocookie.com/embed/${ytId}?rel=0" title="your song" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
    : '';
  const songLink = (!ytId && songUrl)
    ? `<a class="ps-song__pill${svc ? ' ps-song__pill--' + svc : ''}" href="${escape(songUrl)}" target="_blank" rel="noopener noreferrer">&#9654; Play in ${escape(linkService(songUrl))}${serviceGlyph(svc)}</a>`
    : '';

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
      ${songEmbed}
      ${songLink}
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
