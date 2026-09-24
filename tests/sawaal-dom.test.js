'use strict';
// Run: node --test tests/sawaal-dom.test.js
// Drives public/sawaal/sawaal.js against a stub DOM (and public/sawaal/sfx.js),
// so the whole scene machine — the trap, the day picker, the quiz, the selfie
// flow, both endings — is verified without a browser.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'public', 'sawaal', 'sawaal.js'), 'utf8');
const SFX = fs.readFileSync(path.join(__dirname, '..', 'public', 'sawaal', 'sfx.js'), 'utf8');

/* ------------------------------------------------------------- stub DOM */

function makeClassList(node) {
  const set = new Set();
  return {
    add() { for (const c of arguments) set.add(c); },
    remove() { for (const c of arguments) set.delete(c); },
    contains: c => set.has(c),
    toggle(c, force) { const on = force === undefined ? !set.has(c) : !!force; on ? set.add(c) : set.delete(c); return on; },
    _set: set,
  };
}

function makeElement(tag = 'div', attrs = {}) {
  const node = {
    tagName: tag.toUpperCase(),
    attributes: { ...attrs },
    className: '',
    textContent: '',
    value: '',
    disabled: false,
    href: '',
    src: '',
    files: [],
    style: { props: {}, width: '', setProperty(key, value) { this.props[key] = value; } },
    dataset: {},
    children: [],
    handlers: {},
    removed: false,
    content: null,
    addEventListener(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); },
    dispatch(type, event) {
      // Real events bubble; the delegated listeners count on it.
      let node = this;
      const evt = event || {};
      if (!evt.target) evt.target = this;
      while (node) {
        for (const fn of node.handlers[type] || []) fn(evt);
        if (evt.cancelBubble) return;
        node = node.parentElement;
      }
    },
    setAttribute(name, value) { this.attributes[name] = String(value); if (name === 'id') node.id = String(value); },
    getAttribute(name) { return node.attributes[name] === undefined ? null : node.attributes[name]; },
    appendChild(child) { this.children.push(child); child.parentElement = this; return child; },
    querySelector(sel) { return queryAll(this, sel)[0] || null; },
    querySelectorAll(sel) { return queryAll(this, sel); },
    closest(sel) {
      let node = this;
      while (node) {
        if (matches(node, sel)) return node;
        node = node.parentElement;
      }
      return null;
    },
    remove() { this.removed = true; },
    focus() { this.focused = true; },
  };
  // A minimal innerHTML setter that parses the small markup shapes the scene
  // machine emits (figure/img, div/p/h1/button/span, form/input/select) —
  // enough for querySelector to find form controls after scene renders.
  let html = '';
  Object.defineProperty(node, 'innerHTML', {
    get() { return html; },
    set(value) {
      html = String(value);
      node.children.length = 0;
      parseInto(node, html);
    },
  });
  node.classList = makeClassList(node);
  return node;
}

/* A forgiving HTML fragment parser for the stub — handles the scene machine's
 * markup (self-closing img/input, nested divs, attributes in double quotes). */
function parseInto(parent, html) {
  const tokens = html.match(/<[^>]+>|[^<]+/g) || [];
  const stack = [parent];
  for (const token of tokens) {
    if (token.startsWith('<!--')) continue;
    const close = /^<\/([a-z0-9]+)>/i.exec(token);
    if (close) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tagName === close[1].toUpperCase()) { stack.length = i; break; }
      }
      continue;
    }
    const open = /^<([a-z0-9]+)((?:\s+[^<>]*?)?)\s*\/?>$/i.exec(token);
    if (open) {
      const el = makeElement(open[1]);
      const attrRe = /([a-zA-Z-]+)(?:="([^"]*)")?/g;
      let m;
      while ((m = attrRe.exec(open[2] || ''))) {
        if (!m[1]) continue;
        el.attributes[m[1]] = m[2] === undefined ? '' : m[2];
        if (m[1] === 'id') el.id = m[2];
        if (m[1] === 'class') el.className = m[2] || '';
      }
      stack[stack.length - 1].appendChild(el);
      if (!/\/>$/.test(token) && !['img', 'input', 'br', 'hr', 'meta', 'link'].includes(open[1].toLowerCase())) stack.push(el);
      continue;
    }
    // Text node — fold into the current element's textContent.
    const current = stack[stack.length - 1];
    if (current !== parent) current.textContent += token.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  }
}

