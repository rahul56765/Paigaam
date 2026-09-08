'use strict';
/**
 * Valentine "Say Yes" — the mechanic.
 *
 * Ported 1:1 from CodeKageHQ/Ask-out-your-Valentine: MAX_NO_CLICKS = 5,
 * GROWTH_PER_CLICK = 35, FONT_GROWTH_PER_CLICK = 25, the same plea ladder and
 * the same celebration. The copy, image paths and labels come from the
 * server-rendered #vyPayload JSON block ( personalised per Paigaam ).
 *
 * The heart confetti re-implements the canvas-confetti heart burst the
 * original used: the same heart path, drawn on a hand-rolled canvas
 * simulation at scalar 2/3/4, pink on pink.
 */
(function () {
  var body = document.body;
  if (!body || !body.classList.contains('vy')) return;

  var payloadNode = document.getElementById('vyPayload');
  var CFG = { images: [], alts: [], pleas: ['No'], yesLabel: 'Yes', question: '', celebration: 'Yayyy!! :3' };
  try { CFG = JSON.parse(payloadNode ? payloadNode.textContent : '{}') || CFG; } catch (e) { /* defaults hold */ }

  var GROWTH_PER_CLICK = 35;
  var FONT_GROWTH_PER_CLICK = 25;
  var MAX_NO_CLICKS = 5;

  var BASE_HEIGHT = 48;
  var BASE_WIDTH = 80;
  var BASE_FONT = 20;

  var image = document.getElementById('vyImage');
  var question = document.getElementById('vyQuestion');
  var yesButton = document.getElementById('vyYes');
  var noButton = document.getElementById('vyNo');
  var buttons = document.getElementById('vyButtons');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var inFrame = window !== window.parent; // collection thumbnails autoplay quietly

  var noClickCount = 0;
  var buttonHeight = BASE_HEIGHT;
  var buttonWidth = BASE_WIDTH;
  var fontSize = BASE_FONT;
  var said = false;

  /* ------------------------------------------------------------- the "No" ladder */

  function resist() {
    if (noClickCount >= MAX_NO_CLICKS) return;
    noClickCount++;

    if (image) {
      image.src = CFG.images[Math.min(noClickCount, CFG.images.length - 1)];
      image.alt = CFG.alts[Math.min(noClickCount, CFG.alts.length - 1)];
    }

    // Grow the "Yes" button to make it harder to ignore.
    buttonHeight += GROWTH_PER_CLICK;
    buttonWidth += GROWTH_PER_CLICK;
    fontSize += FONT_GROWTH_PER_CLICK;

    if (yesButton) {
      // The card is width-capped, so the growth reads on any screen while
      // still refusing to be ignored.
      var scale = (BASE_FONT + FONT_GROWTH_PER_CLICK * noClickCount) / BASE_FONT;
      yesButton.style.setProperty('--vy-scale', scale.toFixed(3));
      yesButton.style.height = Math.min(buttonHeight, 140) + 'px';
      yesButton.style.width = Math.min(buttonWidth, 210) + 'px';
    }

    if (noButton) noButton.textContent = CFG.pleas[Math.min(noClickCount, CFG.pleas.length - 1)];
  }

  /* ---------------------------------------------------------- the celebration */

  var CONFETTI_COLORS = ['#ff69b4', '#ff1493', '#ff6b81', '#e84393'];

  function celebrate() {
    if (said) return;
    said = true;

    if (image) {
      image.src = CFG.images[CFG.images.length - 1];
      image.alt = CFG.alts[CFG.alts.length - 1];
    }
    if (question) question.textContent = CFG.celebration;
    if (buttons) buttons.style.display = 'none';
    body.classList.add('is-celebrating');
    startConfetti();
  }

  /* ------------------------------------------------------- confetti · canvas */

  var HEART_PATH = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

  /** Trace the heart path into a set of points (normalised to a 24×24 box). */
  function heartPoints(count) {
    var canvas = document.createElement('canvas');
    canvas.width = 24; canvas.height = 24;
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return null;
    var path = new Path2D(HEART_PATH);
    var points = [];
    for (var i = 0; i < count; i++) {
      // Sample the filled heart by rejection sampling.
      var x, y, inside = false, guard = 0;
      while (!inside && guard++ < 40) {
        x = Math.random() * 24; y = Math.random() * 24;
        inside = ctx.isPointInPath(path, x, y);
      }
      points.push([x - 12, y - 12]);
    }
    return points;
  }

  var confettiRunning = false;
  var rafId = 0;

  function startConfetti() {
    var canvas = document.getElementById('vyConfetti');
    if (!canvas || confettiRunning || reduced) return;
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    confettiRunning = true;

    var width = 0, height = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
    function resize() {
      var rect = canvas.getBoundingClientRect();
      width = rect.width; height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    if (window.addEventListener) window.addEventListener('resize', resize);

    var shape = heartPoints(24);

    // Three bursts, exactly like the original: 50 particles at scalar 2,
    // 25 at 3, 10 at 4.
    var pieces = [];
    [[50, 2], [25, 3], [10, 4]].forEach(function (burst) {
      var count = burst[0], scalar = burst[1];
      for (var i = 0; i < count; i++) {
        pieces.push({
          x: width / 2 + (Math.random() - 0.5) * 60,
          y: height * 0.42 + (Math.random() - 0.5) * 40,
          vx: (Math.random() - 0.5) * 7,
          vy: -3 - Math.random() * 4,
          size: 6 * scalar * (0.8 + Math.random() * 0.4),
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.2,
          shape: shape && Math.random() < 0.7 ? shape[i % shape.length] : null,
        });
      }
    });

    var started = Date.now();
    function frame() {
      if (!confettiRunning) return;
      ctx.clearRect(0, 0, width, height);
      for (var i = 0; i < pieces.length; i++) {
        var p = pieces[i];
        p.vy += 0.02;              // gravity 0 in the original; ours is a feather fall
        p.vx *= 0.99;              // decay 0.94 per tick in the original, applied gently
        p.vy *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y > height + 30 || p.x < -40 || p.x > width + 40) continue;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape) {
          var half = p.size / 2;
          ctx.beginPath();
          for (var j = 0; j < p.shape.length; j++) {
            var px = p.shape[j][0] / 12 * half;
            var py = p.shape[j][1] / 12 * half;
            if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.82);
        }
        ctx.restore();
      }
      rafId = window.requestAnimationFrame(frame);
    }
    if (window.requestAnimationFrame) rafId = window.requestAnimationFrame(frame);
    // The celebration settles after eight seconds; the message keeps the stage.
    setTimeout(function () { confettiRunning = false; if (window.cancelAnimationFrame) window.cancelAnimationFrame(rafId); }, 8000);
  }

  /* --------------------------------------------------------------- listeners */

  if (noButton) noButton.addEventListener('click', resist);
  if (yesButton) {
    yesButton.addEventListener('click', function () { celebrate(); });
  }

  /* ------------------------------------------------- collection thumbnails */

  // When the card is a thumbnail (same-origin iframe on the collection page),
  // play the whole plea quietly, end to end.
  if (inFrame) {
    setTimeout(function () {
      for (var i = 0; i < MAX_NO_CLICKS; i++) resist();
      celebrate();
    }, 900);
  }
})();
