'use strict';
/**
 * The Maafi generator — five steps, with a live preview that updates as you
 * type. Every field is optional except their name; the placeholders are the
 * real defaults, so someone can walk straight through and still send the
 * designed apology. Copy lives here, behaviour lives in /maafi/create.js.
 */
const { logoFull } = require('../lib/brand');

const STEPS = [
  { key: 'design', title: 'The apology' },
  { key: 'who', title: 'Who it’s for' },
  { key: 'words', title: 'The words' },
  { key: 'review', title: 'Look it over' },
  { key: 'publish', title: 'Send it' },
];

function field({ id, label, hint, max, placeholder = '', required = false }) {
  const attrs = `id="${id}" name="${id}"${max ? ` maxlength="${max}"` : ''}${required ? ' required' : ''}${placeholder ? ` placeholder="${placeholder.replace(/"/g, '&quot;')}"` : ''}`;
  return `<div class="field">
  <label for="${id}">${label}${required ? ' <span class="req" aria-hidden="true">*</span>' : ' <span class="opt">optional</span>'}</label>
  <input type="text" ${attrs}>
  ${hint ? `<p class="hint">${hint}</p>` : ''}
</div>`;
}

function maafiCreatePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#E73C7E">
<title>Maafi · Make a Paigaam</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/brand/favicon-512.png" type="image/png">
<link rel="stylesheet" href="/maafi/create.css">
<script src="/maafi/create.js" defer></script>
<script src="/js/qr-card.js" defer></script>
</head>
<body>
<header class="masthead"><a href="/" aria-label="Paigaam">${logoFull(128)}</a><a class="text-link" href="/templates">All templates</a></header>

<main id="wizard">
  <section class="intro">
    <p class="eyebrow">Maafi</p>
    <h1>The apology that refuses to be refused.</h1>
    <p class="intro-copy">The “No” button runs away from them — shrinking, sparkling, escaping every tap — while the Yes button grows more tempting with every attempt. Five steps, one required field, and a preview that follows every word you type.</p>
  </section>

  <div class="workspace">
    <aside class="journey">
      <p class="eyebrow">Your apology</p>
      <ol id="progress" aria-label="Progress">
        ${STEPS.map((s, i) => `<li data-progress="${i}"><span class="step-number">0${i + 1}</span><span>${s.title}</span></li>`).join('')}
      </ol>
      <p class="aside-note">Nothing is public until you press send. The preview follows your typing — no saving needed.</p>
    </aside>

    <div class="paper">
      <p id="stepCounter" class="eyebrow"></p>
      <form id="maafiForm" novalidate>

        <section data-step="0" class="step">
          <h2 tabindex="-1">One page, one plea</h2>
          <p>It opens on your apology and two buttons. The No button won’t sit still — it teleports away and shrinks with every attempt, while the message climbs a ladder of ever-more-desperate pleas. Pressing Yes bursts the screen in hearts.</p>
          <ul class="scene-list">
            <li><b>One ·</b> the plea, on a flowing rose gradient</li>
            <li><b>Two ·</b> every dodge — the No button flees, shrinks, sparkles</li>
            <li><b>Three ·</b> the Yes — heart rain and bouncing emoji</li>
          </ul>
          <p class="hint">Nothing to download, nothing to wait for — the whole page loads at once.</p>
          <a class="button secondary" href="/maafi/demo" target="_blank" rel="noopener">Try the demo <span aria-hidden="true">↗</span></a>
        </section>

        <section data-step="1" class="step" hidden>
          <h2 tabindex="0">Who is it for?</h2>
          <p>Their name is all the apology truly needs.</p>
          ${field({ id: 'recipientName', label: 'Their name', max: 60, placeholder: 'Meher', required: true, hint: 'Just the name you actually call them.' })}
        </section>

        <section data-step="2" class="step" hidden>
          <h2 tabindex="0">The words</h2>
          <p>Leave them as they are if they already sound like you. The preview on the right follows every keystroke.</p>
          ${field({ id: 'headline', label: 'The opening plea', max: 120, placeholder: 'I’m really sorry ❤️' })}
          ${field({ id: 'yesLabel', label: 'The yes button says', max: 40, placeholder: 'Okay baby, I forgive you 💖' })}
          ${field({ id: 'noLabel', label: 'The no button says', max: 40, placeholder: 'No, I’m still angry 😠' })}
          ${field({ id: 'celebration', label: 'The celebration message', max: 120, placeholder: 'Yay! You forgave me! 😍💖🥳' })}
          ${field({ id: 'senderName', label: 'Sign it', max: 60, placeholder: 'Rahul', hint: 'Appears as a small signature at the very end.' })}
        </section>

        <section data-step="3" class="step" hidden>
          <h2 tabindex="0">Ready to send</h2>
          <p>Have one last look, then publish. You will get a link and a QR card you can send anywhere.</p>
          <div id="review" class="review"></div>
          <div class="preview-callout">
            <span aria-hidden="true">✦</span>
            <p>Chase the No button exactly as they will.</p>
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

    <aside class="livepane" aria-label="Live preview">
      <p class="eyebrow">Live preview</p>
      <div class="livepane__frame"><iframe id="liveFrame" title="Maafi live preview" loading="lazy"></iframe></div>
      <p class="aside-note">Updates as you type — exactly as they will see it.</p>
    </aside>
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
    <h2 id="previewDialogTitle">Your apology</h2>
    <div>
      <button type="button" id="fullscreen" class="button secondary">Open in a tab</button>
      <button type="button" id="closePreview" class="button primary">Close</button>
    </div>
  </div>
  <p class="preview-help">Chase the No button a few times, then give in — exactly as they will.</p>
  <div id="frameHost"></div>
</dialog>

<noscript><p class="error">Please enable JavaScript to build your apology.</p></noscript>
</body>
</html>`;
}

module.exports = { maafiCreatePage, STEPS };
