'use strict';
/**
 * Love templates — shared song-link handling.
 *
 * Rahul's rule (Sept 25): music should play in the browser itself — a song
 * link must never send the recipient off to YouTube or open the app.
 *
 * So every template that takes a songUrl resolves it here first:
 *   · a YouTube link (watch / youtu.be / shorts / embed / live) becomes an
 *     inline youtube-nocookie iframe — the same embed family templates
 *     already use (Tohfa's song card, Naghma, Raaz, the BGM chip);
 *   · everything else (Spotify, JioSaavn, Apple Music…) keeps the branded
 *     "Play in <service>" pill — those platforms don't offer a track
 *     embeddable player, so a branded hop is the closest in-browser option.
 */

const { bgmParse } = require('./bgm');

/** YouTube watch/share/shorts/embed/live URL → 11-char id, else ''. */
function youtubeId(url) {
  return bgmParse(url);
}

const BRANDS = [
  { test: /spotify/i,                 name: 'Spotify',     svc: 'spotify', glyph: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="15" height="15" fill="currentColor" style="border-radius:50%;flex:none"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.59 14.42a.62.62 0 0 1-.86.21c-2.35-1.44-5.3-1.76-8.79-.96a.62.62 0 1 1-.28-1.21c3.81-.87 7.08-.5 9.72 1.11.29.18.38.56.21.85zm1.22-2.72a.78.78 0 0 1-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 1 1-.45-1.5c3.64-1.1 8.16-.56 11.24 1.33.36.23.48.71.25 1.08zm.11-2.83c-3.22-1.92-8.54-2.09-11.62-1.16a.94.94 0 1 1-.54-1.79c3.54-1.07 9.41-.87 13.12 1.34a.94.94 0 0 1-.96 1.61z"/></svg>' },
  { test: /music\.apple\.|itunes/i,   name: 'Apple Music', svc: 'apple',   glyph: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="15" height="15" fill="currentColor" style="flex:none"><path d="M16.9 3.2c.1 1-.3 2-.98 2.72-.7.76-1.82 1.34-2.9 1.26-.13-.97.37-2 .96-2.66.65-.74 1.8-1.3 2.92-1.32zM20.6 17.1c-.53 1.22-.79 1.76-1.47 2.84-.95 1.5-2.3 3.37-3.97 3.38-1.48.02-1.87-.98-3.88-.96-2 .01-2.43.99-3.91.97-1.67-.02-2.94-1.7-3.9-3.19C.9 16.2.62 11.7 2.34 9.25c1.23-1.74 3.17-2.76 4.98-2.76 1.86 0 3.02 1 4.56 1s2.6-1 4.9-.85c.88.04 3.36.35 4.95 2.66-.13.09-3 1.76-2.97 5.26.04 4.17 3.66 5.55 3.7 5.57-.03.1-.58 2.02-1.9 3.99z"/></svg>' },
  { test: /jiosaavn/i,                name: 'JioSaavn',    svc: 'jiosaavn', glyph: '' },
];

/** A non-YouTube song URL → { name, svc, glyph } for the branded pill. */
function linkBrand(url) {
  const u = String(url || '').trim();
  if (!u) return null;
  for (const b of BRANDS) if (b.test.test(u)) return b;
  return { name: 'the app', svc: '', glyph: '' };
}

/** A non-YouTube song URL → the human service name ("Spotify", "the app"). */
function linkService(url) {
  const b = linkBrand(url);
  return b ? b.name : '';
}

/**
 * Song card block used by love templates that render a plain song link.
 * A YouTube link renders as an inline 16:9 nocookie embed (tap-to-play like
 * the family BGM chip: the iframe only mounts on tap, autoplay=1, so mobile
 * browsers allow it and nothing navigates away); anything else renders as
 * the branded "Play in <service>" pill.
 *
 * @param songUrl  the sender's link
 * @param title    fallback card title
 * @param cls      base class for the card (e.g. 'md-song')
 */
function songCard(songUrl, title, cls) {
  const t = String(title || 'Our song');
  const id = youtubeId(songUrl);
  if (id) {
    return `<div class="${cls}-embedwrap"><div class="${cls}-embedwrap__head"><span class="${cls}-disc" aria-hidden="true"></span><span class="${cls}-text"><small>Our song</small><b>${escapeHtml(t)}</b></span></div><button type="button" class="${cls}-play" data-yt="${id}" data-armed="false" aria-pressed="false" aria-label="Play ${escapeHtml(t)} on this page"><span class="${cls}-play__frame" aria-hidden="true"></span><span class="${cls}-play__cue" aria-hidden="true">tap to play ♪</span></button></div>`;
  }
  const brand = linkBrand(songUrl);
  const u = escapeHtml(String(songUrl || '').trim());
  if (u) {
    return `<a class="${cls} ${cls}--pill${brand && brand.svc ? ' svc-' + brand.svc : ''}" href="${u}" target="_blank" rel="noopener noreferrer"><span class="${cls}-disc" aria-hidden="true"></span><span class="${cls}-text"><small>Our song</small><b>${escapeHtml(t)}</b></span><span class="${cls}-play__cue" aria-hidden="true">▶ Play in ${escapeHtml(linkService(songUrl))}</span></a>`;
  }
  return `<div class="${cls}"><span class="${cls}-disc" aria-hidden="true"></span><span class="${cls}-text"><small>Our song</small><b>${escapeHtml(t)}</b></span></div>`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * The one shared client script: turns an armed song card's tap into an
 * inline autoplaying iframe. Linked with <script src="/bfday/song.js" defer>
 * on any page that rendered a songCard embed.
 */
function songScript() {
  return '<script src="/bfday/song.js" defer></script>';
}

module.exports = { youtubeId, linkBrand, linkService, songCard, songScript, escapeHtml };
