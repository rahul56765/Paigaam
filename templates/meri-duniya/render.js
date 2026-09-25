'use strict';
/**
 * Meri Duniya renderer.
 *
 * Emits the whole website as server-rendered HTML — every section, every
 * reason, every milestone and the complete letter — so it survives a failed
 * script, a screen reader or a share-preview crawler. /meri-duniya/duniya.js
 * only adds the motion: the opening heartbeat, the envelope tear, the
 * typewriter, the flips, the count-ups, the slideshow and the progress heart.
 *
 * Sections are optional. A section switched off or left empty is not in the
 * page at all, and the rest are numbered 01, 02, 03… in the order they
 * appear, so the journey never shows a gap.
 *
 * Every piece of sender text is HTML-escaped here; there is no client-side
 * templating. Photos are upload URLs validated by the engine.
 */
const config = require('./config');
const schema = require('./schema');
const { resolve } = require('../../lib/bfday/fields');
const { escape, multiline, jsonPayload, head, previewBadge } = require('../../lib/bfday/page');
const { youtubeId, songCard, songScript } = require('../../lib/bfday/song');

const IST_OFFSET_MS = 330 * 60000;   // Asia/Kolkata, no DST

/** Whole days from YYYY-MM-DD to today in Asia/Kolkata; null when blank or in the future. */
function daysSince(iso, now = Date.now()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  const start = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const t = new Date(now + IST_OFFSET_MS);
  const today = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  const days = Math.round((today - start) / 86400000);
  return days >= 0 ? days : null;
}

function humanDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${+m[3]} ${months[+m[2] - 1]} ${m[1]}`;
}

function paragraphs(text) {
  return String(text || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
}

const HEART_PATH = 'M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.1c2.1-.2 3.7.9 5.4 2.9 1.7-2 3.3-3.1 5.4-2.9 3.7.4 5.7 4.3 4.2 7.7C19.5 16.4 12 21 12 21z';
const heartSVG = (cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${HEART_PATH}"/></svg>`;

function sectionHead(num, kicker, title, id) {
  return `<header class="md-sec__head">
      <span class="md-num" aria-hidden="true">${num}</span>
      <p class="md-kicker">${escape(kicker)}</p>
      <h2 id="${id}">${escape(title)}</h2>
    </header>`;
}

function placeholder(i) {
  return `<div class="md-ph md-ph--${i % 4}" aria-hidden="true">${heartSVG('md-ph__heart')}</div>`;
}

/* ------------------------------------------------------------ sections */

function letterSection(d, num, who) {
  const paras = paragraphs(d.letter);
  const sender = d.senderName;
  return `<section class="md-sec md-sec--letter" id="letter" aria-labelledby="h-letter">
    ${sectionHead(num, 'Ek khat, sirf tumhare liye', 'The Letter', 'h-letter')}
    <div class="md-env" id="mdEnv">
      <article class="md-letter" id="mdLetter" aria-label="A letter for ${escape(who)}">
        <div class="md-letter__paper">
          <p class="md-letter__to">Dear ${escape(who)},</p>
          <div class="md-letter__body" id="mdLetterBody" aria-hidden="true">
${paras.map(p => `            <p class="md-type">${multiline(p)}</p>`).join('\n')}
          </div>
          <div class="md-sr">
${paras.map(p => `            <p>${multiline(p)}</p>`).join('\n')}
          </div>
          <div class="md-letter__sign">
            <p class="md-letter__closing">${escape(d.letterClosing)}</p>
            ${sender ? `<p class="md-letter__from">${escape(sender)}</p>` : ''}
          </div>
          <button type="button" class="md-skip" id="mdSkip" hidden>Tap to skip</button>
        </div>
      </article>
      <button type="button" class="md-env__cover" id="mdEnvBtn" aria-label="Tear open the envelope and read the letter">
        <span class="md-env__flap" aria-hidden="true"></span>
        <span class="md-env__for" aria-hidden="true">for <em>${escape(who)}</em></span>
        <img class="md-env__seal" src="/meri-duniya/wax-seal.webp" alt="" width="200" height="200" decoding="async">
        <span class="md-env__hint" aria-hidden="true">tap to tear it open</span>
      </button>
    </div>
  </section>`;
}

