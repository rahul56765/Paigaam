'use strict';
/**
 * Daa'wat — the ceremony.
 *
 * 1. The tap: the plaque (or any tap on the hero) opens the reveal — the
 *    curtain halves slide apart on heavy fabric (1.4s cubic-bezier(0.65,0,
 *    0.35,1)), the light bloom rises through the gap, and the one-shot petal
 *    burst (8–12 petals, ~2s, settles) plays exactly once. Then the page
 *    scrolls to the card. No loop is added anywhere.
 *
 * 2. The countdown: reads its target from the server's JSON payload and ticks
 *    once a second into the hero tiles and the standalone beat. When the
 *    target passes, both swap to "The celebration has begun" — never a
 *    zeroed clock, never negative numbers.
 *
 * 3. The name stagger: when the card enters the viewport, .dw-in triggers
 *    the 60ms per-letter rise.
 *
 * 4. The seal: on the closing beat, a tap plays the re-veil — scroll back to
 *    the hero, curtains closed, plaque back. The ceremony replays.
 *
 * Reduced-motion users get instant still states and no petals.
 */
(function () {
  'use strict';

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------ the reveal ------------------------------ */
  var hero = document.getElementById('hero');
  var openBtn = document.getElementById('dwOpenBtn');

  function petalBurst() {
    if (reduced) return;
    var tray = document.getElementById('dwPetals');
    if (!tray || tray.childElementCount) return; // one-shot: never twice
    var count = 8 + Math.floor(Math.random() * 5); // 8–12 petals
    for (var i = 0; i < count; i++) {
      var img = document.createElement('img');
      img.className = 'dw-petal';
      img.src = '/assets/daawat/petal.png';
      img.alt = '';
      img.decoding = 'async';
      img.style.left = (8 + Math.random() * 84) + '%';
      img.style.setProperty('--spin', Math.round(Math.random() * 360) + 'deg');
      img.style.animationDelay = (Math.random() * 0.4) + 's';
      img.style.animationDuration = (1.7 + Math.random() * 0.6) + 's';
      tray.appendChild(img);
    }
    // settle: the burst is a one-shot event; the tray empties itself
    window.setTimeout(function () { if (tray) tray.innerHTML = ''; }, 3000);
  }

  function openCeremony() {
    if (!hero || hero.classList.contains('dw-open')) return;
    hero.classList.add('dw-open');
    petalBurst();
    window.setTimeout(function () {
      var card = document.getElementById('card');
      if (card) card.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    }, reduced ? 0 : 1500);
  }

  if (openBtn) openBtn.addEventListener('click', openCeremony);
  if (hero) {
    hero.addEventListener('click', function (e) {
      if (e.target.closest('.dw-plaque')) return; // the button handles its own tap
      openCeremony();
    });
  }

  /* ------------------------------ the countdown ------------------------------ */
  var payload = document.getElementById('dwData');
  if (payload) {
    var data = {};
    try { data = JSON.parse(payload.textContent || '{}'); } catch (e) { data = {}; }
    var target = Number(data.target);
    var heroNums = [0, 1, 2, 3].map(function (i) { return document.getElementById('dwT' + i); });
    var countNums = [0, 1, 2, 3].map(function (i) { return document.getElementById('dwC' + i); });

    function paint(nums, vals) {
      for (var i = 0; i < 4; i++) if (nums[i]) nums[i].textContent = vals[i];
    }
    function swapToBegun() {
      [heroNums, countNums].forEach(function (set) {
        var count = set[0] && set[0].closest('.dw-count');
        if (count && count.parentNode) count.parentNode.removeChild(count);
      });
      var h = document.getElementById('dwCountH');
      if (h) h.textContent = data.pastText || 'The celebration has begun';
    }
    function tick() {
      var left = Math.floor((target - Date.now()) / 1000);
      if (left <= 0) { swapToBegun(); return; }
      var dd = Math.floor(left / 86400); left -= dd * 86400;
      var hh = Math.floor(left / 3600); left -= hh * 3600;
      var mm = Math.floor(left / 60);
      var ss = left - mm * 60;
      var vals = [dd, hh, mm, ss].map(function (n) { return String(n).padStart(2, '0'); });
      paint(heroNums, vals); paint(countNums, vals);
      window.setTimeout(tick, 1000);
    }
    if (target > 0 && heroNums.every(Boolean)) {
      if (Date.now() >= target) swapToBegun(); else tick();
    }
  }

  /* ------------------------------ the name stagger ------------------------------
     The letters ship server-rendered as .dw-ch spans (render.js namesMarkup);
     this guard catches anything that isn't split yet — and keeps the h2's
     aria-label as the only thing a screen reader reads. */
  var names = document.querySelector('.dw-card__names');
  if (names && !names.querySelector('.dw-ch')) {
    var i = 0;
    var walker = document.createTreeWalker(names, NodeFilter.SHOW_TEXT, null);
    var texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach(function (node) {
      if (!node.textContent.trim()) return;
      var frag = document.createDocumentFragment();
      Array.from(node.textContent).forEach(function (ch) {
        if (ch === ' ') { frag.appendChild(document.createTextNode(' ')); return; }
        var span = document.createElement('span');
        span.className = 'dw-ch';
        span.setAttribute('aria-hidden', 'true');
        span.style.setProperty('--i', String(i++));
        span.textContent = ch;
        frag.appendChild(span);
      });
      node.parentNode.replaceChild(frag, node);
    });
  }
  if (names && 'IntersectionObserver' in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('dw-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    io.observe(names);
  } else if (names) {
    names.classList.add('dw-in');
  }

  /* ------------------------------ the seal re-veil ------------------------------ */
  var sealBtn = document.getElementById('dwSealBtn');
  if (sealBtn) {
    sealBtn.addEventListener('click', function () {
      if (!hero) return;
      hero.classList.remove('dw-open');
      hero.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    });
  }
})();
