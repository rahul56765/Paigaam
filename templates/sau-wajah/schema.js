'use strict';
/**
 * Validation for Sau Wajah personalisation and photo uploads.
 *
 * Text fields are optional except the recipient's name — an untouched form
 * still produces the designed experience, because the renderer supplies the
 * defaults. Photos are stored as references to server-side uploads
 * ({ url, alt }); draft creation rejects photo references (they can only
 * come from the upload endpoint), mirroring templates/love-album/schema.js.
 */
class InputError extends Error {
  constructor(code = 'validation', status = 400) { super(code); this.code = code; this.status = status; }
}

/** field -> max length */
const FIELDS = {
  recipientName: 60,
  senderName: 60,
  heroTitle: 120,
  heroSubtitle: 160,
  galleryHeading: 120,
  reasonsHeading: 160,
  reasons: 8000,
  letterTitle: 120,
  letterBody: 4000,
  signature: 80,
};

const REQUIRED = ['recipientName'];

/** Photos the gallery may contain when publishing. */
const MAX_PHOTOS = 9;

/** Upload constraints (mirrors lib/sauwajahRoutes.js). */
const UPLOAD = {
  maxBytes: 2 * 1024 * 1024,
  accept: ['image/jpeg', 'image/png', 'image/webp'],
};

/** Control characters are rejected outright; newlines only where designed. */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function validate(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new InputError();
  const clean = { templateVersion: 1 };
  for (const [key, max] of Object.entries(FIELDS)) {
    if (data[key] != null && typeof data[key] !== 'string') throw new InputError();
    const value = (data[key] || '').replace(/\r\n?/g, '\n').trim();
    if (value.length > max) throw new InputError();
    if (CONTROL.test(value)) throw new InputError();
    if (value.includes('\n') && key !== 'reasons' && key !== 'letterBody') throw new InputError();
    if (REQUIRED.includes(key) && !value) throw new InputError();
    clean[key] = value;
  }
  // A reasons list of only blank lines is no list at all.
  if (!clean.reasons.replace(/\s/g, '')) clean.reasons = '';
  if (!clean.letterBody.replace(/\s/g, '')) clean.letterBody = '';

  // Photo references: shape-check only here. Ownership is verified against
  // the uploads table by the routes module (verifyPhotos).
  const photos = data.photos === undefined ? [] : data.photos;
  if (!Array.isArray(photos) || photos.length > MAX_PHOTOS) throw new InputError();
  clean.photos = photos.map(photo => {
    if (!photo || typeof photo !== 'object' || Array.isArray(photo)) throw new InputError();
    const url = typeof photo.url === 'string' ? photo.url.trim() : '';
    if (!/^\/sau-wajah\/uploads\/[a-f0-9]{48}\.(?:webp|jpg|png)$/.test(url)) throw new InputError();
    const alt = typeof photo.alt === 'string' ? photo.alt.replace(/\r\n?/g, ' ').trim().slice(0, 120) : '';
    return { url, alt };
  });
  return clean;
}

module.exports = { validate, InputError, FIELDS, REQUIRED, MAX_PHOTOS, UPLOAD };
