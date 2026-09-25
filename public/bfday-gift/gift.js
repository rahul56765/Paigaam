'use strict';
/**
 * Tohfa — Whole Website Gift. The interactions, layered over a fully
 * server-rendered page:
 *   · tap the bunny → the cover lifts away and the gift scrolls in
 *   · the word list types itself, one line at a time (IntersectionObserver)
 *   · the polaroid carousel swipes; tapping a polaroid flips it (CSS 3D)
 *   · the song card plays a fake progress bar; the heart bursts when loved
 *   · each bouquet pops its hidden note open (one at a time)
 *   · floating hearts drift up the final letter
 * Reduced motion: the cover swaps instantly, every line is already shown,
 * the progress bar sits full, the hearts are parked. A busy flag ignores
 * taps mid-transition; opening an opened cover is a no-op.
 *
 * All content is server-rendered (templates/bfday-gift/render.js); this
 * script never writes sender text into the page.
 */
(function () {
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ------------------------------------------------ the cover */
  var cover = document.getElementById('cover');
  var bunnyBtn = document.getElementById('bunnyBtn');
  var gift = document.getElementById('gift');
  if (cover && bunnyBtn && gift) {
    var busy = false;
    bunnyBtn.addEventListener('click', function () {
      if (busy || cover.classList.contains('away')) return;
      busy = true;
      cover.classList.add('away');
      gift.classList.add('open');
      document.body.classList.add('opened');
      setTimeout(function () {
        cover.setAttribute('hidden', '');
        gift.removeAttribute('hidden');
        window.scrollTo(0, 0);
        busy = false;
      }, reduced ? 60 : 750);
    });
  }

  /* --------------------------------------- the type-on word list */
  var wordList = document.getElementById('wordList');
  if (wordList) {
    var lines = Array.prototype.slice.call(wordList.querySelectorAll('.word-line'));
    if (reduced || !('IntersectionObserver' in window)) {
      lines.forEach(function (l) { l.classList.add('typed'); });
    } else {
      var started = false;
      var io = new IntersectionObserver(function (entries) {
        if (started || !entries.some(function (e) { return e.isIntersecting; })) return;
        started = true;
        io.disconnect();
        lines.forEach(function (line, i) {
          var full = line.textContent;
          line.textContent = '';
          line.classList.add('typing');
          var j = 0;
          setTimeout(function tick() {
            if (j <= full.length) {
              line.textContent = full.slice(0, j++);
              setTimeout(tick, 34);
            } else {
              line.classList.add('typed');
            }
          }, 260 + i * 1150);
        });
      }, { threshold: 0.35 });
      io.observe(wordList);
    }
  }

  /* --------------------------------- the polaroid carousel + flips */
  var carousel = document.getElementById('carousel');
  var dots = document.getElementById('dots');
  if (carousel) {
    var flips = Array.prototype.slice.call(carousel.querySelectorAll('.flip'));
    flips.forEach(function (f) {
      var btn = f.querySelector('.flip-btn');
      if (!btn) return;
      btn.addEventListener('click', function () {
        f.classList.toggle('flipped');
        btn.setAttribute('aria-pressed', f.classList.contains('flipped') ? 'true' : 'false');
      });
    });
    if (dots && flips.length > 1) {
      flips.forEach(function (_, i) {
        var dot = document.createElement('span');
        dot.className = 'dot' + (i === 0 ? ' on' : '');
        dots.appendChild(dot);
      });
      var update = function () {
        var w = carousel.clientWidth || 1;
        var i = Math.round(carousel.scrollLeft / w);
        Array.prototype.forEach.call(dots.children, function (dot, j) {
          dot.classList.toggle('on', j === Math.min(i, flips.length - 1));
        });
      };
      carousel.addEventListener('scroll', update, { passive: true });
    }
  }

  /* ---------------------------------------------- the song card */
  var fill = document.getElementById('songFill');
  var now = document.getElementById('songNow');
  var bar = document.getElementById('songBar');
  var heartBtn = document.getElementById('heartBtn');
  if (fill && bar) {
    if (reduced) {
      fill.style.width = '100%';
      bar.setAttribute('aria-valuenow', '100');
      if (now) now.textContent = '3:33';
    } else {
      var t0 = null, TOTAL = 213; /* 3:33, in seconds */
      var step = function (ts) {
        if (t0 === null) t0 = ts;
        var s = ((ts - t0) / 1000) % TOTAL;
        var pct = (s / TOTAL) * 100;
        fill.style.width = pct + '%';
        bar.setAttribute('aria-valuenow', String(Math.round(pct)));
        if (now) now.textContent = Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  }
  if (heartBtn) {
    heartBtn.addEventListener('click', function () {
      var loved = heartBtn.classList.toggle('loved');
      heartBtn.setAttribute('aria-pressed', loved ? 'true' : 'false');
      if (loved && !reduced) {
        heartBtn.classList.remove('burst');
        void heartBtn.offsetWidth; /* restart the burst */
        heartBtn.classList.add('burst');
      }
    });
  }

  /* ------------------------------------------------ the bouquets */
  var bnotes = document.getElementById('bnotes');
  var bouquets = Array.prototype.slice.call(document.querySelectorAll('.bqt'));
  function closeNotes(except) {
    if (!bnotes) return;
    Array.prototype.forEach.call(bnotes.querySelectorAll('.bnote'), function (n) {
      if (n.getAttribute('data-note-card') !== String(except)) n.setAttribute('hidden', '');
    });
  }
  bouquets.forEach(function (b) {
    b.addEventListener('click', function () {
      if (!bnotes) return;
      var i = b.getAttribute('data-note');
      var card = bnotes.querySelector('[data-note-card="' + i + '"]');
      if (!card) return;
      var isOpen = !card.hasAttribute('hidden');
      closeNotes(i);
      if (isOpen) { card.setAttribute('hidden', ''); return; }
      card.removeAttribute('hidden');
      if (!reduced) {
        card.classList.remove('pop');
        void card.offsetWidth;
        card.classList.add('pop');
      }
    });
  });
  if (bnotes) {
    Array.prototype.forEach.call(bnotes.querySelectorAll('[data-note-close]'), function (x) {
      x.addEventListener('click', function () {
        var card = bnotes.querySelector('[data-note-card="' + x.getAttribute('data-note-close') + '"]');
        if (card) card.setAttribute('hidden', '');
      });
    });
  }

  /* ------------------------------------------ the floating hearts */
  var hearts = document.getElementById('floatHearts');
  if (hearts && !reduced) {
    for (var i = 0; i < 12; i++) {
      var h = document.createElement('span');
      h.className = 'fh';
      h.textContent = '♥';
      h.style.left = (4 + (i * 83) % 92) + '%';
      h.style.setProperty('--dur', (7 + (i * 37) % 6) + 's');
      h.style.setProperty('--delay', (-(i * 1.7)) + 's');
      h.style.setProperty('--size', (14 + (i * 29) % 16) + 'px');
      hearts.appendChild(h);
    }
  }
})();
