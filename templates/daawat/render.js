'use strict';
/**
 * Daa'wat renderer.
 *
 * Emits the whole ceremony server-rendered — the closed hero (composited
 * curtain halves), the maroon card, the countdown's static fallback tiles,
 * the gallery and the closing — so it survives a failed script, a screen
 * reader or a share-preview crawler. daawat.js only adds the ceremony:
 * the tap, the curtain slide, the one-shot petal burst, the light bloom and
 * the countdown tick.
 *
 * Every piece of sender text is HTML-escaped here; there is no client-side
 * text templating.
 */
const config = require('./config');
const schema = require('./schema');
const { resolve } = require('../../lib/bfday/fields');
const { bgmMarkup, bgmScript } = require('../../lib/bfday/bgm');
const { escape, multiline, jsonPayload, head, previewBadge } = require('../../lib/bfday/page');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** YYYY-MM-DD → "5 December 2026", or '' when blank. */
function humanDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  return `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}`;
}

/**
 * The countdown target in epoch ms: 6:00 PM Asia/Kolkata on the big day
 * (an evening-wedding-typical hour when no clock time is typed). '' when no date.
 */
function targetMs(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  return Date.UTC(+m[1], +m[2] - 1, +m[3], 12, 0, 0) - 330 * 60000;
}

/** Split "now → target" into DD/HH/MM/SS for the no-JS first paint. */
function tiles(now, target) {
  let s = Math.max(0, Math.floor((target - now) / 1000));
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const i = Math.floor(s / 60); s -= i * 60;
  return [d, h, i, s].map(n => String(n).padStart(2, '0'));
}

/** The couple's names in Great Vibes, one span per letter (60ms stagger,
 *  continuous index across both names), the ampersand preserved between them.
 *  The spans are aria-hidden — the h2's aria-label carries the reading. */
function namesMarkup(bride, groom) {
  let i = 0;
  const letters = name => Array.from(name).map(ch =>
    ch === ' ' ? '<span class="dw-sp" aria-hidden="true">&nbsp;</span>'
      : `<span class="dw-ch" style="--i:${i++}">${escape(ch)}</span>`).join('');
  return `<span aria-hidden="true">${letters(bride)}<span class="dw-amp">&amp;</span>${letters(groom)}</span>`;
}

/* -------------------------------------------------------------- sections */

/** Beat 1 · the closed hero: the two curtain halves composited (ruling #1). */
function heroBeat(d, now) {
  const target = targetMs(d.eventDate);
  const passed = target !== '' && now >= target;
  const tilesHtml = ['days', 'hours', 'minutes', 'seconds'].map((label, i) => `
        <div class="dw-tile">
          <span class="dw-tile__num" id="dwT${i}">${passed ? '00' : tiles(now, target)[i]}</span>
          <span class="dw-tile__lbl">${label}</span>
        </div>`).join('');
  return `<section class="dw-beat dw-hero" id="hero" aria-labelledby="dwHeroH">
      <div class="dw-curtains" aria-hidden="true">
        <img class="dw-curtain dw-curtain--left" src="/assets/daawat/curtain-left.jpg" alt="" decoding="async" draggable="false">
        <img class="dw-curtain dw-curtain--right" src="/assets/daawat/curtain-right.jpg" alt="" decoding="async" draggable="false">
        <div class="dw-flicker" aria-hidden="true"></div>
        <div class="dw-bloom" aria-hidden="true"></div>
      </div>
      <div class="dw-hero__inner">
        <p class="dw-eyebrow" id="dwHeroH">${escape(d.groomName)} weds ${escape(d.brideName)}</p>
        <div class="dw-count" id="dwCount" role="timer" aria-label="Countdown to the wedding day">${tilesHtml}</div>
        <p class="dw-hero__date">${escape(humanDate(d.eventDate))}</p>
      </div>
      <button class="dw-plaque" id="dwOpenBtn" type="button" aria-label="Tap to open the invitation">
        <span class="dw-plaque__text">tap to open</span>
      </button>
      <div class="dw-petals" id="dwPetals" aria-hidden="true"></div>
    </section>`;
}

/** Beat 3 · the maroon card: names, gold divider, invitation line, facts. */
function cardBeat(d) {
  return `<section class="dw-beat dw-cardbeat" id="card" aria-labelledby="dwCardH">
      <div class="dw-card">
        <p class="dw-card__occasion">${escape(d.eventName)}</p>
        <h2 class="dw-card__names" id="dwCardH" aria-label="${escape(d.brideName)} and ${escape(d.groomName)}">${namesMarkup(d.brideName, d.groomName)}</h2>
        <img class="dw-card__divider" src="/assets/daawat/divider-gold.png" alt="" width="270" height="24" aria-hidden="true" loading="lazy" decoding="async">
        <p class="dw-card__invite">${multiline(d.inviteLine)}</p>
        <dl class="dw-facts">
          <div class="dw-fact"><dt>Date</dt><dd>${escape(humanDate(d.eventDate))}</dd></div>
          ${d.eventTime ? `<div class="dw-fact"><dt>Time</dt><dd>${escape(d.eventTime)}</dd></div>` : ''}
          <div class="dw-fact"><dt>Venue</dt><dd>${escape(d.venue)}</dd></div>
        </dl>
      </div>
    </section>`;
}

