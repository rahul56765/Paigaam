'use strict';
/**
 * The Lavender Bloom generator — five steps.
 *
 * Every field is optional except their name; the placeholders are the real
 * defaults, so someone can walk straight through and still send the designed
 * surprise. Copy lives here, behaviour lives in /lavender-bloom/create.js.
 */
const { logoFull } = require('../lib/brand');

const STEPS = [
  { key: 'design', title: 'The surprise' },
  { key: 'who', title: 'Who it’s for' },
  { key: 'words', title: 'The words' },
  { key: 'colour', title: 'The colour' },
  { key: 'publish', title: 'Send it' },
];

function field({ id, label, hint, max, type = 'text', rows = 4, placeholder = '', required = false, options = [] }) {
  const attrs = `id="${id}" name="${id}"${max ? ` maxlength="${max}"` : ''}${required ? ' required' : ''}${placeholder ? ` placeholder="${placeholder.replace(/"/g, '&quot;')}"` : ''}`;
  let input;
  if (type === 'textarea') input = `<textarea ${attrs} rows="${rows}"></textarea>`;
  else if (type === 'select') {
    input = `<select ${attrs}>${options.map(o => `<option value="${o.value}"${o.selected ? ' selected' : ''}>${o.label}</option>`).join('')}</select>`;
  } else input = `<input type="text" ${attrs}>`;
  return `<div class="field">
  <label for="${id}">${label}${required ? ' <span class="req" aria-hidden="true">*</span>' : ' <span class="opt">optional</span>'}</label>
  ${input}
  ${hint ? `<p class="hint">${hint}</p>` : ''}
</div>`;
}

function lavenderCreatePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#F0F7FF">
<title>Lavender Bloom Surprise · Make a Paigaam</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/brand/favicon-512.png" type="image/png">
<link rel="stylesheet" href="/lavender-bloom/create.css">
<script src="/lavender-bloom/create.js" defer></script>
</head>
<body>
<header class="masthead"><a href="/" aria-label="Paigaam">${logoFull(128)}</a><a class="text-link" href="/templates">All templates</a></header>

<main id="wizard">
  <section class="intro">
    <p class="eyebrow">Lavender Bloom Surprise</p>
    <h1>A game they always win, a flower that grows for them.</h1>
    <p class="intro-copy">A sealed envelope, a round of tic-tac-toe they cannot lose, and a lavender bloom that grows the moment they open it. Write as little or as much as you like — every line already has words waiting in it.</p>
  </section>

  <div class="workspace">
    <aside class="journey">
      <p class="eyebrow">Your surprise</p>
      <ol id="progress" aria-label="Progress">
        ${STEPS.map((s, i) => `<li data-progress="${i}"><span class="step-number">0${i + 1}</span><span>${s.title}</span></li>`).join('')}
      </ol>
      <p class="aside-note">Nothing is public until you press send. You can preview it as often as you like.</p>
    </aside>

    <div class="paper">
      <p id="stepCounter" class="eyebrow"></p>
      <form id="lavenderForm" novalidate>

        <section data-step="0" class="step">
          <h2 tabindex="-1">Four little scenes, one small surprise</h2>
          <p>It opens with an envelope they have to tap. Then a game of tic-tac-toe — they are the blue crosses, and the game is quietly on their side. Then a gift box, and then the flowers grow.</p>
          <ul class="scene-list">
            <li><b>One ·</b> the envelope, sealed with “open when you miss me”</li>
            <li><b>Two ·</b> the game — they win, always</li>
            <li><b>Three ·</b> the gift, tapped open in confetti</li>
            <li><b>Four ·</b> the bloom, and your words underneath</li>
          </ul>
          <p class="hint">Every drawing is made in the browser — nothing to download, nothing to load.</p>
          <a class="button secondary" href="/lavender-bloom/demo" target="_blank" rel="noopener">Watch the demo <span aria-hidden="true">↗</span></a>
        </section>

        <section data-step="1" class="step" hidden>
          <h2 tabindex="-1">Who is it for?</h2>
          <p>Their name is all the surprise truly needs.</p>
          ${field({ id: 'recipientName', label: 'Their name', max: 60, placeholder: 'Yashika', required: true, hint: 'Just the name you actually call them.' })}
        </section>

        <section data-step="2" class="step" hidden>
          <h2 tabindex="-1">The words at the end</h2>
          <p>Once the lavender blooms, this is what appears beneath it. Leave them as they are if they already sound like you.</p>
          ${field({ id: 'title', label: 'The title', max: 90, placeholder: 'For You!' })}
          ${field({ id: 'message', label: 'The message', max: 400, type: 'textarea', placeholder: 'Because you make every day as bright as a blooming flower. I miss you more than words can say!' })}
          ${field({ id: 'senderName', label: 'Sign it', max: 60, placeholder: 'Rahul', hint: 'Appears as a small signature at the very end.' })}
        </section>

        <section data-step="3" class="step" hidden>
          <h2 tabindex="-1">The colour of the bloom</h2>
          <p>Lavender is the original. Rose and sunbeam are there if they suit them better.</p>
          ${field({ id: 'flowerColor', label: 'Flower colour', type: 'select', options: [
            { value: 'lavender', label: 'Lavender (the original)', selected: true },
            { value: 'rose', label: 'Rose' },
            { value: 'sunbeam', label: 'Sunbeam' },
          ] })}
        </section>

        <section data-step="4" class="step" hidden>
          <h2 tabindex="-1">Ready to send</h2>
          <p>Have one last look, then publish. You will get a link and a QR card you can send anywhere.</p>
          <div id="review" class="review"></div>
          <div class="preview-callout">
            <span aria-hidden="true">✦</span>
            <p>Open the surprise exactly as they will see it.</p>
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
  <p>Send them the link. It opens as a sealed envelope — they will have to tap it.</p>
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
    <h2 id="previewDialogTitle">Your surprise</h2>
    <div>
      <button type="button" id="fullscreen" class="button secondary">Open in a tab</button>
      <button type="button" id="closePreview" class="button primary">Close</button>
    </div>
  </div>
  <p class="preview-help">Tap the envelope, win the game, open the gift — exactly as they will.</p>
  <div id="frameHost"></div>
</dialog>

<noscript><p class="error">Please enable JavaScript to build your surprise.</p></noscript>
</body>
</html>`;
}

module.exports = { lavenderCreatePage, STEPS };
