'use strict';
/**
 * The Sawaal generator — five steps, with a live preview that updates as you
 * type. Every field is optional except their name; the placeholders are the
 * real defaults, so someone can walk straight through and still send the
 * designed questionnaire. Copy lives here, behaviour lives in /sawaal/create.js.
 */
const { logoFull } = require('../lib/brand');

const STEPS = [
  { key: 'design', title: 'The invitation' },
  { key: 'who', title: 'Who it’s for' },
  { key: 'words', title: 'The words' },
  { key: 'days', title: 'Your free days' },
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

function sawaalCreatePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#D92D8E">
<title>Sawaal · Make a Paigaam</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/brand/favicon-512.png" type="image/png">
<link rel="stylesheet" href="/sawaal/create.css">
<script src="/sawaal/create.js" defer></script>
</head>
<body>
<header class="masthead"><a href="/" aria-label="Paigaam">${logoFull(128)}</a><a class="text-link" href="/templates">All templates</a></header>

<main id="wizard">
  <section class="intro">
    <p class="eyebrow">Sawaal</p>
    <h1>The date invitation they play through.</h1>
    <p class="intro-copy">Eight little scenes: the invite, the “do you like me” trap, the vibe, the day, a cheeky scored quiz, a selfie demand — and the final question that decides the ending. Their every answer lands on a private responses page only you can open.</p>
  </section>

  <div class="workspace">
    <aside class="journey">
      <p class="eyebrow">Your questionnaire</p>
      <ol id="progress" aria-label="Progress">
        ${STEPS.map((s, i) => `<li data-progress="${i}"><span class="step-number">0${i + 1}</span><span>${s.title}</span></li>`).join('')}
      </ol>
      <p class="aside-note">Nothing is public until you press send. The preview follows your typing — no saving needed.</p>
    </aside>

    <div class="paper">
      <p id="stepCounter" class="eyebrow"></p>
      <form id="sawaalForm" novalidate>

        <section data-step="0" class="step">
          <h2 tabindex="-1">Eight scenes, one ending you choose</h2>
          <p>They agree to a date, survive the “do you like me” trap, pick the vibe (or type their own idea), choose from <em>your</em> real free days, sit a four-question quiz that is actually scored, surrender a selfie — and answer the final kiss question, which decides how the story ends.</p>
          <ul class="scene-list">
            <li><b>One ·</b> the invitation, on a dreamy pink dreamscape</li>
            <li><b>Two ·</b> choices, traps, the day picker and the scored quiz</li>
            <li><b>Three ·</b> the final question — three answers, two endings, one celebration</li>
          </ul>
          <p class="hint">Everything they pick — including the selfie — waits for you on a private responses page.</p>
          <a class="button secondary" href="/sawaal/demo" target="_blank" rel="noopener">Try the demo <span aria-hidden="true">↗</span></a>
        </section>

        <section data-step="1" class="step" hidden>
          <h2 tabindex="0">Who is it for?</h2>
          <p>Their name is all the questionnaire truly needs.</p>
          ${field({ id: 'recipientName', label: 'Their name', max: 60, placeholder: 'Meher', required: true, hint: 'Just the name you actually call them.' })}
          ${field({ id: 'senderName', label: 'Your name', max: 60, placeholder: 'Rahul', hint: 'Used across the questions and signed in the footer.' })}
        </section>

        <section data-step="2" class="step" hidden>
          <h2 tabindex="0">The words</h2>
          <p>Leave them as they are if they already sound like you. The preview on the right follows every keystroke.</p>
          ${field({ id: 'inviteTitle', label: 'The invitation headline', max: 90, placeholder: 'Let’s schedule a date!' })}
          ${field({ id: 'inviteIntro', label: 'The line under it', max: 140, placeholder: 'Be a good girl & answer all the questions. I’ll worry about the rest.' })}
          ${field({ id: 'likeTitle', label: 'The “do you like me” question', max: 90, placeholder: 'Do you like Rahul?!?!' })}
          ${field({ id: 'vibeTitle', label: 'The vibe question', max: 90, placeholder: 'How do you like it?' })}
          ${field({ id: 'vibeOptions', label: 'Vibe options', max: 160, placeholder: 'Dinner & Chill, Coffee & Walking', hint: 'Comma-separated, up to 4 — they can also type their own idea.' })}
        </section>

        <section data-step="3" class="step" hidden>
          <h2 tabindex="0">Your free days</h2>
          <p>The day-picker scene shows only days you actually offer — each is checked as a real date.</p>
          ${field({ id: 'availableDays', label: 'Days you’re free', max: 200, placeholder: '2026-10-01, 2026-10-02, 2026-10-03', hint: 'Comma-separated YYYY-MM-DD, up to 8. Leave empty to skip the picker.' })}
          ${field({ id: 'quizTitle', label: 'The quiz intro headline', max: 90, placeholder: 'So you know us, huh?' })}
          ${field({ id: 'quizIntro', label: 'The quiz intro line', max: 140, placeholder: 'Answer the following questions. They should be easy, I swear to god!' })}
        </section>

        <section data-step="4" class="step" hidden>
          <h2 tabindex="0">The ending</h2>
          <p>The final question has three answers and two endings. Name both.</p>
          ${field({ id: 'kissTitle', label: 'The final question headline', max: 90, placeholder: 'What if...?' })}
          ${field({ id: 'kissIntro', label: 'The final question line', max: 160, placeholder: 'What if I couldn’t handle your cuteness and kissed you on the first date...' })}
          ${field({ id: 'yesOutcome', label: 'The sweet ending headline', max: 90, placeholder: 'I USED TO PRAY FOR TIMES LIKE THIS' })}
          ${field({ id: 'shyOutcome', label: 'The shy ending headline', max: 90, placeholder: 'Pfff fine. I had to try it anyway' })}
          ${field({ id: 'shyOutcomeLine', label: 'The shy ending line', max: 140, placeholder: 'But I will be holding your hands, no questions asked!' })}
        </section>

        <section data-step="5" class="step" hidden>
          <h2 tabindex="0">Ready to send</h2>
          <p>Have one last look, then publish. You will get a link, a QR card — and the private responses page where their answers land.</p>
          <div id="review" class="review"></div>
          <div class="preview-callout">
            <span aria-hidden="true">✦</span>
            <p>Play the whole questionnaire exactly as they will.</p>
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
      <div class="livepane__frame"><iframe id="liveFrame" title="Sawaal live preview" loading="lazy"></iframe></div>
      <p class="aside-note">Updates as you type — exactly as they will see it.</p>
    </aside>
  </div>
</main>

<section id="publishedResult" class="result paper" hidden aria-labelledby="resultTitle">
  <p class="eyebrow">It’s live</p>
  <h1 id="resultTitle" tabindex="0">Your Paigaam is ready.</h1>
  <p>Send them the link. The questions are already waiting.</p>
  <label for="publishedUrl">Your link</label>
  <input id="publishedUrl" readonly>
  <div class="result-actions">
    <a id="openPublished" class="button primary" target="_blank" rel="noopener">Open it</a>
    <button type="button" id="copyLink" class="button secondary">Copy link</button>
    <a id="whatsapp" class="button secondary" target="_blank" rel="noopener">Send on WhatsApp</a>
  </div>
  <p id="responsesHint" class="hint">Their answers — including the selfie — collect on your private responses page:</p>
  <div class="result-actions"><a id="responsesLink" class="button secondary" target="_blank" rel="noopener">Open my responses page</a></div>
  <figure class="qr"><img id="qrImage" alt="QR code for your Paigaam" width="220" height="220"><figcaption>Or let them scan it.</figcaption></figure>
  <p id="shareStatus" role="status" aria-live="polite"></p>
</section>

<footer><span>Paigaam · because some things deserve more</span></footer>

<dialog id="previewDialog" aria-labelledby="previewDialogTitle">
  <div class="preview-toolbar">
    <h2 id="previewDialogTitle">Your questionnaire</h2>
    <div>
      <button type="button" id="fullscreen" class="button secondary">Open in a tab</button>
      <button type="button" id="closePreview" class="button primary">Close</button>
    </div>
  </div>
  <p class="preview-help">Play it through — every scene, right to the final question.</p>
  <div id="frameHost"></div>
</dialog>

<noscript><p class="error">Please enable JavaScript to build your questionnaire.</p></noscript>
</body>
</html>`;
}

module.exports = { sawaalCreatePage, STEPS };
