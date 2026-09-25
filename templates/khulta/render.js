'use strict';
/**
 * Khulta renderer.
 *
 * Server-renders the wall, all seven doors and every surprise, plus the lock
 * state as of this request (in the sender's chosen timezone), so the page is
 * right even before /khulta/khulta.js runs. The script recomputes the state
 * on the device clock, swings doors open, shows the surprises, remembers
 * which doors he has opened, and fills the heart.
 *
 * Previews (the wizard, the demo, owner previews) unlock every door and get
 * a "preview as day…" strip so the sender can see each day as he will.
 *
 * Every piece of sender text is HTML-escaped here; there is no client-side
 * templating.
 */
const config = require('./config');
const schema = require('./schema');
const { resolve } = require('../../lib/bfday/fields');
const { escape, multiline, jsonPayload, head, previewBadge } = require('../../lib/bfday/page');
const { youtubeId, songScript } = require('../../lib/bfday/song');

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const KIND_LABEL = {
  photo: 'A photo', letter: 'A letter', voice: 'A voice note', missyou: 'Open when you miss me',
  song: 'Today’s song', promise: 'A promise', reveal: 'The big reveal',
};

const HEART_PATH = 'M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.1c2.1-.2 3.7.9 5.4 2.9 1.7-2 3.3-3.1 5.4-2.9 3.7.4 5.7 4.3 4.2 7.7C19.5 16.4 12 21 12 21z';

function dayNumber(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : null;
}

/** Today's calendar day (as a day number) in `tz`. */
function todayIn(tz, now = Date.now()) {
  try {
    const iso = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
    return dayNumber(iso);
  } catch {
    const t = new Date(now + 330 * 60000);
    return Math.round(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) / 86400000);
  }
}

/** Day of the countdown today: 1 on the start date, ≤0 before it, >7 after the week. */
function countdownDay(startIso, tz, now) {
  const start = dayNumber(startIso);
  if (start == null) return 8;                 // no date → nothing to wait for
  return todayIn(tz, now) - start + 1;
}

/** How many doors are unlocked (0 = none yet, 7 = all). */
function unlockedCount(startIso, tz, now) {
  return Math.max(0, Math.min(7, countdownDay(startIso, tz, now)));
}

/** "opens Tuesday" within a week, else "opens 3 Oct". */
function opensLabel(startIso, index, today) {
  const start = dayNumber(startIso);
  if (start == null) return '';
  const day = start + index;
  const date = new Date(day * 86400000);
  if (day - today <= 6) return `opens ${WEEKDAYS[date.getUTCDay()]}`;
  return `opens ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

function heart(cls) {
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${HEART_PATH}"/></svg>`;
}

