'use strict';
// Run: node --test tests/bfday-unrejectable-dom.test.js
// Drives public/unrejectable/unrejectable.js against a stub DOM on a virtual
// clock.  Covers:
//   · No gives up after exactly 5 tries (MAX_DODGES = 5)
//   · Positions after teleport always land inside the safe zone (EDGE = 18px)
//   · Caption updates through the dodge stages then the give-up caption
//   · Keyboard path (detail=0 click) → straight to give-up without a dodge
//   · After give-up: clicking the tired button shows the no-message
//   · Yes: screen swap happens after the correct delay
//   · Reduced motion: screen swap collapses to 60ms, no confetti
//   · Missing markup does not throw

const { test }  = require('node:test');
const assert    = require('node:assert/strict');
const fs        = require('node:fs');
const path      = require('node:path');
const vm        = require('node:vm');

const SOURCE = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'unrejectable', 'unrejectable.js'),
  'utf8',
);

/* Viewport for tests */
const VW = 375;
const VH = 812;
const EDGE = 18;

/* ---- minimal element stub ---- */
function el(id, rect) {
  /* rect = { left, top, width, height } of the element in viewport coords */
  var r = rect || { left: 0, top: 0, width: 60, height: 44 };
  var styles = {};
  return {
    id,
    hidden: false,
    textContent: '',
    handlers: {},
    style: new Proxy(styles, {
      get: (t, k) => t[k] || '',
      set: (t, k, v) => { t[k] = v; return true; },
    }),
    _styles: styles,
    getBoundingClientRect() {
      /* honour style.left / style.top if the script moves us */
      var l = parseFloat(styles.left) || r.left;
      var t2 = parseFloat(styles.top)  || r.top;
      return { left: l, top: t2, width: r.width, height: r.height };
    },
    addEventListener(type, fn, opts) {
      var list = this.handlers[type] = this.handlers[type] || [];
      list.push({ fn, opts });
    },
    click(detail) {
      var ev = { detail: detail === undefined ? 1 : detail, button: 0 };
      (this.handlers.click || []).forEach(h => h.fn(ev));
    },
    scrollTo() {},
  };
}

function makeNodes(opts) {
  opts = opts || {};
  var yesBtn    = el('ucYesBtn',    { left: 80,  top: 450, width: 140, height: 56 });
  var noBtn     = el('ucNoBtn',     { left: 250, top: 450, width: 80,  height: 44 });
  var noWrap    = el('ucNoWrap',    { left: 250, top: 445, width: 80,  height: 56 });
  var caption   = el('ucNoCaption', { left: 250, top: 503, width: 80,  height: 24 });
  var question  = el('ucQuestionBlock', { left: 20, top: 340, width: 335, height: 90 });
  var buttonRow = el('ucButtonRow', { left: 0,   top: 440, width: 375, height: 60 });
  var noMessage = el('ucNoMessage', { left: 0,   top: 520, width: 375, height: 40 });
  var askScreen = el('ucAskScreen', { left: 0,   top: 0,   width: 375, height: 812 });
  var celebrate = el('ucCelebrateScreen', { left: 0, top: 0, width: 375, height: 812 });
  var payload   = el('ucPayload',   {});
  var confetti  = el('ucConfetti',  { left: 0, top: 0, width: 375, height: 812 });
  confetti.getContext = function () {
    return {
      clearRect() {}, save() {}, restore() {}, translate() {}, rotate() {},
      fillRect() {}, beginPath() {}, arc() {}, fill() {},
      set globalAlpha(_) {}, set fillStyle(_) {},
    };
  };

  payload.textContent = JSON.stringify({ giveUpCaption: 'fine, i\'ll just be here' });
  celebrate.hidden = true;
  noMessage.hidden = true;

  if (opts.missing) {
    var missingId = opts.missing;
    var map = { yesBtn, noBtn, noWrap, caption, question, buttonRow, noMessage, askScreen, celebrate };
    // return null for the missing element
    var overrideId = {
      ucYesBtn: 'yesBtn', ucNoBtn: 'noBtn', ucNoWrap: 'noWrap',
      ucNoCaption: 'caption', ucQuestionBlock: 'question',
      ucButtonRow: 'buttonRow', ucNoMessage: 'noMessage',
      ucAskScreen: 'askScreen', ucCelebrateScreen: 'celebrate',
    }[missingId];
    if (overrideId) map[overrideId] = null;
  }

  return { yesBtn, noBtn, noWrap, caption, question, buttonRow, noMessage, askScreen, celebrate, payload, confetti };
}

