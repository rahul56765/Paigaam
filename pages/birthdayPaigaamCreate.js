'use strict';
/**
 * The Birthday Paigaam wizard — nine friendly steps.
 *
 * Only their name is required; every text box shows the designed default as
 * its placeholder, so an untouched form still sends the full surprise.
 * [NAME] / [SENDER] / [AGE] placeholders are filled in on the page.
 * Behaviour (drafts, uploads, recording, live preview, publish) lives in
 * /birthday-paigaam/create.js; ids here mirror templates/birthday-paigaam/schema.js.
 */
const { builderShell } = require('../lib/builderShell');
const D = require('../templates/birthday-paigaam/defaults');

const STEPS = [
  { key: 'who', title: 'Who it’s for', screen: 'unlock' },
  { key: 'lock', title: 'The lock', screen: 'unlock' },
  { key: 'question', title: 'The question', screen: 'question' },
  { key: 'letter', title: 'The letter', screen: 'letter' },
  { key: 'sounds', title: 'Voice & song', screen: 'voice' },
  { key: 'scrapbook', title: 'Scrapbook', screen: 'scrapbook' },
  { key: 'finale', title: 'The finale', screen: 'finale' },
  { key: 'look', title: 'Look & feel', screen: 'unlock' },
  { key: 'publish', title: 'Send it', screen: 'unlock' },
];

const attr = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function field({ id, label, hint, max, type = 'text', rows = 3, placeholder, required = false, inputmode, pattern }) {
  const ph = placeholder != null ? placeholder : (D.TEXT[id] || '');
  const attrs = `id="${id}" name="${id}"${max ? ` maxlength="${max}"` : ''}${required ? ' required' : ''}${ph ? ` placeholder="${attr(ph)}"` : ''}${inputmode ? ` inputmode="${inputmode}"` : ''}${pattern ? ` pattern="${pattern}"` : ''}`;
  const input = type === 'textarea' ? `<textarea ${attrs} rows="${rows}"></textarea>` : `<input type="${type}" ${attrs}>`;
  return `<div class="field">
  <label for="${id}">${label}${required ? ' <span class="req" aria-hidden="true">*</span>' : ' <span class="opt">optional</span>'}</label>
  ${input}
  ${hint ? `<p class="hint">${hint}</p>` : ''}
</div>`;
}

const TOKEN_HINT = 'Tip: type <code>[NAME]</code> and it becomes their name.';

