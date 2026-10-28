'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const { DATA_DIR } = require('../../db');
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 16000000;
const ROOT = path.join(DATA_DIR, 'creator-photos');
const ID = /^[a-zA-Z0-9_-]{1,128}$/;
const PHOTO = /^\/creator\/photos\/([a-zA-Z0-9_-]{1,128})\/([a-f0-9]{64})\.jpg$/;
const formats = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
let processing = 0;
function fail(message, status = 400) { return Object.assign(new Error(message), { status, code: 'invalid_photo' }); }
function photoPath(id, url) {
  const match = typeof url === 'string' && url.match(PHOTO);
  return match && match[1] === id ? path.join(ROOT, `${id}-${match[2]}.jpg`) : null;
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    if (Number(req.headers['content-length']) > MAX_BYTES) { req.resume(); return reject(fail('Photo exceeds 5 MB. Choose a smaller image.', 413)); }
    let size = 0, chunks = [], exceeded = false;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BYTES) { exceeded = true; chunks = []; }
      else if (!exceeded) chunks.push(Buffer.from(chunk));
    });
    req.on('end', () => exceeded ? reject(fail('Photo exceeds 5 MB. Choose a smaller image.', 413)) : resolve(Buffer.concat(chunks)));
    req.on('error', () => reject(fail('Photo upload was interrupted. Please try again.')));
    req.on('aborted', () => reject(fail('Photo upload was interrupted. Please try again.')));
  });
}
async function savePhoto(id, input, mime) {
  if (!ID.test(id)) throw fail('Invalid partner.');
  if (!formats[mime]) throw fail('Choose a JPG, PNG or WebP image (not SVG, GIF or animation).', 415);
  if (!Buffer.isBuffer(input) || !input.length) throw fail('Choose an image to upload.');
  if (input.length > MAX_BYTES) throw fail('Photo exceeds 5 MB. Choose a smaller image.', 413);
  if (processing >= 2) throw fail('Photo processing is busy. Please try again shortly.', 429);
  processing++;
  let output;
  try {
    const image = sharp(input, { limitInputPixels: MAX_PIXELS, failOn: 'warning', animated: true });
    const metadata = await image.metadata();
    if (metadata.format !== formats[mime] || (metadata.pages || 1) > 1 || !metadata.width || !metadata.height || metadata.width * metadata.height > MAX_PIXELS) throw fail('Use a still JPG, PNG or WebP image no larger than 16 megapixels.');
    // No keepMetadata/withMetadata: EXIF, GPS, XMP and original ICC data are discarded.
    output = await image.rotate().resize(512, 512, { fit: 'cover', position: 'centre' }).flatten({ background: '#ffffff' }).jpeg({ quality: 85 }).toBuffer();
  } catch (err) {
    if (err.code === 'invalid_photo') throw err;
    throw fail('This image could not be read. Use a still JPG, PNG or WebP image under 16 megapixels.');
  } finally { processing--; }
  await fs.mkdir(ROOT, { recursive: true, mode: 0o700 });
  const digest = crypto.randomBytes(32).toString('hex');
  const url = `/creator/photos/${id}/${digest}.jpg`;
  const destination = photoPath(id, url), temporary = destination + '.tmp';
  try {
    await fs.writeFile(temporary, output, { flag: 'wx', mode: 0o600 });
    await fs.rename(temporary, destination);
  } catch (err) { await fs.rm(temporary, { force: true }).catch(() => {}); throw err; }
  return url;
}
async function removePhoto(id, url) {
  const file = photoPath(id, url);
  if (file) await fs.rm(file, { force: true });
}
async function readPhoto(id, url) {
  const file = photoPath(id, url);
  if (!file) return null;
  try { return await fs.readFile(file); } catch (err) { if (err.code === 'ENOENT') return null; throw err; }
}
module.exports = { MAX_BYTES, MAX_PIXELS, photoPath, readBody, savePhoto, removePhoto, readPhoto };
