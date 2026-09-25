'use strict';
/**
 * Shubh Vivah renderer.
 *
 * Emits the whole invitation as server-rendered HTML — the countdown's static
 * fallback numbers, every name, the full muhurtham card and the closing
 * message — so it survives a failed script, a screen reader or a
 * share-preview crawler. /shubh-vivah/vivah.js only adds the motion: the
 * per-second countdown tick and the scroll-triggered rise per beat.
 *
 * The countdown target is computed here (Asia/Kolkata, the family's day) and
 * shipped both as visible date text and as a JSON payload for the ticker.
 * When the date has passed, the opener swaps to "The new beginning has
 * begun" — never a zeroed clock or negative numbers (Director's rule).
 *
 * Every piece of sender text is HTML-escaped here; there is no client-side
 * text templating.
 */
const config = require('./config');
const schema = require('./schema');
const { resolve } = require('../../lib/bfday/fields');
const { bgmMarkup, bgmScript } = require('../../lib/bfday/bgm');
const { escape, jsonPayload, head, previewBadge } = require('../../lib/bfday/page');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** YYYY-MM-DD → "15 August 2026", or '' when blank. */
function humanDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  return `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}`;
}

/**
 * The countdown target in epoch ms: 6:00 AM Asia/Kolkata on the wedding day
 * (a muhurtham-typical hour when no clock time is typed). '' when no date.
 */
function targetMs(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  return Date.UTC(+m[1], +m[2] - 1, +m[3], 6, 0, 0) - 330 * 60000;
}

/** Split "now → target" into DD/HH/MM/SS for the no-JS first paint. */
function tiles(now, target) {
  let s = Math.max(0, Math.floor((target - now) / 1000));
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const i = Math.floor(s / 60); s -= i * 60;
  return [d, h, i, s].map(n => String(n).padStart(2, '0'));
}

/** One gold-ruled corner ornament. pos: tl | tr | bl | br. */
function corner(pos) {
  return `<img class="sv-corner sv-corner--${pos}" src="/shubh-vivah/ornament-${pos}.png" alt="" width="150" height="150" aria-hidden="true" loading="lazy" decoding="async">`;
}

/** The four-corner gold frame. */
function frame() {
  return ['tl', 'tr', 'bl', 'br'].map(corner).join('\n      ');
}

/* -------------------------------------------------------------- sections */

function countdownBeat(d, now) {
  const target = targetMs(d.eventDate);
  const passed = target !== '' && now >= target;
  const names = `${escape(d.groomName)} & ${escape(d.brideName)}`;
  const tilesHtml = ['days', 'hours', 'minutes', 'seconds'].map((label, i) => `
        <div class="sv-tile">
          <span class="sv-tile__num" id="svT${i}">00</span>
          <span class="sv-tile__lbl">${label}</span>
        </div>`).join('');
  return `<section class="sv-beat sv-beat--open" id="countdown" aria-labelledby="svOpenH">
      <p class="sv-eyebrow sv-reveal">${names}</p>
      <h1 class="sv-open__h sv-reveal" id="svOpenH">${passed ? 'The new beginning has begun ✨' : 'Our New Beginning Starts In'}</h1>
      ${passed ? `<p class="sv-open__date sv-reveal">${escape(humanDate(d.eventDate))}</p>` : `
      <div class="sv-count sv-reveal" id="svCount" role="timer" aria-label="Countdown to the wedding day">${tilesHtml}
      </div>`}
      <p class="sv-open__cue sv-reveal" aria-hidden="true">scroll</p>
    </section>`;
}

function blessingsBeat(d) {
  const lines = [d.parentsLine1, d.parentsLine2].filter(Boolean);
  if (!lines.length) return '';
  return `<section class="sv-beat sv-beat--bless" id="blessings" aria-labelledby="svBlessH">
      <div class="sv-card sv-card--quiet sv-reveal">
        ${corner('tl')}
        ${corner('br')}
        <p class="sv-smallcaps">With the blessings of</p>
        ${lines.map(l => `<p class="sv-parents">${escape(l)}</p>`).join('\n        ')}
      </div>
    </section>`;
}

