'use strict';
/**
 * Shubh Vivah — the two motions.
 *
 * 1. The countdown: reads its target from the server's JSON payload and ticks
 *    once a second into the four tiles (DD/HH/MM/SS). When the target passes,
 *    the opener swaps to "The new beginning has begun ✨" — never a zeroed
 *    clock, never negative numbers. Without a payload (or without a date)
 *    nothing here runs and the server's first paint stands.
 *
 * 2. The reveals: each beat's children carry .sv-reveal; an
 *    IntersectionObserver adds .sv-in as they enter the viewport (12px rise,
 *    550ms — the CSS owns the curve). Reduced-motion users get everything
 *    instantly and skip the observer entirely.
 */
(function () {
  'use strict';

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------ the countdown ------------------------------ */
  var payload = document.getElementById('svData');
  var count = document.getElementById('svCount');
  if (payload && count) {
    var data = {};
    try { data = JSON.parse(payload.textContent || '{}'); } catch (e) { data = {}; }
    var target = Number(data.target);
    var nums = [0, 1, 2, 3].map(function (i) { return document.getElementById('svT' + i); });
    var heading = document.getElementById('svOpenH');

    function swapToBegun() {
      if (count.parentNode) count.parentNode.removeChild(count);
      if (heading) heading.textContent = data.pastText || 'The new beginning has begun ✨';
    }

    function tick() {
      var left = Math.floor((target - Date.now()) / 1000);
      if (left <= 0) { swapToBegun(); return; }
      var d = Math.floor(left / 86400); left -= d * 86400;
      var h = Math.floor(left / 3600); left -= h * 3600;
      var m = Math.floor(left / 60);
      var s = left - m * 60;
      var vals = [d, h, m, s];
      for (var i = 0; i < 4; i++) {
        if (nums[i]) nums[i].textContent = String(vals[i]).padStart(2, '0');
      }
      window.setTimeout(tick, 1000);
    }

    if (target > 0 && nums.every(Boolean)) {
      if (Date.now() >= target) swapToBegun(); else tick();
    }
  }

  /* ------------------------------ the reveals ------------------------------ */
  var els = Array.prototype.slice.call(document.querySelectorAll('.sv-reveal'));
  if (!els.length) return;
  if (reduced || !('IntersectionObserver' in window)) {
    els.forEach(function (el) { el.classList.add('sv-in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('sv-in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
  els.forEach(function (el) { io.observe(el); });
})();
