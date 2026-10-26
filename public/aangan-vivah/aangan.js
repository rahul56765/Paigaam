(function () {
  'use strict';
  var app = document.getElementById('awApp');
  var stage = document.getElementById('awStage');
  if (!app || !stage) return;

  var pages = Array.prototype.slice.call(stage.querySelectorAll('[data-aw-page]'));
  var prev = app.querySelector('[data-aw-prev]');
  var next = app.querySelector('[data-aw-next]');
  var currentText = app.querySelector('[data-aw-current]');
  var totalText = app.querySelector('[data-aw-total]');
  var dotsHost = app.querySelector('[data-aw-dots]');
  var openButton = app.querySelector('[data-aw-open]');
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var index = 0;
  var locked = false;
  var openTimer = 0;
  var glowTimer = 0;
  var unlockTimer = 0;
  var touch = null;
  var TRANSITION_MS = reducedMotion ? 0 : 560;

  if (!pages.length) return;
  if (totalText) totalText.textContent = String(pages.length);

  function fitCopy(page) {
    var box = page && page.querySelector('.aw-copy');
    if (!box) return;
    var nodes = Array.prototype.slice.call(box.querySelectorAll('.aw-reveal'));
    nodes.forEach(function (node) { node.style.removeProperty('font-size'); });

    function hasCollision() {
      if (box.scrollHeight > box.clientHeight + 2) return true;
      var rects = nodes.map(function (node) { return { node: node, rect: node.getBoundingClientRect() }; });
      for (var i = 0; i < rects.length; i++) {
        for (var j = i + 1; j < rects.length; j++) {
          var a = rects[i].rect, b = rects[j].rect;
          var overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          var overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (overlapX > 4 && overlapY > 4) return true;
        }
      }
      return false;
    }

    for (var attempt = 0; attempt < 36 && hasCollision(); attempt++) {
      var candidates = nodes.map(function (node) {
        var size = parseFloat(window.getComputedStyle(node).fontSize) || 16;
        var display = node.matches('.aw-event__eyebrow,.aw-invitation__line,.aw-invitation__names,.aw-closing__line,.aw-monogram__initials') ? 16 : 11;
        return { node: node, size: size, min: display };
      }).filter(function (item) { return item.size > item.min; })
        .sort(function (a, b) { return b.node.textContent.trim().length - a.node.textContent.trim().length; });
      if (!candidates.length) break;
      var chosen = candidates[0];
      chosen.node.style.fontSize = Math.max(chosen.min, chosen.size - .75) + 'px';
    }
  }

  function setPage(nextIndex, direction) {
    if (locked || nextIndex < 0 || nextIndex >= pages.length || nextIndex === index) return false;
    locked = true;
    window.clearTimeout(unlockTimer);
    var previous = index;
    index = nextIndex;

    pages.forEach(function (page, i) {
      page.classList.remove('is-current', 'is-before', 'is-future');
      if (i === index) {
        page.classList.add('is-current');
        page.setAttribute('aria-hidden', 'false');
        page.removeAttribute('inert');
      } else {
        page.classList.add(i < index ? 'is-before' : 'is-future');
        page.setAttribute('aria-hidden', 'true');
        page.setAttribute('inert', '');
      }
    });

    var current = pages[index];
    app.dataset.kind = current.dataset.kind || 'default';
    if (currentText) currentText.textContent = String(index + 1);
    if (prev) prev.disabled = index === 0;
    if (next) next.disabled = index === pages.length - 1;
    if (dotsHost) {
      Array.prototype.forEach.call(dotsHost.querySelectorAll('[data-aw-dot]'), function (dot, i) {
        if (i === index) {
          dot.classList.add('is-current');
          dot.setAttribute('aria-current', 'page');
        } else {
          dot.classList.remove('is-current');
          dot.removeAttribute('aria-current');
        }
      });
    }
    var newDirection = direction || (index > previous ? 1 : -1);
    app.dataset.direction = newDirection > 0 ? 'next' : 'previous';
    window.requestAnimationFrame(function () { fitCopy(current); });
    unlockTimer = window.setTimeout(function () { locked = false; }, TRANSITION_MS + 40);
    return true;
  }

  function resetDoor() {
    var door = pages[0];
    if (!door) return;
    door.classList.remove('is-opening');
    if (openButton) openButton.disabled = false;
    window.clearTimeout(openTimer);
    window.clearTimeout(glowTimer);
    stage.classList.remove('is-golden');
  }

  function openDoor(target) {
    if (index !== 0 || locked || !openButton || openButton.disabled) return;
    openButton.disabled = true;
    var door = pages[0];
    if (reducedMotion) {
      setPage(typeof target === 'number' ? target : 1, 1);
      return;
    }
    door.classList.add('is-opening');
    openTimer = window.setTimeout(function () {
      stage.classList.add('is-golden');
      glowTimer = window.setTimeout(function () {
        setPage(typeof target === 'number' ? target : 1, 1);
        window.setTimeout(function () { stage.classList.remove('is-golden'); }, 40);
      }, 3300);
    }, 1650);
  }

  function goNext() {
    if (index === 0) { openDoor(); return; }
    setPage(index + 1, 1);
  }
  function goPrevious() {
    var moved = setPage(index - 1, -1);
    if (moved && index === 0) resetDoor();
  }

  if (openButton) openButton.addEventListener('click', function () { openDoor(); });
  if (prev) prev.addEventListener('click', goPrevious);
  if (next) next.addEventListener('click', goNext);
  if (dotsHost) dotsHost.addEventListener('click', function (event) {
    var dot = event.target.closest('[data-aw-dot]');
    if (!dot) return;
    var destination = Number(dot.getAttribute('data-aw-dot'));
    if (!Number.isInteger(destination)) return;
    if (index === 0 && destination > 0) openDoor(destination);
    else {
      var moved = setPage(destination, destination > index ? 1 : -1);
      if (moved && destination === 0) resetDoor();
    }
  });

  stage.addEventListener('pointerdown', function (event) {
    if (event.target.closest('button')) return;
    touch = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }, { passive: true });
  stage.addEventListener('pointerup', function (event) {
    if (!touch || touch.id !== event.pointerId) return;
    var dx = event.clientX - touch.x;
    var dy = event.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
    if (dx < 0) goNext(); else goPrevious();
  }, { passive: true });
  stage.addEventListener('pointercancel', function () { touch = null; }, { passive: true });

  window.addEventListener('resize', function () {
    window.requestAnimationFrame(function () { fitCopy(pages[index]); });
  });

  document.addEventListener('keydown', function (event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target && event.target.tagName || '')) return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); goNext(); }
    else if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); goPrevious(); }
  });
})();
