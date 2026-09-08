'use strict';
/**
 * Love Album routes — draft, upload, preview, publish.
 *
 * Same creator-cookie ownership pattern as the other templates, plus the
 * photo pipeline ported from Ganapati Aagman with one deliberate change:
 * sharp is NOT used. The client re-encodes to JPEG via canvas (same as the
 * Ganapati generator); the server validates magic bytes and decodes JPEG
 * SOF / PNG IHDR dimensions itself, then stores the bytes as .webp-named
 * files is a lie — it stores them under the extension they arrive with
 * (.jpg/.png/.webp). Zero native dependencies.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { db, q, DATA_DIR, PERSISTENT } = require('../db');
const { validate, InputError, MIN_PHOTOS, MAX_PHOTOS } = require('../templates/love-album/schema');
const { renderAlbum } = require('../templates/love-album/render');
const { loveCreatePage } = require('../pages/loveCreate');
const { streamFile } = require('./streamFile');

const uploadDir = path.join(DATA_DIR, 'love-uploads');
fs.mkdirSync(uploadDir, { recursive: true });

db.exec(`CREATE TABLE IF NOT EXISTS love_owners (
 paigaam_id TEXT PRIMARY KEY REFERENCES paigaams(id) ON DELETE CASCADE,
 owner_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS love_owner_idx ON love_owners(owner_hash);
CREATE TABLE IF NOT EXISTS love_uploads (
 filename TEXT PRIMARY KEY, paigaam_id TEXT NOT NULL REFERENCES paigaams(id) ON DELETE CASCADE,
 bytes INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS love_upload_inv ON love_uploads(paigaam_id);`);

const SLUG = 'love-album', COOKIE = 'paigaam_creator';
const inFlight = new Set(), rates = new Map();

function owner(req) {
  const raw = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='));
  const value = raw ? raw.slice(COOKIE.length + 1) : '';
  return /^[a-f0-9]{64}$/.test(value) ? crypto.createHash('sha256').update(value).digest('hex') : null;
}
function owned(req, id) {
  const record = db.prepare('SELECT owner_hash FROM love_owners WHERE paigaam_id=?').get(id);
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
    const row = db.prepare('SELECT paigaam_id FROM love_uploads WHERE filename=?').get(path.basename(photo.url));
    if (!row || row.paigaam_id !== id) throw new InputError('forbidden', 403);
  }
}

/** Only unreferenced, old uploads are eligible. Never delete a referenced photo. */
function cleanup() {
  const cutoff = Date.now() - 7 * 86400000;
  for (const row of db.prepare('SELECT * FROM love_uploads WHERE created_at < ?').all(cutoff)) {
    const pg = q.paigaamById(row.paigaam_id);
    if (pg && (pg.customer_data.photos || []).some(p => path.basename(p.url) === row.filename)) continue;
    fs.rmSync(path.join(uploadDir, row.filename), { force: true });
    db.prepare('DELETE FROM love_uploads WHERE filename=?').run(row.filename);
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
      const b = buf[21], bits = (buf[21] | buf[22] << 8 | buf[23] << 16) >> 0;
      const w = (bits & 0x3FFF) + 1, h = ((bits >> 14) & 0x3FFF) + 1;
      return { format: 'image/webp', width: w, height: h };
    }
  }
  return null;
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** A believable album for /love-album/demo and the collection thumbnails. */
function demoPhotos() {
  // Simple flat-colour placeholder JPEGs, generated once at boot — no
  // personal media ships with the template.
  const dir = path.join(DATA_DIR, 'love-demo');
  fs.mkdirSync(dir, { recursive: true });
  const colors = [[255, 209, 220], [248, 193, 255], [227, 215, 255], [255, 228, 196], [214, 236, 255], [255, 214, 214]];
  return colors.map((rgb, index) => {
    const file = `demo-${index + 1}.jpg`;
    const target = path.join(dir, file);
    try { if (fs.statSync(target).size > 0) return { url: '/love-album/demo-media/' + file, alt: `A demo memory · ${index + 1}` }; } catch { /* regenerate */ }
    fs.writeFileSync(target, tinyJPEG(rgb[0], rgb[1], rgb[2]));
    return { url: '/love-album/demo-media/' + file, alt: `A demo memory · ${index + 1}` };
  }).slice(0, 6);
}

