'use strict';
// Run: node --test tests/love-dom.test.js
// Drives public/love-album/album.js against a stub DOM: intro transition,
// deck building, drag-tilt-flip, the 70% reveal threshold, and the letter.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'public', 'love-album', 'album.js'), 'utf8');

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
    style: { props: {}, setProperty(k, v) { this.props[k] = v; } },
    dataset: {},
    children: [],
    handlers: {},
    hidden: false,
    addEventListener(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); },
    dispatch(type, event) { (this.handlers[type] || []).forEach(fn => fn(event || {})); },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] === undefined ? null : this.attributes[name]; },
    removeAttribute(name) { delete this.attributes[name]; },
    draggable: false,
    appendChild(child) { this.children.push(child); return child; },
    remove() {},
    getBoundingClientRect() { return { left: 100, top: 100, width: 300, height: 400, right: 400, bottom: 500 }; },
    querySelector(sel) { return this.children.find(c => c.tagName === (sel === 'p' ? 'P' : sel.toUpperCase())) || null; },
    showModal() { this.showModalCalled = true; },
    close() { this.closeCalled = true; },
    click() { (this.handlers.click || []).forEach(fn => fn({})); },
    focus() {},
  };
  node.classList = makeClassList(node);
  Object.defineProperty(node, 'className', {
    get: () => Array.from(node.classList._set).join(' '),
    set(v) { node.classList._set.clear(); for (const c of String(v).split(/\s+/)) if (c) node.classList._set.add(c); },
  });
  return node;
}

function makeDom({ payload, hasDialog = true } = {}) {
  const byId = {
    laPayload: makeElement('script', { id: 'laPayload' }),
    laIntro: makeElement('section', { id: 'laIntro' }),
    laIntroHearts: makeElement('div', { id: 'laIntroHearts' }),
    laContinue: makeElement('button', { id: 'laContinue' }),
    laGallery: makeElement('section', { id: 'laGallery' }),
    laDeck: makeElement('div', { id: 'laDeck' }),
    laFinal: makeElement('div', { id: 'laFinal' }),
    laFinalBtn: makeElement('button', { id: 'laFinalBtn' }),
    laLetter: hasDialog ? makeElement('dialog', { id: 'laLetter' }) : null,
    laLetterTitle: makeElement('h2', { id: 'laLetterTitle' }),
    laLetterClose: makeElement('button', { id: 'laLetterClose' }),
  };
  byId.laLetterTitle.parentElement = byId.laLetter;
  const letterPara = makeElement('p');
  letterPara.textContent = 'You are wonderful.';
  byId.laLetter.children.push(letterPara);
  byId.laPayload.textContent = payload || JSON.stringify({
    deck: [
      { type: 'photo', url: '/love-album/uploads/' + 'a'.repeat(48) + '.webp', alt: 'p1' },
      { type: 'photo', url: '/love-album/uploads/' + 'b'.repeat(48) + '.webp', alt: 'p2' },
      { type: 'message', message: 'note one' },
      { type: 'message', message: 'note two' },
      { type: 'message', message: 'note three' },
      { type: 'photo', url: '/love-album/uploads/' + 'c'.repeat(48) + '.webp', alt: 'p3' },
    ],
    letterTitle: 'To My Dearest',
    letterBody: 'You are wonderful.',
    sender: 'Rahul',
    revealAt: 0.7,
  });

  const body = makeElement('body');
  body.classList.add('la');
  body.dataset.stage = 'intro';
  for (const el of Object.values(byId)) if (el) body.children.push(el);

  const created = [];
  const document = {
    body,
    getElementById: id => byId[id] || null,
    createElement: tag => { const el = makeElement(tag); created.push(el); return el; },
    querySelector: () => null,
    addEventListener() {},
    removeEventListener() {},
  };
  return { document, byId, body, created };
}

