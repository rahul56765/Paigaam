'use strict';
/**
 * Birthday Paigaam renderer.
 *
 * Emits all seven screens as server-rendered HTML: every personalised word
 * is in the document (share previews, screen readers and a failed script all
 * still get the real letter), while /birthday-paigaam/experience.js only
 * drives the screen machine, the interactions, the canvas layers and sound.
 *
 * renderBirthday(paigaam, opts)
 *   opts.baseUrl     absolute origin for share tags
 *   opts.isPreview   owner / wizard / demo render (not the published page)
 *   opts.mode        'published' | 'preview' | 'demo' | 'live' | 'thumb'
 *   opts.start       a screen to open on (preview modes only)
 *   opts.skipLock    open past the passcode (preview modes only)
 */
const D = require('./defaults');
const art = require('./art');

const esc = value => String(value == null ? '' : value)
  .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** FNV-1a (32-bit) — the passcode is a playful lock, not a vault; this just keeps it out of plain sight. */
function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/** JSON for a <script type="application/json"> block. */
const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

const TAPES = ['blush', 'lav', 'peach', 'acc'];
const TILTS = [-4, 3, -2, 5, -5, 2, 4, -3];

function makeContext(d) {
  const name = d.recipientName || D.TEXT.recipientName;
  const sender = d.senderName || D.TEXT.senderName;
  const age = d.age || '';
  /** Escape, then fill [NAME]/[SENDER]/[AGE]. */
  const sub = raw => esc(raw)
    .replace(/\[NAME\]/gi, esc(name))
    .replace(/\[SENDER\]/gi, esc(sender))
    .replace(/\[AGE\]/gi, esc(age));
  /** Plain-text version (for JSON payloads and attributes the browser escapes). */
  const plain = raw => String(raw == null ? '' : raw)
    .replace(/\[NAME\]/gi, name).replace(/\[SENDER\]/gi, sender).replace(/\[AGE\]/gi, age);
  const t = key => (typeof d[key] === 'string' && d[key].trim()) ? d[key].trim() : D.TEXT[key];
  const listOr = (key, fallback) => (Array.isArray(d[key]) && d[key].length ? d[key] : fallback);
  return { name, sender, age, sub, plain, t, listOr };
}

/* ----------------------------------------------------------------- screens */

function unlockScreen(c, d, opts) {
  const fx = d.photoFocus && Number.isFinite(d.photoFocus.x) ? d.photoFocus.x : 50;
  const fy = d.photoFocus && Number.isFinite(d.photoFocus.y) ? d.photoFocus.y : 50;
  const photo = d.mainPhoto
    ? `<img class="bp-frame__photo" src="${esc(d.mainPhoto)}" alt="${esc(c.name)}" decoding="async" fetchpriority="high" style="object-position:${fx}% ${fy}%">`
    : art.cameoPlaceholder(esc((c.name || '♡').trim().slice(0, 1).toUpperCase()), opts.invite);
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(k => `<button type="button" class="bp-key" data-key="${k}">${k}</button>`).join('');
  return `<section class="bp-screen bp-unlock" data-screen="unlock" aria-labelledby="bpUnlockTitle">
  <div class="bp-unlock__grid">
    <div class="bp-unlock__hero">
      <h1 id="bpUnlockTitle" class="bp-title"><span class="bp-title__orn" aria-hidden="true"><i></i>✦<i></i></span><span class="bp-title__main">unlock</span><span class="bp-title__script">for surprise</span></h1>
      <div class="bp-unlock__art">
        <div class="bp-frame"><div class="bp-frame__hole">${photo}</div>${art.cameoFrame()}<span class="bp-frame__glint" aria-hidden="true"></span></div>
        <span class="bp-deco bp-deco--s1">${art.sparkle()}</span>
        <span class="bp-deco bp-deco--s3">${art.sparkle()}</span>
      </div>
    </div>
    <div class="bp-card bp-wavy bp-keypad">
      <p class="bp-keypad__label">Enter passcode</p>
      <div class="bp-boxes" role="img" aria-label="Passcode, 0 of 4 digits entered">
        <span class="bp-box"></span><span class="bp-box"></span><span class="bp-box"></span><span class="bp-box"></span>
      </div>
      <p class="bp-keypad__msg" role="status" aria-live="polite"></p>
      <div class="bp-keys">
        ${keys}
        <button type="button" class="bp-key bp-key--soft" data-key="clear" aria-label="Clear">clear</button>
        <button type="button" class="bp-key" data-key="0">0</button>
        <button type="button" class="bp-key bp-key--soft" data-key="back" aria-label="Delete last digit">⌫</button>
      </div>
      <button type="button" class="bp-pill bp-enter">ENTER</button>
      <p class="bp-hint"${opts.showHint ? '' : ' hidden'}>${art.heart('f-acc')} <span>${c.sub(c.t('passcodeHint'))}</span></p>
    </div>
  </div>
</section>`;
}

