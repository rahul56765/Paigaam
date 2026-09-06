'use strict';
// Run: node --test tests/saalgirah-dom.test.js
// Drives public/saalgirah/letter.js against a stub DOM and a virtual clock, so
// the whole four-scene choreography is verified without a browser.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'public', 'saalgirah', 'letter.js'), 'utf8');

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
    insertAdjacentHTML(_position, html) { this.innerHTML += html; },
    querySelector(selector) { return this._byselector ? this._byselector(selector) : null; },
    focus() { this.focused = true; },
  };
  node.classList = makeClassList(node);
  return node;
}

function makeDom() {
  const scenes = {};
  ['envelope', 'reveal', 'birthday', 'love'].forEach(name => {
    scenes[name] = makeElement('section', { 'data-scene': name });
  });
  const backgrounds = {};
  ['envelope', 'reveal', 'birthday', 'love'].forEach(name => {
    backgrounds[name] = makeElement('div', { 'data-bg': name });
  });
  scenes.envelope.classList.add('is-active');

  const sweep = makeElement('div', { class: 'sg-sweep' });
  const particles = makeElement('div', { id: 'sgParticles' });
  particles._byselector = s => (s === '.sg-sweep' ? sweep : null);

  const byId = {
    sgOpen: makeElement('button', { id: 'sgOpen' }),
    sgCake: makeElement('div', { id: 'sgCake' }),
    sgConfetti: makeElement('div', { id: 'sgConfetti' }),
    sgParticles: particles,
    sgMusic: makeElement('button', { id: 'sgMusic' }),
  };

  const body = makeElement('body');
  body.classList.add('sg');

  const document = {
    body,
    getElementById: id => byId[id] || null,
    querySelector(selector) {
      let m = selector.match(/^\.sg-scene\[data-scene="([a-z]+)"\]$/);
      if (m) return scenes[m[1]] || null;
      m = selector.match(/^\.sg-bg\[data-bg="([a-z]+)"\]$/);
      if (m) return backgrounds[m[1]] || null;
      return null;
    },
    addEventListener() {},
  };

  return { document, scenes, backgrounds, byId, particles, sweep };
}

/** Records every audio cue, in order. */
function makeAudio() {
  const calls = [];
  const api = {
    calls,
    startMusic() { calls.push('startMusic'); return Promise.resolve(); },
    setScene(s) { calls.push('setScene:' + s); },
    transitionToScene(s) { calls.push('transitionToScene:' + s); },
    toggleMute() { api.muted = !api.muted; calls.push('toggleMute'); return api.muted; },
    muted: false,
  };
  ['sfxPaper', 'sfxChime', 'sfxClick', 'sfxSparkle', 'sfxFlame', 'sfxWhoosh', 'sfxWarmChime'].forEach(name => {
    api[name] = () => calls.push(name);
  });
  return api;
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
    get pending() { return queue.size; },
  };
}

function boot({ inIframe = false, reduced = false } = {}) {
  const dom = makeDom();
  const audio = makeAudio();
  const clock = makeClock();
  const window = {
    SaalgirahAudio: audio,
    matchMedia: () => ({ matches: reduced }),
  };
  window.parent = inIframe ? {} : window;
  const sandbox = {
    window,
    document: dom.document,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    Math,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: 'letter.js' });
  return { ...dom, audio, clock };
}

const active = (scenes, name) => scenes[name].classList.contains('is-active');
const steps = scene => scene.classList.list.filter(c => c.indexOf('is-step') === 0).sort();

/* ---------------------------------------------------------------- tests */

test('DOM: boots on the envelope with its background lit and particles built', () => {
  const { scenes, backgrounds, particles, audio, clock } = boot();
  assert.ok(active(scenes, 'envelope'));
  assert.ok(backgrounds.envelope.classList.contains('is-on'));
  assert.ok(!backgrounds.reveal.classList.contains('is-on'));
  assert.match(particles.innerHTML, /sg-p--(heart|star|dust|bokeh)/);
  assert.equal((particles.innerHTML.match(/<i /g) || []).length > 10, true);
  // No sound before the reader touches anything.
  assert.deepEqual(audio.calls, []);
  clock.advance(1800);
  assert.equal(clock.pending >= 0, true);
});

