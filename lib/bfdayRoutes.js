'use strict';
/**
 * Boyfriend Day family routes — one module for every template registered in
 * templates/bfday.js.
 *
 * Same model as Maafi / Sau Wajah, generalised over the family:
 *   GET  /create/<slug>                 the generated personalisation wizard
 *   GET  /<slug>/demo                   config.demo, rendered as a preview
 *   GET  /<slug>/preview-frame?d=<json> stateless live preview (small data)
 *   POST /<slug>/preview-frame          stateless live preview, JSON body
 *                                       { customer_data } — what the wizard uses
 *                                       (long letters overflow a URL)
 *   GET  /<slug>/preview/:id            owner-only draft preview
 *   POST /api/<slug>/draft              create / update a draft (creator cookie)
 *   POST /api/<slug>/upload?id=<draft>  one photo (image/jpeg|png|webp body)
 *   POST /api/<slug>/publish            free, instant → /p/<slug>-<18 hex>
 *   GET  /bfday/uploads/<file>          a photo: public once referenced by a
 *                                       published page, otherwise owner/admin only
 *
 * State owned by the family (additive, shared by every member):
 *   bfday_owners   paigaam_id → creator hash
 *   bfday_uploads  filename → paigaam_id
 *   DATA_DIR/bfday-uploads/
 *
 * Ephemeral-storage guard: BFDAY_ALLOW_EPHEMERAL_PUBLISH=1 (matches Maafi's).
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { db, q, DATA_DIR, PERSISTENT } = require('../db');
const family = require('./bfday/family');
const { imagesIn, maxImages, InputError } = require('./bfday/fields');
const { checkImage, EXT } = require('./bfday/image');
const { streamFile } = require('./streamFile');
const { bfdayCreatePage } = require('../pages/bfdayCreate');

// Share cards and the wax seal ship as data (lib/bfday/assets.js); heal them into public/.
const healedAssets = require('./bfday/assets').ensureFamilyAssets();
if (healedAssets.length) console.log('[bfday] wrote assets: ' + healedAssets.join(', '));

const uploadDir = path.join(DATA_DIR, 'bfday-uploads');
fs.mkdirSync(uploadDir, { recursive: true });

// Additive tables: nothing existing is touched.
db.exec(`CREATE TABLE IF NOT EXISTS bfday_owners (
 paigaam_id TEXT PRIMARY KEY REFERENCES paigaams(id) ON DELETE CASCADE,
 owner_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS bfday_owner_idx ON bfday_owners(owner_hash);
CREATE TABLE IF NOT EXISTS bfday_uploads (
 filename TEXT PRIMARY KEY, paigaam_id TEXT NOT NULL REFERENCES paigaams(id) ON DELETE CASCADE,
 bytes INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS bfday_upload_inv ON bfday_uploads(paigaam_id);`);

const COOKIE = 'paigaam_creator';
const DRAFTS_PER_DAY = 20;             // per creator, per template (Maafi's number)
const UPLOAD_POOL_BYTES = 500 * 1024 * 1024;
const JSON_LIMIT = 65536;
const LOCAL = ['localhost', '127.0.0.1', '::1'];
const rates = new Map(), previewRates = new Map(), inFlight = new Set();

/* ------------------------------------------------------------ plumbing */

function owner(req) {
  const raw = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='));
  const value = raw ? raw.slice(COOKIE.length + 1) : '';
  return /^[a-f0-9]{64}$/.test(value) ? crypto.createHash('sha256').update(value).digest('hex') : null;
}

/** Does this request's creator cookie own paigaam `id`? (Any family member.) */
function owned(req, id) {
  const record = db.prepare('SELECT owner_hash FROM bfday_owners WHERE paigaam_id=?').get(String(id || ''));
  const mine = owner(req);
  return !!record && !!mine && record.owner_hash === mine;
}

function draftFor(req, slug, id) {
  if (typeof id !== 'string' || !id) throw new InputError('not_found', 404);
  const pg = q.paigaamById(id);
  if (!pg || pg.template_slug !== slug) throw new InputError('not_found', 404);
  if (!owned(req, id)) throw new InputError('forbidden', 403);
  if (pg.status !== 'draft') throw new InputError('forbidden', 403);
  return pg;
}