function storySection(d, num) {
  const items = d.story;
  return `<section class="md-sec md-sec--story" id="story" aria-labelledby="h-story">
    ${sectionHead(num, 'Humari kahani', 'Our Story', 'h-story')}
    <ol class="md-tl">
${items.map((m, i) => `      <li class="md-tl__item md-reveal" data-side="${i % 2 ? 'right' : 'left'}">
        <span class="md-tl__dot" aria-hidden="true"></span>
        <div class="md-tl__photo">${m.photo ? `<img src="${escape(m.photo)}" alt="${escape(m.title)}" loading="lazy" decoding="async">` : placeholder(i)}</div>
        <div class="md-tl__card"${m.caption ? ' data-expandable="true" role="button" tabindex="0" aria-expanded="false"' : ''}>
          ${m.date ? `<span class="md-chip">${escape(m.date)}</span>` : ''}
          <h3>${escape(m.title)}</h3>
          ${m.caption ? `<p class="md-tl__cap">${multiline(m.caption)}</p>
          <span class="md-tl__more" aria-hidden="true">tap to read</span>` : ''}
        </div>
      </li>`).join('\n')}
    </ol>
  </section>`;
}

function reasonsSection(d, num) {
  const reasons = d.reasons;
  const n = reasons.length;
  return `<section class="md-sec md-sec--reasons" id="reasons" aria-labelledby="h-reasons">
    ${sectionHead(num, 'Wajahein', 'Reasons I Love You', 'h-reasons')}
    <p class="md-badge"><span>${n}</span> ${n === 1 ? 'reason' : 'reasons'} and counting</p>
    <ul class="md-notes">
${reasons.map((r, i) => `      <li class="md-reveal" style="--tilt:${[-2.5, 1.8, -1.2, 2.4, -2, 1.1][i % 6]}deg">
        <button type="button" class="md-note md-note--${i % 3}" aria-pressed="false" aria-label="Reason ${i + 1}: ${escape(r)}">
          <span class="md-note__inner" aria-hidden="true">
            <span class="md-note__front"><b>#${String(i + 1).padStart(2, '0')}</b>${heartSVG()}<small>tap</small></span>
            <span class="md-note__back">${escape(r)}</span>
          </span>
        </button>
      </li>`).join('\n')}
    </ul>
  </section>`;
}

function numbersSection(d, num, days) {
  const stats = [];
  if (days != null) stats.push({ value: days.toLocaleString('en-IN'), label: days === 1 ? 'day together' : 'days together', live: true, since: humanDate(d.together) });
  for (const s of d.stats) stats.push({ value: s.value, label: s.label });
  return `<section class="md-sec md-sec--numbers" id="numbers" aria-labelledby="h-numbers">
    ${sectionHead(num, 'Hum, ginti mein', 'Us, In Numbers', 'h-numbers')}
    <div class="md-stats md-stats--${Math.min(stats.length, 4)}">
${stats.map(s => `      <div class="md-stat md-reveal">
        <span class="md-stat__val" data-count="${escape(s.value)}"${s.live ? ` data-since="${escape(d.together)}"` : ''}>${escape(s.value)}</span>
        <span class="md-stat__lbl">${escape(s.label)}</span>
        ${s.since ? `<span class="md-stat__since">since ${escape(s.since)}</span>` : ''}
      </div>`).join('\n')}
    </div>
  </section>`;
}

function gallerySection(d, num) {
  const items = d.gallery;
  // Rahul's rule: the song plays in the browser — a YouTube link becomes an
  // inline embed on tap; other services keep a branded pill. Never a bare link.
  const song = d.songTitle || d.songUrl ? songCard(d.songUrl, d.songTitle || 'Play our song', 'md-song') : '';
  return `<section class="md-sec md-sec--gallery" id="gallery" aria-labelledby="h-gallery">
    ${sectionHead(num, 'Yaadein', 'The Gallery', 'h-gallery')}
    <div class="md-gal" id="mdGal">
      <div class="md-gal__track" id="mdGalTrack" tabindex="0" role="region" aria-label="Photos — swipe or use the arrows">
${items.map((g, i) => `        <figure class="md-slide" aria-label="Photo ${i + 1} of ${items.length}">
          ${g.photo ? `<img src="${escape(g.photo)}" alt="${escape(g.caption || `Photo ${i + 1}`)}" loading="lazy" decoding="async">` : placeholder(i)}
          ${g.caption ? `<figcaption>${escape(g.caption)}</figcaption>` : ''}
        </figure>`).join('\n')}
      </div>
      ${items.length > 1 ? `<div class="md-gal__nav">
        <button type="button" class="md-gal__btn" id="mdGalPrev" aria-label="Previous photo">‹</button>
        <span class="md-gal__count" id="mdGalCount" aria-live="polite">1 / ${items.length}</span>
        <button type="button" class="md-gal__btn" id="mdGalNext" aria-label="Next photo">›</button>
      </div>` : ''}
    </div>${song}
  </section>`;
}

