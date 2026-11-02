'use strict';
const config = require('./config');
const engine = require('../../lib/bfday/fields');
const { bgmParse } = require('../../lib/bfday/bgm');
const base = engine.makeSchema(config);
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const OFFSET = /^[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00)$/;

/** Public outbound destinations only; never interpolate unvalidated raw URLs. */
function safeUrl(value) {
  if (typeof value !== 'string' || !value || /[\s\\<>"'`\u0000-\u001f\u007f]|%(?:00|0a|0d)/i.test(value)) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return '';
    return url.href;
  } catch { return ''; }
}

// Lotus-compatible direct media or YouTube support, with a strict URL/host check
// before bgmParse (the shared parser intentionally accepts loose input).
function playableLink(value) {
  if (!value) return true;
  const safe = safeUrl(value);
  if (!safe) return false;
  const url = new URL(safe);
  if (/\.(?:mp3|m4a|ogg|wav)$/i.test(url.pathname)) return true;
  if (url.port) return false;
  const host = url.hostname.toLowerCase();
  let id = '';
  if (host === 'youtu.be') {
    const match = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname);
    id = match ? match[1] : '';
  } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
    else {
      const match = /^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname);
      id = match ? match[1] : '';
    }
  }
  return /^[A-Za-z0-9_-]{11}$/.test(id) && bgmParse(safe) === id;
}

function validate(data, opts = {}) {
  const clean = base.validate(data, opts);
  const lenient = opts.mode === 'lenient';
  const check = (obj, key, predicate, code) => {
    if (!obj[key] || predicate(obj[key])) return;
    if (lenient) obj[key] = '';
    else throw new base.InputError(code);
  };
  for (const key of ['weddingTime', 'receptionTime', 'countdownTime']) check(clean, key, value => TIME.test(value), 'invalid_time');
  for (const event of clean.events) {
    check(event, 'time', value => TIME.test(value), 'invalid_time');
    if (!event.schedule) event.schedule = 'custom';
    if (event.schedule === 'custom' && (!event.date || !event.time) && opts.mode === 'strict') throw new base.InputError('event_schedule_required');
  }
  // Incomplete custom schedules never masquerade as complete cards in previews.
  if (lenient) clean.events = clean.events.filter(event => event.schedule !== 'custom' || (event.date && event.time));
  check(clean, 'utcOffset', value => OFFSET.test(value), 'invalid_utc_offset');
  for (const key of ['mapsUrl', 'qrUrl']) {
    check(clean, key, value => !!safeUrl(value), 'invalid_url');
    if (clean[key]) clean[key] = safeUrl(clean[key]);
  }
  check(clean, 'musicLink', playableLink, 'invalid_music_link');
  if (clean.musicLink) clean.musicLink = safeUrl(clean.musicLink);
  return clean;
}

/** Render through this (or engine.resolve(config, data, schema)) for the
 * template's extra validation. Empty lists intentionally have [] defaults. */
function resolve(data) {
  return engine.resolve(config, data, module.exports);
}

/** No persisted weekday field: derive the civil weekday from any valid date. */
function weekday(date, locale = 'en-IN') {
  if (typeof date !== 'string' || !engine.isRealDate(date)) return '';
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
}

/** ISO-8601 target, or '' for incomplete drafts. Never freeze a default date:
 * blank overrides follow the current wedding date/time independently. */
function countdownTarget(data) {
  const d = resolve(data);
  const date = d.countdownDate || d.weddingDate;
  const time = d.countdownTime || d.weddingTime;
  if (!engine.isRealDate(date) || !TIME.test(time) || !OFFSET.test(d.utcOffset)) return '';
  return `${date}T${time}:00${d.utcOffset}`;
}

/** Optional authored HTTPS link; otherwise a URL-encoded Google Maps query. */
function mapsHref(data) {
  const d = resolve(data);
  if (d.mapsUrl) return safeUrl(d.mapsUrl);
  const query = [d.venueName, d.venueAddress].filter(Boolean).join(', ');
  return query ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query) : '';
}

/** Linked event dates and venue fallbacks always follow the current customer. */
function eventDetails(event, data) {
  const source = event.schedule === 'wedding' ? 'wedding' : (event.schedule === 'reception' ? 'reception' : '');
  return { ...event, date: source ? data[source+'Date'] : event.date, time: source ? data[source+'Time'] : event.time,
    venue: event.venue || (source === 'reception' ? data.receptionVenue : '') || data.venueName,
    address: event.address || (source === 'reception' ? data.receptionAddress : '') || data.venueAddress };
}
module.exports = { ...base, validate, resolve, TIME, OFFSET, safeUrl, playableLink, weekday, countdownTarget, mapsHref, eventDetails };
