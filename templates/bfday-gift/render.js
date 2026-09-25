'use strict';
/**
 * Tohfa (Whole Website Gift) renderer.
 *
 * Emits the complete experience server-rendered — the cover, every word of
 * the type-on list, all polaroid captions (front AND hidden backs), the song
 * card, all three bouquet notes and the full letter — so it survives a failed
 * script, a screen reader and share-preview crawlers. gift.js only adds the
 * motion: the cover hand-off, the type-on, the swipe carousel, the flips,
 * the bouquet popups, the player progress and the floating hearts.
 *
 * Every piece of sender text is HTML-escaped here; there is no client-side
 * text templating. The only client-side injection is the (already
 * URL-validated) YouTube embed src.
 */
const config = require('./config');
const schema = require('./schema');
const { resolve } = require('../../lib/bfday/fields');
const { bgmMarkup, bgmScript } = require('../../lib/bfday/bgm');
const { escape, multiline, head, previewBadge } = require('../../lib/bfday/page');

/** YouTube watch/share/shorts URL → embeddable id, or ''. */
function youtubeId(url) {
  if (typeof url !== 'string' || !url) return '';
  const m = url.match(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/);
  return m ? m[1] : '';
}

function renderWords(d) {
  return d.words.map((w, i) =>
    `        <li class="word-line" style="--i:${i}">${escape(w)}</li>`).join('\n');
}

function renderPolaroid(photo, idx) {
  const tilt = [-3, 2, -2, 3, -3, 2][idx % 6];
  const front = photo.photo
    ? `<img src="${escape(photo.photo)}" alt="${escape(photo.caption || 'a polaroid photo')}" loading="lazy">`
    : `<div class="ph" aria-hidden="true"><span class="ph-heart">♥</span></div>`;
  return `
      <div class="flip" role="listitem">
        <button class="flip-btn" type="button" style="--tilt:${tilt}deg" aria-label="${escape(photo.caption ? 'Flip photo: ' + photo.caption : 'Flip photo ' + (idx + 1))}">
          <span class="flip-inner">
            <span class="face front">
              ${front}
              <span class="cap">${escape(photo.caption || '')}</span>
              <img class="tape" src="/assets/bfday-gift/washi.png" alt="" aria-hidden="true">
            </span>
            <span class="face back">
              <span class="back-note">${escape(photo.hidden || photo.caption || '')}</span>
              <span class="back-star" aria-hidden="true">★</span>
            </span>
          </span>
        </button>
      </div>`;
}

function renderBouquet(item, idx) {
  return `
      <button class="bqt" type="button" data-note="${idx}" aria-label="Open ${escape(item.label || 'bouquet ' + (idx + 1))}">
        <img src="/assets/bfday-gift/bouquet-${idx + 1}.png" alt="${escape(item.label || 'a paper bouquet')}" loading="lazy">
        <span class="bqt-label">${escape(item.label || '')}</span>
      </button>`;
}

function renderNoteCard(item, idx) {
  return `
      <div class="bnote" role="dialog" aria-modal="false" aria-label="A note tucked inside ${escape(item.label || 'the bouquet')}" data-note-card="${idx}" hidden>
        <p class="bnote-text">${multiline(item.note)}</p>
        <p class="bnote-from">— tucked inside ${escape(item.label || 'this bouquet')}</p>
        <button class="bnote-close" type="button" data-note-close="${idx}" aria-label="Close this note">×</button>
      </div>`;
}

function coverHeadline(line) {
  // "happy Boyfriend's Day" → "happy<br>Boyfriend's Day" (manual break keeps
  // "Day" off a line of its own); anything else renders on one balanced line.
  const v = String(line || '');
  const m = v.match(/^(\S+)\s+(.+)$/);
  if (m && v.length > 12) return `${escape(m[1])}<br>${escape(m[2])}`;
  return escape(v);
}

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id, … })
 * @param opts     { baseUrl, isPreview }
 */
