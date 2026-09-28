/* Purana Seekho — client-side motion only. All text is server-rendered.
   Gate: salted-SHA-256 check (same gesture-gate contract as Raaz). */
(function () {
  'use strict';

  var SPRING = 400;              // motion budget ceiling, ms
  var dataEl = document.getElementById('psData');
  var D = dataEl ? JSON.parse(dataEl.textContent) : {};

  var gate = document.getElementById('psGate');
  var tease = document.getElementById('psTease');
  var site = document.getElementById('psSite');
  var form = document.getElementById('psForm');
  var input = document.getElementById('psInput');
  var hintEl = document.getElementById('psHint');
  var retry = document.getElementById('psRetry');
  var gifts = Array.prototype.slice.call(document.querySelectorAll('.ps-gift'));
  var captcha = document.querySelector('.ps-captcha');

  var wrongGuesses = 0;
  var teaseTimer = null;

  if (!D.h) { if (gate) gate.hidden = true; revealSite(); return; }

  /* ---------------------------------------------------------- the gate */

  function sha256(str) {
    // SubtleCrypto is async; the whole gate is promise-shaped.
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
      .then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) {
          return ('0' + b.toString(16)).slice(-2);
        }).join('');
      });
  }

  function submit(ev) {
    ev.preventDefault();
    var guess = (input.value || '').trim().toLowerCase();
    if (!guess) return;
    sha256(D.s + ':' + guess).then(function (hash) {
      if (hash === D.h) {
        unlock();
      } else {
        wrongGuesses++;
        showTease();
        if (wrongGuesses === 1 && D.hint) {
          try { hintEl.textContent = atob(D.hint); } catch (e) { hintEl.textContent = ''; }
        }
      }
    }).catch(function () { /* crypto unavailable: stay quiet, keep the gate */ });
  }
  if (form) form.addEventListener('submit', submit);

  function unlock() {
    tease.hidden = true;
    gate.hidden = true;
    revealSite();
  }

  /* ---------------------------------------------------------- the tease */

  function showTease() {
    clearTimeout(teaseTimer);
    tease.hidden = false;
    // retrigger the springy pill every time
    retry.style.animation = 'none';
    void retry.offsetWidth;
    retry.style.animation = '';
  }

  // Third wrong guess — and every one after — loops back to the tease.
  // Never a lockout: this is a gift.
  if (retry) retry.addEventListener('click', function () {
    tease.hidden = true;
    clearTimeout(teaseTimer);
    input.focus({ preventScroll: true });
    input.select();
  });
  if (tease) tease.addEventListener('click', function (ev) {
    if (ev.target === tease) { tease.hidden = true; input.focus({ preventScroll: true }); }
  });

  // The captcha is a joke — but it plays along.
  if (captcha) captcha.addEventListener('click', function () {
    captcha.classList.add('is-done');
  });

  /* ---------------------------------------------------------- the pick */

  var OPENED_KEY = 'ps-opened';
  var openedCount = 0;

  function rememberOpened() {
    try { sessionStorage.setItem(OPENED_KEY, '1'); } catch (e) { /* private mode */ }
  }
  function wasOpenedBefore() {
    try { return sessionStorage.getItem(OPENED_KEY) === '1'; } catch (e) { return false; }
  }

  gifts.forEach(function (li) {
    var btn = li.querySelector('.ps-gift__btn');
    btn.addEventListener('click', function () {
      if (li.classList.contains('is-open')) return;
      li.classList.add('is-open');
      btn.setAttribute('aria-disabled', 'true');
      openedCount++;
      rememberOpened();
      if (openedCount === gifts.length) {
        // all three open → brief pause → auto-advance past the pick
        setTimeout(function () {
          document.querySelector('.ps-hero').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 900);
      }
    });
  });

  // Reload mid-flow: land on the pick screen with opened boxes remembered.
  if (wasOpenedBefore()) {
    setTimeout(function () {
      gifts.forEach(function (li) {
        li.classList.add('is-open');
        var b = li.querySelector('.ps-gift__btn');
        if (b) b.setAttribute('aria-disabled', 'true');
      });
      openedCount = gifts.length;
      document.querySelector('.ps-pick').scrollIntoView({ block: 'start' });
    }, 60);
  }

  /* ---------------------------------------------------------- reveals */

  function revealSite() {
    site.hidden = false;
    if (window.scrollY > 0) window.scrollTo(0, 0);
    var els = Array.prototype.slice.call(document.querySelectorAll('.ps-beat'));
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }
})();
