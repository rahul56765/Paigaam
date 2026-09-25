'use strict';
/**
 * Aakhri Sawaal renderer.
 *
 * Server-renders every card, the question and the reply form, so the page
 * reads fine without script. /aakhri-sawaal/sawaal.js steps through the
 * cards (350ms, browser back goes back a card), builds his WhatsApp reply,
 * and frames his photo on the device (downscaled to 1600px, never uploaded).
 *
 * Every piece of sender text is HTML-escaped here; there is no client-side
 * templating. The WhatsApp number is reduced to digits before it is used.
 */
const config = require('./config');
const schema = require('./schema');
const { resolve } = require('../../lib/bfday/fields');
const { escape, multiline, jsonPayload, head, previewBadge } = require('../../lib/bfday/page');
const { youtubeId, songScript } = require('../../lib/bfday/song');

const HEART_PATH = 'M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.1c2.1-.2 3.7.9 5.4 2.9 1.7-2 3.3-3.1 5.4-2.9 3.7.4 5.7 4.3 4.2 7.7C19.5 16.4 12 21 12 21z';
const heart = cls => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${HEART_PATH}"/></svg>`;

/**
 * The song, per Rahul's rule: it plays in the browser itself. A YouTube link
 * becomes an inline embed (iframe mounts on tap, autoplay=1 — no navigation,
 * no YouTube app); any other service keeps the branded pill hop.
 */
function songMarkup(d) {
  if (!d.songTitle && !d.songUrl) return '';
  const ytId = youtubeId(d.songUrl);
  if (ytId) {
    return `<div class="as-songwrap"><p class="as-song as-song--head"><span aria-hidden="true">♪</span> ${escape(d.songTitle || 'Our song')}</p>
      <button type="button" class="as-songplay" data-yt="${ytId}" data-armed="false" aria-pressed="false" aria-label="Play ${escape(d.songTitle || 'our song')} on this page">
        <span class="song-play__frame" aria-hidden="true"></span>
        <span class="song-play__cue" aria-hidden="true">tap to play ♪</span>
      </button></div>`;
  }
  return d.songUrl
    ? `<a class="as-song" href="${escape(d.songUrl)}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">♪</span> ${escape(d.songTitle || 'Our song')} <small>Play in the app ↗</small></a>`
    : `<p class="as-song"><span aria-hidden="true">♪</span> ${escape(d.songTitle || 'Our song')}</p>`;
}

/** '+91 98765-43210' → '919876543210'; a bare 10-digit Indian mobile gets 91; anything implausible → ''. */
function waNumber(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10 && /^[6-9]/.test(digits)) digits = '91' + digits;
  return digits.length >= 11 && digits.length <= 15 ? digits : '';
}

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id })
 * @param opts     { baseUrl, isPreview }
 */
