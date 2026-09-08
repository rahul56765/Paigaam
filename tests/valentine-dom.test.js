'use strict';
// Run: node --test tests/valentine-dom.test.js
// Drives public/valentine-say-yes/ask.js against a stub DOM, so the whole
// plea ladder — and the celebration — are verified without a browser.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'public', 'valentine-say-yes', 'ask.js'), 'utf8');

/* ------------------------------------------------------------- stub DOM */

function makeClassList(node) {
  const set = new Set();
  return {
    add() { for (const c of arguments) set.add(c); },
    remove() { for (const c of arguments) set.delete(c); },
    contains: c => set.has(c),
    toggle(c, force) { const on = force === undefined ? !set.has(c) : !!force; on ? set.add(c) : set.delete(c); return on; },
    _set: set,
    get list() { return Array.from(set); },
  };
}

function makeElement(tag = 'div', attrs = {}) {
  const node = {
    tagName: tag.toUpperCase(),
    attributes: { ...attrs },
    innerHTML: '',
    textContent: '',
    height: undefined,
    width: undefined,
    display: undefined,
    style: {
      props: {},
      height: undefined,
      width: undefined,
      setProperty(key, value) { this.props[key] = value; },
    },
    children: [],
    handlers: {},
    addEventListener(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); },
    dispatch(type, event) { (this.handlers[type] || []).forEach(fn => fn(event || {})); },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] === undefined ? null : this.attributes[name]; },
    appendChild(child) { this.children.push(child); return child; },
    focus() { this.focused = true; },
  };
  node.classList = makeClassList(node);
  return node;
}

function makeDom({ payload } = {}) {
  const byId = {
    vyPayload: makeElement('script', { id: 'vyPayload' }),
    vyImage: makeElement('img', { id: 'vyImage' }),
    vyQuestion: makeElement('h1', { id: 'vyQuestion' }),
    vyYes: makeElement('button', { id: 'vyYes' }),
    vyNo: makeElement('button', { id: 'vyNo' }),
    vyButtons: makeElement('div', { id: 'vyButtons' }),
    vyConfetti: null, // no canvas → confetti degrades gracefully
  };
  byId.vyPayload.textContent = payload || JSON.stringify({
    images: [1, 2, 3, 4, 5, 6, 7].map(n => `/valentine-say-yes/media/valentine-${n}.gif`),
    alts: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    pleas: ['No', 'Are you sure?', 'Pookie please', "Don't do this to me :(", "You're breaking my heart", "I'm gonna cry..."],
    yesLabel: 'Yes',
    question: 'Will you be my Valentine?',
    celebration: 'Yayyy!! :3',
  });

  const body = makeElement('body');
  body.classList.add('vy');
  for (const el of Object.values(byId)) if (el) body.children.push(el);

  const document = {
    body,
    getElementById: id => byId[id] || null,
    createElement: tag => makeElement(tag),
  };
  return { document, byId, body };
}

/** Run ask.js in a vm with a virtual clock; returns the helpers + dom. */
function run({ inFrame = false, payload } = {}) {
  const dom = makeDom({ payload });
  const now = { t: 0 };
  const tasks = [];
  const timers = [];
  const context = {
    document: dom.document,
    JSON,
    Math,
    Path2D: function () {},
    setTimeout(fn, ms) { timers.push({ fn, at: now.t + (ms || 0) }); return timers.length; },
    clearTimeout() {},
    requestAnimationFrame(fn) { timers.push({ fn, at: now.t + 16, raf: true }); return timers.length; },
    cancelAnimationFrame() {},
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    Date: { now: () => now.t },
    devicePixelRatio: 1,
  };
  context.window = inFrame ? {} : { parent: null };
  vm.createContext(context);
  vm.runInContext(SOURCE, context, { filename: 'ask.js' });

  function advance(ms) {
    const until = now.t + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const next = timers.findIndex(t => t.at <= until);
      if (next === -1) break;
      const task = timers.splice(next, 1)[0];
      now.t = Math.max(now.t, task.at);
      task.fn();
    }
    now.t = until;
  }
  return { ...dom, advance, now, timers, context };
}

const click = node => node.dispatch('click');

/* ------------------------------------------------------------------ tests */

