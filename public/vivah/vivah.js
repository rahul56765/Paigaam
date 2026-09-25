'use strict';
/**
 * Vivah — the live bits. Everything is server-rendered (templates/vivah/
 * render.js); this script does three things, no more:
 *
 *   · reveal: sections fade up as they scroll into view (IntersectionObserver).
 *   · countdown: ticks days · hours · minutes · seconds to the Muhurtham
 *     (viData.target), tabular numerals so the boxes never jitter.
 *   · petals: spawns the drifting petals behind the ceremony stack — one of
 *     the template's two continuous loops (the other is the hero glow), both
 *     honouring prefers-reduced-motion.
 */
(function () {
  var doc = document;
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------------------------------------------------------- reveal */
  var sections = doc.querySelectorAll('[data-vi-reveal]');
  if (reduced || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(sections, function (s) { s.classList.add('vi-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('vi-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    Array.prototype.forEach.call(sections, function (s) { io.observe(s); });
  }

  /* -------------------------------------------------------- countdown */
  var data = {};
  try { data = JSON.parse((doc.getElementById('viData') || {}).textContent || '{}') || {}; } catch (e) { data = {}; }
  var target = null;
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data.target || '');
  // The muhurtham evening, IST — the moment the wait is over.
  if (m) target = Date.UTC(+m[1], +m[2] - 1, +m[3], 19, 0, 0) - 330 * 60000;

  var els = {
    days: doc.querySelector('[data-vi-days]'),
    hours: doc.querySelector('[data-vi-hours]'),
    minutes: doc.querySelector('[data-vi-minutes]'),
    seconds: doc.querySelector('[data-vi-seconds]'),
  };
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function tick() {
    if (target == null) {
      if (els.days) els.days.textContent = '—';
      if (els.hours) els.hours.textContent = '—';
      if (els.minutes) els.minutes.textContent = '—';
      if (els.seconds) els.seconds.textContent = '—';
      return;
    }
    var left = Math.max(0, target - Date.now());
    var s = Math.floor(left / 1000);
    var days = Math.floor(s / 86400);
    s -= days * 86400;
    var hours = Math.floor(s / 3600);
    s -= hours * 3600;
    var minutes = Math.floor(s / 60);
    var seconds = s - minutes * 60;
    if (els.days) els.days.textContent = days;
    if (els.hours) els.hours.textContent = pad(hours);
    if (els.minutes) els.minutes.textContent = pad(minutes);
    if (els.seconds) els.seconds.textContent = pad(seconds);
    if (left <= 0) clearInterval(timer);
  }
  var timer = null;
  if (els.days) {
    tick();
    timer = setInterval(tick, 1000);
  }

  /* ---------------------------------------------------------- petals */
  if (!reduced) {
    var stack = doc.querySelector('.vi-events');
    if (stack) {
      var count = 10;
      for (var i = 0; i < count; i++) {
        var p = doc.createElement('span');
        p.className = 'vi-drift';
        p.style.left = (4 + Math.random() * 92) + '%';
        p.style.setProperty('--dur', (9 + Math.random() * 8).toFixed(1) + 's');
        p.style.setProperty('--delay', (-Math.random() * 14).toFixed(1) + 's');
        p.style.setProperty('--sway', ((Math.random() - 0.5) * 90).toFixed(0) + 'px');
        var scale = 0.6 + Math.random() * 0.9;
        p.style.width = (14 * scale).toFixed(0) + 'px';
        p.style.height = (14 * scale).toFixed(0) + 'px';
        stack.appendChild(p);
      }
    }
  }
})();