function questionScreen(c) {
  return `<section class="bp-screen bp-question" data-screen="question" aria-labelledby="bpQuestion">
  <div class="bp-q">
    <div class="bp-q__ask">
      <div class="bp-q__cardwrap">
        <div class="bp-q__bunny">${art.peekBunny()}</div>
        <div class="bp-card bp-wavy bp-q__card"><p id="bpQuestion" class="bp-q__text">${c.sub(c.t('question'))}</p></div>
      </div>
      <p class="bp-q__nudge" aria-live="polite"></p>
      <div class="bp-q__buttons">
        <button type="button" class="bp-pill bp-yes">${c.sub(c.t('yesLabel'))}</button>
        <button type="button" class="bp-pill bp-pill--ghost bp-no">${c.sub(c.t('noLabel'))}</button>
      </div>
    </div>
    <div class="bp-q__no" hidden>
      <h2 class="bp-q__nohead" aria-live="assertive">${c.sub(D.NO_MESSAGES[0])}</h2>
      <button type="button" class="bp-pill bp-again">${c.sub(c.t('tryAgainLabel'))} <span aria-hidden="true">↺</span></button>
      <div class="bp-q__duo">${art.noDuo()}</div>
    </div>
  </div>
</section>`;
}

function letterScreen(c) {
  const paragraphs = c.t('letter').split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p data-type>${c.sub(p).replace(/\n/g, '<br>')}</p>`).join('');
  return `<section class="bp-screen bp-letterscreen" data-screen="letter" aria-label="Your letter">
  <div class="bp-scene">
    <div class="bp-env" role="button" tabindex="0" aria-label="Open the envelope">
      <div class="bp-env__back"></div>
      <div class="bp-env__paper"><i></i><i></i><i></i></div>
      ${art.envelopeFront2()}
      <p class="bp-env__to"><span class="bp-env__tolabel">for</span> ${esc(c.name)}</p>
      <div class="bp-env__stamp">${art.stamp2()}</div>
      <div class="bp-env__postmark">${art.postmark()}</div>
      <div class="bp-env__flap">${art.envelopeFlap2()}</div>
      <div class="bp-env__ribbonwrap">${art.envelopeRibbon()}</div>
      <div class="bp-env__seal">${art.waxSeal2(esc((c.sender || '♡').trim().slice(0, 1).toUpperCase()))}</div>
    </div>
    <p class="bp-env__hint">tap to open <span aria-hidden="true">✉</span></p>
    <article class="bp-letter" aria-label="Letter from ${esc(c.sender)}">
      <div class="bp-letter__folds" aria-hidden="true"><span class="bp-fold bp-fold--a"></span><span class="bp-fold bp-fold--b"></span><span class="bp-fold bp-fold--c"></span></div>
      <div class="bp-letter__body">
        <span class="bp-letter__tape" aria-hidden="true"></span>
        <span class="bp-letter__sticker" aria-hidden="true">${art.heartSticker()}</span>
        <p class="bp-letter__greet" data-type>${c.sub(c.t('letterGreeting'))}</p>
        <div class="bp-letter__text">${paragraphs}</div>
        <p class="bp-letter__signoff" data-type>${c.sub(c.t('signoff'))}</p>
        <p class="bp-letter__sig"><span>${esc(c.sender)}</span>${art.signatureSwash()}</p>
      </div>
    </article>
    <div class="bp-actions bp-letter__actions">
      <button type="button" class="bp-link bp-reread"><span aria-hidden="true">↺</span> read again</button>
      <button type="button" class="bp-pill" data-next>next <span aria-hidden="true">→</span></button>
    </div>
  </div>
</section>`;
}

const PLAY_ICON = '<svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg><svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.4"/><rect x="13.5" y="5" width="4" height="14" rx="1.4"/></svg>';

function playerControls(kind, label) {
  return `<div class="bp-ctrl" data-player="${kind}">
    <button type="button" class="bp-play" aria-label="${esc(label)}">${PLAY_ICON}</button>
    <div class="bp-track"><input type="range" class="bp-seek" min="0" max="1000" value="0" step="1" aria-label="Seek"><span class="bp-track__fill"></span></div>
    <span class="bp-time">0:00</span>
  </div>`;
}

function voiceScreen(c) {
  const bars = Array.from({ length: 28 }, () => '<i></i>').join('');
  return `<section class="bp-screen bp-voicescreen" data-screen="voice" aria-labelledby="bpVoiceTitle">
  <div class="bp-card bp-wavy bp-voice">
    <p class="bp-eyebrow">a voice note, just for you</p>
    <h2 id="bpVoiceTitle" class="bp-h2">${c.sub(c.t('voiceTitle'))}</h2>
    <div class="bp-cassette-wrap">${art.cassette()}<span class="bp-cassette__label">for ${esc(c.name)} ♡ side A</span></div>
    <div class="bp-wave" aria-hidden="true">${bars}</div>
    ${playerControls('voice', 'Play voice note')}
  </div>
  <div class="bp-actions"><button type="button" class="bp-pill" data-next>next <span aria-hidden="true">→</span></button></div>
</section>`;
}

function songScreen(c, d) {
  return `<section class="bp-screen bp-songscreen" data-screen="song" aria-labelledby="bpSongTitle">
  <div class="bp-card bp-wavy bp-song">
    <p class="bp-eyebrow">our song</p>
    <div class="bp-player-wrap">${art.recordPlayer()}<div class="bp-notes-fly" aria-hidden="true"></div></div>
    <h2 id="bpSongTitle" class="bp-song__title">${c.sub(c.t('songTitle'))}</h2>
    <p class="bp-song__artist">${c.sub(c.t('songArtist'))}</p>
    ${playerControls('song', 'Play our song')}
    <p class="bp-song__tip">${d.songUrl ? 'tap play — it keeps playing while you look around ♪' : 'a little music box, just for today ♪'}</p>
  </div>
  <div class="bp-actions"><button type="button" class="bp-pill" data-next>next <span aria-hidden="true">→</span></button></div>
</section>`;
}

function polaroid(p, i, c) {
  const decos = [
    `<span class="bp-pola__deco bp-pola__deco--fav">${art.doodle.arrow}<span>my favourite!</span></span>`,
    `<span class="bp-pola__deco bp-pola__deco--sticker">${art.starSticker()}</span>`,
    `<span class="bp-pola__deco bp-pola__deco--doodle">${art.doodle.hearts}</span>`,
    `<span class="bp-pola__deco bp-pola__deco--sticker2">${art.flowerSticker()}</span>`,
    `<span class="bp-pola__deco bp-pola__deco--doodle2">${art.doodle.star}</span>`,
    `<span class="bp-pola__deco bp-pola__deco--doodle3">${art.doodle.sparkle}</span>`,
  ];
  const caption = p.caption ? c.sub(p.caption) : '';
  const back = p.back ? c.sub(p.back) : 'I love this one ♡';
  return `<figure class="bp-pola" style="--tilt:${TILTS[i % TILTS.length]}deg" data-i="${i}">
    <span class="bp-tape bp-tape--${TAPES[i % TAPES.length]}" aria-hidden="true"></span>
    <button type="button" class="bp-pola__flip" aria-label="Flip photo${p.caption ? ': ' + esc(c.plain(p.caption)) : ''}" aria-pressed="false">
      <span class="bp-pola__inner">
        <span class="bp-pola__front"><span class="bp-pola__img"><img src="${esc(p.url)}" alt="${esc(c.plain(p.caption || 'A memory'))}" loading="lazy" decoding="async" draggable="false"></span><span class="bp-pola__cap">${caption}</span></span>
        <span class="bp-pola__back"><span class="bp-pola__secret">${back}</span><span class="bp-pola__turn">tap to flip back ↺</span></span>
      </span>
    </button>
    <button type="button" class="bp-pola__zoom" aria-label="Zoom in"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg></button>
    ${i < 6 ? decos[i] : ''}
  </figure>`;
}

const NOTE_COLORS = ['blush', 'cream', 'lav', 'peach'];

function scrapbookScreen(c, d, photos) {
  const screens = d.screens || D.TOGGLES;
  const notes = c.listOr('loveNotes', D.LOVE_NOTES);
  const reasons = c.listOr('reasons', D.REASONS);
  const memories = photos.length ? `<section class="bp-book__part bp-memories" aria-labelledby="bpMemTitle">
      <header class="bp-book__head"><p class="bp-script">a little scrapbook of</p><h2 id="bpMemTitle" class="bp-h1">${c.sub(c.t('memoriesTitle'))}</h2></header>
      <div class="bp-board">${photos.map((p, i) => polaroid(p, i, c)).join('')}</div>
      <p class="bp-book__tip">tap a photo to flip it · hold &amp; drag to rearrange · <span aria-hidden="true">🔍</span> to zoom &amp; swipe</p>
    </section>` : '';
  const notesPart = screens.notes !== false && notes.length ? `<section class="bp-book__part bp-lovenotes" aria-labelledby="bpLoveTitle">
      <h2 id="bpLoveTitle" class="bp-h2 bp-h2--hand">${c.sub(c.t('loveTitle'))} <span aria-hidden="true">♡</span></h2>
      <ul class="bp-sticky">${notes.map((n, i) => `<li class="bp-note bp-note--${NOTE_COLORS[i % 4]}" style="--tilt:${TILTS[(i + 3) % TILTS.length] * 0.7}deg;--i:${i}"><button type="button" class="bp-note__btn"><span class="bp-note__pin" aria-hidden="true"></span>${c.sub(n)}</button></li>`).join('')}</ul>
    </section>` : '';
  const reasonsPart = screens.reasons !== false && reasons.length ? `<section class="bp-book__part bp-reasons" aria-labelledby="bpReasonsTitle">
      <div class="bp-lined">
        <span class="bp-tape bp-tape--lav bp-lined__tape" aria-hidden="true"></span>
        <h2 id="bpReasonsTitle" class="bp-h2">${c.sub(c.t('reasonsTitle'))}</h2>
        <ol class="bp-reasons__list">${reasons.map((r, i) => `<li style="--i:${i}"><span class="bp-reasons__n" aria-hidden="true">${art.heart('f-acc')}<b>${i + 1}</b></span><span>${c.sub(r)}</span></li>`).join('')}</ol>
        <span class="bp-lined__doodle" aria-hidden="true">${art.doodle.swirl}</span>
      </div>
    </section>` : '';
  return `<section class="bp-screen bp-screen--scroll bp-scrapbook" data-screen="scrapbook" aria-label="Scrapbook">
  <div class="bp-book">
    <span class="bp-book__rings" aria-hidden="true"></span>
    ${memories}${notesPart || reasonsPart ? `<div class="bp-book__pair${notesPart && reasonsPart ? '' : ' bp-book__pair--one'}">${notesPart}${reasonsPart}</div>` : ''}
    <div class="bp-actions"><button type="button" class="bp-pill" data-next>one last thing <span aria-hidden="true">→</span></button></div>
  </div>
</section>`;
}

function finaleScreen(c, d, opts) {
  const screens = d.screens || D.TOGGLES;
  const waNumber = d.whatsapp || '';
  const waText = c.plain(c.t('thankYouText'));
  const wa = `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`;
  let countdown = '';
  if (screens.countdown !== false && d.birthdayDate) {
    countdown = `<div class="bp-countdown" data-md="${esc(d.birthdayDate.slice(5))}" hidden>
      <p class="bp-countdown__label">until your birthday</p>
      <div class="bp-countdown__chips"><span><b data-u="d">0</b>days</span><span><b data-u="h">0</b>hrs</span><span><b data-u="m">0</b>min</span><span><b data-u="s">0</b>sec</span></div>
      <p class="bp-countdown__today" hidden>It’s your day today! <span aria-hidden="true">🎉</span></p>
    </div>`;
  }
  const cakePart = screens.cake !== false ? `<div class="bp-cakewrap">
      <p class="bp-cake__hint">Make a wish… then tap the candles to blow them out <span aria-hidden="true">🕯️</span></p>
      ${art.cake(d.candles || 5)}
      <p class="bp-cake__done" role="status" aria-live="polite"></p>
    </div>` : '';
  const brand = d.showBrand === false ? '' : `<footer class="bp-brand"><a href="/" target="_blank" rel="noopener">Made with love by <b>Paigaam</b> ${art.heart('f-acc')}</a></footer>`;
  return `<section class="bp-screen bp-finale" data-screen="finale" aria-labelledby="bpFinaleTitle">
  <svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs><radialGradient id="bpPearl" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".45" style="stop-color:var(--blush)" stop-opacity=".75"/><stop offset="1" style="stop-color:var(--blush-deep)" stop-opacity=".7"/></radialGradient></defs></svg>
  <div class="bp-finale__inner">
    <h2 id="bpFinaleTitle" class="bp-finale__title" data-type>${c.sub(c.t('finaleTitle'))}</h2>
    <p class="bp-finale__line">${c.sub(c.t('finaleLine'))}</p>
    ${countdown}
    ${cakePart}
    <div class="bp-actions bp-finale__actions">
      <button type="button" class="bp-pill bp-pill--ghost bp-replay"><span aria-hidden="true">↺</span> Replay surprise</button>
      <a class="bp-pill bp-pill--wa" href="${esc(wa)}" target="_blank" rel="noopener"><span aria-hidden="true">💌</span> Send a thank-you</a>
    </div>
    ${opts.thumb ? '' : brand}
  </div>
</section>`;
}

/* ------------------------------------------------------------------- page */

function renderBirthday(paigaam, opts = {}) {
  const d = (paigaam && paigaam.customer_data) || {};
  const c = makeContext(d);
  const mode = opts.mode || (opts.isPreview ? 'preview' : 'published');
  const preview = mode !== 'published';
  const isDemo = mode === 'demo' || mode === 'thumb';
  const screens = Object.assign({}, D.TOGGLES, d.screens || {});

  const palette = Object.assign({}, D.PALETTES.dreamy, d.palette || {});
  const font = D.FONTS[d.font] || D.FONTS.dreamy;

  const photos = Array.isArray(d.photos) && d.photos.length ? d.photos : (isDemo ? D.DEMO_PHOTOS : []);
  const voiceUrl = d.voiceUrl || (isDemo ? '/birthday-paigaam/demo-media/bp-voice-demo.mp3' : '');
  const songUrl = d.songUrl || '';

  // Which screens exist on this page. Voice needs a recording; the song falls back to the music box.
  const order = D.SCREENS.filter(s => {
    if (s === 'unlock' || s === 'finale') return true;
    if (screens[s] === false) return false;
    if (s === 'voice' && !voiceUrl) return false;
    if (s === 'scrapbook' && !photos.length && (screens.notes === false) && (screens.reasons === false)) return false;
    return true;
  });

  const code = /^\d{4}$/.test(d.passcode || '') ? d.passcode : D.TEXT.passcode;
  const salt = (paigaam && (paigaam.id || paigaam.slug)) || 'birthday-paigaam';
  const start = preview && opts.start && order.includes(opts.start) ? opts.start : null;

  const payload = {
    mode, order, start,
    skipLock: preview && !!(opts.skipLock || start),
    lock: { salt, hash: fnv(salt + ':' + code) },
    noMessages: (Array.isArray(d.noMessages) && d.noMessages.length ? d.noMessages : D.NO_MESSAGES).map(c.plain),
    voiceUrl, songUrl,
    songTitle: c.plain(c.t('songTitle')),
    name: c.name,
  };

  const first = start || (payload.skipLock && order.length > 1 ? order[1] : 'unlock');
  const opt = { invite: mode !== 'published', showHint: isDemo || mode === 'live' || !!(d.passcodeHint && d.passcodeHint.trim()), thumb: mode === 'thumb' };
  const html = {
    unlock: unlockScreen(c, d, opt),
    question: questionScreen(c),
    letter: letterScreen(c),
    voice: voiceScreen(c),
    song: songScreen(c, d),
    scrapbook: scrapbookScreen(c, d, photos),
    finale: finaleScreen(c, d, opt),
  };

  const base = (opts.baseUrl || '').replace(/\/+$/, '');
  const title = `A little surprise for ${c.name} 🎂`;
  const description = `${c.sender} made you a birthday surprise. You’ll need the passcode ♡`;
  const ogImage = base + '/birthday-paigaam/demo-media/bp-share.jpg';
  const previewBar = (mode === 'preview') ? `<nav class="bp-previewbar" aria-label="Preview controls">
    <span class="bp-previewbar__tag">Preview</span><span class="bp-previewbar__note">passcode skipped · jump to</span>
    ${order.map(s => `<button type="button" data-jump="${s}">${s}</button>`).join('')}
  </nav>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="${esc(palette.blush)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Paigaam">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${font.css}&family=Nunito:wght@600;800;900&display=swap">
<link rel="stylesheet" href="/birthday-paigaam/experience.css?v=2">
<script>document.documentElement.classList.add('js')</script>
<style>:root{--blush:${palette.blush};--cream:${palette.cream};--peach:${palette.peach};--lavender:${palette.lavender};--accent:${palette.accent};--font-head:${font.heading};--font-script:${font.script};--font-hand:${font.hand}}</style>
</head>
<body class="bp bp--${esc(mode)}">
<div class="bp-bg" aria-hidden="true"><div class="bp-stripes"></div><div class="bp-wash"></div><div class="bp-grain"></div></div>
<canvas class="bp-ambient" aria-hidden="true"></canvas>
<div class="bp-floaters" aria-hidden="true"></div>
${previewBar}
<div class="bp-controls">
  <button type="button" class="bp-iconbtn bp-sound" aria-pressed="true" aria-label="Sound effects on"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="i-spk" d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="i-on" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/><path class="i-off" d="M16 9.5l5 5M21 9.5l-5 5"/></svg></button>
  <button type="button" class="bp-iconbtn bp-motion" aria-pressed="true" aria-label="Animations on"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${art.SPARKLE}" transform="translate(2 2) scale(.84)"/></svg></button>
</div>
<div class="bp-progress" aria-hidden="true">${order.filter(s => s !== 'unlock').map(s => `<i data-p="${s}"></i>`).join('')}</div>
<main class="bp-stage">
${order.map(s => s === first ? html[s].replace('class="bp-screen', 'class="bp-screen is-active') : html[s]).join('\n')}
</main>
<canvas class="bp-fx" aria-hidden="true"></canvas>
<button type="button" class="bp-mini" hidden aria-label="Pause our song"><span class="bp-mini__disc" aria-hidden="true"></span></button>
<div class="bp-lightbox" hidden role="dialog" aria-modal="true" aria-label="Photo viewer">
  <button type="button" class="bp-lightbox__close" aria-label="Close">✕</button>
  <button type="button" class="bp-lightbox__nav bp-lightbox__prev" aria-label="Previous photo">‹</button>
  <figure class="bp-lightbox__fig"><img alt=""><figcaption><span class="bp-lightbox__cap"></span><span class="bp-lightbox__back"></span></figcaption></figure>
  <button type="button" class="bp-lightbox__nav bp-lightbox__next" aria-label="Next photo">›</button>
  <p class="bp-lightbox__count"></p>
</div>
<audio class="bp-audio-voice" preload="metadata"${voiceUrl ? ` src="${esc(voiceUrl)}"` : ''}></audio>
<audio class="bp-audio-song" preload="none" loop${songUrl ? ` src="${esc(songUrl)}"` : ''}></audio>
<script type="application/json" id="bpData">${safeJson(payload)}</script>
<script src="/birthday-paigaam/sfx.js?v=1" defer></script>
<script src="/birthday-paigaam/experience.js?v=2" defer></script>
<noscript><style>.bp-screen{display:block!important;opacity:1!important;position:relative!important;min-height:auto!important;padding:40px 16px}.bp-q__no,.bp-env,.bp-env__hint,.bp-keypad,.bp-controls,.bp-progress{display:none!important}.bp-letter{opacity:1!important;transform:none!important}</style></noscript>
</body>
</html>`;
}

module.exports = { renderBirthday, fnv };
