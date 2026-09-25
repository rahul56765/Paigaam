/* Lajja — The Unrejectable Card
 * Ported 1:1 from t4-unrejectable.html (Boyfriend Day family).
 *
 * Interactions (timings and thresholds unchanged):
 *   · pointerdown / touchstart on No → dodge to a random safe position,
 *     shrink No and grow Yes. Caption updates through 4 stages.
 *   · After MAX_DODGES (5) attempts No gives up: opacity 0.4, resigned
 *     caption. Clicking the tired button shows the no-message.
 *   · Keyboard path (Enter/Space on No, detail === 0) → straight to give-up.
 *   · Yes → iOS-safe vibrate, confetti burst (2 s), then celebration screen.
 *
 * Reduced motion: CSS transitions collapse to none; confetti is skipped;
 * the screen swap is immediate (60ms).
 *
 * Safe-zone constraints: the no-wrap is positioned fixed and teleported to
 * a random spot at least EDGE px from every viewport edge and at least PAD
 * px clear of the Yes button and the question text. If 200 random candidates
 * all collide, it parks at the bottom-centre of the viewport.
 *
 * Sender data comes from the #ucPayload JSON element (giveUpCaption only;
 * everything else is already server-rendered).
 */
(function () {
  'use strict';

  /* ---- read payload ---- */
  var payloadEl = document.getElementById('ucPayload');
  var payload = {};
  if (payloadEl) {
    try { payload = JSON.parse(payloadEl.textContent); } catch (e) {}
  }
  var GIVE_UP_CAPTION = (payload && payload.giveUpCaption) || 'fine, i\'ll just be here';

  /* ---- element references ---- */
  var yesBtn    = document.getElementById('ucYesBtn');
  var noBtn     = document.getElementById('ucNoBtn');
  var noWrap    = document.getElementById('ucNoWrap');
  var caption   = document.getElementById('ucNoCaption');
  var question  = document.getElementById('ucQuestionBlock');
  var buttonRow = document.getElementById('ucButtonRow');
  var noMessage = document.getElementById('ucNoMessage');
  var askScreen = document.getElementById('ucAskScreen');
  var celebrate = document.getElementById('ucCelebrateScreen');

  /* bail cleanly if markup is missing */
  if (!yesBtn || !noBtn || !noWrap || !caption || !question ||
      !buttonRow || !noMessage || !askScreen || !celebrate) return;

  /* ---- constants ---- */
  var STAGES     = ['no', 'are you sure?', 'really?', 'the button is shy', "it's decided"];
  var EDGE       = 18;   // min px from every viewport edge
  var PAD        = 14;   // breathing room around forbidden zones
  var MAX_DODGES = 5;
  var EASE       = 'cubic-bezier(.22,1,.36,1)';

  /* ---- state ---- */
  var reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var dodges   = 0;
  var givenUp  = false;
  var isFixed  = false;
  var yesScale = 1;

  /* ---- No button: dodge + give-up ---- */

  function rectOf(el, pad) {
    var r = el.getBoundingClientRect();
    return { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
  }

  function hits(box, f) {
    return box.x < f.x + f.w && box.x + box.w > f.x &&
           box.y < f.y + f.h && box.y + box.h > f.y;
  }

  function ensureFixed() {
    if (isFixed) return;
    var r = noWrap.getBoundingClientRect();
    noWrap.style.position  = 'fixed';
    noWrap.style.left      = r.left + 'px';
    noWrap.style.top       = r.top  + 'px';
    noWrap.style.margin    = '0';
    noWrap.style.zIndex    = '50';
    noWrap.style.transition = reducedMotion ? 'none'
      : 'left .25s ' + EASE + ', top .25s ' + EASE + ', transform .25s ' + EASE;
    isFixed = true;
  }

  function teleport() {
    ensureFixed();
    /* measure forbidden zones AFTER the wrap is out of flow */
    var forbidden = [rectOf(yesBtn, PAD), rectOf(question, PAD)];
    var r  = noWrap.getBoundingClientRect();
    var w  = r.width;
    var h  = r.height;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var spot = null;
    for (var i = 0; i < 200; i++) {
      var x   = EDGE + Math.random() * Math.max(1, vw - w - EDGE * 2);
      var y   = EDGE + Math.random() * Math.max(1, vh - h - EDGE * 2);
      var box = { x: x, y: y, w: w, h: h };
      var ok  = true;
      for (var j = 0; j < forbidden.length; j++) {
        if (hits(box, forbidden[j])) { ok = false; break; }
      }
      if (ok) { spot = { x: x, y: y }; break; }
    }
    /* fallback: bottom-centre, always inside viewport */
    if (!spot) spot = { x: vw / 2 - w / 2, y: vh - h - EDGE };
    noWrap.style.left = spot.x + 'px';
    noWrap.style.top  = spot.y + 'px';
  }

  function shrinkNo() {
    var s = Math.max(0.8, 1 - 0.04 * dodges);
    noWrap.style.transform = 'scale(' + s + ')';
  }

  function growYes() {
    yesScale = Math.min(1.4, 1 + 0.08 * dodges);
    yesBtn.style.transform = 'scale(' + yesScale + ')';
  }

  /* pointerdown / touchstart: dodge BEFORE the tap can land */
  function dodge(e) {
    if (givenUp) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dodges++;
    if (dodges >= MAX_DODGES) { giveUp(); return; }
    teleport();
    shrinkNo();
    growYes();
    caption.textContent = STAGES[Math.min(dodges, STAGES.length - 1)];
  }

  function giveUp() {
    givenUp = true;
    teleport(); /* park somewhere valid one last time */
    noWrap.style.opacity = '0.4';
    caption.textContent  = GIVE_UP_CAPTION;
  }

  noBtn.addEventListener('pointerdown', dodge);
  noBtn.addEventListener('touchstart', function (e) {
    if (!givenUp) e.preventDefault();
  }, { passive: false });

  /* click = keyboard Enter/Space (detail === 0) OR a stray tap after a dodge */
  noBtn.addEventListener('click', function (e) {
    if (givenUp) { showNoMessage(); return; }
    if (e.detail === 0) { giveUp(); return; } /* keyboard path → straight to give-up */
    /* pointer tap: the button already dodged via pointerdown; nothing to do */
  });

  function showNoMessage() {
    buttonRow.hidden  = true;
    noMessage.hidden  = false;
  }

  /* ---- Yes: haptics + confetti + celebration ---- */

  yesBtn.addEventListener('click', function () {
    if ('vibrate' in navigator) {
      try { navigator.vibrate([40, 60, 40]); } catch (err) {}
    }
    if (!reducedMotion) confettiBurst();
    var delay = reducedMotion ? 60 : 1000;
    setTimeout(function () {
      askScreen.hidden     = true;
      celebrate.hidden     = false;
      window.scrollTo(0, 0);
    }, delay);
  });

  function confettiBurst() {
    var canvas = document.getElementById('ucConfetti');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    var colors = ['#B85C48', '#C9A86A', '#F2C4BC', '#2B2118', '#E8956D'];
    var parts  = [];
    var n      = 70;
    for (var i = 0; i < n; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 4 + Math.random() * 7;
      parts.push({
        x: canvas.width  / 2,
        y: canvas.height * 0.5,
        vx:    Math.cos(angle) * speed,
        vy:    Math.sin(angle) * speed - 6,
        size:  4 + Math.random() * 6,
        rot:   Math.random() * Math.PI,
        vr:    (Math.random() - 0.5) * 0.3,
        color: colors[i % colors.length],
        shape: Math.random() < 0.5 ? 'rect' : 'circle',
      });
    }
    var start    = performance.now();
    var DURATION = 2000;
    function frame(t) {
      var age = (t - start) / DURATION;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.vy += 0.18;   /* gravity */
        p.vx *= 0.99;   /* air drag */
        p.x  += p.vx;
        p.y  += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - age);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (age < 1) { requestAnimationFrame(frame); }
      else { ctx.clearRect(0, 0, canvas.width, canvas.height); }
    }
    requestAnimationFrame(frame);
  }
})();