function birthdayPaigaamCreatePage(opts = {}) {
  const price = Number(opts.price) || 0, listPrice = Number(opts.listPrice) || 0;
  const rd = opts.resumeDraft || null;
  const boot = rd ? { draftId: rd.id, data: rd.customer_data || {}, at: rd.updated_at ? new Date(String(rd.updated_at).replace(' ', 'T') + 'Z').getTime() : Date.now(), noun: 'surprise', previewUrl: '/birthday-paigaam/preview/' + rd.id } : null;
  const config = { steps: STEPS.map(s => s.screen), defaults: D.TEXT, noMessages: D.NO_MESSAGES, loveNotes: D.LOVE_NOTES, reasons: D.REASONS, palettes: D.PALETTES };
  const palettes = Object.entries(D.PALETTES).map(([key, p]) => `<button type="button" class="bpw-preset" data-preset="${key}" aria-label="${key} palette">${['blush', 'cream', 'peach', 'lavender', 'accent'].map(k => `<span style="background:${p[k]}"></span>`).join('')}<b>${key}</b></button>`).join('');
  const pickers = [['blush', 'Blush'], ['cream', 'Cream'], ['peach', 'Peach'], ['lavender', 'Lavender'], ['accent', 'Accent']]
    .map(([k, l]) => `<label class="bpw-color"><input type="color" id="pal-${k}" value="${D.PALETTES.dreamy[k]}"><span>${l}</span></label>`).join('');
  const fonts = Object.entries(D.FONTS).map(([key, f], i) => `<label class="bpw-font"><input type="radio" name="font" value="${key}"${i === 0 ? ' checked' : ''}><span class="bpw-font__name" style="font-family:${attr(f.heading)}">${f.label}</span><span class="bpw-font__sample" style="font-family:${attr(f.script)}">for surprise</span><span class="bpw-font__hand" style="font-family:${attr(f.hand)}">with love, always</span></label>`).join('');
  const fontCss = Object.values(D.FONTS).map(f => f.css).join('&');
  const toggles = [
    ['question', 'The “Wanna see it?” question'], ['letter', 'The envelope & letter'], ['voice', 'Voice note (when you add one)'],
    ['song', 'Our song'], ['scrapbook', 'Scrapbook'], ['notes', '“Things I love about you” notes'], ['reasons', '“Reasons you’re special”'],
    ['cake', 'The cake to blow out'], ['countdown', 'Birthday countdown (needs the date)'],
  ].map(([k, l]) => `<label class="bpw-toggle"><input type="checkbox" data-screen-toggle="${k}" checked><span>${l}</span></label>`).join('');

  return builderShell('Birthday Paigaam', `
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fontCss}&display=swap">
<link rel="stylesheet" href="/saalgirah/create.css?v=3">
<link rel="stylesheet" href="/birthday-paigaam/create.css?v=1">
<script type="application/json" id="bpwConfig">${JSON.stringify(config).replace(/</g, '\\u003c')}</script>
<script src="/birthday-paigaam/create.js?v=1" defer></script>
<script src="/js/paigaam-pay.js?v=1" defer></script>
${boot ? `<script src="/js/resume.js?v=1" defer></script>
<script type="application/json" id="wizardBoot">${JSON.stringify(boot).replace(/</g, '\\u003c')}</script>` : ''}
<main id="wizard">
  <section class="intro">
    <p class="eyebrow">Birthday Paigaam</p>
    <h1>A secret birthday surprise, behind a passcode.</h1>
  </section>
  <div class="workspace">
    <aside class="journey">
      <ol id="progress" aria-label="Progress">
        ${STEPS.map((s, i) => `<li data-progress="${i}"><span class="step-number">0${i + 1}</span><span>${s.title}</span></li>`).join('')}
      </ol>
    </aside>

    <div class="paper">
      <p id="stepCounter" class="eyebrow"></p>
      <form id="bpwForm" novalidate>

        <section data-step="0" class="step" hidden>
          <h2 tabindex="-1">Who is the birthday for?</h2>
          <p>Their name appears all through the surprise. Everything else is optional.</p>
          ${field({ id: 'recipientName', label: 'Their name', max: 40, placeholder: 'Meher', required: true })}
          ${field({ id: 'senderName', label: 'Your name (signs the letter)', max: 40, placeholder: 'Rahul' })}
          <div class="bpw-row">
            ${field({ id: 'age', label: 'Turning', max: 3, placeholder: '24', inputmode: 'numeric' })}
            ${field({ id: 'birthdayDate', label: 'Birthday', type: 'date', placeholder: '', hint: 'For the countdown.' })}
          </div>
          <div class="field">
            <span class="label">Their photo <span class="opt">optional</span></span>
            <div class="bpw-photo" id="mainPhotoBox">
              <img id="mainPhotoImg" alt="" hidden>
              <label class="bpw-upload"><input type="file" id="mainPhotoFile" accept="image/*"><span>Choose a photo</span></label>
              <button type="button" class="bpw-x" id="mainPhotoRemove" hidden>Remove</button>
            </div>
            <p class="hint">Sits in the scalloped frame on the very first screen.</p>
          </div>
        </section>

        <section data-step="1" class="step" hidden>
          <h2 tabindex="-1">The lock</h2>
          <p>Four numbers they’ll need to open it — a date, an inside joke, anything. Share it with them however you like.</p>
          ${field({ id: 'passcode', label: 'Passcode (4 digits)', max: 4, placeholder: '1234', inputmode: 'numeric', pattern: '[0-9]{4}', hint: 'Left empty, it’s 1234.' })}
          ${field({ id: 'passcodeHint', label: 'A hint (shows after two wrong tries)', max: 80, placeholder: 'the day we met ♡' })}
        </section>

        <section data-step="2" class="step" hidden>
          <h2 tabindex="-1">“Wanna see it?”</h2>
          <p>The cute question. Every time they press NO, the YES button grows and the next line appears.</p>
          ${field({ id: 'question', label: 'The question', max: 160, hint: TOKEN_HINT })}
          <div class="bpw-row">${field({ id: 'yesLabel', label: 'YES button', max: 20 })}${field({ id: 'noLabel', label: 'NO button', max: 20 })}</div>
          ${field({ id: 'noMessages', label: 'What NO says — one per line', type: 'textarea', rows: 6, placeholder: D.NO_MESSAGES.join('\n'), hint: 'Up to 10 lines; after the last one, NO turns into YES.' })}
          ${field({ id: 'tryAgainLabel', label: 'Try-again button', max: 24 })}
        </section>

        <section data-step="3" class="step" hidden>
          <h2 tabindex="-1">The letter</h2>
          <p>It waits in a wax-sealed envelope and types itself out once they open it. Leave a blank line between paragraphs.</p>
          ${field({ id: 'letterGreeting', label: 'Greeting', max: 80, hint: TOKEN_HINT })}
          ${field({ id: 'letter', label: 'Your letter', type: 'textarea', rows: 9, max: 3000 })}
          ${field({ id: 'signoff', label: 'Sign-off', max: 60, hint: 'Your name is signed underneath in handwriting.' })}
        </section>

        <section data-step="4" class="step" hidden>
          <h2 tabindex="-1">Voice note &amp; our song</h2>
          <p>Add your voice and your song. Nothing ever plays by itself — they tap play. The song softens automatically while your voice note plays.</p>
          <fieldset class="bpw-audio" id="voiceBox">
            <legend>Voice note <span class="opt">optional</span></legend>
            <audio id="voicePreview" controls hidden></audio>
            <div class="bpw-audio__actions">
              <label class="bpw-upload"><input type="file" id="voiceFile" accept="audio/*"><span>Upload audio</span></label>
              <button type="button" class="bpw-rec" id="recBtn"><span class="dot" aria-hidden="true"></span><span class="lbl">Record now</span></button>
              <span class="bpw-rec__time" id="recTime" aria-live="polite"></span>
              <button type="button" class="bpw-x" id="voiceRemove" hidden>Remove</button>
            </div>
            <p class="hint">Up to 10 MB (about 3 minutes). Without a voice note, this screen is skipped.</p>
            ${field({ id: 'voiceTitle', label: 'Card title', max: 80 })}
          </fieldset>
          <fieldset class="bpw-audio" id="songBox">
            <legend>Our song <span class="opt">optional</span></legend>
            <audio id="songPreview" controls hidden></audio>
            <div class="bpw-audio__actions">
              <label class="bpw-upload"><input type="file" id="songFile" accept="audio/*,.mp3,.m4a"><span>Upload MP3</span></label>
              <button type="button" class="bpw-x" id="songRemove" hidden>Remove</button>
            </div>
            <p class="hint">Up to 15 MB. Without one, a little Happy Birthday music box plays instead. Please only upload music you have the right to share.</p>
            <div class="bpw-row">${field({ id: 'songTitle', label: 'Song title', max: 80, placeholder: 'Perfect' })}${field({ id: 'songArtist', label: 'Artist', max: 80, placeholder: 'Ed Sheeran' })}</div>
          </fieldset>
        </section>

        <section data-step="5" class="step" hidden>
          <h2 tabindex="-1">The scrapbook</h2>
          <p>Polaroids with a caption underneath and a secret message on the back (they tap to flip). Drag to reorder here, or they can rearrange them on the page.</p>
          <div class="bpw-photos">
            <ol id="photoList" class="bpw-photos__list"></ol>
            <label class="bpw-upload bpw-upload--big"><input type="file" id="photoFiles" accept="image/*" multiple><span>+ Add photos</span></label>
            <p class="hint" id="photoStatus" aria-live="polite">Up to 40 photos.</p>
          </div>
          ${field({ id: 'memoriesTitle', label: 'Section title', max: 60 })}
          ${field({ id: 'loveNotes', label: '“Things I love about you” — one per line', type: 'textarea', rows: 6, placeholder: D.LOVE_NOTES.join('\n'), hint: 'Each becomes a sticky note that pops in.' })}
          ${field({ id: 'loveTitle', label: 'Sticky-notes title', max: 60 })}
          ${field({ id: 'reasons', label: '“Reasons you’re special” — one per line', type: 'textarea', rows: 6, placeholder: D.REASONS.join('\n') })}
          ${field({ id: 'reasonsTitle', label: 'Reasons title', max: 60 })}
        </section>

        <section data-step="6" class="step" hidden>
          <h2 tabindex="-1">The grand finale</h2>
          <p>Balloons, confetti and a cake with candles they blow out by tapping.</p>
          ${field({ id: 'finaleTitle', label: 'The big line', max: 80, hint: TOKEN_HINT })}
          ${field({ id: 'finaleLine', label: 'Underneath', max: 200 })}
          <div class="field"><label for="candles">Candles on the cake</label><select id="candles" name="candles">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<option value="${n}"${n === 5 ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
          ${field({ id: 'whatsapp', label: 'Your WhatsApp number (for their thank-you)', max: 24, placeholder: '91 98765 43210', inputmode: 'tel', hint: 'With country code. Left empty, they choose who to send it to.' })}
          ${field({ id: 'thankYouText', label: 'Their thank-you message (pre-filled)', max: 200 })}
        </section>

        <section data-step="7" class="step" hidden>
          <h2 tabindex="-1">Look &amp; feel</h2>
          <p>Pick a palette, or choose your own five colours. The artwork recolours itself.</p>
          <div class="bpw-presets">${palettes}</div>
          <div class="bpw-colors">${pickers}</div>
          <p class="label">Fonts</p>
          <div class="bpw-fonts">${fonts}</div>
          <p class="label">Screens</p>
          <div class="bpw-toggles">${toggles}</div>
          <label class="bpw-toggle"><input type="checkbox" id="showBrand" checked><span>Show “Made with love by Paigaam” at the end</span></label>
        </section>

        <section data-step="8" class="step" hidden>
          <h2 tabindex="-1">Ready to send</h2>
          <p>Have one last look (tap “Preview” — the passcode is skipped for you), then publish. You’ll get a link and a QR card.</p>
          <div id="review" class="review"></div>
          <button type="button" id="savePreview" class="button secondary">Preview the whole surprise</button>
          <p id="previewState" class="hint" aria-live="polite"></p>
          <button type="button" id="publish" class="button publish">${price > 0 ? `Pay &#8377;${price} &amp; publish` : 'Publish this Paigaam'}</button>
          <p class="hint">${price > 0 ? `Secure payment via Razorpay${listPrice > price ? ` — <s>&#8377;${listPrice}</s>` : ''}.` : 'Free. Don’t forget to tell them the passcode!'}</p>
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
      <div class="livepane__frame"><iframe id="liveFrame" title="Birthday Paigaam live preview"></iframe></div>
    </aside>
  </div>
</main>

<section id="publishedResult" class="result paper" hidden aria-labelledby="resultTitle">
  <p class="eyebrow">It’s live</p>
  <h1 id="resultTitle" tabindex="-1">Your Paigaam is ready.</h1>
  <p>Send them the link — and the passcode: <b id="resultCode"></b></p>
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

<dialog id="previewDialog" aria-labelledby="previewDialogTitle">
  <div class="preview-toolbar">
    <h2 id="previewDialogTitle">Your surprise</h2>
    <div>
      <button type="button" id="fullscreen" class="button secondary">Open in a tab</button>
      <button type="button" id="closePreview" class="button primary">Close</button>
    </div>
  </div>
  <div id="frameHost"></div>
</dialog>
<noscript><p class="error">Please enable JavaScript to make your surprise.</p></noscript>
`, { accent: '#C2185B', soft: '#FFF4D6' });
}

module.exports = { birthdayPaigaamCreatePage, STEPS };
