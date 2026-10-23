/* User-initiated opening film; revealing the wedding invitation is always one click away. */
(() => {
  'use strict';
  const bootEl = document.getElementById('sp-boot');
  if (!bootEl || document.getElementById('sv-opener')) return;
  let boot;
  try { boot = JSON.parse(bootEl.textContent || '{}'); } catch { return; }
  const d = boot.data || {}, couple = d.couple || {};
  const lang = (d.lang && d.lang.default) || 'en';
  const C = window.SPCore, I = window.SPI18N;
  const sides = couple.order === 'bride' ? ['bride', 'groom'] : ['groom', 'bride'];
  const names = C ? sides.map(side => C.txt(d, lang, `couple.${side}.first`)).filter(Boolean).join(' & ') : sides.map(side => couple[side] && couple[side].first).filter(Boolean).join(' & ');
  const root = document.createElement('section');
  root.className = 'sv-opener'; root.id = 'sv-opener'; root.setAttribute('role','dialog');
  root.setAttribute('aria-modal','true'); root.setAttribute('aria-label','Suvarna Vivah opening film');
  root.innerHTML = `
    <video class="sv-opener__video" id="svOpeningVideo" preload="metadata" playsinline webkit-playsinline poster="/suvarna-vivah/opening-poster.jpg" aria-label="Ceremonial kalash opening film">
      <source src="/suvarna-vivah/opening.mp4" type="video/mp4">
    </video>
    <div class="sv-opener__veil" aria-hidden="true"></div>
    <div class="sv-opener__frame" aria-hidden="true">
      <svg class="sv-opener__corner sv-opener__corner--tl" viewBox="0 0 48 48" fill="none"><path d="M3 45V17C3 9 9 3 17 3h28M3 30c14 0 27-13 27-27M10 38c11-2 20-11 22-22" stroke="currentColor" stroke-width="1"/><circle cx="17" cy="17" r="2" fill="currentColor"/></svg>
      <svg class="sv-opener__corner sv-opener__corner--tr" viewBox="0 0 48 48" fill="none"><path d="M3 45V17C3 9 9 3 17 3h28M3 30c14 0 27-13 27-27M10 38c11-2 20-11 22-22" stroke="currentColor" stroke-width="1"/><circle cx="17" cy="17" r="2" fill="currentColor"/></svg>
      <svg class="sv-opener__corner sv-opener__corner--bl" viewBox="0 0 48 48" fill="none"><path d="M3 45V17C3 9 9 3 17 3h28M3 30c14 0 27-13 27-27M10 38c11-2 20-11 22-22" stroke="currentColor" stroke-width="1"/><circle cx="17" cy="17" r="2" fill="currentColor"/></svg>
      <svg class="sv-opener__corner sv-opener__corner--br" viewBox="0 0 48 48" fill="none"><path d="M3 45V17C3 9 9 3 17 3h28M3 30c14 0 27-13 27-27M10 38c11-2 20-11 22-22" stroke="currentColor" stroke-width="1"/><circle cx="17" cy="17" r="2" fill="currentColor"/></svg>
    </div>
    <div class="sv-opener__copy">
      <svg class="sv-opener__lotus" viewBox="0 0 72 72" fill="none" aria-hidden="true"><circle cx="36" cy="36" r="29" stroke="currentColor" stroke-opacity=".65"/><circle cx="36" cy="36" r="24" stroke="currentColor" stroke-opacity=".35" stroke-dasharray="1.4 3.5"/><path d="M36 51c-1-8-8-12-8-18 4 2 7 5 8 9 1-7 5-12 11-15-1 8-1 14-7 20M36 51c-4-7-12-9-17-7 4 5 9 8 17 7Zm0 0c4-7 12-9 17-7-4 5-9 8-17 7Zm-12-1h24M29 54h14M33 58h6" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/><circle cx="36" cy="36" r="2" fill="currentColor"/></svg>
      <p class="sv-opener__kicker" id="svOpenerKicker"></p>
      <p class="sv-opener__names" id="svOpenerNames"></p>
      <h1 class="sv-opener__title" id="svOpenerTitle"></h1>
      <button type="button" class="sv-opener__play" id="svPlay" aria-label="Play the wedding opening film"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg><span id="svPlayLabel"></span></button>
    </div>
    <p class="sv-opener__status" id="svOpenerStatus" role="status" aria-live="polite"></p>
    <button type="button" class="sv-opener__skip" id="svSkip">Skip opening</button>`;
  document.body.appendChild(root);
  document.documentElement.classList.add('sv-opening-lock');
  document.body.classList.add('sv-opening-lock');
  const nameEl = document.getElementById('svOpenerNames');
  nameEl.textContent = names || 'A day made for forever';
  document.getElementById('svOpenerKicker').textContent = 'SUVARNA VIVAH · ' + (I ? I.t(lang, 'gettingMarried') : 'A WEDDING PAIGAAM');
  document.getElementById('svOpenerTitle').textContent = I ? I.t(lang, 'gettingMarried') : 'With blessings, the celebration begins.';
  document.getElementById('svPlayLabel').textContent = I ? I.t(lang, 'tapToOpen') : 'Open the invitation';
  const video = document.getElementById('svOpeningVideo');
  const play = document.getElementById('svPlay');
  const skip = document.getElementById('svSkip');
  const status = document.getElementById('svOpenerStatus');
  let started = false, leaving = false;
  function reveal() {
    if (leaving) return;
    leaving = true;
    try { if (window.SPInvite && window.SPInvite.open) window.SPInvite.open(); } catch {}
    document.documentElement.classList.remove('sv-opening-lock');
    document.body.classList.remove('sv-opening-lock');
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => root.classList.add('is-leaving'), reduced ? 0 : 420);
    setTimeout(() => root.remove(), reduced ? 220 : 2000);
  }
  async function start() {
    if (started || leaving) return;
    started = true;
    root.classList.add('is-playing');
    status.textContent = 'The celebration is unfolding';
    video.currentTime = 0;
    try { await video.play(); }
    catch {
      started = false; root.classList.remove('is-playing');
      status.textContent = 'The film could not start. You can skip straight to the invitation.';
      play.querySelector('span').textContent = 'Try opening film again';
    }
  }
  play.addEventListener('click', start);
  video.addEventListener('click', start);
  root.addEventListener('click', e => { if (!e.target.closest('#svSkip') && !e.target.closest('#svPlay') && !started && !leaving) start(); });
  video.addEventListener('ended', reveal, { once: true });
  video.addEventListener('error', () => { status.textContent = 'The film could not load. Skip to the invitation whenever you’re ready.'; });
  skip.addEventListener('click', reveal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !leaving) reveal(); }, { once: false });
  play.focus({ preventScroll: true });
})();
