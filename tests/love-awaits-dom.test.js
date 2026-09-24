'use strict';
// Run: node --test tests/love-awaits-dom.test.js
// Drives public/love-awaits/awaits.js against a stub DOM, so the whole
// proposal — gate, plea ladder, dodging No, celebration, remembered answer —
// is verified without a browser.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'public', 'love-awaits', 'awaits.js'), 'utf8');

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
    hidden: false,
    style: { props: {}, setProperty(key, value) { this.props[key] = value; }, transform: '' },
    children: [],
    handlers: {},
    addEventListener(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); },
    dispatch(type, event) { (this.handlers[type] || []).forEach(fn => fn(event || {})); },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] === undefined ? null : this.attributes[name]; },
    appendChild(child) { this.children.push(child); return child; },
    focus() { this.focused = true; },
    getContext() { return null; }, // no canvas in the stub — heart/confetti degrade
  };
  node.classList = makeClassList(node);
  return node;
}

const PAYLOAD = {
  who: 'Meher',
  sender: 'Rahul',
  introTitle: 'Love Awaits',
  ladder: [
    { t: 'Will You Be My Forever?', s: 'In a universe of billions, my heart chose you.' },
    { t: 'Wait... Really? 🥺', s: 'Is this real?' },
    { t: 'Don’t Break My Heart 💔', s: 'I promise laughter, strength.' },
    { t: 'I’m Pleading With You 🙏', s: 'I will cross oceans.' },
    { t: 'Please... Don’t Do This 😭', s: 'This silence is deafening.' },
    { t: 'LAST CHANCE! 🌹', s: 'Say YES! 💖' },
  ],
  images: [1, 2, 3, 4, 5, 6, 7].map(n => `/love-awaits/media/loveawaits-${n}.${n === 1 ? 'gif' : 'webp'}`),
  alts: ['opener', 'sad', 'pleading', 'grumpy', 'knife', 'gun', 'kiss'],
  yesLabel: 'Yes, Forever',
  noLabel: 'No',
  finaleTitle: 'Forever & Always',
  finaleLine: 'You are my today and all of my tomorrows.',
};

function makeDom({ payload, stored } = {}) {
  const byId = {
    lawPayload: makeElement('script', { id: 'lawPayload' }),
    lawGate: makeElement('main', { id: 'lawGate' }),
    lawAsking: makeElement('main', { id: 'lawAsking' }),
    lawSuccess: makeElement('main', { id: 'lawSuccess' }),
    lawImage: makeElement('img', { id: 'lawImage' }),
    lawMsgTitle: makeElement('h1', { id: 'lawMsgTitle' }),
    lawMsgNote: makeElement('span', { id: 'lawMsgNote' }),
    lawYes: makeElement('button', { id: 'lawYes' }),
    lawNo: makeElement('button', { id: 'lawNo' }),
    lawButtons: makeElement('div', { id: 'lawButtons' }),
    lawReplay: makeElement('button', { id: 'lawReplay' }),
    lawHeart: null,   // no canvas → the heart degrades gracefully
    lawConfetti: null,
    lawDecor: makeElement('div', { id: 'lawDecor' }),
  };
  byId.lawPayload.textContent = payload || JSON.stringify(PAYLOAD);
  byId.lawAsking.hidden = true;
  byId.lawSuccess.hidden = true;

  const body = makeElement('body');
  body.classList.add('law');
  for (const el of Object.values(byId)) if (el) body.children.push(el);

  const store = new Map(Object.entries(stored || {}));
  const windowListeners = {};
  const document = {
    body,
    hidden: false,
    getElementById: id => byId[id] || null,
    createElement: tag => makeElement(tag),
    addEventListener(type, fn) { (windowListeners['doc:' + type] = windowListeners['doc:' + type] || []).push(fn); },
  };
  return {
    document, byId, body, store, windowListeners,
    dispatchWindow(type, event) { for (const key of Object.keys(windowListeners)) if (key.endsWith(':' + type)) windowListeners[key].forEach(fn => fn(event || {})); },
  };
}

/** Run awaits.js in a vm with a virtual clock; returns helpers + dom. */
function run({ inFrame = false, payload, stored } = {}) {
  const dom = makeDom({ payload, stored });
  const now = { t: 0 };
  const timers = [];
  const context = {
    document: dom.document,
    JSON,
    Math,
    setTimeout(fn, ms) { timers.push({ fn, at: now.t + (ms || 0) }); return timers.length; },
    clearTimeout() {},
    requestAnimationFrame(fn) { timers.push({ fn, at: now.t + 16, raf: true }); return timers.length; },
    cancelAnimationFrame() {},
    performance: { now: () => now.t },
    localStorage: {
      getItem: k => (dom.store.has(k) ? dom.store.get(k) : null),
      setItem: (k, v) => dom.store.set(k, String(v)),
      removeItem: k => dom.store.delete(k),
    },
    addEventListener(type, fn) { (dom.windowListeners[type] = dom.windowListeners[type] || []).push(fn); },
    removeEventListener(type, fn) { dom.windowListeners[type] = (dom.windowListeners[type] || []).filter(f => f !== fn); },
    matchMedia: () => ({ matches: false }),
    innerWidth: 420,
    innerHeight: 860,
    devicePixelRatio: 1,
    location: { reload() { dom.reloaded = (dom.reloaded || 0) + 1; } },
    AudioContext: undefined,
    webkitAudioContext: undefined,
    window: null,
  };
  context.window = { ...context };
  context.window !== context; // window is the same object; awaits.js only reads innerWidth etc.
  Object.assign(context.window, { document: context.document, location: context.location });
  vm.createContext(context);
  vm.runInContext(SOURCE, context, { filename: 'awaits.js' });

  return {
    dom, context, timers, now,
    drain(untilMs) {
      let guard = 0;
      for (;;) {
        const due = timers.filter(t => t.at <= untilMs).sort((a, b) => a.at - b.at)[0];
        if (!due) { now.t = Math.max(now.t, untilMs); return; }
        now.t = due.at;
        timers.splice(timers.indexOf(due), 1);
        due.fn();
        if (++guard > 5000) throw new Error('timer runaway');
      }
    },
  };
}

