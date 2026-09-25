'use strict';
// Run: node --test tests/bfday-our-wrapped-dom.test.js
// Drives public/our-wrapped/wrapped.js against a stub DOM on a virtual clock.
// Tests: dot creation, count-up timing, reduced motion (instant), skip-to-end,
// IO-observer activation, no-IO fallback, and missing markup doesn't throw.
const { test } = require('node:test');
const assert   = require('node:assert/strict');
const fs       = require('node:fs');
const path     = require('node:path');
const vm       = require('node:vm');

const SOURCE = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'our-wrapped', 'wrapped.js'),
  'utf8',
);

/* ---- Minimal stub DOM helpers ---- */

function makeEl(id) {
  const cls = new Set();
  const handlers = {};
  const attrs = {};
  return {
    id,
    scrollIntoViewArgs: null,
    _attrs: attrs,
    dataset: {},
    getAttribute(attr) { return attrs[attr] != null ? String(attrs[attr]) : null; },
    setAttribute(attr, val) { attrs[attr] = val; },
    classList: {
      add:    c => cls.add(c),
      remove: c => cls.delete(c),
      toggle(c, force) { force ? cls.add(c) : cls.delete(c); },
      contains: c => cls.has(c),
    },
    addEventListener(type, fn) { (handlers[type] = handlers[type] || []).push(fn); },
    _fire(type, arg) { (handlers[type] || []).forEach(fn => fn(arg || {})); },
    scrollIntoView(opts) { this.scrollIntoViewArgs = opts; },
    textContent: '',
    children: [],
    appendChild(child) { this.children.push(child); },
    querySelectorAll(sel) {
      if (sel === '.screen') return this._screens || [];
      return [];
    },
    querySelector(sel) {
      if (sel === '.stat-num') return this._statNum || null;
      return null;
    },
  };
}

let _ioCallback = null;
let _ioRoot = null;

function boot({ reduced = false, noIO = false, screenCount = 3, statCount = null } = {}) {
  const deck     = makeEl('deck');
  const dotsWrap = makeEl('dots');
  const skipBtn  = makeEl('skipToEnd');

  /* Build fake screens */
  const screens = Array.from({ length: screenCount }, (_, i) => {
    const s = makeEl('screen-' + i);
    if (statCount !== null && i === 0) {
      const num = makeEl('stat-num-' + i);
      num._attrs['data-count'] = statCount;
      s._statNum = num;
    }
    return s;
  });
  deck._screens = screens;

  const rafs = [];
  const clock = { now: 0, queue: [] };

  const sandbox = {
    document: {
      getElementById(id) {
        if (id === 'deck')      return deck;
        if (id === 'dots')      return dotsWrap;
        if (id === 'skipToEnd') return skipBtn;
        return null;
      },
      createElement(tag) {
        const el = makeEl('created-' + tag);
        el._tag = tag;
        return el;
      },
    },
    window: {
      matchMedia: q => ({ matches: reduced && /reduce/.test(q) }),
    },
    WeakSet,
    IntersectionObserver: noIO ? undefined : class MockIO {
      constructor(cb, opts) {
        _ioCallback = cb;
        _ioRoot     = opts && opts.root;
      }
      observe() {}
    },
    requestAnimationFrame(fn) { rafs.push(fn); },
    setTimeout(fn, ms)        { clock.queue.push({ at: clock.now + ms, fn }); },
  };

  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox);

  function flushRAF(timestamp) {
    const q = rafs.splice(0);
    q.forEach(fn => fn(timestamp));
  }

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

  return { deck, dotsWrap, skipBtn, screens, rafs, flushRAF, advance };
}

/* ---- Tests ---- */

test('DOM: progress dots are created for each screen', () => {
  const { dotsWrap, screens } = boot({ screenCount: 5 });
  assert.equal(dotsWrap.children.length, screens.length, 'one dot per screen');
  // Each dot should have aria-label
  const first = dotsWrap.children[0];
  assert.ok(first.getAttribute && first.getAttribute('aria-label'), 'dot has aria-label');
});

