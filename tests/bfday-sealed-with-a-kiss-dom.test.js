'use strict';
// Run: node --test tests/bfday-sealed-with-a-kiss-dom.test.js
// Drives public/sealed-with-a-kiss/sealed.js against a stub DOM on a virtual
// clock: open (flap → letter at 1300ms), the busy guard, "read it again"
// (focus returns at 750ms), reduced motion (60ms), and a page missing its
// markup (the script must bail, not throw).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'public', 'sealed-with-a-kiss', 'sealed.js'), 'utf8');

function el(id) {
  const set = new Set();
  return {
    id, scrollTop: 40, focused: 0, handlers: {},
    classList: { add: c => set.add(c), remove: c => set.delete(c), contains: c => set.has(c), _set: set },
    addEventListener(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); },
    click() { (this.handlers.click || []).forEach(fn => fn({})); },
    focus(opts) { this.focused++; this.focusOpts = opts; },
  };
}

function boot({ reduced = false, missing = null } = {}) {
  const ids = ['stageWrap', 'envelopeBtn', 'envelopeScene', 'letterScreen', 'replayBtn'];
  const nodes = Object.fromEntries(ids.filter(i => i !== missing).map(i => [i, el(i)]));
  const clock = { now: 0, queue: [] };
  const sandbox = {
    document: { getElementById: id => nodes[id] || null },
    window: { matchMedia: q => ({ matches: reduced && /reduce/.test(q) }) },
    setTimeout(fn, ms) { clock.queue.push({ at: clock.now + ms, fn }); return clock.queue.length; },
  };
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox);
  function advance(ms) {
    const until = clock.now + ms;
    for (;;) {
      clock.queue.sort((a, b) => a.at - b.at);
      const next = clock.queue[0];
      if (!next || next.at > until) break;
      clock.queue.shift(); clock.now = next.at; next.fn();
    }
    clock.now = until;
  }
  return { nodes, advance, clock };
}

test('DOM: tapping the envelope opens the flap at once and shows the letter at 1300ms', () => {
  const { nodes, advance } = boot();
  nodes.envelopeBtn.click();
  assert.ok(nodes.envelopeScene.classList.contains('opened'), 'flap opens immediately');
  assert.ok(!nodes.letterScreen.classList.contains('show'));
  advance(1299);
  assert.ok(!nodes.letterScreen.classList.contains('show'), 'not before 1300ms');
  advance(1);
  assert.ok(nodes.letterScreen.classList.contains('show'));
  assert.ok(nodes.stageWrap.classList.contains('away'));
  assert.equal(nodes.letterScreen.scrollTop, 0, 'letter starts at the top');
});

test('DOM: taps mid-animation and on an open envelope are ignored', () => {
  const { nodes, advance, clock } = boot();
  nodes.envelopeBtn.click(); nodes.envelopeBtn.click(); nodes.envelopeBtn.click();
  assert.equal(clock.queue.length, 1, 'one open sequence only');
  nodes.replayBtn.click(); // busy: ignored
  assert.ok(nodes.envelopeScene.classList.contains('opened'));
  advance(1300);
  nodes.envelopeBtn.click(); // already open
  assert.equal(clock.queue.length, 0);
});

test('DOM: "read it again" seals it back up and returns focus to the envelope after 750ms', () => {
  const { nodes, advance } = boot();
  nodes.envelopeBtn.click(); advance(1300);
  nodes.letterScreen.scrollTop = 900;
  nodes.replayBtn.click();
  assert.ok(!nodes.letterScreen.classList.contains('show'));
  assert.ok(!nodes.stageWrap.classList.contains('away'));
  assert.ok(!nodes.envelopeScene.classList.contains('opened'));
  assert.equal(nodes.letterScreen.scrollTop, 0);
  nodes.envelopeBtn.click(); // busy during the close
  assert.ok(!nodes.envelopeScene.classList.contains('opened'));
  advance(749);
  assert.equal(nodes.envelopeBtn.focused, 0);
  advance(1);
  assert.equal(nodes.envelopeBtn.focused, 1);
  assert.equal(JSON.stringify(nodes.envelopeBtn.focusOpts), JSON.stringify({ preventScroll: true }));
  // …and it opens again.
  nodes.envelopeBtn.click(); advance(1300);
  assert.ok(nodes.letterScreen.classList.contains('show'));
});

test('DOM: reduced motion collapses both waits to 60ms', () => {
  const { nodes, advance } = boot({ reduced: true });
  nodes.envelopeBtn.click();
  advance(60);
  assert.ok(nodes.letterScreen.classList.contains('show'));
  nodes.replayBtn.click();
  advance(60);
  assert.equal(nodes.envelopeBtn.focused, 1);
});

test('DOM: a page without the markup does not throw', () => {
  for (const missing of ['stageWrap', 'envelopeBtn', 'envelopeScene', 'letterScreen', 'replayBtn']) {
    assert.doesNotThrow(() => boot({ missing }), missing);
  }
});

test('HTML: the renderer emits every element the script needs, staggered in order', () => {
  const { render } = require('../templates/sealed-with-a-kiss/render');
  const config = require('../templates/sealed-with-a-kiss/config');
  const html = render({ customer_data: { ...config.demo, paragraphs: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] } }, {});
  for (const id of ['stageWrap', 'envelopeBtn', 'envelopeScene', 'letterScreen', 'replayBtn']) assert.match(html, new RegExp(`id="${id}"`));
  const order = [...html.matchAll(/style="--i:(\d+)"/g)].map(m => Number(m[1]));
  assert.deepEqual(order, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 'salutation, 8 paragraphs, sign-off');
  assert.match(html, /data-initial="R"/, 'seal initial from the sender name');
  assert.match(render({ customer_data: { senderName: 'ishaan', sealInitial: 'IK' } }, {}), /data-initial="IK"/);
  assert.match(render({ customer_data: { senderName: 'ईशान' } }, {}), /data-initial="ई"/);
  // The seal's hardcoded "R" is gone from the stylesheet.
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'sealed-with-a-kiss', 'sealed.css'), 'utf8');
  assert.match(css, /content: attr\(data-initial\)/);
  assert.doesNotMatch(css, /content: "R"/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
