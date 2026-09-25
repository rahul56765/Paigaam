'use strict';
/**
 * Pehchaan (How Well Do You Know Us?) renderer.
 *
 * The quiz state (current question, score, flip animation) lives entirely in
 * the client. The server renders:
 *   · the intro card — fully in HTML
 *   · the question card structure — filmstrip frames and the card shell
 *   · the reveal card structure — the flip-wrap shell
 *   · the score card structure — the ring SVG and "out of N" text
 *   · a JSON payload with the questions array and score band strings
 *
 * Every sender string that appears in the HTML goes through escape(); the
 * payload goes through jsonPayload() (which neutralises `<`). The client JS
 * always sets sender text with .textContent, never .innerHTML.
 */
const config = require('./config');
const schema = require('./schema');
const { resolve } = require('../../lib/bfday/fields');
const { escape, jsonPayload, head, previewBadge } = require('../../lib/bfday/page');

/* Ordinal words for question labels (matching the original design). */
const ORDINALS = ['zero','one','two','three','four','five','six','seven','eight'];
function ordinal(n) { return ORDINALS[n] || String(n); }

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id })
 * @param opts     { baseUrl, isPreview }
 */
function render(paigaam = {}, opts = {}) {
  const d = resolve(config, paigaam && paigaam.customer_data, schema);
  const preview = !!opts.isPreview;

  const sender = d.senderName || 'your favourite person';
  const total  = d.questions.length;

  const title = `How Well Do You Know Us? · Paigaam`;
  const description = d.senderName
    ? `${d.senderName} made a quiz for you. ${total} question${total !== 1 ? 's' : ''} — find out how well you really know each other.`
    : 'A quiz about the two of you. Find out how well you really know each other.';

  /* Build the questions payload for the client. */
  const payload = {
    questions: d.questions.map(function (qi) {
      return {
        q:       qi.q,
        answers: [qi.a1, qi.a2, qi.a3, qi.a4],
        correct: parseInt(qi.correct, 10) - 1,   /* 0-indexed */
        story:   qi.story,
        caption: qi.caption,
      };
    }),
    bands: {
      zero:    d.bandZero,
      low:     d.bandLow,
      high:    d.bandHigh,
      perfect: d.bandPerfect,
    },
    screenshotCta: d.screenshotCta,
    ordinals: ORDINALS,
  };

  /* Server-render one filmstrip frame per question. */
  const frames = d.questions.map(function (_, i) {
    return `        <div class="frame" data-frame="${i}"></div>`;
  }).join('\n');

  /* Circumference of the score ring (r=66): 2π×66 ≈ 414.69. */
  const CIRC = (2 * Math.PI * 66).toFixed(2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
${head({ paigaam, opts, title, description, themeColor: '#FFFDF8' })}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,600&family=Caveat:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/know-us-quiz/pehchaan.css">
<script src="/know-us-quiz/pehchaan.js" defer></script>
</head>
<body data-preview="${preview}">
${previewBadge(opts)}
${jsonPayload('qzPayload', payload)}
<main class="deck">
  <div class="stage" id="stage">

    <!-- 1 · INTRO -->
    <section class="card active" id="card-intro" aria-label="Introduction">
      <p class="brand-tag">paigaam <span class="dot"></span> boyfriend day edition</p>
      <h1 class="title">how well do you know <em>us?</em></h1>
      <p class="sender">${escape(sender)}</p>
      <p class="subtext"><span id="q-count-label">${escape(String(total))} question${total !== 1 ? 's' : ''}</span><span class="sep">·</span><span id="intro-line">${escape(d.introLine)}</span></p>
      <div style="margin-top:28px;">
        <button class="btn btn-sage btn-block" id="btn-start" type="button">start</button>
      </div>
    </section>

    <!-- 2 · QUESTION -->
    <section class="card" id="card-question" aria-label="Question" aria-live="polite">
      <div class="filmstrip" id="filmstrip" role="progressbar" aria-label="quiz progress" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="0">
${frames}
        <span class="frame-counter" id="frame-counter">1/${escape(String(total))}</span>
      </div>
      <p class="q-label" id="q-label">question ${ordinal(1)}</p>
      <h2 class="question" id="q-text"></h2>
      <div class="chips" id="chips"></div>
    </section>

    <!-- 3 · REVEAL (flip) -->
    <section class="card" id="card-reveal" aria-label="Answer reveal" aria-live="polite">
      <div class="flip-wrap">
        <div class="flip-inner" id="flip-inner">
          <div class="flip-face flip-front">
            <p class="q-label" id="rv-front-label">question ${ordinal(1)}</p>
            <h2 class="question" id="rv-front-q" style="margin-bottom:0;"></h2>
            <div style="height:120px;"></div>
          </div>
          <div class="flip-face flip-back">
            <div class="photo" id="rv-photo"></div>
            <p class="reveal-verdict" id="rv-verdict">correct! ❤️</p>
            <p class="reveal-answer" id="rv-answer"></p>
            <p class="reveal-story" id="rv-story"></p>
            <div class="reveal-actions">
              <button class="btn btn-sage" id="btn-next" type="button">next</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 4 · SCORE -->
    <section class="card" id="card-score" aria-label="Your score">
      <p class="brand-tag" style="margin-bottom:10px;">the verdict</p>
      <div class="score-ring">
        <svg viewBox="0 0 150 150" width="150" height="150" aria-hidden="true">
          <circle cx="75" cy="75" r="66" fill="none" stroke="rgba(43,33,24,.1)" stroke-width="7"/>
          <circle id="ring-progress" cx="75" cy="75" r="66" fill="none" stroke="#C9A86A" stroke-width="7"
                  stroke-linecap="round" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"
                  transform="rotate(-90 75 75)" style="transition:stroke-dashoffset 1s cubic-bezier(.3,.8,.3,1);"/>
        </svg>
        <div class="score-num">
          <span class="score-big" id="score-big">0</span>
          <span class="score-of" id="score-of">out of ${escape(String(total))}</span>
        </div>
      </div>
      <p class="band" id="band-title"></p>
      <p class="screenshot-cta" id="screenshot-cta">${escape(d.screenshotCta)}</p>
      <div class="score-actions">
        <button class="btn btn-sage" id="btn-replay" type="button">play again</button>
        <button class="btn btn-ghost" id="btn-replay-ghost" type="button">replay &amp; try for ${escape(String(total))}/${escape(String(total))}</button>
      </div>
    </section>

  </div>
  <p class="page-foot">made with love · <a href="/">Paigaam</a></p>
</main>
</body>
</html>`;
}

module.exports = { render };