/** Beat 4 · the countdown, the standing pattern. */
function countdownBeat(d, now) {
  const target = targetMs(d.eventDate);
  const passed = target !== '' && now >= target;
  const tilesHtml = ['days', 'hours', 'minutes', 'seconds'].map((label, i) => `
        <div class="dw-tile">
          <span class="dw-tile__num" id="dwC${i}">${passed ? '00' : tiles(now, target)[i]}</span>
          <span class="dw-tile__lbl">${label}</span>
        </div>`).join('');
  return `<section class="dw-beat dw-countbeat" id="countdown" aria-labelledby="dwCountH">
      <p class="dw-smallcaps" id="dwCountH">${passed ? 'The celebration has begun' : 'The celebration begins in'}</p>
      <div class="dw-count dw-count--standalone" role="timer">${tilesHtml}</div>
      <p class="dw-hero__date">${escape(humanDate(d.eventDate))}</p>
    </section>`;
}

/** Beat 5 · the gold-frame gallery + event cards (standing pattern). */
function galleryBeat(d, opts) {
  const photos = (d.photos || []).filter(p => p.photo);
  if (!photos.length) return '';
  const frames = photos.map((p, i) => `
      <figure class="dw-frame" role="listitem">
        <span class="dw-frame__corner dw-frame__corner--tl" aria-hidden="true"></span>
        <span class="dw-frame__corner dw-frame__corner--tr" aria-hidden="true"></span>
        <span class="dw-frame__corner dw-frame__corner--bl" aria-hidden="true"></span>
        <span class="dw-frame__corner dw-frame__corner--br" aria-hidden="true"></span>
        <img class="dw-frame__img" src="${escape(p.photo)}" alt="${escape(p.caption || 'a wedding memory')}" loading="lazy" decoding="async">
        ${p.caption ? `<figcaption class="dw-frame__cap">${escape(p.caption)}</figcaption>` : ''}
      </figure>`).join('\n');
  return `<section class="dw-beat dw-gallery" id="gallery" aria-label="The wedding gallery">
      <p class="dw-smallcaps">The journey</p>
      <div class="dw-gallery__grid" role="list">${frames}</div>
    </section>`;
}

/** Beat 6 · the closing: message, seal, sign-off, seal-tap re-veil. */
function closingBeat(d) {
  return `<section class="dw-beat dw-close" id="closing" aria-labelledby="dwCloseH">
      <p class="dw-close__msg" id="dwCloseH">${multiline(d.closingMessage)}</p>
      <button class="dw-seal" id="dwSealBtn" type="button" aria-label="Tap the seal to close the ceremony">
        <img class="dw-seal__img" src="/assets/daawat/seal.png" alt="" width="140" height="140" aria-hidden="true" loading="lazy" decoding="async" draggable="false">
      </button>
      <p class="dw-close__love">With love,</p>
      <p class="dw-close__names">${escape(d.groomName)} &amp; ${escape(d.brideName)}</p>
      <p class="dw-close__made">Made with love on <a href="/" rel="noopener">Paigaam</a></p>
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
    heroBeat(d, now),
    cardBeat(d),
    countdownBeat(d, now),
    galleryBeat(d, opts),
    closingBeat(d),
  ].filter(Boolean).join('\n\n  ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
${head({ paigaam, opts, title, description, themeColor: '#1A0505', image: config.ogImage })}
<link rel="stylesheet" href="/bfday/bgm.css">
<style>:root { --bgm-accent: #D4B96A; }</style>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Great+Vibes&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/daawat/daawat.css?v=2">
<script src="/daawat/daawat.js?v=2" defer></script>
<noscript><style>
  /* No JS: the whole ceremony is one readable, still page. */
  .dw-plaque { display: none !important; }
  .dw-petals { display: none !important; }
  .dw-bloom { display: none !important; }
  .dw-ch { opacity: 1 !important; transform: none !important; }
  .dw-flicker { display: none !important; }
</style></noscript>
</head>
<body data-preview="${preview}">
${previewBadge(opts)}
${target !== '' ? jsonPayload('dwData', { target, pastText: 'The celebration has begun' }) : ''}

  <main class="dw-story">

  ${beats}

  </main>
${bgmMarkup(d.bgmSong || '', 'the wedding song')}
${bgmScript(d.bgmSong || '')}
</body>
</html>`;
}

module.exports = { render, humanDate, targetMs, tiles, namesMarkup };
