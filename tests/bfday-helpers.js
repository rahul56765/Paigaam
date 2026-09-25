'use strict';
// Shared helpers for tests/bfday-*.test.js (not a test file itself).
const zlib = require('node:zlib');
const assert = require('node:assert/strict');

const BASE = process.env.BFDAY_BASE_URL || 'http://127.0.0.1:3999';
const HOSTILE = '<script>alert(1)</script><img src=x onerror=alert(2)>"\'&';

async function request(path, { method = 'GET', cookie, body, raw, type, headers = {} } = {}) {
  const response = await fetch(BASE + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(type ? { 'content-type': type } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: raw !== undefined ? raw : (body !== undefined ? JSON.stringify(body) : undefined),
    redirect: 'manual',
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* html endpoints */ }
  return { status: response.status, json, text, headers: response.headers };
}

async function draft(slug, data, cookie) {
  const r = await request(`/api/${slug}/draft`, { method: 'POST', cookie, body: { customer_data: data } });
  assert.equal(r.status, 200, `${slug} draft: ${r.text}`);
  const set = r.headers.get('set-cookie');
  return { id: r.json.id, previewUrl: r.json.previewUrl, cookie: cookie || set.split(';')[0], data };
}

/** Every field of a spec filled with the most hostile legal value (images left blank). */
function hostileFor(fields) {
  const str = f => HOSTILE.slice(0, f.maxLength || HOSTILE.length) || '<';
  const scalar = f => {
    if (f.type === 'text' || f.type === 'textarea') return str(f);
    if (f.type === 'number') return f.max;
    if (f.type === 'url') return 'https://x.example/?a=1&b=%3Cscript%3E'.slice(0, f.maxLength); // quotes/<> are rejected outright
    if (f.type === 'select') return f.options[f.options.length - 1].value;
    return '';
  };
  const out = {};
  for (const f of fields) {
    if (f.type !== 'list') { out[f.id] = scalar(f); continue; }
    const n = Math.max(1, f.minItems);
    out[f.id] = Array.from({ length: n }, () => (f.item ? scalar(f.item) : Object.fromEntries(f.shape.map(s => [s.id, scalar(s)]))));
  }
  return out;
}

/** A real, valid PNG (solid colour) — no encoder dependency. */
function png(width = 64, height = 64, rgb = [220, 120, 110]) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 3);
    for (let x = 0; x < width; x++) { const o = row + 1 + x * 3; raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]; }
  }
  let table = null;
  const crc32 = buf => {
    if (!table) { table = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; table[n] = c; } }
    let c = 0xFFFFFFFF; for (const b of buf) c = table[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const t = Buffer.from(type, 'ascii'); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** The first top-level text field (for "did my text land?" checks) and a value for it. */
function firstText(t) {
  return t.fields.find(f => f.type === 'text' && f.required) || t.fields.find(f => f.type === 'text');
}

module.exports = { BASE, HOSTILE, request, draft, hostileFor, png, firstText };
