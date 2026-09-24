'use strict';
/**
 * Sau Wajah — the experience script.
 *
 * Ported from felisaans/cute-birthday-website js/{script,gallery,reasons}.js
 * (MIT). One document, four scenes: the scene switcher replaces the
 * original's page-to-page blur navigation, and because there are no page
 * loads any more the persistent song and the little note survive by
 * construction (the original bridged them with sessionStorage/localStorage).
 *
 * Mechanics kept 1:1: the slideshow's 400ms crossfade and tilt cycle, the
 * tap-a-polaroid hearts, the swipe threshold of 40px, the auto-scroll at
 * 0.35px/frame pausing 1800ms on interaction, the typewriter at 22ms/char,
 * 140 confetti pieces for 260 frames, the floating-hearts spawn every
 * 700ms, the note debounced save at 500ms and the music-note particles.
 * The original's placeholder GIFs became inline SVG artwork rendered
 * server-side.
 */
(function () {
  var body = document.body;
  if (!body || !body.classList.contains('sw')) return;

  var payloadNode = document.getElementById('swPayload');
  var CFG = { photos: [], captions: [], music: '/sau-wajah/media/music.mp3' };
  try { CFG = JSON.parse(payloadNode ? payloadNode.textContent : '{}') || CFG; } catch (e) { /* defaults hold */ }

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var inFrame = window !== window.parent; // collection thumbnails autoplay quietly

  function el(id) { return document.getElementById(id); }

  /* ------------------------------------------------------ scene switching */

  var PAGES = ['hero', 'gallery', 'reasons', 'letter'];
  var sections = {};
  var current = 'hero';
  PAGES.forEach(function (name) { sections[name] = el('sw' + name.charAt(0).toUpperCase() + name.slice(1)); });

  var navBtns = Array.prototype.slice.call(document.querySelectorAll('.sw-page-nav button'));

  function showScene(name) {
    if (!sections[name] || name === current) return;
    sections[current].classList.remove('is-active');
    var outgoing = sections[current];
    current = name;
    // Let the outgoing section unmount before the incoming one mounts.
    setTimeout(function () {
      PAGES.forEach(function (p) {
        var section = sections[p];
        if (!section) return;
        if (p === name) { section.hidden = false; requestAnimationFrame(function () { section.classList.add('is-active'); }); }
        else section.hidden = true;
      });
      var section = sections[name];
      if (section) section.scrollTop = 0;
      if (name === 'letter') onLetterScene();
    }, outgoing ? 180 : 0);
    navBtns.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-goto') === name); });
  }

  document.addEventListener('click', function (e) {
    var target = e.target.closest('[data-goto]');
    if (!target) return;
    showScene(target.getAttribute('data-goto'));
  });

  /* ---------------------------------------------------- floating background */

  var floatingBg = el('swFloatingBg');
  var floatEmojis = ['💖', '✨', '🩷', '💫', '💙', '💜'];
  var floatTimer = null;
  function spawnFloaty() {
    if (!floatingBg || document.hidden) return;
    var node = document.createElement('span');
    node.className = 'floaty';
    node.textContent = floatEmojis[Math.floor(Math.random() * floatEmojis.length)];
    node.style.left = Math.random() * 100 + 'vw';
    node.style.fontSize = (16 + Math.random() * 18) + 'px';
    var duration = 8 + Math.random() * 8;
    node.style.animationDuration = duration + 's';
    floatingBg.appendChild(node);
    setTimeout(function () { node.remove(); }, duration * 1000);
  }
  if (!reduced) floatTimer = setInterval(spawnFloaty, 700);

  /* --------------------------------------------- persistent background music */

  var bgMusic = document.createElement('audio');
  bgMusic.id = 'bgMusic';
  bgMusic.loop = true;
  bgMusic.preload = 'auto';
  bgMusic.src = CFG.music || '/sau-wajah/media/music.mp3';
  body.appendChild(bgMusic);

  var musicBtn = document.createElement('button');
  musicBtn.id = 'musicBtn';
  musicBtn.className = 'sw-music-btn';
  musicBtn.setAttribute('aria-label', 'play music');
  musicBtn.title = 'play our song';
  musicBtn.innerHTML = '<span class="music-icon">🎵</span>';
  body.appendChild(musicBtn);
  var musicIcon = musicBtn.querySelector('.music-icon');
  var noteInterval = null;

  function spawnMusicNote() {
    var notes = ['🎵', '🎶', '💫'];
    var note = document.createElement('span');
    note.className = 'sw-music-note';
    note.textContent = notes[Math.floor(Math.random() * notes.length)];
    note.style.setProperty('--drift', (Math.random() * 40 - 20) + 'px');
    musicBtn.appendChild(note);
    setTimeout(function () { note.remove(); }, 1400);
  }
  function setMusicUI(isPlaying) {
    musicBtn.classList.toggle('playing', isPlaying);
    musicIcon.textContent = isPlaying ? '🎶' : '🎵';
    clearInterval(noteInterval);
    if (isPlaying) noteInterval = setInterval(spawnMusicNote, 500);
  }
  musicBtn.addEventListener('click', function () {
    if (bgMusic.paused) { bgMusic.play().catch(function () {}); setMusicUI(true); }
    else { bgMusic.pause(); setMusicUI(false); }
  });
  // The demo lives in an iframe on collection pages: never autoplay there.
  if (!inFrame && reduced !== true) {
    var kick = function () {
      bgMusic.play().then(function () { setMusicUI(true); }).catch(function () { setMusicUI(false); });
      document.removeEventListener('pointerdown', kick);
      document.removeEventListener('keydown', kick);
    };
    document.addEventListener('pointerdown', kick, { once: false });
    document.addEventListener('keydown', kick, { once: false });
  }

  /* ------------------------------------------------------------ her note */

  var NOTE_STORAGE_KEY = 'paigaamSauWajahNote';

  var noteBtn = document.createElement('button');
  noteBtn.id = 'noteBtn';
  noteBtn.className = 'sw-note-btn';
  noteBtn.setAttribute('aria-label', 'write a little note');
  noteBtn.title = 'write a little note';
  noteBtn.innerHTML = '<span class="note-icon">📝</span>';
  body.appendChild(noteBtn);

  var noteOverlay = document.createElement('div');
  noteOverlay.className = 'sw-note-overlay';
  noteOverlay.innerHTML =
    '<div class="sw-note-paper" role="dialog" aria-label="A little note">' +
    '<button class="sw-note-close" aria-label="close note">✕</button>' +
    '<h3 class="sw-note-title">just for you to fill in 💌</h3>' +
    '<p class="sw-note-hint">write whatever you want to say back — it stays right here in your browser.</p>' +
    '<textarea class="sw-note-textarea" placeholder="dear... I want to tell you..."></textarea>' +
    '<span class="sw-note-saved">saved ✓</span>' +
    '</div>';
  body.appendChild(noteOverlay);

  var noteTextarea = noteOverlay.querySelector('.sw-note-textarea');
  var noteSavedTag = noteOverlay.querySelector('.sw-note-saved');
  var noteSaveTimeout = null;

  try { noteTextarea.value = localStorage.getItem(NOTE_STORAGE_KEY) || ''; } catch (e) { /* private mode */ }
  noteTextarea.addEventListener('input', function () {
    clearTimeout(noteSaveTimeout);
    noteSavedTag.classList.remove('show');
    noteSaveTimeout = setTimeout(function () {
      try { localStorage.setItem(NOTE_STORAGE_KEY, noteTextarea.value); } catch (e) { /* private mode */ }
      noteSavedTag.classList.add('show');
      setTimeout(function () { noteSavedTag.classList.remove('show'); }, 1400);
    }, 500);
  });
  noteBtn.addEventListener('click', function () {
    noteOverlay.classList.add('open');
    setTimeout(function () { noteTextarea.focus(); }, 200);
  });
  noteOverlay.querySelector('.sw-note-close').addEventListener('click', function () { noteOverlay.classList.remove('open'); });
  noteOverlay.addEventListener('click', function (e) { if (e.target === noteOverlay) noteOverlay.classList.remove('open'); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && noteOverlay.classList.contains('open')) noteOverlay.classList.remove('open');
  });

  /* -------------------------------------------------------------- gallery */

  var photos = (CFG.photos && CFG.photos.length ? CFG.photos : []).slice(0, 9);
  var PLACEHOLDER_COUNT = 4;
  var slides = [];
  for (var i = 0; i < Math.max(photos.length, PLACEHOLDER_COUNT); i++) {
    if (photos[i]) slides.push({ url: photos[i].url, alt: photos[i].alt || 'a shared memory', placeholder: false });
    else slides.push({ url: '', alt: 'a placeholder memory', placeholder: true });
  }
  var tilts = ['-3deg', '2deg', '-1.5deg', '3deg'];
  var photoFrame = el('swPhotoFrame');
  var polaroidEl = el('swPolaroid');
  var captionEl = el('swCaption');
  var counterEl = el('swCounter');
  var dotsWrap = el('swDots');
  var prevBtn = el('swPrev');
  var nextBtn = el('swNext');
  var photoStage = el('swPhotoStage');
  var currentIndex = 0;
  var isAnimating = false;

  function renderSlideStatic() {
    if (!photoFrame) return;
    var data = slides[currentIndex];
    photoFrame.innerHTML = '';
    if (data.placeholder) {
      var holder = document.createElement('div');
      holder.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:' + ['#FFD6E8', '#D6ECFF', '#E6D9FF', '#FFE8D6'][currentIndex % 4];
      holder.innerHTML = '<svg viewBox="0 0 200 200" width="100%" height="100%" style="display:block"><text x="100" y="104" text-anchor="middle" font-family="Poppins, sans-serif" font-size="15" font-weight="700" fill="#5b4a5a" opacity="0.55">a photo of us</text></svg>';
      photoFrame.appendChild(holder);
    } else {
      var img = document.createElement('img');
      img.src = data.url;
      img.alt = data.alt;
      photoFrame.appendChild(img);
    }
    polaroidEl.style.setProperty('--tilt', tilts[currentIndex % tilts.length]);
    captionEl.textContent = (CFG.captions && CFG.captions[currentIndex % CFG.captions.length]) || '';
    counterEl.textContent = 'photo ' + (currentIndex + 1) + ' of ' + slides.length;
    if (dotsWrap) {
      Array.prototype.slice.call(dotsWrap.children).forEach(function (dot, i) { dot.classList.toggle('active', i === currentIndex); });
    }
  }

  if (dotsWrap) {
    slides.forEach(function (_, i) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', 'photo ' + (i + 1));
      dot.addEventListener('click', function () { renderSlide(i); });
      dotsWrap.appendChild(dot);
    });
  }
  renderSlideStatic();

  function renderSlide(newIndex) {
    if (isAnimating || newIndex === currentIndex) return;
    isAnimating = true;
    photoFrame.classList.add('is-transitioning');
    captionEl.classList.add('is-transitioning');
    setTimeout(function () {
      currentIndex = newIndex;
      renderSlideStatic();
      requestAnimationFrame(function () {
        photoFrame.classList.remove('is-transitioning');
        captionEl.classList.remove('is-transitioning');
        isAnimating = false;
      });
    }, 400);
  }
  function goNext() { renderSlide((currentIndex + 1) % slides.length); }
  function goPrev() { renderSlide((currentIndex - 1 + slides.length) % slides.length); }

  if (nextBtn) nextBtn.addEventListener('click', goNext);
  if (prevBtn) prevBtn.addEventListener('click', goPrev);
  document.addEventListener('keydown', function (e) {
    if (current !== 'gallery') return;
    if (e.key === 'ArrowRight') goNext();
    if (e.key === 'ArrowLeft') goPrev();
  });
  var touchStartX = 0;
  if (photoStage) {
    photoStage.addEventListener('touchstart', function (e) { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    photoStage.addEventListener('touchend', function (e) {
      var delta = e.changedTouches[0].screenX - touchStartX;
      if (Math.abs(delta) > 40) { if (delta < 0) goNext(); else goPrev(); }
    }, { passive: true });
  }
  if (polaroidEl) {
    polaroidEl.addEventListener('click', function (e) {
      var rect = polaroidEl.getBoundingClientRect();
      var heart = document.createElement('span');
      heart.className = 'sw-mini-heart';
      heart.textContent = ['💖', '💕', '✨', '🩷'][Math.floor(Math.random() * 4)];
      heart.style.left = (e.clientX - rect.left) + 'px';
      heart.style.top = (e.clientY - rect.top) + 'px';
      polaroidEl.appendChild(heart);
      setTimeout(function () { heart.remove(); }, 1000);
    });
  }

  /* ------------------------------------------------- clothesline + lightbox */

  var hanging = el('swHanging');
  var hangData = (photos.length ? photos : CFG.demoMedia || []).slice(0, 6);
  var HANG_COUNT = 6;
  var hangClips = ['clip-pink', 'clip-blue', 'clip-lavender'];
  var hangFrames = ['frame-pink', 'frame-blue', 'frame-lavender'];
  var hangTilts = [-6, 4, -3, 5, -5, 3];
  var hangDrops = [6, 18, 2, 14, 8, 20];
  var hangSources = [];
  for (var h = 0; h < HANG_COUNT; h++) {
    hangSources.push(hangData[h % Math.max(hangData.length, 1)] || null);
  }

  if (hanging) {
    hangSources.forEach(function (photo, i) {
      var wrap = document.createElement('div');
      wrap.className = 'sw-hang-photo';
      wrap.style.setProperty('--tilt', hangTilts[i] + 'deg');
      wrap.style.setProperty('--drop', hangDrops[i] + 'px');
      wrap.style.setProperty('--sway-delay', (i * 0.45) + 's');
      var clip = document.createElement('div');
      clip.className = 'clip ' + hangClips[i % 3];
      var frame = document.createElement('div');
      frame.className = 'sw-mini-photo-frame ' + hangFrames[i % 3];
      if (photo && photo.url) {
        var img = document.createElement('img');
        img.src = photo.url;
        img.alt = photo.alt || 'a little reason ' + (i + 1);
        frame.appendChild(img);
      } else {
        frame.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:' + ['#FFE0EC', '#E0F0FF', '#EDE4FF'][i % 3] + '">' +
          '<svg viewBox="0 0 40 40" width="26" height="26"><path d="M20 34 s-9-6-9-12 a5 5 0 0 1 9-3 a5 5 0 0 1 9 3 c0 6-9 12-9 12Z" fill="#FF9FC7" opacity="0.7"/></svg></div>';
      }
      wrap.appendChild(clip);
      wrap.appendChild(frame);
      hanging.appendChild(wrap);
      frame.addEventListener('click', function () { openLightbox(frame); });
    });
  }

  var lightbox = document.createElement('div');
  lightbox.className = 'sw-lightbox';
  lightbox.innerHTML = '<button class="sw-lightbox-close" aria-label="close">✕</button>';
  body.appendChild(lightbox);
  var lightboxImg = document.createElement('img');
  lightboxImg.alt = 'a bigger look';
  lightbox.appendChild(lightboxImg);

  function openLightbox(frame) {
    var img = frame.querySelector('img');
    if (!img) return;
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt;
    lightbox.classList.add('open');
  }
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox || e.target.classList.contains('sw-lightbox-close')) lightbox.classList.remove('open');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && lightbox.classList.contains('open')) lightbox.classList.remove('open');
  });

  /* -------------------------------------------------------- auto-scroll */

  var reasonsBox = el('swReasonsBox');
  if (reasonsBox && !reduced) {
    var scrollSpeed = 0.35; // px per frame — the original's value
    var isPaused = false;
    var resumeTimeout = null;
    var loopScheduled = false;
    function pauseAutoScroll() {
      isPaused = true;
      clearTimeout(resumeTimeout);
      resumeTimeout = setTimeout(function () { isPaused = false; }, 1800);
    }
    ['mouseenter', 'touchstart', 'wheel'].forEach(function (evt) {
      reasonsBox.addEventListener(evt, pauseAutoScroll, { passive: true });
    });
    (function autoScrollStep() {
      if (current === 'reasons' && !isPaused && !document.hidden) {
        reasonsBox.scrollTop += scrollSpeed;
        var atBottom = reasonsBox.scrollTop + reasonsBox.clientHeight >= reasonsBox.scrollHeight - 1;
        if (atBottom && !loopScheduled) {
          loopScheduled = true;
          setTimeout(function () { reasonsBox.scrollTop = 0; loopScheduled = false; }, 1800);
        }
      }
      requestAnimationFrame(autoScrollStep);
    })();
  }

  /* ------------------------------------------------- typewriter + confetti */

  var letterData = document.getElementById('swLetterText');
  var letterSource = letterData ? (letterData.getAttribute('data-letter') || letterData.textContent || '') : '';
  function onLetterScene() {
    typeWriter();
    fireConfetti();
  }

  var typeIndex = 0;
  function typeWriter() {
    if (!letterData || letterData.dataset.done) return;
    if (typeIndex < letterSource.length) {
      var chunk = letterSource.slice(0, typeIndex + 1);
      letterData.textContent = chunk;
      typeIndex++;
      setTimeout(typeWriter, 22);
    } else {
      letterData.dataset.done = '1';
      letterData.textContent = letterSource;
    }
  }

  var canvas = el('swConfettiCanvas');
  var confettiColors = ['#ffd6e8', '#ff9fc7', '#d6ecff', '#a8d8ff', '#e6d9ff', '#c7a9ff', '#ffffff'];
  var confettiPieces = [];
  var confettiActive = false;
  var confettiFrames = 0;
  var MAX_CONFETTI_FRAMES = 260;

  function fireConfetti() {
    if (!canvas || reduced) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    confettiPieces = [];
    for (var i = 0; i < 140; i++) {
      confettiPieces.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height * 0.5,
        size: 6 + Math.random() * 6,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        speedY: 2 + Math.random() * 3,
        speedX: (Math.random() - 0.5) * 2,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 8,
        shape: Math.random() > 0.5 ? 'circle' : 'rect',
      });
    }
    confettiActive = true;
    confettiFrames = 0;
    animateConfetti(ctx);
  }
  function animateConfetti(ctx) {
    if (!confettiActive) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    confettiPieces.forEach(function (p) {
      p.y += p.speedY;
      p.x += p.speedX;
      p.rotation += p.rotationSpeed;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation * Math.PI / 180);
      ctx.fillStyle = p.color;
      if (p.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });
    confettiFrames++;
    if (confettiFrames < MAX_CONFETTI_FRAMES) requestAnimationFrame(function () { animateConfetti(ctx); });
    else { confettiActive = false; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  /* ----------------------------------------------------------------- hero */

  // Hero mounts on load; other scenes mount on first visit.
  sections.hero && sections.hero.classList.add('is-active');
})();
