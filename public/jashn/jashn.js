'use strict';
/**
 * Jashn — Blow the Candles (Boyfriend Day family). The ceremony.
 *
 * Flow:
 *   ① intro    balloons drift; "Tap to open your surprise" walks to the cake.
 *   ② cake     the cake has risen with the candles; "Ready to blow them out"
 *              walks to the blow stage (the candles there mirror the cake's).
 *   ③ blow     tap each flame, or "Blow with your voice": getUserMedia +
 *              a volume gate blows out the nearest lit flame on a loud
 *              burst. The mic attempt window is 8 seconds (Director's
 *              ruling) — after that, or on any denial/error, the visible
 *              "or tap the flames one by one" fallback is the way through.
 *              The fallback line is on screen from the start; the mic is
 *              never a dead end.
 *   ④ reel     all flames out → pure-CSS confetti falls, then the photo
 *              reel (scroll-snap carousel with dots).
 *   ⑤ letter   the letter on paper grain, the opt-in song chip, and
 *              "Celebrate again" (full reset, candles relit).
 *
 * The blow beat's candles are clones of the cake's (same count, same states)
 * so the two beats always agree. Reduced motion: timed beats shorten and the
 * confetti is skipped.
 */
(function () {

  var dataEl = document.getElementById('jsData');
  if (!dataEl) return;

  var DATA;
  try { DATA = JSON.parse(dataEl.textContent); } catch (e) { return; }

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var beats = {
    intro: document.getElementById('jsIntro'),
    cake: document.getElementById('jsCake'),
    blow: document.getElementById('jsBlow'),
    reel: document.getElementById('jsReel'),
    letter: document.getElementById('jsLetter'),
  };
  var openBtn = document.getElementById('jsOpenBtn');
  var nextBtn = document.getElementById('jsNextBtn');
  var micBtn = document.getElementById('jsMicBtn');
  var statusEl = document.getElementById('jsBlowStatus');
  var candlesCake = document.getElementById('jsCandles');
  var candlesBlow = document.getElementById('jsCandlesBlow');
  var confetti = document.getElementById('jsConfetti');
  var reel = document.getElementById('jsReelTrack');
  var dots = document.getElementById('jsDots');
  var replayBtn = document.getElementById('jsReplayBtn');

  if (!beats.intro || !openBtn) return;

  /* ------------------------------------------------ stage walking */
  var current = 'intro';
  function showStage(name) {
    Object.keys(beats).forEach(function (k) {
      var el = beats[k];
      if (!el) return;
      var on = k === name;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-hidden', on ? 'false' : 'true');
      if (on && !reduceMotion) {
        el.classList.remove('is-entering');
        void el.offsetWidth;
        el.classList.add('is-entering');
      }
    });
    current = name;
    window.scrollTo(0, 0);
  }

  /* ------------------------------------------------ candle state (shared) */

  // Mirror the blow stage's candle clones from the cake's set FIRST — the
  // innerHTML swap replaces every button node, so the tap listeners below
  // must be attached to the post-clone DOM (capturing first left them on
  // detached orphans and the flames never went out).
  if (candlesCake && candlesBlow) candlesBlow.innerHTML = candlesCake.innerHTML;

  var flameBtns = candlesBlow ? [].slice.call(candlesBlow.querySelectorAll('.js-flame-btn')) : [];

  function litCount() {
    return candlesBlow ? candlesBlow.querySelectorAll('.js-candle:not(.is-out)').length : 0;
  }

  function blowOut(btn) {
    var candle = btn && btn.parentElement;
    if (!candle || candle.classList.contains('is-out')) return false;
    candle.classList.add('is-out');
    // the cake's own candle mirrors the state
    var i = btn.getAttribute('data-flame');
    var cakeCandle = candlesCake && candlesCake.querySelector('.js-candle[data-flame="' + i + '"]');
    if (cakeCandle) cakeCandle.classList.add('is-out');
    btn.disabled = true;
    btn.setAttribute('aria-label', 'Flame ' + (+i + 1) + ' — out');
    if (litCount() === 0) allOut();
    return true;
  }

  flameBtns.forEach(function (btn) {
    btn.addEventListener('click', function () { stopMic(); blowOut(btn); });
  });

  /* ------------------------------------------------ ② → ③ */
  if (nextBtn) nextBtn.addEventListener('click', function () {
    showStage('blow');
  });

  /* ------------------------------------------------ ③ the mic blow */
  var mic = { stream: null, ctx: null, analyser: null, raf: 0, timer: 0, trying: false };

  var MIC_WINDOW_MS = 8000;   // Director's ruling: 8s max attempt window
  var BURST_DB = 0.14;        // volume gate: a sharp loud burst, not speech
  var COOLDOWN_MS = 450;      // one flame per burst

  function stopMic() {
    if (!mic.trying) return;
    mic.trying = false;
    cancelAnimationFrame(mic.raf);
    clearTimeout(mic.timer);
    if (mic.stream) {
      mic.stream.getTracks().forEach(function (t) { t.stop(); });
      mic.stream = null;
    }
    if (mic.ctx && mic.ctx.close) { try { mic.ctx.close(); } catch (e) { /* fine */ } mic.ctx = null; }
    if (micBtn) { micBtn.classList.remove('is-listening'); micBtn.disabled = false; }
  }

  function micFail(msg) {
    stopMic();
    if (statusEl) statusEl.textContent = msg;
    // the tap fallback is already visible; make sure it reads as the way
    if (micBtn) micBtn.textContent = 'Blow with your voice 🎤';
  }

  function blowWithMic() {
    if (mic.trying || litCount() === 0) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.AudioContext) {
      micFail('Voice blow needs a newer browser — tapping works just as well.');
      return;
    }
    micBtn.classList.add('is-listening');
    micBtn.disabled = true;
    if (statusEl) statusEl.textContent = 'listening… blow towards the screen!';

    navigator.mediaDevices.getUserMedia({ audio: {
      echoCancellation: false, noiseSuppression: false, autoGainControl: false,
    } }).then(function (stream) {
      if (!mic.trying) return;
      mic.stream = stream;
      mic.ctx = new (window.AudioContext || window.webkitAudioContext)();
      mic.analyser = mic.ctx.createAnalyser();
      mic.analyser.fftSize = 512;
      mic.ctx.createMediaStreamSource(stream).connect(mic.analyser);
      var buf = new Uint8Array(mic.analyser.frequencyBinCount);
      var lastBlow = 0;

      var tick = function () {
        if (!mic.trying) return;
        mic.analyser.getByteTimeDomainData(buf);
        var sum = 0;
        for (var i = 0; i < buf.length; i++) { var v = (buf[i] - 128) / 128; sum += v * v; }
        var rms = Math.sqrt(sum / buf.length);
        var now = Date.now();
        if (rms > BURST_DB && now - lastBlow > COOLDOWN_MS) {
          lastBlow = now;
          var lit = candlesBlow.querySelector('.js-candle:not(.is-out) .js-flame-btn');
          if (lit) blowOut(lit);
        }
        if (litCount() > 0) mic.raf = requestAnimationFrame(tick);
        else stopMic();
      };
      mic.raf = requestAnimationFrame(tick);

      mic.timer = setTimeout(function () {
        if (litCount() > 0) micFail('No luck — tap the flames instead, just as good.');
      }, MIC_WINDOW_MS);
    }).catch(function () {
      micFail('Microphone said no — tap the flames instead, just as good.');
    });
  }

  if (micBtn) micBtn.addEventListener('click', blowWithMic);

  /* ------------------------------------------------ all flames out → ④ */
  var advanced = false;
  function allOut() {
    stopMic();
    if (advanced) return;
    advanced = true;
    setTimeout(function () {
      confettiFall();
      showStage('reel');
    }, reduceMotion ? 250 : 1100);
  }

  /* ------------------------------------------------ confetti (pure CSS) */
  function confettiFall() {
    if (!confetti || reduceMotion) return;
    var colors = ['#D8A7B1', '#A8B5A2', '#C9A227', '#FFFDF8', '#E8B4C8'];
    for (var i = 0; i < 60; i++) {
      var flake = document.createElement('i');
      flake.style.left = (Math.random() * 100) + 'vw';
      flake.style.background = colors[i % colors.length];
      var dur = 2.6 + Math.random() * 2.2;
      flake.style.animationDuration = dur + 's';
      flake.style.animationDelay = (Math.random() * 0.9) + 's';
      if (i % 3 === 0) flake.style.borderRadius = '50%';
      confetti.appendChild(flake);
    }
    setTimeout(function () { confetti.classList.add('is-done'); }, 6200);
  }

  /* ------------------------------------------------ reel dots */
  if (reel && dots && reel.children.length > 1) {
    var count = reel.children.length;
    for (var i = 0; i < count; i++) {
      var dot = document.createElement('i');
      if (i === 0) dot.className = 'is-on';
      dots.appendChild(dot);
    }
    var dotEls = [].slice.call(dots.children);
    reel.addEventListener('scroll', function () {
      var w = reel.children[0] ? reel.children[0].offsetWidth + 18 : 1;
      var ix = Math.min(count - 1, Math.round(reel.scrollLeft / w));
      dotEls.forEach(function (d, j) { d.classList.toggle('is-on', j === ix); });
    }, { passive: true });
  }

  /* ------------------------------------------------ ⑤ replay */
  if (replayBtn) replayBtn.addEventListener('click', function () {
    // relight everything, clear confetti, back to the intro
    [].slice.call(document.querySelectorAll('.js-candle.is-out')).forEach(function (c) { c.classList.remove('is-out'); });
    [].slice.call(document.querySelectorAll('.js-flame-btn')).forEach(function (b) { b.disabled = false; });
    if (confetti) { confetti.innerHTML = ''; confetti.classList.remove('is-done'); }
    advanced = false;
    showStage('intro');
  });

  /* ------------------------------------------------ ① → ② */
  openBtn.addEventListener('click', function () { showStage('cake'); });

  showStage('intro');
})();
