(function () {
  'use strict';
  var story = document.getElementById('rvStory');
  var envelope = document.getElementById('envelope');
  var saveDate = document.getElementById('save-date');
  var seal = envelope && envelope.querySelector('.rv-envelope__seal');
  var openVideo = envelope && envelope.querySelector('.rv-envelope__open-video');
  if (!story || !envelope) return;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) document.body.classList.add('rv-reduced');
  if (openVideo && !reduced) {
    openVideo.preload = 'auto';
    openVideo.load();
  }
  var opened = false, advanced = false, transitionStarted = false;
  function beginSaveDateTransition() {
    if (transitionStarted) return;
    transitionStarted = true;
    envelope.classList.add('is-fading');
    if (!saveDate) return;
    saveDate.classList.add('is-arriving');
    window.setTimeout(function () { saveDate.classList.add('is-arrived'); }, reduced ? 0 : 180);
    window.setTimeout(function () {
      saveDate.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }, reduced ? 0 : 320);
  }
  function advanceToCard() {
    if (advanced) return;
    advanced = true;
    beginSaveDateTransition();
    if (seal) seal.setAttribute('aria-expanded', 'true');
    window.setTimeout(function () {
      envelope.setAttribute('aria-hidden', 'true');
      if (saveDate && typeof saveDate.focus === 'function') saveDate.focus({ preventScroll: true });
    }, reduced ? 20 : 850);
  }
  function openInvitation() {
    if (opened) return;
    opened = true;
    envelope.classList.add('is-opening');
    if (reduced || !openVideo) {
      envelope.classList.add('is-reduced-open');
      advanceToCard();
      return;
    }
    var openingTimer = window.setTimeout(function () {
      document.body.classList.add('rv-video-fallback');
      envelope.classList.add('is-reduced-open');
      advanceToCard();
    }, 8000);
    openVideo.addEventListener('ended', function () { window.clearTimeout(openingTimer); advanceToCard(); }, { once: true });
    openVideo.addEventListener('error', function () {
      window.clearTimeout(openingTimer);
      document.body.classList.add('rv-video-fallback');
      envelope.classList.add('is-reduced-open');
      window.setTimeout(advanceToCard, 900);
    }, { once: true });
    openVideo.currentTime = 0;
    openVideo.playbackRate = 1.5;
    if ('preservesPitch' in openVideo) openVideo.preservesPitch = true;
    var playback = openVideo.play();
    if (playback && typeof playback.catch === 'function') playback.catch(function () {
      window.clearTimeout(openingTimer);
      document.body.classList.add('rv-video-fallback');
      envelope.classList.add('is-reduced-open');
      window.setTimeout(advanceToCard, 900);
    });
  }
  if (seal) seal.addEventListener('click', openInvitation);

  // The envelope photo is the first screen; allow native scrolling to begin the
  // story even when the invitation is opened without JavaScript or the seal.
  var scenes = Array.prototype.slice.call(story.querySelectorAll('.rv-scene'));
  if (scenes.length) {
    scenes[0].classList.add('is-seen', 'is-current');
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && entry.intersectionRatio > .38) {
          scenes.forEach(function (s) { s.classList.toggle('is-current', s === entry.target); });
          entry.target.classList.add('is-seen');
        }
      });
    }, { threshold: [.38, .6] });
    scenes.forEach(function (scene) { io.observe(scene); });
  } else {
    scenes.forEach(function (scene) { scene.classList.add('is-seen'); });
  }
  document.documentElement.classList.add('rv-js');

  // Keep taps on the venue link purely navigational; no scroll handler traps
  // touch gestures, so the browser's native momentum scroll remains natural.
  document.querySelectorAll('.rv-map').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (!a.href || a.href === window.location.href) e.preventDefault();
    });
  });
})();
