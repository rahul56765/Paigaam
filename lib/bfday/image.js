'use strict';
/**
 * Boyfriend Day family — upload sniffing, no image library.
 *
 * The wizard re-encodes every photo in the browser (canvas → JPEG, long edge
 * ≤1600px, q0.82) before upload; the server trusts none of that and checks
 * the magic bytes and the real pixel dimensions itself. The declared
 * Content-Type must agree with the bytes.
 */

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 2 * 1024 * 1024;
const MIN_EDGE = 50;
const MAX_EDGE = 8000;

/** → { format, width, height } or null. */
function sniffImage(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 24) return null;
  // JPEG: SOI, then walk segments to the first SOFn (not DHT/JPG/DAC).
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xFF) return null;
      const marker = buf[i + 1];
      if (marker === 0xFF) { i++; continue; }                        // fill byte
      if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { i += 2; continue; }
      if (marker === 0xD9 || marker === 0xDA) return null;            // EOI / SOS before any SOF
      const len = buf.readUInt16BE(i + 2);
      if (len < 2) return null;
      if (marker >= 0xC0 && marker <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(marker)) {
        // FF Cn | len(2) | precision(1) | height(2) | width(2)
        return { format: 'image/jpeg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
    return null;
  }
  // PNG: signature + IHDR first.
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG' && buf.toString('ascii', 12, 16) === 'IHDR') {
    return { format: 'image/png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // WebP: RIFF....WEBP + VP8X / VP8 / VP8L.
  if (buf.length >= 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X') {
      return { format: 'image/webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    }
    if (chunk === 'VP8 ' && buf[23] === 0x9D && buf[24] === 0x01 && buf[25] === 0x2A) {
      return { format: 'image/webp', width: buf.readUInt16LE(26) & 0x3FFF, height: buf.readUInt16LE(28) & 0x3FFF };
    }
    if (chunk === 'VP8L' && buf[20] === 0x2F) {
      const bits = buf.readUInt32LE(21);
      return { format: 'image/webp', width: (bits & 0x3FFF) + 1, height: ((bits >> 14) & 0x3FFF) + 1 };
    }
  }
  return null;
}

/** Throws a code string when the bytes are not a usable photo of the declared type. */
function checkImage(buf, declaredType) {
  if (!EXT[declaredType]) return 'invalid_image';
  if (buf.length > MAX_BYTES) return 'too_large';
  const s = sniffImage(buf);
  if (!s || s.format !== declaredType) return 'invalid_image';
  if (s.width < MIN_EDGE || s.height < MIN_EDGE || s.width > MAX_EDGE || s.height > MAX_EDGE) return 'invalid_image';
  return null;
}

module.exports = { sniffImage, checkImage, EXT, MAX_BYTES };