test('DOM: five No clicks walk the full plea ladder and grow the Yes button', () => {
  const dom = run();
  const { byId } = dom;

  for (let i = 1; i <= 5; i++) {
    click(byId.vyNo);
    assert.equal(byId.vyImage.src, `/valentine-say-yes/media/valentine-${i + 1}.gif`, 'gif ' + i);
    assert.equal(byId.vyImage.alt, ['a', 'b', 'c', 'd', 'e', 'f', 'g'][i], 'alt ' + i);
    assert.equal(byId.vyNo.textContent, ['No', 'Are you sure?', 'Pookie please', "Don't do this to me :(", "You're breaking my heart", "I'm gonna cry..."][i], 'plea ' + i);
  }
  // The sixth click is refused — the ladder has run out of rungs.
  click(byId.vyNo);
  assert.equal(byId.vyNo.textContent, "I'm gonna cry...");
});

test('DOM: the Yes button grows by 35px/25px per No, and caps at the card edge', () => {
  const dom = run();
  const { byId } = dom;
  const heights = [];
  for (let i = 1; i <= 5; i++) {
    click(byId.vyNo);
    heights.push(Number((byId.vyYes.style.height || '48px').replace('px', '')));
  }
  // 48 + 35*5 = 223 requested; the cap keeps the card usable, so growth is
  // monotonic non-decreasing and the last steps clamp to 160/240.
  assert.deepEqual(heights, [83, 118, 153, 160, 160], '35px per click, capped at 160px');
  assert.equal(Number((byId.vyYes.style.width || '80px').replace('px', '')), 240, 'width capped at 240px');
  assert.equal(byId.vyYes.style.props['--vy-scale'], '7.250', 'font scale matches the original 25px/click ladder');
});

test('DOM: Yes celebrates — celebration gif, message, buttons hidden', () => {
  const dom = run();
  const { byId, body } = dom;
  click(byId.vyYes);
  assert.equal(byId.vyImage.src, '/valentine-say-yes/media/valentine-7.gif');
  assert.equal(byId.vyImage.alt, 'g');
  assert.equal(byId.vyQuestion.textContent, 'Yayyy!! :3');
  assert.equal(byId.vyButtons.style.display, 'none');
  assert.ok(body.classList.contains('is-celebrating'), 'celebration class on body');
});

test('DOM: the whole ladder then Yes plays out in order', () => {
  const dom = run();
  const { byId } = dom;
  for (let i = 0; i < 3; i++) click(byId.vyNo);
  assert.equal(byId.vyNo.textContent, "Don't do this to me :(");
  click(byId.vyYes);
  assert.equal(byId.vyQuestion.textContent, 'Yayyy!! :3');
  // Further No clicks do nothing once the question has been said.
  click(byId.vyNo);
  assert.equal(byId.vyQuestion.textContent, 'Yayyy!! :3');
});

test('DOM: personalised payload drives the copy', () => {
  const payload = JSON.stringify({
    images: ['/media/x.gif', '/media/y.gif'],
    alts: ['first', 'last'],
    pleas: ['Nah', 'Please?', 'Pretty please'],
    yesLabel: 'A thousand times yes',
    question: 'Be mine?',
    celebration: 'Best day ever!',
  });
  const dom = run({ payload });
  const { byId } = dom;
  click(byId.vyNo);
  assert.equal(byId.vyImage.src, '/media/y.gif');
  assert.equal(byId.vyNo.textContent, 'Please?');
  click(byId.vyYes);
  assert.equal(byId.vyQuestion.textContent, 'Best day ever!');
});

test('DOM: no canvas means the celebration still lands (graceful degradation)', () => {
  const dom = run();
  const { byId, body } = dom;
  click(byId.vyYes);
  assert.ok(body.classList.contains('is-celebrating'));
  assert.equal(byId.vyQuestion.textContent, 'Yayyy!! :3');
});

test('DOM: a malformed payload falls back to safe defaults', () => {
  const dom = run({ payload: '{not json' });
  const { byId } = dom;
  click(byId.vyNo);
  // The hard-coded defaults in ask.js carry the designed question when the
  // server-rendered payload cannot be parsed — but there are no image paths
  // to fall back on, so the photo is left untouched rather than broken.
  assert.equal(byId.vyImage.src, undefined);
  click(byId.vyYes);
  assert.equal(byId.vyQuestion.textContent, 'Yayyy!! :3');
});

test('DOM: collection thumbnails play the whole plea quietly, end to end', () => {
  const dom = run({ inFrame: true });
  const { byId, body } = dom;
  dom.advance(1000); // the in-frame autoplay fires at ~900ms
  assert.equal(byId.vyNo.textContent, "I'm gonna cry...", 'all five pleas spent');
  assert.equal(byId.vyImage.src, '/valentine-say-yes/media/valentine-7.gif');
  assert.equal(byId.vyQuestion.textContent, 'Yayyy!! :3');
  assert.ok(body.classList.contains('is-celebrating'), 'celebration reached');
});
