'use strict';
/**
 * Sawaal — the scene machine.
 *
 * Ported 1:1 from ShamsAli-fathi/ask-me-on-a-date (site/app.js): the same
 * eight-scene flow, the same 320ms transitions, the same progress mapping,
 * the same stubborn reframe on "not really" (the sad image, music stops),
 * the same four-question quiz scored by the server, the same selfie demand,
 * the same three kiss outcomes and the same six-image celebration.
 *
 * Adaptations for Paigaam: the copy comes from the server-rendered #swPayload
 * JSON block; the day picker is built from the sender's own availability;
 * the original's meme MP3s are replaced by tiny synthesised SFX
 * (public/sawaal/sfx.js); answers post to /api/sawaal/*.
 */
(function () {
  var body = document.body;
  if (!body || !body.classList.contains('sw')) return;

  var payloadNode = document.getElementById('swPayload');
  var CFG = {
    recipientName: 'you', senderName: '',
    inviteTitle: 'Let’s schedule a date!', inviteIntro: '',
    likeTitle: 'Do you like me?!?!', vibeTitle: 'How do you like it?',
    vibeOptions: [], availableDays: [],
    quizTitle: 'So you know us, huh?', quizIntro: '',
    kissTitle: 'What if...?', kissIntro: '',
    yesOutcome: 'I USED TO PRAY FOR TIMES LIKE THIS',
    shyOutcome: 'Pfff fine. I had to try it anyway',
    shyOutcomeLine: 'But I will be holding your hands, no questions asked!',
  };
  try {
    var parsed = JSON.parse(payloadNode ? payloadNode.textContent : '{}');
    if (parsed && typeof parsed === 'object') CFG = Object.assign({}, CFG, parsed);
  } catch (e) { /* defaults hold */ }

  var experience = document.getElementById('swExperience');
  var sceneContent = document.getElementById('swSceneContent');
  var sceneLabel = document.getElementById('swSceneLabel');
  var progressCopy = document.getElementById('swProgressCopy');
  var progressCount = document.getElementById('swProgressCount');
  var progressFill = document.getElementById('swProgressFill');

  var sfx = window.SawaalSfx || null;

  var currentQuestion = 1;
  var musicEnabled = true;
  var draftId = null;
  var saved = Object.create(null); // scene -> recorded answer payload

  // The published page carries its own id in the payload — answers collect on
  // the paigaam the sender published, never on a fresh draft.
  var PAIGAAM_ID = /^sawaal-[a-f0-9]{18}$/.test(CFG.paigaamId || '') ? CFG.paigaamId : null;

  var PROGRESS_STEPS = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 8: 7, 9: 8 };

  function el(tag, className, content) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (content != null) node.textContent = content;
    return node;
  }

  function h(html) {
    var frag = document.createElement('template');
    frag.innerHTML = html;
    return frag.content;
  }

  /* ------------------------------------------------------------- progress */

  function setProgress(questionNumber) {
    var step = PROGRESS_STEPS[questionNumber] || 8;
    if (sceneLabel) sceneLabel.textContent = 'Scene ' + String(step).padStart(2, '0');
    if (progressCopy) progressCopy.textContent = step === 1 ? 'A tiny question' : 'Keep going';
    if (progressCount) progressCount.textContent = String(step).padStart(2, '0') + ' / 08';
    if (progressFill) progressFill.style.width = (step * (100 / 8)) + '%';
  }

  /* ------------------------------------------------------------ recording */

  function record(scene, payload) {
    saved[scene] = payload;
    if (!draftId) return Promise.resolve();
    return fetch('/api/sawaal/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: draftId, scene: scene, answer: payload }),
    }).catch(function () { /* answering is best-effort; the flow never blocks */ });
  }

  /** First interaction claims the visitor session that authorises answers. */
  function claimDraft() {
    if (draftId || !PAIGAAM_ID) return Promise.resolve();
    draftId = PAIGAAM_ID;
    return fetch('/api/sawaal/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: PAIGAAM_ID }),
      credentials: 'same-origin',
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (out) { if (out && out.id) draftId = out.id; })
      .catch(function () { /* the questionnaire still plays fully offline */ });
  }

  /* ---------------------------------------------------------------- music */

  function startMusic() {
    if (!musicEnabled || !sfx) return;
    sfx.startMusic();
  }

  function playNoSound() { if (sfx) sfx.no(); }
  function playYesSound() { if (sfx) sfx.yes(); }

  /* --------------------------------------------------------------- scenes */

  function sceneVisual(image, alt) {
    return '<figure class="scene-visual"><img src="/sawaal/media/' + image + '" alt="' + alt + '"></figure>';
  }

  function choiceMarkup(value, label, primary) {
    return '<button type="button" data-choice="' + value + '"' + (primary ? '' : ' class="secondary"') +
      '><span></span><span class="button-arrow" aria-hidden="true">' + (primary ? '↗' : '→') + '</span></button>';
  }

  function renderScene(o) {
    // o: { number, step, eyebrow, title, intro, image, imageAlt, body, complete }
    setProgress(o.number);
    if (o.step === 'quiz') { if (sceneLabel) sceneLabel.textContent = 'Quick quiz'; if (progressCopy) progressCopy.textContent = 'Show me what you know'; }
    else if (o.step === 'score') { if (sceneLabel) sceneLabel.textContent = 'Results'; if (progressCopy) progressCopy.textContent = 'Quiz complete'; }
    else if (o.step === 'outcome') { if (sceneLabel) sceneLabel.textContent = 'A little moment'; if (progressCopy) progressCopy.textContent = 'All yours'; }
    else if (o.step === 'final') { if (sceneLabel) sceneLabel.textContent = 'Done'; if (progressCopy) progressCopy.textContent = 'See you soon'; }
    if (experience) experience.classList.toggle('is-complete', !!o.complete);
    if (!sceneContent) return;
    sceneContent.innerHTML = '';
    var layout = document.createElement('div');
    layout.className = 'scene-layout' + (o.complete ? ' outcome-layout' : '');
    layout.innerHTML = sceneVisual(o.image, o.imageAlt) +
      '<div class="scene-copy"><p class="eyebrow"><span aria-hidden="true">✦</span> ' + o.eyebrow.replace(/</g, '&lt;') + '</p>' +
      '<h1 id="pageTitle"></h1>' +
      (o.intro ? '<p class="sw-intro"></p>' : '') +
      '<div class="choice-form"></div></div>';
    var title = layout.querySelector('h1');
    if (title) title.textContent = o.title;
    if (o.intro) { var introNode = layout.querySelector('.sw-intro'); if (introNode) introNode.textContent = o.intro; }
    var form = layout.querySelector('.choice-form');
    if (form && o.body) form.appendChild(o.body);
    sceneContent.appendChild(layout);
    if (o.celebrate) celebrate();
  }

  /* ------------------------------------------------- scene 1 · invitation */

  function renderInvite() {
    currentQuestion = 1;
    var body = document.createDocumentFragment ? document.createElement('div') : null;
    var wrap = body || {};
    var choices = document.createElement('div');
    choices.className = 'choices';
    choices.innerHTML = choiceMarkup('yes', 'Yes', true) + choiceMarkup('yes_of_course', 'Yes, of course', false);
    var message = document.createElement('p');
    message.className = 'form-message';
    message.setAttribute('aria-live', 'polite');
    wrap.className = '';
    wrap.appendChild(choices);
    wrap.appendChild(message);
    renderScene({
      number: 1, eyebrow: 'Your invitation', title: CFG.inviteTitle, intro: CFG.inviteIntro,
      image: 'invite.png', imageAlt: 'Illustration for the date invitation', body: wrap,
    });
    bindChoices(choices, message);
  }

  function bindChoices(choices, message) {
    choices.addEventListener('click', function (event) {
      var button = event.target && event.target.closest ? event.target.closest('button[data-choice]') : null;
      if (!button || button.disabled) return;
      var value = button.getAttribute('data-choice');
      Array.prototype.forEach.call(choices.querySelectorAll('button'), function (b) { b.disabled = true; });
      onChoice(value, message);
    });
  }

  /* ----------------------------------------------------------- the router */

  function onChoice(value, message) {
    if (currentQuestion === 1) {
      record('invite', { choice: value });
      return transitionTo(renderLike);
    }
    if (currentQuestion === 2) {
      if (value === 'not_really') {
        musicEnabled = false;
        if (sfx) sfx.stopMusic();
        playNoSound();
        renderLike(true); // the sad reframe — same question, hurt image
        return;
      }
      musicEnabled = true;
      startMusic();
      record('like', { choice: value });
      return transitionTo(renderVibe);
    }
    if (currentQuestion === 3) {
      record('vibe', value.custom ? { choice: 'custom', text: value.text } : { choice: value.value });
      return transitionTo(renderDay);
    }
    if (currentQuestion === 4) {
      record('day', { choice: 'date', date: value.date });
      return transitionTo(renderQuizIntro);
    }
    if (currentQuestion === 8) {
      record('kiss', { choice: value });
      transitionTo(function () { renderOutcome(value); });
    }
  }

  /* -------------------------------------------- scene 2 · do you like me */

  function renderLike(showNegative) {
    currentQuestion = 2;
    var wrap = document.createElement('div');
    var choices = document.createElement('div');
    choices.className = 'choices';
    choices.innerHTML = choiceMarkup('sure', 'Sure!', true) + choiceMarkup('not_really', 'Not really.', false);
    var message = document.createElement('p');
    message.className = 'form-message';
    message.setAttribute('aria-live', 'polite');
    wrap.appendChild(choices);
    wrap.appendChild(message);
    renderScene({
      number: 2, eyebrow: 'A little question', title: CFG.likeTitle,
      intro: showNegative ? 'Oh. Well. The rest of the questions still stand, actually.' : 'After all, they’re really adorable ngl.',
      image: showNegative ? 'like-no.png' : 'like.png',
      imageAlt: showNegative ? 'The sad illustration' : 'Illustration for the little question', body: wrap,
    });
    bindChoices(choices, message);
  }

  /* --------------------------------------------------- scene 3 · the vibe */

  function renderVibe() {
    currentQuestion = 3;
    var wrap = document.createElement('div');
    var options = (CFG.vibeOptions && CFG.vibeOptions.length ? CFG.vibeOptions : ['Dinner & Chill', 'Coffee & Walking']).slice(0, 4);
    var choices = document.createElement('div');
    choices.className = 'choices';
    choices.innerHTML = options.map(function (label, i) {
      return choiceMarkup('opt_' + i, label, i === 0);
    }).join('');
    var message = document.createElement('p');
    message.className = 'form-message';
    message.setAttribute('aria-live', 'polite');
    var form = document.createElement('form');
    form.className = 'custom-answer';
    form.innerHTML = '<label class="sr-only" for="swCustomInput">Your answer</label>' +
      '<input id="swCustomInput" type="text" maxlength="240" autocomplete="off" placeholder="Or tell me your idea...">' +
      '<button type="submit" class="send-answer"><span>Send</span><span class="button-arrow" aria-hidden="true">↗</span></button>';
    wrap.appendChild(choices);
    wrap.appendChild(form);
    wrap.appendChild(message);
    renderScene({
      number: 3, eyebrow: 'Your turn', title: CFG.vibeTitle,
      intro: 'I guess your opinion matters...', image: 'vibe.png', imageAlt: 'Illustration for the vibe question', body: wrap,
    });
    bindChoices(choices, message);
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var input = form.querySelector('#swCustomInput');
      var idea = (input.value || '').trim();
      if (!idea) { message.textContent = 'Tell me your idea first.'; input.focus(); return; }
      if (idea.length > 240) { message.textContent = 'That idea is a little too long.'; return; }
      Array.prototype.forEach.call(wrap.querySelectorAll('button'), function (b) { b.disabled = true; });
      onChoice({ custom: true, text: idea }, message);
    });
  }

  /* ---------------------------------------------------- scene 4 · the day */

  function renderDay() {
    currentQuestion = 4;
    var wrap = document.createElement('div');
    var days = CFG.availableDays || [];
    var message = document.createElement('p');
    message.className = 'form-message';
    message.setAttribute('aria-live', 'polite');
    var form = document.createElement('form');
    form.className = 'date-answer';
    var options = days.map(function (value) {
      var dt = new Date(value + 'T12:00:00');
      var label = 'Pick this day';
      try { label = dt.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); } catch (e) { /* keep fallback */ }
      return '<option value="' + value.replace(/</g, '&lt;') + '">' + label + '</option>';
    }).join('');
    form.innerHTML = '<label for="swDateInput">Choose your date</label>' +
      '<div class="date-controls"><select id="swDateInput"><option value="">Select a date</option>' + options + '</select>' +
      '<button type="submit" class="send-answer"><span>Send</span><span class="button-arrow" aria-hidden="true">↗</span></button></div>' +
      '<p class="date-help">Exactly the days I’m free — pick your favourite.</p>';
    wrap.appendChild(form);
    wrap.appendChild(message);
    renderScene({
      number: 4, eyebrow: 'Pick a day', title: 'When should we go?',
      intro: days.length ? 'These days are the real, actual free days. Choose the one you like!' : 'The calendar is being sorted out — pick the vibe and I’ll come back with a day.',
      image: 'day.png', imageAlt: 'Illustration for the day question', body: wrap,
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var input = form.querySelector('#swDateInput');
      var value = input.value;
      if (!value || days.indexOf(value) === -1) { message.textContent = 'Choose one of the available dates.'; input.focus(); return; }
      Array.prototype.forEach.call(wrap.querySelectorAll('button'), function (b) { b.disabled = true; });
      onChoice({ date: value }, message);
    });
  }

  /* -------------------------------------------- scene 5 · the quiz bridge */

  function renderQuizIntro() {
    currentQuestion = 5;
    var wrap = document.createElement('div');
    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'next-button';
    next.innerHTML = '<span>Next</span><span class="button-arrow" aria-hidden="true">→</span>';
    next.addEventListener('click', function () { transitionTo(renderQuiz); });
    wrap.appendChild(next);
    renderScene({
      number: 5, eyebrow: 'A quick detour', title: CFG.quizTitle, intro: CFG.quizIntro,
      image: 'invite.png', imageAlt: 'Illustration for the quiz', body: wrap,
    });
  }

  /* --------------------------------------------------- scene 6 · the quiz */

  var QUIZ_QUESTIONS = [
    {
      prompt: 'On our first date, the phone is at 4%. The correct action is…',
      answers: [['A', 'Scrolling — the memes can wait for no one.'], ['B', 'Ignoring it entirely; you are the entertainment.'], ['C', 'Handing it to me and holding my hand instead.'], ['D', 'Charging it. Obviously. Where is your sense of drama?']],
    },
    {
      prompt: 'Which is more effective than “I don’t know, where do you want to eat?”',
      answers: [['A', '“Surprise me.”'], ['B', '“You pick.”'], ['C', 'Having already picked a place with their favourite dessert on the menu.'], ['D', 'Sending them a 40-option poll.']],
    },
    {
      prompt: 'The plan has a small visible crack (rain at 7pm). The safest move is…',
      answers: [['A', 'Deny the weather exists.'], ['B', 'Continue as scheduled, but carry an umbrella like a romantic.'], ['C', 'Move it inside — cinema, blanket, shared popcorn.'], ['D', 'Cancel. Again.']],
    },
    {
      prompt: 'A first date has a flash point of 18°C of eye contact. What does this indicate?',
      answers: [['A', 'Nothing will happen below 18 glances.'], ['B', 'Enough sparks to ignite at, or around, glance eighteen.'], ['C', 'It will automatically catch feelings.'], ['D', 'We are both immune to chemistry.']],
    },
  ];

  function renderQuiz() {
    currentQuestion = 6;
    var wrap = document.createElement('div');
    var form = document.createElement('form');
    form.className = 'hse-quiz';
    form.setAttribute('id', 'swQuiz');
    var html = '';
    QUIZ_QUESTIONS.forEach(function (question, index) {
      html += '<fieldset class="hse-question"><legend><span>' + (index + 1) + '.</span> ' + question.prompt.replace(/</g, '&lt;') + '</legend><div class="hse-answers">';
      question.answers.forEach(function (pair) {
        html += '<label><input type="radio" name="q' + (index + 1) + '" value="' + pair[0] + '" required><span class="hse-answer-letter">' + pair[0] + '</span><span>' + pair[1].replace(/</g, '&lt;') + '</span></label>';
      });
      html += '</div></fieldset>';
    });
    html += '<button type="submit" class="hse-submit"><span>Submit answers</span><span class="button-arrow" aria-hidden="true">↗</span></button>' +
      '<p class="form-message" aria-live="polite"></p>';
    form.innerHTML = html;
    wrap.appendChild(form);
    renderScene({
      number: 5, step: 'quiz', eyebrow: 'A quick detour', title: CFG.quizTitle, intro: CFG.quizIntro,
      image: 'invite.png', imageAlt: 'Illustration for the quiz', body: wrap,
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var message = form.querySelector('.form-message');
      var formData = new FormData(form);
      var answers = {};
      ['q1', 'q2', 'q3', 'q4'].forEach(function (key) { answers[key] = formData.get(key) || ''; });
      if (answers.q1 === '' || answers.q2 === '' || answers.q3 === '' || answers.q4 === '') {
        message.textContent = 'Answer every question first.';
        return;
      }
      var submit = form.querySelector('.hse-submit');
      if (submit) submit.disabled = true;
      message.textContent = 'Checking your answers...';
      var score = scoreQuiz(answers);
      record('quiz', { answers: answers, score: score });
      if (sfx) sfx.donk();
      setTimeout(function () { renderScore(score); }, 650);
    });
  }

  function scoreQuiz(answers) {
    var CORRECT = { q1: 'C', q2: 'C', q3: 'C', q4: 'B' };
    var score = 0;
    for (var key in CORRECT) if (answers[key] === CORRECT[key]) score++;
    return score;
  }

  function renderScore(score) {
    setProgress(5);
    if (sceneLabel) sceneLabel.textContent = 'Results';
    if (progressCopy) progressCopy.textContent = 'Quiz complete';
    if (progressCount) progressCount.textContent = '06 / 08';
    if (progressFill) progressFill.style.width = (5 * (100 / 8)) + '%';
    if (experience) experience.classList.add('is-complete');
    var title = score >= 3 ? 'You are truly amazing :)' : score === 2 ? 'Good job cutie!' : 'I’m gonna pretend I didn’t see the score.';
    if (!sceneContent) return;
    sceneContent.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'hse-score';
    box.innerHTML = '<p class="eyebrow"><span aria-hidden="true">✦</span> Your result</p>' +
      '<p class="hse-score-value">' + Number(score) + ' <span>/ 4</span></p>';
    var heading = document.createElement('h1');
    heading.id = 'pageTitle';
    heading.textContent = title;
    box.appendChild(heading);
    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'next-button';
    next.innerHTML = '<span>Back to the date</span><span class="button-arrow" aria-hidden="true">→</span>';
    next.addEventListener('click', function () { transitionTo(renderSelfie); });
    box.appendChild(next);
    sceneContent.appendChild(box);
  }

  /* ------------------------------------------------ scene 8 · the selfie */

  function renderSelfie() {
    currentQuestion = 8;
    var wrap = document.createElement('div');
    var message = document.createElement('p');
    message.className = 'form-message';
    message.setAttribute('aria-live', 'polite');
    var form = document.createElement('form');
    form.className = 'upload-answer';
    form.innerHTML = '<label for="swSelfieInput">Choose a photo</label>' +
      '<div class="upload-controls"><input id="swSelfieInput" type="file" accept="image/png,image/jpeg,image/webp">' +
      '<button type="button" class="secondary" data-upload disabled><span>Upload photo</span><span class="button-arrow" aria-hidden="true">↗</span></button></div>' +
      '<button type="submit" class="send-answer upload-submit" disabled><span>Submit</span><span class="button-arrow" aria-hidden="true">↗</span></button>' +
      '<p class="upload-help">PNG, JPEG, or WebP up to 5 MiB.</p>';
    wrap.appendChild(form);
    wrap.appendChild(message);
    renderScene({
      number: 8, eyebrow: 'One last thing', title: 'Upload a selfie, RIGHT NOW!',
      intro: 'A face to dream about until the day. Upload it — you know you want to.',
      image: 'selfie.png', imageAlt: 'Illustration for the selfie demand', body: wrap,
    });

    var input = form.querySelector('#swSelfieInput');
    var uploadButton = form.querySelector('[data-upload]');
    var submitButton = form.querySelector('.upload-submit');
    var uploadedUrl = null;

    input.addEventListener('change', function () {
      uploadButton.disabled = !input.files || input.files.length !== 1;
      submitButton.disabled = true;
    });

    uploadButton.addEventListener('click', function () {
      if (uploadButton.disabled) return;
      if (!input.files || input.files.length !== 1) return;
      uploadButton.disabled = true;
      input.disabled = true;
      message.textContent = 'Uploading your photo...';
      var data = new FormData();
      data.append('photo', input.files[0]);
      fetch('/api/sawaal/upload', { method: 'POST', body: data, credentials: 'same-origin' })
        .then(function (r) { return r.json().then(function (out) { return { ok: r.ok, out: out }; }); })
        .then(function (res) {
          if (!res.ok || !res.out || !res.out.url) throw new Error('upload failed');
          uploadedUrl = res.out.url;
          message.textContent = 'Photo received. Now submit it, cutie.';
          submitButton.disabled = false;
        })
        .catch(function () {
          input.disabled = false;
          uploadButton.disabled = false;
          message.textContent = 'That upload did not work. Try a PNG, JPEG, or WebP under 5 MiB.';
        });
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!uploadedUrl) { message.textContent = 'Upload your photo before submitting.'; return; }
      record('selfie', { choice: 'selfie_uploaded', url: uploadedUrl });
      transitionTo(renderKiss);
    });
  }

  /* --------------------------------------- scene 9 · the final question */

  function renderKiss() {
    currentQuestion = 9;
    var wrap = document.createElement('div');
    var choices = document.createElement('div');
    choices.className = 'choices choices--three';
    choices.innerHTML =
      choiceMarkup('kiss_back', 'I might kiss back!', true) +
      choiceMarkup('kiss_cheek', 'Sure but only on cheek 😭', false) +
      choiceMarkup('kiss_later', 'He’ll get his kiss but later.', false);
    var message = document.createElement('p');
    message.className = 'form-message';
    message.setAttribute('aria-live', 'polite');
    wrap.appendChild(choices);
    wrap.appendChild(message);
    renderScene({
      number: 8, eyebrow: 'The final question', title: CFG.kissTitle, intro: CFG.kissIntro,
      image: 'kiss.png', imageAlt: 'Illustration for the final question', body: wrap,
    });
    bindChoices(choices, message);
  }

  /* ---------------------------------------------------------- the ending */

  function renderOutcome(outcome) {
    var isSweet = outcome === 'kiss_back' || outcome === 'kiss_cheek';
    var wrap = document.createElement('div');
    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'next-button';
    next.innerHTML = '<span>Next</span><span class="button-arrow" aria-hidden="true">→</span>';
    next.addEventListener('click', renderFinal);
    wrap.appendChild(next);
    renderScene({
      number: 8, step: 'outcome', complete: true, celebrate: isSweet,
      eyebrow: 'A little moment',
      title: isSweet ? CFG.yesOutcome : CFG.shyOutcome,
      intro: isSweet ? '' : CFG.shyOutcomeLine,
      image: isSweet ? 'yes.png' : 'no.png',
      imageAlt: 'Final response illustration', body: wrap,
    });
    if (isSweet) playYesSound();
  }

  function renderFinal() {
    var wrap = document.createElement('div');
    wrap.className = 'scene-copy';
    renderScene({
      number: 8, step: 'final', complete: true,
      eyebrow: 'It is done', title: 'It is done!',
      intro: 'Your date has all the answers now — and the day is chosen. See you soon.',
      image: 'final.png', imageAlt: 'Final illustration', body: wrap,
    });
  }

  /* ------------------------------------------------- the pray celebration */

  function celebrate() {
    document.querySelectorAll('.pray-celebration').forEach(function (node) { node.remove(); });
    var celebration = document.createElement('div');
    celebration.className = 'pray-celebration';
    celebration.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 6; i++) {
      var img = document.createElement('img');
      img.src = '/sawaal/media/pray.jpg';
      img.alt = '';
      celebration.appendChild(img);
    }
    body.appendChild(celebration);
  }

  /* ------------------------------------------------------------ machinery */

  function transitionTo(renderNext) {
    if (!experience || !sceneContent) { renderNext(); return; }
    experience.classList.add('is-transitioning');
    window.setTimeout(function () {
      renderNext();
      experience.classList.remove('is-transitioning');
    }, 320);
  }

  claimDraft();
  startMusic();
  document.addEventListener('pointerdown', function () { startMusic(); }, { once: true });
  document.addEventListener('keydown', function () { startMusic(); }, { once: true });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) startMusic();
  });

  renderInvite();
})();
