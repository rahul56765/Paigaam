'use strict';
/**
 * Birthday Paigaam routes.
 *
 *   GET  /create/birthday-paigaam                  the wizard
 *   GET  /birthday-paigaam/demo[?skip=1&screen=x]  public demo (sample surprise)
 *   POST /birthday-paigaam/preview-frame           stateless live preview { customer_data, screen }
 *   GET  /birthday-paigaam/preview/:id[?screen=x]  owner-only preview (passcode skipped)
 *   GET  /birthday-paigaam/media/<file>            an upload: public once its page is published,
 *                                                  otherwise owner/admin only
 *   POST /api/birthday-paigaam/draft               create / update a draft (creator cookie)
 *   POST /api/birthday-paigaam/upload?id=&kind=    photo | voice | song (raw body)
 *   POST /api/birthday-paigaam/publish             free, instant → /p/birthday-paigaam-<18 hex>
 *
 * State (additive): bp_owners (paigaam → creator hash), bp_uploads (file → paigaam),
 * files in DATA_DIR/birthday-paigaam-uploads/. Uploads are sniffed by their bytes —
 * the declared type is never trusted. Ephemeral-storage guard as Saalgirah:
 * BIRTHDAY_PAIGAAM_ALLOW_EPHEMERAL_PUBLISH=1 to override.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { db, q, DATA_DIR, PERSISTENT } = require('../db');
const { validate, mediaIn, InputError } = require('../templates/birthday-paigaam/schema');
const { renderBirthday } = require('../templates/birthday-paigaam/render');
const { checkImage } = require('./bfday/image');
const { streamFile } = require('./streamFile');

const SLUG = 'birthday-paigaam';
const COOKIE = 'paigaam_creator';
const uploadDir = path.join(DATA_DIR, 'birthday-paigaam-uploads');
fs.mkdirSync(uploadDir, { recursive: true });

db.exec(`CREATE TABLE IF NOT EXISTS bp_owners (
 paigaam_id TEXT PRIMARY KEY REFERENCES paigaams(id) ON DELETE CASCADE,
 owner_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS bp_owner_idx ON bp_owners(owner_hash);
CREATE TABLE IF NOT EXISTS bp_uploads (
 filename TEXT PRIMARY KEY, paigaam_id TEXT NOT NULL REFERENCES paigaams(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, mime TEXT NOT NULL, bytes INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS bp_upload_inv ON bp_uploads(paigaam_id);`);

const LIMITS = { photo: 2 * 1024 * 1024, voice: 10 * 1024 * 1024, song: 15 * 1024 * 1024 };
const PER_DRAFT = { photo: 60, voice: 8, song: 8 };
const POOL_BYTES = (Number(process.env.BP_UPLOAD_POOL_MB) || 2048) * 1024 * 1024;
const DRAFTS_PER_DAY = 20;
const LOCAL = ['localhost', '127.0.0.1', '::1'];
const IMAGE_MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const AUDIO_MIME = { mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', webm: 'audio/webm', wav: 'audio/wav', aac: 'audio/aac' };
const rates = new Map();

/* ------------------------------------------------------------ helpers */
function owner(req) {
  const raw = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='));
  const value = raw ? raw.slice(COOKIE.length + 1) : '';
  return /^[a-f0-9]{64}$/.test(value) ? crypto.createHash('sha256').update(value).digest('hex') : null;
}
function owned(req, id) {
  const row = db.prepare('SELECT owner_hash FROM bp_owners WHERE paigaam_id=?').get(id);
  return !!row && row.owner_hash === owner(req);
}
function editable(req, id) {
  const pg = q.paigaamById(id);
  if (!pg || pg.template_slug !== SLUG) throw new InputError('not_found', 404);
  if (!owned(req, id)) throw new InputError('forbidden', 403);
  if (!(pg.status === 'draft' || pg.status === 'payment_pending')) throw new InputError('forbidden', 403);
  return pg;
}
function reply(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}
function html(res, body, cache = 'private, no-store') {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cache,
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
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
async function jsonBody(req, limit = 98304) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new InputError();
  try { return JSON.parse((await read(req, limit)).toString('utf8')); }
  catch (e) { if (e instanceof InputError) throw e; throw new InputError(); }
}
function csrf(req, base) {
  const origin = req.headers.origin;
  if (req.headers['sec-fetch-site'] === 'cross-site' || (origin && origin !== new URL(base).origin)) throw new InputError('forbidden', 403);
}
function rate(req, weight = 1) {
  const now = Date.now(), key = req.socket.remoteAddress || 'unknown';
  if (rates.size > 5000) rates.clear();
  let r = rates.get(key);
  if (!r || r.until < now) r = { count: 0, until: now + 600000 };
  r.count += weight; rates.set(key, r);
  if (r.count > 400) throw new InputError('limit', 429);
}

