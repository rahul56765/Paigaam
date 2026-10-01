'use strict';
/**
 * Chamak — Disco Birthday (Boyfriend Day family). The night.
 *
 * Flow:
 *   ① ball     the mirror ball sways (animated layer 1), light dots drift
 *              up from the floor (animated layer 2 — the ONLY two loops),
 *              the name staggers in letter by letter, the marquee scrolls.
 *              "scroll" isn't needed — a cue-tap walks to the gift.
 *   ② gift     tap: rattle (0.6s) → swap to the open box → foil-rectangle
 *              confetti falls → auto-advance to the gallery.
 *   ③ gallery  photos in tilted gold frames, glitter stamps, scroll-snap.
 *   ④ wish     the VIP badge, the wish, the opt-in song chip, and
 *              "Celebrate again" (walks back to the ball, replays).
 *
 * The marquee + dot drift + ball sway are the two animated layers, hard
 * capped. Reduced motion stills them; the letter stagger collapses.
 */
(function () {

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var stages = {
    ball: document.getElementById('ball'),
    gift: document.getElementById('gift'),
    gallery: document.getElementById('gallery'),
    wish: document.getElementById('wish'),
  };
  var nameEl = document.getElementById('cmName');
  var dotsEl = document.getElementById('cmDots');
  var boxBtn = document.getElementById('cmBoxBtn');
  var boxImg = document.getElementById('cmBoxImg');
  var boxLine = document.getElementById('cmBoxLine');
  var confetti = document.getElementById('cmConfetti');
  var replayBtn = document.getElementById('cmReplayBtn');

  if (!stages.ball || !nameEl) return;

  function showStage(name) {
    Object.keys(stages).forEach(function (k) {
      var el = stages[k];
      if (!el) return;
      var on = k === name;
      el.hidden = !on;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    window.scrollTo(0, 0);
  }

  /* ---------- ① the name stagger + light dots ---------- */
  requestAnimationFrame(function () {
    nameEl.classList.add('is-in');
  });

  // animated layer 2: light dots drifting down from the ball
  function seedDots(n) {
    if (!dotsEl || reduceMotion) return;
    for (var i = 0; i < n; i++) {
      var dot = document.createElement('i');
      dot.style.left = (Math.random() * 100) + 'vw';
      dot.style.setProperty('--dx', ((Math.random() * 90 - 45)).toFixed(0) + 'px');
      var dur = 7 + Math.random() * 6;
      dot.style.animationDuration = dur + 's';
      dot.style.animationDelay = (-Math.random() * dur) + 's';
      if (Math.random() < 0.25) dot.style.background = 'radial-gradient(circle, rgba(255,79,163,.9), rgba(255,79,163,0))';
      dotsEl.appendChild(dot);
    }
  }
  seedDots(14);

  /* ball cue → gift: tap anywhere on the ball stage below the name walks on */
  stages.ball.addEventListener('click', function (e) {
    if (e.target.closest('.cm-marquee')) return;
    showStage('gift');
  });

  /* ---------- ② the gift box ---------- */
  var popped = false;
  if (boxBtn) boxBtn.addEventListener('click', function () {
    if (popped) return;
    popped = true;
    if (!reduceMotion) boxImg.classList.add('is-rattling');
    setTimeout(function () {
      boxImg.classList.remove('is-rattling');
      boxImg.src = '/assets/chamak/gift-box-open.png';
      boxBtn.setAttribute('aria-label', 'The gift is open');
      if (boxLine) boxLine.textContent = '✦ ✦ ✦';
      foilFall();
      setTimeout(function () { showStage('gallery'); }, reduceMotion ? 300 : 1800);
    }, reduceMotion ? 100 : 640);
  });

  /* foil confetti: gold RECTANGLES (Director's ruling) */
  function foilFall() {
    if (!confetti || reduceMotion) return;
    for (var i = 0; i < 46; i++) {
      var f = document.createElement('i');
      f.style.left = (Math.random() * 100) + 'vw';
      var dur = 2.4 + Math.random() * 2;
      f.style.animationDuration = dur + 's';
      f.style.animationDelay = (Math.random() * 0.8) + 's';
      if (Math.random() < 0.2) f.style.background = 'linear-gradient(180deg, #FF4FA3, #C2186B)';
      if (Math.random() < 0.5) f.style.width = '6px';
      confetti.appendChild(f);
    }
    setTimeout(function () { confetti.classList.add('is-done'); }, 6400);
  }

  /* ---------- ③ gallery cue → wish ---------- */
  var gallery = stages.gallery;
  if (gallery) {
    gallery.addEventListener('click', function () { showStage('wish'); });
    gallery.style.cursor = 'pointer';
  }

  /* ---------- ④ replay ---------- */
  if (replayBtn) replayBtn.addEventListener('click', function () {
    popped = false;
    if (boxImg) boxImg.src = '/assets/chamak/gift-box-closed.png';
    if (boxLine) boxLine.textContent = boxLine.getAttribute('data-line') || 'OPEN IT';
    if (confetti) { confetti.innerHTML = ''; confetti.classList.remove('is-done'); }
    showStage('ball');
  });

  showStage('ball');
})();