function questionSection(d, num) {
  return `<section class="md-sec md-sec--question" id="question" aria-labelledby="h-question">
    <header class="md-sec__head">
      <span class="md-num" aria-hidden="true">${num}</span>
      <p class="md-kicker">${escape(d.questionLead)}</p>
    </header>
    <h2 class="md-q" id="h-question">${multiline(d.question)}</h2>
    <button type="button" class="md-yes" id="mdYes">${heartSVG()}<span>${escape(d.yesLabel)}</span></button>
    <div class="md-promise" id="mdPromise">
      <p>${multiline(d.promise)}</p>
      ${d.senderName ? `<p class="md-promise__from">— ${escape(d.senderName)}</p>` : ''}
    </div>
    <footer class="md-end">
      <img class="md-end__seal" src="/meri-duniya/wax-seal.webp" alt="" width="96" height="96" loading="lazy" decoding="async">
      <p>Made with love on <a href="/">Paigaam</a></p>
    </footer>
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
  const name = d.recipientName || 'you';
  const hey = d.nickname || d.recipientName || '';
  const days = daysSince(d.together);

  // The journey: only what has content, numbered in order of appearance.
  const plan = [];
  if (d.letterOn !== 'hide' && paragraphs(d.letter).length) plan.push(n => letterSection(d, n, hey || name));
  if (d.story.length) plan.push(n => storySection(d, n));
  if (d.reasonsOn !== 'hide' && d.reasons.length) plan.push(n => reasonsSection(d, n));
  if (days != null || d.stats.length) plan.push(n => numbersSection(d, n, days));
  if (d.gallery.length) plan.push(n => gallerySection(d, n));
  plan.push(n => questionSection(d, n));
  const body = plan.map((make, i) => make(String(i + 1).padStart(2, '0'))).join('\n\n  ');

  const title = d.recipientName ? `Meri Duniya — for ${d.recipientName}` : 'Meri Duniya — a whole website, made for you';
  const description = d.senderName
    ? `${d.senderName} made you a whole website. Tap to enter.`
    : 'Someone made you a whole website. Tap to enter.';
  // Published pages remember the torn envelope per instance; previews never persist.
  const key = !preview && paigaam && paigaam.slug ? paigaam.slug : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
${head({ paigaam, opts, title, description, themeColor: '#1C1420', image: config.ogImage })}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="preload" as="image" href="/meri-duniya/wax-seal.webp" type="image/webp">
<link rel="stylesheet" href="/meri-duniya/duniya.css">
<script src="/meri-duniya/duniya.js" defer></script>
${(d.songTitle || d.songUrl) ? songScript() : ''}
<noscript><style>
  .md-open { display: none !important; }
  body.md-locked { overflow: auto !important; }
  .md-env__cover, .md-skip { display: none !important; }
  .md-letter { visibility: visible !important; max-height: none !important; }
  .md-reveal { opacity: 1 !important; transform: none !important; }
  .md-promise { opacity: 1 !important; visibility: visible !important; max-height: none !important; }
  .md-yes { display: none !important; }
  .md-note__inner { transform: none !important; }
  .md-note__front { display: none !important; }
  .md-note__back { position: static !important; transform: none !important; }
</style></noscript>
</head>
<body class="md-locked" data-preview="${preview}" data-key="${escape(key)}">
${previewBadge(opts)}
${jsonPayload('mdData', { key, together: d.together || '' })}
  <div class="md-progress" aria-hidden="true"><span id="mdBar"></span></div>
  <div class="md-fill" aria-hidden="true">${heartSVG('md-fill__line')}${heartSVG('md-fill__solid')}</div>

  <!-- 0 · THE OPENING -->
  <div class="md-open" id="mdOpen">
    <div class="md-open__heart" aria-hidden="true">${heartSVG()}</div>
    <p class="md-open__hey">Hey <em>${escape(hey || 'you')}</em>,<br>I made something for you.</p>
    <button type="button" class="md-open__enter" id="mdEnter">Tap to enter</button>
  </div>

  <main class="md-site" id="mdSite">
    <header class="md-hero">
      <p class="md-hero__eyebrow">A whole website, made for</p>
      <h1 class="md-hero__name">${escape(name)}</h1>
      <p class="md-hero__sub">Meri <em>Duniya</em></p>
      <span class="md-hero__cue" aria-hidden="true">scroll</span>
    </header>

  ${body}
  </main>
</body>
</html>`;
}

module.exports = { render, daysSince, paragraphs };
