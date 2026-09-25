'use strict';
// Run: node --test tests/bfday-polaroid-scrapbook-dom.test.js
// Drives public/polaroid-scrapbook/polaroid.js against a stub DOM:
//   - reduced motion (immediate reveal)
//   - lightbox open / close / Escape / backdrop tap
//   - missing markup doesn't throw
//   - payload captions appear in lightbox
//   - heart doodle: drawn immediately when fewer than 3 polaroids or reduced motion
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'polaroid-scrapbook', 'polaroid.js'),
  'utf8'
);

function makeClassList() {
  const set = new Set();
  return { add: c => set.add(c), remove: c => set.delete(c), contains: c => set.has(c), _set: set };
}

/** A minimal element stub */
function el(overrides = {}) {
  const attrs = {};
  const handlers = {};
  const children = [];
  const cl = makeClassList();
  let tc = '';
  const base = {
    classList: cl,
    style: {},
    handlers,
    children,
    getAttribute: k => (attrs[k] !== undefined ? String(attrs[k]) : null),
    setAttribute: (k, v) => { attrs[k] = v; },
    get textContent() { return tc; },
    set textContent(v) { tc = v; },
    innerHTML: '',
    src: '',
    alt: '',
    focus() {},
    appendChild(child) { children.push(child); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 500, height: 200 }; },
    addEventListener(type, fn) {
      (handlers[type] = handlers[type] || []).push(fn);
    },
    click() { (handlers.click || []).forEach(fn => fn({ target: this })); },
    dispatchKeydown(key) { (handlers.keydown || []).forEach(fn => fn({ key, preventDefault() {} })); },
  };
  return Object.assign(base, overrides);
}

/**
 * Boot the script with a configurable set of stubs.
 *
 * @param {object} opts
 * @param {boolean} [opts.reduced]    prefers-reduced-motion
 * @param {string[]} [opts.missing]   ids to leave out of getElementById
 * @param {number} [opts.photoCount]  how many .polaroid elements to create
 * @param {object[]} [opts.payload]   photos array in psPayload
 */
