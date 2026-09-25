'use strict';
// Run: node --test tests/bfday-know-us-quiz-dom.test.js
// Drives public/know-us-quiz/pehchaan.js against a stub DOM on a virtual
// clock: Start -> Q1, chip selection (correct + wrong), flip timing (750ms / 950ms),
// Next -> Q2 -> ... -> score, replay, reduced motion, missing markup (no throw).
const { test } = require('node:test');
const assert   = require('node:assert/strict');
const fs       = require('node:fs');
const path     = require('node:path');
const vm       = require('node:vm');

const SOURCE = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'know-us-quiz', 'pehchaan.js'), 'utf8'
);

/* ---- minimal payload (2 questions) ---- */
const Q1 = { q: 'first question?', answers: ['right','wrong1','wrong2','wrong3'], correct: 0, story: 'story 1', caption: 'cap 1' };
const Q2 = { q: 'second question?', answers: ['nope','yes','no','na'], correct: 1, story: 'story 2', caption: 'cap 2' };
const PAYLOAD = {
  questions: [Q1, Q2],
  bands: { zero: 'zero band', low: 'low band', high: 'high band', perfect: 'perfect band' },
  screenshotCta: 'screenshot!',
  ordinals: ['zero','one','two','three','four','five','six','seven','eight'],
};

/* ---- minimal element stub ---- */
function el(id) {
  const classes = new Set();
  const handlers = {};
  const attrs = {};
  let _text = '';
  let _html = '';
  const children = [];
  const node = {
    id,
    style: {},
    offsetWidth: 0,
    /* innerHTML setter clears the live children list so renderQuestion() resets chips */
    get innerHTML() { return _html; },
    set innerHTML(v) { _html = String(v == null ? '' : v); children.length = 0; },
    get disabled()     { return !!attrs._disabled; },
    set disabled(v)    { attrs._disabled = !!v; },
    get textContent()  { return _text; },
    set textContent(v) { _text = String(v == null ? '' : v); },
    classList: {
      add(...cs)    { cs.forEach(c => classes.add(c)); },
      remove(...cs) { cs.forEach(c => classes.delete(c)); },
      contains(c)   { return classes.has(c); },
    },
    getAttribute(k)    { return attrs[k] !== undefined ? attrs[k] : null; },
    setAttribute(k, v) { attrs[k] = String(v); },
    addEventListener(type, fn) {
      (handlers[type] = handlers[type] || []).push(fn);
    },
    click() { (handlers['click'] || []).forEach(fn => fn({})); },
    appendChild(child) { children.push(child); },
    /* querySelectorAll returns the live children list (or frames list for filmstrip) */
    querySelectorAll(sel) {
      if (sel === '.card')  return node._cardList  || [];
      if (sel === '.chip')  return children;         /* live: chips appended by the JS */
      if (sel === '.frame') return node._frameList || [];
      return [];
    },
    querySelector(sel) {
      /* used inside a chip to find .chip-text and .mark */
      if (sel === '.chip-text') return el('__chip-text__');
      if (sel === '.mark')      return el('__mark__');
      return null;
    },
    _children: children,
    _classes: classes,
    _handlers: handlers,
  };
  return node;
}

/* Filmstrip with N pre-rendered frame stubs. */
function stripEl(n) {
  const strip = el('filmstrip');
  const frames = Array.from({ length: n }, (_, i) => el('frame-' + i));
  strip._frameList = frames;
  return strip;
}

