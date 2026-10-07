/*
 * Birthday Paigaam — sound.
 *
 * One AudioContext, created on the first real tap (browsers only allow audio
 * inside a gesture). Every effect is synthesised — no sound files, nothing to
 * license. Three buses feed the master:
 *   sfx   key pops, chimes, paper, crack, candles, fireworks (mute toggle)
 *   song  the uploaded song (via a MediaElementSource) or the music box
 *   voice the voice note (with an analyser for the live waveform)
 * duck(true) eases the song bus down while the voice note plays.
 */
(function () {
  'use strict';
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, master, sfxBus, songBus, voiceBus, analyser, noiseBuf;
  var muted = false;
  try { muted = localStorage.getItem('bp-sfx-muted') === '1'; } catch (e) {}

  function init() {
    if (ctx || !AC) return ctx;
    try {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = muted ? 0 : 0.55; sfxBus.connect(master);
      songBus = ctx.createGain(); songBus.gain.value = 1; songBus.connect(master);
      voiceBus = ctx.createGain(); voiceBus.gain.value = 1;
      analyser = ctx.createAnalyser(); analyser.fftSize = 64; analyser.smoothingTimeConstant = 0.72;
      voiceBus.connect(analyser); analyser.connect(master);
      var len = ctx.sampleRate * 1.2;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
    return ctx;
  }

  function wake() {
    init();
    if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }

  function now() { return ctx.currentTime; }

  /** A soft enveloped tone. */
  function tone(freq, start, dur, opts) {
    opts = opts || {};
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(freq, start);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(opts.slide, start + dur);
    var peak = opts.gain == null ? 0.3 : opts.gain;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + (opts.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    var node = g;
    if (opts.filter) {
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.filter;
      g.connect(f); node = f;
    }
    o.connect(g); node.connect(opts.bus || sfxBus);
    o.start(start); o.stop(start + dur + 0.05);
  }

  /** Filtered noise burst. */
  function noise(start, dur, opts) {
    opts = opts || {};
    var s = ctx.createBufferSource(); s.buffer = noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = opts.type || 'bandpass'; f.frequency.value = opts.freq || 2000; f.Q.value = opts.q || 0.8;
    if (opts.sweep) f.frequency.exponentialRampToValueAtTime(opts.sweep, start + dur);
    var g = ctx.createGain();
    var peak = opts.gain == null ? 0.25 : opts.gain;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + (opts.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    s.connect(f); f.connect(g); g.connect(opts.bus || sfxBus);
    s.start(start, Math.random() * 0.4); s.stop(start + dur + 0.05);
  }

  function bell(freq, start, dur, gain) {
    tone(freq, start, dur, { gain: gain || 0.22, attack: 0.004 });
    tone(freq * 2.01, start, dur * 0.6, { gain: (gain || 0.22) * 0.35, attack: 0.004 });
    tone(freq * 3.98, start, dur * 0.3, { gain: (gain || 0.22) * 0.12, attack: 0.002 });
  }

  var KEY_NOTES = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5, 1174.66, 1318.5];

  var sfx = {
    key: function (i) {
      if (!wake() || muted) return;
      var t = now(), f = KEY_NOTES[(i | 0) % KEY_NOTES.length];
      tone(f, t, 0.16, { gain: 0.24, slide: f * 1.5 });
      noise(t, 0.03, { freq: 4000, gain: 0.08 });
    },
    soft: function () { if (!wake() || muted) return; var t = now(); tone(420, t, 0.12, { gain: 0.18, slide: 300 }); },
    wrong: function () {
      if (!wake() || muted) return;
      var t = now();
      tone(330, t, 0.18, { type: 'triangle', gain: 0.22 });
      tone(247, t + 0.16, 0.32, { type: 'triangle', gain: 0.22, slide: 200 });
    },
    unlock: function () {
      if (!wake() || muted) return;
      var t = now();
      [1046.5, 1318.5, 1568, 2093].forEach(function (f, i) { bell(f, t + i * 0.08, 0.9, 0.16); });
      noise(t, 0.6, { type: 'highpass', freq: 6000, gain: 0.05 });
    },
    yes: function () {
      if (!wake() || muted) return;
      var t = now();
      [784, 988, 1175, 1568].forEach(function (f, i) { bell(f, t + i * 0.06, 0.7, 0.14); });
      noise(t, 0.5, { freq: 1200, sweep: 6000, gain: 0.08 });
    },
    no: function () {
      if (!wake() || muted) return;
      var t = now();
      tone(220, t, 0.3, { type: 'sawtooth', gain: 0.12, filter: 900, slide: 196 });
      tone(185, t + 0.3, 0.55, { type: 'sawtooth', gain: 0.12, filter: 800, slide: 150 });
    },
    pop: function () {
      if (!wake() || muted) return;
      var t = now();
      tone(900 + Math.random() * 500, t, 0.09, { gain: 0.12, slide: 1800 });
    },
    crack: function () {
      if (!wake() || muted) return;
      var t = now();
      noise(t, 0.08, { type: 'highpass', freq: 2500, gain: 0.3 });
      noise(t + 0.05, 0.12, { freq: 900, gain: 0.18 });
      tone(120, t, 0.16, { gain: 0.25, slide: 60 });
    },
    paper: function () {
      if (!wake() || muted) return;
      var t = now();
      for (var i = 0; i < 6; i++) noise(t + i * 0.09 + Math.random() * 0.04, 0.12 + Math.random() * 0.08, { freq: 2600 + Math.random() * 2400, q: 0.6, gain: 0.1 + Math.random() * 0.06 });
    },
    puff: function () {
      if (!wake() || muted) return;
      var t = now();
      noise(t, 0.45, { type: 'lowpass', freq: 1400, sweep: 300, gain: 0.22, attack: 0.03 });
    },
    firework: function () {
      if (!wake() || muted) return;
      var t = now();
      noise(t, 0.5, { type: 'lowpass', freq: 900, sweep: 120, gain: 0.3 });
      for (var i = 0; i < 6; i++) noise(t + 0.15 + Math.random() * 0.5, 0.05, { type: 'highpass', freq: 5000, gain: 0.08 });
    },
    fanfare: function () {
      if (!wake() || muted) return;
      var t = now();
      [[523.25, 0], [659.25, 0.14], [783.99, 0.28], [1046.5, 0.42], [783.99, 0.62], [1046.5, 0.76]].forEach(function (n) {
        tone(n[0], t + n[1], n[1] > 0.7 ? 0.9 : 0.24, { type: 'sawtooth', gain: 0.07, filter: 2400 });
        bell(n[0] * 2, t + n[1], 0.5, 0.06);
      });
    },
  };

  /* --------------------------------------------- the music-box song */
  // "Happy Birthday to You" — the melody is in the public domain.
  var G4 = 392, A4 = 440, B4 = 493.88, C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46, G5 = 783.99;
  var MELODY = [
    [G4, .75], [G4, .25], [A4, 1], [G4, 1], [C5, 1], [B4, 2],
    [G4, .75], [G4, .25], [A4, 1], [G4, 1], [D5, 1], [C5, 2],
    [G4, .75], [G4, .25], [G5, 1], [E5, 1], [C5, 1], [B4, 1], [A4, 2],
    [F5, .75], [F5, .25], [E5, 1], [C5, 1], [D5, 1], [C5, 3],
  ];
  var BEAT = 0.42;
  var LOOP = MELODY.reduce(function (s, n) { return s + n[1]; }, 0) * BEAT + 1.2;
  var box = { playing: false, timer: 0, startedAt: 0 };

  function scheduleLoop(at) {
    var t = at;
    MELODY.forEach(function (n) {
      var d = n[1] * BEAT;
      tone(n[0], t, Math.max(0.6, d * 1.6), { gain: 0.2, attack: 0.004, bus: songBus });
      tone(n[0] * 2, t, 0.5, { gain: 0.06, attack: 0.003, bus: songBus });
      tone(n[0] / 2, t, d, { type: 'triangle', gain: 0.05, bus: songBus });
      t += d;
    });
  }

  var musicBox = {
    start: function () {
      if (!wake() || box.playing) return;
      box.playing = true;
      box.startedAt = now() + 0.05;
      var next = box.startedAt;
      var tick = function () {
        if (!box.playing) return;
        scheduleLoop(next);
        next += LOOP;
        box.timer = setTimeout(tick, Math.max(200, (next - now() - 1) * 1000));
      };
      tick();
    },
    stop: function () {
      box.playing = false; clearTimeout(box.timer);
      if (ctx && songBus) {
        // Cut what is already scheduled, then restore the bus for the next start.
        var g = songBus.gain, t = now();
        g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.0001, t + 0.12);
        var old = songBus;
        songBus = ctx.createGain(); songBus.gain.value = duckLevel; songBus.connect(master);
        setTimeout(function () { try { old.disconnect(); } catch (e) {} }, 300);
      }
    },
    get playing() { return box.playing; },
    progress: function () { return box.playing ? ((now() - box.startedAt) % LOOP) / LOOP : 0; },
  };

  /* ----------------------------------------------- media elements */
  var routed = typeof WeakMap === 'function' ? new WeakMap() : null;
  function route(el, kind) {
    if (!wake() || !el || !routed) return false;
    if (routed.has(el)) return true;
    try {
      var src = ctx.createMediaElementSource(el);
      src.connect(kind === 'voice' ? voiceBus : songBusProxy());
      routed.set(el, src);
      return true;
    } catch (e) { return false; }
  }
  // Uploaded songs go through a stable gain (the music box swaps its own bus on stop).
  var songElBus = null;
  function songBusProxy() {
    if (!songElBus) { songElBus = ctx.createGain(); songElBus.gain.value = 1; songElBus.connect(master); }
    return songElBus;
  }

  var duckLevel = 1;
  function duck(on) {
    duckLevel = on ? 0.22 : 1;
    if (ctx) {
      [songBus, songElBus].forEach(function (bus) {
        if (!bus) return;
        var t = now();
        bus.gain.cancelScheduledValues(t);
        bus.gain.setValueAtTime(bus.gain.value, t);
        bus.gain.linearRampToValueAtTime(duckLevel, t + 0.6);
      });
    }
    var song = document.querySelector('.bp-audio-song');
    if (song && !(routed && routed.has(song))) song.volume = on ? 0.25 : 1; // desktop fallback
  }

  function levels(out) {
    if (!analyser) return null;
    var data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    for (var i = 0; i < out.length; i++) out[i] = data[Math.min(data.length - 1, 1 + Math.floor(i * (data.length - 2) / out.length))] / 255;
    return out;
  }

  function setMuted(v) {
    muted = !!v;
    try { localStorage.setItem('bp-sfx-muted', muted ? '1' : '0'); } catch (e) {}
    if (sfxBus) sfxBus.gain.value = muted ? 0 : 0.55;
  }

  window.BPSound = {
    wake: wake, sfx: sfx, musicBox: musicBox, route: route, duck: duck, levels: levels,
    get muted() { return muted; }, setMuted: setMuted,
    get ready() { return !!ctx; },
  };
})();