/** Audio by its bytes → extension, or null. */
function sniffAudio(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 16) return null;
  if (buf.toString('ascii', 0, 3) === 'ID3') return 'mp3';
  if (buf[0] === 0xFF && (buf[1] & 0xF6) === 0xF0) return 'aac';
  if (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) return 'mp3';
  if (buf.toString('ascii', 4, 8) === 'ftyp') return 'm4a';
  if (buf.toString('ascii', 0, 4) === 'OggS') return 'ogg';
  if (buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) return 'webm';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE') return 'wav';
  return null;
}

/** Every referenced upload must belong to this draft. */
function assertOwnMedia(clean, id) {
  for (const url of mediaIn(clean)) {
    const row = db.prepare('SELECT paigaam_id FROM bp_uploads WHERE filename=?').get(path.basename(url));
    if (!row || row.paigaam_id !== id) throw new InputError('validation');
  }
}
function removeUpload(filename) {
  fs.rmSync(path.join(uploadDir, filename), { force: true });
  db.prepare('DELETE FROM bp_uploads WHERE filename=?').run(filename);
}
/** Drop this paigaam's uploads that its data no longer points at (older than minAgeMs). */
function sweep(id, clean, minAgeMs) {
  const keep = new Set(mediaIn(clean).map(u => path.basename(u)));
  const cutoff = Date.now() - minAgeMs;
  for (const row of db.prepare('SELECT filename, created_at FROM bp_uploads WHERE paigaam_id=?').all(id)) {
    if (!keep.has(row.filename) && row.created_at < cutoff) removeUpload(row.filename);
  }
}
/** Files on disk with no row (a deleted paigaam cascades its rows, not its files). */
function sweepOrphans() {
  try {
    for (const f of fs.readdirSync(uploadDir)) {
      if (!db.prepare('SELECT 1 FROM bp_uploads WHERE filename=?').get(f)) fs.rmSync(path.join(uploadDir, f), { force: true });
    }
  } catch (e) { console.error('[birthday-paigaam] orphan sweep:', e.message); }
}
sweepOrphans();
setInterval(sweepOrphans, 6 * 3600 * 1000).unref();

/* ---------------------------------------------------------------- demo */
const D = require('../templates/birthday-paigaam/defaults');
const DEMO = {
  recipientName: 'Meher',
  senderName: 'Rahul',
  age: '24',
  birthdayDate: '',
  whatsapp: '',
  passcode: '1234',
  passcodeHint: 'Psst… it’s 1 2 3 4',
  photos: D.DEMO_PHOTOS,
};

function render(pg, baseUrl, opts) { return renderBirthday(pg, Object.assign({ baseUrl }, opts)); }