function boot({ reduced = false, missing = null, questions = [Q1, Q2] } = {}) {
  const payload = { ...PAYLOAD, questions };

  const payloadNode = el('qzPayload');
  payloadNode.textContent = JSON.stringify(payload);

  const stageNode = el('stage');
  const chipsNode = el('chips');

  /* stage.querySelectorAll('.card') returns card stubs */
  const cardList = ['card-intro','card-question','card-reveal','card-score'].map(id => el(id));
  stageNode._cardList = cardList;
  const cardMap = Object.fromEntries(cardList.map(c => [c.id, c]));

  const filmstripNode = stripEl(questions.length);

  const allNodes = {
    qzPayload:        payloadNode,
    stage:            stageNode,
    'btn-start':      el('btn-start'),
    'card-intro':     cardMap['card-intro'],
    'card-question':  cardMap['card-question'],
    'card-reveal':    cardMap['card-reveal'],
    'card-score':     cardMap['card-score'],
    filmstrip:        filmstripNode,
    'frame-counter':  el('frame-counter'),
    'q-label':        el('q-label'),
    'q-text':         el('q-text'),
    chips:            chipsNode,
    'rv-front-label': el('rv-front-label'),
    'rv-front-q':     el('rv-front-q'),
    'flip-inner':     el('flip-inner'),
    'rv-photo':       el('rv-photo'),
    'rv-verdict':     el('rv-verdict'),
    'rv-answer':      el('rv-answer'),
    'rv-story':       el('rv-story'),
    'btn-next':       el('btn-next'),
    'score-big':      el('score-big'),
    'band-title':     el('band-title'),
    'screenshot-cta': el('screenshot-cta'),
    'ring-progress':  el('ring-progress'),
    'btn-replay':     el('btn-replay'),
    'btn-replay-ghost': el('btn-replay-ghost'),
  };
  if (missing) delete allNodes[missing];

  const clock = { now: 0, queue: [] };
  const rAFQueue = [];

  const sandbox = {
    document: {
      getElementById: id => allNodes[id] || null,
      createElement: function (tag) {
        /* Return a full stub so the JS can setAttribute, addEventListener, etc. */
        return el('__' + tag + '__');
      },
      body: { classList: { add() {}, remove() {}, contains() { return false; } } },
    },
    window: {
      matchMedia: q => ({ matches: reduced && /reduce/.test(q) }),
    },
    setTimeout(fn, ms) { clock.queue.push({ at: clock.now + ms, fn }); return clock.queue.length; },
    requestAnimationFrame(fn) { rAFQueue.push(fn); },
    Math, JSON, Array, String, parseInt, isNaN,
  };

  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox);

  function flushRAF() {
    /* run rAF callbacks until the queue drains (they may enqueue more) */
    let guard = 0;
    while (rAFQueue.length && ++guard < 20) { const fn = rAFQueue.shift(); fn(); }
  }

  function advance(ms) {
    const until = clock.now + ms;
    for (;;) {
      clock.queue.sort((a, b) => a.at - b.at);
      const next = clock.queue[0];
      if (!next || next.at > until) break;
      clock.queue.shift(); clock.now = next.at; next.fn();
      flushRAF();
    }
    clock.now = until;
    flushRAF();
  }

  return { ids: allNodes, advance, clock, rAFQueue, flushRAF };
}

/* ---- helper: get the live chip stubs appended by renderQuestion ---- */
function getChips(ids) {
  return ids.chips._children;
}

/* ============================================================ */
/* tests                                                         */
/* ============================================================ */

test('DOM: clicking Start sets q-label to "question one" and q-text to Q1', () => {
  const { ids } = boot();
  ids['btn-start'].click();
  assert.equal(ids['q-label'].textContent, 'question one');
  assert.equal(ids['q-text'].textContent, Q1.q);
});

test('DOM: correct answer gets correct class and triggers reveal after 750ms', () => {
  const { ids, advance, flushRAF } = boot();
  ids['btn-start'].click();

  const chips = getChips(ids);
  assert.ok(chips.length > 0, 'chips were appended');

  /* click chip 0 (correct for Q1) */
  chips[0].click();
  assert.ok(chips[0].classList.contains('correct'), 'correct chip gets correct class');
  assert.ok(!chips[0].classList.contains('wrong'), 'correct chip has no wrong class');

  /* reveal not yet */
  assert.ok(!ids['card-reveal'].classList.contains('active'));

  advance(749); flushRAF();
  assert.ok(!ids['card-reveal'].classList.contains('active'), 'not before 750ms');

  advance(1); flushRAF();
  assert.ok(ids['card-reveal'].classList.contains('active'), 'reveal shown at 750ms');
  assert.equal(ids['rv-verdict'].textContent, 'correct! ❤️');
  assert.ok(!ids['rv-verdict'].classList.contains('wrong-color'));
  assert.ok(ids['flip-inner'].classList.contains('flipped'));
});

