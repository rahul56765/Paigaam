/* Native scrolling is the timeline. Films never play, and seeking has one in-flight slot. */
(() => {
  'use strict';
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, n));
  let frame = 0;
  let disposed = false;
  const scenes = [...document.querySelectorAll('[data-scene]')].map(section => ({
    section,
    video: section.querySelector('video'),
    still: section.querySelector('.film-still'),
    error: section.querySelector('.media-error'),
    cues: [...section.querySelectorAll('.cue[data-start][data-end]')].map(element => ({ element, start: Number(element.dataset.start), end: Number(element.dataset.end) })),
    locked: section.dataset.locked === 'true',
    loaded: false,
    failed: false,
    seeking: false,
    target: 0,
    lastTarget: -1,
    progress: 0
  }));

  function schedule() {
    if (!frame && !disposed) frame = window.requestAnimationFrame(renderFrame);
  }
  function setStill(scene, end) {
    const src = end ? scene.still.dataset.end : scene.still.dataset.start;
    if (scene.still.getAttribute('src') !== src) scene.still.src = src;
  }
  function silence(video) {
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.playsInline = true;
    video.pause();
  }
  function loadScene(scene) {
    if (scene.loaded || scene.failed || scene.locked || motion.matches) return;
    scene.loaded = true;
    silence(scene.video);
    scene.video.preload = 'metadata';
    scene.video.src = scene.video.dataset.src;
    scene.video.load();
  }
  function seek(scene) {
    const video = scene.video;
    if (motion.matches || scene.locked || scene.failed || !scene.loaded || scene.seeking || video.seeking || video.readyState < 1 || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const end = Math.max(0, video.duration - 0.055);
    const desired = scene.progress >= 1 ? end : Math.min(end, Math.round(scene.progress * end * 24) / 24);
    scene.target = desired;
    // Avoid retries for a frame the decoder rounded to a nearby timestamp.
    if (Math.abs(desired - scene.lastTarget) < 1 / 48 || Math.abs(video.currentTime - desired) < 1 / 48) return;
    scene.lastTarget = desired;
    scene.seeking = true;
    try { video.currentTime = desired; } catch { scene.seeking = false; }
  }
  function renderCues(scene) {
    // Opacity is a pure function of the same normalized timeline used by seek().
    // No animation loop or timer: scroll/resize/decoder events request one frame.
    for (const cue of scene.cues) {
      if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.end <= cue.start) continue;
      const fade = Math.min(0.055, (cue.end - cue.start) / 3);
      const fadeIn = cue.start === 0 ? 1 : clamp((scene.progress - cue.start) / fade);
      const fadeOut = cue.end === 1 ? 1 : clamp((cue.end - scene.progress) / fade);
      cue.element.style.opacity = String(motion.matches ? 1 : Math.min(fadeIn, fadeOut));
    }
  }
  function renderFrame() {
    frame = 0;
    if (disposed) return;
    const viewport = window.innerHeight;
    for (const scene of scenes) {
      if (motion.matches) {
        setStill(scene, !scene.locked);
        renderCues(scene);
        continue;
      }
      const bounds = scene.section.getBoundingClientRect();
      // Offscreen scenes do no decoder work. Reversing scroll simply re-enters the same timeline.
      if (bounds.bottom < -100 || bounds.top > viewport + 100) continue;
      if (scene.locked) { scene.progress = 0; setStill(scene, false); renderCues(scene); continue; }
      const travel = Math.max(1, bounds.height - scene.section.querySelector('.film-sticky').offsetHeight);
      const raw = clamp(-bounds.top / travel);
      scene.progress = clamp((raw - 0.09) / 0.74); // opening still, film, then a generous end-frame hold
      renderCues(scene);
      setStill(scene, scene.progress > 0.8);
      seek(scene);
    }
  }

  for (const scene of scenes) {
    const video = scene.video;
    silence(video);
    video.addEventListener('play', () => silence(video));
    video.addEventListener('volumechange', () => {
      if (!video.muted || !video.defaultMuted || video.volume !== 0) silence(video);
    });
    video.addEventListener('loadedmetadata', schedule);
    video.addEventListener('loadeddata', () => {
      if (!motion.matches && !scene.failed) video.classList.add('has-frame');
      schedule();
    });
    video.addEventListener('seeked', () => {
      scene.seeking = false;
      if (!motion.matches && !scene.failed && video.readyState >= 2) video.classList.add('has-frame');
      // This schedules at most one render, and seek() rejects an unchanged target.
      schedule();
    });
    video.addEventListener('error', () => {
      scene.failed = true;
      scene.seeking = false;
      video.classList.remove('has-frame');
      scene.error.hidden = false;
      setStill(scene, scene.progress > 0.8 || motion.matches);
    });
  }

  let observer;
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const scene = scenes.find(item => item.section === entry.target);
        if (scene) loadScene(scene);
      }
    }, { rootMargin: '550px 0px', threshold: 0 });
    scenes.forEach(scene => observer.observe(scene.section));
  } else {
    // Older browsers still load only the first scene until the letter is opened.
    if (scenes[0]) loadScene(scenes[0]);
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  const motionChanged = () => {
    scenes.forEach(scene => {
      silence(scene.video);
      scene.video.classList.remove('has-frame');
      if (motion.matches) setStill(scene, !scene.locked);
      else {
        scene.lastTarget = -1;
        const bounds = scene.section.getBoundingClientRect();
        if (bounds.bottom >= 0 && bounds.top < window.innerHeight + 550) loadScene(scene);
        if (scene.video.readyState >= 2 && !scene.failed) scene.video.classList.add('has-frame');
      }
    });
    schedule();
  };
  if (motion.addEventListener) motion.addEventListener('change', motionChanged);
  else if (motion.addListener) motion.addListener(motionChanged);

  const openButton = document.getElementById('open-invitation');
  const journey = scenes.find(scene => scene.section.dataset.scene === 'journey');
  if (openButton && journey) openButton.addEventListener('click', () => {
    journey.locked = false;
    journey.progress = 0;
    journey.lastTarget = -1;
    journey.section.dataset.locked = 'false';
    journey.section.classList.remove('is-locked');
    openButton.setAttribute('aria-expanded', 'true');
    openButton.querySelector('.open-label').textContent = openButton.dataset.opened;
    openButton.closest('.letter').classList.add('is-open');
    setStill(journey, false);
    journey.video.classList.remove('has-frame');
    renderCues(journey);
    loadScene(journey);
    seek(journey);
    // Layout is measured AFTER expansion. Never map previously scrolled distance to the new film.
    const top = journey.section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top, behavior: 'instant' });
    journey.section.setAttribute('tabindex', '-1');
    journey.section.focus({ preventScroll: true });
    schedule();
  });

  const music = document.getElementById('invitation-music');
  const musicButton = document.getElementById('music-toggle');
  const musicStatus = document.getElementById('music-status');
  let wantsMusic = false;
  let entered = false;
  let manualMusicPreference = null;
  let musicAttempt = 0;
  function musicUI(playing, failed = false) {
    if (!musicButton) return;
    const label = failed ? musicButton.dataset.failed : playing ? musicButton.dataset.on : musicButton.dataset.off;
    musicButton.setAttribute('aria-pressed', String(playing));
    musicButton.setAttribute('aria-label', label);
    musicButton.title = label;
    musicButton.querySelector('.music-label').textContent = label;
    musicButton.classList.toggle('is-error', failed);
    if (musicStatus) musicStatus.textContent = failed ? label : '';
  }
  function stopMusic() {
    wantsMusic = false;
    musicAttempt += 1;
    music.pause();
    musicUI(false);
  }
  function startMusic() {
    if (!music || !musicButton) return;
    wantsMusic = true;
    const attempt = ++musicAttempt;
    musicUI(false);
    if (!music.getAttribute('src') || music.error) {
      music.src = music.dataset.src;
      music.volume = 0.55;
      music.load();
    }
    musicButton.setAttribute('aria-label', musicButton.dataset.loading);
    // Only the separate soundtrack plays, and only inside an explicit user gesture.
    let result;
    try { result = music.play(); } catch { result = Promise.reject(new Error('Audio unavailable')); }
    Promise.resolve(result).then(() => {
      if (attempt !== musicAttempt) { if (!wantsMusic) music.pause(); return; }
      if (!wantsMusic) { music.pause(); musicUI(false); return; }
      musicUI(true);
    }).catch(() => {
      if (attempt !== musicAttempt) return;
      wantsMusic = false;
      musicUI(false, true);
    });
  }
  if (musicButton && music) {
    musicButton.addEventListener('click', () => {
      manualMusicPreference = !wantsMusic;
      if (manualMusicPreference) startMusic();
      else stopMusic();
    });
    music.addEventListener('error', () => { wantsMusic = false; musicAttempt += 1; musicUI(false, true); });
    music.addEventListener('pause', () => { if (!wantsMusic && !music.error) musicUI(false); });
  }
  const enter = document.getElementById('enter');
  if (enter) enter.addEventListener('click', event => {
    event.preventDefault();
    if (!entered && manualMusicPreference === null) startMusic();
    entered = true;
    if (scenes[0]) {
      loadScene(scenes[0]);
      scenes[0].section.scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth', block: 'start' });
      scenes[0].section.setAttribute('tabindex', '-1');
      scenes[0].section.focus({ preventScroll: true });
    }
  });

  // Resolve a relative server canonical against the actual invitation origin.
  // This remains an explicit WhatsApp link even when native sharing is available.
  const whatsapp = document.getElementById('whatsapp-share');
  if (whatsapp && document.body.dataset.preview !== 'true') {
    const canonical = document.querySelector('link[rel=canonical]');
    const url = canonical ? canonical.href : window.location.href.split('#')[0];
    whatsapp.href = `https://wa.me/?text=${encodeURIComponent(`${whatsapp.dataset.message}\n${url}`)}`;
  }
  const share = document.getElementById('share');
  if (share && document.body.dataset.preview !== 'true') share.addEventListener('click', async () => {
    const status = document.getElementById('share-status');
    const canonical = document.querySelector('link[rel=canonical]');
    const url = canonical ? canonical.href : window.location.href.split('#')[0];
    status.textContent = '';
    try {
      if (navigator.share) await navigator.share({ title: document.body.dataset.shareTitle, url });
      else if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        status.textContent = document.body.dataset.shareCopied;
      } else status.textContent = document.body.dataset.shareFailed;
    } catch (error) {
      if (error.name !== 'AbortError') status.textContent = document.body.dataset.shareFailed;
    }
  });
  window.addEventListener('pagehide', () => {
    disposed = true;
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    if (music) stopMusic();
    scenes.forEach(scene => silence(scene.video));
  });
  window.addEventListener('pageshow', () => { disposed = false; schedule(); });
  schedule();
})();
