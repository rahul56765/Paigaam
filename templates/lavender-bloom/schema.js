'use strict';
/**
 * Validation for Lavender Bloom personalisation.
 *
 * Every field is optional except the recipient's name — an untouched form still
 * produces the designed surprise, because the renderer supplies the defaults.
 * Stored data is always a clean, whitelisted object: unknown keys never persist.
 */
class InputError extends Error {
  constructor(code = 'validation', status = 400) { super(code); this.code = code; this.status = status; }
}

/** field -> max length */
const FIELDS = {
  recipientName: 60,
  senderName: 60,
  title: 90,
  message: 400,
  flowerColor: 20,
};

const REQUIRED = ['recipientName'];

/** Flower colour is a theme preset, not free text — the palette must stay tasteful. */
const FLOWER_COLORS = ['lavender', 'rose', 'sunbeam'];

/** Control characters are rejected outright; newlines are allowed only in the message. */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function validate(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new InputError();
  const clean = { templateVersion: 1 };
  for (const [key, max] of Object.entries(FIELDS)) {
    if (data[key] != null && typeof data[key] !== 'string') throw new InputError();
    const value = (data[key] || '').replace(/\r\n?/g, '\n').trim();
    if (value.length > max) throw new InputError();
    if (CONTROL.test(value)) throw new InputError();
    if (key !== 'message' && value.includes('\n')) throw new InputError();
    if (REQUIRED.includes(key) && !value) throw new InputError();
    clean[key] = value;
  }
  // A message of only blank lines is no message at all.
  if (!clean.message.replace(/\s/g, '')) clean.message = '';
  // An unknown colour silently falls back to lavender — never stored, never rendered.
  if (clean.flowerColor && !FLOWER_COLORS.includes(clean.flowerColor)) clean.flowerColor = 'lavender';
  return clean;
}

module.exports = { validate, InputError, FIELDS, REQUIRED, FLOWER_COLORS };
