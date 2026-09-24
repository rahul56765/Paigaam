'use strict';
/**
 * Validation for Maafi personalisation.
 *
 * Every field is optional except the recipient's name — an untouched form still
 * produces the designed apology, because the renderer supplies the defaults.
 * Stored data is always a clean, whitelisted object: unknown keys never persist.
 */
class InputError extends Error {
  constructor(code = 'validation', status = 400) { super(code); this.code = code; this.status = status; }
}

/** field -> max length */
const FIELDS = {
  recipientName: 60,
  senderName: 60,
  headline: 120,
  yesLabel: 40,
  noLabel: 40,
  celebration: 120,
};

const REQUIRED = ['recipientName'];

/** Control characters are rejected outright; no field here wants newlines. */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function validate(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new InputError();
  const clean = { templateVersion: 1 };
  for (const [key, max] of Object.entries(FIELDS)) {
    if (data[key] != null && typeof data[key] !== 'string') throw new InputError();
    const value = (data[key] || '').replace(/\r\n?/g, '\n').trim();
    if (value.length > max) throw new InputError();
    if (CONTROL.test(value)) throw new InputError();
    if (value.includes('\n')) throw new InputError();
    if (REQUIRED.includes(key) && !value) throw new InputError();
    clean[key] = value;
  }
  return clean;
}

module.exports = { validate, InputError, FIELDS, REQUIRED };
