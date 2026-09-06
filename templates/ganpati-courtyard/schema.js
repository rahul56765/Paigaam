'use strict';
/**
 * Validation for Ganpati Courtyard personalisation.
 *
 * All seven fields are optional — an untouched form still produces the
 * designed card, because the renderer supplies Marathi defaults. Stored data
 * is always a clean, whitelisted object: unknown keys never persist.
 */
class InputError extends Error {
  constructor(code = 'validation', status = 400) { super(code); this.code = code; this.status = status; }
}

/** field -> max length (kept comfortably inside the safe column) */
const FIELDS = {
  greeting: 60,
  mainTitle: 60,
  familyName: 60,
  eventDate: 60,
  eventTime: 40,
  venueName: 80,
  city: 40,
};

/** Control characters are rejected outright; newlines are never allowed (captions are single lines). */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function validate(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new InputError();
  const clean = { templateVersion: 1 };
  for (const [key, max] of Object.entries(FIELDS)) {
    if (data[key] != null && typeof data[key] !== 'string') throw new InputError();
    const value = (data[key] || '').replace(/\s+/g, ' ').trim();
    if (value.length > max) throw new InputError();
    if (CONTROL.test(value)) throw new InputError();
    clean[key] = value;
  }
  return clean;
}

module.exports = { validate, InputError, FIELDS };