test('DOM: the music button appears after 1.8s and toggles mute', () => {
  const { byId, audio, clock } = boot();
  const button = byId.sgMusic;
  assert.ok(!button.classList.contains('is-shown'));
  clock.advance(1800);
  assert.ok(button.classList.contains('is-shown'));

  button.dispatch('click');
  assert.ok(button.classList.contains('is-muted'));
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.equal(button.getAttribute('aria-label'), 'Unmute music');

  button.dispatch('click');
  assert.ok(!button.classList.contains('is-muted'));
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  // Unmuting gives the little confirmation blip.
  assert.ok(audio.calls.includes('sfxClick'));
});

test('DOM: opening the envelope starts music inside the click, then hands over to the reveal', () => {
  const { scenes, backgrounds, byId, audio, clock } = boot();
  byId.sgOpen.dispatch('click');

  // Audio must be unlocked by the gesture itself, not 1.7s later.
  assert.equal(audio.calls[0], 'startMusic');
  assert.ok(scenes.envelope.classList.contains('is-opening'));

  clock.advance(1699);
  assert.ok(!audio.calls.includes('sfxPaper'));
  clock.advance(1);
  assert.ok(audio.calls.includes('sfxPaper'));

  clock.advance(100);           // goTo('reveal') is queued 100ms after the paper
  assert.ok(audio.calls.includes('transitionToScene:reveal'));
  assert.ok(scenes.envelope.classList.contains('is-leaving'));
  assert.ok(active(scenes, 'reveal') === false, 'reveal waits for the exit to finish');

  clock.advance(1000);          // the envelope's 1s exit
  assert.ok(!active(scenes, 'envelope'));
  assert.ok(active(scenes, 'reveal'));
  assert.ok(backgrounds.reveal.classList.contains('is-on'));
  assert.ok(!backgrounds.envelope.classList.contains('is-on'));

  // A second click cannot re-open or double-start the music.
  const startCount = audio.calls.filter(c => c === 'startMusic').length;
  byId.sgOpen.dispatch('click');
  assert.equal(audio.calls.filter(c => c === 'startMusic').length, startCount);
});

test('DOM: the three reveal lines arrive on their original timings', () => {
  const { scenes, byId, clock } = boot();
  byId.sgOpen.dispatch('click');
  clock.advance(1700 + 100 + 1000);   // now standing in the reveal
  const scene = scenes.reveal;
  assert.deepEqual(steps(scene), []);
  clock.advance(1200); assert.deepEqual(steps(scene), ['is-step1']);
  clock.advance(3000); assert.deepEqual(steps(scene), ['is-step1', 'is-step2']);
  clock.advance(3600); assert.deepEqual(steps(scene), ['is-step1', 'is-step2', 'is-step3']);
});

test('DOM: the full film runs envelope → reveal → birthday → love', () => {
  const { scenes, backgrounds, byId, audio, clock } = boot();
  byId.sgOpen.dispatch('click');
  clock.advance(1700 + 100 + 1000);
  assert.ok(active(scenes, 'reveal'));

  clock.advance(13200);               // the reveal's own runtime
  assert.ok(audio.calls.includes('transitionToScene:birthday') === false, 'the chime lands first');
  clock.advance(200 + 1200);          // hand-off + the reveal's 1.2s exit
  assert.ok(active(scenes, 'birthday'));
  assert.ok(backgrounds.birthday.classList.contains('is-on'));

  const scene = scenes.birthday;
  clock.advance(800);  assert.deepEqual(steps(scene), ['is-step1']);
  clock.advance(300);  assert.ok(audio.calls.includes('sfxSparkle'));
  clock.advance(1100); assert.deepEqual(steps(scene), ['is-step1', 'is-step2']);
  clock.advance(3400); assert.deepEqual(steps(scene), ['is-step1', 'is-step2', 'is-step3']);
  clock.advance(3200); assert.deepEqual(steps(scene), ['is-step1', 'is-step2', 'is-step3', 'is-step4']);
});

