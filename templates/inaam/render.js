'use strict';
/**
 * Inaam (Gift For You!) renderer.
 *
 * Emits the complete experience server-rendered — the cover with all three
 * gifts, the crying-cat interstitial, every coupon, the certificate, the
 * letter beside the denim pocket and the finale — so it survives a failed
 * script, a screen reader and share-preview crawlers. inaam.js only adds the
 * motion: the lid-pop unlock, the joke interstitial, the coupon stamps, the
 * rosette sway, the pocket photo pulls and the scroll-ins.
 *
 * Every piece of sender text is HTML-escaped here; there is no client-side
 * text templating. The only client-side injection is the (already
 * URL-validated) YouTube embed src.
 */
const config = require('./config');
const schema = require('./schema');
const { resolve } = require('../../lib/bfday/fields');
const { bgmMarkup, bgmScript } = require('../../lib/bfday/bgm');
const { escape, multiline, jsonPayload, head, previewBadge } = require('../../lib/bfday/page');

/** YouTube watch/share/shorts URL → embeddable id, or ''. */
function youtubeId(url) {
  const m = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?[^#]*v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/i.exec(String(url || '').trim());
  return m ? m[1] : null;
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

/** Brand glyph shown on non-YouTube play links (tiny inline SVG). */
function serviceGlyph(svc) {
  if (svc === 'spotify') return '<svg class="svc-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="#1DB954" d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm5.5 17.3a.75.75 0 0 1-1.03.25c-2.83-1.73-6.39-2.12-10.58-1.16a.75.75 0 0 1-.33-1.46c4.55-1.04 8.45-.59 11.6 1.34.36.22.46.68.24 1.03Zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.24-1.99-8.18-2.57-12-1.4a.94.94 0 1 1-.55-1.8c4.25-1.29 9.62-.66 13.33 1.6.44.27.58.85.31 1.29Zm.13-3.4C15.24 8.3 8.9 8.08 5.16 9.22a1.13 1.13 0 0 1-.66-2.16c4.18-1.27 11.2-1.02 15.6 1.58a1.13 1.13 0 0 1-1.17 1.99Z"/></svg>';
  if (svc === 'apple') return '<svg class="svc-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="#FA243C" d="M16.37 12.56c.03 3.08 2.7 4.1 2.73 4.11-.02.07-.43 1.46-1.41 2.89-.85 1.24-1.73 2.48-3.12 2.5-1.36.03-1.8-.8-3.35-.8-1.55 0-2.04.78-3.32.77-1.33-.02-2.36-1.34-3.22-2.58C2.93 16.9 1.55 12.06 3.3 8.87a5.6 5.6 0 0 1 4.72-2.86c1.47-.03 2.86.99 3.76.99.9 0 2.59-1.23 4.37-1.05.74.03 2.83.3 4.17 2.26-.11.07-2.49 1.45-2.46 4.35ZM13.8 4.25c.71-.86 1.19-2.05 1.06-3.25-1.02.04-2.26.68-3 1.54-.66.76-1.24 1.98-1.08 3.15 1.14.09 2.31-.58 3.02-1.44Z"/></svg>';
  return '';
}

const HEART = '<svg class="heart-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.1c2.1-.2 3.7.9 5.4 2.9 1.7-2 3.3-3.1 5.4-2.9 3.7.4 5.7 4.3 4.2 7.7C19.5 16.4 12 21 12 21z"/></svg>';

/** One gift button on the cover. */
function gift(i, label) {
  return `<li class="in-gift" style="--i:${i}">
      <button type="button" class="in-gift__btn" data-gift="${i + 1}" aria-label="Open gift ${i + 1}${label ? ` — ${escape(label)}` : ''}">
        <img src="/assets/inaam/gift-${i + 1}.png" alt="" width="760" height="760" draggable="false">
      </button>
      <span class="in-gift__label">${escape(label || '')}</span>
    </li>`;
}

/** One coupon ticket. */
function coupon(c, i) {
  return `<li class="in-coupon" style="--i:${i}">
      <button type="button" class="in-ticket" data-coupon="${i}" aria-pressed="false" aria-label="Coupon: ${escape(c.text)}. Tap to redeem.">
        <span class="in-ticket__notch in-ticket__notch--l" aria-hidden="true"></span>
        <span class="in-ticket__notch in-ticket__notch--r" aria-hidden="true"></span>
        <span class="in-ticket__stub" aria-hidden="true">LOVE<br>COUPON</span>
        <span class="in-ticket__body">
          <span class="in-ticket__text" data-fit>${escape(c.text)}</span>
          <span class="in-ticket__fine">${escape(c.fine || '')}</span>
        </span>
        <span class="in-ticket__stamp" aria-hidden="true">REDEEMED</span>
      </button>
    </li>`;
}

/** One photo peeking out of the denim pocket. */
function pocketPhoto(url, i) {
  const peek = [18, 26, 22][i % 3];
  return `<button type="button" class="in-pocket__photo" style="--peek:${peek}" data-photo="${i}" aria-expanded="false" aria-label="Pull photo ${i + 1} out of the pocket">
        <img src="${escape(url)}" alt="a photo tucked in the pocket" loading="lazy" decoding="async">
      </button>`;
}

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id, … })
 * @param opts     { baseUrl, isPreview }
 */
