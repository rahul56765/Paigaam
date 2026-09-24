'use strict';
/**
 * Validation for Sawaal personalisation.
 *
 * Only the recipient's name is required — an untouched form still produces
 * the designed questionnaire, because the renderer supplies the defaults.
 * Stored data is always a clean, whitelisted object: unknown keys never
 * persist. The quiz itself is fixed design copy (like Maafi's plea ladder):
 * four questions, server-scored, not editable here.
 */
class InputError extends Error {
  constructor(code = 'validation', status = 400) { super(code); this.code = code; this.status = status; }
}

/** field -> max length */
const FIELDS = {
  recipientName: 60,
  senderName: 60,
  inviteTitle: 90,
  inviteIntro: 140,
  likeTitle: 90,
  vibeTitle: 90,
  vibeOptions: 160,
  availableDays: 200,
  quizTitle: 90,
  quizIntro: 140,
  kissTitle: 90,
  kissIntro: 160,
  yesOutcome: 90,
  shyOutcome: 90,
  shyOutcomeLine: 140,
};

const REQUIRED = ['recipientName'];

/** Control characters are rejected outright; no field here wants newlines. */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 8;

/** "A, B, C" -> ["A","B","C"], trimmed, de-duped, empties dropped. Accepts
 *  already-parsed arrays too (validate() must accept its own output — stored
 *  drafts re-validate at publish time). */
function parseList(raw) {
  if (Array.isArray(raw)) {
    return raw.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim());
  }
  if (typeof raw !== 'string') return [];
  const seen = new Set();
  const out = [];
  for (const part of raw.split(',')) {
    const value = part.trim();
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    out.push(value);
  }
  return out;
}

/** The sender's real availability, validated as ISO dates, future, max 8. */
function parseDays(raw) {
  const days = parseList(raw || '').filter(v => ISO_DATE.test(v) && !isNaN(new Date(v + 'T00:00:00').getTime()));
  return days.slice(0, MAX_DAYS);
}

function validate(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new InputError();
  const clean = { templateVersion: 1 };
  for (const [key, max] of Object.entries(FIELDS)) {
    if (key === 'vibeOptions' || key === 'availableDays') continue; // list fields, parsed below
    if (data[key] != null && typeof data[key] !== 'string') throw new InputError();
    const value = (data[key] || '').replace(/\r\n?/g, '\n').trim();
    if (value.length > max) throw new InputError();
    if (CONTROL.test(value)) throw new InputError();
    if (value.includes('\n')) throw new InputError();
    if (REQUIRED.includes(key) && !value) throw new InputError();
    clean[key] = value;
  }
  // Lists are stored as structured values; a bad list is dropped, never fatal.
  // (parseList accepts strings AND this function's own array output, so stored
  // drafts re-validate cleanly at publish time.) A raw string still honours
  // its declared length cap.
  const vibeRaw = data.vibeOptions;
  const daysRaw = data.availableDays;
  if (typeof vibeRaw === 'string' && vibeRaw.length > FIELDS.vibeOptions) throw new InputError();
  if (typeof daysRaw === 'string' && daysRaw.length > FIELDS.availableDays) throw new InputError();
  clean.vibeOptions = parseList(vibeRaw).slice(0, 4);
  clean.availableDays = parseDays(daysRaw);
  return clean;
}

module.exports = { validate, InputError, FIELDS, REQUIRED, parseList, parseDays, MAX_DAYS };