/** A minimal valid baseline-JPEG (8x8, solid colour) — no encoder needed. */
function tinyJPEG(r, g, b) {
  const luminance = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  const qtables = [luminance]; // flat table
  const chunks = [];
  const be16 = v => [v >> 8 & 0xFF, v & 0xFF];
  chunks.push([0xFF, 0xD8]); // SOI
  chunks.push([0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]); // JFIF APP0
  chunks.push([0xFF, 0xDB, 0x00, 0x43, 0x00, ...Array.from({ length: 64 }, () => 0x10)]); // DQT
  chunks.push([0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x08, 0x00, 0x08, 0x01, 0x01, 0x11, 0x00]); // SOF0 8x8
  chunks.push([0xFF, 0xC4, 0x00, 0x14, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]); // DHT
  chunks.push([0xFF, 0xC4, 0x00, 0x14, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]); // DHT
  chunks.push([0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00]); // SOS
  chunks.push([0x3F, 0x00]); // fake minimal scan (all-zero DC, EOB)
  chunks.push([0xFF, 0xD9]); // EOI
  return Buffer.concat(chunks.map(c => Buffer.from(c)));
}

async function handle(req, res, u, { baseUrl, isAdmin = false } = {}) {
  const p = u.pathname.replace(/\/+$/, '') || '/';

  const handles = p === '/create/' + SLUG || p === '/love-album/demo' ||
    p.startsWith('/love-album/preview/') || p.startsWith('/love-album/uploads/') ||
    p.startsWith('/love-album/demo-media/') || p.startsWith('/api/love-album/');
  if (!handles) return false;

  try {
    if (req.method === 'POST') { csrf(req, baseUrl); rate(req); }

    if (req.method === 'GET' && p === '/create/' + SLUG) {
      const tpl = q.templateBySlug(SLUG);
      if (!tpl || tpl.status !== 'published') throw new InputError('not_found', 404);
      html(res, loveCreatePage());
      return true;
    }

    if (req.method === 'GET' && p === '/love-album/demo') {
      const data = {
        recipientName: 'Meher', senderName: 'Rahul',
        photos: demoPhotos(),
      };
      html(res, renderAlbum({ customer_data: data }, { baseUrl, isPreview: true }));
      return true;
    }

    let m = p.match(/^\/love-album\/preview\/([A-Za-z0-9_-]+)$/);
    if (req.method === 'GET' && m) {
      const pg = q.paigaamById(m[1]);
      if (!pg || pg.template_slug !== SLUG) throw new InputError('not_found', 404);
      if (!isAdmin && !owned(req, pg.id)) throw new InputError('forbidden', 403);
      html(res, renderAlbum(pg, { baseUrl, isPreview: true }));
      return true;
    }

    m = p.match(/^\/love-album\/uploads\/([a-f0-9]{48}\.(?:jpg|png|webp))$/);
    if (['GET', 'HEAD'].includes(req.method) && m) {
      const row = db.prepare('SELECT paigaam_id FROM love_uploads WHERE filename=?').get(m[1]);
      const pub = row && published(row.paigaam_id);
      const visible = pub && (pub.customer_data.photos || []).some(photo => path.basename(photo.url) === m[1]);
      if (!row || (!visible && !isAdmin && !owned(req, row.paigaam_id))) throw new InputError('not_found', 404);
      if (!streamFile(req, res, path.join(uploadDir, m[1]), 'image/' + m[1].split('.').pop(), 'private, max-age=0, must-revalidate')) throw new InputError('not_found', 404);
      return true;
    }

    m = p.match(/^\/love-album\/demo-media\/(demo-[1-6]\.jpg)$/);
    if (['GET', 'HEAD'].includes(req.method) && m) {
      demoPhotos(); // ensure generated
      if (!streamFile(req, res, path.join(DATA_DIR, 'love-demo', m[1]), 'image/jpeg', 'public, max-age=86400')) throw new InputError('not_found', 404);
      return true;
    }

    if (req.method === 'POST' && p === '/api/love-album/draft') {
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
        const count = db.prepare('SELECT COUNT(*) n FROM love_owners WHERE owner_hash=? AND created_at>?').get(hash, Date.now() - 86400000).n;
        if (count >= 20) throw new InputError('limit', 429);
        const pg = q.paigaamInsert({ template_id: tpl.id, customer_data: data, customer_name: data.recipientName });
        id = pg.id;
        db.prepare('INSERT INTO love_owners VALUES(?,?,?)').run(id, hash, Date.now());
      }
      reply(res, 200, { id, previewUrl: '/love-album/preview/' + id });
      return true;
    }

    if (req.method === 'POST' && p === '/api/love-album/upload') {
      const id = u.searchParams.get('id');
      if (!id) throw new InputError();
      editable(req, id);
      if (inFlight.has(id)) throw new InputError('limit', 429);
      inFlight.add(id);
      try {
        cleanup();
        const count = db.prepare('SELECT COUNT(*) n FROM love_uploads WHERE paigaam_id=?').get(id).n;
        if (count >= MAX_PHOTOS) throw new InputError('limit');
        if (db.prepare('SELECT COALESCE(SUM(bytes),0) n FROM love_uploads').get().n > 500 * 1024 * 1024) throw new InputError('limit', 507);
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(req.headers['content-type'])) throw new InputError('invalid_image');
        const buffer = await read(req, 2 * 1024 * 1024);
        const sniff = sniffImage(buffer);
        if (!sniff || !sniff.width || !sniff.height || sniff.width < 50 || sniff.height < 50) throw new InputError('invalid_image');
        const filename = crypto.randomBytes(24).toString('hex') + '.' + EXT[req.headers['content-type']];
        fs.writeFileSync(path.join(uploadDir, filename), buffer, { flag: 'wx', mode: 0o600 });
        db.prepare('INSERT INTO love_uploads VALUES(?,?,?,?)').run(filename, id, buffer.length, Date.now());
        reply(res, 200, { url: '/love-album/uploads/' + filename });
        return true;
      } finally { inFlight.delete(id); }
    }

    if (req.method === 'POST' && p === '/api/love-album/publish') {
      const { id } = await jsonBody(req);
      const pg = q.paigaamById(id);
      if (!pg || pg.template_slug !== SLUG) throw new InputError('not_found', 404);
      if (!owned(req, id)) throw new InputError('forbidden', 403);
      if (['published', 'active'].includes(pg.status)) { reply(res, 200, { slug: pg.slug, url: baseUrl + '/p/' + pg.slug }); return true; }
      if (pg.status !== 'draft') throw new InputError('forbidden', 403);
      const tpl = q.templateBySlug(SLUG);
      if (!tpl || tpl.status !== 'published' || tpl.price !== 0) throw new InputError('forbidden', 403);
      const host = new URL(baseUrl).hostname;
      const allowEphemeral = process.env.LOVE_ALLOW_EPHEMERAL_PUBLISH === '1';
      if (!PERSISTENT && !allowEphemeral && !['localhost', '127.0.0.1', '::1'].includes(host)) throw new InputError('storage_unavailable', 503);
      const data = validate(pg.customer_data);
      verifyPhotos(id, data);
      // The gallery IS the photos — publishing without them hands out an empty album.
      if (data.photos.length < MIN_PHOTOS) throw new InputError('too_few_photos', 400);
      let slug;
      do { slug = 'love-' + crypto.randomBytes(9).toString('hex'); } while (q.paigaamSlugTaken(slug));
      q.paigaamUpdate(id, { slug, status: 'published', payment_status: 'paid', published_at: new Date().toISOString() });
      reply(res, 200, { slug, url: baseUrl + '/p/' + slug });
      return true;
    }

    throw new InputError('not_found', 404);
  } catch (e) {
    if (!(e instanceof InputError)) console.error('[love-album]', e.message);
    reply(res, e.status || 500, { error: e.code || 'server_error' });
    return true;
  }
}

module.exports = { handle, owned, sniffImage, demoSample: demoPhotos, SLUG };
