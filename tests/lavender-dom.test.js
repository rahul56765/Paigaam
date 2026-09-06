'use strict';
// Run: node --test tests/lavender-dom.test.js
// Drives public/lavender-bloom/bloom.js against a stub DOM and a virtual clock,
// so the whole four-stage choreography — and the rigged game — are verified
// without a browser.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'public', 'lavender-bloom', 'bloom.js'), 'utf8');

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

function makeDom() {
  const stages = {};
  ['envelope', 'game', 'gift', 'bloom'].forEach(name => {
    stages[name] = makeElement('section', { 'data-stage': name });
  });
  stages.envelope.classList.add('is-active');

  // Nine playable cells inside the board.
  const board = makeElement('div', { class: 'lb-board' });
  board.clientWidth = 300;
  const cells = [];
  for (let i = 0; i < 9; i++) {
    const cell = makeElement('button', { 'data-cell': String(i) });
    cells.push(cell);
    board.children.push(cell);
  }
  board._byselector = s => (s === '.lb-cell' ? cells : null);
  board.querySelectorAll = s => (s === '.lb-cell' ? cells : []);
  // gameStatus needs a real textContent property.
  const gameStatus = makeElement('p', { id: 'lbGameStatus' });
  gameStatus.textContent = '';

  const byId = {
    lbEnvelope: makeElement('div', { id: 'lbEnvelope' }),
    lbWinLine: makeElement('line', { id: 'lbWinLine' }),
    lbGameStatus: gameStatus,
    lbGift: makeElement('div', { id: 'lbGift' }),
    lbGiftBurst: makeElement('div', { id: 'lbGiftBurst' }),
    lbConfetti: makeElement('canvas', { id: 'lbConfetti' }),
    lbFlower: makeElement('div', { id: 'lbFlower' }),
    lbSparkles: makeElement('div', { id: 'lbSparkles' }),
  };

  const body = makeElement('body');
  body.classList.add('lb');

  const document = {
    body,
    getElementById: id => byId[id] || null,
    querySelector(selector) {
      let m = selector.match(/^\.lb-stage\[data-stage="([a-z]+)"\]$/);
      if (m) return stages[m[1]] || null;
      if (selector === '.lb-board') return board;
      return null;
    },
    addEventListener() {},
  };

  return { document, stages, board, cells, byId };
}

/** A virtual clock: timers fire only when the test advances time. */
function makeClock() {
  let now = 0, seq = 0;
  const queue = new Map();
  return {
    get now() { return now; },
    setTimeout(fn, ms) { const id = ++seq; queue.set(id, { at: now + Math.max(0, ms || 0), fn }); return id; },
    clearTimeout(id) { queue.delete(id); },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let next = null;
        for (const [id, item] of queue) {
          if (item.at <= target && (!next || item.at < next.item.at)) next = { id, item };
        }
        if (!next) break;
        queue.delete(next.id);
        now = next.item.at;
        next.item.fn();
      }
      now = target;
    },
    pending: () => queue.size,
  };
}

/** Install the script in a VM against the stub DOM. */
function boot(dom, clock, opts = {}) {
  const canvas = dom.byId.lbConfetti;
  // No 2d context in the stub — confetti must degrade gracefully, not throw.
  canvas.getContext = () => null;

  const sandbox = {
    document: dom.document,
    window: {
      matchMedia: () => ({ matches: !!opts.reduced }),
      devicePixelRatio: 1,
      requestAnimationFrame: () => 0,
      cancelAnimationFrame: () => {},
      addEventListener: () => {},
      parent: opts.inFrame ? {} : undefined,
    },
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    Date,
    Math,
    console,
  };
  sandbox.window = Object.assign(sandbox.window, { window: undefined });
  if (opts.inFrame) sandbox.window.parent = {}; else sandbox.window.parent = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: 'bloom.js' });
  return sandbox;
}

function clickEnvelope(dom) { dom.byId.lbEnvelope.dispatch('click'); }
function clickCell(dom, i) { dom.cells[i].dispatch('click'); }
function clickGift(dom) { dom.byId.lbGift.dispatch('click'); }