test('DOM: IntersectionObserver fires .active and count-up on first intersection', () => {
  const { screens, rafs, flushRAF } = boot({ screenCount: 3, statCount: 500 });
  assert.ok(_ioCallback, 'IO callback registered');

  // Trigger intersection on screen 0
  _ioCallback([{ isIntersecting: true, target: screens[0] }]);
  assert.ok(screens[0].classList.contains('active'), 'screen gets .active');

  // count-up: first RAF queued
  assert.ok(rafs.length > 0, 'count-up RAF queued');
  flushRAF(0);    // start=0, t=0 → val=0
  flushRAF(800);  // halfway
  flushRAF(1600); // complete → textContent should be "500"
  assert.equal(screens[0]._statNum.textContent, '500');
});

test('DOM: count-up fires only once per stat-num', () => {
  const { screens, rafs } = boot({ screenCount: 3, statCount: 100 });
  _ioCallback([{ isIntersecting: true, target: screens[0] }]);
  const rafsBefore = rafs.length;
  _ioCallback([{ isIntersecting: true, target: screens[0] }]); // again
  assert.equal(rafs.length, rafsBefore, 'no second count-up queued');
});

test('DOM: reduced motion sets count instantly (no RAF)', () => {
  const { screens, rafs } = boot({ reduced: true, statCount: 42 });
  _ioCallback([{ isIntersecting: true, target: screens[0] }]);
  assert.equal(rafs.length, 0, 'no RAF in reduced motion');
  assert.equal(screens[0]._statNum.textContent, '42');
});

test('DOM: skip-to-end calls scrollIntoView on the last screen', () => {
  const { skipBtn, screens } = boot({ screenCount: 4 });
  skipBtn._fire('click');
  const last = screens[screens.length - 1];
  assert.ok(last.scrollIntoViewArgs, 'scrollIntoView called on last screen');
  assert.equal(last.scrollIntoViewArgs.block, 'start');
});

test('DOM: skip-to-end uses "auto" behavior in reduced motion', () => {
  const { skipBtn, screens } = boot({ reduced: true, screenCount: 3 });
  skipBtn._fire('click');
  const last = screens[screens.length - 1];
  assert.equal(last.scrollIntoViewArgs.behavior, 'auto');
});

test('DOM: no-IO fallback activates all screens immediately', () => {
  const { screens } = boot({ noIO: true, screenCount: 3, statCount: 7 });
  screens.forEach(s => {
    assert.ok(s.classList.contains('active'), 'screen ' + s.id + ' active');
  });
  // Stat num on screen 0 should be set
  assert.equal(screens[0]._statNum.textContent, '7');
});

test('DOM: missing deck or dots does not throw', () => {
  // Override getElementById to return null for deck
  const SOURCE_LOCAL = SOURCE;
  const sandbox = {
    document: { getElementById: () => null, createElement: () => makeEl('x') },
    window: { matchMedia: () => ({ matches: false }) },
    WeakSet,
    IntersectionObserver: class { constructor() {} observe() {} },
    requestAnimationFrame() {},
    setTimeout() {},
  };
  vm.createContext(sandbox);
  assert.doesNotThrow(() => vm.runInContext(SOURCE_LOCAL, sandbox));
});