function render(paigaam = {}, opts = {}) {
  const d = resolve(config, paigaam && paigaam.customer_data, schema);
  const bgm = d.bgmSong || '';
  const preview = !!opts.isPreview;

  const who = d.recipientName || 'you';
  const title = `${d.occasionLine} — a whole website for ${who} · Paigaam`;
  const description = d.senderName
    ? `${d.senderName} made ${who} a whole website as a gift. Tap to open it.`
    : 'Someone made you a whole website as a gift. Tap to open it.';

  const ogImage = d.wordsPhoto || (d.photos.find(p => p.photo) || {}).photo || config.ogImage;
  const ytId = youtubeId(d.songUrl);
  const wordsPhoto = d.wordsPhoto
    ? `<img src="${escape(d.wordsPhoto)}" alt="a photo of the two of you" loading="lazy">`
    : `<img src="/assets/bfday-gift/bunny.png" alt="the little bunny mascot" loading="lazy" class="ph-bunny">`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
${head({ paigaam, opts, title, description, themeColor: '#CFE6F6', image: ogImage })}
<link rel="stylesheet" href="/bfday/bgm.css">
<style>:root { --bgm-accent: #D63D6C; }</style>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Pacifico&family=Caveat:wght@500;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/bfday-gift/gift.css">
<script src="/bfday-gift/gift.js" defer></script>
<noscript><style>
  .cover { display: none; }
  main.gift { display: block !important; }
  .word-line, .flip, .bqt, .song-card, .letter-card { opacity: 1 !important; transform: none !important; transition: none !important; }
  .flip-inner { transform: none !important; }
</style></noscript>
</head>
<body data-preview="${preview}">
${previewBadge(opts)}

  <!-- SCENE 1 · THE COVER -->
  <section class="cover" id="cover" aria-label="The cover of your gift">
    <img class="cover-stars s1" src="/assets/bfday-gift/stars.png" alt="" aria-hidden="true">
    <img class="cover-stars s2" src="/assets/bfday-gift/stars.png" alt="" aria-hidden="true">
    <div class="cover-inner">
      <h1 class="cover-headline">${coverHeadline(d.occasionLine)}</h1>
      <p class="cover-name">for <strong>${escape(who)}</strong></p>
      <button class="bunny-btn" id="bunnyBtn" type="button" aria-label="Open your gift">
        <img src="/assets/bfday-gift/bunny.png" alt="the little bunny mascot, waving">
        <span class="click-tag" aria-hidden="true">click me</span>
      </button>
      <p class="cover-hint" aria-hidden="true">a whole website, just for you</p>
    </div>
  </section>

  <main class="gift" id="gift">

    <!-- SCENE 2 · THE WORD LIST -->
    <section class="scene words-scene" aria-label="${escape(d.wordsHeading)}">
      <h2 class="scene-head">${escape(d.wordsHeading)}</h2>
      <div class="words-wrap">
        <figure class="words-photo polaroid">
          ${wordsPhoto}
          <img class="tape" src="/assets/bfday-gift/washi.png" alt="" aria-hidden="true">
        </figure>
        <ul class="word-list" id="wordList">
${renderWords(d)}
        </ul>
      </div>
    </section>

    <!-- SCENE 3 · THE POLAROID GALLERY -->
    <section class="scene gallery-scene" aria-label="${escape(d.galleryHeading)}">
      <h2 class="scene-head">${escape(d.galleryHeading)}</h2>
      <p class="scene-sub">swipe · tap one to flip it over</p>
      <div class="carousel" id="carousel" role="list" aria-label="A carousel of polaroid photos">
${d.photos.map((photo, idx) => renderPolaroid(photo, idx)).join('\n')}
      </div>
      <div class="dots" id="dots" aria-hidden="true"></div>
    </section>

    <!-- SCENE 4 · THE SONG -->
    <section class="scene song-scene" aria-label="Your song">
      <h2 class="scene-head">our song</h2>
      ${ytId ? `<div class="yt-wrap"><iframe src="https://www.youtube-nocookie.com/embed/${escape(ytId)}" title="${escape(d.songTitle || 'your song')}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>` : ''}
      <div class="song-card" id="songCard">
        <div class="disc" aria-hidden="true"><span class="disc-heart">♥</span></div>
        <div class="song-meta">
          <p class="song-title">${escape(d.songTitle || '')}</p>
          <p class="song-artist">${escape(d.songArtist || '')}</p>
          <div class="bar" id="songBar" role="progressbar" aria-label="Playing ${escape(d.songTitle || 'your song')}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <span class="bar-fill" id="songFill"></span>
          </div>
          <p class="bar-times"><span id="songNow">0:00</span><span>3:33</span></p>
        </div>
        <button class="heart-btn" id="heartBtn" type="button" aria-label="Love this song" aria-pressed="false">
          <svg viewBox="0 0 30 27" aria-hidden="true"><path d="M15 25 C 8 19, 2 14, 2 8.5 C 2 4.5, 5 2, 8.5 2 C 11.5 2, 14 4, 15 6.5 C 16 4, 18.5 2, 21.5 2 C 25 2, 28 4.5, 28 8.5 C 28 14, 22 19, 15 25 Z"/></svg>
        </button>
      </div>
    </section>

    <!-- SCENE 5 · THE BOUQUETS -->
    <section class="scene bouquets-scene" aria-label="${escape(d.bouquetHeading)}">
      <h2 class="scene-head caps">${escape(d.bouquetHeading)}</h2>
      <div class="bouquets">
${d.bouquetNotes.map((item, idx) => renderBouquet(item, idx)).join('\n')}
      </div>
      <div class="bnotes" id="bnotes">
${d.bouquetNotes.map((item, idx) => renderNoteCard(item, idx)).join('\n')}
      </div>
    </section>

    <!-- SCENE 6 · THE FINAL LETTER -->
    <section class="scene letter-scene" aria-label="The final letter">
      <div class="float-hearts" id="floatHearts" aria-hidden="true"></div>
      <img class="pair" src="/assets/bfday-gift/pair.png" alt="a little cat and bunny sitting together, hearts floating above them">
      <div class="letter-card">
        <img class="tape tl" src="/assets/bfday-gift/washi.png" alt="" aria-hidden="true">
        <p class="letter-text">${multiline(d.letterText)}</p>
        <p class="letter-sign">— ${escape(d.senderName || 'me')}</p>
        <p class="letter-date">${escape(d.letterDate)}</p>
      </div>
      <footer class="end-card">
        <p>made with <a href="/" rel="noopener">paigaam.cc</a></p>
      </footer>
    </section>

  </main>
${bgmMarkup(bgm, 'our song')}
${bgmScript(bgm)}
</body>
</html>`;
}

module.exports = { render, youtubeId };
