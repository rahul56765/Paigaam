'use strict';
/**
 * The Ganpati Courtyard generator — one calm screen.
 *
 * The video preview sits on top, the seven fields below it; every keystroke
 * re-renders the caption overlay live (the browser drives the overlay from
 * the same cue timings the server burns into the MP4). Preview plays the full
 * 10 seconds with sound; Download asks the server to render the real file.
 *
 * Copy lives here; behaviour lives in /ganpati-courtyard/create.js.
 */
const { logoFull } = require('../lib/brand');
const { DEFAULTS, timelineForClient } = require('../templates/ganpati-courtyard/captions');

const FIELDS = [
  { id: 'greeting',   label: 'Greeting', hint: 'The opening blessing' },
  { id: 'mainTitle',  label: 'Main title', hint: 'The big line — shown largest' },
  { id: 'familyName', label: 'Family name', hint: 'आमच्या … परिवारातर्फे', required: true },
  { id: 'eventDate',  label: 'Date', hint: 'Shown in the closing card' },
  { id: 'eventTime',  label: 'Time', hint: '' },
  { id: 'venueName',  label: 'Venue', hint: '' },
  { id: 'city',       label: 'City', hint: '' },
];

function field({ id, label, hint, required = false }) {
  return `<div class="cfield">
  <label for="${id}">${label}${required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>
  <input id="${id}" name="${id}" type="text" maxlength="60" autocomplete="off"
         placeholder="${String(DEFAULTS[id] || '').replace(/"/g, '&quot;')}">
  ${hint ? `<p class="chint">${hint}</p>` : ''}
</div>`;
}

function courtyardCreatePage(opts = {}) {
  // A saved draft restores its fields straight from the page — re-downloading
  // never requires re-entering details.
  const saved = opts.paigaam && opts.paigaam.customer_data ? opts.paigaam.customer_data : null;
  const savedJson = saved ? JSON.stringify(saved).replace(/</g, '\\u003c') : 'null';
  const timeline = JSON.stringify(timelineForClient(opts.demo || {}))
    .replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="mr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#f7efe1">
<title>Ganpati Aagman — Traditional Courtyard · Make your video Paigaam</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/brand/favicon-512.png" type="image/png">
<link rel="stylesheet" href="/ganpati-courtyard/create.css">
<script src="/ganpati-courtyard/create.js" defer></script>
</head>
<body>
<header class="masthead"><a href="/" aria-label="Paigaam">${logoFull(128)}</a><a class="text-link" href="/templates">All templates</a></header>

<main id="studio">
  <section class="intro">
    <p class="eyebrow">Ganpati Aagman · Traditional Courtyard</p>
    <h1>बाप्पा येत आहेत…</h1>
    <p class="intro-copy">The original procession plays untouched. Your names and details fade in over the morning sky — a ten-second video invitation, ready for WhatsApp.</p>
  </section>

  <section class="stage" aria-label="Video preview">
    <div class="frame">
      <video id="pv-video" src="/ganpati-courtyard/media/courtyard.mp4"
             poster="/ganpati-courtyard/media/courtyard-poster.jpg"
             playsinline preload="metadata" muted loop></video>
      <div class="captions" id="pv-captions" aria-hidden="true"></div>
      <button type="button" id="pv-play" class="playbtn" aria-label="Play the full video with sound">▶</button>
    </div>
    <p class="stage-note" id="stage-note">Live preview — every change appears instantly. Press ▶ for the full 10 seconds with sound.</p>
  </section>

  <form id="details" class="details" autocomplete="off">
    ${FIELDS.map(field).join('\n    ')}

    <div class="actions">
      <button type="button" id="btn-preview" class="btn btn--ghost">▶ Preview full video</button>
      <button type="button" id="btn-download" class="btn btn--primary">Download Video</button>
      <p class="ready-note" id="ready-note" hidden>Your personalized Ganpati Aagman video is ready to share ❤️</p>
      <p class="busy" id="busy" hidden><span class="spinner" aria-hidden="true"></span> Creating your video — this takes a few seconds…</p>
      <p class="error" id="err" hidden></p>
      <p class="edit-note" id="edit-note" hidden></p>
    </div>
  </form>
</main>

<footer class="foot">Made with Paigaam</footer>
<script>window.COURTYARD_TIMELINE=${timeline};window.COURTYARD_SAVED=${savedJson};</script>
</body>
</html>`;
}

module.exports = { courtyardCreatePage };