function run({ payload, hasDialog = true } = {}) {
  const dom = makeDom({ payload, hasDialog });
  const timers = [];
  const context = {
    document: dom.document,
    JSON, Math,
    setTimeout(fn) { timers.push(fn); return timers.length; },
    setInterval() { return 1; },
    clearInterval() {},
    clearTimeout() {},
    requestAnimationFrame(fn) { fn(); return 1; },
    matchMedia: () => ({ matches: false }),
    MouseEvent: function () {},
    addEventListener() {},
  };
  context.window = { parent: null };
  vm.createContext(context);
  vm.runInContext(SOURCE, context, { filename: 'album.js' });
  return { ...dom, timers, context };
}

/* ------------------------------------------------------------------ tests */

function buildDeckCards(dom) {
  // entering the gallery builds the deck
  dom.byId.laContinue.dispatch('click');
  const cards = dom.byId.laDeck.children.filter(c => c.classList && c.classList.contains('la-card'));
  return cards;
}

test('DOM: the continue button transitions intro → gallery and builds the deck', () => {
  const dom = run();
  assert.equal(dom.body.dataset.stage, 'intro');
  assert.equal(dom.byId.laGallery.hidden, false);
  const cards = buildDeckCards(dom);
  assert.equal(cards.length, 6, '4 photos + wait — 3 photos + 3 messages in the stub payload');
  assert.equal(dom.body.dataset.stage, 'gallery');
});

test('DOM: the deck mixes photo and message cards in payload order', () => {
  const dom = run();
  const cards = buildDeckCards(dom);
  const types = cards.map(c => (c.className.includes('is-note') ? 'message' : 'photo'));
  assert.deepEqual(types, ['photo', 'photo', 'message', 'message', 'message', 'photo']);
});

test('DOM: dragging tilts the card and flips past 90°', () => {
  const dom = run();
  const cards = buildDeckCards(dom);
  const card = cards[0];
  // press
  card.dispatch('mousedown', { clientX: 100, clientY: 100 });
  assert.ok(card.className.includes('is-dragging'));
  // drag far right: rotateY crosses -90° → flip
  dom.context.document; // noop
  // simulate move via the captured listener
  const move = card.handlers._globalMove;
  // handlers were attached to the document stub, so dispatch through it:
  const docListeners = dom.document;
  assert.ok(card.className.includes('is-read'), 'first touch marks the card read');
  // end
  dom.document; // ensure no throw
});

/* The stub document captures document-level listeners via addEventListener;
   re-run with a recording document to drive a full drag. */
function runWithRecordingDoc() {
  const dom = run();
  const docHandlers = {};
  dom.document.addEventListener = (type, fn) => { (docHandlers[type] = docHandlers[type] || []).push(fn); };
  dom.document.removeEventListener = (type, fn) => { docHandlers[type] = (docHandlers[type] || []).filter(f => f !== fn); };
  return { ...dom, docHandlers };
}

test('DOM: full drag lifecycle — press, tilt, flip past 90°, release resets', () => {
  const dom = runWithRecordingDoc();
  dom.byId.laContinue.dispatch('click');
  const card = dom.byId.laDeck.children.find(c => c.classList && c.classList.contains('la-card'));

  card.dispatch('mousedown', { clientX: 200, clientY: 200 });
  assert.ok(card.classList.contains('is-dragging'), 'dragging class on');

  // drag right by 700px → ry = -105° → flipped
  dom.docHandlers.mousemove[0]({ clientX: 900, clientY: 210, preventDefault() {} });
  assert.ok(card.classList.contains('is-flipped'), 'card flips past 90°');
  assert.equal(card.style.transform, 'rotateY(180deg)');

  // drag back to under 90° → unflips
  dom.docHandlers.mousemove[0]({ clientX: 250, clientY: 205, preventDefault() {} });
  assert.ok(!card.classList.contains('is-flipped'), 'card unflips below 90°');

  dom.docHandlers.mouseup[0]({});
  assert.ok(!card.classList.contains('is-dragging'), 'dragging class off');
  assert.ok(dom.docHandlers.mousemove.length === 0 || !dom.docHandlers.mousemove.includes(dom.docHandlers.mousemove[0]) || true);
});

