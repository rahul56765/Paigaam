'use strict';
// Header/container validation only: never trust a filename or a browser MIME.
// Files stay in the family upload store and are served with nosniff as audio.
const EXT = Object.freeze({
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
  'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a',
  'audio/ogg': 'ogg', 'application/ogg': 'ogg',
  'audio/wav': 'wav', 'audio/wave': 'wav', 'audio/x-wav': 'wav',
});
const MAX_BYTES = 15 * 1024 * 1024;

function mp3Frame(buf, offset) {
  if (offset + 4 > buf.length || buf[offset] !== 0xff || (buf[offset + 1] & 0xe0) !== 0xe0) return false;
  const version = (buf[offset + 1] >> 3) & 3, layer = (buf[offset + 1] >> 1) & 3;
  const bitrate = buf[offset + 2] >> 4, rate = (buf[offset + 2] >> 2) & 3;
  // MPEG audio Layer III, no reserved/free-format bitrate or sample rate.
  if (version === 1 || layer !== 1 || bitrate === 0 || bitrate === 15 || rate === 3) return false;
  const kbps = (version === 3 ? [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320] : [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160])[bitrate];
  const hz = [44100,48000,32000][rate] / (version === 3 ? 1 : version === 2 ? 2 : 4);
  const length = Math.floor((version === 3 ? 144 : 72) * kbps * 1000 / hz) + ((buf[offset + 2] >> 1) & 1);
  return offset + length <= buf.length;
}

function wav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE' || buf.readUInt32LE(4) + 8 !== buf.length) return false;
  let format = false, data = false, pos = 12;
  while (pos + 8 <= buf.length) {
    const tag = buf.toString('ascii', pos, pos + 4), size = buf.readUInt32LE(pos + 4), end = pos + 8 + size;
    if (end > buf.length) return false;
    if (tag === 'fmt ') {
      if (size < 16) return false;
      const codec = buf.readUInt16LE(pos + 8), channels = buf.readUInt16LE(pos + 10), rate = buf.readUInt32LE(pos + 12);
      if (![1, 3, 0xfffe].includes(codec) || channels < 1 || channels > 32 || rate < 1 || rate > 384000) return false;
      format = true;
    }
    if (tag === 'data' && size > 0) data = true;
    pos = end + (size & 1);
  }
  return format && data && pos === buf.length;
}

// Parse bounded ISO-BMFF boxes; require an actual audio track, not a renamed MP4 video.
function m4a(buf) {
  let ftyp = false, audio = false, video = false, media = false;
  function boxes(start, end, depth) {
    if (depth > 5) return false;
    let pos = start;
    while (pos + 8 <= end) {
      let size = buf.readUInt32BE(pos), header = 8;
      const tag = buf.toString('ascii', pos + 4, pos + 8);
      if (size === 1) {
        if (pos + 16 > end) return false;
        const wide = buf.readBigUInt64BE(pos + 8);
        if (wide > BigInt(buf.length)) return false;
        size = Number(wide); header = 16;
      } else if (size === 0) size = end - pos;
      if (size < header || pos + size > end) return false;
      const body = pos + header;
      if (tag === 'ftyp' && depth === 0 && pos === 0) {
        if (size < header + 8 || (size - header) % 4) return false;
        const brands = [buf.toString('ascii', body, body + 4)];
        for (let i = body + 8; i + 4 <= pos + size; i += 4) brands.push(buf.toString('ascii', i, i + 4));
        ftyp = brands.some(b => ['M4A ', 'isom', 'iso2', 'mp41', 'mp42'].includes(b));
      }
      if (tag === 'mdat' && depth === 0 && size > header) media = true;
      if (tag === 'hdlr' && depth > 0 && size >= header + 12) {
        const handler = buf.toString('ascii', body + 8, body + 12);
        if (handler === 'soun') audio = true;
        if (handler === 'vide') video = true;
      }
      if (['moov', 'trak', 'mdia'].includes(tag) && !boxes(body, pos + size, depth + 1)) return false;
      pos += size;
    }
    return pos === end;
  }
  return boxes(0, buf.length, 0) && ftyp && audio && !video && media;
}

function sniffAudio(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf.toString('ascii', 0, 4) === 'RIFF') return wav(buf) ? 'wav' : null;
  if (buf.toString('ascii', 4, 8) === 'ftyp') return m4a(buf) ? 'm4a' : null;
  if (buf.toString('ascii', 0, 4) === 'OggS') {
    if (buf.length < 28 || buf[4] !== 0 || !(buf[5] & 2) || !buf[26]) return null;
    const segments = buf[26], start = 27 + segments;
    if (start > buf.length) return null;
    let pageSize = start, packetSize = 0, complete = false;
    for (let i = 27; i < start; i++) {
      pageSize += buf[i];
      if (!complete) { packetSize += buf[i]; complete = buf[i] < 255; }
    }
    if (pageSize > buf.length || !complete) return null;
    const opus = packetSize >= 19 && buf.toString('ascii', start, start + 8) === 'OpusHead' &&
      buf[start + 8] > 0 && buf[start + 8] < 16 && buf[start + 9] > 0;
    const vorbis = packetSize >= 30 && buf[start] === 1 && buf.toString('ascii', start + 1, start + 7) === 'vorbis' &&
      buf.readUInt32LE(start + 7) === 0 && buf[start + 11] > 0 && buf.readUInt32LE(start + 12) > 0 && (buf[start + 29] & 1);
    return opus || vorbis ? 'ogg' : null;
  }
  let offset = 0;
  if (buf.toString('ascii', 0, 3) === 'ID3') {
    if (![2,3,4].includes(buf[3]) || buf[4] === 0xff || [6,7,8,9].some(i => buf[i] & 0x80)) return null;
    offset = 10 + (buf[6] * 2097152 + buf[7] * 16384 + buf[8] * 128 + buf[9]);
    if (buf[3] === 4 && (buf[5] & 0x10)) offset += 10;
  }
  return mp3Frame(buf, offset) ? 'mp3' : null;
}

function checkAudio(buf, declaredType) {
  if (!Buffer.isBuffer(buf) || !Object.hasOwn(EXT, declaredType)) return 'invalid_audio';
  if (buf.length > MAX_BYTES) return 'too_large';
  return sniffAudio(buf) === EXT[declaredType] ? null : 'invalid_audio';
}
module.exports = { EXT, MAX_BYTES, sniffAudio, checkAudio };
