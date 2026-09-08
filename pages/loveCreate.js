'use strict';
/**
 * The Love Album generator — five steps.
 *
 * The photos step is the heart of it: the gallery IS the photos, so this
 * wizard requires 3–9 uploads before it will publish. Copy lives here,
 * behaviour lives in /love-album/create.js.
 */
const { logoFull } = require('../lib/brand');

const STEPS = [
  { key: 'design', title: 'The intro' },
  { key: 'who', title: 'Who it’s for' },
  { key: 'photos', title: 'Your photos' },
  { key: 'review', title: 'Look it over' },
  { key: 'publish', title: 'Send it' },
];

function field({ id, label, hint, max, type = 'text', rows = 4, placeholder = '', required = false }) {
  const attrs = `id="${id}" name="${id}"${max ? ` maxlength="${max}"` : ''}${required ? ' required' : ''}${placeholder ? ` placeholder="${placeholder.replace(/"/g, '&quot;')}"` : ''}`;
  const input = type === 'textarea'
    ? `<textarea ${attrs} rows="${rows}"></textarea>`
    : `<input type="text" ${attrs}>`;
  return `<div class="field">
  <label for="${id}">${label}${required ? ' <span class="req" aria-hidden="true">*</span>' : ' <span class="opt">optional</span>'}</label>
  ${input}
  ${hint ? `<p class="hint">${hint}</p>` : ''}
</div>`;
}

function loveCreatePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#FFD1E3">
<title>Love Album · Make a Paigaam</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/brand/favicon-512.png" type="image/png">
<link rel="stylesheet" href="/love-album/create.css">
<script src="/love-album/create.js" defer></script>
</head>
<body>
<header class="masthead"><a href="/" aria-label="Paigaam">${logoFull(128)}</a><a class="text-link" href="/templates">All templates</a></header>

