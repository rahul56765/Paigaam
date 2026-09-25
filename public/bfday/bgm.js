'use strict';
/**
 * Boyfriend Day family — the shared background-music chip, client side.
 *
 * Reads data-yt off #bgm (emitted by lib/bfday/bgm.js's bgmMarkup). No
 * network is touched until the first tap; the tap swaps in a 1×1
 * youtube-nocookie iframe with autoplay=1 (the tap is the gesture, so mobile
 * browsers allow it). The next tap pauses via the player's postMessage API;
 * the chip toggles its notes icon / playing pulse with aria-pressed.
 * Reduced motion: the pulse is CSS-only and collapses automatically.
 */
(function () {
  var root = document.getElementById('bgm');
  var btn = document.getElementById('bgmBtn');
  var host = document.getElementById('bgmHost');
  if (!root || !btn || !host) return;
  var id = root.getAttribute('data-yt') || '';
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return;

  var player = null;
  var playing = false;

  function post(cmd) {
    try {
      var f = host.querySelector('iframe');
      if (f && f.contentWindow) f.contentWindow.postMessage(JSON.stringify({ event: 'command', func: cmd, args: [] }), '*');
    } catch (e) { /* gone */ }
  }

  btn.addEventListener('click', function () {
    if (!player) {
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&enablejsapi=1&playsinline=1&rel=0';
      f.title = 'background music';
      f.allow = 'autoplay; encrypted-media';
      f.setAttribute('tabindex', '-1');
      f.width = '1'; f.height = '1';
      host.appendChild(f);
      player = f;
      playing = true;
      root.classList.add('on');
      btn.setAttribute('aria-pressed', 'true');
      btn.setAttribute('aria-label', 'Pause the music');
      return;
    }
    playing = !playing;
    post(playing ? 'playVideo' : 'pauseVideo');
    root.classList.toggle('on', playing);
    btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    btn.setAttribute('aria-label', playing ? 'Pause the music' : 'Play the music');
  });
})();