function render(paigaam = {}, opts = {}) {
  const d = resolve(config, paigaam && paigaam.customer_data, schema);
  const preview = !!opts.isPreview;
  const sender = d.senderName || '';
  const him = d.recipientName || '';
  const cards = d.buildUp.slice(0, 2);
  const number = waNumber(d.whatsapp);

  const title = sender ? `Aakhri Sawaal — ${sender} has a question for you` : 'Aakhri Sawaal — one question, your answer';
  const description = him ? `${him}, there is one question waiting for you.` : 'One question. Your answer.';

  const steps = [
    ...cards.map((text, i) => `<section class="as-card as-card--line" data-step="${i}"${i ? ' hidden' : ''} aria-live="polite">
      ${i === 0 && him ? `<p class="as-hey">${escape(him)},</p>` : ''}
      <p class="as-line">${escape(text)}</p>
      <span class="as-tap" aria-hidden="true">tap</span>
    </section>`),
    `<section class="as-card as-card--heart" data-step="${cards.length}" hidden aria-label="A heartbeat">
      <div class="as-beat">${heart('as-beat__heart')}</div>
    </section>`,
    `<section class="as-card as-card--question" data-step="${cards.length + 1}" hidden aria-labelledby="asQ">
      <h1 class="as-q" id="asQ">${multiline(d.question)}</h1>
      ${sender ? `<p class="as-signed">— ${escape(sender)}</p>` : ''}
      <button type="button" class="as-btn as-btn--gold" id="asAnswer">Write your answer</button>
      ${songMarkup(d)}
    </section>`,
    `<section class="as-card as-card--reply" data-step="${cards.length + 2}" hidden aria-labelledby="asReplyTitle">
      <p class="as-reply__q">${multiline(d.question)}</p>
      <h2 id="asReplyTitle">Your answer</h2>
      <form class="as-form" id="asForm" novalidate>
        <label class="as-sr" for="asText">Your answer</label>
        <textarea id="asText" rows="4" maxlength="600" placeholder="Dil se likho…"></textarea>
        <div class="as-quick" role="group" aria-label="Quick answers">
          <button type="button" data-quick="Haan ❤️">Haan ❤️</button>
          <button type="button" data-quick="Obviously, yes.">Obviously, yes.</button>
          <button type="button" data-quick="Hamesha.">Hamesha.</button>
        </div>
        <div class="as-photo">
          <input type="file" id="asFile" accept="image/*" hidden>
          <button type="button" class="as-btn as-btn--ghost" id="asPick">Add a photo — your answer, framed</button>
          <figure class="as-frame" id="asFrame" hidden>
            <img id="asFramed" alt="Your answer, framed">
            <figcaption><button type="button" class="as-link" id="asRemove">Remove photo</button></figcaption>
          </figure>
          <p class="as-note" id="asPhotoNote" aria-live="polite"></p>
        </div>
        <p class="as-error" id="asError" role="alert" hidden></p>
        <button type="submit" class="as-btn as-btn--wa" id="asSend">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3z"/></svg>
          <span>${number && sender ? `Send it to ${escape(sender)} on WhatsApp` : 'Send my answer on WhatsApp'}</span>
        </button>
        <button type="button" class="as-btn as-btn--ghost" id="asShareCard" hidden>Share the framed photo</button>
        <p class="as-private">Only ${sender ? escape(sender) : 'they'} will see it${number ? '' : ' — you choose the chat'}. Nothing you write is saved on this page.</p>
      </form>
    </section>`,
    `<section class="as-card as-card--sent" data-step="${cards.length + 3}" hidden aria-labelledby="asSentTitle">
      <div class="as-beat as-beat--still">${heart('as-beat__heart')}</div>
      <h2 id="asSentTitle">Your answer is on its way.</h2>
      <p>If WhatsApp didn’t open, your reply is copied — paste it in a chat${sender ? ` with ${escape(sender)}` : ''}.</p>
      <button type="button" class="as-link" id="asAgain">Send it again</button>
    </section>`,
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
${head({ paigaam, opts, title, description, themeColor: '#101820', image: config.ogImage })}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/aakhri-sawaal/sawaal.css">
<script src="/aakhri-sawaal/sawaal.js" defer></script>
${(d.songTitle || d.songUrl) ? songScript() : ''}
<noscript><style>
  .as-card[hidden] { display: flex !important; }
  .as-card--heart, .as-card--sent, .as-tap, #asAnswer, .as-photo, .as-quick, #asSend, #asShareCard { display: none !important; }
</style></noscript>
</head>
<body data-preview="${preview}">
${previewBadge(opts)}
${jsonPayload('asData', { sender, him, question: d.question, number, cards: cards.length })}
  <div class="as-candles" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
  <main class="as-stage" id="asStage">
    ${steps.join('\n    ')}
  </main>
  <p class="as-foot">Made with love on <a href="/">Paigaam</a></p>
</body>
</html>`;
}

module.exports = { render, waNumber };
