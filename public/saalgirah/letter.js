'use strict';
/**
 * Saalgirah — scene choreography.
 *
 * The copy is already in the document; this script only does four things:
 *   1. runs the scene state machine (envelope → reveal → birthday → love)
 *   2. fires the beats inside each scene on the original timings
 *   3. cues the synthesised audio
 *   4. handles the two interactions: opening the envelope, blowing the candles
 *
 * Every millisecond value below comes from the uploaded React components.
 */
(function () {
  var doc = document;
  var body = doc.body;
  if (!body || !body.classList.contains('sg')) return;

  var audio = window.SaalgirahAudio || null;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* The audio palette for each scene, and how long each scene takes to leave. */
  var SCENE_AUDIO = { envelope: 'calm', reveal: 'reveal', birthday: 'birthday', love: 'love' };
  var EXIT_MS = { envelope: 1000, reveal: 1200, birthday: 1300, love: 1600 };
  var ORDER = ['envelope', 'reveal', 'birthday', 'love'];

  var scenes = {};
  ORDER.forEach(function (name) {
    scenes[name] = doc.querySelector('.sg-scene[data-scene="' + name + '"]');
  });
  var backgrounds = {};
  ORDER.forEach(function (name) {
    backgrounds[name] = doc.querySelector('.sg-bg[data-bg="' + name + '"]');
  });

  var current = 'envelope';
  var timers = [];
  var musicStarted = false;

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  /** Audio calls must never break the experience. */
  function cue(method) {
    if (!audio || typeof audio[method] !== 'function') return;
    try { audio[method](); } catch (e) { /* silence is fine */ }
  }
  function cueScene(name) {
    if (!audio || typeof audio.transitionToScene !== 'function') return;
    try { audio.transitionToScene(SCENE_AUDIO[name]); } catch (e) { /* silence is fine */ }
  }

  function lightBackground(name) {
    ORDER.forEach(function (key) {
      if (!backgrounds[key]) return;
      if (key === name) backgrounds[key].classList.add('is-on');
      else backgrounds[key].classList.remove('is-on');
    });
  }

  /* ------------------------------------------------------------- machine */

  function enter(name) {
    var scene = scenes[name];
    if (!scene) return;
    current = name;
    scene.classList.add('is-active');
    lightBackground(name);
    buildParticles(name);
    beats(name);
  }

  /** Exit the current scene, then enter the next — framer's "wait" mode. */
  function goTo(next) {
    if (next === current || !scenes[next]) return;
    var leaving = scenes[current];
    var wait = reduced ? 400 : (EXIT_MS[current] || 1000);
    cueScene(next);
    if (leaving) leaving.classList.add('is-leaving');
    clearTimers();
    later(function () {
      if (leaving) leaving.classList.remove('is-active', 'is-leaving');
      enter(next);
    }, wait);
  }

  /** The timed beats inside each scene. */
  function beats(name) {
    var scene = scenes[name];
    if (name === 'reveal') {
      later(function () { scene.classList.add('is-step1'); }, 1200);
      later(function () { scene.classList.add('is-step2'); }, 4200);
      later(function () { scene.classList.add('is-step3'); }, 7800);
      later(function () { cue('sfxChime'); later(function () { goTo('birthday'); }, 200); }, 13200);
      return;
    }
    if (name === 'birthday') {
      later(function () { scene.classList.add('is-step1'); }, 800);
      later(function () { cue('sfxSparkle'); }, 1100);
      later(function () { scene.classList.add('is-step2'); }, 2200);
      later(function () { scene.classList.add('is-step3'); }, 5600);
      later(function () { scene.classList.add('is-step4'); }, 8800);
      return;
    }
    if (name === 'love') {
      later(function () { scene.classList.add('is-signed'); }, 5000);
    }
  }

  /* ------------------------------------------------- scene 1 · the envelope */

  var envelope = scenes.envelope;
  var openBtn = doc.getElementById('sgOpen');
  var opening = false;

  function openEnvelope() {
    if (opening) return;
    opening = true;
    if (envelope) envelope.classList.add('is-opening');

    // Music is started inside the click itself: browsers only unlock audio
    // during a real gesture, so this cannot wait for the flap animation.
    startMusic();

    later(function () {
      cue('sfxPaper');
      later(function () { cue('sfxChime'); }, 600);
      later(function () { goTo('reveal'); }, 100);
    }, reduced ? 400 : 1700);
  }

  function startMusic() {
    if (musicStarted || !audio) return;
    musicStarted = true;
    try {
      var started = audio.startMusic();
      if (started && typeof started.then === 'function') {
        started.then(function () { try { audio.setScene('calm'); } catch (e) {} }, function () {});
      } else {
        try { audio.setScene('calm'); } catch (e) {}
      }
    } catch (e) { /* the letter still reads without sound */ }
  }

  if (openBtn) openBtn.addEventListener('click', openEnvelope);

  /* --------------------------------------------------- scene 3 · the candles */

  var cake = doc.getElementById('sgCake');
  var wished = false;

  function makeWish() {
    if (wished) return;
    var scene = scenes.birthday;
    if (!scene || !scene.classList.contains('is-active')) return;
    wished = true;
    scene.classList.add('is-wished');
    burstConfetti();

    cue('sfxFlame');
    later(function () { cue('sfxWhoosh'); }, 200);
    later(function () { cue('sfxChime'); }, 700);
    later(function () { cue('sfxSparkle'); }, 900);
    later(function () {
      cue('sfxWarmChime');
      later(function () { goTo('love'); }, 200);
    }, 3400);
  }

  if (cake) {
    cake.addEventListener('click', makeWish);
    cake.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        makeWish();
      }
    });
  }

  var HEART_PATH = 'M12 21s-7-4.5-9.5-9C0.5 8 2 4 6 4c2.5 0 4 1.5 6 3.5C14 5.5 15.5 4 18 4c4 0 5.5 4 3.5 8-2.5 4.5-9.5 9-9.5 9z';

  function heartSVG(color) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + HEART_PATH + '" fill="' + color + '"></path></svg>';
  }

  /** Fourteen hearts thrown outward from the candles. */
  function burstConfetti() {
    var host = doc.getElementById('sgConfetti');
    if (!host) return;
    var total = 14;
    var html = '';
    for (var i = 0; i < total; i++) {
      var angle = (i / total) * Math.PI * 2;
      var dist = 60 + Math.random() * 50;
      var dx = Math.cos(angle) * dist;
      var dy = Math.sin(angle) * dist - 30;
      var size = 10 + Math.random() * 6;
      var rot = Math.random() * 360;
      var dur = 1.8 + Math.random() * 0.8;
      html += '<i style="--dx:' + dx.toFixed(1) + 'px;--dy:' + dy.toFixed(1) + 'px;--size:' +
        size.toFixed(1) + 'px;--rot:' + rot.toFixed(0) + 'deg;--dur:' + dur.toFixed(2) + 's">' +
        heartSVG(i % 2 === 0 ? '#B85454' : '#D9A7A0') + '</i>';
    }
    host.innerHTML = html;
  }

  /* ----------------------------------------------------------- particles */

  var particleHost = doc.getElementById('sgParticles');
  var sweep = particleHost ? particleHost.querySelector('.sg-sweep') : null;
  var lastVariant = null;

  var VARIANT = { envelope: 'calm', reveal: 'calm', birthday: 'warm', love: 'love' };
  var HEART_COLOR = { calm: '#E4B8B0', warm: '#D9A7A0', love: '#C75A5A' };

  function rand(min, max) { return Math.random() * (max - min) + min; }

  var SPARKLE_PATH = 'M12 0 L13.5 10.5 L24 12 L13.5 13.5 L12 24 L10.5 13.5 L0 12 L10.5 10.5 Z';

  /**
   * Rebuilt whenever the palette changes — the original remounted the field
   * for each scene variant, so the particles reshuffle at every transition.
   */
  function buildParticles(sceneName) {
    if (!particleHost) return;
    var variant = VARIANT[sceneName] || 'calm';
    var density = sceneName === 'love' ? 1.2 : 1;
    if (variant === lastVariant && particleHost.querySelector('i')) return;
    lastVariant = variant;

    var count = Math.floor(22 * density);
    var bokehBg = variant === 'love'
      ? 'radial-gradient(circle at 40% 40%, rgba(231, 144, 144, 0.5), transparent 70%)'
      : 'radial-gradient(circle at 40% 40%, rgba(255, 235, 210, 0.55), transparent 70%)';
    var dustBg = variant === 'love' ? '#F4D5C5' : '#F8E8D0';
    var starColor = variant === 'love' ? '#E8B0A0' : '#F0D8A8';
    var heartColor = HEART_COLOR[variant];
    var html = '';

    for (var i = 0; i < count; i++) {
      var r = Math.random();
      var type = r < 0.25 ? 'heart' : r < 0.5 ? 'star' : r < 0.8 ? 'dust' : 'bokeh';
      var size = type === 'bokeh' ? rand(40, 90) : type === 'dust' ? rand(2, 4) : rand(6, 14);
      var duration = type === 'bokeh' ? rand(12, 20) : type === 'star' ? rand(3, 6) : rand(8, 18);
      var opacity = type === 'bokeh' ? rand(0.04, 0.1) : type === 'dust' ? rand(0.15, 0.35) : rand(0.25, 0.55);
      var style = '--x:' + rand(0, 100).toFixed(2) + '%;--y:' + rand(0, 100).toFixed(2) + '%;' +
        '--size:' + size.toFixed(1) + 'px;--op:' + opacity.toFixed(3) + ';' +
        '--drift:' + rand(-30, 30).toFixed(1) + 'px;--dur:' + duration.toFixed(2) + 's;' +
        '--delay:' + rand(0, 8).toFixed(2) + 's';
      if (type === 'bokeh') style += ';background:' + bokehBg;
      if (type === 'dust') style += ';background:' + dustBg;
      html += '<i class="sg-p--' + type + '" style="' + style + '">' +
        (type === 'heart' ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + HEART_PATH + '" fill="' + heartColor + '" opacity="0.85"></path></svg>'
          : type === 'star' ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + SPARKLE_PATH + '" fill="' + starColor + '"></path></svg>'
            : '') +
        '</i>';
    }
    // The light sweep is a fixture of the field, not a particle — keep it.
    particleHost.innerHTML = '';
    if (sweep) particleHost.appendChild(sweep);
    particleHost.insertAdjacentHTML('beforeend', html);
  }

  /* -------------------------------------------------------- music toggle */

  var musicBtn = doc.getElementById('sgMusic');
  if (musicBtn) {
    setTimeout(function () { musicBtn.classList.add('is-shown'); }, 1800);
    musicBtn.addEventListener('click', function () {
      var muted = false;
      if (audio && typeof audio.toggleMute === 'function') {
        try { muted = audio.toggleMute(); } catch (e) { return; }
      } else {
        muted = !musicBtn.classList.contains('is-muted');
      }
      musicBtn.classList.toggle('is-muted', !!muted);
      musicBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
      musicBtn.setAttribute('aria-label', muted ? 'Unmute music' : 'Mute music');
      musicBtn.setAttribute('title', muted ? 'Unmute music' : 'Mute music');
      if (!muted) cue('sfxClick');
    });
  }

  /* ------------------------------------------------------------- kick off */

  lightBackground('envelope');
  buildParticles('envelope');

  // Inside an iframe (the template thumbnails on the collection pages) nobody
  // can tap, so the letter plays itself — silently, since audio needs a gesture.
  if (window.parent !== window) {
    setTimeout(openEnvelope, 2600);
  }
})();
