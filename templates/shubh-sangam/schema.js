'use strict';
const config = require('./config');
const { makeSchema, isRealDate } = require('../../lib/bfday/fields');
const { parseFamilyMapLink, familyMapState } = require('../../public/bfday/family-maps');
const base = makeSchema(config);
const TIME_ZONE = 'Asia/Kolkata';
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
// Restrict contact links to a predictable, non-executable form. User-facing
// text must still be escaped by the renderer, including invalid map text.
// E.164 calling codes (including shared/service codes), not a proof that a
// specific number is assigned or WhatsApp-enabled. Never guess a country.
const CALLING_CODES = new Set(('1 7 20 27 30 31 32 33 34 36 39 40 41 43 44 45 46 47 48 49 51 52 53 54 55 56 57 58 60 61 62 63 64 65 66 81 82 84 86 90 91 92 93 94 95 98 211 212 213 216 218 220 221 222 223 224 225 226 227 228 229 230 231 232 233 234 235 236 237 238 239 240 241 242 243 244 245 246 247 248 249 250 251 252 253 254 255 256 257 258 260 261 262 263 264 265 266 267 268 269 290 291 297 298 299 350 351 352 353 354 355 356 357 358 359 370 371 372 373 374 375 376 377 378 379 380 381 382 383 385 386 387 389 420 421 423 500 501 502 503 504 505 506 507 508 509 590 591 592 593 594 595 596 597 598 599 670 672 673 674 675 676 677 678 679 680 681 682 683 685 686 687 688 689 690 691 692 800 808 850 852 853 855 856 870 878 880 881 882 883 886 888 960 961 962 963 964 965 966 967 968 970 971 972 973 974 975 976 977 979 992 993 994 995 996 998').split(' '));
function internationalPhone(value) {
  if (typeof value !== 'string' || !/^\+[1-9][0-9 ()-]*[0-9]$/.test(value)) return '';
  const digits = value.replace(/[ ()-]/g, '').slice(1);
  if (digits.length < 8 || digits.length > 15) return '';
  const code = [1, 2, 3].map(n => digits.slice(0, n)).find(c => CALLING_CODES.has(c));
  return code && digits.length - code.length >= 4 ? digits : '';
}
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

function validate(data, opts = {}) {
  const clean = base.validate(data, opts);
  const lenient = opts.mode === 'lenient';
  const strict = !opts.mode || opts.mode === 'strict';
  function rejectOrBlank(obj, key, code, re) {
    if (obj[key] && !re.test(obj[key])) {
      if (lenient) obj[key] = '';
      else throw new base.InputError(code);
    }
  }
  rejectOrBlank(clean, 'weddingTime', 'invalid_wedding_time', TIME);
  if (clean.rsvpPhone && !internationalPhone(clean.rsvpPhone)) {
    if (lenient) clean.rsvpPhone = '';
    else throw new base.InputError('invalid_rsvp_phone');
  }
  rejectOrBlank(clean, 'rsvpEmail', 'invalid_rsvp_email', EMAIL);
  for (const e of clean.events) {
    rejectOrBlank(e, 'time', 'invalid_event_time', TIME);
    if (strict && (!e.name || !e.timing)) throw new base.InputError('event_name_and_timing_required');
    if (strict && e.timing === 'custom' && (!e.date || !e.time)) throw new base.InputError('event_datetime_required');
  }
  return clean;
}

// Return a concrete UTC instant for countdowns AND a local calendar label.
// IST has a fixed +05:30 offset. Use the configured timezone, not the
// visitor's browser timezone. No date/day is persisted separately.
function deriveDateTime(date, time) {
  if (typeof date !== 'string' || !isRealDate(date) || typeof time !== 'string' || !TIME.test(time)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const epochMs = Date.UTC(year, month - 1, day, hours, minutes) - 330 * 60 * 1000;
  const instant = new Date(epochMs);
  const format = options => new Intl.DateTimeFormat('en-IN', { timeZone: TIME_ZONE, ...options }).format(instant);
  return {
    date, time, timeZone: TIME_ZONE, epochMs, iso: instant.toISOString(),
    weekday: format({ weekday: 'long' }),
    dateLabel: format({ day: 'numeric', month: 'long', year: 'numeric' }),
    timeLabel: format({ hour: 'numeric', minute: '2-digit', hour12: true }),
  };
}
function deriveWedding(data) {
  return data && deriveDateTime(data.weddingDate, data.weddingTime);
}
function deriveEvent(event, data) {
  if (!event) return null;
  return event.timing === 'wedding' ? deriveWedding(data) :
    event.timing === 'custom' ? deriveDateTime(event.date, event.time) : null;
}
// A location override is a complete location, so an unrelated wedding address
// can never be silently attached to an independently chosen venue.
function eventLocation(event, data) {
  event = event || {}; data = data || {};
  const override = !!(event.venue || event.address);
  return {
    venue: override ? event.venue || '' : data.venue || '',
    address: override ? event.address || '' : data.venueAddress || '',
    mapsLink: event.mapsLink || (override ? '' : data.venueMapsLink || ''),
  };
}
function rsvpLinks(data) {
  const phone = data && data.rsvpPhone;
  const email = data && data.rsvpEmail;
  return {
    phone: internationalPhone(phone) ? 'tel:+' + internationalPhone(phone) : '',
    email: typeof email === 'string' && email.length <= 254 && EMAIL.test(email) ? 'mailto:' + encodeURIComponent(email) : '',
  };
}
module.exports = { ...base, validate, TIME_ZONE, TIME, deriveDateTime, deriveWedding, deriveEvent, eventLocation, internationalPhone, rsvpLinks, parseFamilyMapLink, familyMapState };
