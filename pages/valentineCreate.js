'use strict';
/**
 * The Valentine "Say Yes" generator — five steps.
 *
 * Every field is optional except their name; the placeholders are the real
 * defaults, so someone can walk straight through and still send the designed
 * question. Copy lives here, behaviour lives in /valentine-say-yes/create.js.
 */
const { logoFull } = require('../lib/brand');

const STEPS = [
  { key: 'design', title: 'The question' },
  { key: 'who', title: 'Who it’s for' },
  { key: 'words', title: 'The words' },
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

function valentineCreatePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#FFD0E5">
<title>Valentine Say Yes · Make a Paigaam</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/brand/favicon-512.png" type="image/png">
<link rel="stylesheet" href="/valentine-say-yes/create.css">
<script src="/valentine-say-yes/create.js" defer></script>
<script src="/js/qr-card.js" defer></script>
</head>
<body>
<header class="masthead"><a href="/" aria-label="Paigaam">${logoFull(128)}</a><a class="text-link" href="/templates">All templates</a></header>

<main id="wizard">
  <section class="intro">
    <p class="eyebrow">Valentine Say Yes</p>
    <h1>The question that cannot be refused.</h1>
    <p class="intro-copy">Every “No” makes the “Yes” button bigger and the pleading harder to resist. Five clicks of resistance, then the decision makes itself. Write as little or as much as you like — every line already has words waiting in it.</p>
  </section>

  <div class="workspace">
    <aside class="journey">
      <p class="eyebrow">Your question</p>
      <ol id="progress" aria-label="Progress">
        ${STEPS.map((s, i) => `<li data-progress="${i}"><span class="step-number">0${i + 1}</span><span>${s.title}</span></li>`).join('')}
      </ol>
      <p class="aside-note">Nothing is public until you press send. You can preview it as often as you like.</p>
    </aside>

    <div class="paper">
      <p id="stepCounter" class="eyebrow"></p>
      <form id="valentineForm" novalidate>

        <section data-step="0" class="step">
          <h2 tabindex="-1">One page, one question</h2>
          <p>It opens on a kitten, a question and two buttons. Pressing “No” earns them a sadder kitten, a bigger “Yes”, and a plea they will find harder to refuse. Pressing “Yes” bursts the screen in hearts.</p>
          <ul class="scene-list">
            <li><b>One ·</b> the question, with a kitten and two buttons</li>
            <li><b>Two ·</b> every “No” — the plea ladder, five rungs deep</li>
            <li><b>Three ·</b> the “Yes” — hearts everywhere, and your words</li>
          </ul>
          <p class="hint">The kittens load with the page — nothing to download, nothing to wait for.</p>
          <a class="button secondary" href="/valentine-say-yes/demo" target="_blank" rel="noopener">Try the demo <span aria-hidden="true">↗</span></a>
        </section>

        <section data-step="1" class="step" hidden>
          <h2 tabindex="0">Who is it for?</h2>
          <p>Their name is all the question truly needs.</p>
          ${field({ id: 'recipientName', label: 'Their name', max: 60, placeholder: 'Meher', required: true, hint: 'Just the name you actually call them.' })}
        </section>

        <section data-step="2" class="step" hidden>
          <h2 tabindex="0">The words</h2>
          <p>Leave them as they are if they already sound like you.</p>
          ${field({ id: 'question', label: 'The big question', max: 120, placeholder: 'Will you be my Valentine?' })}
          ${field({ id: 'yesLabel', label: 'The yes button says', max: 24, placeholder: 'Yes' })}
          ${field({ id: 'noLabel', label: 'The no button’s first word', max: 24, placeholder: 'No', hint: 'After the first click the plea ladder takes over — “Are you sure?”, “Pookie please”…' })}
          ${field({ id: 'celebration', label: 'The celebration message', max: 120, placeholder: 'Yayyy!! :3' })}
          ${field({ id: 'senderName', label: 'Sign it', max: 60, placeholder: 'Rahul', hint: 'Appears as a small signature at the very end.' })}
        </section>

        <section data-step="3" class="step" hidden>
          <h2 tabindex="0">Ready to send</h2>
          <p>Have one last look, then publish. You will get a link and a QR card you can send anywhere.</p>
          <div id="review" class="review"></div>
          <div class="preview-callout">
            <span aria-hidden="true">✦</span>
            <p>Open the question exactly as they will see it.</p>
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
  <h1 id="resultTitle" tabindex="0">Your Paigaam is ready.</h1>
  <p>Send them the link. The Yes button is already waiting.</p>
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
    <h2 id="previewDialogTitle">Your question</h2>
    <div>
      <button type="button" id="fullscreen" class="button secondary">Open in a tab</button>
      <button type="button" id="closePreview" class="button primary">Close</button>
    </div>
  </div>
  <p class="preview-help">Press “No” a few times, then give in — exactly as they will.</p>
  <div id="frameHost"></div>
</dialog>

<noscript><p class="error">Please enable JavaScript to build your question.</p></noscript>
</body>
</html>`;
}

module.exports = { valentineCreatePage, STEPS };
