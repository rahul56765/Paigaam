'use strict';
/**
 * The Saalgirah generator — six quiet steps.
 *
 * Every field is optional except their name; the placeholders are the real
 * defaults, so someone can walk straight through and still send the original
 * letter. Copy lives here, behaviour lives in /saalgirah/create.js.
 */
const { logoFull } = require('../lib/brand');
const { builderShell } = require('../lib/builderShell');

const STEPS = [
  
  { key: 'who', title: 'Who it’s for' },
  { key: 'opening', title: 'The opening' },
  { key: 'wish', title: 'The wish' },
  { key: 'closing', title: 'The last words' },
  { key: 'publish', title: 'Send it' },
];

function field({ id, label, hint, max, type = 'text', rows = 3, placeholder = '', required = false }) {
  const attrs = `id="${id}" name="${id}" maxlength="${max}"${required ? ' required' : ''}${placeholder ? ` placeholder="${placeholder.replace(/"/g, '&quot;')}"` : ''}`;
  return `<div class="field">
  <label for="${id}">${label}${required ? ' <span class="req" aria-hidden="true">*</span>' : ' <span class="opt">optional</span>'}</label>
  ${type === 'textarea' ? `<textarea ${attrs} rows="${rows}"></textarea>` : `<input type="text" ${attrs}>`}
  ${hint ? `<p class="hint">${hint}</p>` : ''}
</div>`;
}

function saalgirahCreatePage() {
    return builderShell('Saalgirah', `
<link rel="stylesheet" href="/saalgirah/create.css">
<script src="/saalgirah/create.js" defer></script>
<script src="/js/qr-card.js" defer></script>
<main id="wizard">
  <section class="intro">
    <p class="eyebrow">Saalgirah</p>
    <h1>A birthday letter, in four scenes.</h1>
    <p class="intro-copy">A wax-sealed envelope that opens into candlelight. Write as little or as much as you like — every line already has words waiting in it.</p>
  </section>

  <div class="workspace">
    <aside class="journey">
      <p class="eyebrow">Your letter</p>
      <ol id="progress" aria-label="Progress">
        ${STEPS.map((s, i) => `<li data-progress="${i}"><span class="step-number">0${i + 1}</span><span>${s.title}</span></li>`).join('')}
      </ol>
      <p class="aside-note">Nothing is public until you press send. You can preview it as often as you like.</p>
    </aside>

    <div class="paper">
      <p id="stepCounter" class="eyebrow"></p>
      <form id="saalgirahForm" novalidate>

        <section data-step="0" class="step" hidden>
          <h2 tabindex="-1">Who is it for?</h2>
          <p>Their name goes on the envelope, and into the birthday line itself.</p>
          ${field({ id: 'recipientName', label: 'Their name', max: 60, placeholder: 'Meher', required: true, hint: 'Just the name you actually call them.' })}
        </section>

        <section data-step="1" class="step" hidden>
          <h2 tabindex="-1">The opening</h2>
          <p>Three lines, revealed one at a time, before anything else happens. Leave them as they are if they already sound like you.</p>
          ${field({ id: 'line1', label: 'First line', max: 160, placeholder: 'I was going to write something normal…' })}
          ${field({ id: 'line2', label: 'Second line', max: 160, placeholder: 'but you’re not exactly a normal person to me.' })}
          ${field({ id: 'line3', label: 'Third line', max: 160, placeholder: 'So… I made you this.' })}
        </section>

        <section data-step="2" class="step" hidden>
          <h2 tabindex="-1">The wish</h2>
          <p>The cake arrives, the candles are lit, and this is what appears above them.</p>
          ${field({ id: 'attentionLine', label: 'The line before the cake', max: 160, placeholder: 'Okay… now that I have your attention.' })}
          ${field({ id: 'wishLine', label: 'The birthday line', max: 90, placeholder: 'HAPPY BIRTHDAY, MEHER.', hint: 'Left empty, it becomes “HAPPY BIRTHDAY, ” and their name.' })}
        </section>

        <section data-step="3" class="step" hidden>
          <h2 tabindex="-1">The last words</h2>
          <p>The final scene: the bear holds a small heart, and this is all that is left on screen.</p>
          ${field({ id: 'closingLine', label: 'The declaration', max: 90, placeholder: 'I LOVE YOU.' })}
          ${field({ id: 'note', label: 'A small note underneath', max: 400, type: 'textarea', placeholder: 'Thank you for every ordinary day.' })}
          ${field({ id: 'senderName', label: 'Sign it', max: 60, placeholder: 'Rahul', hint: 'Appears as a signature at the very end.' })}
        </section>

        <section data-step="4" class="step" hidden>
          <h2 tabindex="-1">Ready to send</h2>
          <p>Have one last look, then publish. You will get a link and a QR card you can send anywhere.</p>
          <div id="review" class="review"></div>
<p id="previewState" class="hint" aria-live="polite"></p>
          <button type="button" id="publish" class="button publish">Publish this Paigaam</button>
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
      <div class="livepane__frame"><iframe id="liveFrame" title="Saalgirah live preview" loading="lazy"></iframe></div>
      <p class="aside-note">Updates as you type — exactly as they will see it.</p>
    </aside>
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
    <h2 id="previewDialogTitle">Your letter</h2>
    <div>
      <button type="button" id="fullscreen" class="button secondary">Open in a tab</button>
      <button type="button" id="closePreview" class="button primary">Close</button>
    </div>
  </div>
  <p class="preview-help">Tap the envelope, then the candles — exactly as they will.</p>
  <div id="frameHost"></div>
</dialog>

<noscript><p class="error">Please enable JavaScript to write your letter.</p></noscript>
</body>
`);
}

module.exports = { saalgirahCreatePage, STEPS };