function muhurthamBeat(d) {
  const rows = [
    ['Date', humanDate(d.eventDate)],
    d.eventTime ? ['Time', d.eventTime] : null,
    ['Venue', d.venue],
  ].filter(Boolean);
  return `<section class="sv-beat sv-beat--card" id="muhurtham" aria-labelledby="svCardH">
      <div class="sv-card sv-card--frame sv-reveal">
        ${frame()}
        <p class="sv-smallcaps">Auspicious occasion</p>
        <h2 class="sv-card__name" id="svCardH">${escape(d.eventName)}</h2>
        <span class="sv-rule" aria-hidden="true"></span>
        <dl class="sv-facts">
          ${rows.map(([k, v]) => `<div class="sv-fact"><dt>${k}</dt><dd>${escape(v)}</dd></div>`).join('\n          ')}
        </dl>
        <img class="sv-card__couple" src="/shubh-vivah/couple.png" alt="The bride and groom in namaste, illustrated" width="280" height="396" loading="lazy" decoding="async">
      </div>
    </section>`;
}

function photoBeat(d, opts) {
  // Previews and the demo show the demo photograph; a published page falls
  // back to the namaste illustration — never an empty frame (Director's rule).
  const src = d.photo || (opts.isPreview ? '/shubh-vivah/demo-couple.jpg' : '');
  const img = src
    ? `<img class="sv-photo__img" src="${escape(src)}" alt="A photograph of ${escape(d.groomName)} and ${escape(d.brideName)}" loading="lazy" decoding="async">`
    : `<img class="sv-photo__img sv-photo__img--illu" src="/shubh-vivah/couple.png" alt="The bride and groom in namaste, illustrated" loading="lazy" decoding="async">`;
  return `<section class="sv-beat sv-beat--photo" id="photo" aria-labelledby="svPhotoH">
      <h2 class="sv-visuallyhidden" id="svPhotoH">A photograph</h2>
      <figure class="sv-photo sv-reveal">
        ${frame()}
        ${img}
        ${d.photoCaption ? `<figcaption class="sv-photo__cap">${escape(d.photoCaption)}</figcaption>` : ''}
      </figure>
    </section>`;
}

function closingBeat(d) {
  return `<section class="sv-beat sv-beat--close" id="closing" aria-labelledby="svCloseH">
      <div class="sv-close sv-reveal">
        <img class="sv-close__couple" src="/shubh-vivah/couple.png" alt="" width="200" height="283" aria-hidden="true" loading="lazy" decoding="async">
        <p class="sv-close__msg" id="svCloseH">${escape(d.closingMessage)}</p>
        <span class="sv-close__rule" aria-hidden="true"></span>
        <p class="sv-close__love">With love,</p>
        <p class="sv-close__names">${escape(d.groomName)} & ${escape(d.brideName)}</p>
        <p class="sv-close__made">Made with love on <a href="/" rel="noopener">Paigaam</a></p>
      </div>
    </section>`;
}

/* -------------------------------------------------------------- render */

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id })
 * @param opts     { baseUrl, isPreview }
 */
function render(paigaam = {}, opts = {}) {
  const d = resolve(config, paigaam && paigaam.customer_data, schema);
  const preview = !!opts.isPreview;
  const now = Date.now();
  const target = targetMs(d.eventDate);

  const couple = `${d.groomName} & ${d.brideName}`;
  const title = `${d.eventName} — ${couple} · Paigaam`;
  const description = `${couple} invite you to celebrate their wedding — ${humanDate(d.eventDate)}${d.venue ? `, ${d.venue}` : ''}. Tap to open the invitation.`;

  const beats = [
    countdownBeat(d, now),
    blessingsBeat(d),
    muhurthamBeat(d),
    photoBeat(d, opts),
    closingBeat(d),
  ].filter(Boolean).join('\n\n  ');

  // No-JS first paint: the countdown tiles show the server-computed value.
  const noScript = target !== '' && now < target
    ? `<noscript><style>.sv-open__cue{display:none}</style><script>0</script></noscript>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
${head({ paigaam, opts, title, description, themeColor: '#FBF6EC', image: d.photo || config.ogImage })}<link rel="stylesheet" href="/bfday/bgm.css">
<style>:root { --bgm-accent: #8E1F2F; }</style>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Great+Vibes&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/shubh-vivah/vivah.css">
<script src="/shubh-vivah/vivah.js" defer></script>
<noscript><style>
  .sv-reveal { opacity: 1 !important; transform: none !important; }
</style></noscript>
</head>
<body data-preview="${preview}">
${previewBadge(opts)}
${target !== '' ? jsonPayload('svData', { target, pastText: 'The new beginning has begun ✨' }) : ''}
${noScript}

  <main class="sv-story">

  ${beats}

  </main>
${bgmMarkup(d.bgmSong || '', 'the wedding song')}
${bgmScript(d.bgmSong || '')}
</body>
</html>`;
}

module.exports = { render, humanDate, targetMs, tiles };