<main id="wizard">
  <section class="intro">
    <p class="eyebrow">Love Album</p>
    <h1>A gallery they can touch, with notes hidden on the backs.</h1>
    <p class="intro-copy">It opens on a playful intro, then scatters your photos as draggable cards. Sliding a card far enough flips it over — and once they have touched most of them, a love letter appears. You will need 3 to 9 photos.</p>
  </section>

  <div class="workspace">
    <aside class="journey">
      <p class="eyebrow">Your album</p>
      <ol id="progress" aria-label="Progress">
        ${STEPS.map((s, i) => `<li data-progress="${i}"><span class="step-number">0${i + 1}</span><span>${s.title}</span></li>`).join('')}
      </ol>
      <p class="aside-note">Nothing is public until you press send. You can preview it as often as you like.</p>
    </aside>

    <div class="paper">
      <p id="stepCounter" class="eyebrow"></p>
      <form id="loveForm" novalidate>

        <section data-step="0" class="step">
          <h2 tabindex="-1">Three little scenes</h2>
          <p>First an intro with your words and one button. Then the gallery — your photos scattered as draggable cards, mixed with hidden notes. And once they have touched most of the cards, your love letter appears.</p>
          <ul class="scene-list">
            <li><b>One ·</b> the intro — your words, one button</li>
            <li><b>Two ·</b> the gallery — drag a card to flip it</li>
            <li><b>Three ·</b> the letter, once most cards are touched</li>
          </ul>
          <p class="hint">Everything is drawn in the browser — the cards, the sparkles, the falling hearts.</p>
          <a class="button secondary" href="/love-album/demo" target="_blank" rel="noopener">Watch the demo <span aria-hidden="true">↗</span></a>
        </section>

        <section data-step="1" class="step" hidden>
          <h2 tabindex="-1">Who is it for?</h2>
          <p>Their name is all the album truly needs — the rest already has words waiting.</p>
          ${field({ id: 'recipientName', label: 'Their name (or nickname)', max: 60, placeholder: 'Pookie', required: true, hint: 'The nickname you actually call them. It appears in the intro and over the gallery.' })}
          ${field({ id: 'senderName', label: 'Sign it', max: 60, placeholder: 'Rahul', hint: 'Appears on the intro and in the card backs.' })}
          ${field({ id: 'introLine', label: 'The intro message', max: 400, type: 'textarea', rows: 3, placeholder: 'Hey Pookie, I made something special just for you! 💫💕\nA little surprise is waiting—wrapped in love and magic.' })}
          ${field({ id: 'continueLabel', label: 'The intro button says', max: 40, placeholder: "Let's Go!" })}
        </section>

        <section data-step="2" class="step" hidden>
          <h2 tabindex="-1">Your photos</h2>
          <p>Between <b>3 and 9</b> photos — they become the draggable cards of the gallery. Three hidden notes are woven between them automatically.</p>
          <div class="upload-box">
            <button class="button secondary" type="button" id="choosePhotos">Choose photos</button>
            <input id="photoFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden>
            <p class="hint">JPG, PNG or WebP. Up to 2MB each — large photos are resized in your browser before upload.</p>
          </div>
          <p id="photoCount" class="hint" aria-live="polite"></p>
          <div id="photoList" class="photo-list"></div>
          <p class="hint">Photos stay private: the album link is unguessable, and only published albums serve their photos.</p>
        </section>

        <section data-step="3" class="step" hidden>
          <h2 tabindex="-1">The hidden notes and the letter</h2>
          <p>Three notes hide on card backs inside the gallery. The letter is the finale — it appears once they have touched most of the cards.</p>
          ${field({ id: 'message1', label: 'Hidden message · one', max: 160, placeholder: 'You make my heart smile every day! ❤️' })}
          ${field({ id: 'message2', label: 'Hidden message · two', max: 160, placeholder: 'I love the way your eyes crinkle when you laugh! 😊' })}
          ${field({ id: 'message3', label: 'Hidden message · three', max: 160, placeholder: 'Every moment with you is a gift I cherish! 💝' })}
          ${field({ id: 'letterTitle', label: 'The love letter title', max: 80, placeholder: 'To My Dearest' })}
          ${field({ id: 'letterBody', label: 'The love letter', max: 900, type: 'textarea', rows: 5, placeholder: 'Thank you for being the most incredible person in my world. Every moment with you is a treasure…' })}
          ${field({ id: 'finalLabel', label: 'The final button says', max: 120, placeholder: 'One last thing for you! 💕 Click here!' })}
        </section>

        <section data-step="4" class="step" hidden>
          <h2 tabindex="-1">Ready to send</h2>
          <p>Have one last look, then publish. You will get a link and a QR card you can send anywhere.</p>
          <div id="review" class="review"></div>
          <div class="preview-callout">
            <span aria-hidden="true">✦</span>
            <p>Open the album exactly as they will see it.</p>
            <button type="button" id="savePreview" class="button primary">Save &amp; preview</button>
          </div>
          <p id="previewState" class="hint" aria-live="polite"></p>
          <button type="button" id="publish" class="button publish" disabled>Publish this Paigaam</button>
          <p class="hint">Free. The link stays live; only you can edit it before publishing.</p>
        </section>

        <div id="formError" class="error" role="alert" hidden></div>
        <p id="status" class="status" role="status" aria-live="polite"></p>
        <nav class="step-nav">
          <button type="button" id="back" class="button text-button">Back</button>
          <button type="submit" id="next" class="button primary">Continue</button>
        </nav>
      </form>
    </div>
  </div>
</main>

<section id="publishedResult" class="result paper" hidden aria-labelledby="resultTitle">
  <p class="eyebrow">It’s live</p>
  <h1 id="resultTitle" tabindex="-1">Your Paigaam is ready.</h1>
  <p>Send them the link. It opens on your intro — the gallery is waiting behind the button.</p>
  <label for="publishedUrl">Your link</label>
  <input id="publishedUrl" readonly>
  <div class="result-actions">
    <a id="openPublished" class="button primary" target="_blank" rel="noopener">Open it</a>
    <button type="button" id="copyLink" class="button secondary">Copy link</button>
    <a id="whatsapp" class="button secondary" target="_blank" rel="noopener">Send on WhatsApp</a>
  </div>
  <figure class="qr"><img id="qrImage" alt="QR code for your Paigaam" width="220" height="220"><figcaption>Or let them scan it.</figcaption></figure>
  <p id="shareStatus" role="status" aria-live="polite"></p>
</section>

<footer><span>Paigaam · because some things deserve more</span></footer>

<dialog id="previewDialog" aria-labelledby="previewDialogTitle">
  <div class="preview-toolbar">
    <h2 id="previewDialogTitle">Your album</h2>
    <div>
      <button type="button" id="fullscreen" class="button secondary">Open in a tab</button>
      <button type="button" id="closePreview" class="button primary">Close</button>
    </div>
  </div>
  <p class="preview-help">Press the intro button, drag a few cards, then look for the final button.</p>
  <div id="frameHost"></div>
</dialog>

<noscript><p class="error">Please enable JavaScript to build your album.</p></noscript>
</body>
</html>`;
}

module.exports = { loveCreatePage, STEPS };
