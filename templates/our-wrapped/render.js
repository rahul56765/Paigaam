'use strict';
/**
 * Naghma (Our Wrapped) renderer.
 *
 * Emits a complete scroll-snap experience as server-rendered HTML:
 *   Screen 1  — title: year, days together, caption
 *   Screens 2…N+1 — one per moment (count, unit, caption)
 *   Screen N+2 — song card (title, artist, optional play link, caption)
 *   Screen N+3 — closing: handwritten note + mini recap card
 *
 * Every stat number is written into a data-count attribute so wrapped.js
 * can animate it on first scroll; the textContent starts at "0".
 * Reduced motion: count-up is instant; scroll-snap uses auto behaviour.
 *
 * The five SVG illustrations cycle for an unlimited number of moment screens.
 */
const config  = require('./config');
const schema  = require('./schema');
const { resolve }                         = require('../../lib/bfday/fields');
const { bgmMarkup, bgmScript } = require('../../lib/bfday/bgm');
const { escape, multiline, jsonPayload, head, previewBadge } = require('../../lib/bfday/page');

/* Five inline-SVG spot illustrations (one per moment slot, cycled). */
const SVGS = [
  /* 0 – photo / landscape */
  `<svg class="photo" viewBox="0 0 200 200" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="wr-p0" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#D98A80"/><stop offset="1" stop-color="#B9B0E0"/>
    </linearGradient></defs>
    <rect width="200" height="200" rx="24" fill="url(#wr-p0)"/>
    <circle cx="70" cy="75" r="24" fill="rgba(255,253,248,0.55)"/>
    <path d="M0 200 L75 110 L120 160 L160 120 L200 165 L200 200 Z" fill="rgba(29,27,46,0.45)"/>
  </svg>`,

  /* 1 – night / crescent */
  `<svg class="photo" viewBox="0 0 200 200" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="wr-p1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#B9B0E0"/><stop offset="1" stop-color="#232038"/>
    </linearGradient></defs>
    <rect width="200" height="200" rx="24" fill="url(#wr-p1)"/>
    <circle cx="150" cy="55" r="20" fill="rgba(255,253,248,0.7)"/>
    <circle cx="158" cy="48" r="20" fill="#1D1B2E"/>
    <circle cx="60" cy="140" r="2.5" fill="rgba(255,253,248,0.8)"/>
    <circle cx="95" cy="120" r="2" fill="rgba(255,253,248,0.6)"/>
    <circle cx="130" cy="160" r="2.5" fill="rgba(255,253,248,0.7)"/>
    <circle cx="45" cy="80" r="1.8" fill="rgba(255,253,248,0.5)"/>
  </svg>`,

  /* 2 – chai cup */
  `<svg class="photo" viewBox="0 0 200 200" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="wr-p2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#D98A80"/><stop offset="1" stop-color="#8a5f6f"/>
    </linearGradient></defs>
    <rect width="200" height="200" rx="24" fill="url(#wr-p2)"/>
    <path d="M60 80 h65 v45 a20 20 0 0 1 -20 20 h-25 a20 20 0 0 1 -20 -20 Z" fill="rgba(255,253,248,0.85)"/>
    <path d="M125 88 h12 a14 14 0 0 1 0 28 h-12 v-10 h12 a4 4 0 0 0 0 -8 h-12 Z" fill="rgba(255,253,248,0.7)"/>
    <path d="M78 65 q4 -8 0 -14 M100 65 q4 -8 0 -14 M118 65 q4 -8 0 -14" stroke="rgba(255,253,248,0.6)" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="92" cy="150" rx="40" ry="6" fill="rgba(29,27,46,0.35)"/>
  </svg>`,

  /* 3 – message bubbles */
  `<svg class="photo" viewBox="0 0 200 200" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="wr-p3" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7f6fbe"/><stop offset="1" stop-color="#D98A80"/>
    </linearGradient></defs>
    <rect width="200" height="200" rx="24" fill="url(#wr-p3)"/>
    <rect x="45" y="55" width="110" height="24" rx="12" fill="rgba(255,253,248,0.85)"/>
    <rect x="70" y="92" width="85" height="24" rx="12" fill="rgba(255,253,248,0.65)"/>
    <rect x="55" y="129" width="95" height="24" rx="12" fill="rgba(255,253,248,0.45)"/>
  </svg>`,

  /* 4 – two figures / walk */
  `<svg class="photo" viewBox="0 0 200 200" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="wr-p4" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#232038"/><stop offset="1" stop-color="#B9B0E0"/>
    </linearGradient></defs>
    <rect width="200" height="200" rx="24" fill="url(#wr-p4)"/>
    <circle cx="100" cy="70" r="30" fill="rgba(255,253,248,0.75)"/>
    <circle cx="100" cy="140" r="16" fill="rgba(29,27,46,0.5)"/>
    <circle cx="100" cy="172" r="22" fill="rgba(29,27,46,0.4)"/>
    <circle cx="100" cy="140" r="16" fill="none" stroke="rgba(255,253,248,0.5)" stroke-width="3"/>
  </svg>`,
];