test('HTML: render emits required elements and valid data-count attributes', () => {
  const { render } = require('../templates/our-wrapped/render');
  const config     = require('../templates/our-wrapped/config');

  const html = render({ customer_data: config.demo }, {});
  assert.match(html, /<!DOCTYPE html>/i);
  assert.match(html, /id="deck"/);
  assert.match(html, /id="dots"/);
  assert.match(html, /id="skipToEnd"/);
  assert.match(html, /id="s1"/);
  assert.match(html, /id="s-song"/);
  assert.match(html, /id="s-close"/);

  // data-count attributes must be non-negative integers
  const counts = [...html.matchAll(/data-count="(\d+)"/g)].map(m => Number(m[1]));
  assert.ok(counts.length >= 2, 'at least title days + one moment count');
  counts.forEach(c => assert.ok(c >= 0, 'data-count is non-negative'));

  // No hardcoded paigaam.cc
  assert.doesNotMatch(html, /paigaam\.cc/, 'no hardcoded paigaam.cc');

  // No hosting-sandbox injections
  assert.doesNotMatch(html, /ha-img-placeholder/, 'no ha-img-placeholder');
  assert.doesNotMatch(html, /__brokenImgHandler/, 'no brokenImgHandler');
  assert.doesNotMatch(html, /close-fullscreen/, 'no close-fullscreen postMessage');

  // Play link/embed absent when songUrl is blank
  const htmlBlank = render({ customer_data: { ...config.demo, songUrl: '' } }, {});
  assert.doesNotMatch(htmlBlank, /play-link/, 'no play-link when songUrl is empty');
  assert.doesNotMatch(htmlBlank, /song-embed/, 'no embed when songUrl is empty');

  // The shipped demo is a YouTube link → inline embed, no play link
  const htmlYt = render({ customer_data: config.demo }, {});
  assert.match(htmlYt, /class="song-embed"/, 'YouTube link renders the embed');
  assert.match(htmlYt, /youtube-nocookie\.com\/embed\/hxMNYkLN7tI/, 'embed carries the video ID');
  assert.doesNotMatch(htmlYt, /play-link/, 'no play-link alongside the embed');
  assert.doesNotMatch(htmlYt, /autoplay=1|autoplay;/, 'embed never autoplays');

  // youtu.be short links → embed too
  const htmlShort = render({ customer_data: { ...config.demo, songUrl: 'https://youtu.be/hxMNYkLN7tI' } }, {});
  assert.match(htmlShort, /youtube-nocookie\.com\/embed\/hxMNYkLN7tI/, 'youtu.be link renders the embed');

  // Spotify link → branded play link
  const html2 = render({ customer_data: { ...config.demo, songUrl: 'https://open.spotify.com/track/abc' } }, {});
  assert.match(html2, /class="play-link svc-spotify"/, 'branded play-link when songUrl is a Spotify link');
  assert.match(html2, /open\.spotify\.com/, 'song URL in the link');
  assert.match(html2, /Play in Spotify/, 'platform named on the button');
  assert.doesNotMatch(html2, /song-embed/, 'no embed for Spotify links');

  // Apple Music link → branded play link
  const html3 = render({ customer_data: { ...config.demo, songUrl: 'https://music.apple.com/in/album/x/123' } }, {});
  assert.match(html3, /class="play-link svc-apple"/, 'branded play-link for Apple Music');
  assert.match(html3, /Play in Apple Music/, 'Apple Music named on the button');
});

test('HTML: bfday wizard emits dark-theme contrast override for Naghma only', () => {
  const { bfdayCreatePage } = require('../pages/bfdayCreate');
  const family = require('../lib/bfday/family');
  const bySlug = Object.fromEntries(family.list.map(t => [t.slug, t]));

  const dark = bfdayCreatePage(bySlug['our-wrapped']);
  assert.match(dark, /\.paper, dialog#previewDialog \{\s*--ink: #2B2118;/, 'paper text re-scoped dark');
  assert.match(dark, /--accent-ondark: #B4A9E0/, 'accent brightened for the dark page bg');

  for (const slug of ['sealed-with-a-kiss', 'polaroid-scrapbook', 'scratch-reasons', 'unrejectable', 'know-us-quiz']) {
    const html = bfdayCreatePage(bySlug[slug]);
    assert.doesNotMatch(html, /accent-ondark/, slug + ' (light theme) gets no override');
  }
});

test('HTML: names appear on the closing card', () => {
  const { render } = require('../templates/our-wrapped/render');
  const html = render({ customer_data: { senderName: 'Zaid', recipientName: 'Nadia' } }, {});
  assert.match(html, /Zaid/);
  assert.match(html, /Nadia/);
});

test('HTML: null/junk customer_data does not throw', () => {
  const { render } = require('../templates/our-wrapped/render');
  assert.doesNotThrow(() => render(null, {}));
  assert.doesNotThrow(() => render({ customer_data: null }, {}));
  assert.doesNotThrow(() => render({ customer_data: { moments: 'bad', daysTogether: 'nope' } }, {}));
  assert.doesNotThrow(() => render({ customer_data: { moments: [] } }, {}));
});