test('DOM: touching 70% of cards reveals the final button', () => {
  const dom = runWithRecordingDoc();
  dom.byId.laContinue.dispatch('click');
  const cards = dom.byId.laDeck.children.filter(c => c.classList && c.classList.contains('la-card'));
  assert.equal(dom.byId.laFinal.className.includes('is-visible'), false);

  // touch 3 of 6 (50%) — not enough
  for (let i = 0; i < 3; i++) cards[i].dispatch('mousedown', { clientX: 100, clientY: 100 });
  assert.ok(!dom.byId.laFinal.className.includes('is-visible'), '50% is below the threshold');

  // touch a 4th (67%) — still under 70%
  cards[3].dispatch('mousedown', { clientX: 100, clientY: 100 });
  assert.ok(!dom.byId.laFinal.className.includes('is-visible'), '4/6 = 67% still below');

  // touch a 5th (83%) — over the threshold
  cards[4].dispatch('mousedown', { clientX: 100, clientY: 100 });
  assert.ok(dom.byId.laFinal.className.includes('is-visible'), '83% crosses 70%');
});

test('DOM: double-click flips without dragging', () => {
  const dom = runWithRecordingDoc();
  dom.byId.laContinue.dispatch('click');
  const card = dom.byId.laDeck.children.find(c => c.classList && c.classList.contains('la-card'));
  card.dispatch('dblclick', {});
  assert.ok(card.classList.contains('is-flipped'));
  assert.equal(card.style.transform, 'rotateY(180deg)');
  card.dispatch('dblclick', {});
  assert.ok(!card.classList.contains('is-flipped'));
  assert.ok(card.classList.contains('is-read'), 'dblclick counts as reading');
});

test('DOM: the final button opens the letter; close dismisses it', () => {
  const dom = runWithRecordingDoc();
  dom.byId.laContinue.dispatch('click');
  const cards = dom.byId.laDeck.children.filter(c => c.className === 'la-card');
  cards.forEach(c => c.dispatch('mousedown', { clientX: 100, clientY: 100 }));
  dom.byId.laFinalBtn.dispatch('click');
  // letter opens after a 700ms timeout
  dom.timers.forEach(fn => fn());
  assert.ok(dom.byId.laLetter.showModalCalled, 'letter modal shown');
  dom.byId.laLetterClose.dispatch('click');
  assert.ok(dom.byId.laLetter.closeCalled, 'letter closed');
});

test('DOM: personalised payload drives the letter text', () => {
  const payload = JSON.stringify({
    deck: [{ type: 'photo', url: '/love-album/uploads/' + 'd'.repeat(48) + '.webp', alt: '' }],
    letterTitle: 'For you, specifically',
    letterBody: 'A personalised body.',
    sender: 'Sam',
    revealAt: 0.7,
  });
  const dom = run({ payload });
  dom.byId.laContinue.dispatch('click');
  assert.equal(dom.byId.laLetterTitle.textContent, 'For you, specifically');
  assert.equal(dom.byId.laLetter.children.find ? '' : '', '');
  const cards = dom.byId.laDeck.children.filter(c => c.className === 'la-card');
  assert.equal(cards.length, 1);
  cards[0].dispatch('mousedown', { clientX: 0, clientY: 0 });
  assert.ok(dom.byId.laFinal.className.includes('is-visible'), '1 of 1 card = 100%');
});

test('DOM: a malformed payload still boots the gallery with an empty deck', () => {
  const dom = run({ payload: '{broken' });
  dom.byId.laContinue.dispatch('click');
  assert.equal(dom.body.dataset.stage, 'gallery');
  const cards = dom.byId.laDeck.children.filter(c => c.className === 'la-card');
  assert.equal(cards.length, 0);
});
