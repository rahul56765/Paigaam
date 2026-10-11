'use strict';

const { resolve } = require('../../lib/bfday/fields');
const { escape, jsonPayload, head, previewBadge } = require('../../lib/bfday/page');
const { qrSVG } = require('../../lib/qrcode');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function formatDate(value, includeWeekday = true) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!m) return escape(value || 'Wedding date');
  const date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const day = `${includeWeekday ? date.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' }) + ', ' : ''}${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}`;
  return escape(day);
}
function photo(src, alt, cls = '') {
  return `<img class="wp-photo${cls ? ' ' + cls : ''}" src="${escape(src || '/assets/bfday-demo/couple-1.jpg')}" alt="${escape(alt)}" loading="lazy" decoding="async">`;
}
function nameSearchWord(value) {
  const first = String(value || '').trim().split(/\s+/)[0] || '';
  const letters = first.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
  return letters.length <= 20 ? first : Array.from(first).slice(0, 20).join('');
}
function wordSearchWords(data) {
  const coupleNames = [nameSearchWord(data.groomName), nameSearchWord(data.brideName)].filter(Boolean);
  const currentNames = new Set(coupleNames);
  // Older saved drafts inherited these two sample entries as ordinary words.
  // Drop them when the couple fields change so stale sample names never remain.
  const legacySampleNames = new Set(['RAGHAV', 'RAGINI']);
  const customWords = (data.wordList || []).filter(value => {
    const normalized = String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
    return !legacySampleNames.has(normalized) || currentNames.has(normalized);
  });
  const candidates = [...customWords, ...coupleNames];
  const seen = new Set();
  return candidates.map(value => String(value || '').trim()).filter(value => {
    const normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
    if (normalized.length < 2 || normalized.length > 20 || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
function lineIcon(kind, size = 26) {
  const art = {
    rings: '<circle cx="8.5" cy="13" r="5.5"/><circle cx="15.5" cy="13" r="5.5"/><path d="m11 7.8 1.5-2.4 3 1.8M19 7.5l1.2-2"/>',
    camera: '<path d="M3 8.5h4l2-3h6l2 3h4a1.5 1.5 0 0 1 1.5 1.5v9H1.5v-9A1.5 1.5 0 0 1 3 8.5Z"/><circle cx="12" cy="13.5" r="4"/><path d="M18 11h.01"/>',
    dinner: '<path d="M4 14a8 8 0 0 1 16 0M3 14h18M6 17h12M8 6.5c-1-1 1-1.7 0-2.8M12 6c-1-1 1-1.7 0-2.8M16 6.5c-1-1 1-1.7 0-2.8"/>',
    cake: '<path d="M2 21h10V11H2v10ZM4 11V7h6v4M7 7V3M2 16h10M18 6a2 2 0 1 0 .01 0M22 8a2 2 0 1 0 .01 0M18 8l2 4 2-2M18 12l-2 5M20 12l3 5M17 6l-2 2"/>',
    sparkler: '<path d="m5 20 12-12M17 8l1-5m-1 5 5 1m-5-1-3-4m3 4 4-4m-4 4-1 5M4 15l-2-2M9 7 7 5"/>',
    meet: '<circle cx="8" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><path d="M2 20c0-4 2-7 6-7s6 3 6 7M13 15c1-2 2-3 4-3 3 0 5 3 5 7M12 9l1 2 2-1"/>',
    travel: '<path d="m3 13 7-2 4-7c.5-1 2-1 2 0l-2 7 6 2c1 .5 1 2-.2 2.2L13 14l-4 5-1-.3 1.5-5.3-5.5 1.3-2-1.1Z"/>',
    coffee: '<path d="M5 9h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V9ZM17 10h2a2 2 0 1 1 0 4h-2M4 22h15M8 5c-1-1 1-2 0-3M12 5c-1-1 1-2 0-3M16 5c-1-1 1-2 0-3"/>',
    pizza: '<path d="M3 5c6-4 12-4 18 0l-9 17L3 5Z"/><path d="M3 5c6 1 12 1 18 0"/><circle cx="9" cy="8" r="1"/><circle cx="14" cy="8" r="1"/><circle cx="11" cy="13" r="1"/>',
  }[kind] || '<path d="M4 12h16M12 4v16"/>';
  return `<svg class="wp-icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${art}</svg>`;
}
function lineHeart() {
  return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20.8 8.8c0 5.1-8.8 11-8.8 11s-8.8-5.9-8.8-11A4.7 4.7 0 0 1 12 6.4a4.7 4.7 0 0 1 8.8 2.4Z"/></svg>';
}
function groomArt() {
  return '<svg viewBox="0 0 64 80" class="wp-person" role="img" aria-label="Simple line drawing of the groom"><path d="M18 17c0-9 6-14 14-14s14 5 14 14v5H18z"/><path d="M19 18h27M22 19v8c0 7 4 11 10 11s10-4 10-11v-8M25 27h.5m13 0h.5M27 33c3 2 7 2 10 0M17 44l15-5 15 5 8 30H9zM24 43l8 12 8-12M32 55v19M22 20l4-7 6 4 6-4 5 7"/></svg>';
}
function brideArt() {
  return '<svg viewBox="0 0 64 80" class="wp-person" role="img" aria-label="Simple line drawing of the bride"><path d="M12 29c0-16 8-25 20-25s20 9 20 25v9l-7-8-2-9c-7 5-16 7-26 7l-5 10z"/><path d="M20 29v7c0 8 5 13 12 13s12-5 12-13v-7M24 36h.5m15-.5h.5M28 43c3 2 6 2 9 0M21 50l11-3 11 3 9 24H12zM18 58l14 16 14-16M32 51v23M44 7l8 2"/></svg>';
}

function render(paigaam, opts = {}) {
  const config = require('./config');
  const d = resolve(config, paigaam && paigaam.customer_data);
  const couple = `${d.groomName} & ${d.brideName}`;
  const dateText = formatDate(d.weddingDate);
  const shortDate = formatDate(d.weddingDate, false);
  const stats = d.stats || [];
  const facts = d.funFacts || [];
  const moments = d.storyPhotos || [];
  const thankPhotos = d.thankPhotos || [];
  const events = d.timeline || [];
  const words = wordSearchWords(d);
  const now = new Date();
  const printDate = `${MONTHS[now.getUTCMonth()].toUpperCase()} ${now.getUTCFullYear()}`;
  const qr = d.mapLink ? qrSVG(d.mapLink, { module: 2, margin: 3, dark: '#22211F', light: '#F1EDE5' }) : '<span class="wp-qr-empty">Paste a map link<br>to make your QR</span>';
  const pages = [
    `<article class="wp-page wp-page--front" data-page="0" aria-label="Page 1: wedding invitation">
      <header class="wp-masthead"><span class="wp-kicker">SPECIAL<br>EDITION</span><h1>The Wedding Post</h1><span class="wp-kicker">${escape(printDate)}<br>WEDDING ISSUE</span></header>
      <div class="wp-front-meta"><span>VOL. 01, NO. 01</span><span>✦</span><span>SPECIAL EDITION</span><span>✦</span><span>${escape(shortDate.toUpperCase())}</span></div>
      <h2 class="wp-front-headline">A Wedding Celebration</h2>
      <div class="wp-double-rule"></div>
      <div class="wp-front-feature">
        <section class="wp-about">
          <h3>About the couple</h3>
          <div class="wp-rule"></div>
          <p class="wp-about-intro">With joy, we invite you to celebrate the wedding of</p>
          <p class="wp-name">${escape(d.groomName)}</p><p class="wp-parentline">son of ${escape(d.groomParents)}</p>
          <p class="wp-with">and</p>
          <p class="wp-name">${escape(d.brideName)}</p><p class="wp-parentline">daughter of ${escape(d.brideParents)}</p>
        </section>
        <div class="wp-front-portrait">${photo(d.frontPhoto, `Black-and-white placeholder couple portrait for ${couple}`)}</div>
      </div>
      <div class="wp-front-lower">
        <figure class="wp-front-small">${photo(d.frontDetailPhoto, 'Black-and-white placeholder photograph of the couple', 'wp-photo--detail')}<figcaption>A NEW CHAPTER, SHARED WITH YOU</figcaption></figure>
        <div class="wp-date-box"><span class="wp-date-day">${escape(shortDate.split(' ')[0])}</span><span class="wp-date-month">${escape(shortDate.split(' ').slice(1).join(' '))}</span><span class="wp-date-time">${escape(d.weddingTime)}</span><span class="wp-date-venue">${escape(d.venueName)}<br>${escape(d.venueAddress)}</span></div>
        <section class="wp-join"><h3>Join Us</h3><div class="wp-rule"></div><p>${escape(d.joinMessage)}</p></section>
      </div>
      <footer class="wp-page-foot"><span>THE WEDDING POST</span><span>01 · 05</span></footer>
    </article>`,

    `<article class="wp-page wp-page--save" data-page="1" aria-label="Page 2: Save the Date">
      <header class="wp-save-masthead"><span>SPECIAL EDITION</span><b>The Wedding Post</b><span>SPECIAL EDITION</span></header>
      <div class="wp-save-submeta"><span>VOL. 01, NO. 01</span><span>✦</span><span>SAVE THE DATE</span><span>✦</span><span>${escape(shortDate.toUpperCase())}</span></div>
      <h2 class="wp-save-title"><span>SAVE</span><em>the</em><span>DATE</span></h2>
      <div class="wp-double-rule"></div>
      <div class="wp-save-photo">${photo(d.saveDatePhoto, `Black-and-white placeholder photo of ${couple}`)}</div>
      <div class="wp-double-rule"></div>
      <h3 class="wp-save-names">${escape(couple)}</h3>
      <p class="wp-save-script">are getting married</p>
      <p class="wp-save-date">${escape(dateText)} · ${escape(d.weddingTime)}</p>
      <footer class="wp-page-foot"><span>THE WEDDING POST</span><span>02 · 05</span></footer>
    </article>`,

    `<article class="wp-page wp-page--story" data-page="2" aria-label="Page 3: The Love Story">
      <div class="wp-story-toprule"></div>
      <div class="wp-stats">${stats.map(s => `<div class="wp-stat">${lineIcon(s.icon, 22)}<b>${escape(s.value)}</b><span>${escape(s.label)}</span></div>`).join('')}</div>
      <div class="wp-story-columns">
        <section class="wp-story-card"><h2><span>The Love</span><em>Story</em></h2><p>${escape(d.storyText)}</p><blockquote>“${escape(d.storyQuote)}”</blockquote></section>
        <section class="wp-facts-card"><h2><span>Fun Facts About</span><em>the Couple</em></h2><div class="wp-facts">${facts.map(f => `<p>${lineHeart()}<span>${escape(f)}</span></p>`).join('')}</div></section>
      </div>
      <div class="wp-moments">${moments.map(m => `<figure class="wp-moment">${photo(m.photo, `Black-and-white placeholder photo: ${m.caption}`)}<figcaption><b>${escape(m.caption)}</b><span>${escape(m.date)}</span></figcaption></figure>`).join('')}</div>
      <div class="wp-story-bottomrule"></div>
      <footer class="wp-page-foot"><span>THE WEDDING POST</span><span>03 · 05</span></footer>
    </article>`,

    `<article class="wp-page wp-page--thanks" data-page="3" aria-label="Page 4: Our Wedding Post thank you">
      <header class="wp-thanks-masthead"><h2>Our Wedding Post</h2><div class="wp-double-rule"></div></header>
      <section class="wp-thanks-message"><h3>With Thanks</h3><div class="wp-rule"></div><p>${escape(d.thankYouMessage)}</p></section>
      <div class="wp-thanks-photos">${thankPhotos.map(p => `<figure>${photo(p.photo, `Black-and-white placeholder couple photo: ${p.caption}`)}<figcaption>${escape(p.caption)}</figcaption></figure>`).join('')}</div>
      <footer class="wp-page-foot"><span>THE WEDDING POST</span><span>04 · 05</span></footer>
    </article>`,

    `<article class="wp-page wp-page--games" data-page="4" aria-label="Page 5: Wedding Day games">
      <header class="wp-games-header"><div><h2>Wedding Day Timeline</h2><p>Look forward to an amazing day</p></div><span class="wp-sparkle" aria-hidden="true">✦</span></header>
      <div class="wp-timeline" style="--event-count:${Math.max(1, events.length)};--timeline-content-width:${Math.max(100, events.length * 20)}%" aria-label="Wedding day event timeline" tabindex="0"><div class="wp-timeline-track"><div class="wp-timeline-line" aria-hidden="true"></div>${events.map((event, i) => {
        const copySide = i % 2 ? 'top' : 'bottom';
        const iconSide = i % 2 ? 'bottom' : 'top';
        return `<div class="wp-event wp-event--copy-${copySide} wp-event--icon-${iconSide}" data-event="${i}"><span class="wp-event-icon${event.icon === 'sparkler' ? ' wp-event-icon--sparkler' : ''}">${lineIcon(event.icon, 25)}</span><span class="wp-event-heart" aria-hidden="true">♥</span><span class="wp-event-copy"><b class="wp-event-time">${escape(event.time)}</b><span class="wp-event-name">${escape(event.name)}</span></span></div>`;
      }).join('')}</div></div>
      <div class="wp-games-columns">
        <section class="wp-game-panel wp-word-panel"><h3>Wedding Word Search</h3><p class="wp-word-list" id="wpWordList"></p><div class="wp-word-grid" id="wpWordGrid" role="grid" aria-label="Word search letter grid"></div><p class="wp-game-hint" id="wpWordHint" aria-live="polite">Tap and drag across the letters to find each word.</p><div class="wp-celebrate" id="wpWordCelebrate" hidden>All found! Cheers to ${escape(couple)}!</div></section>
        <section class="wp-game-panel wp-maze-panel"><h3>Wedding Maze</h3><p class="wp-maze-subtitle">Help the groom get to the wedding</p><div class="wp-maze-stage"><div class="wp-maze-label wp-groom-label">${groomArt()}</div><div class="wp-maze-board" id="wpMaze" role="grid" aria-label="Wedding maze"></div><div class="wp-maze-label wp-bride-label">${brideArt()}</div><p class="wp-maze-win" id="wpMazeWin" hidden>You reached the wedding!</p></div><div class="wp-maze-controls" aria-label="Maze movement controls"><button type="button" data-move="up" aria-label="Move up">↑</button><div><button type="button" data-move="left" aria-label="Move left">←</button><button type="button" data-move="down" aria-label="Move down">↓</button><button type="button" data-move="right" aria-label="Move right">→</button></div></div></section>
      </div>
      <div class="wp-games-bottom">
        <section class="wp-memory"><h3>In Loving Memory</h3><div class="wp-memory-heart" aria-hidden="true">♥</div><p>${escape(d.memoryMessage)}</p></section>
        <section class="wp-qr-card"><div class="wp-qr">${qr}</div><h3>QR Code</h3><p>RECEPTION LOCATION</p>${d.mapLink ? `<a href="${escape(d.mapLink)}" target="_blank" rel="noopener noreferrer">Open map</a>` : ''}</section>
      </div>
      <footer class="wp-page-foot"><span>THE WEDDING POST</span><span>05 · 05</span></footer>
      ${jsonPayload('wpGameData', { words })}
    </article>`,
  ];

  const names = ["The Wedding Post", 'Save the Date', 'The Love Story', 'Our Wedding Post', 'Wedding Day'];
  const title = opts.title || `${couple} · The Wedding Post`;
  const description = `${dateText} · ${d.venueName}, ${d.venueAddress} · A five-page wedding newspaper from Paigaam.`;
  const controls = `<nav class="wp-controls" aria-label="Newspaper pages"><button type="button" id="wpPrev" aria-label="Previous page">← Previous</button><span id="wpPageStatus" aria-live="polite">Page 1 of 5 · ${names[0]}</span><button type="button" id="wpNext" aria-label="Next page">Next →</button></nav><div class="wp-dots" aria-label="Choose a page">${pages.map((_, i) => `<button type="button" data-page-go="${i}" aria-label="Go to page ${i + 1}"${i === 0 ? ' aria-current="page"' : ''}></button>`).join('')}</div>`;
  const bg = '#f1ede5';
  return `<!doctype html><html lang="en" style="--wp-bg:${bg};--wp-ink:#242321"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
    ${head({ paigaam, opts, title, description, themeColor: bg, image: d.frontPhoto || config.ogImage })}
    <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400;6..96,500;6..96,600;6..96,700&family=DM+Sans:wght@400;500;600;700&family=Great+Vibes&family=IM+Fell+English:ital@0;1&family=UnifrakturCook:wght@700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/wedding-post/post.css?v=2">
  </head><body class="wp-body" data-preview="${!!opts.isPreview}">
    ${previewBadge(opts)}
    <main class="wp-reader"><div class="wp-book" id="wpBook">${pages.join('')}</div>${controls}<p class="wp-footer-mark">A keepsake edition · made with Paigaam</p></main>
    <script src="/wedding-post/games.js?v=2" defer></script><script src="/wedding-post/post.js?v=2" defer></script>
  </body></html>`;
}

module.exports = { render, formatDate, lineIcon };