/* -------------------------------------------------------------- routes */
async function handle(req, res, u, { baseUrl, isAdmin = false } = {}) {
  const p = u.pathname.replace(/\/+$/, '') || '/';
  const handles = p === '/create/' + SLUG || p === '/' + SLUG + '/demo' || p === '/' + SLUG + '/preview-frame' ||
    p.startsWith('/' + SLUG + '/preview/') || p.startsWith('/' + SLUG + '/media/') || p.startsWith('/api/' + SLUG + '/');
  if (!handles) return false;

  try {
    if (req.method === 'POST') { csrf(req, baseUrl); rate(req, p.endsWith('/upload') ? 2 : 1); }
    const screen = (u.searchParams.get('screen') || '').replace(/[^a-z]/g, '') || null;

    if (req.method === 'GET' && p === '/create/' + SLUG) {
      const tpl = q.templateBySlug(SLUG);
      if (!tpl || tpl.status !== 'published') throw new InputError('not_found', 404);
      const resumeDraft = q.recentDraftForOwner('bp_owners', owner(req), tpl.id, 3600000);
      const { birthdayPaigaamCreatePage } = require('../pages/birthdayPaigaamCreate');
      html(res, birthdayPaigaamCreatePage({ price: Number(tpl.price) || 0, listPrice: Number(tpl.list_price) || 0, resumeDraft }));
      return true;
    }

    if (req.method === 'GET' && p === '/' + SLUG + '/demo') {
      html(res, render({ id: 'demo', customer_data: DEMO }, baseUrl, { mode: 'demo', start: screen, skipLock: u.searchParams.get('skip') === '1' }), 'public, max-age=300');
      return true;
    }

    if (req.method === 'POST' && p === '/' + SLUG + '/preview-frame') {
      const body = await jsonBody(req);
      let clean;
      try { clean = validate(body.customer_data || {}); } catch { clean = validate({}); }
      // Only this browser's own uploads appear in its preview.
      const pid = typeof body.id === 'string' ? body.id : '';
      const mine = pid && owned(req, pid);
      const allowed = url => { const row = db.prepare('SELECT paigaam_id FROM bp_uploads WHERE filename=?').get(path.basename(url)); return !!(mine && row && row.paigaam_id === pid); };
      if (clean.mainPhoto && !allowed(clean.mainPhoto)) clean.mainPhoto = '';
      if (clean.voiceUrl && !allowed(clean.voiceUrl)) clean.voiceUrl = '';
      if (clean.songUrl && !allowed(clean.songUrl)) clean.songUrl = '';
      clean.photos = clean.photos.filter(ph => allowed(ph.url));
      const s = typeof body.screen === 'string' ? body.screen.replace(/[^a-z]/g, '') : null;
      html(res, render({ id: pid || 'live', customer_data: clean }, baseUrl, { mode: 'live', start: s || 'question', skipLock: true }));
      return true;
    }

    let m = p.match(/^\/birthday-paigaam\/preview\/([A-Za-z0-9_-]+)$/);
    if (req.method === 'GET' && m) {
      const pg = q.paigaamById(m[1]);
      if (!pg || pg.template_slug !== SLUG) throw new InputError('not_found', 404);
      if (!isAdmin && !owned(req, pg.id)) throw new InputError('forbidden', 403);
      html(res, render(pg, baseUrl, { mode: 'preview', start: screen, skipLock: u.searchParams.get('lock') !== '1' }));
      return true;
    }

    m = p.match(/^\/birthday-paigaam\/media\/([a-f0-9]{48}\.(jpg|png|webp|mp3|m4a|ogg|webm|wav|aac))$/);
    if ((req.method === 'GET' || req.method === 'HEAD') && m) {
      const row = db.prepare('SELECT * FROM bp_uploads WHERE filename=?').get(m[1]);
      if (!row) throw new InputError('not_found', 404);
      const pg = q.paigaamById(row.paigaam_id);
      const isPublic = !!pg && ['published', 'active'].includes(pg.status);
      if (!isPublic && !isAdmin && !owned(req, row.paigaam_id)) throw new InputError('not_found', 404);
      if (!streamFile(req, res, path.join(uploadDir, row.filename), row.mime, isPublic ? 'public, max-age=86400' : 'private, no-store')) throw new InputError('not_found', 404);
      return true;
    }

    if (req.method === 'POST' && p === '/api/' + SLUG + '/draft') {
      const body = await jsonBody(req);
      const data = validate(body.customer_data);
      let id = body.id;
      if (id) {
        editable(req, id);
        assertOwnMedia(data, id);
        q.paigaamUpdate(id, { customer_data: data, customer_name: data.recipientName || 'Birthday surprise' });
        sweep(id, data, 30 * 60 * 1000);
      } else {
        if (mediaIn(data).length) throw new InputError('validation');
        const tpl = q.templateBySlug(SLUG);
        if (!tpl || tpl.status !== 'published') throw new InputError('not_found', 404);
        let hash = owner(req);
        if (!hash) {
          const token = crypto.randomBytes(32).toString('hex');
          hash = crypto.createHash('sha256').update(token).digest('hex');
          res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${new URL(baseUrl).protocol === 'https:' ? '; Secure' : ''}`);
        }
        const count = db.prepare('SELECT COUNT(*) n FROM bp_owners WHERE owner_hash=? AND created_at>?').get(hash, Date.now() - 86400000).n;
        if (count >= DRAFTS_PER_DAY) throw new InputError('limit', 429);
        const pg = q.paigaamInsert({ template_id: tpl.id, customer_data: data, customer_name: data.recipientName || 'Birthday surprise' });
        id = pg.id;
        db.prepare('INSERT INTO bp_owners VALUES(?,?,?)').run(id, hash, Date.now());
      }
      reply(res, 200, { id, previewUrl: '/' + SLUG + '/preview/' + id });
      return true;
    }

    if (req.method === 'POST' && p === '/api/' + SLUG + '/upload') {
      const id = u.searchParams.get('id') || '';
      const kind = u.searchParams.get('kind') || '';
      if (!LIMITS[kind]) throw new InputError('validation');
      editable(req, id);
      const n = db.prepare('SELECT COUNT(*) n FROM bp_uploads WHERE paigaam_id=? AND kind=?').get(id, kind).n;
      if (n >= PER_DRAFT[kind]) throw new InputError('limit', 429);
      if (db.prepare('SELECT COALESCE(SUM(bytes),0) n FROM bp_uploads').get().n > POOL_BYTES) throw new InputError('storage_full', 507);
      const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const buffer = await read(req, LIMITS[kind]);
      if (!buffer.length) throw new InputError('validation');
      let ext, mime;
      if (kind === 'photo') {
        const bad = checkImage(buffer, type);
        if (bad) throw new InputError(bad === 'too_large' ? 'too_large' : 'invalid_image', bad === 'too_large' ? 413 : 400);
        ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type]; mime = IMAGE_MIME[ext];
      } else {
        if (!/^(audio\/|video\/(mp4|webm|ogg)$|application\/octet-stream$)/.test(type)) throw new InputError('invalid_audio');
        ext = sniffAudio(buffer);
        if (!ext) throw new InputError('invalid_audio');
        mime = AUDIO_MIME[ext];
      }
      const filename = crypto.randomBytes(24).toString('hex') + '.' + ext;
      fs.writeFileSync(path.join(uploadDir, filename), buffer, { flag: 'wx', mode: 0o600 });
      db.prepare('INSERT INTO bp_uploads VALUES(?,?,?,?,?,?)').run(filename, id, kind, mime, buffer.length, Date.now());
      reply(res, 200, { url: '/' + SLUG + '/media/' + filename, kind, bytes: buffer.length });
      return true;
    }

    if (req.method === 'POST' && p === '/api/' + SLUG + '/publish') {
      const { id } = await jsonBody(req);
      const pg = q.paigaamById(id);
      if (!pg || pg.template_slug !== SLUG) throw new InputError('not_found', 404);
      if (!owned(req, id)) throw new InputError('forbidden', 403);
      if (['published', 'active'].includes(pg.status)) { reply(res, 200, { slug: pg.slug, url: baseUrl + '/p/' + pg.slug }); return true; }
      if (!(pg.status === 'draft' || pg.status === 'payment_pending')) throw new InputError('forbidden', 403);
      const tpl = q.templateBySlug(SLUG);
      if (!tpl || tpl.status !== 'published') throw new InputError('forbidden', 403);
      const clean = validate(pg.customer_data, { publish: true });
      assertOwnMedia(clean, id);
      if (Number(tpl.price) > 0) {
        // Priced by the owner in Admin → inline Razorpay checkout, same as every bespoke template.
        const razorpay = require('./razorpay');
        if (!razorpay.ENABLED) throw new InputError('payments_offline', 503);
        const settings = q.settings();
        let order;
        try { order = await razorpay.createOrder(pg, settings); }
        catch (e) { console.error('[razorpay] order create failed:', e.message); throw new InputError('gateway_unreachable', 502); }
        if (!q.ordersAll().find(o => o.paigaam_id === id && o.razorpay_order_id === order.id)) q.orderInsert({ paigaam_id: id, customer_name: pg.customer_name, whatsapp: '', amount: pg.template_price, currency: pg.template_currency || settings.currency || 'INR', razorpay_order_id: order.id });
        if (pg.status === 'draft') q.paigaamUpdate(id, { status: 'payment_pending' });
        reply(res, 200, { razorpay: true, keyId: razorpay.KEY_ID, orderId: order.id, amount: Number(pg.template_price) * 100, currency: pg.template_currency || settings.currency || 'INR', name: settings.business_name || 'Paigaam', description: pg.template_name || tpl.name, prefillName: pg.customer_name || '' });
        return true;
      }
      const host = new URL(baseUrl).hostname;
      if (!PERSISTENT && process.env.BIRTHDAY_PAIGAAM_ALLOW_EPHEMERAL_PUBLISH !== '1' && !LOCAL.includes(host)) throw new InputError('storage_unavailable', 503);
      sweep(id, clean, 0);
      let slug;
      do { slug = SLUG + '-' + crypto.randomBytes(9).toString('hex'); } while (q.paigaamSlugTaken(slug));
      q.paigaamUpdate(id, { slug, status: 'published', payment_status: 'paid', published_at: new Date().toISOString() });
      reply(res, 200, { slug, url: baseUrl + '/p/' + slug });
      return true;
    }

    throw new InputError('not_found', 404);
  } catch (e) {
    if (!(e instanceof InputError)) console.error('[birthday-paigaam]', e.message);
    if (req.method === 'GET' && (e.status === 404 || e.status === 403) && !p.startsWith('/api/') && !p.startsWith('/' + SLUG + '/media/')) {
      res.writeHead(e.status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('<!doctype html><meta charset="utf-8"><title>Not here</title><p style="font:18px system-ui;padding:40px;text-align:center">This surprise has wandered away. <a href="/templates">Back to Paigaam</a></p>');
      return true;
    }
    reply(res, e.status || 500, { error: e.code || 'server_error' });
    return true;
  }
}

/** Gallery-card miniature: the demo, playing itself. */
function renderThumb(baseUrl) { return renderBirthday({ id: 'demo', customer_data: DEMO }, { baseUrl, mode: 'thumb' }); }

module.exports = { handle, owned, SLUG, DEMO, renderThumb, sniffAudio };
