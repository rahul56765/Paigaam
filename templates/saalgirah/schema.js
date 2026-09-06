'use strict';
/**
 * Validation for Saalgirah personalisation.
 *
 * Every field is optional except the recipient's name — an untouched form still
 * produces the original letter, because the renderer supplies the defaults.
 * Stored data is always a clean, whitelisted object: unknown keys never persist.
 */
class InputError extends Error {
  constructor(code = 'validation', status = 400) { super(code); this.code = code; this.status = status; }
}

/** field -> max length */
const FIELDS = {
  recipientName: 60,
  senderName: 60,
  line1: 160,
  line2: 160,
  line3: 160,
  attentionLine: 160,
  wishLine: 90,
  closingLine: 90,
  note: 400,
};

const REQUIRED = ['recipientName'];

/** Control characters are rejected outright; newlines are allowed only in the note. */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function validate(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new InputError();
  const clean = { templateVersion: 1 };
  for (const [key, max] of Object.entries(FIELDS)) {
    if (data[key] != null && typeof data[key] !== 'string') throw new InputError();
    const value = (data[key] || '').replace(/\r\n?/g, '\n').trim();
    if (value.length > max) throw new InputError();
    if (CONTROL.test(value)) throw new InputError();
    if (key !== 'note' && value.includes('\n')) throw new InputError();
    if (REQUIRED.includes(key) && !value) throw new InputError();
    clean[key] = value;
  }
  // A note of only blank lines is no note at all.
  if (!clean.note.replace(/\s/g, '')) clean.note = '';
  return clean;
}

module.exports = { validate, InputError, FIELDS, REQUIRED };