function render(paigaam = {}, opts = {}) {
  const d = resolve(config, paigaam && paigaam.customer_data, schema);
  const bgm = d.bgmSong || '';
  const preview = !!opts.isPreview;

  const him = d.recipientName || 'you';
  const her = d.senderName || 'me';
  const title = d.recipientName ? `Gift for ${d.recipientName}! · Paigaam` : 'Gift for you! · Paigaam';
  const description = d.senderName
    ? `${d.senderName} wrapped you a whole little website. Tap a gift to open it.`
    : 'Someone wrapped you a whole little website. Tap a gift to open it.';

  const gifts = d.giftLabels.slice(0, 3);
  while (gifts.length < 3) gifts.push('');
  const coupons = d.coupons.slice(0, 4);
  const photos = d.photos.slice(0, 2);

  /* ---- finale song link → YouTube embed or branded play link ---- */
  const ytId = youtubeId(d.songUrl);
  const svc = (!ytId && d.songUrl) ? linkBrand(d.songUrl) : '';
  const songEmbed = ytId
    ? `<div class="in-song-embed"><iframe src="https://www.youtube-nocookie.com/embed/${ytId}?rel=0" title="your song" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
    : '';
  const songLink = (!ytId && d.songUrl)
    ? `<a class="in-play${svc ? ' in-play--' + svc : ''}" href="${escape(d.songUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Play the song in ${escape(linkService(d.songUrl))}">&#9654; Play in ${escape(linkService(d.songUrl))}${serviceGlyph(svc)}</a>`
    : '';

  const finalePhoto = d.finalePhoto
    ? `<img src="${escape(d.finalePhoto)}" alt="a photo of the two of you" loading="lazy" decoding="async">`
    : `<img src="https://picsum.photos/seed/paigaam-inaam/640/760" alt="a sample couple photo" loading="lazy" decoding="async">`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
${head({ paigaam, opts, title, description, themeColor: '#F7F0E4', image: config.ogImage })}
<link rel="stylesheet" href="/bfday/bgm.css">
<style>:root { --bgm-accent: #E4573D; }</style>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Shantell+Sans:wght@500;700&family=Great+Vibes&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/inaam/inaam.css">
<script src="/inaam/inaam.js" defer></script>
<noscript><style>
  .in-cover, .in-joke { display: none !important; }
  .in-site { display: block !important; }
  .in-reveal { opacity: 1 !important; transform: none !important; }
</style></noscript>
</head>
<body data-preview="${preview}">
${previewBadge(opts)}
${jsonPayload('inData', { key: !preview && paigaam && paigaam.slug ? paigaam.slug : '' })}

  <!-- BEAT 1 · THE COVER -->
  <section class="in-cover" id="inCover" aria-label="The cover of your gift">
    <div class="in-cover__card">
      <h1 class="in-cover__headline">Gift for You!</h1>
      <p class="in-cover__name">for <strong>${escape(him)}</strong></p>
      <ul class="in-gifts" id="inGifts">
        ${gift(0, gifts[0])}
        ${gift(1, gifts[1])}
        ${gift(2, gifts[2])}
      </ul>
      <p class="in-cover__hint" aria-hidden="true">click any gift to open</p>
      <p class="in-cover__date">${escape(d.dateLine)}</p>
      <button type="button" class="in-no" id="inNo">or tap here if you said no &#128574;</button>
    </div>
  </section>

  <!-- BEAT 2 · THE JOKE INTERSTITIAL -->
  <div class="in-joke" id="inJoke" hidden role="alert">
    <div class="in-joke__card">
      <img src="/assets/inaam/crying-cat.png" alt="a very sad little cat, crying" width="760" height="760">
      <p class="in-joke__why">Why did you click no!</p>
      <span class="in-joke__sticker" aria-hidden="true">Try again!</span>
    </div>
  </div>

  <main class="in-site" id="inSite" hidden>

    <!-- BEAT 3 · THE COUPONS -->
    <section class="in-scene in-coupons" aria-label="Love coupons">
      <h2 class="in-script in-reveal">Love coupons</h2>
      <p class="in-sub in-reveal">tap one to redeem it &middot; double-tap to take it back</p>
      <ul class="in-coupons__list">
        ${coupons.map((c, i) => coupon(c, i)).join('\n        ')}
      </ul>
    </section>

    <!-- BEAT 4 · THE AWARD -->
    <section class="in-scene in-award" aria-label="${escape(d.awardName)}">
      <div class="in-cert in-reveal">
        <div class="in-cert__glow" aria-hidden="true">${HEART}</div>
        <img class="in-cert__rosette" id="inRosette" src="/assets/inaam/rosette.png" alt="a gold award rosette" width="760" height="760">
        <p class="in-cert__presented">this award is presented to</p>
        <p class="in-cert__name">${escape(him)}</p>
        <p class="in-cert__award">${escape(d.awardName)}</p>
        <p class="in-cert__citation">${escape(d.awardCitation)}</p>
        <p class="in-cert__sign">— ${escape(her)}</p>
      </div>
    </section>

    <!-- BEAT 5 · THE LETTER -->
    <section class="in-scene in-letter" aria-label="A letter for you">
      <h2 class="in-script in-reveal">Dear love</h2>
      <div class="in-letter__wrap">
        <div class="in-pocket in-reveal" aria-label="A denim pocket with photos tucked in">
          <div class="in-pocket__stitch" aria-hidden="true"></div>
          ${photos.map((url, i) => pocketPhoto(url, i)).join('\n          ')}
          ${photos.length ? '' : '<p class="in-pocket__empty">photos she adds<br>will peek out here</p>'}
        </div>
        <div class="in-letter__paper in-reveal">
          <p class="in-letter__text">${multiline(d.letterText)}</p>
          <p class="in-letter__sign">— ${escape(her)}</p>
        </div>
      </div>
    </section>

    <!-- BEAT 6 · THE FINALE -->
    <section class="in-scene in-finale" aria-label="One last thing">
      <h2 class="in-script in-reveal">${escape(d.finaleTitle)}</h2>
      <figure class="in-polaroid in-reveal">
        ${finalePhoto}
        <figcaption>${escape(her)} &amp; ${escape(him)}</figcaption>
      </figure>
      <p class="in-finale__note in-reveal">${multiline(d.finaleNote)}</p>
      ${songEmbed}
      ${songLink}
      <footer class="in-foot in-reveal">
        <p>made with love on <a href="/">Paigaam</a></p>
      </footer>
    </section>

  </main>
${bgmMarkup(bgm, 'your song')}
${bgmScript(bgm)}
</body>
</html>`;
}

module.exports = { render, youtubeId };
