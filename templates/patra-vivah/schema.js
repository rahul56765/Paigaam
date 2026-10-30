'use strict';
const config = require('./config');
const { parseFamilyMapLink, familyMapState } = require('../../public/bfday/family-maps');
const base = require('../../lib/bfday/fields').makeSchema(config);
const { bgmParse } = require('../../lib/bfday/bgm');
const MAX_DAYS = 4, MAX_EVENTS = 10;
// Full URL parsing is intentional: the legacy bgm parser accepts URL prefixes.
// Reject lookalike hosts, credentials and non-HTTPS links before render gets them.
function playableLink(value) {
  if (!value) return true;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password) return false;
    const host = u.hostname.toLowerCase();
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
      const id = u.pathname === '/watch' ? u.searchParams.get('v') : /^(?:\/shorts\/|\/embed\/|\/live\/)([^/]+)$/.exec(u.pathname)?.[1];
      return /^[\w-]{11}$/.test(id || '');
    }
    if (host === 'youtu.be') return /^\/[\w-]{11}$/.test(u.pathname);
    return /\.(mp3|m4a|ogg|wav)$/i.test(u.pathname);
  } catch { return false; }
}
function validate(data, opts = {}) {
  const mode = opts.mode || 'strict';
  const lenient = mode === 'lenient';
  const rawDays = data && Array.isArray(data.days) ? data.days : [];
  if (!lenient && rawDays.reduce((n, day) => n + (Array.isArray(day?.events) ? day.events.length : 0), 0) > MAX_EVENTS) throw new base.InputError('itinerary_capacity');
  const clean = base.validate(data, opts);
  let remaining = MAX_EVENTS;
  clean.days = clean.days.filter(day => {
    if (!day.events.length) {
      if (mode === 'strict') throw new base.InputError('itinerary_incomplete');
      return false;
    }
    if (lenient) day.events = day.events.slice(0, remaining);
    remaining -= day.events.length;
    return day.events.length > 0;
  });
  if (mode === 'strict' && !clean.days.length) throw new base.InputError('itinerary_incomplete');
  if (!playableLink(clean.musicLink)) {
    if (lenient) clean.musicLink = '';
    else throw new base.InputError('invalid_music_link');
  }
  // The renderer uses the shared legacy parser. Canonicalise only valid YouTube
  // variants it misreads (encoded query keys, explicit ports, duplicate v keys)
  // so an accepted song never becomes a native <audio> URL or the wrong video.
  if (clean.musicLink) {
    const u = new URL(clean.musicLink);
    const host = u.hostname.toLowerCase();
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) {
      const id = host === 'youtu.be' ? u.pathname.slice(1) : u.pathname === '/watch' ? u.searchParams.get('v') : u.pathname.split('/').pop();
      if (bgmParse(clean.musicLink) !== id) clean.musicLink = 'https://www.youtube.com/watch?v=' + id;
    }
  }
  return clean;
}
module.exports = { ...base, validate, playableLink, parseFamilyMapLink, familyMapState, MAX_DAYS, MAX_EVENTS };
