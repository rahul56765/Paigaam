'use strict';
/**
 * Sawaal renderer.
 *
 * Emits the whole experience as server-rendered HTML: the dreamscape, the
 * progress chrome and the first scene live in the document (so they survive
 * a failed script, a screen reader, or a share preview) while
 * /sawaal/sawaal.js drives the scene machine — choices, the stubborn "not
 * really" reframe, the custom idea, the day picker, the scored quiz, the
 * selfie upload, the final kiss question and the ending.
 *
 * The mechanic is ported 1:1 from ShamsAli-fathi/ask-me-on-a-date: the same
 * scene order, the same 320ms transitions, the same progress mapping
 * (PROGRESS_STEPS), the same negative-image reframe on "not really", the
 * same 4-answer quiz scoring with the same three score-message tiers, the
 * same three kiss outcomes with the same endings, and the same six-image
 * celebration on the sweet one.
 */

const escape = value => String(value == null ? '' : value)
  .replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const text = (value, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const DEFAULTS = {
  recipientName: 'you',
  senderName: '',
  inviteTitle: 'Let’s schedule a date!',
  inviteIntro: 'Be a good girl & answer all the questions. I’ll worry about the rest.',
  likeTitle: 'Do you like me?!?!',
  vibeTitle: 'How do you like it?',
  vibeOptions: [],
  availableDays: [],
  quizTitle: 'So you know us, huh?',
  quizIntro: 'Answer the following questions. They should be easy, I swear to god!',
  kissTitle: 'What if...?',
  kissIntro: 'What if I couldn’t handle your cuteness and kissed you on the first date...',
  yesOutcome: 'I USED TO PRAY FOR TIMES LIKE THIS',
  shyOutcome: 'Pfff fine. I had to try it anyway',
  shyOutcomeLine: 'But I will be holding your hands, no questions asked!',
};

/**
 * The scored quiz: fixed design copy, part of the template (the original's
 * four safety questions, re-themed to the relationship). Keys mirror the
 * client; the correct answers are enforced server-side in lib/sawaalRoutes.js.
 */
const QUIZ = [
  {
    prompt: 'On our first date, the phone is at 4%. The correct action is…',
    answers: [
      ['A', 'Scrolling — the memes can wait for no one.'],
      ['B', 'Ignoring it entirely; you are the entertainment.'],
      ['C', 'Handing it to me and holding my hand instead.'],
      ['D', 'Charging it. Obviously. Where is your sense of drama?'],
    ],
  },
  {
    prompt: 'Which is more effective than "I don’t know, where do you want to eat?" (per the Hierarchy of Date Planning)?',
    answers: [
      ['A', '“Surprise me.”'],
      ['B', '“You pick.”'],
      ['C', 'Having already picked a place with their favourite dessert on the menu.'],
      ['D', 'Sending them a 40-option poll.'],
    ],
  },
  {
    prompt: 'The plan has a small visible crack (rain at 7pm). The safest move is…',
    answers: [
      ['A', 'Deny the weather exists.'],
      ['B', 'Continue as scheduled, but carry an umbrella like a romantic.'],
      ['C', 'Move it inside — cinema, blanket, shared popcorn.'],
      ['D', 'Cancel. Again.'],
    ],
  },
  {
    prompt: 'A first date has a flash point of 18°C of eye contact. What does this indicate?',
    answers: [
      ['A', 'Nothing will happen below 18 glances.'],
      ['B', 'Enough sparks to ignite at, or around, glance eighteen.'],
      ['C', 'It will automatically catch feelings.'],
      ['D', 'We are both immune to chemistry.'],
    ],
  },
];

/** Correct quiz answers (index into each question's answers array). */
const QUIZ_ANSWERS = { q1: 'C', q2: 'C', q3: 'C', q4: 'B' };

const MEDIA = ['invite', 'like', 'like-no', 'vibe', 'day', 'selfie', 'kiss', 'yes', 'no', 'final', 'pray'];

/* ------------------------------------------------------------------- page */

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id })
 * @param opts     { baseUrl, isPreview }
 */
