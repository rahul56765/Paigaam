'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-photo-fixtures-'));
process.env.DATA_DIR = dir;
const photos = require('../lib/creators/photos');
const { db } = require('../db');
after(() => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); });
const rejects = (fn, status) => assert.rejects(fn, err => err.code === 'invalid_photo' && (!status || err.status === status));
async function image(format = 'png') { return sharp({ create: { width: 700, height: 300, channels: 4, background: '#ac5076' } })[format]().toBuffer(); }
test('photo processor creates local atomic 512 square JPEG with EXIF/GPS/XMP/ICC stripped', async () => {
  const input = await sharp(await image()).withMetadata({ orientation: 6, exif: { IFD0: { Artist: 'PRIVATE-ARTIST', Copyright: 'PRIVATE' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '28/1 35/1 0/1' } } }).jpeg().toBuffer();
  assert.ok((await sharp(input).metadata()).exif);
  const url = await photos.savePhoto('partner_1', input, 'image/jpeg');
  assert.match(url, /^\/creator\/photos\/partner_1\/[a-f0-9]{64}\.jpg$/);
  const bytes = await photos.readPhoto('partner_1', url), metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, 'jpeg'); assert.equal(metadata.width, 512); assert.equal(metadata.height, 512);
  for (const field of ['exif', 'xmp', 'icc', 'iptc', 'orientation']) assert.equal(metadata[field], undefined);
  assert.equal(bytes.includes(Buffer.from('PRIVATE-ARTIST')), false);
  assert.deepEqual(fs.readdirSync(path.join(dir, 'creator-photos')), [path.basename(photos.photoPath('partner_1', url))]);
  assert.equal(fs.statSync(photos.photoPath('partner_1', url)).mode & 0o777, 0o600);
});
test('PNG and WebP normalize, random replacement path differs, transparent source flattens', async () => {
  for (const mime of ['image/png', 'image/webp']) {
    const input = await image(mime.split('/')[1]);
    const a = await photos.savePhoto('partner_2', input, mime), b = await photos.savePhoto('partner_2', input, mime);
    assert.notEqual(a, b);
    assert.equal((await sharp(await photos.readPhoto('partner_2', a)).metadata()).hasAlpha, false);
    await photos.removePhoto('partner_2', a); assert.equal(await photos.readPhoto('partner_2', a), null);
  }
});
test('rejects spoofed MIME, corrupt content, GIF/SVG, empty, oversized files and over-16MP decode', async () => {
  await rejects(() => photos.savePhoto('partner_3', Buffer.from('GIF89a'), 'image/gif'), 415);
  await rejects(() => photos.savePhoto('partner_3', Buffer.from('<svg/>'), 'image/svg+xml'), 415);
  await rejects(() => photos.savePhoto('partner_3', Buffer.from('not an image'), 'image/jpeg'));
  await rejects(() => photos.savePhoto('partner_3', Buffer.alloc(0), 'image/png'));
  await rejects(() => photos.savePhoto('partner_3', Buffer.alloc(photos.MAX_BYTES + 1), 'image/png'), 413);
  const png = await image();
  await rejects(() => photos.savePhoto('partner_3', png, 'image/jpeg'));
  const big = await sharp({ create: { width: 4200, height: 4200, channels: 3, background: 'red' } }).png().toBuffer();
  await rejects(() => photos.savePhoto('partner_3', big, 'image/png'));
});
test('animated WebP is rejected even with an allowed MIME type', async () => {
  const frame = Buffer.concat([Buffer.alloc(2 * 2 * 4, 255), Buffer.alloc(2 * 2 * 4, 70)]);
  const input = await sharp(frame, { raw: { width: 2, height: 4, channels: 4, pageHeight: 2 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
  assert.equal((await sharp(input, { animated: true }).metadata()).pages, 2);
  await rejects(() => photos.savePhoto('partner_3', input, 'image/webp'));
});
test('path helper rejects traversal, external URLs, mismatched owner and untrusted filenames', async () => {
  const digest = 'a'.repeat(64);
  for (const url of [`/creator/photos/partner_1/${digest}.jpg/../../etc`, `/creator/photos/partner_1/../secret.jpg`, `https://evil.test/${digest}.jpg`, `/creator/photos/partner_2/${digest}.jpg`, `/creator/photos/partner_1/${digest}.svg`, `/creator/photos/partner_1/${digest.toUpperCase()}.jpg`]) {
    assert.equal(photos.photoPath('partner_1', url), null); assert.equal(await photos.readPhoto('partner_1', url), null);
  }
  await rejects(() => photos.savePhoto('../escape', Buffer.from('x'), 'image/jpeg'));
});
test('binary body reader enforces 5MB for declared and chunked bodies', async () => {
  const { Readable } = require('node:stream');
  const req = (chunks, headers = {}) => Object.assign(Readable.from(chunks), { headers });
  assert.deepEqual(await photos.readBody(req([Buffer.from('ok')])), Buffer.from('ok'));
  await rejects(() => photos.readBody(req([Buffer.alloc(photos.MAX_BYTES), Buffer.alloc(1)])), 413);
  await rejects(() => photos.readBody(req([], { 'content-length': photos.MAX_BYTES + 1 })), 413);
});