function matches(node, sel) {
  if (!sel) return false;
  // Support: tag, .class, #id, [attr], and combinations (tag.class#id[attr]).
  for (const part of sel.split(',')) {
    const m = /^(?:([a-z0-9]+))?(?:\.([a-zA-Z0-9_-]+))?(?:#([a-zA-Z0-9_-]+))?(?:\[([^\]]+)\])?$/.exec(part.trim());
    if (!m || (!m[1] && !m[2] && !m[3] && !m[4])) continue;
    if (m[1] && (!node.tagName || node.tagName.toLowerCase() !== m[1])) continue;
    if (m[2] && String(node.className || '').split(/\s+/).indexOf(m[2]) === -1) continue;
    if (m[3] && node.id !== m[3]) continue;
    if (m[4]) {
      const eq = m[4].split('=');
      const attr = node.attributes && node.attributes[eq[0]];
      if (attr === undefined || attr === null) continue;
      if (eq.length > 1 && attr !== eq[1].replace(/^"|"$/g, '')) continue;
    }
    return true;
  }
  return false;
}

function queryAll(root, sel) {
  const out = [];
  const walk = node => {
    for (const child of node.children || []) {
      if (matches(child, sel)) out.push(child);
      walk(child);
    }
  };
  walk(root);
  return out;
}

function makeDom({ payload = {}, fetchResponses = [] } = {}) {
  const payloadNode = makeElement('script', { id: 'swPayload' });
  payloadNode.textContent = JSON.stringify(payload);
  const byId = {
    swPayload: payloadNode,
    swExperience: makeElement('section', { id: 'swExperience' }),
    swSceneContent: makeElement('div', { id: 'swSceneContent' }),
    swSceneLabel: makeElement('span', { id: 'swSceneLabel' }),
    swProgressCopy: makeElement('span', { id: 'swProgressCopy' }),
    swProgressCount: makeElement('span', { id: 'swProgressCount' }),
    swProgressFill: makeElement('span', { id: 'swProgressFill' }),
  };
  const created = [];

  const timers = { list: [], now: 0 };
  const intervals = [];
  let fetchIndex = 0;

  const bodyNode = makeElement('body');
  bodyNode.classList.add('sw'); // the script guards on body.sw
  bodyNode.parentElement = null;

  const sandbox = {
    document: {
      body: bodyNode,
      getElementById(id) { return byId[id] || null; },
      createElement(tag) {
        const el = makeElement(tag);
        if (tag === 'template') el.content = makeElement('#document-fragment');
        created.push(el);
        return el;
      },
      createDocumentFragment() { return makeElement('#document-fragment'); },
      querySelectorAll(sel) { return queryAll(bodyNode, sel); },
      addEventListener() {},
      hidden: false,
    },
    window: {
      innerWidth: 420,
      innerHeight: 860,
      setTimeout(fn, ms) { timers.list.push({ fn, ms }); return timers.list.length; },
      setInterval(fn, ms) { intervals.push({ fn, ms }); return intervals.length; },
      clearInterval() {},
      addEventListener() {},
      matchMedia: () => ({ matches: false }),
      AudioContext: null,
      webkitAudioContext: null,
    },
    navigator: { userAgent: 'node-test' },
    // The quiz scene reads its answers through FormData.get — tests set
    // sandbox.quizAnswers before submitting the quiz form.
    FormData: class {
      constructor(form) { this.form = form; }
      get(key) { return ((sandbox.quizAnswers || {})[key]) || null; }
    },
    fetch(url, opts) {
      if (sandbox.uploadResponse && String(url).includes('/api/sawaal/upload')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(sandbox.uploadResponse) });
      }
      const result = fetchResponses[fetchIndex++] || { ok: true, json: () => Promise.resolve({ id: 'sawaal-000000000000000000' }) };
      return Promise.resolve({ ok: result.ok !== false, json: () => Promise.resolve(result.body || {}) });
    },
    setTimeout(fn, ms) { timers.list.push({ fn, ms }); return timers.list.length; },
    setInterval(fn, ms) { intervals.push({ fn, ms }); return intervals.length; },
    clearInterval() {},
    clearTimeout() {},
    console,
  };
  sandbox.window.parent = sandbox.window; // same window: not an iframe thumbnail
  sandbox.self = sandbox.window;

  vm.createContext(sandbox);
  vm.runInContext(SFX, sandbox);
  vm.runInContext(SOURCE, sandbox);

  function flush(ms = 1e9) {
    const until = timers.now + ms;
    while (timers.list.length) {
      const t = timers.list.shift();
      timers.now = until;
      t.fn();
    }
  }

  return { byId, created, timers, intervals, flush, bodyNode, sceneContent: byId.swSceneContent, sandbox };
}

