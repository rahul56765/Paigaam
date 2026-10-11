(function () {
  'use strict';
  var book = document.getElementById('wpBook');
  if (!book) return;
  var pages = Array.from(book.querySelectorAll('.wp-page'));
  var names = ['The Wedding Post', 'Save the Date', 'The Love Story', 'Our Wedding Post', 'Wedding Day'];
  var current = 0, turning = false, transitionTimer = null;
  var status = document.getElementById('wpPageStatus');
  var prev = document.getElementById('wpPrev'), next = document.getElementById('wpNext');
  var dots = Array.from(document.querySelectorAll('[data-page-go]'));
  function prefersReducedMotion() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function updateControls() {
    if (status) status.textContent = 'Page ' + (current + 1) + ' of ' + pages.length + ' · ' + names[current];
    if (prev) prev.disabled = turning || current === 0;
    if (next) next.disabled = turning || current === pages.length - 1;
    dots.forEach(function (dot, i) { if (i === current) dot.setAttribute('aria-current', 'page'); else dot.removeAttribute('aria-current'); });
  }
  function show(index) {
    current = Math.max(0, Math.min(pages.length - 1, index));
    pages.forEach(function (page, i) {
      page.classList.remove('wp-under-forward', 'wp-under-backward', 'wp-turning-forward', 'wp-turning-backward');
      page.classList.toggle('is-active', i === current);
      page.setAttribute('aria-hidden', i === current ? 'false' : 'true');
    });
    turning = false;
    updateControls();
  }
  function navigate(index) {
    var target = Math.max(0, Math.min(pages.length - 1, index));
    if (turning || target === current) return;
    if (prefersReducedMotion()) { show(target); return; }
    turning = true;
    var forward = target > current;
    var from = pages[current], to = pages[target];
    var turnClass = forward ? 'wp-turning-forward' : 'wp-turning-backward';
    var underClass = forward ? 'wp-under-forward' : 'wp-under-backward';
    to.classList.add(underClass);
    to.setAttribute('aria-hidden', 'true');
    from.classList.add(turnClass);
    updateControls();
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      if (transitionTimer) { clearTimeout(transitionTimer); transitionTimer = null; }
      show(target);
    }
    from.addEventListener('animationend', function (ev) { if (ev.target === from) finish(); }, { once: true });
    transitionTimer = setTimeout(finish, 940);
  }
  if (prev) prev.addEventListener('click', function () { navigate(current - 1); });
  if (next) next.addEventListener('click', function () { navigate(current + 1); });
  dots.forEach(function (dot) { dot.addEventListener('click', function () { navigate(Number(dot.dataset.pageGo)); }); });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') { try { window.parent.postMessage({ type: 'close-fullscreen' }, '*'); } catch (_) {} return; }
    if (/input|textarea|select/i.test(ev.target.tagName) || ev.target.isContentEditable) return;
    if (ev.key === 'ArrowRight' && !document.querySelector('.wp-page[data-page="4"].is-active')) { ev.preventDefault(); navigate(current + 1); }
    if (ev.key === 'ArrowLeft' && !document.querySelector('.wp-page[data-page="4"].is-active')) { ev.preventDefault(); navigate(current - 1); }
  });
  var touchX = 0, touchY = 0, swiping = false;
  book.addEventListener('touchstart', function (ev) {
    if (ev.target.closest('.wp-timeline,.wp-word-grid,.wp-maze-board,.wp-maze-controls,a,button')) { swiping = false; return; }
    var t = ev.changedTouches[0]; touchX = t.clientX; touchY = t.clientY; swiping = true;
  }, { passive: true });
  book.addEventListener('touchend', function (ev) {
    if (!swiping) return;
    swiping = false; var t = ev.changedTouches[0], dx = t.clientX - touchX, dy = t.clientY - touchY;
    if (Math.abs(dx) > 54 && Math.abs(dx) > Math.abs(dy) * 1.2) navigate(current + (dx < 0 ? 1 : -1));
  }, { passive: true });
  show(0);
})();