test('DOM: wrong answer gets wrong class, correct chip highlighted, reveal after 950ms', () => {
  const { ids, advance, flushRAF } = boot();
  ids['btn-start'].click();

  const chips = getChips(ids);
  /* click chip[1] (wrong for Q1 where correct=0) */
  chips[1].click();

  assert.ok(chips[1].classList.contains('wrong'), 'wrong chip gets wrong class');
  assert.ok(chips[0].classList.contains('correct'), 'correct chip is highlighted');

  advance(749); flushRAF();
  assert.ok(!ids['card-reveal'].classList.contains('active'), 'not before 950ms');

  advance(201); flushRAF();
  assert.ok(ids['card-reveal'].classList.contains('active'), 'reveal shown at 950ms');
  assert.equal(ids['rv-verdict'].textContent, 'close enough 🙈');
  assert.ok(ids['rv-verdict'].classList.contains('wrong-color'));
});

test('DOM: locking is a one-shot guard — second tap is ignored', () => {
  const { ids, advance, flushRAF } = boot();
  ids['btn-start'].click();

  const chips = getChips(ids);
  chips[0].click(); /* correct */
  chips[1].click(); /* should be ignored (locked) */

  /* Only one timeout queued. */
  advance(950); flushRAF();
  /* Verdict is from the first click (correct). */
  assert.equal(ids['rv-verdict'].textContent, 'correct! ❤️');
});

test('DOM: Next after last question shows score card', () => {
  const { ids, advance, flushRAF } = boot({ questions: [Q1] });
  ids['btn-start'].click();

  const chips = getChips(ids);
  chips[0].click(); /* correct */
  advance(750); flushRAF();

  assert.equal(ids['btn-next'].textContent, 'see my score', 'last question shows "see my score"');

  ids['btn-next'].click();
  assert.ok(ids['card-score'].classList.contains('active'), 'score card shown');
  assert.equal(ids['score-big'].textContent, '1', 'score is 1');
  assert.equal(ids['band-title'].textContent, '"perfect band"', 'perfect band for 1/1');
});

test('DOM: score band zero for 0 correct', () => {
  const { ids, advance, flushRAF } = boot({ questions: [Q1] });
  ids['btn-start'].click();

  const chips = getChips(ids);
  chips[1].click(); /* wrong */
  advance(950); flushRAF();

  ids['btn-next'].click();
  assert.ok(ids['card-score'].classList.contains('active'));
  assert.equal(ids['score-big'].textContent, '0');
  assert.equal(ids['band-title'].textContent, '"zero band"');
});

test('DOM: score band low for 1 of 3 correct', () => {
  const Q3 = { q: 'q3', answers: ['a','b','c','d'], correct: 0, story: '', caption: '' };
  const { ids, advance, flushRAF } = boot({ questions: [Q1, Q2, Q3] });
  ids['btn-start'].click();

  /* Q1: wrong */
  getChips(ids)[1].click(); advance(950); flushRAF();
  ids['btn-next'].click();

  /* Q2: correct (correct=1) */
  getChips(ids)[1].click(); advance(750); flushRAF();
  ids['btn-next'].click();

  /* Q3: wrong */
  getChips(ids)[1].click(); advance(950); flushRAF();
  ids['btn-next'].click();

  assert.ok(ids['card-score'].classList.contains('active'));
  assert.equal(ids['score-big'].textContent, '1');
  /* 1 of 3 = 33% <= 50%: bandLow */
  assert.equal(ids['band-title'].textContent, '"low band"');
});

test('DOM: score band high for most correct (2 of 3 correct)', () => {
  const Q3 = { q: 'q3', answers: ['a','b','c','d'], correct: 2, story: '', caption: '' };
  const { ids, advance, flushRAF } = boot({ questions: [Q1, Q2, Q3] });
  ids['btn-start'].click();

  /* Q1 correct (correct=0) */
  getChips(ids)[0].click(); advance(750); flushRAF();
  ids['btn-next'].click();

  /* Q2 correct (correct=1) */
  getChips(ids)[1].click(); advance(750); flushRAF();
  ids['btn-next'].click();

  /* Q3 wrong */
  getChips(ids)[0].click(); advance(950); flushRAF();
  ids['btn-next'].click();

  /* 2 of 3 = 67% > 50% but < 100%: bandHigh */
  assert.ok(ids['card-score'].classList.contains('active'));
  assert.equal(ids['score-big'].textContent, '2');
  assert.equal(ids['band-title'].textContent, '"high band"');
});