/* Vinyl / album-art placeholder for the song screen. */
const VINYL_SVG = `<svg class="album-art" viewBox="0 0 180 180" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="wr-vinyl" cx="0.5" cy="0.5" r="0.7">
    <stop offset="0" stop-color="#D98A80"/><stop offset="1" stop-color="#232038"/>
  </radialGradient></defs>
  <rect width="180" height="180" rx="16" fill="url(#wr-vinyl)"/>
  <circle cx="90" cy="90" r="46" fill="none" stroke="rgba(255,253,248,0.5)" stroke-width="2"/>
  <circle cx="90" cy="90" r="30" fill="none" stroke="rgba(255,253,248,0.35)" stroke-width="2"/>
  <circle cx="90" cy="90" r="10" fill="#1D1B2E"/>
  <circle cx="90" cy="90" r="3" fill="#FFFDF8"/>
</svg>`;

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
  if (svc === 'spotify') return '<svg class="svc-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="#1DB954" d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm5.5 17.3a.75.75 0 0 1-1.03.25c-2.83-1.73-6.39-2.12-10.58-1.16a.75.75 0 0 1-.33-1.46c4.55-1.04 8.45-.59 11.6 1.34.36.22.46.68.24 1.03Zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.24-1.99-8.18-2.57-12-1.4a.94.94 0 1 1-.55-1.8c4.25-1.29 9.62-.66 13.33 1.6.44.27.58.85.31 1.29Zm.13-3.4C15.24 8.3 8.9 8.08 5.16 9.22a1.13 1.13 0 0 1-.66-2.16c4.18-1.27 11.2-1.02 15.6 1.58a1.13 1.13 0 0 1-1.17 1.99Z"/></svg>';
  if (svc === 'apple') return '<svg class="svc-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="#FA243C" d="M16.37 12.56c.03 3.08 2.7 4.1 2.73 4.11-.02.07-.43 1.46-1.41 2.89-.85 1.24-1.73 2.48-3.12 2.5-1.36.03-1.8-.8-3.35-.8-1.55 0-2.04.78-3.32.77-1.33-.02-2.36-1.34-3.22-2.58C2.93 16.9 1.55 12.06 3.3 8.87a5.6 5.6 0 0 1 4.72-2.86c1.47-.03 2.86.99 3.76.99.9 0 2.59-1.23 4.37-1.05.74.03 2.83.3 4.17 2.26-.11.07-2.49 1.45-2.46 4.35ZM13.8 4.25c.71-.86 1.19-2.05 1.06-3.25-1.02.04-2.26.68-3 1.54-.66.76-1.24 1.98-1.08 3.15 1.14.09 2.31-.58 3.02-1.44Z"/></svg>';
  return '';
}

/** Format a number for display (en-IN grouping, e.g. 19,364). */
function fmt(n) {
  if (n == null || n !== n) return '0';
  return Number(n).toLocaleString('en-IN');
}

/**
 * @param {object} paigaam   paigaam row ({ customer_data, slug, id, … })
 * @param {object} opts      { baseUrl, isPreview }
 */
