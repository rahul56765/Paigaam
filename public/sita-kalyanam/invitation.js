(function () {
  'use strict';

  // Accept an ISO target (including its timezone), Date, or millisecond timestamp.
  // An incomplete draft is not an expired wedding and must never yield NaN.
  function countdownParts(target, now) {
    var stamp = typeof target === 'number' ? target : target instanceof Date ? target.getTime() :
      typeof target === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(target) ? Date.parse(target) : NaN;
    var clock = now === undefined ? Date.now() : now instanceof Date ? now.getTime() : Number(now);
    var valid = Number.isFinite(stamp) && Number.isFinite(clock);
    var remaining = valid ? Math.max(0, Math.floor((stamp - clock) / 1000)) : 0;
    return { days: Math.floor(remaining / 86400), hours: Math.floor(remaining / 3600) % 24,
      minutes: Math.floor(remaining / 60) % 60, seconds: remaining % 60,
      expired: valid && stamp <= clock, valid: valid };
  }
  if (typeof module === 'object' && module.exports) module.exports = { countdownParts: countdownParts };
  if (typeof document === 'undefined') return;

  function init() {
    var body = document.querySelector('body.sk-body');
    if (!body || body.dataset.skEnhanced === 'true') return;
    body.dataset.skEnhanced = 'true';
    document.documentElement.classList.remove('no-js');
    document.documentElement.classList.add('js');
    var main = body.querySelector('#skInvitation');
    var opening = body.querySelector('#opening[data-sk-section="opening"]');
    var opener = opening && opening.querySelector('[data-sk-open]');
    var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    var opened = false, openingNow = false, openTimer = 0;
    var startMusic = function () {};

    function finishOpening() {
      if (opened) return;
      opened = true;
      clearTimeout(openTimer);
      body.classList.add('sk-open');
      body.classList.remove('sk-locked', 'sk-is-opening');
      if (opening) opening.hidden = true;
      if (main) main.inert = false;
      // Temporarily override author scroll-behavior so this is never an animated jump.
      var root = document.documentElement, previous = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      try { window.scrollTo(0, 0); } catch (_) { /* Some embedded environments cannot scroll. */ }
      root.style.scrollBehavior = previous;
      var heading = main && main.querySelector('#cover h1');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        try { heading.focus({ preventScroll: true }); } catch (_) { heading.focus(); }
      }
    }
    if (main && opening && opener) {
      body.classList.add('sk-locked');
      main.inert = true;
      opener.hidden = false;
      opener.addEventListener('click', function () {
        if (openingNow || opened) return;
        openingNow = true;
        // Schedule the guaranteed completion before any optional media/animation work.
        openTimer = window.setTimeout(finishOpening, reduce.matches ? 0 : 1800);
        opener.disabled = true;
        body.classList.add('sk-is-opening');
        // Must remain directly inside the trusted click: no promise or timeout first.
        try { startMusic(); } catch (_) { /* Music must never block the invitation. */ }
      });
      window.addEventListener('pageshow', function () { if (openingNow && !opened) finishOpening(); });
    }

    // Each enhancement is independent: a missing optional feature never locks the page.
    [setupReveals, setupGallery, setupCountdowns, setupMusic, setupImages].forEach(function (setup) {
      try { setup(); } catch (_) { /* Preserve the continuous, readable document. */ }
    });

    function setupReveals() {
      var nodes = Array.from(body.querySelectorAll('.sk-reveal'));
      if (reduce.matches || !window.IntersectionObserver) {
        nodes.forEach(function (node) { node.classList.add('is-visible'); });
        return;
      }
      var observer;
      try {
        observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
          });
        }, { threshold: 0.08 });
        nodes.forEach(function (node) { observer.observe(node); });
      } catch (_) { nodes.forEach(function (node) { node.classList.add('is-visible'); }); }
      function showAll() {
        if (!reduce.matches) return;
        observer.disconnect();
        nodes.forEach(function (node) { node.classList.add('is-visible'); });
      }
      if (reduce.addEventListener) reduce.addEventListener('change', showAll);
      else if (reduce.addListener) reduce.addListener(showAll);
    }

    function setupGallery() {
      var dialog = body.querySelector('#skLightbox');
      var large = dialog && dialog.querySelector('[data-sk-lightbox-image]');
      var caption = dialog && dialog.querySelector('[data-sk-lightbox-caption]');
      var close = dialog && dialog.querySelector('[data-sk-lightbox-close]');
      var lightPrev = dialog && dialog.querySelector('[data-sk-lightbox-prev]');
      var lightNext = dialog && dialog.querySelector('[data-sk-lightbox-next]');
      var activePhotos = [], activeIndex = 0, returnFocus = null, lightOpen = false;
      var nativeDialog = dialog && typeof dialog.showModal === 'function';
      var fallbackMainInert = false, fallbackStyle = null;
      function usable(photos) { return photos.filter(function (photo) { return !photo.disabled && photo.querySelector('img') && !photo.dataset.skImageFailed; }); }
      function renderPhoto() {
        var photo = activePhotos[activeIndex], img = photo && photo.querySelector('img');
        if (!img || !large) return;
        large.hidden = false;
        large.style.visibility = '';
        delete large.dataset.skErrorShown;
        var error = dialog.querySelector('[data-sk-lightbox-error]');
        if (error) error.remove();
        large.alt = img.alt || photo.getAttribute('data-caption') || '';
        large.src = img.currentSrc || img.src;
        if (caption) caption.textContent = img.alt || photo.getAttribute('data-caption') || '';
        [lightPrev, lightNext].forEach(function (control) { if (control) control.hidden = activePhotos.length <= 1; });
      }
      function shiftPhoto(delta) {
        if (activePhotos.length <= 1) return;
        activeIndex = (activeIndex + delta + activePhotos.length) % activePhotos.length;
        renderPhoto();
      }
      function restore() {
        if (!lightOpen) return;
        lightOpen = false;
        body.classList.remove('sk-lightbox-open');
        if (!nativeDialog) {
          dialog.removeAttribute('open'); dialog.hidden = true;
          if (fallbackStyle === null) dialog.removeAttribute('style'); else dialog.setAttribute('style', fallbackStyle);
          if (main) main.inert = fallbackMainInert;
        }
        if (returnFocus && returnFocus.isConnected) {
          try { returnFocus.focus({ preventScroll: true }); } catch (_) { returnFocus.focus(); }
        }
      }
      function closeLightbox() {
        if (nativeDialog && dialog.open) dialog.close();
        restore();
      }
      function showPhoto(photo, photos) {
        if (!dialog || !large) return; // Without a dialog, ordinary image/anchor semantics survive.
        activePhotos = usable(photos); activeIndex = activePhotos.indexOf(photo);
        if (activeIndex < 0) return;
        returnFocus = photo; renderPhoto(); dialog.hidden = false;
        if (nativeDialog) {
          try { dialog.showModal(); } catch (_) { return; }
        } else {
          fallbackStyle = dialog.getAttribute('style');
          dialog.setAttribute('open', ''); dialog.setAttribute('role', 'dialog');
          dialog.setAttribute('aria-modal', 'true');
          // Unsupported <dialog> has no UA top layer, so supply a readable overlay.
          dialog.style.cssText += ';display:block;position:fixed;inset:5vh 5vw;width:90vw;max-width:1000px;height:90vh;max-height:90vh;margin:auto;overflow:auto;z-index:2147483647;background:#fff7e8;color:#532e27;padding:1rem;box-sizing:border-box;box-shadow:0 0 0 100vmax rgba(0,0,0,.8)';
          large.style.maxWidth = '100%'; large.style.maxHeight = '70vh'; large.style.objectFit = 'contain';
          // Do not inert an ancestor of the fallback dialog.
          if (main && !main.contains(dialog)) { fallbackMainInert = main.inert; main.inert = true; }
        }
        lightOpen = true; body.classList.add('sk-lightbox-open');
        if (close) close.focus(); else { dialog.setAttribute('tabindex', '-1'); dialog.focus(); }
      }
      if (dialog && large) {
        if (close) close.addEventListener('click', closeLightbox);
        if (lightPrev) lightPrev.addEventListener('click', function () { shiftPhoto(-1); });
        if (lightNext) lightNext.addEventListener('click', function () { shiftPhoto(1); });
        dialog.addEventListener('close', restore);
        dialog.addEventListener('click', function (event) {
          if (event.target !== dialog) return;
          closeLightbox();
        });
        dialog.addEventListener('keydown', function (event) {
          if (!lightOpen) return;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); shiftPhoto(event.key === 'ArrowLeft' ? -1 : 1); }
          if (!nativeDialog && event.key === 'Escape') { event.preventDefault(); closeLightbox(); }
          if (!nativeDialog && event.key === 'Tab') {
            var focusable = Array.from(dialog.querySelectorAll('button:not([disabled]),a[href],input,[tabindex="0"]')).filter(function (node) { return !node.hidden && node.getClientRects().length; });
            var first = focusable[0], last = focusable[focusable.length - 1];
            if (!first) { event.preventDefault(); dialog.focus(); }
            else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
          }
        });
      }
      body.querySelectorAll('[data-sk-gallery]').forEach(function (gallery) {
        var track = gallery.querySelector('.sk-gallery-track');
        if (!track) return;
        var photos = Array.from(track.querySelectorAll('[data-sk-photo]'));
        var dots = Array.from(gallery.querySelectorAll('[data-sk-gallery-go]'));
        var prev = gallery.querySelector('[data-sk-gallery-prev]'), next = gallery.querySelector('[data-sk-gallery-next]');
        var current = gallery.querySelector('[data-sk-gallery-current]'), total = gallery.querySelector('[data-sk-gallery-total]');
        var index = 0, frame = 0;
        if (total) total.textContent = String(photos.length);
        [prev, next].concat(dots).forEach(function (control) { if (control) control.hidden = photos.length <= 1; });
        if (!photos.length) { if (current) current.textContent = '0'; return; }
        function sync() {
          frame = 0;
          var rect = track.getBoundingClientRect(), center = rect.left + rect.width / 2, distance = Infinity;
          photos.forEach(function (photo, i) {
            var r = photo.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - center);
            if (d < distance) { distance = d; index = i; }
          });
          if (current) current.textContent = String(index + 1);
          dots.forEach(function (dot) {
            var selected = Number(dot.getAttribute('data-sk-gallery-go')) === index;
            if (selected) dot.setAttribute('aria-current', 'true'); else dot.removeAttribute('aria-current');
          });
          if (prev) prev.disabled = index === 0;
          if (next) next.disabled = index === photos.length - 1;
        }
        function go(n) {
          n = Math.max(0, Math.min(photos.length - 1, n));
          if (!Number.isInteger(n)) return;
          index = n;
          var rect = track.getBoundingClientRect(), target = photos[n].getBoundingClientRect();
          var left = track.scrollLeft + target.left + target.width / 2 - rect.left - rect.width / 2;
          if (track.scrollTo) track.scrollTo({ left: left, behavior: reduce.matches ? 'auto' : 'smooth' }); else track.scrollLeft = left;
          schedule();
        }
        function schedule() { if (!frame) frame = window.requestAnimationFrame(sync); }
        track.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
        if (window.ResizeObserver) new ResizeObserver(schedule).observe(track);
        if (!track.hasAttribute('tabindex')) track.setAttribute('tabindex', '0');
        gallery.addEventListener('keydown', function (event) {
          if (event.target.closest('input,textarea,select,[contenteditable="true"]') || (dialog && dialog.contains(event.target))) return;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); go(index + (event.key === 'ArrowLeft' ? -1 : 1)); }
        });
        if (prev) prev.addEventListener('click', function () { go(index - 1); });
        if (next) next.addEventListener('click', function () { go(index + 1); });
        dots.forEach(function (dot) { dot.addEventListener('click', function () { go(Number(dot.getAttribute('data-sk-gallery-go'))); }); });
        photos.forEach(function (photo) {
          photo.addEventListener('click', function (event) {
            if (!dialog || !large || photo.dataset.skImageFailed) return;
            event.preventDefault(); showPhoto(photo, photos);
          });
        });
        sync();
      });
    }

    function setupCountdowns() {
      var timers = Array.from(body.querySelectorAll('[data-sk-countdown]')).map(function (node) {
        return { node: node, target: node.getAttribute('data-target'), status: node.querySelector('[data-sk-countdown-status]') };
      });
      var interval = 0;
      function stop() { clearInterval(interval); interval = 0; }
      function tick() {
        var running = false;
        timers.forEach(function (timer) {
          var parts = countdownParts(timer.target);
          ['days', 'hours', 'minutes', 'seconds'].forEach(function (key) {
            var value = timer.node.querySelector('[data-sk-' + key + ']');
            if (value) value.textContent = parts.valid ? String(parts[key]).padStart(2, '0') : '—';
          });
          if (timer.status) timer.status.textContent = parts.expired ? timer.node.getAttribute('data-expired') || '' : '';
          if (parts.valid && !parts.expired) running = true;
        });
        if (!running) stop();
        return running;
      }
      function restart() { stop(); if (!document.hidden && tick()) interval = window.setInterval(tick, 1000); }
      document.addEventListener('visibilitychange', restart);
      restart();
    }

    function setupMusic() {
      var music = body.querySelector('[data-sk-music]'), audio = body.querySelector('#skAudio');
      var toggle = music && music.querySelector('[data-sk-music-toggle]');
      var status = music && music.querySelector('[data-sk-music-status]');
      var youtube = music && music.getAttribute('data-youtube');
      var frame = null, playing = false, intent = false, generation = 0;
      var label = toggle && toggle.getAttribute('aria-label');
      function state(on, message) {
        playing = on;
        if (toggle) {
          toggle.setAttribute('aria-pressed', String(on));
          if (label) toggle.setAttribute('aria-label', label);
          var symbol = toggle.querySelector('[data-sk-music-symbol]');
          if (symbol) symbol.textContent = on ? 'Ⅱ' : '♪'; else toggle.textContent = on ? 'Ⅱ' : '♪';
        }
        if (status && message !== undefined) status.textContent = message;
      }
      function command(func, args) {
        if (frame && frame.contentWindow) frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: args || [] }), 'https://www.youtube-nocookie.com');
      }
      function pause() {
        intent = false; generation++;
        if (audio) audio.pause();
        command('pauseVideo'); state(false, '');
      }
      function play() {
        intent = true;
        var request = ++generation;
        if (audio) {
          try {
            var result = audio.play();
            if (result && result.then) result.then(function () {
              if (request !== generation || !intent || document.hidden) { if (!intent || document.hidden) audio.pause(); return; }
              state(true, '');
            }).catch(function () { if (request === generation) { intent = false; state(false, 'Tap the music button to retry playback.'); } });
          } catch (_) { intent = false; state(false, 'Tap the music button to retry playback.'); }
        } else if (/^[A-Za-z0-9_-]{11}$/.test(youtube || '')) {
          if (!frame) {
            frame = document.createElement('iframe');
            frame.title = 'Wedding background music'; frame.allow = 'autoplay; encrypted-media';
            frame.width = '1'; frame.height = '1'; frame.tabIndex = -1;
            frame.setAttribute('aria-hidden', 'true');
            frame.style.cssText = 'position:absolute;width:1px;height:1px;border:0;clip-path:inset(50%);pointer-events:none';
            frame.src = 'https://www.youtube-nocookie.com/embed/' + youtube + '?autoplay=1&enablejsapi=1&playsinline=1&loop=1&playlist=' + youtube + '&origin=' + encodeURIComponent(window.location.origin);
            frame.addEventListener('load', function () {
              if (frame.contentWindow) frame.contentWindow.postMessage(JSON.stringify({ event: 'listening' }), 'https://www.youtube-nocookie.com');
              command('addEventListener', ['onStateChange']);
              command(intent && !document.hidden ? 'playVideo' : 'pauseVideo');
            });
            (music.querySelector('[data-sk-player]') || music).appendChild(frame);
          } else command('playVideo');
          state(false, 'If the song is silent, tap the music button to retry.');
        } else { intent = false; state(false, 'Music is unavailable.'); }
      }
      if (!audio && !/^[A-Za-z0-9_-]{11}$/.test(youtube || '')) { if (music) music.hidden = true; return; }
      startMusic = play;
      state(false, '');
      if (toggle) toggle.addEventListener('click', function () { if (playing || (audio && intent)) pause(); else play(); });
      if (audio) {
        audio.addEventListener('playing', function () { if (!intent || document.hidden) { audio.pause(); return; } state(true, ''); });
        audio.addEventListener('pause', function () { state(false); });
        audio.addEventListener('ended', function () { intent = false; state(false); });
        audio.addEventListener('error', function () { intent = false; state(false, 'This song could not be loaded. The invitation is still available.'); });
      }
      window.addEventListener('message', function (event) {
        if (!frame || event.source !== frame.contentWindow || event.origin !== 'https://www.youtube-nocookie.com') return;
        var data;
        try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch (_) { return; }
        if (!data) return;
        var value = data.event === 'onStateChange' ? data.info : data.info && data.info.playerState;
        if (value === 1 && (!intent || document.hidden)) { command('pauseVideo'); return; }
        if (typeof value === 'number') state(value === 1, value === 1 ? '' : undefined);
        if (data.event === 'onError') { intent = false; state(false, 'This YouTube song is unavailable. The invitation is still available.'); }
      });
      document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });
      window.addEventListener('pagehide', pause);
    }

    function setupImages() {
      body.querySelectorAll('img').forEach(function (img) {
        function failed() {
          if (img.dataset.skErrorShown) return;
          img.dataset.skErrorShown = 'true';
          var lightbox = img.closest('#skLightbox');
          var photo = img.closest('[data-sk-photo]');
          var message = document.createElement('span');
          message.className = 'sk-image-error'; message.setAttribute('role', 'status');
          message.textContent = 'Photograph unavailable' + (img.alt ? ': ' + img.alt : '.');
          if (lightbox) {
            message.setAttribute('data-sk-lightbox-error', '');
            var existing = lightbox.querySelector('[data-sk-lightbox-error]');
            if (existing) { existing.hidden = false; img.hidden = true; return; }
          }
          // Keep the image's reserved box and aspect ratio; overlay the readable error.
          img.style.visibility = 'hidden';
          var host = img.parentElement;
          if (!host) return;
          if (window.getComputedStyle(host).position === 'static') host.style.position = 'relative';
          if (host.getBoundingClientRect().height < 64) host.style.minHeight = '4rem';
          message.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:1rem;min-height:4rem;box-sizing:border-box;background:#fff7e8;color:#532e27;text-align:center';
          host.appendChild(message);
          if (photo) { photo.dataset.skImageFailed = 'true'; photo.disabled = true; photo.setAttribute('aria-disabled', 'true'); }
        }
        img.addEventListener('error', failed);
        img.addEventListener('load', function () {
          if (!img.dataset.skErrorShown) return;
          delete img.dataset.skErrorShown; img.style.visibility = ''; img.hidden = false;
          var host = img.parentElement, message = host && host.querySelector('.sk-image-error');
          if (message) message.remove();
          var photo = img.closest('[data-sk-photo]');
          if (photo) { delete photo.dataset.skImageFailed; photo.disabled = false; photo.removeAttribute('aria-disabled'); }
        });
        if (img.complete && img.naturalWidth === 0 && (img.getAttribute('src') || img.getAttribute('srcset'))) failed();
      });
    }
    // Jump links deliberately retain their native href/fragment behavior.
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