test('DOM: blowing out the candles throws confetti, then closes on the last scene', () => {
  const { scenes, byId, audio, clock } = boot();
  byId.sgOpen.dispatch('click');
  clock.advance(1700 + 100 + 1000 + 13200 + 200 + 1200 + 8800);
  assert.ok(active(scenes, 'birthday'));

  byId.sgCake.dispatch('click');
  assert.ok(scenes.birthday.classList.contains('is-wished'));
  assert.equal((byId.sgConfetti.innerHTML.match(/<i /g) || []).length, 14);
  assert.ok(byId.sgConfetti.innerHTML.indexOf('--dx:') > -1);
  assert.ok(audio.calls.includes('sfxFlame'));

  clock.advance(900);
  ['sfxWhoosh', 'sfxChime', 'sfxSparkle'].forEach(cue => assert.ok(audio.calls.includes(cue), cue));

  // Tapping again changes nothing.
  const confetti = byId.sgConfetti.innerHTML;
  byId.sgCake.dispatch('click');
  assert.equal(byId.sgConfetti.innerHTML, confetti);

  clock.advance(2500);
  assert.ok(audio.calls.includes('sfxWarmChime'));
  clock.advance(200 + 1300);           // hand-off + the birthday scene's 1.3s exit
  assert.ok(active(scenes, 'love'));

  assert.ok(!scenes.love.classList.contains('is-signed'));
  clock.advance(5000);
  assert.ok(scenes.love.classList.contains('is-signed'));
});

test('DOM: the candles also respond to the keyboard', () => {
  const { scenes, byId, clock } = boot();
  byId.sgOpen.dispatch('click');
  clock.advance(1700 + 100 + 1000 + 13200 + 200 + 1200 + 800);
  let prevented = false;
  byId.sgCake.dispatch('keydown', { key: 'Enter', preventDefault() { prevented = true; } });
  assert.ok(prevented);
  assert.ok(scenes.birthday.classList.contains('is-wished'));
});

test('DOM: nothing happens to a scene that is not on stage', () => {
  const { scenes, byId } = boot();
  // The cake belongs to a scene that has not started yet.
  byId.sgCake.dispatch('click');
  assert.ok(!scenes.birthday.classList.contains('is-wished'));
});

test('DOM: inside an iframe the letter plays itself, silently', () => {
  const { scenes, audio, clock } = boot({ inIframe: true });
  clock.advance(2600);
  assert.ok(scenes.envelope.classList.contains('is-opening'));
  clock.advance(1700 + 100 + 1000);
  assert.ok(active(scenes, 'reveal'), 'the thumbnail advances without a tap');
  // startMusic is still attempted; with no gesture the engine simply stays quiet.
  assert.ok(audio.calls.includes('startMusic'));
});

test('DOM: reduced motion shortens the hand-offs but keeps every beat', () => {
  const { scenes, byId, clock } = boot({ reduced: true });
  byId.sgOpen.dispatch('click');
  clock.advance(400);                  // the shortened envelope pause
  clock.advance(100 + 400);            // hand-off + shortened exit
  assert.ok(active(scenes, 'reveal'));
  clock.advance(1200);
  assert.deepEqual(steps(scenes.reveal), ['is-step1']);
});

test('DOM: a missing audio engine never breaks the film', () => {
  const dom = makeDom();
  const clock = makeClock();
  const window = { matchMedia: () => ({ matches: false }) };
  window.parent = window;
  const sandbox = { window, document: dom.document, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, Math, console };
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: 'letter.js' });

  dom.byId.sgOpen.dispatch('click');
  clock.advance(1700 + 100 + 1000);
  assert.ok(dom.scenes.reveal.classList.contains('is-active'));
  dom.byId.sgMusic.dispatch('click');
  assert.ok(dom.byId.sgMusic.classList.contains('is-muted'));
});