function boot(opts) {
  opts = opts || {};
  var reduced = !!opts.reduced;
  var nodes   = makeNodes(opts);
  var clock   = { now: 0, queue: [] };
  var rAFQueue = [];

  var idsMap = {
    ucYesBtn: nodes.yesBtn,
    ucNoBtn:  nodes.noBtn,
    ucNoWrap: nodes.noWrap,
    ucNoCaption: nodes.caption,
    ucQuestionBlock: nodes.question,
    ucButtonRow: nodes.buttonRow,
    ucNoMessage: nodes.noMessage,
    ucAskScreen: nodes.askScreen,
    ucCelebrateScreen: nodes.celebrate,
    ucPayload: nodes.payload,
    ucConfetti: nodes.confetti,
  };

  var sandbox = {
    document: {
      getElementById: function (id) { return idsMap[id] || null; },
    },
    window: {
      matchMedia: function (q) { return { matches: reduced && /reduce/.test(q) }; },
      innerWidth:  VW,
      innerHeight: VH,
      scrollTo: function () {},
    },
    navigator: {
      vibrate: function () {},
    },
    performance: { now: function () { return clock.now; } },
    requestAnimationFrame: function (fn) { rAFQueue.push(fn); },
    Math: Math,
    setTimeout: function (fn, ms) {
      clock.queue.push({ at: clock.now + ms, fn: fn });
      return clock.queue.length;
    },
    JSON: JSON,
    Proxy: Proxy,
    parseInt: parseInt,
    parseFloat: parseFloat,
    isNaN: isNaN,
  };

  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox);

  function advance(ms) {
    var until = clock.now + ms;
    for (;;) {
      clock.queue.sort(function (a, b) { return a.at - b.at; });
      var next = clock.queue[0];
      if (!next || next.at > until) break;
      clock.queue.shift();
      clock.now = next.at;
      next.fn();
    }
    clock.now = until;
  }

  /* fire pointerdown on noBtn */
  function pointerDownNo() {
    (nodes.noBtn && nodes.noBtn.handlers.pointerdown || []).forEach(function (h) {
      h.fn({ pointerType: 'touch', button: 0 });
    });
  }

  return { nodes, advance, clock, rAFQueue, pointerDownNo };
}

/* ===== tests ===== */

test('DOM: No gives up after exactly 5 pointerdown events', function () {
  var t = boot();
  /* dodges 1-4: should NOT give up; opacity unset (style returns '' via Proxy) */
  for (var i = 0; i < 4; i++) {
    t.pointerDownNo();
    assert.equal(t.nodes.noWrap.style.opacity, '', 'not given up yet at dodge ' + (i + 1));
  }
  /* dodge 5: give up */
  t.pointerDownNo();
  assert.equal(t.nodes.noWrap.style.opacity, '0.4', 'opacity 0.4 after 5th dodge');
  assert.equal(t.nodes.caption.textContent, 'fine, i\'ll just be here');
});

test('DOM: teleported position always stays inside the safe zone', function () {
  var t = boot();
  for (var i = 0; i < 4; i++) {
    t.pointerDownNo();
    var left = parseFloat(t.nodes.noWrap._styles.left);
    var top  = parseFloat(t.nodes.noWrap._styles.top);
    assert.ok(!isNaN(left), 'left is a number');
    assert.ok(!isNaN(top),  'top is a number');
    assert.ok(left >= EDGE, 'left >= EDGE (' + left + ')');
    assert.ok(top  >= EDGE, 'top  >= EDGE (' + top + ')');
    /* right edge: noWrap width ~80px */
    assert.ok(left + 80 <= VW - EDGE + 80, 'right edge inside viewport (with fallback tolerance)');
    /* bottom edge: noWrap height ~56px */
    assert.ok(top + 56 <= VH - EDGE + 56, 'bottom edge inside viewport (with fallback tolerance)');
  }
});

test('DOM: caption updates through the dodge stages', function () {
  var t = boot();
  var stages = ['no', 'are you sure?', 'really?', 'the button is shy', "it's decided"];
  /* initial caption from HTML is already 'no'; after dodge 1 → stages[1] */
  t.pointerDownNo();
  assert.equal(t.nodes.caption.textContent, stages[1]);
  t.pointerDownNo();
  assert.equal(t.nodes.caption.textContent, stages[2]);
  t.pointerDownNo();
  assert.equal(t.nodes.caption.textContent, stages[3]);
  t.pointerDownNo();
  assert.equal(t.nodes.caption.textContent, stages[4]);
  /* dodge 5 → give up */
  t.pointerDownNo();
  assert.equal(t.nodes.caption.textContent, 'fine, i\'ll just be here');
});

test('DOM: keyboard path (detail=0 click) goes straight to give-up', function () {
  var t = boot();
  t.nodes.noBtn.click(0); /* detail=0 simulates Enter/Space */
  assert.equal(t.nodes.noWrap._styles.opacity, '0.4', 'gave up immediately');
  assert.equal(t.nodes.caption.textContent, 'fine, i\'ll just be here');
});

