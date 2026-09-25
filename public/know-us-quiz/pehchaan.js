'use strict';
/**
 * Pehchaan — How Well Do You Know Us?
 *
 * Reads the questions array and score bands from the JSON payload that
 * render.js embeds. All sender text is applied via .textContent (never
 * .innerHTML). Static template markup (SVG gradients, chip shape) may be
 * built with innerHTML.
 *
 * Interactions ported 1:1 from t6-quiz.html:
 *   · Start → first question (filmstrip at Q1)
 *   · Tap an answer → lock all chips, colour correct/wrong, animate (pop/shake)
 *   · After 750ms (correct) or 950ms (wrong) → flip reveal card
 *   · Flip reveal → question mirrors the front face; back shows verdict + story
 *   · Reduced motion: no pop/shake, flip is instant
 *   · "Next" / "See my score" → next question or score card
 *   · Score card: ring animates, band text from payload
 *   · "Play again" / "Replay" → reset to Q1
 *   · Missing markup: bail early, no throw
 */
(function () {
  /* ---------------------------------------------------------------------- */
  /* boot                                                                     */
  /* ---------------------------------------------------------------------- */

  var payloadEl = document.getElementById('qzPayload');
  if (!payloadEl) return;

  var DATA;
  try { DATA = JSON.parse(payloadEl.textContent); } catch (e) { return; }

  var QUESTIONS = (DATA && Array.isArray(DATA.questions)) ? DATA.questions : [];
  var BANDS     = (DATA && DATA.bands)          || {};
  var ORDINALS  = (DATA && Array.isArray(DATA.ordinals)) ? DATA.ordinals : [];

  if (!QUESTIONS.length) return;

  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (REDUCED) document.body.classList.add('reduced');

  /* Element refs — bail if the markup is incomplete. */
  var stage      = document.getElementById('stage');
  var btnStart   = document.getElementById('btn-start');
  var cardIntro  = document.getElementById('card-intro');
  var cardQ      = document.getElementById('card-question');
  var cardReveal = document.getElementById('card-reveal');
  var cardScore  = document.getElementById('card-score');
  var filmstrip  = document.getElementById('filmstrip');
  var frameCtr   = document.getElementById('frame-counter');
  var qLabel     = document.getElementById('q-label');
  var qText      = document.getElementById('q-text');
  var chipsEl    = document.getElementById('chips');
  var rvFrLabel  = document.getElementById('rv-front-label');
  var rvFrQ      = document.getElementById('rv-front-q');
  var flipInner  = document.getElementById('flip-inner');
  var rvPhoto    = document.getElementById('rv-photo');
  var rvVerdict  = document.getElementById('rv-verdict');
  var rvAnswer   = document.getElementById('rv-answer');
  var rvStory    = document.getElementById('rv-story');
  var btnNext    = document.getElementById('btn-next');
  var scoreBig   = document.getElementById('score-big');
  var bandTitle  = document.getElementById('band-title');
  var screenshotCta = document.getElementById('screenshot-cta');
  var ringProg   = document.getElementById('ring-progress');
  var btnReplay  = document.getElementById('btn-replay');
  var btnReplayG = document.getElementById('btn-replay-ghost');

  if (!stage || !btnStart || !cardIntro || !cardQ || !cardReveal || !cardScore ||
      !filmstrip || !frameCtr || !qLabel || !qText || !chipsEl ||
      !rvFrLabel || !rvFrQ || !flipInner || !rvPhoto || !rvVerdict ||
      !rvAnswer || !rvStory || !btnNext || !scoreBig || !bandTitle ||
      !ringProg || !btnReplay) return;

  /* ---------------------------------------------------------------------- */
  /* SVG photo placeholders (static template art — innerHTML is fine here)   */
  /* ---------------------------------------------------------------------- */

  var PHOTO_PALETTES = [
    { stops: ['#F3E3C3','#D9B98A','#B98A5A'], alt: 'warm light and two cups' },
    { stops: ['#C7D3BC','#8A9B7C','#5C6E52'], alt: 'open road at golden hour' },
    { stops: ['#F0C9A8','#E09A6E','#B85C48'], alt: 'street food stall at dusk' },
    { stops: ['#E8D6B8','#C9A86A','#8B7345'], alt: 'a clock on a warm wall' },
    { stops: ['#D8E0CE','#A8B795','#6F8163'], alt: 'a little parrot on a perch' },
  ];

  function photoSVG(idx) {
    var p = PHOTO_PALETTES[idx % PHOTO_PALETTES.length];
    var uid = 'g-' + idx + '-' + Math.random().toString(36).slice(2, 7);
    return '<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label="' +
      'photo placeholder: ' + p.alt + '">' +
      '<defs><linearGradient id="' + uid + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + p.stops[0] + '"/>' +
      '<stop offset="0.55" stop-color="' + p.stops[1] + '"/>' +
      '<stop offset="1" stop-color="' + p.stops[2] + '"/>' +
      '</linearGradient></defs>' +
      '<rect width="400" height="150" fill="url(#' + uid + ')"/>' +
      '<circle cx="330" cy="34" r="22" fill="rgba(255,253,248,.5)"/>' +
      '<path d="M0 110 Q 100 80 200 105 T 400 95 V150 H0 Z" fill="rgba(255,253,248,.28)"/>' +
      '<path d="M0 125 Q 120 100 240 122 T 400 115 V150 H0 Z" fill="rgba(43,33,24,.10)"/>' +
      '</svg>';
  }

  /* ---------------------------------------------------------------------- */
  /* state                                                                    */
  /* ---------------------------------------------------------------------- */

  var idx = 0;
  var score = 0;
  var locked = false;
  var lastCorrect = false;

  /* ---------------------------------------------------------------------- */
  /* helpers                                                                  */
  /* ---------------------------------------------------------------------- */

  function show(cardId) {
    var cards = stage.querySelectorAll('.card');
    for (var i = 0; i < cards.length; i++) cards[i].classList.remove('active');
    var target = document.getElementById(cardId);
    if (!target) return;
    target.classList.add('active');
    /* restart entrance animation */
    target.style.animation = 'none';
    void target.offsetWidth;
    target.style.animation = '';
  }

  function ordinalWord(n) {
    return ORDINALS[n] || String(n);
  }

  /* ---------------------------------------------------------------------- */
  /* filmstrip                                                                */
  /* ---------------------------------------------------------------------- */

  function renderStrip() {
    var frames = filmstrip.querySelectorAll('.frame');
    for (var i = 0; i < frames.length; i++) {
      frames[i].classList.remove('done', 'current');
      if (i < idx) frames[i].classList.add('done');
      else if (i === idx) frames[i].classList.add('current');
    }
    frameCtr.textContent = (idx + 1) + '/' + QUESTIONS.length;
    filmstrip.setAttribute('aria-valuenow', String(idx));
  }

  /* ---------------------------------------------------------------------- */
  /* question                                                                 */
  /* ---------------------------------------------------------------------- */

  function renderQuestion() {
    locked = false;
    renderStrip();
    var item = QUESTIONS[idx];

    qLabel.textContent = 'question ' + ordinalWord(idx + 1);
    qText.textContent = item.q;

    /* Build chips — sender text via textContent only. */
    chipsEl.innerHTML = '';
    item.answers.forEach(function (answerText, ai) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';

      /* Static chip shape via innerHTML; no sender text here. */
      b.innerHTML = '<span class="mark" aria-hidden="true">✓</span><span class="chip-text"></span>';
      b.querySelector('.chip-text').textContent = answerText;
      b.setAttribute('aria-label', answerText);

      var isCorrect = (ai === item.correct);
      b.addEventListener('click', function () { lockAnswer(b, isCorrect, ai); });
      chipsEl.appendChild(b);
    });

    show('card-question');
  }

  function lockAnswer(btn, isCorrect, pickedIdx) {
    if (locked) return;
    locked = true;
    lastCorrect = isCorrect;

    var chips = chipsEl.querySelectorAll('.chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].disabled = true;
      if (chips[i] !== btn) chips[i].classList.add('dim');
    }
    btn.classList.remove('dim');

    if (isCorrect) {
      score++;
      btn.classList.add('correct');
      if (!REDUCED) btn.classList.add('pop');
    } else {
      btn.classList.add('wrong');
      if (!REDUCED) btn.classList.add('shake');
      /* highlight the correct chip */
      var correctIdx = QUESTIONS[idx].correct;
      if (chips[correctIdx]) chips[correctIdx].classList.add('correct');
    }

    setTimeout(showReveal, isCorrect ? 750 : 950);
  }

  /* ---------------------------------------------------------------------- */
  /* reveal                                                                   */
  /* ---------------------------------------------------------------------- */

  function showReveal() {
    var item = QUESTIONS[idx];

    /* Front face mirrors the question. */
    rvFrLabel.textContent = 'question ' + ordinalWord(idx + 1);
    rvFrQ.textContent = item.q;

    /* Back face: verdict, correct answer text, story, caption. */
    if (lastCorrect) {
      rvVerdict.textContent = 'correct! ❤️';
      rvVerdict.classList.remove('wrong-color');
    } else {
      rvVerdict.textContent = 'close enough 🙈';
      rvVerdict.classList.add('wrong-color');
    }

    var correctText = item.answers[item.correct] || '';
    rvAnswer.textContent = 'answer: ' + correctText;
    rvStory.textContent = item.story;

    /* Photo placeholder (static SVG markup) + caption via textContent. */
    rvPhoto.innerHTML = photoSVG(idx);
    var captionEl = document.createElement('span');
    captionEl.className = 'caption-chip';
    captionEl.textContent = item.caption;
    rvPhoto.appendChild(captionEl);

    btnNext.textContent = (idx === QUESTIONS.length - 1) ? 'see my score' : 'next';

    /* Reset flip before showing. */
    flipInner.classList.remove('flipped');
    show('card-reveal');

    /* Trigger flip. */
    if (REDUCED) {
      flipInner.classList.add('flipped');
    } else {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          flipInner.classList.add('flipped');
        });
      });
    }
  }

  /* ---------------------------------------------------------------------- */
  /* score                                                                    */
  /* ---------------------------------------------------------------------- */

  function bandFor(s, total) {
    if (s === 0)            return BANDS.zero    || '';
    if (s === total)        return BANDS.perfect || '';
    if (s > total / 2)      return BANDS.high    || '';
    return                         BANDS.low     || '';
  }

  function showScore() {
    /* Mark all filmstrip frames done. */
    var frames = filmstrip.querySelectorAll('.frame');
    for (var i = 0; i < frames.length; i++) {
      frames[i].classList.add('done');
      frames[i].classList.remove('current');
    }

    var total = QUESTIONS.length;
    var circumference = 2 * Math.PI * 66;   /* r=66, matches the SVG */

    scoreBig.textContent = String(score);
    bandTitle.textContent = '"' + bandFor(score, total) + '"';

    /* screenshotCta is already server-rendered; only update the ring. */

    show('card-score');

    ringProg.style.transition = 'none';
    ringProg.style.strokeDashoffset = String(circumference);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        ringProg.style.transition = REDUCED
          ? 'none'
          : 'stroke-dashoffset 1s cubic-bezier(.3,.8,.3,1)';
        ringProg.style.strokeDashoffset = String(circumference * (1 - score / total));
      });
    });
  }

  /* ---------------------------------------------------------------------- */
  /* replay                                                                   */
  /* ---------------------------------------------------------------------- */

  function replay() {
    idx = 0;
    score = 0;
    locked = false;
    lastCorrect = false;
    var frames = filmstrip.querySelectorAll('.frame');
    for (var i = 0; i < frames.length; i++) frames[i].classList.remove('done', 'current');
    flipInner.classList.remove('flipped');
    renderQuestion();
  }

  /* ---------------------------------------------------------------------- */
  /* wiring                                                                   */
  /* ---------------------------------------------------------------------- */

  btnStart.addEventListener('click', renderQuestion);

  btnNext.addEventListener('click', function () {
    idx++;
    if (idx < QUESTIONS.length) renderQuestion();
    else showScore();
  });

  btnReplay.addEventListener('click', replay);
  if (btnReplayG) btnReplayG.addEventListener('click', replay);

})();
