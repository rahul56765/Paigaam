'use strict';
/**
 * Love Awaits — the mechanic.
 *
 * Ported from ft976/97 ("Love Awaits"): the tap-to-begin gate, the six-message
 * plea ladder, the dodging No button, the Yes burst and the remembered
 * celebration. The personalised copy, image paths and labels come from the
 * server-rendered #lawPayload JSON block.
 *
 * The original drove the background with three.js (7,000-point particle heart
 * condensing over 4.5s, then breathing) and the burst with GSAP. Both are
 * re-expressed here on hand-rolled canvas with the same constants; the
 * soundtrack is a generative Web Audio score (the original's commercial MP3
 * is not redistributable).
 */
(function () {
  var body = document.body;
  if (!body || !body.classList.contains('law')) return;

  var payloadNode = document.getElementById('lawPayload');
  var CFG = { who: 'you', sender: '', introTitle: 'Love Awaits', ladder: [], images: [], alts: [], yesLabel: 'Yes, Forever', noLabel: 'No', finaleTitle: 'Forever & Always', finaleLine: '' };
  try { CFG = Object.assign(CFG, JSON.parse(payloadNode ? payloadNode.textContent : '{}') || {}); } catch (e) { /* defaults hold */ }

  var DODGE_RANGE = 350;   // gsap.random(-350..350) — the dodge amplitude
  var LAST_RUNG = 5;       // messages 0..5; at rung 5 the No button dodges
  var BURST_COUNT = 100;   // the Yes burst, same as the original

  var gate = document.getElementById('lawGate');
  var asking = document.getElementById('lawAsking');
  var success = document.getElementById('lawSuccess');
  var image = document.getElementById('lawImage');
  var msgTitle = document.getElementById('lawMsgTitle');
  var msgNote = document.getElementById('lawMsgNote');
  var yesButton = document.getElementById('lawYes');
  var noButton = document.getElementById('lawNo');
  var buttons = document.getElementById('lawButtons');
  var replayButton = document.getElementById('lawReplay');
  var confettiCanvas = document.getElementById('lawConfetti');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var inFrame = window !== window.parent; // collection thumbnails autoplay quietly

  var FOREVER_KEY = 'law_forever_' + (CFG.who || 'you').slice(0, 40).toLowerCase();

  var idx = 0;
  var started = false;
  var said = false;
  var music = null;

  /* ----------------------------------------------------- the particle heart */

  var HEART_POINTS = 7000;
  var SPREAD = 150;
  var HEART_SCALE = 0.65;

  /** The original's parametric heart curve (three.js scene, y-up) — canvas y is down. */
  function heartXY(t, out) {
    out.x = 16 * Math.pow(Math.sin(t), 3);
    out.y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return out;
  }

  function startHeart() {
    var canvas = document.getElementById('lawHeart');
    if (!canvas || !canvas.getContext) return { stop: function () {} };
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var width = 0, height = 0, cx = 0, cy = 0, unit = 1;

    function fit() {
      width = window.innerWidth; height = window.innerHeight;
      canvas.width = width * dpr; canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = width / 2; cy = height / 2;
      unit = Math.min(width, height) / 38; // camera z=35 framing, roughly
    }
    fit();
    window.addEventListener('resize', fit);

    // points[i] = { sx, sy, sz, tx, ty, r (radial jitter), mix, depth }
    var points = new Array(HEART_POINTS);
    var seedT = 0;
    for (var i = 0; i < HEART_POINTS; i++) {
      seedT = Math.random() * Math.PI * 2;
      var h = heartXY(seedT, { x: 0, y: 0 });
      var r = 1 + Math.pow(Math.random(), 3) * 0.8;
      points[i] = {
        sx: (Math.random() - 0.5) * SPREAD, sy: (Math.random() - 0.5) * SPREAD, sz: (Math.random() - 0.5) * SPREAD,
        tx: h.x * r * HEART_SCALE, ty: -h.y * r * HEART_SCALE, tz: (Math.random() - 0.5) * 6 * r,
        mix: Math.random(), depth: Math.random(),
      };
    }

    var COLORS = [[255, 0, 64], [255, 183, 197]]; // c1 0xff0040, c2 0xffb7c5

    var FORMING_MS = 4500; // gsap "slow" ease approximated with a smoothstep
    var start = performance.now();
    var running = true;
    var paused = false;
    var time = 0;
    var last = start;

    function frame(now) {
      if (!running) return;
      if (!paused) {
        var dt = Math.min(now - last, 100); last = now;
        time += dt * 0.005;
      } else {
        last = now;
      }
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      var k = Math.min((now - start) / FORMING_MS, 1);
      k = k * k * (3 - 2 * k); // smoothstep ≈ gsap slow(0.7,0.7) feel
      var breathe = 1 + Math.sin(time * 5) * 0.03;
      var sway = Math.sin(time) * 0.1;
      var cos = Math.cos(sway), sin = Math.sin(sway);

      var size = Math.max(0.7, 0.2 * unit * breathe);
      for (var i = 0; i < HEART_POINTS; i++) {
        var p = points[i];
        var px = (p.sx + (p.tx - p.sx) * k) * breathe;
        var py = (p.sy + (p.ty - p.sy) * k) * breathe;
        var pz = (p.sz + (p.tz - p.sz) * k);
        var rx = px * cos - pz * sin;
        // depth falloff instead of a projection matrix
        var z = (pz * cos + px * sin) + 35;
        if (z < 4) continue;
        var persp = 35 / z;
        var c = COLORS[p.mix <= 0.5 ? 0 : 1];
        var alpha = (0.85 * persp * (0.4 + p.depth * 0.6)) * (0.4 + 0.6 * k);
        if (alpha <= 0.02) continue;
        ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha.toFixed(3) + ')';
        ctx.fillRect(cx + rx * unit * persp * (35 / 35) - size / 2, cy + py * unit * persp - size / 2, size, size);
      }
      requestAnimationFrame(frame);
    }
    if (reduced) {
      // draw the finished heart once, static
      time = 0.4;
      start = performance.now() - FORMING_MS - 1;
    }
    requestAnimationFrame(frame);

    return {
      pause: function () { paused = true; },
      resume: function () { last = performance.now(); paused = false; },
      stop: function () { running = false; },
    };
  }

  var heart = null;
  if (!reduced || true) heart = startHeart(); // reduced draws a single settled frame
  if (document.hidden && heart) heart.pause();
  document.addEventListener('visibilitychange', function () {
    if (!heart) return;
    if (document.hidden) heart.pause(); else heart.resume();
  });

  /* --------------------------------------------------------- floating decor */

  var DECOR = ['💕', '💖', '💗', '💓', '💝', '💋', '✨', '🌹'];

  function startDecor() {
    var host = document.getElementById('lawDecor');
    if (!host) return;
    for (var i = 0; i < 20; i++) {
      var el = document.createElement('div');
      el.className = 'law-float';
      el.textContent = DECOR[Math.floor(Math.random() * DECOR.length)];
      el.style.left = (Math.random() * 100) + 'vw';
      el.style.animationDelay = '-' + (Math.random() * 15).toFixed(1) + 's';
      el.style.animationDuration = (10 + Math.random() * 10).toFixed(1) + 's';
      el.style.fontSize = (20 + Math.random() * 20).toFixed(0) + 'px';
      host.appendChild(el);
    }
  }
  startDecor();

  /* --------------------------------------------------------------- the score */

  function startScore() {
    try {
      var AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      var audio = new AudioCtor();
      var master = audio.createGain();
      master.gain.value = 0.0;
      master.connect(audio.destination);
      master.gain.linearRampToValueAtTime(0.14, audio.currentTime + 2.5);

      // F major pad: F2, C3, F3, A3 — slow detuned saws through a low-pass.
      var filter = audio.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      filter.Q.value = 0.4;
      filter.connect(master);
      var pad = [87.31, 130.81, 174.61, 220.0];
      pad.forEach(function (freq, i) {
        var osc = audio.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq * (1 + (i % 2 ? 0.0015 : -0.0015));
        var g = audio.createGain();
        g.gain.value = 0.05;
        osc.connect(g); g.connect(filter);
        osc.start();
      });

      // a music-box bell: F major pentatonic, one note every 1.9s
      var BELLS = [698.46, 783.99, 880.0, 1046.5, 1174.66];
      var next = audio.currentTime + 0.5;
      function bell() {
        if (!running_) return;
        var osc = audio.createOscillator();
        var g = audio.createGain();
        osc.type = 'sine';
        osc.frequency.value = BELLS[Math.floor(Math.random() * BELLS.length)];
        g.gain.setValueAtTime(0.0001, next);
        g.gain.exponentialRampToValueAtTime(0.09, next + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, next + 2.2);
        osc.connect(g); g.connect(master);
        osc.start(next); osc.stop(next + 2.4);
        next += 1.9;
        setTimeout(bell, 1900);
      }
      var running_ = true;
      bell();

      return {
        mute: function () { master.gain.linearRampToValueAtTime(0.0, audio.currentTime + 0.3); },
        unmute: function () { master.gain.linearRampToValueAtTime(0.14, audio.currentTime + 0.3); },
        stop: function () { running_ = false; try { audio.close(); } catch (e) {} },
      };
    } catch (e) { return null; }
  }

  var muted = false;
  function setupMute() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'law-mute';
    btn.setAttribute('aria-label', 'Mute the music');
    btn.textContent = '♪';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      muted = !muted;
      btn.textContent = muted ? '♪̶' : '♪';
      btn.setAttribute('aria-label', muted ? 'Unmute the music' : 'Mute the music');
      if (music) (muted ? music.mute() : music.unmute());
    });
    body.appendChild(btn);
  }

  /* ------------------------------------------------------------ the confetti */

  function burst() {
    if (!confettiCanvas || !confettiCanvas.getContext) return;
    var canvas = confettiCanvas;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr; canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var w = window.innerWidth, h = window.innerHeight;
    var COLORS = ['#f06', '#fff'];
    var parts = [];
    for (var i = 0; i < BURST_COUNT; i++) {
      var angle = Math.random() * Math.PI * 2;
      var dist = 150 + Math.random() * 400;
      parts.push({
        x: w / 2, y: h / 2,
        vx: Math.cos(angle) * dist / 1.5, vy: Math.sin(angle) * dist / 1.5,
        life: 1.5, color: COLORS[Math.random() > 0.5 ? 0 : 1],
        size: 6 + Math.random() * 4,
      });
    }
    var start = performance.now();
    function frame(now) {
      var t = (now - start) / 1000;
      ctx.clearRect(0, 0, w, h);
      var alive = false;
      for (var j = 0; j < parts.length; j++) {
        var p = parts[j];
        var px = p.x + p.vx * t * (1 - 0.35 * t); // power2.out approximation
        var py = p.y + p.vy * t * (1 - 0.35 * t) + 60 * t * t;
        var alpha = 1 - t / p.life;
        if (alpha <= 0) continue;
        alive = true;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, p.size * (0.4 + 0.6 * alpha), 0, Math.PI * 2);
        ctx.fill();
      }
      if (alive) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, w, h);
    }
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------- the scene machine */

  function show(stage) {
    [gate, asking, success].forEach(function (s) { if (s) s.hidden = s !== stage; });
  }

  function ladderRung(i) {
    var rung = CFG.ladder[i] || CFG.ladder[CFG.ladder.length - 1] || { t: '', s: '' };
    if (msgTitle) msgTitle.textContent = rung.t;
    if (msgNote) msgNote.textContent = rung.s; // textContent — never markup
  }

  function begin() {
    if (started) return;
    started = true;
    music = startScore();
    if (music && inFrame) music.mute(); // thumbnails stay quiet
    if (music && muted) music.mute();
    if (!inFrame) setupMute();
    body.classList.add('is-begun');
    ladderRung(0);
    show(asking);
  }

  function resist() {
    if (idx >= LAST_RUNG) return;
    idx++;
    ladderRung(idx);
    if (image) {
      image.src = CFG.images[Math.min(idx, CFG.images.length - 1)];
      image.alt = CFG.alts[Math.min(idx, CFG.alts.length - 1)];
    }
  }

  function dodge(e) {
    if (idx < LAST_RUNG || !noButton) return;
    noButton.classList.add('is-dodging');
    var dx = (Math.random() - 0.5) * DODGE_RANGE;
    var dy = (Math.random() - 0.5) * DODGE_RANGE;
    noButton.style.transform = 'translate(' + dx.toFixed(0) + 'px,' + dy.toFixed(0) + 'px)';
  }

  function sayYes() {
    if (said) return;
    said = true;
    try { localStorage.setItem(FOREVER_KEY, 'true'); } catch (e) { /* private mode: the night just won't be remembered */ }
    body.classList.add('is-success');
    show(success);
    if (music) music.unmute();
    burst();
  }

  function replay() {
    try { localStorage.removeItem(FOREVER_KEY); } catch (e) { /* ignore */ }
    window.location.reload();
  }

  /* ---------------------------------------------------------------- wiring */

  if (gate) gate.addEventListener('click', begin);
  if (noButton) {
    noButton.addEventListener('click', resist);
    noButton.addEventListener('mouseenter', dodge);
    noButton.addEventListener('touchstart', dodge, { passive: true });
  }
  if (yesButton) yesButton.addEventListener('click', sayYes);
  if (replayButton) replayButton.addEventListener('click', replay);

  // The original remembers the answer: returning visitors land on the finale.
  var remembered = false;
  try { remembered = localStorage.getItem(FOREVER_KEY) === 'true'; } catch (e) { /* ignore */ }
  if (remembered) {
    started = true;
    body.classList.add('is-begun', 'is-success');
    show(success);
    var beginMusic = function () {
      if (music) return;
      music = startScore();
      if (music && inFrame) music.mute();
      if (!inFrame) setupMute();
      window.removeEventListener('pointerdown', beginMusic);
    };
    window.addEventListener('pointerdown', beginMusic); // audio needs a gesture
  }
})();
