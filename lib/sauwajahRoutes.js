'use strict';
/**
 * Sau Wajah routes — draft, upload, preview, publish.
 *
 * Same creator-cookie ownership pattern as the other templates. Photos are
 * OPTIONAL here (0–9): the experience is complete without them, so unlike
 * Love Album there is no minimum-photos publish gate — but the upload
 * pipeline is identical (client re-encodes via canvas, server validates
 * magic bytes + dimensions natively, no sharp).
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { db, q, DATA_DIR, PERSISTENT } = require('../db');
const { validate, InputError, MAX_PHOTOS } = require('../templates/sau-wajah/schema');
const { renderSauWajah } = require('../templates/sau-wajah/render');
const { sauwajahCreatePage } = require('../pages/sauwajahCreate');
const { streamFile } = require('./streamFile');
const { ensureSauWajahMedia } = require('./sauwajahMedia');

const uploadDir = path.join(DATA_DIR, 'sau-wajah-uploads');
fs.mkdirSync(uploadDir, { recursive: true });
ensureSauWajahMedia();

db.exec(`CREATE TABLE IF NOT EXISTS sau_wajah_owners (
 paigaam_id TEXT PRIMARY KEY REFERENCES paigaams(id) ON DELETE CASCADE,
 owner_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sau_wajah_owner_idx ON sau_wajah_owners(owner_hash);
CREATE TABLE IF NOT EXISTS sau_wajah_uploads (
 filename TEXT PRIMARY KEY, paigaam_id TEXT NOT NULL REFERENCES paigaams(id) ON DELETE CASCADE,
 bytes INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sau_wajah_upload_inv ON sau_wajah_uploads(paigaam_id);`);

const SLUG = 'sau-wajah', COOKIE = 'paigaam_creator';
const inFlight = new Set(), rates = new Map();

function owner(req) {
  const raw = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='));
  const value = raw ? raw.slice(COOKIE.length + 1) : '';
  return /^[a-f0-9]{64}$/.test(value) ? crypto.createHash('sha256').update(value).digest('hex') : null;
}
function owned(req, id) {
  const record = db.prepare('SELECT owner_hash FROM sau_wajah_owners WHERE paigaam_id=?').get(id);
  return !!record && record.owner_hash === owner(req);
}
function editable(req, id) {
  const pg = q.paigaamById(id);
  if (!pg || pg.template_slug !== SLUG) throw new InputError('not_found', 404);
  if (!owned(req, id)) throw new InputError('forbidden', 403);
  if (pg.status !== 'draft') throw new InputError('forbidden', 403);
  return pg;
}
function published(id) {
  const pg = q.paigaamById(id);
  return pg && pg.template_slug === SLUG && ['published', 'active'].includes(pg.status) ? pg : null;
}
function reply(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}
function html(res, body) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
  res.end(body);
}
async function read(req, limit) {
  const declared = Number(req.headers['content-length']);
  if (declared > limit) { req.resume(); throw new InputError('too_large', 413); }
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new InputError('too_large', 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function jsonBody(req) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new InputError();
  try { return JSON.parse((await read(req, 32768)).toString('utf8')); }
  catch (e) { if (e instanceof InputError) throw e; throw new InputError(); }
}
function csrf(req, base) {
  const origin = req.headers.origin;
  if (req.headers['sec-fetch-site'] === 'cross-site' || (origin && origin !== new URL(base).origin)) throw new InputError('forbidden', 403);
}
function rate(req) {
  const now = Date.now(), key = req.socket.remoteAddress || 'unknown';
  if (rates.size > 5000) rates.clear();
  let r = rates.get(key);
  if (!r || r.until < now) r = { count: 0, until: now + 600000 };
  r.count++; rates.set(key, r);
  if (r.count > 240) throw new InputError('limit', 429);
}

/** Every photo reference in stored data must point at an upload this draft owns. */
function verifyPhotos(id, data) {
  for (const photo of (data.photos || [])) {
    const row = db.prepare('SELECT paigaam_id FROM sau_wajah_uploads WHERE filename=?').get(path.basename(photo.url));
    if (!row || row.paigaam_id !== id) throw new InputError('forbidden', 403);
  }
}

