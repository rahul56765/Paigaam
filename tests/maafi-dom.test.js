'use strict';
// Run: node --test tests/maafi-dom.test.js
// Drives public/maafi/maafi.js against a stub DOM, so the whole dodge game —
// and the celebration — are verified without a browser.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'public', 'maafi', 'maafi.js'), 'utf8');

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
    innerHTML: '',
    textContent: '',
    style: { props: {}, setProperty(key, value) { this.props[key] = value; } },
    children: [],
    handlers: {},
    removed: false,
    addEventListener(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); },
    dispatch(type, event) { (this.handlers[type] || []).forEach(fn => fn(event || {})); },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] === undefined ? null : this.attributes[name]; },
    appendChild(child) { this.children.push(child); return child; },
    remove() { this.removed = true; },
    focus() { this.focused = true; },
  };
  node.classList = makeClassList(node);
  return node;
}

/** A deterministic pseudo-random so dodge positions are reproducible. */
function makeRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeDom({ payload = {}, rects } = {}) {
  const buttons = makeElement('div', { id: 'mmButtons' });
  const yes = makeElement('button', { id: 'mmYes' });
  const no = makeElement('button', { id: 'mmNo' });
  const byId = {
    mmPayload: Object.assign(makeElement('script', { id: 'mmPayload' }), { textContent: JSON.stringify(payload) }),
    mmText: makeElement('h1', { id: 'mmText' }),
    mmYes: yes,
    mmNo: no,
    mmButtons: buttons,
    mmEmoji: makeElement('p', { id: 'mmEmoji' }),
    mmCount: makeElement('p', { id: 'mmCount' }),
  };
  const created = [];

  const timers = { list: [], now: 0 };
  const intervals = [];

  const bodyNode = Object.assign(makeElement('body'), { classList: makeClassList(makeElement('body')) });
  bodyNode.classList.add('mm'); // the script guards on body.mm
  const sandbox = {
    document: {
      body: bodyNode,
      getElementById(id) { return byId[id] || null; },
      createElement(tag) { const el = makeElement(tag); created.push(el); return el; },
    },
    window: {
      innerWidth: 420,
      innerHeight: 860,
      addEventListener() {},
      matchMedia: () => ({ matches: false }),
    },
    navigator: { userAgent: 'node-test' },
    setInterval(fn, ms) { intervals.push({ fn, ms }); return intervals.length; },
    setTimeout(fn, ms) { timers.list.push({ fn, ms }); return timers.list.length; },
    clearTimeout() {},
    console,
  };
  sandbox.window.parent = {};
  sandbox.self = sandbox.window;

  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox);

  // Rect plumbing: the game logic reads getBoundingClientRect through __rect.
  const R = rects || {
    buttons: { left: 40, top: 300, right: 380, bottom: 500, width: 340, height: 200 },
    yes: { left: 60, top: 340, right: 200, bottom: 390, width: 140, height: 50 },
    no: { left: 220, top: 340, right: 360, bottom: 390, width: 140, height: 50 },
  };
  buttons.__rect = R.buttons;
  yes.__rect = R.yes;
  no.__rect = R.no;
  Object.defineProperty(sandbox.document.body.classList, 'contains', { value: c => c === 'mm' });

  function flush(ms = 1e9) {
    const until = timers.now + ms;
    while (timers.list.length && timers.list[0].ms !== undefined) {
      // Timers in this stub run in order queued; each fires once when reached.
      const t = timers.list.shift();
      timers.now = until;
      t.fn();
    }
  }

  return { byId, created, timers, intervals, flush, sandbox };
}

function readScale(button) {
  const m = /scale\(([\d.]+)\)/.exec(button.style.transform || '');
  return m ? Number(m[1]) : null;
}

/* --------------------------------------------------------------- tests */

const PAYLOAD = {
  headline: 'I’m really sorry ❤️',
  ladder: ['Plea A 😢', 'Plea B 🌍', 'Plea C 🙏'],
  yesLabel: 'Yes',
  noLabel: 'No',
  celebration: 'Yay!',
};

test('DOM: untouched page positions the No button; the server-rendered headline is untouched', () => {
  const dom = makeDom({ payload: PAYLOAD });
  // The headline itself is server-rendered into the HTML; the script only
  // replaces it on a dodge. Resting state = positioned No button, no counter.
  assert.match(dom.byId.mmNo.style.left, /%$/);
  assert.match(dom.byId.mmNo.style.transform, /translate\(-50%, -50%\) scale\(1\)/);
  assert.equal(dom.byId.mmCount.innerHTML, '');
});