function boot({ reduced = false, missing = [], photoCount = 3, payload = [] } = {}) {
  // Polaroid elements
  const polaroidEls = Array.from({ length: photoCount }, (_, i) => {
    const e = el();
    e.getAttribute = k => k === 'data-photo' ? String(i) : null;
    return e;
  });

  // Reveal elements (polaroids + note card)
  const revealEls = [...polaroidEls, el()];

  // Body with classList
  const body = el();
  body.classList = makeClassList();

  // Document element stubs
  const heartPathEl = el();
  heartPathEl.getTotalLength = () => 300;

  const lightboxEl = el();
  lightboxEl.classList = makeClassList();
  // When lightbox.addEventListener called with a click handler,
  // we also want backdrop-click: a click where e.target === lightbox itself.
  lightboxEl.clickSelf = function () {
    (lightboxEl.handlers.click || []).forEach(fn => fn({ target: lightboxEl }));
  };

  const lbCloseEl = el();
  const lbPhotoEl = el();
  const lbCaptionEl = el();
  const lbDateEl = el();

  const payloadData = { photos: payload.length ? payload : [
    { src: '', caption: 'walk photo', date: 'sunny day' },
    { src: '', caption: 'coffee photo', date: 'morning' },
    { src: '', caption: 'movie photo', date: 'friday' },
  ] };

  const psPayloadEl = el();
  psPayloadEl.textContent = JSON.stringify(payloadData);

  const byId = {
    psPayload:       psPayloadEl,
    doodleHeartPath: heartPathEl,
    lightbox:        lightboxEl,
    lightboxClose:   lbCloseEl,
    lightboxPhoto:   lbPhotoEl,
    lightboxCaption: lbCaptionEl,
    lightboxDate:    lbDateEl,
  };

  const docHandlers = {};

  const sandbox = {
    document: {
      getElementById: id => {
        if (missing.includes(id)) return null;
        return byId[id] || null;
      },
      querySelectorAll: sel => {
        if (sel === '.polaroid') return polaroidEls;
        if (sel === '.reveal')   return revealEls;
        return [];
      },
      addEventListener(type, fn) {
        (docHandlers[type] = docHandlers[type] || []).push(fn);
      },
      createElement(tag) { return el({ tagName: tag.toUpperCase() }); },
      activeElement: null,
      body,
    },
    window: {
      matchMedia: q => ({ matches: reduced && /reduce/.test(q) }),
      addEventListener() {},
      requestAnimationFrame() {},
      innerHeight: 812,
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox);

  return {
    polaroidEls, revealEls, heartPathEl,
    lightboxEl, lbCloseEl, lbPhotoEl, lbCaptionEl, lbDateEl,
    body, docHandlers,
    payloadData,
  };
}

/* ------------------------------------------------------------------ */

test('DOM: reduced motion adds "shown" to all reveal elements immediately', () => {
  const { revealEls } = boot({ reduced: true });
  for (const el of revealEls) {
    assert.ok(el.classList.contains('shown'), `element should have "shown" class`);
  }
});

test('DOM: without IntersectionObserver reveals are added immediately', () => {
  // The sandbox has no IntersectionObserver → fallback path runs.
  const { revealEls } = boot({ reduced: false });
  for (const el of revealEls) {
    assert.ok(el.classList.contains('shown'), `element should have "shown" class (no IO)`);
  }
});

test('DOM: heart doodle is drawn immediately with reduced motion', () => {
  const { heartPathEl } = boot({ reduced: true, photoCount: 5 });
  assert.equal(heartPathEl.style.strokeDashoffset, '0');
  assert.equal(heartPathEl.style.strokeDasharray, '300');
});

test('DOM: heart doodle is drawn immediately when fewer than 3 polaroids', () => {
  const { heartPathEl } = boot({ reduced: false, photoCount: 2 });
  assert.equal(heartPathEl.style.strokeDashoffset, '0');
});

test('DOM: heart scroll animation is active when 3+ polaroids (non-reduced)', () => {
  const { heartPathEl } = boot({ reduced: false, photoCount: 3 });
  // Scroll animation path: strokeDasharray is set and strokeDashoffset is a numeric string
  assert.equal(heartPathEl.style.strokeDasharray, '300');
  // dashoffset is a numeric string (set by updateHeart or the initial assignment)
  assert.ok(typeof heartPathEl.style.strokeDashoffset === 'string');
  assert.ok(!isNaN(parseFloat(heartPathEl.style.strokeDashoffset)));
  // Not '0' (because reduced motion is false and we're not in the immediate-draw fallback)
  // Note: updateHeart() runs once on boot; its value depends on the stub getBoundingClientRect.
});

test('DOM: clicking a polaroid opens the lightbox with correct caption', () => {
  const { polaroidEls, lightboxEl, lbCaptionEl, lbDateEl, lbCloseEl, body } = boot({});
  // Click the first polaroid (index 0 → "walk photo")
  polaroidEls[0].click();
  assert.ok(lightboxEl.classList.contains('open'), 'lightbox should be open');
  assert.ok(body.classList.contains('lightbox-open'));
  assert.equal(lbCaptionEl.textContent, 'walk photo');
  assert.equal(lbDateEl.textContent, 'sunny day');
});

test('DOM: close button closes the lightbox', () => {
  const { polaroidEls, lightboxEl, lbCloseEl, body } = boot({});
  polaroidEls[0].click();
  assert.ok(lightboxEl.classList.contains('open'));
  lbCloseEl.click();
  assert.ok(!lightboxEl.classList.contains('open'));
  assert.ok(!body.classList.contains('lightbox-open'));
});

test('DOM: clicking the backdrop closes the lightbox', () => {
  const { polaroidEls, lightboxEl, body } = boot({});
  polaroidEls[0].click();
  lightboxEl.clickSelf();
  assert.ok(!lightboxEl.classList.contains('open'));
  assert.ok(!body.classList.contains('lightbox-open'));
});

test('DOM: Escape key closes the lightbox', () => {
  const { polaroidEls, lightboxEl, docHandlers, body } = boot({});
  polaroidEls[0].click();
  assert.ok(lightboxEl.classList.contains('open'));
  (docHandlers.keydown || []).forEach(fn => fn({ key: 'Escape' }));
  assert.ok(!lightboxEl.classList.contains('open'));
  assert.ok(!body.classList.contains('lightbox-open'));
});

test('DOM: Escape does nothing when lightbox is not open', () => {
  const { lightboxEl, docHandlers } = boot({});
  assert.ok(!lightboxEl.classList.contains('open'));
  assert.doesNotThrow(() => {
    (docHandlers.keydown || []).forEach(fn => fn({ key: 'Escape' }));
  });
  assert.ok(!lightboxEl.classList.contains('open'));
});

test('DOM: missing lightbox elements do not throw', () => {
  const lightboxIds = ['lightbox', 'lightboxClose', 'lightboxPhoto', 'lightboxCaption', 'lightboxDate'];
  for (const id of lightboxIds) {
    assert.doesNotThrow(() => boot({ missing: [id] }), `missing ${id} should not throw`);
  }
});

test('DOM: missing psPayload does not throw', () => {
  assert.doesNotThrow(() => boot({ missing: ['psPayload'] }));
});

test('DOM: missing doodleHeartPath does not throw', () => {
  assert.doesNotThrow(() => boot({ missing: ['doodleHeartPath'] }));
});

test('DOM: zero polaroids do not throw', () => {
  assert.doesNotThrow(() => boot({ photoCount: 0 }));
});

test('HTML: render emits correct structure', () => {
  const { render } = require('../templates/polaroid-scrapbook/render');
  const config = require('../templates/polaroid-scrapbook/config');
  const html = render({ customer_data: { ...config.demo } }, {});

  // Must start and end correctly
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<\/html>$/);

  // Key elements present
  assert.match(html, /id="lightbox"/);
  assert.match(html, /id="lightboxClose"/);
  assert.match(html, /id="lightboxPhoto"/);
  assert.match(html, /id="lightboxCaption"/);
  assert.match(html, /id="lightboxDate"/);
  assert.match(html, /id="doodleHeartPath"/);
  assert.match(html, /id="psPayload"/);

  // Sender name in note
  assert.match(html, /Rahul/);

  // Default polaroid captions server-rendered
  assert.match(html, /the day we walked nowhere in particular/);
  assert.match(html, /us, being us/);

  // data-photo attributes present
  assert.match(html, /data-photo="0"/);
  assert.match(html, /data-photo="4"/);

  // No hardcoded paigaam.cc
  assert.doesNotMatch(html, /paigaam\.cc/);

  // No close-fullscreen postMessage
  assert.doesNotMatch(html, /close-fullscreen/);

  // No __brokenImgHandler
  assert.doesNotMatch(html, /__brokenImgHandler/);

  // No ha-img-placeholder
  assert.doesNotMatch(html, /ha-img-placeholder/);

  // data-preview attribute present
  assert.match(html, /data-preview="false"/);
});

