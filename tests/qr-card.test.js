'use strict';
// Run: node --test tests/qr-card.test.js
// Drives public/js/qr-card.js against a stub DOM + stub canvas, verifying the
// self-wiring button appears once the published link lands, and that the card
// renderer draws the branded keepsake (ground, double rule, logo, QR plate,
// link, tagline) without a browser.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'qr-card.js'), 'utf8');

function makeClassList() {
  const set = new Set();
  return { add: (...c) => c.forEach(x => set.add(x)), remove: (...c) => c.forEach(x => set.delete(x)), contains: c => set.has(c) };
}

function makeElement(tag = 'div') {
  const node = {
    tagName: tag.toUpperCase(),
    value: '', textContent: '', innerHTML: '', hidden: false, disabled: false, type: '', id: '', className: '', style: { cssText: '' },
    dataset: {},
    handlers: {},
    appended: [],
    addEventListener(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); },
    dispatch(type) { (this.handlers[type] || []).forEach(fn => fn({})); },
    appendChild(child) { this.appended.push(child); return child; },
    insertBefore(child, ref) { this.appended.push(child); return child; },
    remove() {},
    click() { this.clicked = true; },
    closest() { return null; },
    querySelector() { return null; },
    setAttribute(n, v) { this[n] = v; },
  };
  node.classList = makeClassList();
  return node;
}

function makeCanvasCtx() {
  const calls = [];
  return {
    calls,
    fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: '', font: '',
    fillRect(...a) { calls.push(['fillRect', ...a]); },
    strokeRect(...a) { calls.push(['strokeRect', ...a]); },
    drawImage(...a) { calls.push(['drawImage', ...a]); },
    fillText(t, ...a) { calls.push(['fillText', t, ...a]); },
    beginPath() { calls.push(['beginPath']); },
    closePath() { calls.push(['closePath']); },
    moveTo(...a) { calls.push(['moveTo', ...a]); },
    arcTo(...a) { calls.push(['arcTo', ...a]); },
    fill() { calls.push(['fill']); },
    stroke() { calls.push(['stroke']); },
  };
}

/** Boot qr-card.js in a stub environment. Returns the sandbox + helpers. */
function boot({ withPublishedInput } = {}) {
  const publishedInput = makeElement('input');
  publishedInput.id = 'publishedUrl';
  const registry = { publishedUrl: publishedInput };
  const document = {
    readyState: 'complete',
    body: makeElement('body'),
    getElementById(id) { return registry[id] || null; },
    querySelector() { return null; },
    createElement(tag) {
      const el = makeElement(tag);
      // Register by id lazily — qr-card assigns ids AFTER createElement returns.
      Object.defineProperty(el, 'id', { set(v) { this.idValue = v; registry[v] = el; }, get() { return this.idValue; } });
      if (tag === 'canvas') {
        el.width = 0; el.height = 0;
        el.getContext = () => (el.__ctx = el.__ctx || makeCanvasCtx());
        el.toDataURL = () => 'data:image/png;base64,STUB';
      }
      if (tag === 'a') { Object.defineProperty(el, 'href', { set(v) { this.hrefValue = v; }, get() { return this.hrefValue; } }); }
      return el;
    },
    addEventListener() {},
  };
  const timers = [];
  const sandbox = {
    window: {},
    document,
    setInterval: fn => { timers.push(fn); return timers.length; },
    Promise, Image: null, fetch: null, btoa: s => Buffer.from(s, 'binary').toString('base64'), unescape, encodeURIComponent,
    Error, setTimeout: (fn) => { fn(); return 0; },
  };
  sandbox.window.PaigaamQrCard = undefined;
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox);
  return { sandbox, timers, publishedInput, document };
}

test('qr-card: boots quietly on pages without a published link', () => {
  const env = boot({ withPublishedInput: false });
  assert.equal(typeof env.sandbox.window.PaigaamQrCard.download, 'function');
  assert.equal(typeof env.sandbox.window.PaigaamQrCard.drawCard, 'function');
});