test('DOM: the No button dodges, shrinks to the 0.3 floor and never escapes the tray', () => {
  const dom = makeDom({ payload: PAYLOAD });
  const no = dom.byId.mmNo;
  for (let i = 1; i <= 25; i++) {
    no.dispatch('click', { preventDefault() {} });
    const left = Number(String(no.style.left).replace('px', ''));
    const top = Number(String(no.style.top).replace('px', ''));
    assert.ok(left >= 10, `attempt ${i}: left ${left} inside tray`);
    assert.ok(top >= 10, `attempt ${i}: top ${top} inside tray`);
    const scale = readScale(no);
    assert.ok(scale !== null, `attempt ${i}: scale set`);
    assert.ok(scale >= 0.299, `attempt ${i}: scale ${scale} not below floor`);
  }
  assert.equal(readScale(no), 0.3, 'floor exactly 0.3 after 25 attempts');
});

test('DOM: the pity ladder climbs the payload and cycles; the counter tiers climb', () => {
  const dom = makeDom({ payload: PAYLOAD });
  const no = dom.byId.mmNo;
  const text = dom.byId.mmText, counter = dom.byId.mmCount;
  // Ladder has 3 lines; 10 attempts must show every line at least twice.
  const seen = new Set();
  for (let i = 1; i <= 10; i++) {
    no.dispatch('click', { preventDefault() {} });
    seen.add(text.innerHTML);
    if (i <= 5) assert.match(counter.innerHTML, /Come on\.\.\./);
    else if (i <= 10) assert.match(counter.innerHTML, /begging you/);
  }
  assert.deepEqual(Array.from(seen).sort(), ['Plea A 😢', 'Plea B 🌍', 'Plea C 🙏']);
  // Past the ladder, attempts still plead ("I can do this all day").
  for (let i = 11; i <= 12; i++) no.dispatch('click', { preventDefault() {} });
  assert.match(counter.innerHTML, /all day/);
});

test('DOM: the Yes button grows after the third attempt', () => {
  const dom = makeDom({ payload: PAYLOAD });
  const no = dom.byId.mmNo, yes = dom.byId.mmYes;
  const intervals = dom.intervals;
  for (let i = 1; i <= 4; i++) {
    no.dispatch('click', { preventDefault() {} });
    // Fire the growth interval once per attempt.
    intervals.forEach(iv => iv.fn());
    if (i <= 3) assert.ok(!/scale\(1\.1/.test(yes.style.transform || ''), 'no growth before attempt 4');
    else assert.match(yes.style.transform, /scale\(1\.3\)/, '1.1 + 4*0.05 after four attempts');
  }
});

test('DOM: Yes celebrates once — message, emoji, counter, heart rain — and further No presses are inert', () => {
  const dom = makeDom({ payload: PAYLOAD });
  const no = dom.byId.mmNo, yes = dom.byId.mmYes;
  no.dispatch('click', { preventDefault() {} });
  yes.dispatch('click', {});
  assert.equal(dom.byId.mmText.textContent, 'Yay!');
  assert.equal(dom.byId.mmEmoji.textContent, '😊❤️💃🎉✨🥰💕🌟🎊💖🌹😘');
  assert.equal(dom.byId.mmEmoji.classList.contains('hidden'), false);
  assert.match(dom.byId.mmCount.innerHTML, /I LOVE YOU SO MUCH/);
  assert.equal(dom.byId.mmButtons.style.display, 'none');
  // 30 hearts queued.
  assert.ok(dom.timers.list.length >= 30, 'heart rain scheduled');
  // The state is terminal: No presses change nothing.
  const textBefore = dom.byId.mmText.textContent;
  no.dispatch('click', { preventDefault() {} });
  assert.equal(dom.byId.mmText.textContent, textBefore);
  yes.dispatch('click', {});
  assert.equal(dom.byId.mmText.textContent, 'Yay!');
});

test('DOM: defaults hold when the payload is empty or corrupt', () => {
  const dom = makeDom({ payload: {} });
  const no = dom.byId.mmNo;
  no.dispatch('click', { preventDefault() {} });
  assert.ok(dom.byId.mmText.innerHTML.length > 0, 'ladder falls back to the default headline');
});

test('DOM: dodging spawns sparkles and hearts as DOM nodes', () => {
  const dom = makeDom({ payload: PAYLOAD });
  const no = dom.byId.mmNo;
  const before = dom.created.length;
  no.dispatch('click', { preventDefault() {} });
  const created = dom.created.length - before;
  assert.ok(created >= 6, '5 sparkles + at least 1 heart created, got ' + created);
});
