'use strict';
/**
 * Sawaal — the small sound design, synthesised in Web Audio (no binary audio
 * is shipped; the original's meme MP3s were 7.9MB of personal music and are
 * deliberately not part of the template).
 *
 * startMusic(): a gentle music-box arpeggio loop, born of a user gesture.
 * no(): the sad slide-whistle on "not really". yes(): the celebratory donk.
 */
(function () {
  var ctx = null;
  var musicTimer = null;
  var step = 0;

  function audio() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    return ctx;
  }

  function note(freq, at, dur, gain, type) {
    var ac = audio();
    if (!ac) return;
    var osc = ac.createOscillator();
    var amp = ac.createGain();
    osc.type = type || 'triangle';
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(gain, at + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(amp); amp.connect(ac.destination);
    osc.start(at); osc.stop(at + dur + 0.05);
  }

  // A little pentatonic music-box loop — playful, never intrusive.
  var SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 783.99, 659.25, 587.33];

  window.SawaalSfx = {
    startMusic: function () {
      if (musicTimer) return;
      if (!audio()) return;
      var tick = function () {
        var ac = audio(); if (!ac) return;
        note(SCALE[step % SCALE.length], ac.currentTime, 0.32, 0.055);
        if (step % 4 === 0) note(SCALE[step % SCALE.length] / 2, ac.currentTime, 0.5, 0.035, 'sine');
        step++;
      };
      tick();
      musicTimer = setInterval(tick, 420);
    },
    stopMusic: function () {
      if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    },
    no: function () {
      this.stopMusic();
      var ac = audio(); if (!ac) return;
      var osc = ac.createOscillator();
      var amp = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ac.currentTime + 0.55);
      amp.gain.setValueAtTime(0.09, ac.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.6);
      osc.connect(amp); amp.connect(ac.destination);
      osc.start(); osc.stop(ac.currentTime + 0.65);
    },
    yes: function () {
      var ac = audio(); if (!ac) return;
      var at = ac.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach(function (freq, i) {
        note(freq, at + i * 0.09, 0.4, 0.09);
      });
    },
    donk: function () {
      var ac = audio(); if (!ac) return;
      note(880, ac.currentTime, 0.15, 0.07, 'square');
    },
  };
})();
