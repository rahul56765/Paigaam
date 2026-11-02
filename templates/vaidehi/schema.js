'use strict';

const { makeSchema, isRealDate } = require('../../lib/bfday/fields');
const config = require('./config');
const base = makeSchema(config);
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const OFFSET = /^([+-])(\d{2}):([0-5]\d)$/;

/** Minutes after local midnight, or null for an invalid/missing time. */
function timeMinutes(value) {
  if (typeof value !== 'string' || !TIME.test(value)) return null;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

/** A signed UTC offset, with the legal maximum magnitude of 14:00. */
function offsetMinutes(value) {
  if (typeof value !== 'string') return null;
  const match = OFFSET.exec(value);
  if (!match) return null;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  if (minutes > 14 * 60) return null;
  return (match[1] === '-' ? -1 : 1) * minutes;
}

/** Deterministic epoch milliseconds; never depends on the server/guest TZ. */
function timestamp(date, time, utcOffset = '+05:30') {
  const minute = timeMinutes(time);
  const offset = offsetMinutes(utcOffset);
  if (typeof date !== 'string' || !isRealDate(date) || minute === null || offset === null) return null;
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day, 0, minute) - offset * 60000;
}

function eventDate(weddingDate, event) {
  if (event.date) return event.date;
  if (!weddingDate || !isRealDate(weddingDate)) return '';
  const d = new Date(weddingDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + (Number.isInteger(event.dayOffset) ? event.dayOffset : 0));
  return d.toISOString().slice(0,10);
}

function safeHttps(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
}

function validate(data, opts = {}) {
  // Preserve makeSchema's strict/draft/lenient semantics and whitelist.
  // Optional overrides remain blank in storage: inheritance happens at render
  // time, so changing the main wedding never leaves stale event/countdown data.
  const clean = base.validate(data, opts);
  // The shared maxLength boundary counts UTF-16 units and may split an emoji.
  // Repair lone surrogates before URI encoding, including nested event text.
  function wellFormed(object) {
    for (const [key,value] of Object.entries(object)) {
      if (typeof value === 'string') object[key] = value.toWellFormed();
      else if (Array.isArray(value)) value.forEach(item => { if (item && typeof item === 'object') wellFormed(item); });
    }
  }
  wellFormed(clean);
  const lenient = opts.mode === 'lenient';
  function check(object, key, valid, code) {
    if (object[key] && !valid(object[key])) {
      if (lenient) object[key] = '';
      else throw new base.InputError(code);
    }
  }
  for (const key of ['weddingTime', 'countdownTime']) {
    check(clean, key, value => timeMinutes(value) !== null, 'invalid_time');
  }
  check(clean, 'utcOffset', value => offsetMinutes(value) !== null, 'invalid_utc_offset');
  for (const key of ['mapsUrl', 'qrDestination']) check(clean, key, safeHttps, 'invalid_https_url');
  clean.events = clean.events.filter(event => {
    if (event.time && timeMinutes(event.time) === null) {
      if (lenient) return false;
      throw new base.InputError('invalid_event_time');
    }
    check(event, 'mapsUrl', safeHttps, 'invalid_https_url');
    return true;
  });

  // Each countdown component can be independently overridden. There is no
  // arbitrary chronology restriction: a countdown may target an earlier event.
  // Only validate complete effective dates; draft/preview may lack main fields.
  const date = clean.countdownDate || clean.weddingDate;
  const time = clean.countdownTime || clean.weddingTime;
  const offset = clean.utcOffset || '+05:30';
  if (date && time && timestamp(date, time, offset) === null && !lenient) {
    throw new base.InputError('invalid_countdown');
  }
  for (const event of clean.events) {
    const date = eventDate(clean.weddingDate, event);
    if (date && (event.time || clean.weddingTime) && timestamp(date, event.time || clean.weddingTime, offset) === null && !lenient) {
      throw new base.InputError('invalid_event_datetime');
    }
  }
  // A QR has finite capacity. Drafts remain editable; publishing explains an
  // overlong effective URL instead of shipping an invitation with a broken QR.
  const generatedMap = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([clean.venueName, clean.venueAddress].filter(Boolean).join(', '));
  const effectiveQr = clean.qrDestination || clean.mapsUrl || generatedMap;
  if ((!opts.mode || opts.mode === 'strict') && Buffer.byteLength(new URL(effectiveQr).href, 'utf8') > 2000) throw new base.InputError('qr_destination_too_long');
  return clean;
}

module.exports = { ...base, validate, TIME, OFFSET, timeMinutes, offsetMinutes, timestamp, safeHttps, eventDate };