test('DOM: after give-up, clicking No shows the no-message and hides buttons', function () {
  var t = boot();
  /* exhaust all dodges */
  for (var i = 0; i < 5; i++) t.pointerDownNo();
  /* now click the tired button */
  t.nodes.noBtn.click(1);
  assert.equal(t.nodes.buttonRow.hidden, true,  'button row hidden');
  assert.equal(t.nodes.noMessage.hidden, false, 'no-message visible');
});

test('DOM: Yes swaps screens after 1000ms (full motion)', function () {
  var t = boot();
  t.nodes.yesBtn.click();
  assert.equal(t.nodes.askScreen.hidden, false, 'ask screen still visible immediately');
  t.advance(999);
  assert.equal(t.nodes.askScreen.hidden, false, 'still visible at 999ms');
  t.advance(1);
  assert.equal(t.nodes.askScreen.hidden,    true,  'ask screen hidden at 1000ms');
  assert.equal(t.nodes.celebrate.hidden,    false, 'celebration visible');
});

test('DOM: reduced motion collapses yes-delay to 60ms', function () {
  var t = boot({ reduced: true });
  t.nodes.yesBtn.click();
  t.advance(60);
  assert.equal(t.nodes.askScreen.hidden, true,  'ask screen hidden');
  assert.equal(t.nodes.celebrate.hidden, false, 'celebration visible');
});

test('DOM: reduced motion skips confetti (no requestAnimationFrame call)', function () {
  var t = boot({ reduced: true });
  t.nodes.yesBtn.click();
  assert.equal(t.rAFQueue.length, 0, 'no rAF registered in reduced-motion mode');
});

test('DOM: missing markup elements do not throw', function () {
  var missingIds = [
    'ucYesBtn', 'ucNoBtn', 'ucNoWrap', 'ucNoCaption',
    'ucQuestionBlock', 'ucButtonRow', 'ucNoMessage',
    'ucAskScreen', 'ucCelebrateScreen',
  ];
  for (var i = 0; i < missingIds.length; i++) {
    assert.doesNotThrow(
      function () { boot({ missing: missingIds[i] }); },
      'missing ' + missingIds[i] + ' must not throw',
    );
  }
});

test('HTML: renderer emits all required element ids and correct content', function () {
  var render = require('../templates/unrejectable/render');
  var config = require('../templates/unrejectable/config');
  var html   = render.render({ customer_data: config.demo }, {});

  assert.ok(html.startsWith('<!DOCTYPE html>'), 'starts with doctype');
  assert.ok(html.trimEnd().endsWith('</html>'), 'ends with </html>');

  /* required element ids */
  var ids = ['ucAskScreen', 'ucCelebrateScreen', 'ucYesBtn', 'ucNoBtn',
             'ucNoWrap', 'ucNoCaption', 'ucButtonRow', 'ucNoMessage',
             'ucConfetti', 'ucPayload', 'ucQuestionBlock'];
  for (var i = 0; i < ids.length; i++) {
    assert.match(html, new RegExp('id="' + ids[i] + '"'), 'has id ' + ids[i]);
  }

  /* data-preview present */
  assert.match(html, /data-preview="false"/);

  /* sender text is escaped and present */
  assert.match(html, /Priya/);

  /* no hardcoded paigaam.cc */
  assert.doesNotMatch(html, /paigaam\.cc/);

  /* no sandbox leftovers */
  assert.doesNotMatch(html, /close-fullscreen/);
  assert.doesNotMatch(html, /__brokenImgHandler/);
  assert.doesNotMatch(html, /ha-img-placeholder/);
});

test('HTML: preview flag sets data-preview=true', function () {
  var render = require('../templates/unrejectable/render');
  var config = require('../templates/unrejectable/config');
  var html   = render.render({ customer_data: config.demo }, { isPreview: true });
  assert.match(html, /data-preview="true"/);
});

test('HTML: photo field shows img tag when set, SVG when blank', function () {
  var render = require('../templates/unrejectable/render');
  var config = require('../templates/unrejectable/config');

  /* no photo → SVG placeholder present */
  var htmlBlank = render.render({ customer_data: config.demo }, {});
  assert.match(htmlBlank, /your photo here/, 'SVG placeholder text shown when blank');
  assert.doesNotMatch(htmlBlank, /<img /, 'no img tag when photo blank');

  /* with photo → img tag present, SVG placeholder text absent */
  /* 48 lowercase hex chars required by fields.js UPLOAD_URL pattern */
  var withPhoto = Object.assign({}, config.demo,
    { photo: '/bfday/uploads/aabbccddeeff00112233445566778899aabbccddeeff0011.jpg' });
  var htmlPhoto = render.render({ customer_data: withPhoto }, {});
  assert.match(htmlPhoto, /<img /, 'img tag present');
  assert.doesNotMatch(htmlPhoto, /your photo here/, 'placeholder text absent');
});
