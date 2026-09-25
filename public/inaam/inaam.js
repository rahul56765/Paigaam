/* Inaam — Gift For You! · client-side motion only. All text is server-rendered. */
(function () {
  'use strict';

  var cover = document.getElementById('inCover');
  var site = document.getElementById('inSite');
  var joke = document.getElementById('inJoke');
  var noBtn = document.getElementById('inNo');
  var gifts = Array.prototype.slice.call(document.querySelectorAll('.in-gift'));
  var couponsSection = document.querySelector('.in-coupons');
  var tickets = Array.prototype.slice.call(document.querySelectorAll('.in-ticket'));
  var pocketPhotos = Array.prototype.slice.call(document.querySelectorAll('.in-pocket__photo'));

  var opened = false;
  var idleClicks = 0;
  var jokeTimer = null;

  /* ---------------------------------------------------------- unlock */

  function unlock(picked) {
    if (opened) return;
    opened = true;
    if (picked) picked.classList.add('is-picked');
    cover.classList.add('is-opening');
    // let the lid-pop land before the card slides away
    setTimeout(function () {
      cover.classList.add('is-open');
      site.hidden = false;
      if (window.scrollY > 0) window.scrollTo(0, 0);
      observeReveals();
    }, 480);
  }

  gifts.forEach(function (giftEl) {
    var btn = giftEl.querySelector('.in-gift__btn');
    btn.addEventListener('click', function (ev) {
      if (opened) return;
      ev.stopPropagation();
      unlock(giftEl);
    });
  });

  // Three taps on the cover that miss a gift = the joke interstitial.
  if (cover) cover.addEventListener('click', function () {
    if (opened || !joke.hidden) return;
    idleClicks++;
    if (idleClicks >= 3) { showJoke(); idleClicks = 0; }
  });

  /* ---------------------------------------------------------- joke */

  function showJoke() {
    if (opened) return;
    joke.hidden = false;
    clearTimeout(jokeTimer);
    jokeTimer = setTimeout(hideJoke, 2500);
  }
  function hideJoke() {
    joke.hidden = true;
    clearTimeout(jokeTimer);
  }
  if (noBtn) noBtn.addEventListener('click', function () { showJoke(); });
  if (joke) joke.addEventListener('click', hideJoke);

  /* ---------------------------------------------------------- coupons */

  // Auto-shrink coupon text so long strings never clip (measure after fonts).
  function fitTicket(span) {
    var size = 19;
    span.style.setProperty('--fit', size + 'px');
    // shrink until it fits the body width (parent minus padding)
    var guard = 24;
    while (guard-- > 0 && span.scrollWidth > span.parentElement.clientWidth && size > 11) {
      size -= 1;
      span.style.setProperty('--fit', size + 'px');
    }
  }
  function fitAll() {
    tickets.forEach(function (t) {
      var span = t.querySelector('[data-fit]');
      if (span) fitTicket(span);
    });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);
  window.addEventListener('resize', fitAll);
  fitAll();

  // One-tap redeem, double-tap un-redeem.
  var lastTap = { i: -1, t: 0 };
  tickets.forEach(function (ticket, i) {
    ticket.addEventListener('click', function () {
      var now = Date.now();
      var isDouble = lastTap.i === i && now - lastTap.t < 420;
      lastTap = { i: i, t: now };
      if (isDouble) {
        ticket.setAttribute('aria-pressed', 'false');
        lastTap = { i: -1, t: 0 };
      } else if (ticket.getAttribute('aria-pressed') !== 'true') {
        ticket.setAttribute('aria-pressed', 'true');
      }
    });
  });

  /* ---------------------------------------------------------- pocket */

  pocketPhotos.forEach(function (photo) {
    photo.addEventListener('click', function () {
      var open = photo.getAttribute('aria-expanded') === 'true';
      // tuck the others back
      pocketPhotos.forEach(function (p) { p.setAttribute('aria-expanded', 'false'); });
      photo.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
  });

  /* ---------------------------------------------------------- reveals */

  function observeReveals() {
    var els = Array.prototype.slice.call(document.querySelectorAll('.in-reveal'));
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      if (couponsSection) couponsSection.classList.add('is-in');
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
    if (couponsSection) {
      var io2 = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { couponsSection.classList.add('is-in'); io2.disconnect(); }
        });
      }, { threshold: 0.15 });
      io2.observe(couponsSection);
    }
    fitAll();
  }

  // Preview pages land with the cover — that's the point of the demo.
})();