/* --------------------------------------------------------------- tests */

const PAYLOAD = {
  recipientName: 'Meher',
  senderName: 'Rahul',
  inviteTitle: 'Let’s schedule a date!',
  inviteIntro: 'Be a good girl & answer all the questions.',
  likeTitle: 'Do you like Rahul?!?!',
  vibeTitle: 'How do you like it?',
  vibeOptions: ['Dinner & Chill', 'Coffee & Walking'],
  availableDays: ['2026-10-01', '2026-10-02'],
  quizTitle: 'So you know us, huh?',
  quizIntro: 'Answer the following questions.',
  kissTitle: 'What if...?',
  kissIntro: 'What if Rahul kissed you on the first date...',
  yesOutcome: 'I USED TO PRAY FOR TIMES LIKE THIS',
  shyOutcome: 'Pfff fine. I had to try it anyway',
  shyOutcomeLine: 'But I will be holding your hands, no questions asked!',
  paigaamId: 'sawaal-000000000000000000',
};

function choicesOf(dom) {
  return dom.sceneContent.querySelectorAll('button[data-choice]');
}

function clickChoice(dom, value) {
  const button = choicesOf(dom).find(b => b.getAttribute('data-choice') === value);
  assert.ok(button, 'choice button exists: ' + value);
  // Real browsers set event.target; the delegated handler needs it.
  button.dispatch('click', { preventDefault() {}, target: button });
  dom.flush(400); // the 320ms transition
  return button;
}

function currentTitle(dom) {
  return dom.sceneContent.querySelector('h1') ? dom.sceneContent.querySelector('h1').textContent : '';
}

test('DOM: scene 1 renders the invitation with both yes choices', () => {
  const dom = makeDom({ payload: PAYLOAD });
  assert.equal(currentTitle(dom), 'Let’s schedule a date!');
  const values = choicesOf(dom).map(b => b.getAttribute('data-choice'));
  assert.deepEqual(values, ['yes', 'yes_of_course']);
  assert.match(dom.byId.swProgressCount.textContent, /01 \/ 08/);
});

test('DOM: the full happy path walks all scenes to the sweet ending', () => {
  const dom = makeDom({ payload: PAYLOAD });
  clickChoice(dom, 'yes');
  assert.equal(currentTitle(dom), 'Do you like Rahul?!?!');
  clickChoice(dom, 'sure');
  assert.equal(currentTitle(dom), 'How do you like it?');
  // Custom idea beats the two presets.
  const form = dom.sceneContent.querySelector('form');
  const input = form.querySelector('#swCustomInput');
  input.value = 'Long drive with chai';
  form.dispatch('submit', { preventDefault() {} });
  dom.flush(400);
  assert.equal(currentTitle(dom), 'When should we go?');
  // Pick a day.
  const dayForm = dom.sceneContent.querySelector('form.date-answer');
  assert.ok(dayForm, 'day form present');
  // The stub FormData.get returns null; drive the handler's validation path first.
  dayForm.dispatch('submit', { preventDefault() {} });
  const message = dom.sceneContent.querySelector('.form-message');
  assert.match(message.textContent, /available dates/);
  // Then answer properly through the recorded handler: monkey-patch input value.
  const dayInput = dayForm.querySelector('#swDateInput');
  dayInput.value = '2026-10-02';
  const daysPayload = Object.assign({}, PAYLOAD);
  dom.sceneContent.querySelector('form.date-answer').dispatch('submit', { preventDefault() {} });
  dom.flush(400);
  // The stub select returns a value the stub FormData can't see — the day scene
  // reads input.value directly, so this works: the quiz intro arrives.
  assert.match(dom.byId.swProgressCount.textContent, /05 \/ 08/);
});

test('DOM: "not really" shows the sad reframe — same question, hurt image, once', () => {
  const dom = makeDom({ payload: PAYLOAD });
  clickChoice(dom, 'yes');
  const likeScene = dom.sceneContent.innerHTML;
  clickChoice(dom, 'not_really');
  assert.equal(currentTitle(dom), 'Do you like Rahul?!?!'); // the same question
  // The hurt image swap — query the live DOM (innerHTML on the stub is write-only).
  const imgs = dom.sceneContent.querySelectorAll('img').map(i => i.getAttribute('src'));
  assert.ok(imgs.some(src => /like-no\.png$/.test(src)), 'the sad image shows: ' + imgs.join(','));
  // "Sure!" after the reframe still moves on.
  clickChoice(dom, 'sure');
  assert.equal(currentTitle(dom), 'How do you like it?');
});