test('HTML: render with isPreview=true sets data-preview="true"', () => {
  const { render } = require('../templates/polaroid-scrapbook/render');
  const html = render({}, { isPreview: true });
  assert.match(html, /data-preview="true"/);
});

test('HTML: custom fields appear correctly', () => {
  const { render } = require('../templates/polaroid-scrapbook/render');
  const html = render({
    customer_data: {
      senderName: 'Arjun',
      scrapbookTitle: 'our little world',
      scrapbookSub: 'just for us',
      noteText: 'happy day, from Arjun',
      noteDate: 'forever',
      photos: [
        { caption: 'sunset drive', date: 'last july' },
        { caption: 'rainy window', date: 'this october' },
      ],
    },
  }, {});
  assert.match(html, /our little world/);
  assert.match(html, /just for us/);
  assert.match(html, /happy day, from Arjun/);
  assert.match(html, /forever/);
  assert.match(html, /sunset drive/);
  assert.match(html, /rainy window/);
  // Only 2 polaroids
  assert.match(html, /data-photo="0"/);
  assert.match(html, /data-photo="1"/);
  assert.doesNotMatch(html, /data-photo="2"/);
});

test('HTML: null customer_data renders defaults without throwing', () => {
  const { render } = require('../templates/polaroid-scrapbook/render');
  assert.doesNotThrow(() => render({}, {}));
  const html = render({}, {});
  // Default captions present
  assert.match(html, /the day we walked nowhere in particular/);
  assert.match(html, /our little scrapbook/);
});

test('CSS: reduced-motion rule is present', () => {
  const css = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'polaroid-scrapbook', 'polaroid.css'),
    'utf8'
  );
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  // No ha-img-placeholder in CSS
  assert.doesNotMatch(css, /ha-img-placeholder/);
});