const hidden = dom => ({ gate: dom.byId.lawGate.hidden, asking: dom.byId.lawAsking.hidden, success: dom.byId.lawSuccess.hidden });

/* --------------------------------------------------------------- tests */

test('DOM: the gate comes first, a tap begins the story', () => {
  const r = run();
  assert.deepEqual(hidden(r.dom), { gate: false, asking: true, success: true });
  assert.equal(r.dom.body.classList.contains('is-begun'), false);

  r.dom.byId.lawGate.dispatch('click');
  assert.deepEqual(hidden(r.dom), { gate: true, asking: false, success: true });
  assert.equal(r.dom.body.classList.contains('is-begun'), true);
  assert.equal(r.dom.byId.lawMsgTitle.textContent, 'Will You Be My Forever?');
  assert.equal(r.dom.byId.lawMsgNote.textContent, 'In a universe of billions, my heart chose you.');
});

test('DOM: the plea ladder climbs with every No, image and all', () => {
  const r = run();
  r.dom.byId.lawGate.dispatch('click');
  const no = r.dom.byId.lawNo, img = r.dom.byId.lawImage;

  no.dispatch('click');
  assert.equal(r.dom.byId.lawMsgTitle.textContent, 'Wait... Really? 🥺');
  assert.equal(img.src, '/love-awaits/media/loveawaits-2.webp');
  assert.equal(img.alt, 'sad');

  no.dispatch('click'); no.dispatch('click');
  assert.equal(r.dom.byId.lawMsgTitle.textContent, 'I’m Pleading With You 🙏');
  assert.equal(img.src, '/love-awaits/media/loveawaits-4.webp');

  no.dispatch('click'); no.dispatch('click');
  assert.equal(r.dom.byId.lawMsgTitle.textContent, 'LAST CHANCE! 🌹');
  assert.equal(img.src, '/love-awaits/media/loveawaits-6.webp');

  // The ladder holds at LAST CHANCE — it never runs off the end.
  no.dispatch('click');
  no.dispatch('click');
  assert.equal(r.dom.byId.lawMsgTitle.textContent, 'LAST CHANCE! 🌹');
  assert.equal(img.src, '/love-awaits/media/loveawaits-6.webp');
});

test('DOM: at the last rung the No button dodges hover and touch', () => {
  const r = run();
  r.dom.byId.lawGate.dispatch('click');
  const no = r.dom.byId.lawNo;

  // Before the last rung: standing still.
  no.dispatch('mouseenter');
  assert.equal(no.style.transform, '');

  // Walk to the last rung.
  for (let i = 0; i < 5; i++) no.dispatch('click');
  assert.equal(r.dom.byId.lawMsgTitle.textContent, 'LAST CHANCE! 🌹');

  no.dispatch('mouseenter');
  assert.match(no.style.transform, /translate\(-?\d+px,\s*-?\d+px\)/);
  const first = no.style.transform;
  no.dispatch('mouseenter');
  no.dispatch('touchstart');
  assert.match(no.style.transform, /translate\(-?\d+px/);
  assert.notEqual(no.style.transform, first);
});

test('DOM: Yes celebrates, persists, and a return visit lands on the finale', () => {
  const r = run({ stored: {} });
  r.dom.byId.lawGate.dispatch('click');
  r.dom.byId.lawYes.dispatch('click');

  assert.deepEqual(hidden(r.dom), { gate: true, asking: true, success: false });
  assert.equal(r.dom.body.classList.contains('is-success'), true);
  const key = [...r.dom.store.keys()].find(k => k.startsWith('law_forever_'));
  assert.ok(key, 'the answer was stored');
  assert.equal(r.dom.store.get(key), 'true');

  // A fresh visit with the answer remembered skips straight to the finale.
  const again = run({ stored: { [key]: 'true' } });
  assert.deepEqual(hidden(again.dom), { gate: true, asking: true, success: false });
  assert.equal(again.dom.body.classList.contains('is-success'), true);
});

test('DOM: Replay Memory clears the answer and reloads', () => {
  const key = 'law_forever_meher';
  const r = run({ stored: { [key]: 'true' } });
  assert.equal(r.dom.byId.lawSuccess.hidden, false);
  r.dom.byId.lawReplay.dispatch('click');
  assert.equal(r.dom.store.has(key), false);
  assert.ok(r.dom.reloaded >= 1, 'the page reloaded');
});

test('DOM: malformed payloads fall back to safe defaults', () => {
  const r = run({ payload: '{broken json' });
  r.dom.byId.lawGate.dispatch('click');
  // Ladder empty → the machine still runs; rung text degrades to ''.
  assert.deepEqual(hidden(r.dom), { gate: true, asking: false, success: true });
});

test('DOM: without any canvas the experience still completes', () => {
  // lawHeart/lawConfetti are null in the stub: no heart, no confetti, no crash.
  const r = run();
  r.dom.byId.lawGate.dispatch('click');
  r.dom.byId.lawYes.dispatch('click');
  assert.equal(r.dom.byId.lawSuccess.hidden, false);
});
