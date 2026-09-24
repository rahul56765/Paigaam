'use strict';
/**
 * The Love Awaits generator — five steps.
 *
 * Every field is optional except their name; the placeholders are the real
 * defaults, so someone can walk straight through and still send the designed
 * proposal. Copy lives here, behaviour lives in /love-awaits/create.js.
 */
const { logoFull } = require('../lib/brand');

const STEPS = [
  { key: 'design', title: 'The proposal' },
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

function loveAwaitsCreatePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0a0206">
<title>Love Awaits · Make a Paigaam</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/brand/favicon-512.png" type="image/png">
<link rel="stylesheet" href="/love-awaits/create.css">
<script src="/love-awaits/create.js" defer></script>
</head>
<body>
<header class="masthead"><a href="/" aria-label="Paigaam">${logoFull(128)}</a><a class="text-link" href="/templates">All templates</a></header>

<main id="wizard">
  <section class="intro">
    <p class="eyebrow">Love Awaits</p>
    <h1>The proposal that refuses to take no for an answer.</h1>
    <p class="intro-copy">One tap begins the story: stars gather into a heart, a cat pleads your case, and the question stands. Every “No” earns a sadder cat — and at the last rung the No button learns to run. Write as little or as much as you like — every line already has words waiting in it.</p>
  </section>

  <div class="workspace">
    <aside class="journey">
      <p class="eyebrow">Your proposal</p>
      <ol id="progress" aria-label="Progress">
        ${STEPS.map((s, i) => `<li data-progress="${i}"><span class="step-number">0${i + 1}</span><span>${s.title}</span></li>`).join('')}
      </ol>
      <p class="aside-note">Nothing is public until you press send. You can preview it as often as you like.</p>
    </aside>

    <div class="paper">
      <p id="stepCounter" class="eyebrow"></p>
      <form id="awaitsForm" novalidate>

        <section data-step="0" class="step">
          <h2 tabindex="-1">One tap, one question</h2>
          <p>It opens on a tap-to-begin gate, a field of stars becoming a heart, and a question with two buttons. Pressing “No” walks the plea ladder — five rungs, each with a more desperate cat — until the No button itself gives up and dodges. Pressing “Yes” bursts the screen in celebration, and stays remembered.</p>
          <ul class="scene-list">
            <li><b>One ·</b> the tap-to-begin gate, music rising</li>
            <li><b>Two ·</b> the question, with the cat and the plea ladder</li>
            <li><b>Three ·</b> the “Yes” — Forever &amp; Always, remembered</li>
          </ul>
          <p class="hint">The cats load with the page — nothing to download, nothing to wait for. Music is a soft generative score; a mute button sits in the corner.</p>
          <a class="button secondary" href="/love-awaits/demo" target="_blank" rel="noopener">Try the demo <span aria-hidden="true">↗</span></a>
        </section>

        <section data-step="1" class="step" hidden>
          <h2 tabindex="0">Who is it for?</h2>
          <p>Their name is all the proposal truly needs.</p>
          ${field({ id: 'recipientName', label: 'Their name', max: 60, placeholder: 'Meher', required: true, hint: 'Just the name you actually call them.' })}
        </section>

        <section data-step="2" class="step" hidden>
          <h2 tabindex="0">The words</h2>
          <p>Leave them as they are if they already sound like you.</p>
          ${field({ id: 'question', label: 'The big question', max: 60, placeholder: 'Will You Be My Forever?' })}
          ${field({ id: 'questionNote', label: 'The line beneath it', max: 240, type: 'textarea', rows: 3, placeholder: 'In a universe of billions, my heart chose you…' })}
          ${field({ id: 'yesLabel', label: 'The yes button says', max: 24, placeholder: 'Yes, Forever' })}
          ${field({ id: 'noLabel', label: 'The no button says', max: 24, placeholder: 'No' })}
          ${field({ id: 'finaleTitle', label: 'The celebration heading', max: 40, placeholder: 'Forever & Always' })}
          ${field({ id: 'finaleLine', label: 'The celebration line', max: 160, placeholder: 'You are my today and all of my tomorrows.' })}
          ${field({ id: 'senderName', label: 'Sign it', max: 60, placeholder: 'Rahul', hint: 'Appears as a small signature beneath the buttons.' })}
        </section>

        <section data-step="3" class="step" hidden>
          <h2 tabindex="0">Ready to send</h2>
          <p>Have one last look, then publish. You will get a link and a QR card you can send anywhere.</p>
          <div id="review" class="review"></div>
          <div class="preview-callout">
            <span aria-hidden="true">✦</span>
            <p>Open the proposal exactly as they will see it.</p>
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
  <p>Send them the link. The question is already waiting.</p>
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
    <h2 id="previewDialogTitle">Your proposal</h2>
    <div>
      <button type="button" id="fullscreen" class="button secondary">Open in a tab</button>
      <button type="button" id="closePreview" class="button primary">Close</button>
    </div>
  </div>
  <p class="preview-help">Tap to begin, press “No” a few times, then give in — exactly as they will.</p>
  <div id="frameHost"></div>
</dialog>

<noscript><p class="error">Please enable JavaScript to build your proposal.</p></noscript>
</body>
</html>`;
}

module.exports = { loveAwaitsCreatePage, STEPS };
