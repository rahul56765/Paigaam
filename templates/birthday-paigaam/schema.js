'use strict';
/**
 * Birthday Paigaam — whitelist validation for personalisation.
 *
 * Stored data is always a clean object: unknown keys never persist, every
 * string is length-capped and control-character free, lists are capped, and
 * media references must look like this template's own upload URLs (the
 * routes additionally check each one belongs to the draft being saved).
 *
 * validate(data)                  → for drafts (everything optional)
 * validate(data, { publish:true }) → also requires the recipient's name
 */
const { PALETTES, FONTS, TOGGLES } = require('./defaults');

class InputError extends Error {
  constructor(code = 'validation', status = 400) { super(code); this.code = code; this.status = status; }
}

/** Plain text fields → max length. */
const TEXT_FIELDS = {
  recipientName: 40,
  senderName: 40,
  passcodeHint: 80,
  question: 160,
  yesLabel: 20,
  noLabel: 20,
  tryAgainLabel: 24,
  letterGreeting: 80,
  letter: 3000,
  signoff: 60,
  voiceTitle: 80,
  songTitle: 80,
  songArtist: 80,
  memoriesTitle: 60,
  loveTitle: 60,
  reasonsTitle: 60,
  finaleTitle: 80,
  finaleLine: 200,
  thankYouText: 200,
};
const MULTILINE = new Set(['letter']);

/** Lists of short strings → [max items, max length per item]. */
const LIST_FIELDS = {
  noMessages: [10, 100],
  loveNotes: [16, 90],
  reasons: [20, 160],
};

const MAX_PHOTOS = 40;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const MEDIA_RE = /^\/birthday-paigaam\/media\/[a-f0-9]{48}\.(jpg|png|webp|mp3|m4a|ogg|webm|wav|aac)$/;
const IMAGE_EXT = /\.(jpg|png|webp)$/;
const AUDIO_EXT = /\.(mp3|m4a|ogg|webm|wav|aac)$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

function str(value, max, { multiline = false } = {}) {
  if (value == null) return '';
  if (typeof value !== 'string') throw new InputError();
  const v = value.replace(/\r\n?/g, '\n').trim();
  if (v.length > max) throw new InputError();
  if (CONTROL.test(v)) throw new InputError();
  if (!multiline && v.includes('\n')) throw new InputError();
  return v;
}

function list(value, maxItems, maxLen) {
  if (value == null || value === '') return [];
  // The wizard sends arrays; a newline-separated string is accepted too.
  const items = Array.isArray(value) ? value : (typeof value === 'string' ? value.split('\n') : null);
  if (!items) throw new InputError();
  const out = [];
  for (const item of items) {
    const v = str(item == null ? '' : item, maxLen);
    if (v) out.push(v);
  }
  if (out.length > maxItems) throw new InputError();
  return out;
}

function media(value, kind) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string' || !MEDIA_RE.test(value)) throw new InputError();
  if (kind === 'image' && !IMAGE_EXT.test(value)) throw new InputError();
  if (kind === 'audio' && !AUDIO_EXT.test(value)) throw new InputError();
  return value;
}

function bool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  throw new InputError();
}

function validate(data, { publish = false } = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new InputError();
  const clean = { templateVersion: 1 };

  for (const [key, max] of Object.entries(TEXT_FIELDS)) clean[key] = str(data[key], max, { multiline: MULTILINE.has(key) });
  if (publish && !clean.recipientName) throw new InputError('name_required');

  const code = str(data.passcode, 4);
  if (code && !/^\d{4}$/.test(code)) throw new InputError('bad_passcode');
  clean.passcode = code;

  const age = str(data.age == null ? '' : String(data.age), 3);
  if (age && (!/^\d{1,3}$/.test(age) || Number(age) < 1 || Number(age) > 120)) throw new InputError();
  clean.age = age;

  const date = str(data.birthdayDate, 10);
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new InputError();
    const d = new Date(date + 'T00:00:00Z');
    if (isNaN(d) || d.toISOString().slice(0, 10) !== date) throw new InputError();
  }
  clean.birthdayDate = date;

  const wa = str(data.whatsapp == null ? '' : String(data.whatsapp), 24).replace(/[\s()+-]/g, '');
  if (wa && !/^\d{8,15}$/.test(wa)) throw new InputError('bad_whatsapp');
  clean.whatsapp = wa;

  const candles = data.candles == null || data.candles === '' ? 5 : Number(data.candles);
  if (!Number.isInteger(candles) || candles < 1 || candles > 9) throw new InputError();
  clean.candles = candles;

  for (const [key, [maxItems, maxLen]] of Object.entries(LIST_FIELDS)) clean[key] = list(data[key], maxItems, maxLen);

  clean.mainPhoto = media(data.mainPhoto, 'image');
  clean.voiceUrl = media(data.voiceUrl, 'audio');
  clean.songUrl = media(data.songUrl, 'audio');

  const photos = data.photos == null ? [] : data.photos;
  if (!Array.isArray(photos) || photos.length > MAX_PHOTOS) throw new InputError();
  clean.photos = photos.map(p => {
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw new InputError();
    const url = media(p.url, 'image');
    if (!url) throw new InputError();
    return { url, caption: str(p.caption, 60), back: str(p.back, 200) };
  });

  const pal = data.palette && typeof data.palette === 'object' && !Array.isArray(data.palette) ? data.palette : {};
  clean.palette = {};
  for (const [k, fallback] of Object.entries(PALETTES.dreamy)) {
    const v = pal[k];
    if (v == null || v === '') { clean.palette[k] = fallback; continue; }
    if (typeof v !== 'string' || !HEX.test(v)) throw new InputError();
    clean.palette[k] = v.toUpperCase();
  }

  const font = data.font == null || data.font === '' ? 'dreamy' : data.font;
  if (typeof font !== 'string' || !Object.prototype.hasOwnProperty.call(FONTS, font)) throw new InputError();
  clean.font = font;

  const screens = data.screens && typeof data.screens === 'object' && !Array.isArray(data.screens) ? data.screens : {};
  clean.screens = {};
  for (const [k, fallback] of Object.entries(TOGGLES)) clean.screens[k] = bool(screens[k], fallback);

  clean.showBrand = bool(data.showBrand, true);
  return clean;
}

/** Every upload URL a validated record points at. */
function mediaIn(clean) {
  const out = [];
  if (clean.mainPhoto) out.push(clean.mainPhoto);
  if (clean.voiceUrl) out.push(clean.voiceUrl);
  if (clean.songUrl) out.push(clean.songUrl);
  for (const p of clean.photos || []) out.push(p.url);
  return out;
}

module.exports = { validate, mediaIn, InputError, TEXT_FIELDS, LIST_FIELDS, MAX_PHOTOS, MEDIA_RE };