function reply(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}

function html(res, body) {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store',
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

async function jsonBody(req) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new InputError();
  let body;
  try { body = JSON.parse((await read(req, JSON_LIMIT)).toString('utf8')); }
  catch (e) { if (e instanceof InputError) throw e; throw new InputError(); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InputError();
  return body;
}

function csrf(req, base) {
  const origin = req.headers.origin;
  if (req.headers['sec-fetch-site'] === 'cross-site' || (origin && origin !== new URL(base).origin)) throw new InputError('forbidden', 403);
}

/** Per (IP, template) — each family member gets Maafi's budget, as if it had its own module. */
function limit(map, req, max, scope = '') {
  const now = Date.now(), key = (req.socket.remoteAddress || 'unknown') + '|' + scope;
  if (map.size > 5000) map.clear();
  let r = map.get(key);
  if (!r || r.until < now) r = { count: 0, until: now + 600000 };
  r.count++; map.set(key, r);
  if (r.count > max) throw new InputError('limit', 429);
}

function publishedTemplate(slug) {
  const tpl = q.templateBySlug(slug);
  if (!tpl || tpl.status !== 'published') throw new InputError('not_found', 404);
  return tpl;
}

/* -------------------------------------------------------------- uploads */

/** Every photo a draft references must be an upload made for that draft. */
function verifyImages(t, id, data) {
  for (const url of imagesIn(t.fields, data)) {
    const row = db.prepare('SELECT paigaam_id FROM bfday_uploads WHERE filename=?').get(path.basename(url));
    if (!row || row.paigaam_id !== id) throw new InputError('forbidden', 403);
  }
}

function referenced(pg, filename) {
  const t = family.bySlug(pg.template_slug);
  return !!t && imagesIn(t.fields, pg.customer_data).some(url => path.basename(url) === filename);
}

function removeUpload(filename) {
  fs.rmSync(path.join(uploadDir, filename), { force: true });
  db.prepare('DELETE FROM bfday_uploads WHERE filename=?').run(filename);
}

/** Old, unreferenced uploads (abandoned drafts, replaced photos) are swept. Never a referenced one. */
function sweep() {
  const cutoff = Date.now() - 7 * 86400000;
  for (const row of db.prepare('SELECT * FROM bfday_uploads WHERE created_at < ? LIMIT 200').all(cutoff)) {
    const pg = q.paigaamById(row.paigaam_id);
    if (pg && referenced(pg, row.filename)) continue;
    removeUpload(row.filename);
  }
}

/* --------------------------------------------------------------- render */

function renderSafe(t, paigaam, opts) {
  return t.render(paigaam, opts);
}

function previewData(t, raw) {
  // Best effort: whatever the sender has typed, cleaned; never an error.
  try { return t.schema.validate(raw, { mode: 'lenient' }); }
  catch { return { templateVersion: t.config.version || 1 }; }
}

/* --------------------------------------------------------------- router */

function claims(p) {
  if (p.startsWith('/bfday/uploads/')) return { upload: true };
  let m = p.match(/^\/create\/([a-z0-9-]+)$/);
  if (m && family.has(m[1])) return { t: family.bySlug(m[1]) };
  m = p.match(/^\/api\/([a-z0-9-]+)\//);
  if (m && family.has(m[1])) return { t: family.bySlug(m[1]) };
  m = p.match(/^\/([a-z0-9-]+)\/(?:demo|preview-frame|preview\/[^/]*)$/);
  if (m && family.has(m[1])) return { t: family.bySlug(m[1]) };
  return null;
}

async function handle(req, res, u, { baseUrl, isAdmin = false } = {}) {
  const p = u.pathname.replace(/\/+$/, '') || '/';
  const claim = claims(p);
  if (!claim) return false;

  const t = claim.t;
  const tag = t ? t.slug : 'bfday';
  try {
    /* ---------------------------------------------------- photos */
    if (claim.upload) {
      const m = p.match(/^\/bfday\/uploads\/([a-f0-9]{48}\.(?:jpg|png|webp))$/);
      if (!m || !['GET', 'HEAD'].includes(req.method)) throw new InputError('not_found', 404);
      const row = db.prepare('SELECT paigaam_id FROM bfday_uploads WHERE filename=?').get(m[1]);
      const pg = row && q.paigaamById(row.paigaam_id);
      if (!pg) throw new InputError('not_found', 404);
      const isPublic = ['published', 'active'].includes(pg.status) && referenced(pg, m[1]);
      if (!isPublic && !isAdmin && !owned(req, pg.id)) throw new InputError('not_found', 404);
      const type = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[m[1].split('.').pop()];
      if (!streamFile(req, res, path.join(uploadDir, m[1]), type, isPublic ? 'private, max-age=0, must-revalidate' : 'private, no-store')) throw new InputError('not_found', 404);
      return true;
    }

    const S = t.slug;
    if (req.method === 'POST') {
      csrf(req, baseUrl);
      if (p === `/${S}/preview-frame`) limit(previewRates, req, 900, S); else limit(rates, req, 240, S);
    }

    if (req.method === 'GET' && p === '/create/' + S) {
      publishedTemplate(S);
      html(res, bfdayCreatePage(t));
      return true;
    }

    if (req.method === 'GET' && p === `/${S}/demo`) {
      html(res, renderSafe(t, { customer_data: t.config.demo }, { baseUrl, isPreview: true }));
      return true;
    }

    // Stateless live preview: nothing saved, nothing stored, defaults for anything unusable.
    if (p === `/${S}/preview-frame` && (req.method === 'GET' || req.method === 'POST')) {
      let raw = {};
      if (req.method === 'GET') {
        limit(previewRates, req, 900, S);
        try { raw = JSON.parse(u.searchParams.get('d') || '{}') || {}; } catch { /* defaults hold */ }
      } else {
        const body = await jsonBody(req);
        raw = body.customer_data;
      }
      html(res, renderSafe(t, { customer_data: previewData(t, raw) }, { baseUrl, isPreview: true }));
      return true;
    }

    let m = p.match(new RegExp(`^/${S}/preview/([A-Za-z0-9_-]+)$`));
    if (req.method === 'GET' && m) {
      const pg = q.paigaamById(m[1]);
      if (!pg || pg.template_slug !== S) throw new InputError('not_found', 404);
      if (!isAdmin && !owned(req, pg.id)) throw new InputError('forbidden', 403);
      html(res, renderSafe(t, pg, { baseUrl, isPreview: true }));
      return true;
    }

    if (req.method === 'POST' && p === `/api/${S}/draft`) {
      const body = await jsonBody(req);
      const data = t.schema.validate(body.customer_data, { mode: 'draft' });
      const name = family.displayName(S, data);
      let id = body.id;
      if (id !== undefined && id !== null && id !== '') {
        draftFor(req, S, id);
        verifyImages(t, id, data);
        q.paigaamUpdate(id, { customer_data: data, customer_name: name });
      } else {
        const tpl = publishedTemplate(S);
        // Photo references can only come from the upload endpoint, which needs a draft first.
        if (imagesIn(t.fields, data).length) throw new InputError();
        let hash = owner(req);
        if (!hash) {
          const token = crypto.randomBytes(32).toString('hex');
          hash = crypto.createHash('sha256').update(token).digest('hex');
          res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${new URL(baseUrl).protocol === 'https:' ? '; Secure' : ''}`);
        }
        const count = db.prepare(`SELECT COUNT(*) n FROM bfday_owners o JOIN paigaams p ON p.id=o.paigaam_id
          WHERE o.owner_hash=? AND o.created_at>? AND p.template_id=?`).get(hash, Date.now() - 86400000, tpl.id).n;
        if (count >= DRAFTS_PER_DAY) throw new InputError('limit', 429);
        const pg = q.paigaamInsert({ template_id: tpl.id, customer_data: data, customer_name: name });
        id = pg.id;
        db.prepare('INSERT INTO bfday_owners VALUES(?,?,?)').run(id, hash, Date.now());
      }
      reply(res, 200, { id, previewUrl: `/${S}/preview/${id}` });
      return true;
    }

    if (req.method === 'POST' && p === `/api/${S}/upload`) {
      const id = u.searchParams.get('id');
      draftFor(req, S, id);
      const cap = maxImages(t.fields);
      if (!cap) throw new InputError('not_found', 404);     // this template takes no photos
      if (inFlight.has(id)) throw new InputError('limit', 429);
      inFlight.add(id);
      try {
        sweep();
        const count = db.prepare('SELECT COUNT(*) n FROM bfday_uploads WHERE paigaam_id=?').get(id).n;
        if (count >= cap * 3 + 6) throw new InputError('limit', 429);   // room to replace photos, not to hoard
        if (db.prepare('SELECT COALESCE(SUM(bytes),0) n FROM bfday_uploads').get().n > UPLOAD_POOL_BYTES) throw new InputError('limit', 507);
        const type = String(req.headers['content-type'] || '').split(';')[0].trim();
        if (!EXT[type]) throw new InputError('invalid_image');
        const buffer = await read(req, 2 * 1024 * 1024);
        const problem = checkImage(buffer, type);
        if (problem) throw new InputError(problem, problem === 'too_large' ? 413 : 400);
        const filename = crypto.randomBytes(24).toString('hex') + '.' + EXT[type];
        fs.writeFileSync(path.join(uploadDir, filename), buffer, { flag: 'wx', mode: 0o600 });
        db.prepare('INSERT INTO bfday_uploads VALUES(?,?,?,?)').run(filename, id, buffer.length, Date.now());
        reply(res, 200, { url: '/bfday/uploads/' + filename });
        return true;
      } finally { inFlight.delete(id); }
    }

    if (req.method === 'POST' && p === `/api/${S}/publish`) {
      const { id } = await jsonBody(req);
      if (typeof id !== 'string' || !id) throw new InputError('not_found', 404);
      const pg = q.paigaamById(id);
      if (!pg || pg.template_slug !== S) throw new InputError('not_found', 404);
      if (!owned(req, id)) throw new InputError('forbidden', 403);
      if (['published', 'active'].includes(pg.status)) { reply(res, 200, { slug: pg.slug, url: baseUrl + '/p/' + pg.slug }); return true; }
      if (pg.status !== 'draft') throw new InputError('forbidden', 403);
      const tpl = publishedTemplate(S);
      if (tpl.price !== 0) throw new InputError('forbidden', 403);
      // Publishing onto a disk that will be wiped hands out links that die.
      const host = new URL(baseUrl).hostname;
      const allowEphemeral = process.env.BFDAY_ALLOW_EPHEMERAL_PUBLISH === '1';
      if (!PERSISTENT && !allowEphemeral && !LOCAL.includes(host)) throw new InputError('storage_unavailable', 503);
      const data = t.schema.validate(pg.customer_data, { mode: 'strict' });
      verifyImages(t, id, data);
      let slug;
      do { slug = S + '-' + crypto.randomBytes(9).toString('hex'); } while (q.paigaamSlugTaken(slug));
      q.paigaamUpdate(id, { slug, status: 'published', payment_status: 'paid', customer_data: data, published_at: new Date().toISOString() });
      // Photos the sender tried and replaced will never be seen: drop them now.
      const keep = new Set(imagesIn(t.fields, data).map(url => path.basename(url)));
      for (const row of db.prepare('SELECT filename FROM bfday_uploads WHERE paigaam_id=?').all(id)) {
        if (!keep.has(row.filename)) removeUpload(row.filename);
      }
      reply(res, 200, { slug, url: baseUrl + '/p/' + slug });
      return true;
    }

    throw new InputError('not_found', 404);
  } catch (e) {
    if (!(e instanceof InputError)) console.error(`[bfday:${tag}]`, e && e.stack || e);
    if (res.headersSent) { try { res.end(); } catch { /* gone */ } return true; }
    reply(res, e.status || 500, { error: e.code || 'server_error' });
    return true;
  }
}

/** Demo data for a slug (thumbnails, detail page). */
function demo(slug) {
  const t = family.bySlug(slug);
  return t ? t.config.demo : null;
}

module.exports = { handle, owned, has: family.has, demo, SLUGS: family.list.map(t => t.slug) };