/* Stage exit waits: envelope 1900 tap + 800 exit, game 1300 win pause + 1000 exit, gift 1600 tap + 900 exit. */
function openAndAdvance(dom, clock) { clickEnvelope(dom); clock.advance(2800); }
function winAndAdvance(dom, clock) { clock.advance(2400); }   // 1300 win pause + 1000 exit + buffer
function openGiftAndAdvance(dom, clock) { clickGift(dom); clock.advance(2600); }

/* --------------------------------------------------------------- the tests */

test('envelope tap opens the flap and advances to the game', () => {
  const dom = makeDom(), clock = makeClock();
  boot(dom, clock);

  clickEnvelope(dom);
  assert.ok(dom.stages.envelope.classList.contains('is-opening'), 'flap raised');

  clock.advance(2800);
  assert.ok(dom.stages.game.classList.contains('is-active'), 'game entered');
  assert.ok(!dom.stages.envelope.classList.contains('is-active'), 'envelope left');

  // A second tap must not double-fire.
  clickEnvelope(dom);
  assert.ok(dom.stages.game.classList.contains('is-active'));
});

test('the rig: column 0-3-6 always wins, the bot never plays it', () => {
  for (let run = 0; run < 25; run++) {
    const dom = makeDom(), clock = makeClock();
    boot(dom, clock);
    openAndAdvance(dom, clock);

    clickCell(dom, 0);
    clock.advance(700); // bot answers
    clickCell(dom, 3);
    clock.advance(700);
    clickCell(dom, 6);

    assert.ok(dom.board.classList.contains('is-over'), 'win line drawn (run ' + run + ')');
    const oCells = dom.cells.filter(c => c.classList.contains('is-o'));
    for (const c of oCells) {
      const idx = dom.cells.indexOf(c);
      assert.ok(![0, 3, 6].includes(idx), 'bot never occupies first column (run ' + run + ')');
    }
    assert.match(dom.byId.lbGameStatus.textContent || dom.byId.lbGameStatus.innerHTML || '', /won/i);

    winAndAdvance(dom, clock);
    assert.ok(dom.stages.gift.classList.contains('is-active'), 'gift entered after the win (run ' + run + ')');
  }
});

test('the guarantee: even a wandering player wins by their fourth move', () => {
  const dom = makeDom(), clock = makeClock();
  boot(dom, clock);
  openAndAdvance(dom, clock);

  // The player avoids the first column entirely. If a chosen cell is already
  // taken (the bot got there first), they do what any person does — tap the
  // next open square outside the column instead.
  const wishlist = [1, 4, 8, 2, 5, 7];
  let played = 0;
  for (const preferred of wishlist) {
    if (played >= 4) break;
    let idx = preferred;
    if (dom.cells[idx].classList.contains('is-x') || dom.cells[idx].classList.contains('is-o')) {
      idx = [1, 2, 4, 5, 7, 8].find(i =>
        !dom.cells[i].classList.contains('is-x') && !dom.cells[i].classList.contains('is-o'));
    }
    if (idx === undefined) break; // board full outside the column
    clickCell(dom, idx);
    played++;
    clock.advance(700);
    if (dom.board.classList.contains('is-over')) break;
  }
  assert.ok(dom.board.classList.contains('is-over'), 'game finished anyway');
  winAndAdvance(dom, clock);
  assert.ok(dom.stages.gift.classList.contains('is-active'));
});

test('bot never completes its own winning line', () => {
  for (let run = 0; run < 25; run++) {
    const dom = makeDom(), clock = makeClock();
    boot(dom, clock);
    openAndAdvance(dom, clock);
    // Player plays the winning column but slowly enough that the bot plays 2-3 times.
    clickCell(dom, 0); clock.advance(700);
    clickCell(dom, 3); clock.advance(700);
    // Inspect: if the bot has two O's in any line, the third cell of that line
    // must not be O after the next bot move.
    clickCell(dom, 6);
    assert.ok(dom.board.classList.contains('is-over'));
    const LINES = [[0,1,2],[3,4,5],[6,7,8],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const line of LINES) {
      const oCount = line.filter(i => dom.cells[i].classList.contains('is-o')).length;
      assert.ok(oCount < 3, 'bot never wins line ' + line.join(',') + ' (run ' + run + ')');
    }
  }
});