function paragraphs(text) {
  return String(text || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
}

function surprise(door, i, d) {
  const kind = door.kind || 'letter';
  const title = door.heading || KIND_LABEL[kind] || `Day ${i + 1}`;
  const text = door.text;
  let inner = '';
  if (kind === 'photo') {
    inner = `<figure class="kh-photo">${door.photo
      ? `<img src="${escape(door.photo)}" alt="${escape(text || title)}" loading="lazy" decoding="async">`
      : `<div class="kh-photo__ph" aria-hidden="true">${heart('kh-ph-heart')}</div>`}
        ${text ? `<figcaption>${multiline(text)}</figcaption>` : ''}</figure>`;
  } else if (kind === 'voice') {
    inner = `<div class="kh-voice">
          <span class="kh-voice__play" aria-hidden="true"></span>
          <span class="kh-voice__wave" aria-hidden="true">${Array.from({ length: 28 }, (_, k) => `<i style="--h:${[30, 55, 80, 45, 95, 60, 35, 70, 90, 50, 25, 65, 85, 40][k % 14]}%"></i>`).join('')}</span>
          <span class="kh-voice__time" aria-hidden="true">0:${String(Math.min(59, 8 + Math.round(String(text || '').length / 14))).padStart(2, '0')}</span>
        </div>
        ${text ? `<p class="kh-voice__text">${multiline(text)}</p>` : ''}`;
  } else if (kind === 'song') {
    // Rahul's rule: the song plays in the browser itself — a YouTube link
    // becomes an inline embed on tap, never a redirect to youtube.com.
    const ytId = youtubeId(door.link);
    inner = `<div class="kh-song">
          <span class="kh-song__disc" aria-hidden="true"></span>
          ${text ? `<p>${multiline(text)}</p>` : ''}
          ${ytId ? `<button type="button" class="kh-songplay" data-yt="${ytId}" data-armed="false" aria-pressed="false" aria-label="Play the song on this page">
              <span class="song-play__frame" aria-hidden="true"></span>
              <span class="song-play__cue" aria-hidden="true">tap to play ♪</span>
            </button>`
          : door.link ? `<a class="kh-btn" href="${escape(door.link)}" target="_blank" rel="noopener noreferrer">Play it in the app ↗</a>` : ''}
        </div>`;
  } else if (kind === 'promise') {
    inner = `<blockquote class="kh-promise">${multiline(text || 'I promise to keep choosing you.')}</blockquote>`;
  } else {
    inner = `<div class="kh-letter">${paragraphs(text).map(p => `<p>${multiline(p)}</p>`).join('')}</div>`;
  }
  // A photo uploaded on any other kind of door still shows, above its words.
  const extraPhoto = kind !== 'photo' && door.photo
    ? `<figure class="kh-photo kh-photo--extra"><img src="${escape(door.photo)}" alt="${escape(title)}" loading="lazy" decoding="async"></figure>` : '';
  const sign = d.senderName && (kind === 'letter' || kind === 'reveal' || kind === 'missyou' || kind === 'promise')
    ? `<p class="kh-sign">— ${escape(d.senderName)}</p>` : '';
  return `<section class="kh-surprise kh-surprise--${escape(kind)}" id="kh-s-${i + 1}" data-door="${i + 1}" aria-labelledby="kh-st-${i + 1}" hidden>
      <p class="kh-surprise__day">Door ${i + 1} · ${escape(KIND_LABEL[kind] || '')}</p>
      <h2 id="kh-st-${i + 1}">${escape(title)}</h2>
      ${extraPhoto}${inner}
      ${sign}
    </section>`;
}

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id })
 * @param opts     { baseUrl, isPreview, now }
 */
