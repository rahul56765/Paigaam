'use strict';
/**
 * Yaadon — Memory Scrapbook (Boyfriend Day family). The book.
 *
 * Flow:
 *   ① cover    "tap to open" lifts the wax seal (0.9s), the cover fades
 *              away and the title spread flips in.
 *   ② title    small-caps name + date; "keep going →" walks to the pages.
 *   ③ pages    the polaroids: a scroll-snap strip (always a strip — the
 *              degrade path only removes the 3D flip animation, never the
 *              content). Dots track position.
 *   ④ reasons  peel-strips: tap (or scratch — pointer-drag peels on
 *              pointerdown too, Kashf-style tap-or-gesture) lifts each
 *              paper strip. "Peel them all" appears after 2, sequential
 *              at 300ms. All peeled → the letter reveals.
 *   ⑤ letter   lined paper, sign-off, opt-in song chip, "Read it again"
 *              (reloads the cover state in place).
 *
 * The degrade: on low-end Android — deviceMemory ≤ 2GB, no 3D-transform
 * support, or saveData — body gets .yd--degrade and the spread flip is a
 * slide-fade instead of a perspective rotateY. Content is identical; only
 * the transform budget changes (Director's ruling).
 *
 * Reduced motion: every animation collapses to an instant cut.
 */
(function () {

  var dataEl = document.getElementById('ydData');
  var cover = document.getElementById('ydCover');
  var book = document.getElementById('ydBook');
  var sealBtn = document.getElementById('ydSealBtn');
  var seal = sealBtn && sealBtn.querySelector('.yd-seal');
  var pages = document.getElementById('ydPagesTrack');
  var dots = document.getElementById('ydDots');
  var revealAllBtn = document.getElementById('ydRevealAllBtn');
  var reasonsCue = document.getElementById('ydReasonsCue');
  var letter = document.getElementById('ydLetter');
  var replayBtn = document.getElementById('ydReplayBtn');

  if (!cover || !sealBtn) return;

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- the degrade: low-end detection ---------- */
  var lowEnd = false;
  try {
    var nav = navigator;
    if (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) lowEnd = true;
    if (nav.connection && nav.connection.saveData) lowEnd = true;
  } catch (e) { /* fine */ }
  // no perspective support → no 3D flip
  if (typeof CSS !== 'undefined' && CSS.supports && !CSS.supports('transform-style', 'preserve-3d')) lowEnd = true;
  if (lowEnd) document.body.classList.add('yd--degrade');

  /* ---------- ① the cover ---------- */
  var opened = false;
  sealBtn.addEventListener('click', function () {
    if (opened) return;
    opened = true;
    if (seal) seal.classList.add('is-lifting');
    setTimeout(function () {
      cover.classList.add('is-open');
      if (book) book.hidden = false;
      flipIn('ydTitle');
    }, reduceMotion ? 120 : 650);
  });

  /* ---------- spread walker (flip-in per spread, degrade = slide) ---------- */
  function flipIn(id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (!book) return;
    book.classList.remove('is-flipping');
    void el.offsetWidth;
    book.classList.add('is-flipping');
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  /* title cue → pages */
  var titleCue = document.querySelector('.yd-title__cue');
  if (titleCue) {
    titleCue.style.cursor = 'pointer';
    titleCue.addEventListener('click', function () { flipIn('ydPages'); });
    titleCue.setAttribute('role', 'button');
    titleCue.setAttribute('tabindex', '0');
    titleCue.setAttribute('aria-label', 'Go to the photo pages');
    titleCue.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipIn('ydPages'); }
    });
  }

  /* pages cue → reasons (and swipe discovery) */
  var pagesCue = document.querySelector('.yd-pages__cue');
  if (pagesCue) {
    pagesCue.style.cursor = 'pointer';
    pagesCue.addEventListener('click', function () { flipIn('ydReasons'); });
  }

  /* ---------- ③ reel dots ---------- */
  if (pages && dots && pages.children.length > 1) {
    var count = pages.children.length;
    for (var i = 0; i < count; i++) {
      var dot = document.createElement('i');
      if (i === 0) dot.className = 'is-on';
      dots.appendChild(dot);
    }
    var dotEls = [].slice.call(dots.children);
    pages.addEventListener('scroll', function () {
      var w = pages.children[0] ? pages.children[0].offsetWidth + 20 : 1;
      var ix = Math.min(count - 1, Math.round(pages.scrollLeft / w));
      dotEls.forEach(function (d, j) { d.classList.toggle('is-on', j === ix); });
    }, { passive: true });
  }

  /* ---------- ④ the reasons ---------- */
  var strips = [].slice.call(document.querySelectorAll('.yd-strip'));
  var openCount = 0;
  var allShown = false;

  function openStrip(strip) {
    if (strip.classList.contains('is-open')) return;
    strip.classList.add('is-open');
    var peel = strip.querySelector('.yd-strip__peel');
    if (peel) {
      peel.style.pointerEvents = 'none';
      peel.setAttribute('aria-hidden', 'true');
    }
    openCount++;
    if (openCount >= 2 && openCount < strips.length && revealAllBtn) revealAllBtn.hidden = false;
    if (openCount >= strips.length) {
      allShown = true;
      if (reasonsCue) reasonsCue.textContent = 'every reason, out in the open';
      setTimeout(function () { flipIn('ydLetter'); }, reduceMotion ? 200 : 1100);
    }
  }

  strips.forEach(function (strip) {
    var peel = strip.querySelector('.yd-strip__peel');
    if (!peel) return;
    peel.setAttribute('role', 'button');
    peel.setAttribute('tabindex', '0');
    peel.setAttribute('aria-label', 'Peel this strip to read the reason');
    var open = function () { openStrip(strip); };
    peel.addEventListener('click', open);
    peel.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
    // scratch-style drag: a pointerdown + move peels too (Kashf gesture)
    var downX = null;
    peel.addEventListener('pointerdown', function (e) { downX = e.clientX; });
    peel.addEventListener('pointermove', function (e) {
      if (downX === null) return;
      if (Math.abs(e.clientX - downX) > 18) { downX = null; open(); }
    });
    peel.addEventListener('pointerup', function () { downX = null; });
  });

  if (revealAllBtn) revealAllBtn.addEventListener('click', function () {
    if (allShown) return;
    strips.forEach(function (s, i) {
      if (!s.classList.contains('is-open')) {
        setTimeout(function () { openStrip(s); }, reduceMotion ? 0 : i * 300);
      }
    });
  });

  /* ---------- ⑤ replay ---------- */
  if (replayBtn) replayBtn.addEventListener('click', function () {
    strips.forEach(function (s) {
      s.classList.remove('is-open');
      var peel = s.querySelector('.yd-strip__peel');
      if (peel) { peel.style.pointerEvents = ''; peel.removeAttribute('aria-hidden'); }
    });
    openCount = 0;
    allShown = false;
    if (revealAllBtn) revealAllBtn.hidden = true;
    if (reasonsCue) reasonsCue.textContent = 'peel each strip — gently';
    if (letter) letter.hidden = true;
    if (book) book.hidden = true;
    if (cover) cover.classList.remove('is-open');
    if (seal) seal.classList.remove('is-lifting');
    opened = false;
    window.scrollTo(0, 0);
  });

})();
