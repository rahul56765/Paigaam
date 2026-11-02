'use strict';
// Run: node --test tests/divya-vivah-runtime.test.js
// No browser/dependencies: execute the shipped script against renderer-derived markup,
// a deterministic clock, promise-based media, RAF, and IntersectionObserver stubs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const config = require('../templates/divya-vivah/config');
const renderer = require('../templates/divya-vivah/render');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'public/divya-vivah/invite.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/divya-vivah/invite.css'), 'utf8');

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    emit(type, event = {}) {
      return Promise.all((listeners.get(type) || []).map(fn => fn(event)));
    },
  };
}

function boot({ now = '2026-05-25T00:00:00Z', customer = {}, reduced = false,
  observer = true, play = () => Promise.resolve(), preview = false, search = '', language = 'mr', demo = true } = {}) {
  const html = renderer.renderDivya({ customer_data: { ...(demo ? config.demo : {}), ...customer } }, { isPreview: preview });
  let clock = Date.parse(now), nextId = 0;
  const origin = clock, timers = new Map(), frames = new Map(), observations = [];
  const elements = [];
  const unescape = text => text.replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  // Parse opening tags rather than invent IDs, state, or data attributes absent in HTML.
  for (const match of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
    const attrs = {};
    for (const attr of match[2].matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      attrs[attr[1]] = unescape(attr[2] ?? attr[3] ?? attr[4] ?? '');
    }
    const classes = new Set((attrs.class || '').split(/\s+/).filter(Boolean));
    const element = Object.assign(eventTarget(), {
      tagName: match[1].toUpperCase(), attrs, style: {},
      textContent: unescape(html.slice(match.index + match[0].length, html.indexOf('</' + match[1], match.index + match[0].length)).replace(/<[^>]*>/g, '')),
      open: Object.hasOwn(attrs, 'open'), showModalCalls: 0, closeCalls: 0,
      showModal() { this.open = true; this.attrs.open = ''; this.showModalCalls++; },
      close() { this.open = false; delete this.attrs.open; this.closeCalls++; },
      hidden: Object.hasOwn(attrs, 'hidden'), inert: Object.hasOwn(attrs, 'inert'),
      disabled: Object.hasOwn(attrs, 'disabled'), dataset: {},
      clientWidth: 300, scrollWidth: 200, clientHeight: 100, scrollHeight: 50,
      classList: { add: (...names) => names.forEach(n => classes.add(n)),
        remove: (...names) => names.forEach(n => classes.delete(n)), contains: n => classes.has(n) },
      getAttribute: name => Object.hasOwn(attrs, name) ? attrs[name] : null,
      setAttribute: (name, value) => { attrs[name] = String(value); },
      focus(options) { document.activeElement = this; this.focusOptions = options; },
    });
    for (const [name, value] of Object.entries(attrs)) {
      if (name.startsWith('data-')) element.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    }
    // iframe.src initially has no URL. Count assignments (network-load intent).
    let src = attrs.src || '';
    element.srcWrites = [];
    Object.defineProperty(element, 'src', { get: () => src, set(value) { src = String(value); this.srcWrites.push(src); } });
    Object.defineProperty(element, 'lang', { get: () => attrs.lang || '', set: value => { attrs.lang = String(value); } });
    elements.push(element);
  }
  function matches(element, selector) {
    if (selector.startsWith('#')) return element.attrs.id === selector.slice(1);
    if (selector.startsWith('.')) return element.classList.contains(selector.slice(1));
    const attr = selector.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
    if (attr) return Object.hasOwn(element.attrs, attr[1]) && (attr[2] === undefined || element.attrs[attr[1]] === attr[2]);
    return element.tagName.toLowerCase() === selector;
  }
  const document = Object.assign(eventTarget(), {
    querySelector: selector => elements.find(el => matches(el, selector)) || null,
    querySelectorAll: selector => elements.filter(el => matches(el, selector)),
    documentElement: elements.find(el => el.tagName === 'HTML'),
    body: elements.find(el => el.tagName === 'BODY'), activeElement: null,
    fonts: { ready: Promise.resolve() },
  });
  const $ = selector => {
    const element = document.querySelector(selector);
    assert.ok(element, `renderer must supply ${selector}`);
    return element;
  };
  $('#dv-data').textContent = html.match(/<script\b[^>]*id="dv-data"[^>]*>([\s\S]*?)<\/script>/)[1];
  const video = $('#dv-video');
  Object.assign(video, { currentTime: 0, volume: 1, muted: Object.hasOwn(video.attrs, 'muted'), paused: true,
    playCalls: 0, pauseCalls: 0,
    play() { this.playCalls++; return Promise.resolve().then(() => play(this.playCalls)).then(() => { this.paused = false; }); },
    pause() { this.pauseCalls++; this.paused = true; },
  });
  class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  function schedule(fn, delay, interval = false) {
    const id = ++nextId;
    timers.set(id, { fn, at: clock + delay, interval: interval ? delay : 0 });
    return id;
  }
  const window = Object.assign(eventTarget(), {
    setTimeout: (fn, delay) => schedule(fn, delay), clearTimeout: id => timers.delete(id),
    setInterval: (fn, delay) => schedule(fn, delay, true), clearInterval: id => timers.delete(id),
    requestAnimationFrame: fn => { const id = ++nextId; frames.set(id, fn); return id; },
    matchMedia: () => ({ matches: reduced }),
    scrollCalls: [], scrollTo(options) { this.scrollCalls.push(options); },
  });
  if (observer) window.IntersectionObserver = class {
    constructor(callback, options) { this.callback = callback; this.options = options; this.targets = []; this.disconnected = false; observations.push(this); }
    observe(el) { this.targets.push(el); }
    disconnect() { this.disconnected = true; }
    intersect(isIntersecting) { this.callback(this.targets.map(target => ({ target, isIntersecting }))); }
  };
  const sandbox = { window, document, Date: FakeDate, Intl, URLSearchParams, location: { search },
    matchMedia: window.matchMedia, requestAnimationFrame: window.requestAnimationFrame,
    clearTimeout: window.clearTimeout, clearInterval: window.clearInterval,
    performance: { now: () => clock - origin }, getComputedStyle: () => ({ fontSize: '32px' }),
    ...(observer ? { IntersectionObserver: window.IntersectionObserver } : {}),
  };
  vm.runInNewContext(source, sandbox, { filename: 'public/divya-vivah/invite.js', timeout: 1000 });
  // Let the real shipped script present its chooser before selecting a language.
  if (language !== null) $('[data-language="' + language + '"]').emit('click');
  function raf() {
    const pending = [...frames.values()]; frames.clear();
    for (const fn of pending) fn(clock - origin);
  }
  function advance(ms) {
    const end = clock + ms;
    for (;;) {
      const due = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      const [id, timer] = due; clock = timer.at;
      if (timer.interval) timer.at += timer.interval; else timers.delete(id);
      timer.fn(); raf();
    }
    clock = end; raf();
  }
  const units = () => Object.fromEntries(document.querySelectorAll('[data-unit]').map(el => [el.dataset.unit, el.textContent]));
  return { $, html, document, window, video, observations, advance, raf, units,
    click: selector => $(selector).emit('click'),
    async key(key) {
      const event = { key, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
      await document.emit('keydown', event); return event;
    },
    async cancelLanguage() {
      const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
      await $('#dv-language').emit('cancel', event);
      if (!event.defaultPrevented) $('#dv-language').close();
      return event;
    } };
}

function assertOpened(h) {
  assert.equal(h.$('#dv-gate').hidden, true);
  assert.equal(h.$('#dv-gate').style.display, 'none');
  assert.equal(h.$('#dv-main').inert, false);
  assert.equal(h.$('#dv-main').classList.contains('is-visible'), true);
  assert.equal(h.document.documentElement.style.overflow, '');
  assert.equal(h.document.body.style.overflow, '');
  assert.equal(h.video.paused, true);
  assert.equal(h.video.muted, true);
  assert.equal(h.document.activeElement, h.$('#dv-invitation'));
}

// Export only for subprocess probes: separate processes give genuine visitor TZs.
module.exports = { boot };
if (require.main === module && process.env.DIVYA_RUNTIME_PROBE !== '1') {
  test('initial render stays gated, without autoplay, playback, or a map request', () => {
    const h = boot();
    assert.equal(h.video.getAttribute('autoplay'), null);
    assert.equal(h.video.playCalls, 0);
    assert.equal(h.video.paused, true);
    assert.equal(h.$('#dv-main').inert, true);
    assert.equal(h.$('#dv-gate').hidden, false);
    assert.equal(h.document.documentElement.style.overflow, 'hidden');
    assert.equal(h.$('#dv-skip').hidden, true);
    assert.equal(h.$('#dv-map').getAttribute('src'), null);
    assert.equal(h.$('#dv-map').getAttribute('loading'), 'lazy');
    assert.equal(h.$('#dv-map').src, '');
    assert.equal(h.observations.length, 0);
    h.advance(30000);
    assert.equal(h.video.playCalls, 0);
    assert.equal(h.$('#dv-map').srcWrites.length, 0);
  });

  test('one user click plays; rapid duplicate clicks do not restart playback', async () => {
    const h = boot();
    await Promise.all([h.click('#dv-open'), h.click('#dv-open'), h.click('#dv-open')]);
    assert.equal(h.video.playCalls, 1);
    assert.equal(h.video.paused, false);
    assert.equal(h.$('#dv-open').disabled, true);
    assert.equal(h.$('#dv-skip').hidden, false);
    assert.equal(h.$('#dv-gate').classList.contains('is-playing'), true);
    await h.click('#dv-open');
    assert.equal(h.video.playCalls, 1);
  });

  test('9.05-second cue brightens first, then fades audio and unlocks the invitation', async () => {
    const h = boot();
    await h.click('#dv-open');
    h.video.currentTime = 9.049; await h.video.emit('timeupdate');
    assert.equal(h.$('#dv-glow').classList.contains('is-bright'), false);
    h.video.currentTime = 9.05; await h.video.emit('timeupdate');
    assert.equal(h.$('#dv-glow').classList.contains('is-bright'), true);
    assert.equal(h.$('#dv-main').inert, true);
    h.advance(425);
    assert.ok(h.video.volume > 0 && h.video.volume < 1);
    // A repeated cue must not restart the reveal timer.
    await h.video.emit('timeupdate');
    h.advance(474);
    assert.equal(h.$('#dv-main').inert, true);
    h.advance(1);
    assertOpened(h);
    assert.equal(h.video.pauseCalls, 1);
    h.raf(); h.raf();
    assert.equal(h.$('#dv-glow').classList.contains('is-bright'), false);
    assert.equal(h.$('#dv-glow').classList.contains('is-fading'), true);
    h.advance(1800);
    assert.equal(h.$('#dv-glow').style.display, 'none');
    await h.video.emit('timeupdate'); await h.click('#dv-open');
    assert.equal(h.video.playCalls, 1);
    assert.equal(h.video.pauseCalls, 1);
  });

  for (const fallback of ['skip', 'Escape', 'ended']) {
    test(`${fallback} bypasses a stalled or short video and releases the guest`, async () => {
      const h = boot();
      if (fallback !== 'Escape') await h.click('#dv-open');
      if (fallback === 'skip') await h.click('#dv-skip');
      else if (fallback === 'Escape') await h.key('Escape');
      else await h.video.emit('ended');
      assert.equal(h.$('#dv-glow').classList.contains('is-bright'), true);
      h.advance(900); assertOpened(h);
    });
  }

  test('first rejected play retries muted; two rejections expose usable fallback controls', async () => {
    const retry = boot({ play: call => call === 1 ? Promise.reject(new Error('audio denied')) : Promise.resolve() });
    await retry.click('#dv-open');
    assert.equal(retry.video.playCalls, 2);
    assert.equal(retry.video.muted, true);
    assert.equal(retry.video.paused, false);
    const h = boot({ play: () => Promise.reject(new Error('media unavailable')) });
    await h.click('#dv-open');
    assert.equal(h.video.playCalls, 2);
    assert.ok(h.$('#dv-video-status').textContent.trim());
    assert.equal(h.$('#dv-skip').hidden, false);
    assert.equal(h.$('#dv-open').disabled, false);
    assert.equal(h.$('#dv-gate').classList.contains('is-playing'), false);
    await h.click('#dv-open'); h.advance(900); assertOpened(h);
    assert.equal(h.video.playCalls, 2, 'fallback opens invitation instead of retrying forever');
  });

  test('media error and long buffering leave a direct route to the invitation', async () => {
    const h = boot();
    await h.click('#dv-open');
    await h.video.emit('waiting');
    assert.ok(h.$('#dv-video-status').textContent);
    h.advance(15000);
    assert.ok(h.$('#dv-video-status').textContent);
    assert.equal(h.$('#dv-skip').hidden, false);
    await h.video.emit('error');
    assert.equal(h.$('#dv-open').disabled, false);
    await h.click('#dv-skip'); h.advance(900); assertOpened(h);
  });

  test('reduced motion opens without ever playing video and shortens the reveal', async () => {
    const h = boot({ reduced: true });
    await h.click('#dv-open');
    assert.equal(h.video.playCalls, 0);
    assert.equal(h.$('#dv-glow').classList.contains('is-bright'), true);
    h.advance(119); assert.equal(h.$('#dv-main').inert, true);
    h.advance(1); assertOpened(h);
    h.advance(120); assert.equal(h.$('#dv-glow').style.display, 'none');
    assert.equal(h.video.playCalls, 0);
  });

  test('map waits until reveal AND intersection, then loads its renderer-provided URL once', async () => {
    const h = boot();
    const map = h.$('#dv-map');
    await h.click('#dv-open');
    assert.equal(map.src, '');
    await h.click('#dv-skip'); h.advance(899);
    assert.equal(map.src, '');
    h.advance(1);
    assert.equal(h.observations.length, 1);
    const io = h.observations[0];
    assert.ok(io.targets.includes(h.$('#dv-details')));
    assert.equal(map.src, '');
    io.intersect(false); assert.equal(map.src, '');
    io.intersect(true);
    assert.equal(map.src, map.dataset.src);
    assert.match(map.src, /^https:\/\/www\.google\.com\/maps\?/);
    assert.equal(io.disconnected, true);
    io.intersect(true); assert.equal(map.srcWrites.length, 1);
  });

  test('without IntersectionObserver map still waits for opening', async () => {
    const h = boot({ observer: false });
    assert.equal(h.$('#dv-map').src, '');
    await h.key('Escape'); h.advance(900);
    assert.equal(h.$('#dv-map').src, h.$('#dv-map').dataset.src);
  });

  test('original 2026 sample stays past, clamped to zero, with after-wedding copy', () => {
    const h = boot();
    assert.equal(config.demo.weddingDate, '2026-05-24');
    assert.deepEqual(h.units(), { days: '००', hours: '००', minutes: '००', seconds: '००' });
    assert.equal(h.$('#dv-count-status').textContent, config.demo.afterWeddingMessage);
    h.advance(10000);
    assert.deepEqual(h.units(), { days: '००', hours: '००', minutes: '००', seconds: '००' });
    assert.match(h.$('.dv-target').textContent, /भारतीय प्रमाणवेळ \(UTC\+०५:३०\)$/);
  });

  test('test-only future date ticks in Devanagari and transitions through wedding day to after-day', () => {
    const h = boot({ customer: { weddingDate: '2030-05-24', weddingTime: '18:00' }, now: '2030-05-23T10:26:56Z' });
    assert.deepEqual(h.units(), { days: '०१', hours: '०२', minutes: '०३', seconds: '०४' });
    assert.equal(h.$('#dv-count-status').textContent, '');
    h.advance(1000);
    assert.equal(h.units().seconds, '०३');
    const boundary = boot({ customer: { weddingDate: '2030-05-24', weddingTime: '23:59' }, now: '2030-05-24T18:28:59Z' });
    assert.equal(boundary.units().seconds, '०१');
    assert.equal(boundary.$('#dv-count-status').textContent, '');
    boundary.advance(1000);
    assert.equal(boundary.$('#dv-count-status').textContent, config.demo.weddingDayMessage);
    boundary.advance(60000);
    assert.equal(boundary.$('#dv-count-status').textContent, config.demo.afterWeddingMessage);
    assert.deepEqual(boundary.units(), { days: '००', hours: '००', minutes: '००', seconds: '००' });
  });

  test('countdown and wedding-day boundaries use Asia/Kolkata, not the visitor timezone', () => {
    const script = `const { boot } = require(${JSON.stringify(__filename)});
      const cases = [
        { now: '2026-05-24T12:29:59Z' },
        { now: '2026-05-24T12:30:00Z' },
        { now: '2026-05-24T18:29:59Z' },
        { now: '2026-05-24T18:30:00Z' },
        { now: '2030-05-23T10:26:56Z', customer: { weddingDate: '2030-05-24', weddingTime: '18:00' } }
      ];
      process.stdout.write(JSON.stringify(cases.map(options => { const h = boot(options); return { units: h.units(), status: h.$('#dv-count-status').textContent, target: h.$('.dv-target').textContent }; })));`;
    const results = ['UTC', 'America/Los_Angeles', 'Asia/Tokyo', 'Pacific/Kiritimati'].map(TZ =>
      JSON.parse(execFileSync(process.execPath, ['-e', script], { env: { ...process.env, TZ, DIVYA_RUNTIME_PROBE: '1' }, encoding: 'utf8', timeout: 10000 })));
    for (const result of results) {
      assert.deepEqual(result, results[0]);
      assert.equal(result[0].units.seconds, '०१');
      assert.equal(result[0].status, '');
      assert.equal(result[1].status, config.demo.weddingDayMessage);
      assert.equal(result[2].status, config.demo.weddingDayMessage);
      assert.equal(result[3].status, config.demo.afterWeddingMessage);
      assert.deepEqual(result[4].units, { days: '०१', hours: '०२', minutes: '०३', seconds: '०४' });
    }
  });

  test('preview-only skip query does not bypass the live guest gate', () => {
    const live = boot({ search: '?skip=1' }); live.advance(1000);
    assert.equal(live.$('#dv-main').inert, true);
    const preview = boot({ preview: true, search: '?skip=1' }); preview.advance(900);
    assertOpened(preview); assert.equal(preview.video.playCalls, 0);
  });

  test('CSS ships local Devanagari faces, uses them, and respects reduced motion', () => {
    const faces = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map(match => match[1]);
    assert.ok(faces.length > 0);
    assert.ok(faces.some(face => /Devanagari/i.test(face)), 'local Devanagari face is declared');
    for (const face of faces) {
      const urls = [...face.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)].map(match => match[1]);
      assert.ok(urls.length > 0);
      for (const url of urls) {
        assert.ok(url.startsWith('/divya-vivah/fonts/'), `font is local: ${url}`);
        assert.ok(fs.statSync(path.join(root, 'public', url)).size > 0, `font exists: ${url}`);
      }
      assert.match(face, /font-display\s*:\s*(?:swap|fallback|optional)/);
    }
    assert.match(css, /--dv-font\s*:[^;]*(?:Marathi|Devanagari)/);
    assert.match(css, /font-family\s*:\s*var\(--dv-font\)/);
    assert.doesNotMatch(css, /fonts\.(?:googleapis|gstatic)\.com/);
    const media = /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/.exec(css);
    assert.ok(media, 'reduced-motion media query is present');
    const reduced = css.slice(media.index);
    assert.match(reduced, /prefers-reduced-motion\s*:\s*reduce/);
    assert.match(reduced, /scroll-behavior\s*:\s*auto/);
    assert.match(reduced, /animation\s*:\s*none/);
    assert.match(reduced, /transition(?:-duration)?\s*:\s*(?:none|0(?:s|ms)?|\.1s)/);
  });
}
