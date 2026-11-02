(function () {
  'use strict';
  var card = document.getElementById('llCard');
  if (!card) return;
  var pages = Array.from(card.querySelectorAll('[data-page]'));
  var prev = document.querySelector('[data-prev]'), next = document.querySelector('[data-next]');
  var dots = Array.from(document.querySelectorAll('[data-go]'));
  var current = document.querySelector('[data-current]'), replay = document.querySelector('[data-replay]');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var index = 0, locked = false, animation = null, slideAnimation = null, transitionTimer = 0, swipe = null, pendingTarget = 0;
  function fitLetter() {
    var box = card.querySelector('[data-fit]'), text = box.querySelector('p');
    var portrait = matchMedia('(max-width:600px) and (orientation:portrait)').matches;
    var base = card.clientWidth * (portrait ? .042 : .017);
    // Fit text to its reserved reference zone, including maximum-length edits.
    box.style.setProperty('--copy-size', base + 'px');
    var size = base, minimum = Math.min(base, portrait ? 12 : 11);
    while ((text.scrollHeight > box.clientHeight + 1 || text.scrollWidth > box.clientWidth + 1) && size > minimum) {
      size -= .25; box.style.setProperty('--copy-size', size + 'px');
    }
    if (text.scrollHeight > box.clientHeight + 1) { box.style.overflowY = 'auto'; box.tabIndex = 0; box.setAttribute('aria-label', 'Scroll to read the complete love letter'); }
    else { box.style.overflowY = ''; box.removeAttribute('tabindex'); box.removeAttribute('aria-label'); }
  }
  function sync(focus) {
    pages.forEach(function (page, i) {
      var active = i === index;
      page.classList.toggle('is-current', active);
      page.inert = !active; page.setAttribute('aria-hidden', String(!active));
    });
    dots.forEach(function (dot, i) { if (i === index) dot.setAttribute('aria-current', 'page'); else dot.removeAttribute('aria-current'); });
    document.body.dataset.page = String(index);
    current.textContent = String(index + 1);
    prev.disabled = locked || index === 0; next.disabled = locked || index === pages.length - 1;
    dots.forEach(function (dot) { dot.disabled = locked; });
    replay.hidden = index !== pages.length - 1;
    if (focus) { var heading = pages[index].querySelector('h1,h2'); heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    fitLetter();
  }
  function finishTurn(target, focus) {
    clearTimeout(transitionTimer); if (animation) { var a = animation; animation = null; a.cancel(); }
    if (slideAnimation) { slideAnimation.cancel(); slideAnimation = null; }
    pages.forEach(function (page) { page.style.display = ''; });
    index = target; locked = false; card.classList.remove('is-turning', 'is-sliding'); sync(focus);
  }
  function go(target, focus) {
    if (locked || target < 0 || target >= pages.length || target === index) return;
    pauseAll();
    if (reduce.matches || !card.animate) { finishTurn(target, focus); return; }
    pendingTarget = target; locked = true; sync(false);
    var direction = target > index ? 1 : -1;
    var outer = index === 0 || target === 0 || index === pages.length - 1 || target === pages.length - 1;
    if (!outer) {
      // Inner scrapbook pages move horizontally; the brown stage never scales.
      var outgoing = pages[index], incoming = pages[target];
      card.classList.add('is-sliding'); incoming.style.display = 'block';
      animation = outgoing.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(' + (-direction * 100) + '%)' }], { duration: 350, easing: 'ease-in-out', fill: 'both' });
      slideAnimation = incoming.animate([{ transform: 'translateX(' + (direction * 100) + '%)' }, { transform: 'translateX(0)' }], { duration: 350, easing: 'ease-in-out', fill: 'both' });
      animation.finished.then(function () { finishTurn(target, focus); }).catch(function () {});
      return;
    }
    card.classList.add('is-turning');
    animation = card.animate([
      { transform: 'scale(1) rotateY(0deg)', offset: 0 },
      { transform: 'scale(.70) rotateY(0deg)', offset: .25 },
      { transform: 'scale(.70) rotateY(0deg)', offset: .43 },
      { transform: 'scale(.70) rotateY(' + (direction * 89) + 'deg)', offset: .549 },
      { transform: 'scale(.70) rotateY(' + (-direction * 89) + 'deg)', offset: .551 },
      { transform: 'scale(.70) rotateY(0deg)', offset: .67 },
      { transform: 'scale(.70) rotateY(0deg)', offset: .75 },
      { transform: 'scale(1) rotateY(0deg)', offset: 1 }
    ], { duration: 1400, easing: 'ease-in-out', fill: 'both' });
    // Swap the actual page only while its plane is edge-on.
    transitionTimer = setTimeout(function () { index = target; sync(false); }, 770);
    animation.finished.then(function () { finishTurn(target, focus); }).catch(function () { /* cancelled by a preference change */ });
  }
  prev.addEventListener('click', function () { go(index - 1, true); });
  next.addEventListener('click', function () { go(index + 1, true); });
  dots.forEach(function (dot) { dot.addEventListener('click', function () { go(Number(dot.dataset.go), true); }); });
  card.querySelectorAll('[data-open]').forEach(function (button) { button.addEventListener('click', function () { go(1, true); }); });
  replay.addEventListener('click', function () { go(0, true); });
  document.addEventListener('keydown', function (event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,textarea,select,[contenteditable=true]')) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); go(index + 1, true); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(index - 1, true); }
    if (event.key === 'Home') { event.preventDefault(); go(0, true); }
    if (event.key === 'End') { event.preventDefault(); go(pages.length - 1, true); }
  });
  card.addEventListener('pointerdown', function (event) {
    if (event.isPrimary === false || event.target.closest('button,input,[data-fit]')) return;
    swipe = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  card.addEventListener('pointerup', function (event) {
    if (!swipe || swipe.id !== event.pointerId) return;
    var dx = event.clientX - swipe.x, dy = event.clientY - swipe.y; swipe = null;
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.3) go(index + (dx < 0 ? 1 : -1), false);
  });
  card.addEventListener('pointercancel', function () { swipe = null; });
  card.addEventListener('pointerleave', function () { swipe = null; });
  reduce.addEventListener('change', function () { if (locked) finishTurn(pendingTarget, false); });

  // Native audio is shared between the waveform and song transport. Only one plays at a time.
  var memory = document.getElementById('llMemoryAudio'), song = document.getElementById('llSongAudio');
  var status = document.querySelector('[data-audio-status]'), disc = document.querySelector('[data-disc]');
  var youtubeCard = card.querySelector('.ll-song-player');
  var playlist = JSON.parse(document.getElementById('llPlaylistData').textContent), trackIndex = 0;
  var panel = document.getElementById('llPlaylist');
  function showPlaylist(open) { panel.hidden = !open; disc.setAttribute('aria-expanded', String(open)); }
  disc.addEventListener('click', function () { showPlaylist(panel.hidden); });
  document.querySelector('[data-playlist-close]').addEventListener('click', function () { showPlaylist(false); disc.focus(); });
  document.addEventListener('click', function (event) { if (!panel.hidden && !panel.contains(event.target) && !disc.contains(event.target)) showPlaylist(false); });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !panel.hidden) { showPlaylist(false); disc.focus(); } });
  function pickTrack(n, autoplay) {
    pauseAll(); trackIndex = (n + playlist.length) % playlist.length;
    var item = playlist[trackIndex], videoId = item.youtubeId || '';
    if (iframe) { iframe.remove(); iframe = null; } clearTimeout(ytTimeout);
    ytReady = false; ytPlaying = false; ytTime = 0; ytDuration = 0;
    if (videoId) { youtubeCard.dataset.youtube = videoId; song.removeAttribute('src'); song.load(); }
    else { delete youtubeCard.dataset.youtube; song.src = item.url; song.load(); }
    youtubeCard.querySelector('.ll-song-title').textContent = item.title;
    document.querySelectorAll('[data-track]').forEach(function (button, i) { if (i === trackIndex) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current'); });
    time('song', 0, 0); state('song', false); status.textContent = '';
    if (autoplay) toggle('song');
  }
  document.querySelectorAll('[data-track]').forEach(function (button) { button.addEventListener('click', function () { pickTrack(Number(button.dataset.track), true); }); });
  document.querySelectorAll('[data-track-step]').forEach(function (button) { button.disabled = playlist.length < 2; button.addEventListener('click', function () { pickTrack(trackIndex + Number(button.dataset.trackStep), true); }); });
  var iframe = null, ytReady = false, ytPlaying = false, ytWanted = false, ytBlocked = false, ytDuration = 0, ytTime = 0, ytTimeout = 0;
  function clock(seconds) { seconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0; return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0'); }
  function mediaFor(kind) { return kind === 'memory' ? memory : (youtubeCard.dataset.youtube ? null : song); }
  function state(kind, playing) {
    document.querySelectorAll('[data-play="' + kind + '"]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(playing));
      button.setAttribute('aria-label', (playing ? 'Pause ' : 'Play ') + (kind === 'memory' ? 'memory recording' : 'song'));
      var icon = button.querySelector('[data-play-icon]'); if (icon) icon.textContent = playing ? 'Ⅱ' : '▶';
    });
    if (kind === 'song') { disc.setAttribute('aria-pressed', String(playing)); }
  }
  function time(kind, elapsed, duration) {
    var seeker = document.querySelector('[data-seek="' + kind + '"]');
    var progress = Number.isFinite(duration) && duration > 0 ? Math.min(1000, elapsed / duration * 1000) : 0;
    seeker.value = String(progress); seeker.closest('[data-player]').style.setProperty('--progress', progress / 10 + '%');
    seeker.closest('[data-player]').style.setProperty('--wave-progress', progress * .08 + '%');
    document.querySelector('[data-elapsed="' + kind + '"]').textContent = clock(elapsed);
    document.querySelector('[data-duration="' + kind + '"]').textContent = clock(duration);
    seeker.disabled = !Number.isFinite(duration) || duration <= 0;
  }
  function command(func, args) { if (iframe) iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: args || [] }), 'https://www.youtube-nocookie.com'); }
  function pauseAll(except) {
    if (memory && except !== 'memory') memory.pause();
    if (song && except !== 'song') song.pause();
    if (except !== 'song' && iframe) { ytWanted = false; ytBlocked = true; command('pauseVideo'); ytPlaying = false; state('song', false); }
  }
  function startYouTube() {
    if (iframe) { ytWanted = !ytPlaying && !ytWanted; ytBlocked = !ytWanted; command(ytWanted ? 'playVideo' : 'pauseVideo'); return; }
    ytWanted = true; ytBlocked = false;
    iframe = document.createElement('iframe'); iframe.title = 'Your song — YouTube player'; iframe.allow = 'autoplay; encrypted-media'; iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.src = 'https://www.youtube-nocookie.com/embed/' + youtubeCard.dataset.youtube + '?enablejsapi=1&playsinline=1&autoplay=1&origin=' + encodeURIComponent(location.origin);
    iframe.addEventListener('load', function () { iframe.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'llYouTube' }), 'https://www.youtube-nocookie.com'); command('addEventListener', ['onStateChange']); command('addEventListener', ['onError']); });
    document.querySelector('[data-youtube-host]').appendChild(iframe);
    status.textContent = 'Your song opens in the player here. If needed, tap play inside it.';
    clearTimeout(ytTimeout); ytTimeout = setTimeout(function () { if (!ytPlaying) status.textContent = 'Tap play inside the song player. Playback depends on YouTube and the selected video’s availability.'; }, 8000);
  }
  function toggle(kind) {
    pauseAll(kind); var media = mediaFor(kind);
    if (!media) { if (kind === 'song' && youtubeCard.dataset.youtube) startYouTube(); return; }
    if (!media.paused) { media.pause(); return; }
    if (media.ended) media.currentTime = 0;
    status.textContent = '';
    var promise = media.play();
    if (promise) promise.catch(function () { state(kind, false); status.textContent = 'Audio could not start. Tap play to retry, or check the supplied audio link.'; });
  }
  document.querySelectorAll('[data-play]').forEach(function (button) { button.addEventListener('click', function () { toggle(button.dataset.play); }); });
  ['memory', 'song'].forEach(function (kind) {
    var media = kind === 'memory' ? memory : song, seeker = document.querySelector('[data-seek="' + kind + '"]');
    seeker.disabled = true;
    seeker.addEventListener('input', function () {
      var activeMedia = mediaFor(kind), duration = activeMedia ? activeMedia.duration : ytDuration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      var target = Number(seeker.value) / 1000 * duration;
      if (activeMedia) activeMedia.currentTime = target; else { command('seekTo', [target, true]); ytTime = target; }
      time(kind, target, duration);
    });
    if (!media) return;
    ['loadedmetadata', 'durationchange', 'timeupdate'].forEach(function (event) { media.addEventListener(event, function () { time(kind, media.currentTime, media.duration); }); });
    media.addEventListener('playing', function () { state(kind, true); status.textContent = ''; });
    ['pause', 'ended'].forEach(function (event) { media.addEventListener(event, function () { state(kind, false); }); });
    media.addEventListener('error', function () { state(kind, false); status.textContent = 'This audio is unavailable. You can still explore every page of the card.'; });
  });
  window.addEventListener('message', function (event) {
    if (!iframe || event.source !== iframe.contentWindow || event.origin !== 'https://www.youtube-nocookie.com') return;
    var d; try { d = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch (_) { return; }
    if (!d) return;
    if (d.event === 'onReady') { ytReady = true; command(ytWanted && !ytBlocked && !document.hidden ? 'playVideo' : 'pauseVideo'); }
    var info = d.info;
    var playerState = d.event === 'onStateChange' ? info : info && info.playerState;
    if (typeof playerState === 'number') {
      ytPlaying = playerState === 1;
      // Completion/provider pause reset the next Play action, not the navigation safety latch.
      if (ytReady && (playerState === 0 || playerState === 2)) ytWanted = false;
      if (ytPlaying && (ytBlocked || document.hidden)) { command('pauseVideo'); ytPlaying = false; }
      else if (ytPlaying) { ytReady = true; ytWanted = true; clearTimeout(ytTimeout); status.textContent = ''; }
      state('song', ytPlaying);
    }
    if (info && typeof info === 'object') { if (Number.isFinite(info.duration)) ytDuration = info.duration; if (Number.isFinite(info.currentTime)) ytTime = info.currentTime; time('song', ytTime, ytDuration); }
    if (d.event === 'onError') { state('song', false); status.textContent = 'This YouTube video cannot be played here. Ask the sender to choose an embeddable video or direct audio link.'; }
  });
  // Replace the decorative initial waveform with the actual uploaded/demo audio envelope.
  var waveRequested = false;
  function realWaveform() {
    if (waveRequested || !memory) return; waveRequested = true;
    var AudioCtx = window.AudioContext || window.webkitAudioContext; if (!AudioCtx) return;
    var ctx;
    fetch(memory.currentSrc || memory.src).then(function (r) { if (!r.ok) throw Error('audio'); return r.arrayBuffer(); }).then(function (buffer) { ctx = new AudioCtx(); return ctx.decodeAudioData(buffer); }).then(function (decoded) {
      var samples = decoded.getChannelData(0), bars = card.querySelectorAll('[data-player=memory] .ll-wave i'), step = Math.max(1, Math.floor(samples.length / bars.length)), peaks = [];
      bars.forEach(function (_, i) { var total = 0, count = 0; for (var j = i * step; j < Math.min(samples.length, (i + 1) * step); j += 16) { total += samples[j] * samples[j]; count++; } peaks.push(Math.sqrt(total / Math.max(1, count))); });
      var max = Math.max.apply(null, peaks) || 1; bars.forEach(function (bar, i) { bar.style.setProperty('--bar', Math.max(8, peaks[i] / max * 95) + '%'); });
    }).catch(function () { /* decorative bars remain if decoding is unavailable */ }).finally(function () { if (ctx) ctx.close(); });
  }
  memory.addEventListener('play', realWaveform, { once: true });
  document.addEventListener('visibilitychange', function () { if (document.hidden) pauseAll(); });
  window.addEventListener('pagehide', function () { pauseAll(); clearTimeout(ytTimeout); });
  if (window.ResizeObserver) new ResizeObserver(fitLetter).observe(card);
  window.addEventListener('resize', fitLetter);
  if (document.fonts) document.fonts.ready.then(fitLetter);
  sync(false);
})();
