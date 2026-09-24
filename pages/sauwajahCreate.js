'use strict';
/**
 * The Sau Wajah generator — five steps.
 *
 * Photos are optional here (the experience is complete without them), so
 * the photos step is a gentle "make it yours" rather than a gate. Every
 * field defaults to the designed copy. Copy lives here, behaviour lives in
 * /sau-wajah/create.js.
 */
const { logoFull } = require('../lib/brand');

const STEPS = [
  { key: 'design', title: 'The experience' },
  { key: 'who', title: 'Who it’s for' },
  { key: 'words', title: 'The words' },
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

function sauwajahCreatePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#FFFAF9">
<title>Sau Wajah · Make a Paigaam</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/brand/favicon-512.png" type="image/png">
<link rel="stylesheet" href="/sau-wajah/create.css">
<script src="/sau-wajah/create.js" defer></script>
<script src="/js/qr-card.js" defer></script>
</head>
<body>
<header class="masthead"><a href="/" aria-label="Paigaam">${logoFull(128)}</a><a class="text-link" href="/templates">All templates</a></header>

<main id="wizard">
  <section class="intro">
    <p class="eyebrow">Sau Wajah</p>
    <h1>A hundred reasons, one song, one letter.</h1>
    <p class="intro-copy">It opens on floating hearts and a birthday greeting, drifts through a polaroid gallery and a clothesline of little photos, reads out a hundred reasons, and ends in a letter that types itself under confetti. A song follows them through every scene — and they can write you a little note back.</p>
  </section>

  <div class="workspace">
    <aside class="journey">
      <p class="eyebrow">Your Paigaam</p>
      <ol id="progress" aria-label="Progress">
        ${STEPS.map((s, i) => `<li data-progress="${i}"><span class="step-number">0${i + 1}</span><span>${s.title}</span></li>`).join('')}
      </ol>
      <p class="aside-note">Nothing is public until you press send. You can preview it as often as you like.</p>
    </aside>

    <div class="paper">
      <p id="stepCounter" class="eyebrow"></p>
      <form id="sauwajahForm" novalidate>

        <section data-step="0" class="step">
          <h2 tabindex="-1">Four little scenes</h2>
          <p>A greeting with floating hearts, a photo slideshow, the reasons list scrolling like film credits, and the typewriter letter with confetti. Music and a note button follow them everywhere.</p>
          <ul class="scene-list">
            <li><b>One ·</b> the greeting — your words, a cake, floating hearts</li>
            <li><b>Two ·</b> the gallery — your photos as polaroids</li>
            <li><b>Three ·</b> the reasons — a clothesline and a slow-scrolling list</li>
            <li><b>Four ·</b> the letter — typewriter, confetti, your signature</li>
          </ul>
          <p class="hint">Everything is drawn in the browser — the cake, the bear, the confetti, the sparkles.</p>
          <a class="button secondary" href="/sau-wajah/demo" target="_blank" rel="noopener">Watch the demo <span aria-hidden="true">↗</span></a>
        </section>

        <section data-step="1" class="step" hidden>
          <h2 tabindex="0">Who is it for?</h2>
          <p>Their name is all this Paigaam truly needs — the rest already has words waiting.</p>
          ${field({ id: 'recipientName', label: 'Their name', max: 60, placeholder: 'Meher', required: true, hint: 'Just the name you actually call them.' })}
          ${field({ id: 'senderName', label: 'Sign it', max: 60, placeholder: 'Rahul', hint: 'Appears on the letter, after your signature line.' })}
        </section>

        <section data-step="2" class="step" hidden>
          <h2 tabindex="0">The words</h2>
          <p>Leave them as they are if they already sound like you.</p>
          ${field({ id: 'heroTitle', label: 'The big line', max: 120, placeholder: 'happy birthday my girlfriend!!' })}
          ${field({ id: 'heroSubtitle', label: 'The line under it', max: 160, placeholder: 'yess, this is your special day <3' })}
          ${field({ id: 'galleryHeading', label: 'The gallery heading', max: 120, placeholder: 'our little moments' })}
          ${field({ id: 'reasonsHeading', label: 'The reasons heading', max: 160, placeholder: '100 reasons why i love you' })}
          ${field({ id: 'letterTitle', label: 'The letter title', max: 120, placeholder: 'Happy Birthday My Girl!!! <33' })}
          ${field({ id: 'letterBody', label: 'The letter', type: 'textarea', rows: 8, max: 4000, placeholder: 'My love,\n\nHappy birthday to the most wonderful person I know…', hint: 'It types itself out, letter by letter, under the confetti.' })}
          ${field({ id: 'signature', label: 'The signature line', max: 80, placeholder: '— your biggest fan' })}
        </section>

        <section data-step="3" class="step" hidden>
          <h2 tabindex="0">The reasons (and photos)</h2>
          <p>The list starts with ten starter reasons — replace them with as many as you like, one per line. Photos are optional: upload up to 9 and they fill the gallery polaroids and the clothesline.</p>
          ${field({ id: 'reasons', label: 'Your reasons — one per line', type: 'textarea', rows: 7, max: 8000, placeholder: 'the way you laugh at your own jokes\nhow you scrunch your nose when you smile\n…' })}
          <div class="upload-box">
            <button class="button secondary" type="button" id="choosePhotos">Choose photos</button>
            <input id="photoFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden>
            <p class="hint">JPG, PNG or WebP. Up to 2MB each — large photos are resized in your browser before upload.</p>
          </div>
          <p id="photoCount" class="hint" aria-live="polite"></p>
          <div id="photoList" class="photo-list"></div>
          <p class="hint">Photos stay private: the link is unguessable, and only published Paigaams serve their photos.</p>
        </section>

        <section data-step="4" class="step" hidden>
          <h2 tabindex="0">Ready to send</h2>
          <p>Publish straight away, or have one last look first — either way you will get a link and a QR card you can send anywhere.</p>
          <div id="review" class="review"></div>
          <div class="preview-callout">
            <span aria-hidden="true">✦</span>
            <p>Open the experience exactly as they will see it — scenes, song and all.</p>
            <button type="button" id="savePreview" class="button primary">Save &amp; preview</button>
          </div>
          <p id="previewState" class="hint" aria-live="polite"></p>
          <button type="button" id="publish" class="button publish">Publish this Paigaam</button>
          <p class="hint">Free, and previewing is optional — publishing saves everything as it is. The link stays live; only you can edit it before publishing.</p>
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
  <h1 id="resultTitle" tabindex="0">Your Paigaam is ready.</h1>
  <p>Send them the link. The song is already waiting.</p>
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
    <h2 id="previewDialogTitle">Your Paigaam</h2>
    <div>
      <button type="button" id="fullscreen" class="button secondary">Open in a tab</button>
      <button type="button" id="closePreview" class="button primary">Close</button>
    </div>
  </div>
  <p class="preview-help">Walk all four scenes — tap the arrows, let the reasons scroll, reach the letter.</p>
  <div id="frameHost"></div>
</dialog>

<noscript><p class="error">Please enable JavaScript to build your Paigaam.</p></noscript>
</body>
</html>`;
}

module.exports = { sauwajahCreatePage, STEPS };