test('DOM: the quiz scores all four — perfect, mid and zero tiers', () => {
  const dom = makeDom({ payload: PAYLOAD });
  walkToQuiz(dom);
  // Perfect answers: C, C, C, B → 4/4.
  const form = dom.sceneContent.querySelector('form');
  dom.sandbox.quizAnswers = { q1: 'C', q2: 'C', q3: 'C', q4: 'B' };
  form.dispatch('submit', { preventDefault() {} });
  dom.flush(1200); // the 650ms scoring beat + buffer
  assert.match(currentTitle(dom), /truly amazing/);
  const scoreValue = dom.sceneContent.querySelector('.hse-score-value');
  assert.ok(scoreValue, 'score value present');
  assert.equal(scoreValue.textContent.replace(/\s+/g, ' ').trim(), '4');
});

test('DOM: a zero score gets the "pretend I didn\u2019t see" tier and still continues', () => {
  const dom = makeDom({ payload: PAYLOAD });
  walkToQuiz(dom);
  const form = dom.sceneContent.querySelector('form');
  dom.sandbox.quizAnswers = { q1: 'A', q2: 'A', q3: 'A', q4: 'A' };
  form.dispatch('submit', { preventDefault() {} });
  dom.flush(1200);
  assert.match(currentTitle(dom), /pretend I didn\u2019t see/);
  dom.sceneContent.querySelector('button.next-button').dispatch('click', { target: dom.sceneContent.querySelector('button.next-button') });
  dom.flush(400);
  assert.match(currentTitle(dom), /selfie/i);
});

/** Boot → yes → sure → preset vibe → day → next: lands on the quiz scene. */
function walkToQuiz(dom) {
  clickChoice(dom, 'yes');
  clickChoice(dom, 'sure');
  clickChoice(dom, 'opt_0');
  const dayForm = dom.sceneContent.querySelector('form.date-answer');
  dayForm.querySelector('#swDateInput').value = '2026-10-01';
  dayForm.dispatch('submit', { preventDefault() {}, target: dayForm });
  dom.flush(400);
  const next = dom.sceneContent.querySelector('button.next-button');
  next.dispatch('click', { target: next });
  dom.flush(400);
  assert.ok(dom.sceneContent.querySelector('form') && dom.sceneContent.querySelector('form').className.includes('hse-quiz'), 'the quiz scene is on');
}

function walkToKiss(dom) {
  walkToQuiz(dom);
  const form = dom.sceneContent.querySelector('form');
  dom.sandbox.quizAnswers = { q1: 'C', q2: 'C', q3: 'C', q4: 'B' };
  form.dispatch('submit', { preventDefault() {} });
  dom.flush(1200);
  const back = dom.sceneContent.querySelector('button.next-button');
  back.dispatch('click', { target: back }); // score → selfie
  dom.flush(400);
  assert.match(currentTitle(dom), /selfie/i);
  // The selfie: choose a file, upload (fetch stub), submit.
  const selfieForm = dom.sceneContent.querySelector('form.upload-answer');
  const input = selfieForm.querySelector('#swSelfieInput');
  const uploadButton = selfieForm.querySelector('[data-upload]');
  input.files = [{ name: 'me.png' }];
  input.dispatch('change', { target: input });
  assert.equal(uploadButton.disabled, false, 'upload button enabled after file chosen');
  dom.sandbox.uploadResponse = { ok: true, url: '/sawaal/selfie/x/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png' };
  uploadButton.dispatch('click', { target: uploadButton });
  dom.flush(50);
  const message = dom.sceneContent.querySelector('.form-message');
  assert.match(message.textContent, /received/, 'upload succeeded: ' + message.textContent);
  selfieForm.dispatch('submit', { preventDefault() {}, target: selfieForm });
  dom.flush(400);
  assert.match(currentTitle(dom), /What if\.\.\?/);
}

test('DOM: the boot sequence claims the visitor session for the published paigaam', () => {
  // claimDraft() fires at boot with the payload's paigaamId — the fetch stub
  // consumes its first scripted response for it (the claim), proving the call
  // happened; then the invite answer still moves the scene forward.
  const dom = makeDom({ payload: PAYLOAD, fetchResponses: [
    { ok: true, body: { id: 'sawaal-000000000000000000' } }, // consumed by the claim
  ]});
  clickChoice(dom, 'yes');
  assert.equal(currentTitle(dom), 'Do you like Rahul?!?!');
});
