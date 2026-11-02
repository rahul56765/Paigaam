/* Vaidehi: progressive enhancement. Every section and link is server-rendered. */
(function () {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const body = document.body;
  const main = $('#vv-invitation');
  if (!main) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const sections = $$('[data-vv-section]');
  const nav = $('.vv-navigation');
  const navLinks = $$('.vv-navigation a');
  const gate = $('#vv-gate');
  const openButton = $('#vv-open');
  const audio = $('#vv-audio');
  const musicButton = $('#vv-music-toggle');
  const musicStatus = $('#vv-music-status');
  let currentSection = 0;
  let opened = false;
  let frame = 0;
  function musicState(playing, message = '') {
    if (!musicButton) return;
    musicButton.setAttribute('aria-pressed', String(playing));
    musicButton.setAttribute('aria-label', playing ? 'Pause background music' : 'Play background music');
    musicStatus.textContent = message;
  }
  function playMusic() {
    if (!audio) return;
    const promise = audio.play();
    if (promise && promise.catch) promise.catch(() => musicState(false, 'Tap ♪ to play your music.'));
  }
  if (audio) {
    audio.addEventListener('playing', () => musicState(true));
    audio.addEventListener('pause', () => musicState(false));
    audio.addEventListener('error', () => musicState(false, 'Music could not load. The invitation is still available.'));
    musicButton.addEventListener('click', () => audio.paused ? playMusic() : audio.pause());
  }
  function openInvitation() {
    if (opened) return;
    opened = true;
    body.classList.remove('vv-locked');
    main.inert = false;
    gate.classList.add('is-open');
    gate.inert = true;
    nav.hidden = false;
    // Only a direct user gesture may start the optional uploaded song.
    playMusic();
    $('#vv-cover').focus({ preventScroll:true });
    setTimeout(() => { gate.hidden = true; }, reduced.matches ? 0 : 950);
    update();
  }
  if (!location.hash) {
    gate.hidden = false; main.inert = true; body.classList.add('vv-locked');
    openButton.addEventListener('click', openInvitation);
    $('.vv-skip').addEventListener('click', openInvitation, { once:true });
  } else { opened = true; nav.hidden = false; gate.hidden = true; }
  if ('IntersectionObserver' in window && !reduced.matches) {
    body.classList.add('vv-motion');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
      });
    }, { threshold:0, rootMargin:'0px 0px -4% 0px' });
    $$('.vv-reveal').forEach(el => observer.observe(el));
  }
  const photos = $$('[data-vv-photo]');
  const moments = $('#vv-moments');
  const sticky = $('.vv-moments-sticky');
  let photoIndex = 0;
  function setPhoto(index) {
    if (!photos.length) return;
    photoIndex = Math.max(0, Math.min(photos.length - 1, index));
    photos.forEach((el,i) => {
      el.classList.toggle('is-active', i === photoIndex);
      el.classList.toggle('is-past', i < photoIndex);
      el.tabIndex = i === photoIndex ? 0 : -1;
      el.setAttribute('aria-hidden', String(i !== photoIndex));
    });
    $('[data-vv-photo-counter]').textContent = (photoIndex + 1) + ' / ' + photos.length;
    $('[data-vv-photo-prev]').disabled = photoIndex === 0;
    $('[data-vv-photo-next]').disabled = photoIndex === photos.length - 1;
  }
  function measureGallery() {
    if (!moments || !sticky) return;
    const distance = Math.max(0, photos.length - 1) * sticky.offsetHeight * .48;
    moments.style.height = (photos.length ? sticky.offsetHeight + distance : sticky.offsetHeight) + 'px';
  }
  function photoStep(direction) {
    const index = Math.max(0, Math.min(photos.length - 1, photoIndex + direction));
    setPhoto(index);
    if (photos.length > 1) {
      const extra = Math.max(0, moments.offsetHeight - sticky.offsetHeight);
      window.scrollTo({ top:window.scrollY + moments.getBoundingClientRect().top + extra * index / (photos.length - 1), behavior:reduced.matches?'instant':'smooth' });
    }
  }
  if (photos.length) {
    $('[data-vv-photo-prev]').addEventListener('click', () => photoStep(-1));
    $('[data-vv-photo-next]').addEventListener('click', () => photoStep(1));
    let start = null;
    const stack = $('#vv-photo-stack');
    stack.addEventListener('touchstart', e => { if (e.touches.length === 1) start = {x:e.touches[0].clientX,y:e.touches[0].clientY}; }, {passive:true});
    stack.addEventListener('touchend', e => {
      if (!start || !e.changedTouches.length) return;
      const dx = e.changedTouches[0].clientX - start.x, dy = e.changedTouches[0].clientY - start.y;
      start = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) photoStep(dx < 0 ? 1 : -1);
    }, {passive:true});
    setPhoto(0);
  }
  const lightbox = $('#vv-lightbox');
  let lightboxIndex = 0;
  let lastFocus = null;
  function showLightboxPhoto(index) {
    lightboxIndex = (index + photos.length) % photos.length;
    const original = $('img', photos[lightboxIndex]);
    $('figure img', lightbox).src = original.src;
    $('figure img', lightbox).alt = original.alt;
    $('figcaption', lightbox).textContent = $('span', photos[lightboxIndex]).textContent;
  }
  photos.forEach((button,i) => button.addEventListener('click', () => {
    lastFocus = button; showLightboxPhoto(i);
    if (!lightbox.open) lightbox.showModal();
    $('[data-vv-lightbox-close]').focus();
  }));
  $('[data-vv-lightbox-close]').addEventListener('click', () => lightbox.close());
  $('[data-vv-lightbox-prev]').addEventListener('click', () => showLightboxPhoto(lightboxIndex - 1));
  $('[data-vv-lightbox-next]').addEventListener('click', () => showLightboxPhoto(lightboxIndex + 1));
  lightbox.addEventListener('close', () => { if (lastFocus) lastFocus.focus({preventScroll:true}); });
  lightbox.addEventListener('click', e => { if (e.target === lightbox) lightbox.close(); });
  function goTo(index) {
    index = Math.max(0, Math.min(sections.length - 1, index));
    sections[index].scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});
    sections[index].focus({preventScroll:true});
  }
  $('[data-vv-prev]').addEventListener('click', () => goTo(currentSection - 1));
  $('[data-vv-next]').addEventListener('click', () => goTo(currentSection + 1));
  navLinks.forEach((a,i) => a.addEventListener('click', e => { e.preventDefault(); goTo(i); }));
  document.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (lightbox.open) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); showLightboxPhoto(lightboxIndex + (e.key === 'ArrowLeft' ? -1 : 1)); }
      return; // Native dialog handles Escape and keyboard focus containment.
    }
    if (!opened) return;
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && currentSection === 2 && photos.length) { e.preventDefault(); photoStep(e.key === 'ArrowLeft' ? -1 : 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); goTo(currentSection + (e.key === 'ArrowLeft' ? -1 : 1)); }
  });
  function update() {
    frame = 0;
    let active = 0;
    sections.forEach((s,i) => { if (s.getBoundingClientRect().top <= window.innerHeight * .32) active = i; });
    currentSection = active;
    navLinks.forEach((a,i) => i === active ? a.setAttribute('aria-current','location') : a.removeAttribute('aria-current'));
    $('[data-vv-prev]').disabled = active === 0;
    $('[data-vv-next]').disabled = active === sections.length - 1;
    if (photos.length > 1) {
      const extra = moments.offsetHeight - sticky.offsetHeight;
      const progress = extra > 0 ? -moments.getBoundingClientRect().top / extra : 0;
      setPhoto(Math.round(Math.max(0,Math.min(1,progress)) * (photos.length - 1)));
    }
  }
  window.addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(update); }, {passive:true});
  window.addEventListener('resize', () => { measureGallery(); update(); });
  if ('ResizeObserver' in window) new ResizeObserver(() => { measureGallery(); update(); }).observe(sticky);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measureGallery(); update(); });
  measureGallery(); update();
  const timer = $('.vv-timer[data-target]');
  const status = $('.vv-countdown-status');
  let timerId = null;
  function tick(now = Date.now()) {
    if (!timer) return;
    const target = Number(timer.dataset.target);
    if (!Number.isFinite(target)) return;
    const seconds = Math.max(0, Math.floor((target - now) / 1000));
    const values = [Math.floor(seconds/86400), Math.floor(seconds/3600)%24, Math.floor(seconds/60)%60, seconds%60];
    ['days','hours','minutes','seconds'].forEach((unit,i) => { $('[data-unit="'+unit+'"]',timer).textContent = String(values[i]).padStart(2,'0'); });
    if (seconds === 0) { status.textContent = 'The celebration has begun!'; if (timerId) clearInterval(timerId); }
  }
  if (timer) { tick(); timerId = setInterval(tick, 1000); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  window.addEventListener('pagehide', () => { if (audio) audio.pause(); });
}());
