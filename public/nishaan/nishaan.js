'use strict';
/**
 * Nishaan — Milestone (Boyfriend Day family). The motion.
 *
 * The lightest build in the series (Director's words): a scroll-reveal per
 * beat via IntersectionObserver, the toast clink tilt on tap, and the
 * replay scroll. Nothing loops continuously — this register is stillness.
 * Reduced motion: reveals collapse to instant.
 */
(function () {

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- scroll reveals ---------- */
  var reveals = [].slice.call(document.querySelectorAll('.ns-reveal'));

  if (!reduceMotion && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.18 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- the toast clink: a gentle tilt on tap ---------- */
  var clink = document.querySelector('.ns-clink');
  if (clink) {
    clink.style.cursor = 'pointer';
    clink.addEventListener('click', function () {
      if (reduceMotion) return;
      clink.classList.remove('is-clinking');
      void clink.offsetWidth;
      clink.classList.add('is-clinking');
    });
  }

  /* ---------- replay: back to the numeral ---------- */
  var replayBtn = document.getElementById('nsReplayBtn');
  if (replayBtn) {
    replayBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

})();