test('qr-card: the self-wiring button appears (once) when the link lands', () => {
  const env = boot({ withPublishedInput: true });
  // No button before the value exists.
  env.timers.forEach(fn => fn());
  assert.equal(env.document.body.appended.length, 0);
  // Publish → value lands → next tick injects the button.
  env.publishedInput.value = 'https://paigaam.cc/p/maafi-7760ca1d57cb6eab04';
  env.timers.forEach(fn => fn());
  assert.equal(env.document.body.appended.length, 1);
  const btn = env.document.body.appended[0];
  assert.equal(btn.id, 'paigaamQrDownload');
  assert.match(btn.textContent, /Download QR card/);
  // Ticks are idempotent — no duplicate buttons.
  env.timers.forEach(fn => fn());
  env.timers.forEach(fn => fn());
  assert.equal(env.document.body.appended.length, 1);
});

test('qr-card: download() renders the branded card and hands back a PNG', async () => {
  const env = boot({ withPublishedInput: false });
  const sandbox = env.sandbox;
  // Stub the two loaders: a 2:1 logo and a 1:1 QR.
  sandbox.window.PaigaamQrCard = undefined; // reset module state
  vm.runInContext(SOURCE, sandbox); // re-boots? no — guarded. Use fresh sandbox:
  const fresh = boot({ withPublishedInput: false });
  fresh.sandbox.Image = function () {
    return { set src(v) { this.onload && this.onload(); }, height: 100, width: 400 };
  };
  fresh.sandbox.fetch = () => Promise.resolve({
    ok: true,
    text: () => Promise.resolve('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>'),
  });
  const name = await fresh.sandbox.window.PaigaamQrCard.download('https://paigaam.cc/p/maafi-7760ca1d57cb6eab04');
  assert.equal(name, 'paigaam-qr-maafi-7760ca1d57cb6eab04.png');
  const link = fresh.document.body.appended.find(n => n.tagName === 'A');
  assert.ok(link, 'anchor created');
  assert.equal(link.download, 'paigaam-qr-maafi-7760ca1d57cb6eab04.png');
  assert.match(link.href, /^data:image\/png;base64,/);
});

test('qr-card: the card draws ground, double rule, logo, caption, QR plate, link and tagline', async () => {
  const fresh = boot({ withPublishedInput: false });
  fresh.sandbox.Image = function () {
    return { set src(v) { this.onload && this.onload(); }, height: 100, width: 400 };
  };
  fresh.sandbox.fetch = () => Promise.resolve({
    ok: true,
    text: () => Promise.resolve('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>'),
  });
  const canvas = await fresh.sandbox.window.PaigaamQrCard.drawCard.call(
    null, { height: 100, width: 400 }, { height: 100, width: 100 }, 'https://paigaam.cc/p/maafi-test'
  );
  const calls = canvas.__ctx.calls;
  const kinds = calls.map(c => c[0]);
  // ground
  assert.ok(kinds.filter(k => k === 'fillRect').length >= 1, 'ground filled');
  // double rule = two strokeRects
  assert.ok(kinds.filter(k => k === 'strokeRect').length >= 2, 'double rule');
  // logo + qr
  assert.ok(kinds.filter(k => k === 'drawImage').length >= 2, 'logo and QR drawn');
  const texts = calls.filter(c => c[0] === 'fillText').map(c => c[1]);
  assert.ok(texts.some(t => /Scan to open/.test(t)), 'caption line 1');
  assert.ok(texts.some(t => /your Paigaam/.test(t)), 'caption line 2');
  assert.ok(texts.some(t => /paigaam\.cc\/p\/maafi-test/.test(t)), 'short link');
  assert.ok(texts.some(t => /Because some things deserve more/.test(t)), 'tagline');
  // plate = a rounded rect (beginPath + arcTo + fill)
  assert.ok(kinds.includes('arcTo'), 'rounded plate path');
});
