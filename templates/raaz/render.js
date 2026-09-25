'use strict';
/**
 * Raaz renderer.
 *
 * Server-renders all five beats — the lock screen, the unlock ceremony, the
 * envelope, the gift box and the letter — stacked in one page; the script
 * walks them forward as he unlocks, taps and pops. Everything after the
 * lock screen starts inert and hidden: no template chrome leaks before the
 * right answer.
 *
 * The gate: the page carries only a salted SHA-256 of the password (the salt
 * is the published link's slug, or the fixed demo salt), never the answer
 * itself. The hint lines are base64-wrapped and decoded only after the first
 * wrong guess, so they are not sitting in plain view before then. It is a
 * gesture gate — a determined person reading the source can defeat it — and
 * that is accepted by design.
 *
 * Every piece of sender text is HTML-escaped here; the client script renders
 * hints only via textContent.
 */
const crypto = require('node:crypto');
const config = require('./config');
const schema = require('./schema');
const { resolve } = require('../../lib/bfday/fields');
const { escape, multiline, jsonPayload, head, previewBadge } = require('../../lib/bfday/page');

/** Extract a YouTube video ID from watch / youtu.be / shorts / embed URLs. */
function youtubeId(url) {
  const m = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?[^#]*v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/i.exec(String(url || '').trim());
  return m ? m[1] : null;
}

/** "Open in <service>" label for non-YouTube song links (display text). */
function linkService(url) {
  const m = /^https?:\/\/(?:www\.)?([^/?#]+)/i.exec(String(url || '').trim());
  const h = m ? m[1].toLowerCase() : '';
  if (/spotify/.test(h))  return 'Spotify';
  if (/music\.apple\.|itunes/.test(h)) return 'Apple Music';
  if (/jiosaavn/.test(h)) return 'JioSaavn';
  return 'the app';
}

/** CSS class key for brand styling, derived independently of the label. */
function linkBrand(url) {
  const m = /^https?:\/\/(?:www\.)?([^/?#]+)/i.exec(String(url || '').trim());
  const h = m ? m[1].toLowerCase() : '';
  if (/spotify/.test(h))  return 'spotify';
  if (/music\.apple\.|itunes/.test(h)) return 'apple';
  return '';
}

/** Brand glyph shown on non-YouTube play links (tiny inline SVG). */
function serviceGlyph(svc) {
  if (svc === 'spotify') return '<svg class="rz-svc-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="#1DB954" d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm5.5 17.3a.75.75 0 0 1-1.03.25c-2.83-1.73-6.39-2.12-10.58-1.16a.75.75 0 0 1-.33-1.46c4.55-1.04 8.45-.59 11.6 1.34.36.22.46.68.24 1.03Zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.24-1.99-8.18-2.57-12-1.4a.94.94 0 1 1-.55-1.8c4.25-1.29 9.62-.66 13.33 1.6.44.27.58.85.31 1.29Zm.13-3.4C15.24 8.3 8.9 8.08 5.16 9.22a1.13 1.13 0 0 1-.66-2.16c4.18-1.27 11.2-1.02 15.6 1.58a1.13 1.13 0 0 1-1.17 1.99Z"/></svg>';
  if (svc === 'apple') return '<svg class="rz-svc-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="#FA243C" d="M16.37 12.56c.03 3.08 2.7 4.1 2.73 4.11-.02.07-.43 1.46-1.41 2.89-.85 1.24-1.73 2.48-3.12 2.5-1.36.03-1.8-.8-3.35-.8-1.55 0-2.04.78-3.32.77-1.33-.02-2.36-1.34-3.22-2.58C2.93 16.9 1.55 12.06 3.3 8.87a5.6 5.6 0 0 1 4.72-2.86c1.47-.03 2.86.99 3.76.99.9 0 2.59-1.23 4.37-1.05.74.03 2.83.3 4.17 2.26-.11.07-2.49 1.45-2.46 4.35ZM13.8 4.25c.71-.86 1.19-2.05 1.06-3.25-1.02.04-2.26.68-3 1.54-.66.76-1.24 1.98-1.08 3.15 1.14.09 2.31-.58 3.02-1.44Z"/></svg>';
  return '';
}

function paragraphs(text) {
  return String(text || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
}

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id })
 * @param opts     { baseUrl, isPreview }
 */
function render(paigaam = {}, opts = {}) {
  const d = resolve(config, paigaam && paigaam.customer_data, schema);
  const preview = !!opts.isPreview;
  const name = d.recipientName || 'you';

  const title = d.recipientName
    ? `Raaz — a locked letter for ${d.recipientName}`
    : 'Raaz — the password letter';
  const description = 'Only he knows the password.';

  /* ---- the gate payload: salted hash, hints behind base64 ---- */
  const password = String(d.password || '').trim();
  const salt = (!preview && paigaam && paigaam.slug) ? `raaz:${paigaam.slug}` : 'raaz:demo';
  const passHash = crypto.createHash('sha256').update(`${salt}:${password.toLowerCase()}`).digest('hex');
  const hints = (Array.isArray(d.hints) ? d.hints : []).map(h => String(h || '').trim()).filter(Boolean).slice(0, 3);
  const hintsB64 = Buffer.from(JSON.stringify(hints), 'utf8').toString('base64');

  /* ---- GIFT FOR YOU! letters, staggered one span per character ---- */
  const giftLine = 'GIFT FOR YOU!';
  const giftSpans = Array.from(giftLine).map((ch, i) =>
    ch === ' ' ? '<span class="rz-gift__sp" aria-hidden="true">&nbsp;</span>'
      : `<span class="rz-gift__ch" style="--i:${i}">${escape(ch)}</span>`).join('');

  /* ---- the song: YouTube embeds, everything else gets a branded pill ---- */
  const ytId = youtubeId(d.songUrl);
  const svc  = (!ytId && d.songUrl) ? linkBrand(d.songUrl) : '';
  const songEmbed = ytId
    ? `<div class="rz-song__embed"><iframe src="https://www.youtube-nocookie.com/embed/${ytId}?rel=0" title="${escape(d.songTitle || 'Our song')}" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
    : '';
  const songLink = (!ytId && d.songUrl)
    ? `<a class="rz-song__pill${svc ? ' rz-song__pill--' + svc : ''}" href="${escape(d.songUrl)}" target="_blank" rel="noopener noreferrer">&#9654; Play in ${escape(linkService(d.songUrl))}${serviceGlyph(svc)}</a>`
    : '';
  const songCard = (songEmbed || songLink || d.songTitle)
    ? `<div class="rz-song">
        <p class="rz-song__label">your song</p>
        ${songEmbed}
        ${songLink}
        ${d.songTitle ? `<p class="rz-song__title">${escape(d.songTitle)}</p>` : ''}
      </div>`
    : '';

  const signoffLine = d.signoff ? `<p class="rz-letter__signoff">${escape(d.signoff)}</p>` : '';
  const signName = d.senderName ? `<p class="rz-letter__name">${escape(d.senderName)}</p>` : '';

  const letterHTML = paragraphs(d.letterText).map(p => `<p>${multiline(p)}</p>`).join('\n        ');

  const payload = {
    h: passHash,
    s: salt,
    hints: hintsB64,
    chip: d.chipLabel || '',
    preview,
    previewPassword: preview ? password : '',
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
${head({ paigaam, opts, title, description, themeColor: '#0F0D0C', image: config.ogImage })}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,900&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&family=Caveat:wght@500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/raaz/raaz.css">
<script src="/raaz/raaz.js" defer></script>
<noscript><style>
  /* No JS: there is no gate without the script, so show the letter plainly. */
  .rz-stage--lock, .rz-stage--unlock, .rz-stage--envelope, .rz-stage--gift { display: none !important; }
  .rz-stage--letter { display: block !important; }
  .rz-skip { display: none !important; }
</style></noscript>
</head>
<body data-preview="${preview}">
${previewBadge(opts)}
${jsonPayload('rzData', payload)}

<main class="rz" id="rz">

  <!-- ① the lock -->
  <section class="rz-stage rz-stage--lock is-active" id="rzLock" aria-labelledby="rzLockTitle">
    <div class="rz-lock__inner">
      <h1 class="rz-lock__title" id="rzLockTitle">Only he knows the password.</h1>
      <form class="rz-lock__form" id="rzForm" autocomplete="off" novalidate>
        <label class="rz-lock__label" for="rzInput">Enter the password to view</label>
        <input class="rz-lock__input" id="rzInput" name="rzInput" type="text"
               autocomplete="off" autocapitalize="none" spellcheck="false"
               enterkeyhint="go" aria-describedby="rzHint">
      </form>
      <p class="rz-lock__hint" id="rzHint" aria-live="polite"></p>
      ${preview && password ? `<p class="rz-lock__peek">Preview password: <b>${escape(password)}</b></p>` : ''}
    </div>
  </section>

  <!-- ② the unlock ceremony -->
  <section class="rz-stage rz-stage--unlock" id="rzUnlock" aria-hidden="true">
    <div class="rz-captcha" id="rzCaptcha">
      <span class="rz-captcha__box" aria-hidden="true">
        <svg class="rz-captcha__tick" viewBox="0 0 24 24" fill="none">
          <path d="M4 12.5l5.2 5.2L20 6.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span class="rz-captcha__text">I’m not a robot</span>
    </div>
    <div class="rz-chip" id="rzChip" role="status">
      <span class="rz-chip__dot" aria-hidden="true"></span>
      <span class="rz-chip__label">${escape(d.chipLabel)}</span>
    </div>
  </section>

  <!-- ③ the envelope -->
  <section class="rz-stage rz-stage--envelope" id="rzEnvelope" aria-hidden="true">
    <button type="button" class="rz-envelope" id="rzEnvelopeBtn" aria-label="Open the envelope for ${escape(name)}">
      <img class="rz-envelope__img" src="/assets/raaz/envelope.png" alt="" width="1200" height="891" draggable="false">
      <span class="rz-seal" aria-hidden="true"><img src="/assets/raaz/seal.png" alt="" width="889" height="900" draggable="false"></span>
      <span class="rz-envelope__to">for ${escape(name)}</span>
    </button>
    <p class="rz-tapline">tap the seal</p>
  </section>

  <!-- ④ the gift -->
  <section class="rz-stage rz-stage--gift" id="rzGift" aria-hidden="true">
    <button type="button" class="rz-box" id="rzBoxBtn" aria-label="Open the gift">
      <img class="rz-box__img" id="rzBoxImg" src="/assets/raaz/box-closed.png" alt="" width="876" height="968" draggable="false">
      <img class="rz-confetti" id="rzConfetti" src="/assets/raaz/confetti.png" alt="" width="1000" height="1000" draggable="false" aria-hidden="true">
    </button>
    <h2 class="rz-gift" id="rzGiftTitle" aria-label="${escape(giftLine)}">${giftSpans}</h2>
    <p class="rz-tapline" id="rzGiftTap">tap the box</p>
  </section>

  <!-- ⑤ the letter -->
  <section class="rz-stage rz-stage--letter" id="rzLetter" aria-hidden="true">
    <div class="rz-paper">
      <article class="rz-letter">
        <p class="rz-letter__to">Dear ${escape(name)},</p>
        ${letterHTML}
        ${signoffLine}
        ${signName}
      </article>
      ${songCard}
      <p class="rz-foot">Made with love on <a href="/">Paigaam</a></p>
    </div>
  </section>

</main>
</body>
</html>`;
}

module.exports = { render };

