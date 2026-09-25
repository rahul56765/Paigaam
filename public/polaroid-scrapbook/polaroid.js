(function () {
  'use strict';

  /* ---------- Read payload from server ---------- */
  var payloadEl = document.getElementById('psPayload');
  var payload = { photos: [] };
  if (payloadEl) {
    try { payload = JSON.parse(payloadEl.textContent); } catch (e) {}
  }
  var photos = Array.isArray(payload.photos) ? payload.photos : [];

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Placeholder images: inline SVG data URIs, 5 variants ---------- */
  function ph(bg1, bg2, doodle, stroke) {
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + bg1 + '"/><stop offset="1" stop-color="' + bg2 + '"/>' +
      '</linearGradient></defs>' +
      '<rect width="600" height="600" fill="url(#g)"/>' +
      '<circle cx="470" cy="120" r="70" fill="rgba(255,255,255,0.25)"/>' +
      '<circle cx="100" cy="500" r="90" fill="rgba(255,255,255,0.15)"/>' +
      '<g transform="translate(300,300) scale(6)" fill="none" stroke="' + stroke + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.85">' +
      doodle + '</g></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  var heartD  = '<path d="M0 22 C -14 12, -22 4, -22 -5 C -22 -12, -17 -16, -12 -16 C -7 -16, -2 -12, 0 -7 C 2 -12, 7 -16, 12 -16 C 17 -16, 22 -12, 22 -5 C 22 4, 14 12, 0 22 Z"/>';
  var cupD    = '<path d="M-14 -8 h28 v14 a14 14 0 0 1 -28 0 Z"/><path d="M14 -6 h8 a6 6 0 0 1 0 12 h-8"/><path d="M-8 -14 q2 -4 0 -8 M0 -14 q2 -4 0 -8"/>';
  var starD   = '<path d="M0 -20 L5 -5 L21 -5 L8 4 L13 20 L0 10 L-13 20 L-8 4 L-21 -5 L-5 -5 Z"/>';
  var sunD    = '<circle cx="0" cy="0" r="10"/><path d="M0 -18 v-6 M0 18 v6 M-18 0 h-6 M18 0 h6 M-13 -13 l-4 -4 M13 13 l4 4 M13 -13 l4 -4 M-13 13 l-4 4"/>';
  var flowerD = '<circle cx="0" cy="0" r="4"/><path d="M0 -5 C -3 -14, 3 -14, 0 -5 M0 5 C 3 14, -3 14, 0 5 M-5 0 C -14 -3, -14 3, -5 0 M5 0 C 14 3, 14 -3, 5 0"/>';
  var placeholders = [
    ph('#F2C4BC', '#FFE9E2', heartD,  '#D98A80'),
    ph('#F7DCC0', '#FFF3E4', cupD,    '#8A6A4B'),
    ph('#E8C8CF', '#FBE8EC', starD,   '#C77A88'),
    ph('#F5E3C8', '#FFF8EA', sunD,    '#C99B5F'),
    ph('#EDD6CF', '#FFF0EA', flowerD, '#D98A80'),
  ];

  /* ---------- Fill photo areas ---------- */
  var polaroids = Array.prototype.slice.call(document.querySelectorAll('.polaroid'));
  polaroids.forEach(function (card) {
    var idx = parseInt(card.getAttribute('data-photo'), 10);
    var area = card.querySelector('.photo-area');
    if (!area) return;
    // Skip if the server already rendered an <img> (uploaded photo).
    if (area.querySelector('img')) return;
    var photoData = photos[idx] || {};
    var src = photoData.src || placeholders[idx % placeholders.length];
    var img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.loading = 'lazy';
    area.appendChild(img);
  });

  /* ---------- Scroll reveal via IntersectionObserver ---------- */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('shown'); });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('shown');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { observer.observe(el); });
  }

  /* ---------- Doodle heart draws with scroll (between polaroids 2 and 3) ---------- */
  var heartPath = document.getElementById('doodleHeartPath');
  var allPolaroids = document.querySelectorAll('.polaroid');
  var p2 = allPolaroids[1] || null;
  var p3 = allPolaroids[2] || null;

  if (heartPath) {
    var heartLen = heartPath.getTotalLength ? heartPath.getTotalLength() : 200;
    heartPath.style.strokeDasharray = String(heartLen);

    if (reducedMotion || !p2 || !p3) {
      // Reduced motion or fewer than 3 polaroids: draw it immediately.
      heartPath.style.strokeDashoffset = '0';
    } else {
      heartPath.style.strokeDashoffset = String(heartLen);
      var updateHeart = function () {
        var a = p2.getBoundingClientRect();
        var b = p3.getBoundingClientRect();
        var vh = window.innerHeight;
        // progress: 0 when p2 centre passes viewport bottom, 1 when p3 centre reaches mid-viewport
        var start = a.top + a.height / 2 - vh;
        var end   = b.top + b.height / 2 - vh * 0.5;
        var span  = Math.max(end - start, 1);
        var progress = Math.min(1, Math.max(0, (-start) / span));
        heartPath.style.strokeDashoffset = String(heartLen * (1 - progress));
      };
      var ticking = false;
      var onScroll = function () {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(function () { updateHeart(); ticking = false; });
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      updateHeart();
    }
  }

  /* ---------- Lightbox ---------- */
  var lightbox  = document.getElementById('lightbox');
  var lbPhoto   = document.getElementById('lightboxPhoto');
  var lbCaption = document.getElementById('lightboxCaption');
  var lbDate    = document.getElementById('lightboxDate');
  var lbClose   = document.getElementById('lightboxClose');
  if (!lightbox || !lbPhoto || !lbCaption || !lbDate || !lbClose) return;

  var lastFocused = null;

  function openLightbox(idx) {
    var photoData = photos[idx] || {};
    var src     = photoData.src || placeholders[idx % placeholders.length];
    var caption = photoData.caption || '';
    var date    = photoData.date    || '';
    lbPhoto.innerHTML = '';
    var img = document.createElement('img');
    img.src = src;
    img.alt = caption;
    lbPhoto.appendChild(img);
    lbCaption.textContent = caption;
    lbDate.textContent    = date;
    lightbox.classList.add('open');
    document.body.classList.add('lightbox-open');
    lastFocused = document.activeElement;
    lbClose.focus();
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.classList.remove('lightbox-open');
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  polaroids.forEach(function (card) {
    var idx = parseInt(card.getAttribute('data-photo'), 10);
    card.addEventListener('click', function () { openLightbox(idx); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(idx);
      }
    });
  });

  lbClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && lightbox.classList.contains('open')) closeLightbox();
  });
})();
