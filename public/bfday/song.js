'use strict';
/**
 * Love templates — inline song player, client side.
 *
 * Pairs with lib/bfday/song.js's songCard(): a YouTube song renders as a
 * card with a [data-yt] play button; the first tap swaps in a 1×1-visible
 * 16:9 youtube-nocookie iframe with autoplay=1 (the tap is the gesture, so
 * mobile browsers allow it). No navigation, no YouTube app — the song plays
 * right here in the browser, as Rahul asked.
 */
(function () {
  function arm(btn) {
    var id = btn.getAttribute('data-yt') || '';
    if (!/^[A-Za-z0-9_-]{11}$/.test(id) || btn.getAttribute('data-armed') === 'true') return;
    var slot = btn.querySelector('.song-play__frame') || btn.querySelector('span[aria-hidden="true"]');
    if (!slot) return;
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&enablejsapi=1&playsinline=1&rel=0';
    f.title = 'our song';
    f.allow = 'autoplay; encrypted-media; picture-in-picture; web-share';
    f.setAttribute('allowfullscreen', '');
    f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    slot.innerHTML = '';
    slot.appendChild(f);
    btn.setAttribute('data-armed', 'true');
    btn.setAttribute('aria-pressed', 'true');
    btn.classList.add('is-playing');
    var cue = btn.querySelector('.song-play__cue, span:last-child');
    if (cue) cue.textContent = 'playing ♪';
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-yt][data-armed]') : null;
    if (btn) { e.preventDefault(); arm(btn); }
  }, true);
})();