test('gift tap bursts confetti pieces and lands on the bloom', () => {
  const dom = makeDom(), clock = makeClock();
  boot(dom, clock);
  openAndAdvance(dom, clock);
  clickCell(dom, 0); clock.advance(700);
  clickCell(dom, 3); clock.advance(700);
  clickCell(dom, 6);
  winAndAdvance(dom, clock);
  assert.ok(dom.stages.gift.classList.contains('is-active'));

  clickGift(dom);
  assert.ok(dom.byId.lbGift.classList.contains('is-open'), 'gift springs open');
  assert.match(dom.byId.lbGiftBurst.innerHTML, /--dx:/, 'confetti pieces emitted');

  clock.advance(2600);
  assert.ok(dom.stages.bloom.classList.contains('is-active'), 'bloom entered');
});

test('bloom: the sprout grows, blooms, and the copy fades in on schedule', () => {
  const dom = makeDom(), clock = makeClock();
  boot(dom, clock);
  openAndAdvance(dom, clock);
  clickCell(dom, 0); clock.advance(700);
  clickCell(dom, 3); clock.advance(700);
  clickCell(dom, 6);
  winAndAdvance(dom, clock);
  clickGift(dom);
  clock.advance(2600); // gift tap beat (1600) + gift exit (900) + a breath

  const flower = dom.byId.lbFlower;
  // We are now just inside the bloom stage (entered during the advance above).
  assert.ok(dom.stages.bloom.classList.contains('is-active'), 'bloom entered');
  clock.advance(400);  // past the 300ms grow beat
  assert.ok(flower.classList.contains('is-grown'), 'stem grown');
  assert.ok(!flower.classList.contains('is-bloomed'), 'not yet bloomed');

  clock.advance(2200); // past the 2400ms bloom beat
  assert.ok(flower.classList.contains('is-bloomed'), 'bloomed');
  assert.match(dom.byId.lbSparkles.innerHTML, /x:/, 'sparkles emitted');

  clock.advance(1000); // past the 3300ms copy beat
  assert.ok(dom.stages.bloom.classList.contains('is-copy'), 'finale copy visible');
});

test('missing canvas 2d context never breaks the choreography', () => {
  const dom = makeDom(), clock = makeClock();
  // boot() already stubs getContext to null — just run the whole flow.
  boot(dom, clock);
  openAndAdvance(dom, clock);
  clickCell(dom, 0); clock.advance(700);
  clickCell(dom, 3); clock.advance(700);
  clickCell(dom, 6); winAndAdvance(dom, clock);
  openGiftAndAdvance(dom, clock);
  clock.advance(3600); // bloom beats land (grown 300, bloomed 2400, copy 3300)
  assert.ok(dom.stages.bloom.classList.contains('is-active'));
  assert.ok(dom.stages.bloom.classList.contains('is-copy'));
});

test('thumbnail mode: the whole surprise plays itself inside an iframe', () => {
  const dom = makeDom(), clock = makeClock();
  boot(dom, clock, { inFrame: true });
  // No interaction at all — the envelope opens on its own.
  clock.advance(1000);
  assert.ok(dom.stages.envelope.classList.contains('is-opening'), 'auto-opened');
});

test('keyboard: envelope and gift respond to Enter', () => {
  const dom = makeDom(), clock = makeClock();
  boot(dom, clock);
  dom.byId.lbEnvelope.dispatch('keydown', { key: 'Enter', preventDefault() {} });
  assert.ok(dom.stages.envelope.classList.contains('is-opening'));
  clock.advance(2800);
  clickCell(dom, 0); clock.advance(700);
  clickCell(dom, 3); clock.advance(700);
  clickCell(dom, 6); winAndAdvance(dom, clock);
  dom.byId.lbGift.dispatch('keydown', { key: ' ', preventDefault() {} });
  assert.ok(dom.byId.lbGift.classList.contains('is-open'));
});

test('already-played cells cannot be replayed', () => {
  const dom = makeDom(), clock = makeClock();
  boot(dom, clock);
  openAndAdvance(dom, clock);
  clickCell(dom, 0);
  clock.advance(700);
  clickCell(dom, 0); // replay attempt — ignored
  const xCount = dom.cells.filter(c => c.classList.contains('is-x')).length;
  assert.equal(xCount, 1, 'still exactly one X');
});
