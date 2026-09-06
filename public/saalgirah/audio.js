/**
 * Saalgirah Audio Engine
 * ----------------------
 * Port of the Paigaam audio engine for the Saalgirah birthday-letter template.
 * Original: /src/components/paigaam/audioEngine.ts
 *
 * A small procedural romantic music + SFX engine built on raw Web Audio API.
 *
 * Music: soft music-box-like piano arpeggio + warm ambient pad + sub-bass.
 * SFX:   paper, chime/shimmer, soft click, sparkle, flame, whoosh, warm final chime.
 *
 * Designed to be lightweight, premium, and loop seamlessly between scenes.
 *
 * Exposes a single global: window.SaalgirahAudio
 */

(function () {
  "use strict";

  // ---- Internal state ----
  var ctx = null;
  var master = null;
  var musicBus = null;
  var sfxBus = null;

  var padOscs = [];
  var padGain = null;
  var bassOsc = null;
  var bassGain = null;

  var arpTimer = null;
  var scene = "calm";
  var started = false;
  var muted = false;

  // Pentatonic-friendly romantic progressions (frequencies in Hz)
  // Notes: C4=261.63, D4=293.66, E4=329.63, G4=392.00, A4=440.00, C5=523.25, D5=587.33, E5=659.25
  var progressions = {
    // Scene 1 — calm, music-box, sparse
    calm: [
      [523.25, 659.25, 783.99, 1046.5],
      [493.88, 587.33, 739.99, 987.77],
      [440.00, 523.25, 659.25, 880.00],
      [392.00, 493.88, 587.33, 783.99],
    ],
    // Scene 2 — quiet, slow, suspended
    reveal: [
      [392.00, 523.25, 659.25, 783.99],
      [440.00, 523.25, 659.25, 880.00],
      [349.23, 440.00, 523.25, 698.46],
      [392.00, 493.88, 587.33, 783.99],
    ],
    // Scene 3 — warmer, brighter
    birthday: [
      [523.25, 659.25, 783.99, 1046.5],
      [587.33, 698.46, 880.00, 1174.7],
      [659.25, 783.99, 987.77, 1318.5],
      [523.25, 659.25, 783.99, 1046.5],
    ],
    // Final — soft, intimate, slow
    love: [
      [440.00, 523.25, 659.25, 880.00],
      [392.00, 493.88, 587.33, 783.99],
      [349.23, 440.00, 523.25, 698.46],
      [440.00, 523.25, 659.25, 880.00],
    ],
  };

  var bassNotes = {
    calm:    [130.81, 130.81, 110.00, 98.00],    // C3, C3, A2, G2
    reveal:  [98.00, 110.00, 87.31, 98.00],      // G2, A2, F2, G2
    birthday:[130.81, 146.83, 164.81, 130.81],   // C3, D3, E3, C3
    love:    [110.00, 98.00, 87.31, 110.00],     // A2, G2, F2, A2
  };

  var tempoMs = {
    calm: 2400,
    reveal: 3200,
    birthday: 2000,
    love: 3600,
  };

  // ---- Helpers ----

  /** Get the AudioContext constructor, or null if unavailable. */
  function getCtxClass() {
    return (typeof window !== "undefined") &&
      (window.AudioContext || window.webkitAudioContext || null);
  }

  /** Initialize the audio context. Must be called from a user gesture. */
  function init() {
    return new Promise(function (resolve) {
      if (ctx) { resolve(); return; }
      var Ctx = getCtxClass();
      if (!Ctx) { resolve(); return; }
      try {
        ctx = new Ctx();
        var resumePromise = ctx.resume();
        var afterResume = function () {
          try {
            master = ctx.createGain();
            master.gain.value = muted ? 0 : 0.55;
            master.connect(ctx.destination);

            musicBus = ctx.createGain();
            musicBus.gain.value = 0.0;
            musicBus.connect(master);

            sfxBus = ctx.createGain();
            sfxBus.gain.value = 0.9;
            sfxBus.connect(master);
          } catch (e) {
            // ignore
          }
          resolve();
        };
        if (resumePromise && typeof resumePromise.then === "function") {
          resumePromise.then(afterResume, afterResume);
        } else {
          afterResume();
        }
      } catch (e) {
        resolve();
      }
    });
  }

  /** Resume the context if it is suspended (e.g. after an autoplay block). */
  function ensureRunning() {
    if (!ctx) return;
    if (ctx.state === "suspended") {
      try { ctx.resume(); } catch (e) { /* ignore */ }
    }
  }

  // ---- Private music helpers ----

  function playArpNote(freq) {
    if (!ctx || !musicBus) return;
    try {
      ensureRunning();
      var now = ctx.currentTime;
      var dur = tempoMs[scene] / 4000; // note length in seconds

      // Music-box-like: triangle + sine blend
      var osc1 = ctx.createOscillator();
      osc1.type = "triangle";
      osc1.frequency.value = freq;
      var osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = freq * 2; // octave up shimmer

      var g = ctx.createGain();
      var peak = 0.16;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(peak, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.9);

      var g2 = ctx.createGain();
      g2.gain.value = 0.25;
      osc2.connect(g2);
      g2.connect(g);

      osc1.connect(g);
      g.connect(musicBus);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + dur);
      osc2.stop(now + dur);
    } catch (e) { /* silence */ }
  }

  function playBassNote(freq) {
    if (!ctx || !bassGain || !bassOsc) return;
    try {
      ensureRunning();
      var now = ctx.currentTime;
      var dur = tempoMs[scene] / 1000;
      bassOsc.frequency.setTargetAtTime(freq, now, 0.2);
      bassGain.gain.cancelScheduledValues(now);
      bassGain.gain.setValueAtTime(0.0001, now);
      bassGain.gain.exponentialRampToValueAtTime(0.18, now + 0.3);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.85);
    } catch (e) { /* silence */ }
  }

  function makeArpTick(stepRef) {
    return function () {
      if (!ctx || !musicBus) return;
      try {
        var prog = progressions[scene];
        var bar = Math.floor(stepRef.step / 4) % prog.length;
        var idx = stepRef.step % 4;
        var note = prog[bar][idx];
        playArpNote(note);

        // Bass on beat 1 of each bar
        if (idx === 0) {
          var bassNote = bassNotes[scene][bar];
          playBassNote(bassNote);
        }
        stepRef.step++;
      } catch (e) { /* silence */ }
    };
  }

  // ---- Public API ----

  function isStarted() {
    return started;
  }

  function isMuted() {
    return muted;
  }

  function setMuted(m) {
    try {
      muted = !!m;
      if (!ctx || !master) return;
      var now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(muted ? 0 : 0.55, now, 0.15);
    } catch (e) { /* silence */ }
  }

  function toggleMute() {
    try {
      setMuted(!muted);
    } catch (e) { /* silence */ }
    return muted;
  }

  function setScene(s) {
    try {
      scene = s;
    } catch (e) { /* silence */ }
  }

  /** Start the ambient pad + arpeggio loop. */
  function startMusic() {
    return init().then(function () {
      try {
        if (!ctx || !musicBus || started) return;
        started = true;
        ensureRunning();

        var now = ctx.currentTime;

        // Fade music bus in
        musicBus.gain.cancelScheduledValues(now);
        musicBus.gain.setValueAtTime(0.0001, now);
        musicBus.gain.setTargetAtTime(0.5, now, 2.5);

        // ---- Ambient pad: 3 detuned sine oscillators at low volume ----
        padGain = ctx.createGain();
        padGain.gain.value = 0.08;
        padGain.connect(musicBus);

        // Soft lowpass on pad
        var padFilter = ctx.createBiquadFilter();
        padFilter.type = "lowpass";
        padFilter.frequency.value = 900;
        padFilter.Q.value = 0.6;
        padFilter.connect(padGain);

        var padFreqs = [130.81, 196.00, 261.63]; // C3, G3, C4
        padFreqs.forEach(function (f, i) {
          var osc = ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.value = f;
          // gentle detune for warmth
          osc.detune.value = (i - 1) * 6;
          var g = ctx.createGain();
          g.gain.value = i === 0 ? 0.6 : 0.35;
          osc.connect(g);
          g.connect(padFilter);
          osc.start();
          padOscs.push(osc);

          // Slow LFO on detune for breathing pad
          var lfo = ctx.createOscillator();
          lfo.frequency.value = 0.05 + i * 0.02;
          var lfoGain = ctx.createGain();
          lfoGain.gain.value = 3;
          lfo.connect(lfoGain);
          lfoGain.connect(osc.detune);
          lfo.start();
          padOscs.push(lfo);
        });

        // ---- Sub bass ----
        bassGain = ctx.createGain();
        bassGain.gain.value = 0.0;
        bassGain.connect(musicBus);
        bassOsc = ctx.createOscillator();
        bassOsc.type = "sine";
        bassOsc.frequency.value = 65.41; // C2
        bassOsc.connect(bassGain);
        bassOsc.start();

        // ---- Arpeggio loop ----
        var stepRef = { step: 0 };
        var tick = makeArpTick(stepRef);
        tick();
        arpTimer = setInterval(tick, tempoMs[scene] / 4);
      } catch (e) { /* silence on failure */ }
    }).catch(function () { /* silence */ });
  }

  /** Smoothly transition to a new scene (changes tempo + progression). */
  function transitionToScene(s) {
    try {
      if (!ctx) {
        scene = s;
        return;
      }
      scene = s;
      if (arpTimer !== null) {
        clearInterval(arpTimer);
        arpTimer = null;
      }
      // restart arpeggio with new tempo
      var stepRef = { step: 0 };
      var tick = makeArpTick(stepRef);
      tick();
      arpTimer = setInterval(tick, tempoMs[scene] / 4);
    } catch (e) { /* silence */ }
  }

  // ============== SFX ==============

  /** Soft paper rustle — filtered noise burst. */
  function sfxPaper() {
    if (!ctx || !sfxBus) return;
    try {
      ensureRunning();
      var now = ctx.currentTime;
      var dur = 0.55;

      var bufferSize = Math.floor(ctx.sampleRate * dur);
      var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < bufferSize; i++) {
        // pink-ish noise
        var t = i / bufferSize;
        data[i] = (Math.random() * 2 - 1) * (1 - t) * 0.6;
      }
      var src = ctx.createBufferSource();
      src.buffer = buffer;

      var filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1800;
      filter.Q.value = 0.7;

      var g = ctx.createGain();
      g.gain.value = 0.18;
      g.gain.setValueAtTime(0.22, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);

      src.connect(filter);
      filter.connect(g);
      g.connect(sfxBus);
      src.start(now);
      src.stop(now + dur);

      // Add a tiny high shimmer for "unfolding"
      var osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(1600, now + 0.4);
      var og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, now);
      og.gain.exponentialRampToValueAtTime(0.04, now + 0.1);
      og.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      osc.connect(og);
      og.connect(sfxBus);
      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) { /* silence */ }
  }

  /** Soft chime / shimmer for text reveal. */
  function sfxChime() {
    if (!ctx || !sfxBus) return;
    try {
      ensureRunning();
      var now = ctx.currentTime;
      var freqs = [880, 1108.73, 1318.51]; // A5, C#6, E6 (major triad shimmer)
      freqs.forEach(function (f, i) {
        var osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = f;
        var g = ctx.createGain();
        var start = now + i * 0.04;
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.12, start + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
        osc.connect(g);
        g.connect(sfxBus);
        osc.start(start);
        osc.stop(start + 1.0);
      });
    } catch (e) { /* silence */ }
  }

  /** Tiny soft click for buttons. */
  function sfxClick() {
    if (!ctx || !sfxBus) return;
    try {
      ensureRunning();
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.08, now + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.connect(g);
      g.connect(sfxBus);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) { /* silence */ }
  }

  /** Magical sparkle sound for birthday reveal. */
  function sfxSparkle() {
    if (!ctx || !sfxBus) return;
    try {
      ensureRunning();
      var now = ctx.currentTime;
      // ascending glitter
      var freqs = [523.25, 659.25, 783.99, 1046.5, 1318.51];
      freqs.forEach(function (f, i) {
        var osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = f;
        var g = ctx.createGain();
        var start = now + i * 0.06;
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.09, start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
        osc.connect(g);
        g.connect(sfxBus);
        osc.start(start);
        osc.stop(start + 0.75);
      });
    } catch (e) { /* silence */ }
  }

  /** Soft flame sound for candle. */
  function sfxFlame() {
    if (!ctx || !sfxBus) return;
    try {
      ensureRunning();
      var now = ctx.currentTime;
      var dur = 0.4;
      var bufferSize = Math.floor(ctx.sampleRate * dur);
      var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.15;
      }
      var src = ctx.createBufferSource();
      src.buffer = buffer;
      var filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 350;
      filter.Q.value = 0.5;
      var g = ctx.createGain();
      g.gain.value = 0.08;
      src.connect(filter);
      filter.connect(g);
      g.connect(sfxBus);
      src.start(now);
      src.stop(now + dur);
    } catch (e) { /* silence */ }
  }

  /** Soft whoosh for blowing out candles. */
  function sfxWhoosh() {
    if (!ctx || !sfxBus) return;
    try {
      ensureRunning();
      var now = ctx.currentTime;
      var dur = 0.7;
      var bufferSize = Math.floor(ctx.sampleRate * dur);
      var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < bufferSize; i++) {
        var t = i / bufferSize;
        // whoosh envelope: rise then fall
        var env = Math.sin(Math.PI * t);
        data[i] = (Math.random() * 2 - 1) * env;
      }
      var src = ctx.createBufferSource();
      src.buffer = buffer;
      var filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(400, now);
      filter.frequency.exponentialRampToValueAtTime(1200, now + dur);
      filter.Q.value = 0.8;
      var g = ctx.createGain();
      g.gain.value = 0.25;
      src.connect(filter);
      filter.connect(g);
      g.connect(sfxBus);
      src.start(now);
      src.stop(now + dur);
    } catch (e) { /* silence */ }
  }

  /** Warm final chime for the LOVE scene. */
  function sfxWarmChime() {
    if (!ctx || !sfxBus) return;
    try {
      ensureRunning();
      var now = ctx.currentTime;
      // Warm major chord swell
      var freqs = [261.63, 329.63, 392.00, 523.25]; // C4 E4 G4 C5
      freqs.forEach(function (f, i) {
        var osc = ctx.createOscillator();
        osc.type = i === 0 ? "sine" : "triangle";
        osc.frequency.value = f;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.1, now + 0.4);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 3.5);
        osc.connect(g);
        g.connect(sfxBus);
        osc.start(now);
        osc.stop(now + 3.6);
      });
      // Add a high shimmer
      var shimmer = ctx.createOscillator();
      shimmer.type = "sine";
      shimmer.frequency.value = 2093; // C7
      var sg = ctx.createGain();
      sg.gain.setValueAtTime(0.0001, now + 0.6);
      sg.gain.exponentialRampToValueAtTime(0.05, now + 0.9);
      sg.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
      shimmer.connect(sg);
      sg.connect(sfxBus);
      shimmer.start(now + 0.6);
      shimmer.stop(now + 3.0);
    } catch (e) { /* silence */ }
  }

  // ---- Expose global ----
  window.SaalgirahAudio = {
    startMusic: startMusic,
    setScene: setScene,
    transitionToScene: transitionToScene,
    isStarted: isStarted,
    isMuted: isMuted,
    setMuted: setMuted,
    toggleMute: toggleMute,
    sfxPaper: sfxPaper,
    sfxChime: sfxChime,
    sfxClick: sfxClick,
    sfxSparkle: sfxSparkle,
    sfxFlame: sfxFlame,
    sfxWhoosh: sfxWhoosh,
    sfxWarmChime: sfxWarmChime,
  };
})();