test('DOM: replay resets state and returns to Q1', () => {
  const { ids, advance, flushRAF } = boot({ questions: [Q1] });
  ids['btn-start'].click();
  getChips(ids)[0].click();
  advance(750); flushRAF();
  ids['btn-next'].click();
  assert.ok(ids['card-score'].classList.contains('active'));

  ids['btn-replay'].click();
  assert.ok(ids['card-question'].classList.contains('active'), 'back to question card');
  assert.equal(ids['q-label'].textContent, 'question one', 'q-label reset');
  assert.equal(ids['q-text'].textContent, Q1.q, 'first question shown');
  assert.ok(!ids['flip-inner'].classList.contains('flipped'), 'flip reset');
});

test('DOM: reduced motion — flip class applied immediately (no rAF double-wrap)', () => {
  const { ids, advance, flushRAF } = boot({ reduced: true });
  ids['btn-start'].click();
  getChips(ids)[0].click(); /* correct */
  advance(750); flushRAF();
  assert.ok(ids['flip-inner'].classList.contains('flipped'), 'flip applied in reduced motion');
});

test('DOM: missing markup does not throw', () => {
  const REQUIRED_IDS = [
    'stage','btn-start','card-intro','card-question','card-reveal',
    'card-score','filmstrip','frame-counter','q-label','q-text','chips',
    'rv-front-label','rv-front-q','flip-inner','rv-photo','rv-verdict',
    'rv-answer','rv-story','btn-next','score-big','band-title','ring-progress','btn-replay',
  ];
  for (const id of REQUIRED_IDS) {
    assert.doesNotThrow(
      () => boot({ missing: id }),
      `should not throw when "${id}" is missing`
    );
  }
});

test('HTML: renderer emits all required IDs and a filmstrip frame per question', () => {
  const { render } = require('../templates/know-us-quiz/render');
  const config     = require('../templates/know-us-quiz/config');
  const html = render({ customer_data: config.demo }, {});

  const REQUIRED_IDS = [
    'qzPayload','stage','btn-start','card-intro','card-question','card-reveal',
    'card-score','filmstrip','frame-counter','q-label','q-text','chips',
    'rv-front-label','rv-front-q','flip-inner','rv-photo','rv-verdict',
    'rv-answer','rv-story','btn-next','score-big','band-title','ring-progress',
    'btn-replay',
  ];
  for (const id of REQUIRED_IDS) {
    assert.match(html, new RegExp(`id="${id}"`), `missing id="${id}"`);
  }

  /* One frame per question. */
  const frames = [...html.matchAll(/class="frame"/g)];
  assert.equal(frames.length, config.demo.questions.length, 'one frame per question');

  /* Dynamic "out of N". */
  assert.match(html, new RegExp(`out of ${config.demo.questions.length}`));

  /* No hardcoded domain. */
  assert.doesNotMatch(html, /paigaam\.cc/, 'no hardcoded domain');

  /* No hosting-sandbox injections. */
  assert.doesNotMatch(html, /ha-img-placeholder|__brokenImgHandler|close-fullscreen/);

  /* Payload is valid JSON with questions array. */
  const match = html.match(/<script type="application\/json" id="qzPayload">([^<]+)<\/script>/);
  assert.ok(match, 'qzPayload script present');
  const payload = JSON.parse(match[1].replace(/\\u003c/g, '<'));
  assert.ok(Array.isArray(payload.questions), 'questions is array');
  assert.equal(payload.questions.length, config.demo.questions.length);

  /* CSS has reduced-motion rule. */
  const css = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'know-us-quiz', 'pehchaan.css'), 'utf8'
  );
  assert.match(css, /prefers-reduced-motion: reduce/);
});
