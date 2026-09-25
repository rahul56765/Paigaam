'use strict';
/**
 * Mohar — Sealed With A Kiss. The two interactions, ported 1:1 from the
 * original design:
 *   · tap the envelope → the flap lifts (700ms) and the letter slides up
 *     (800ms, 300ms delay); at 1300ms the stage fades and the letter screen
 *     shows, revealing each line on its own --i stagger (CSS).
 *   · "read it again" → the letter fades, the envelope closes, focus returns
 *     to the envelope after 750ms.
 * Reduced motion: both waits collapse to 60ms (the CSS collapses the motion).
 * A busy flag ignores taps mid-animation; opening an already-open envelope
 * is a no-op.
 *
 * All content is server-rendered (templates/sealed-with-a-kiss/render.js);
 * this script only toggles classes.
 */
(function () {
  var stageWrap     = document.getElementById('stageWrap');
  var envelopeBtn   = document.getElementById('envelopeBtn');
  var envelopeScene = document.getElementById('envelopeScene');
  var letterScreen  = document.getElementById('letterScreen');
  var replayBtn     = document.getElementById('replayBtn');
  if (!stageWrap || !envelopeBtn || !envelopeScene || !letterScreen || !replayBtn) return;
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var busy = false;

  function openLetter() {
    if (busy || envelopeScene.classList.contains('opened')) return;
    busy = true;
    envelopeScene.classList.add('opened');
    var wait = reduced ? 60 : 1300; /* flap 700ms + slide 800ms (300ms delay) overlaps */
    setTimeout(function () {
      stageWrap.classList.add('away');
      letterScreen.classList.add('show');
      letterScreen.scrollTop = 0;
      busy = false;
    }, wait);
  }

  function replay() {
    if (busy) return;
    busy = true;
    letterScreen.classList.remove('show');
    stageWrap.classList.remove('away');
    envelopeScene.classList.remove('opened');
    letterScreen.scrollTop = 0;
    setTimeout(function () {
      busy = false;
      try { envelopeBtn.focus({ preventScroll: true }); } catch (e) { envelopeBtn.focus(); }
    }, reduced ? 60 : 750);
  }

  envelopeBtn.addEventListener('click', openLetter);
  replayBtn.addEventListener('click', replay);
})();