/** Only unreferenced, old uploads are eligible. Never delete a referenced photo. */
function cleanup() {
  const cutoff = Date.now() - 7 * 86400000;
  for (const row of db.prepare('SELECT * FROM sau_wajah_uploads WHERE created_at < ?').all(cutoff)) {
    const pg = q.paigaamById(row.paigaam_id);
    if (pg && (pg.customer_data.photos || []).some(p => path.basename(p.url) === row.filename)) continue;
    fs.rmSync(path.join(uploadDir, row.filename), { force: true });
    db.prepare('DELETE FROM sau_wajah_uploads WHERE filename=?').run(row.filename);
  }
}

/* ------------------------------------------------- image sniffing (no sharp) */

function sniffImage(buf) {
  // JPEG: SOI + SOF0/1/2 dimensions
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xFF) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xC0 && m <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(m)) {
        return { format: 'image/jpeg', width: (buf[i + 7] << 8) | buf[i + 8], height: (buf[i + 5] << 8) | buf[i + 9 - 1] };
      }
      if (m === 0x01 || (m >= 0xD0 && m <= 0xD9)) { i += 2; continue; }
      const len = (buf[i + 2] << 8) | buf[i + 3];
      if (len < 2) return null;
      i += 2 + len;
    }
    return null;
  }
  // PNG: signature + IHDR
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    return { format: 'image/png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // WebP: RIFF....WEBP + VP8X/VP8/VP8L dimensions
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X') {
      const w = 1 + (buf[24] | buf[25] << 8 | buf[26] << 16);
      const h = 1 + (buf[27] | buf[28] << 8 | buf[29] << 16);
      return { format: 'image/webp', width: w, height: h };
    }
    if (chunk === 'VP8 ') {
      return { format: 'image/webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === 'VP8L') {
      const bits = (buf[21] | buf[22] << 8 | buf[23] << 16) >> 0;
      const w = (bits & 0x3FFF) + 1, h = ((bits >> 14) & 0x3FFF) + 1;
      return { format: 'image/webp', width: w, height: h };
    }
  }
  return null;
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** A solid-colour truecolor PNG (width x height), no encoder dependency. */
function solidPNG(width, height, r, g, b) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const o = rowStart + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const idat = zlib.deflateSync(raw);
  let table = null;
  const crc32 = buf => {
    if (!table) { table = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; table[n] = c; } }
    let c = 0xFFFFFFFF;
    for (const byte of buf) c = table[(c ^ byte) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeB, data])));
    return Buffer.concat([len, typeB, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Pastel placeholder photos for /sau-wajah/demo and the collection thumbnails. */
function demoPhotos() {
  const dir = path.join(DATA_DIR, 'sau-wajah-demo');
  fs.mkdirSync(dir, { recursive: true });
  const colors = [[255, 214, 232], [214, 236, 255], [230, 217, 255], [255, 232, 214], [214, 255, 233], [255, 243, 214]];
  return colors.map((rgb, index) => {
    const file = `demo-${index + 1}.png`;
    const target = path.join(dir, file);
    try { if (fs.statSync(target).size > 0) return { url: '/sau-wajah/demo-media/' + file, alt: `A demo memory · ${index + 1}` }; } catch { /* regenerate */ }
    fs.writeFileSync(target, solidPNG(400, 400, rgb[0], rgb[1], rgb[2]));
    return { url: '/sau-wajah/demo-media/' + file, alt: `A demo memory · ${index + 1}` };
  });
}

async function handle(req, res, u, { baseUrl, isAdmin = false } = {}) {
  const p = u.pathname.replace(/\/+$/, '') || '/';

  const handles = p === '/create/' + SLUG || p === '/sau-wajah/demo' ||
    p.startsWith('/sau-wajah/preview/') || p.startsWith('/sau-wajah/uploads/') ||
    p.startsWith('/sau-wajah/demo-media/') || p.startsWith('/sau-wajah/media/') ||
    p.startsWith('/api/sau-wajah/');
  if (!handles) return false;

  try {
    if (req.method === 'POST') { csrf(req, baseUrl); rate(req); }

    if (req.method === 'GET' && p === '/create/' + SLUG) {
      const tpl = q.templateBySlug(SLUG);
      if (!tpl || tpl.status !== 'published') throw new InputError('not_found', 404);
      html(res, sauwajahCreatePage());
      return true;
    }

    if (req.method === 'GET' && p === '/sau-wajah/demo') {
      const data = {
        recipientName: 'Meher', senderName: 'Rahul',
        photos: demoPhotos().slice(0, 4),
      };
      html(res, renderSauWajah({ customer_data: data }, { baseUrl, isPreview: true }));
      return true;
    }

    let m = p.match(/^\/sau-wajah\/preview\/([A-Za-z0-9_-]+)$/);
    if (req.method === 'GET' && m) {
      const pg = q.paigaamById(m[1]);
      if (!pg || pg.template_slug !== SLUG) throw new InputError('not_found', 404);
      if (!isAdmin && !owned(req, pg.id)) throw new InputError('forbidden', 403);
      html(res, renderSauWajah(pg, { baseUrl, isPreview: true }));
      return true;
    }

    m = p.match(/^\/sau-wajah\/uploads\/([a-f0-9]{48}\.(?:jpg|png|webp))$/);
    if (['GET', 'HEAD'].includes(req.method) && m) {
      const row = db.prepare('SELECT paigaam_id FROM sau_wajah_uploads WHERE filename=?').get(m[1]);
      const pub = row && published(row.paigaam_id);
      const visible = pub && (pub.customer_data.photos || []).some(photo => path.basename(photo.url) === m[1]);
      if (!row || (!visible && !isAdmin && !owned(req, row.paigaam_id))) throw new InputError('not_found', 404);
      if (!streamFile(req, res, path.join(uploadDir, m[1]), 'image/' + m[1].split('.').pop(), 'private, max-age=0, must-revalidate')) throw new InputError('not_found', 404);
      return true;
    }

    m = p.match(/^\/sau-wajah\/demo-media\/(demo-[1-6]\.png)$/);
    if (['GET', 'HEAD'].includes(req.method) && m) {
      demoPhotos(); // ensure generated
      if (!streamFile(req, res, path.join(DATA_DIR, 'sau-wajah-demo', m[1]), 'image/png', 'public, max-age=86400')) throw new InputError('not_found', 404);
      return true;
    }

    // The song, boot-healed from base64 into public/sau-wajah/media/.
    m = p.match(/^\/sau-wajah\/media\/(music\.mp3)$/);
    if (['GET', 'HEAD'].includes(req.method) && m) {
      ensureSauWajahMedia();
      if (!streamFile(req, res, path.join(__dirname, '../public/sau-wajah/media', m[1]), 'audio/mpeg', 'public, max-age=3600')) throw new InputError('not_found', 404);
      return true;
    }

    if (req.method === 'POST' && p === '/api/sau-wajah/draft') {
      const body = await jsonBody(req);
      const data = validate(body.customer_data);
      let id = body.id;
      if (id) {
        editable(req, id);
        verifyPhotos(id, data);
        q.paigaamUpdate(id, { customer_data: data, customer_name: data.recipientName });
      } else {
        const tpl = q.templateBySlug(SLUG);
        if (!tpl || tpl.status !== 'published') throw new InputError('not_found', 404);
        if (data.photos.length) throw new InputError(); // references can only come from the upload endpoint
        let hash = owner(req);
        if (!hash) {
          const token = crypto.randomBytes(32).toString('hex');
          hash = crypto.createHash('sha256').update(token).digest('hex');
          res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${new URL(baseUrl).protocol === 'https:' ? '; Secure' : ''}`);
        }
        const count = db.prepare('SELECT COUNT(*) n FROM sau_wajah_owners WHERE owner_hash=? AND created_at>?').get(hash, Date.now() - 86400000).n;
        if (count >= 20) throw new InputError('limit', 429);
        const pg = q.paigaamInsert({ template_id: tpl.id, customer_data: data, customer_name: data.recipientName });
        id = pg.id;
        db.prepare('INSERT INTO sau_wajah_owners VALUES(?,?,?)').run(id, hash, Date.now());
      }
      reply(res, 200, { id, previewUrl: '/sau-wajah/preview/' + id });
      return true;
    }

    if (req.method === 'POST' && p === '/api/sau-wajah/upload') {
      const id = u.searchParams.get('id');
      if (!id) throw new InputError();
      editable(req, id);
      if (inFlight.has(id)) throw new InputError('limit', 429);
      inFlight.add(id);
      try {
        cleanup();
        const count = db.prepare('SELECT COUNT(*) n FROM sau_wajah_uploads WHERE paigaam_id=?').get(id).n;
        if (count >= MAX_PHOTOS) throw new InputError('limit');
        if (db.prepare('SELECT COALESCE(SUM(bytes),0) n FROM sau_wajah_uploads').get().n > 500 * 1024 * 1024) throw new InputError('limit', 507);
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(req.headers['content-type'])) throw new InputError('invalid_image');
        const buffer = await read(req, 2 * 1024 * 1024);
        const sniff = sniffImage(buffer);
        if (!sniff || !sniff.width || !sniff.height || sniff.width < 50 || sniff.height < 50) throw new InputError('invalid_image');
        const filename = crypto.randomBytes(24).toString('hex') + '.' + EXT[req.headers['content-type']];
        fs.writeFileSync(path.join(uploadDir, filename), buffer, { flag: 'wx', mode: 0o600 });
        db.prepare('INSERT INTO sau_wajah_uploads VALUES(?,?,?,?)').run(filename, id, buffer.length, Date.now());
        reply(res, 200, { url: '/sau-wajah/uploads/' + filename });
        return true;
      } finally { inFlight.delete(id); }
    }

    if (req.method === 'POST' && p === '/api/sau-wajah/publish') {
      const { id } = await jsonBody(req);
      const pg = q.paigaamById(id);
      if (!pg || pg.template_slug !== SLUG) throw new InputError('not_found', 404);
      if (!owned(req, id)) throw new InputError('forbidden', 403);
      if (['published', 'active'].includes(pg.status)) { reply(res, 200, { slug: pg.slug, url: baseUrl + '/p/' + pg.slug }); return true; }
      if (pg.status !== 'draft') throw new InputError('forbidden', 403);
      const tpl = q.templateBySlug(SLUG);
      if (!tpl || tpl.status !== 'published' || tpl.price !== 0) throw new InputError('forbidden', 403);
      // Publishing onto a disk that will be wiped hands out links that die.
      const host = new URL(baseUrl).hostname;
      const allowEphemeral = process.env.SAUWAJAH_ALLOW_EPHEMERAL_PUBLISH === '1';
      if (!PERSISTENT && !allowEphemeral && !['localhost', '127.0.0.1', '::1'].includes(host)) throw new InputError('storage_unavailable', 503);
      const data = validate(pg.customer_data);
      verifyPhotos(id, data);
      let slug;
      do { slug = 'sauwajah-' + crypto.randomBytes(9).toString('hex'); } while (q.paigaamSlugTaken(slug));
      q.paigaamUpdate(id, { slug, status: 'published', payment_status: 'paid', published_at: new Date().toISOString() });
      reply(res, 200, { slug, url: baseUrl + '/p/' + slug });
      return true;
    }

    throw new InputError('not_found', 404);
  } catch (e) {
    if (!(e instanceof InputError)) console.error('[sau-wajah]', e.message);
    reply(res, e.status || 500, { error: e.code || 'server_error' });
    return true;
  }
}

module.exports = { handle, owned, sniffImage, demoSample: demoPhotos, SLUG };
