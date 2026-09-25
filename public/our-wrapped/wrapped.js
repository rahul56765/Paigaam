'use strict';
/**
 * Naghma — Our Wrapped (Boyfriend Day family). Ported 1:1 from the original
 * single-file design (t5-wrapped.html). Changes:
 *   · Removed hosting-sandbox injections (close-fullscreen postMessage,
 *     __brokenImgHandler, .ha-img-placeholder style block).
 *   · Count-up reads `data-count` from each `.stat-num` element; all copy is
 *     server-rendered — no client-side templating.
 *   · Guard added: missing markup doesn't throw.
 *
 * Behaviours (1:1 from original):
 *   · Progress dots built dynamically; click scrolls to that screen.
 *   · IntersectionObserver (≥60% visible) activates each screen:
 *       – adds `.active` (triggers CSS rise/photo transitions)
 *       – fires count-up animation on the first `.stat-num` (once per element)
 *   · Count-up: 1600ms easeOutCubic, or instant for reduced-motion.
 *   · Skip-to-end button scrolls to the last screen.
 *   · No-IO fallback: all screens activated immediately.
 */
(function () {

  var deck      = document.getElementById('deck');
  var dotsWrap  = document.getElementById('dots');
  var skipBtn   = document.getElementById('skipToEnd');
  if (!deck || !dotsWrap) return;

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var screens = Array.prototype.slice.call(deck.querySelectorAll('.screen'));
  var counted = typeof WeakSet !== 'undefined' ? new WeakSet() : null;

  /* ---- progress dots ---- */
  screens.forEach(function (s, i) {
    var b = document.createElement('button');
    b.setAttribute('aria-label', 'Go to screen ' + (i + 1));
    b.addEventListener('click', function () {
      s.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
    dotsWrap.appendChild(b);
  });
  var dots = Array.prototype.slice.call(dotsWrap.children);

  function setActive(index) {
    dots.forEach(function (d, i) { d.classList.toggle('active', i === index); });
  }

  /* ---- count-up ---- */
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function countUp(el) {
    var raw = el.getAttribute('data-count');
    var target = raw ? parseInt(raw, 10) : 0;
    if (isNaN(target)) target = 0;
    if (reduceMotion) {
      el.textContent = target.toLocaleString('en-US');
      return;
    }
    var duration = 1600;
    var start = null;
    function frame(now) {
      if (start === null) start = now;
      var t = Math.min((now - start) / duration, 1);
      var val = Math.round(easeOutCubic(t) * target);
      el.textContent = val.toLocaleString('en-US');
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        el.textContent = target.toLocaleString('en-US');
      }
    }
    requestAnimationFrame(frame);
  }

  /* ---- IntersectionObserver: activation, dots, count triggers (once) ---- */
  if (typeof IntersectionObserver !== 'undefined') {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var screen = entry.target;
        var index = screens.indexOf(screen);
        setActive(index);
        screen.classList.add('active');
        var num = screen.querySelector('.stat-num');
        if (num) {
          var alreadyCounted = counted ? counted.has(num) : num.dataset.counted === '1';
          if (!alreadyCounted) {
            if (counted) counted.add(num); else num.dataset.counted = '1';
            countUp(num);
          }
        }
      });
    }, { root: deck, threshold: 0.6 });

    screens.forEach(function (s) { observer.observe(s); });
  } else {
    /* fallback: everything visible immediately */
    screens.forEach(function (s) {
      s.classList.add('active');
      var num = s.querySelector('.stat-num');
      if (num) {
        var raw = num.getAttribute('data-count');
        num.textContent = (raw ? parseInt(raw, 10) : 0).toLocaleString('en-US');
      }
    });
    if (dots.length) dots.forEach(function (d) { d.classList.add('active'); });
  }

  /* ---- skip to end ---- */
  if (skipBtn && screens.length > 0) {
    skipBtn.addEventListener('click', function () {
      screens[screens.length - 1].scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  }

})();