function render(paigaam = {}, opts = {}) {
  const d = resolve(config, paigaam && paigaam.customer_data, schema);
  const preview = !!opts.isPreview;
  const now = typeof opts.now === 'number' ? opts.now : Date.now();
  const name = d.recipientName || 'you';
  const tz = d.timezone || 'Asia/Kolkata';
  const doors = d.doors.slice(0, 7);
  const today = todayIn(tz, now);
  const day = preview ? 8 : countdownDay(d.startDate, tz, now);
  const unlocked = Math.max(0, Math.min(7, day));
  const firstOpens = opensLabel(d.startDate, 0, today);

  const title = d.recipientName ? `Khulta — seven doors for ${d.recipientName}` : 'Khulta — one door opens every day';
  const description = d.senderName
    ? `${d.senderName} built you seven doors. One opens every day.`
    : 'Seven doors. One opens every day.';
  const key = !preview && paigaam && paigaam.slug ? paigaam.slug : '';

  const doorHTML = doors.map((door, i) => {
    const n = i + 1;
    const state = n <= unlocked ? (n === day ? 'today' : 'open') : 'locked';
    const label = state === 'locked' ? opensLabel(d.startDate, i, today) : (state === 'today' ? 'today' : 'open me');
    return `<li class="kh-cell" data-n="${n}" data-state="${state}">
        <button type="button" class="kh-door" id="kh-d-${n}" aria-controls="kh-s-${n}"${state === 'locked' ? ' aria-disabled="true"' : ''} aria-label="Door ${n}${state === 'locked' ? `, locked — ${escape(label)}` : ''}">
          <span class="kh-frame" aria-hidden="true">
            <span class="kh-inside">${heart('kh-inside__heart')}</span>
            <span class="kh-leaf"><span class="kh-panel"></span><span class="kh-numeral">${n}</span><span class="kh-knob"></span></span>
            <span class="kh-mark">${heart('kh-mark__line')}${heart('kh-mark__fill')}</span>
          </span>
        </button>
        <span class="kh-when">${escape(label)}</span>
      </li>`;
  }).join('\n      ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
${head({ paigaam, opts, title, description, themeColor: '#F6E7D7', image: config.ogImage })}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/khulta/khulta.css">
<script src="/khulta/khulta.js" defer></script>
${d.doors.some(door => (door.kind || 'letter') === 'song' && youtubeId(door.link)) ? songScript() : ''}
<noscript><style>
  .kh-surprise { display: block !important; position: static !important; }
  .kh-sheet { position: static !important; display: block !important; background: none !important; }
  .kh-sheet__card { transform: none !important; }
  .kh-close, .kh-sim { display: none !important; }
</style></noscript>
</head>
<body data-preview="${preview}">
${previewBadge(opts)}
${jsonPayload('khData', { key, start: d.startDate || '', tz, preview, revealUrl: d.revealUrl || '' })}
  <div class="kh-light" aria-hidden="true"></div>
  <main class="kh-wall">
    <header class="kh-head">
      <div class="kh-bigheart" id="khHeart" style="--fill:0" aria-hidden="true">${heart('kh-bigheart__line')}${heart('kh-bigheart__fill')}</div>
      <h1 class="kh-title">Khulta</h1>
      <p class="kh-sub">seven doors for <em>${escape(name)}</em></p>
      <p class="kh-status" id="khStatus" aria-live="polite">${unlocked === 0
    ? `The first door ${escape(firstOpens || 'opens soon')}. See you then.`
    : (day > 7 ? 'Every door is unlocked.' : `Door ${day} is open today.`)}</p>
    </header>

    ${preview ? `<div class="kh-sim" role="group" aria-label="Preview as a day">
      <span>Preview as</span>
      <button type="button" data-sim="0" aria-pressed="true">All open</button>
      ${[1, 2, 3, 4, 5, 6, 7].map(n => `<button type="button" data-sim="${n}" aria-pressed="false">Day ${n}</button>`).join('')}
    </div>` : ''}

    <ol class="kh-doors" id="khDoors">
      ${doorHTML}
    </ol>

    <section class="kh-full" id="khFull" hidden aria-labelledby="khFullTitle">
      <h2 id="khFullTitle">All seven doors are open.</h2>
      <p>${d.senderName ? `${escape(d.senderName)} saved the biggest one for last.` : 'The biggest one was saved for last.'}</p>
      ${d.revealUrl
    ? `<a class="kh-btn kh-btn--rose" id="khReveal" href="${escape(d.revealUrl)}" target="_blank" rel="noopener noreferrer">${escape(d.revealLabel)} ↗</a>`
    : `<button type="button" class="kh-btn kh-btn--rose" id="khReveal" data-open="7">${escape(d.revealLabel)}</button>`}
    </section>

    <p class="kh-foot">Made with love on <a href="/">Paigaam</a></p>
  </main>

  <div class="kh-sheet" id="khSheet" hidden>
    <div class="kh-sheet__card" role="dialog" aria-modal="true" aria-label="Today’s surprise" tabindex="-1" id="khCard">
      <button type="button" class="kh-close" id="khClose" aria-label="Close">×</button>
    ${doors.map((door, i) => surprise(door, i, d)).join('\n    ')}
    </div>
  </div>
</body>
</html>`;
}

module.exports = { render, unlockedCount, countdownDay, opensLabel, todayIn, dayNumber };
