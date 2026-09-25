'use strict';
/**
 * Boyfriend Day family — the shared background-music chip.
 *
 * Every family template gets a `bgmSong` field (a YouTube link or a bare
 * 11-character video id; blank = quiet). When one is set, the renderer adds
 * the chip markup at the end of <body> (bgmMarkup) and links /bfday/bgm.js —
 * the same file for every member:
 *
 *   · nothing is loaded until the recipient taps (mobile autoplay-safe);
 *   · the tap swaps the chip for a 1×1 youtube-nocookie iframe with
 *     autoplay=1 — that IS the gesture, so playback starts;
 *   · tapping again pauses via postMessage; the chip reflects state.
 *
 * No audio file is ever hosted or bundled — playback is YouTube's own
 * player, so licensing stays with the platform.
 */

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Accept a full YouTube URL (watch / youtu.be / shorts / embed, with or
 * without scheme) or a bare 11-character id. Returns the id or ''.
 */
function bgmParse(value) {
  const v = String(value || '').trim();
  if (YT_ID.test(v)) return v;
  const m = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?[^#]*v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i.exec(v);
  return m ? m[1] : '';
}

/**
 * The chip markup. Place right before </body>, after the preview badge.
 * @param id    a parsed video id ('' → no markup at all)
 * @param label what the song is to this template ("our song")
 */
function bgmMarkup(id, label) {
  if (!id) return '';
  const safe = String(label || 'our song').replace(/[<>&"']/g, '');
  return `
  <div class="bgm" id="bgm" data-yt="${id}">
    <button class="bgm-btn" id="bgmBtn" type="button" aria-pressed="false"
      aria-label="Play ${safe}">
      <span class="bgm-note" aria-hidden="true">♪</span>
    </button>
    <span class="bgm-host" id="bgmHost" aria-hidden="true"></span>
  </div>`;
}

/** The <script> tag every member with music links. */
function bgmScript(id) {
  return id ? '<script src="/bfday/bgm.js" defer></script>' : '';
}

module.exports = { bgmParse, bgmMarkup, bgmScript, YT_ID };