function renderSawaal(paigaam = {}, opts = {}) {
  const d = paigaam.customer_data && typeof paigaam.customer_data === 'object' ? paigaam.customer_data : {};
  const preview = !!opts.isPreview;
  let origin = '';
  try { const url = new URL(opts.baseUrl); if (['http:', 'https:'].includes(url.protocol)) origin = url.origin; } catch { /* relative is fine */ }
  const canonical = !preview && paigaam.slug ? `${origin}/p/${encodeURIComponent(paigaam.slug)}` : '';

  const who = text(d.recipientName, DEFAULTS.recipientName);
  const sender = text(d.senderName);
  const inviteTitle = text(d.inviteTitle, DEFAULTS.inviteTitle);
  const inviteIntro = text(d.inviteIntro, DEFAULTS.inviteIntro);
  const likeTitle = d.likeTitle ? d.likeTitle : (sender ? `Do you like ${sender}?!?!` : DEFAULTS.likeTitle);
  const vibeTitle = text(d.vibeTitle, DEFAULTS.vibeTitle);
  const vibeOptions = Array.isArray(d.vibeOptions) && d.vibeOptions.length ? d.vibeOptions.slice(0, 4) : ['Dinner & Chill', 'Coffee & Walking'];
  const availableDays = Array.isArray(d.availableDays) ? d.availableDays.filter(v => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + 'T00:00:00').getTime())).slice(0, 8) : [];
  const quizTitle = text(d.quizTitle, DEFAULTS.quizTitle);
  const quizIntro = text(d.quizIntro, DEFAULTS.quizIntro);
  const kissTitle = text(d.kissTitle, DEFAULTS.kissTitle);
  const kissIntro = text(d.kissIntro, sender ? `What if ${sender} couldn’t handle your cuteness and kissed you on the first date...` : DEFAULTS.kissIntro);
  const yesOutcome = text(d.yesOutcome, DEFAULTS.yesOutcome);
  const shyOutcome = text(d.shyOutcome, DEFAULTS.shyOutcome);
  const shyOutcomeLine = text(d.shyOutcomeLine, DEFAULTS.shyOutcomeLine);

  const title = `${inviteTitle} · Paigaam`;
  const description = sender
    ? `A playable date invitation for ${who}, from ${sender}. Eight little scenes and one final question.`
    : `A playable date invitation for ${who}. Eight little scenes and one final question.`;

  /**
   * Personalised copy + the day list. JSON inside a <script> block needs only
   * the </script> break-out neutralised (<\u002f...); HTML-escaping the whole
   * string would corrupt it, because the browser decodes entities before the
   * script reads textContent (the Valentine payload lesson).
   */
  const payload = JSON.stringify({
    recipientName: who,
    senderName: sender,
    inviteTitle,
    inviteIntro,
    likeTitle,
    vibeTitle,
    vibeOptions,
    availableDays,
    quizTitle,
    quizIntro,
    kissTitle,
    kissIntro,
    yesOutcome,
    shyOutcome,
    shyOutcomeLine,
    // Only real published pages carry their id — previews and demos record nothing.
    paigaamId: (!preview && /^sawaal-[a-f0-9]{18}$/.test(paigaam.slug || '')) ? paigaam.slug : null,
  }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#F6D9EF">
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
${preview ? '<meta name="robots" content="noindex, nofollow, noarchive">' : canonical ? `<link rel="canonical" href="${escape(canonical)}">` : ''}
<meta property="og:type" content="website">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
${canonical ? `<meta property="og:url" content="${escape(canonical)}">` : ''}
${origin ? `<meta property="og:image" content="${escape(origin)}/brand/favicon-512.png">` : ''}
<meta name="twitter:card" content="summary">
<link rel="icon" href="/brand/favicon-512.png" type="image/png">
<link rel="stylesheet" href="/sawaal/sawaal.css">
<script src="/sawaal/sfx.js" defer></script>
<script src="/sawaal/sawaal.js" defer></script>
</head>
<body class="sw" data-preview="${preview}">
<script type="application/json" id="swPayload">${payload}</script>
${preview ? '<div class="sw-previewbadge">Preview</div>' : ''}
<div class="dreamscape" aria-hidden="true">
  <span class="orb orb-pink"></span>
  <span class="orb orb-blue"></span>
  <span class="orb orb-lavender"></span>
  <span class="halo"></span>
  <span class="sparkle sparkle-one">✦</span>
  <span class="sparkle sparkle-two">✦</span>
  <span class="sparkle sparkle-three">✧</span>
</div>

<header class="floating-header">
  <a class="brand" href="/" aria-label="Paigaam"><span class="brand-mark" aria-hidden="true">✦</span></a>
  <div class="scene-indicator" aria-label="Current scene">
    <span class="scene-dot" aria-hidden="true"></span>
    <span id="swSceneLabel">Scene 01</span>
  </div>
</header>

<main class="experience-shell">
  <section class="experience-card" id="swExperience" aria-labelledby="pageTitle">
    <div class="card-glow" aria-hidden="true"></div>
    <div class="progress-row" aria-label="Experience progress">
      <span id="swProgressCopy">A tiny question</span>
      <span id="swProgressCount">01 / 08</span>
    </div>
    <div class="progress-track" aria-hidden="true"><span id="swProgressFill" style="width:12.5%"></span></div>
    <div class="scene-content" id="swSceneContent">
      <div class="scene-layout">
        <figure class="scene-visual">
          <img src="/sawaal/media/invite.png" alt="Illustration for the date invitation">
        </figure>
        <div class="scene-copy">
          <p class="eyebrow"><span aria-hidden="true">✦</span> Your invitation</p>
          <h1 id="pageTitle">${escape(inviteTitle)}</h1>
          <p class="sw-intro">${escape(inviteIntro)}</p>
          <div class="choice-form" id="swChoiceForm">
            <div class="choices">
              <button type="button" data-choice="yes"><span>Yes</span><span class="button-arrow" aria-hidden="true">↗</span></button>
              <button type="button" data-choice="yes_of_course" class="secondary"><span>Yes, Of course</span><span class="button-arrow" aria-hidden="true">→</span></button>
            </div>
            <p class="form-message" id="swFormMessage" aria-live="polite"></p>
          </div>
        </div>
      </div>
    </div>
    <p class="microcopy"><span aria-hidden="true">♡</span> Answer with your heart. The rest is multiple choice.</p>
  </section>
</main>

<footer class="page-footer">
  <p>${sender ? `MADE FOR ${escape(who).toUpperCase()} · WITH LOVE, ${escape(sender).toUpperCase()}` : 'MADE FOR A CUTIE'}</p>
  <span aria-hidden="true">✦</span>
</footer>

<noscript>
  <style>.choices, .custom-answer, .date-answer, .upload-answer, .next-button { display: none !important; }</style>
  <p class="sw-noscript">This invitation needs JavaScript — enable it and the questions will take it from here.</p>
</noscript>
</body>
</html>`;
}

module.exports = { renderSawaal, DEFAULTS, QUIZ, QUIZ_ANSWERS, MEDIA, escape };