function render(paigaam = {}, opts = {}) {
  const d = resolve(config, paigaam && paigaam.customer_data, schema);
  const bgm = d.bgmSong || '';
  const preview = !!opts.isPreview;

  const sender    = d.senderName    || 'me';
  const recipient = d.recipientName || 'you';
  const year      = d.year          || '2026';
  const days      = d.daysTogether  != null ? d.daysTogether : 1247;
  const moments   = Array.isArray(d.moments) && d.moments.length > 0 ? d.moments : [];

  const title       = `Our Wrapped ${escape(year)} · Paigaam`;
  const description = (d.senderName && d.recipientName)
    ? `${d.senderName} made ${d.recipientName} a year-in-review.`
    : 'A year-in-review, made with love.';

  /* ---- moment screens ---- */
  const momentScreens = moments.map(function (m, i) {
    const svg       = SVGS[i % SVGS.length];
    const count     = m.count != null ? Number(m.count) : 0;
    const unit      = m.unit    ? escape(m.unit)    : '';
    const caption   = m.caption ? escape(m.caption) : '';
    const gradClass = i % 2 === 0 ? 'g-b' : 'g-a';
    return `
  <!-- moment ${i + 1} -->
  <section class="screen ${gradClass}" data-screen="${i + 2}">
    <div class="inner">
      ${svg}
      <div class="rise">
        <span class="stat-num" data-count="${count}">0</span>
        <span class="stat-unit">${unit}</span>
      </div>
      ${caption ? `<p class="caption rise d1">${caption}</p>` : ''}
    </div>
  </section>`;
  }).join('');

  const songScreenIndex  = moments.length + 2;
  const closeScreenIndex = moments.length + 3;

  /* ---- song link → YouTube embed or branded play link ---- */
  const ytId = youtubeId(d.songUrl);
  const svc  = (!ytId && d.songUrl) ? linkBrand(d.songUrl) : '';
  const songLink = (!ytId && d.songUrl)
    ? `<a class="play-link${svc ? ' svc-' + svc : ''}" href="${escape(d.songUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Play our song in ${escape(linkService(d.songUrl))}">&#9654; Play in ${escape(linkService(d.songUrl))}${serviceGlyph(svc)}</a>`
    : '';
  const songEmbed = ytId
    ? `<div class="song-embed"><iframe src="https://www.youtube-nocookie.com/embed/${ytId}?rel=0" title="${escape(d.songTitle || 'Our song')}" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
${head({ paigaam, opts, title, description, themeColor: '#1D1B2E' })}
<link rel="stylesheet" href="/bfday/bgm.css">
<style>:root { --bgm-accent: #E8B4B8; }</style>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@900&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400;1,9..144,500&family=Caveat:wght@500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/our-wrapped/wrapped.css">
<script src="/our-wrapped/wrapped.js" defer></script>
</head>
<body data-preview="${preview}">
${previewBadge(opts)}
${jsonPayload('wrPayload', { screenCount: moments.length + 3 })}

<nav class="dots" id="dots" aria-label="Screen progress"></nav>

<main class="deck" id="deck">

  <!-- screen 1 · title -->
  <section class="screen g-a" id="s1" data-screen="1">
    <div class="inner">
      <p class="eyebrow rise">a year of us</p>
      <h1 class="title rise d1">Our Wrapped<br>${escape(year)}</h1>
      <div class="rise d2">
        <span class="stat-num" data-count="${days}">0</span>
        <span class="stat-unit">days of us</span>
      </div>
      <p class="caption rise d3">${escape(d.titleCaption)}</p>
    </div>
    <button class="skip" id="skipToEnd">skip to the end &rarr;</button>
  </section>
${momentScreens}
  <!-- screen ${songScreenIndex} · our song -->
  <section class="screen g-a" id="s-song" data-screen="${songScreenIndex}">
    <div class="inner">
      <p class="eyebrow coral rise">on repeat since day one</p>
      <div class="song-card rise d1">
        ${VINYL_SVG}
        <div class="song-meta">
          <div class="song-title">${escape(d.songTitle)}</div>
          <div class="song-artist">${escape(d.songArtist)}</div>
        </div>
        ${songEmbed}
        ${songLink}
      </div>
      <p class="caption rise d2">${escape(d.songCaption)}</p>
    </div>
  </section>

  <!-- screen ${closeScreenIndex} · closing -->
  <section class="screen g-b" id="s-close" data-screen="${closeScreenIndex}">
    <div class="inner">
      <p class="closing-note rise">${multiline(d.closingNote)}</p>
      <div class="mini-card rise d1" role="img" aria-label="Summary card: our year together">
        <div class="mini-names">${escape(sender)}&nbsp;&amp;&nbsp;${escape(recipient)}</div>
        <div class="mini-days">${escape(fmt(days))}<span>days of us</span></div>
        <div class="mini-date">since ${escape(d.startDate)}</div>
        <div class="made-with">made with love, for you &#9825;</div>
      </div>
      <p class="paigaam rise d2">made with <a href="/">Paigaam</a></p>
    </div>
  </section>

</main>
${bgmMarkup(bgm, 'our song')}
${bgmScript(bgm)}
</body>
</html>`;
}

module.exports = { render };
