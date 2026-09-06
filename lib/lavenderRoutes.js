'use strict';
/**
 * Lavender Bloom routes — draft, preview, publish.
 *
 * Same shape as the Saalgirah module: a creator-cookie ownership table, drafts
 * in the shared paigaams table, free instant publishing. No uploads, no media,
 * no languages — the only state this template owns is lavender_owners.
 */
const crypto = require('node:crypto');
const { db, q, PERSISTENT } = require('../db');
const { validate, InputError } = require('../templates/lavender-bloom/schema');
const { renderBloom } = require('../templates/lavender-bloom/render');
const { lavenderCreatePage } = require('../pages/lavenderCreate');

// Additive table: nothing existing is touched.
db.exec(`CREATE TABLE IF NOT EXISTS lavender_owners (
 paigaam_id TEXT PRIMARY KEY REFERENCES paigaams(id) ON DELETE CASCADE,
 owner_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS lavender_owner_idx ON lavender_owners(owner_hash);`);

const SLUG = 'lavender-tic-tac-toe-bloom';
const COOKIE = 'paigaam_creator';
const rates = new Map();

/** The creator cookie, hashed — we never store the raw token. */
function owner(req) {
  const raw = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='));
  const value = raw ? raw.slice(COOKIE.length + 1) : '';
  return /^[a-f0-9]{64}$/.test(value) ? crypto.createHash('sha256').update(value).digest('hex') : null;
}

function owned(req, id) {
  const record = db.prepare('SELECT owner_hash FROM lavender_owners WHERE paigaam_id=?').get(id);
  return !!record && record.owner_hash === owner(req);
}

function editable(req, id) {
  const pg = q.paigaamById(id);
  if (!pg || pg.template_slug !== SLUG) throw new InputError('not_found', 404);
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
  try { return JSON.parse((await read(req, 16384)).toString('utf8')); }
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

/** A believable surprise for /lavender-bloom/demo and the collection thumbnails. */
const DEMO = {
  recipientName: 'Yashika',
  senderName: 'Rahul',
  title: 'For You!',
  message: 'Because you make every day as bright as a blooming flower. I miss you more than words can say!',
  flowerColor: 'lavender',
};

async function handle(req, res, u, { baseUrl, isAdmin = false } = {}) {
  const p = u.pathname.replace(/\/+$/, '') || '/';
  const handles = p === '/create/' + SLUG || p === '/lavender-bloom/demo' ||
    p.startsWith('/lavender-bloom/preview/') || p.startsWith('/api/lavender-bloom/');
  if (!handles) return false;

  try {
    if (req.method === 'POST') { csrf(req, baseUrl); rate(req); }

    if (req.method === 'GET' && p === '/create/' + SLUG) {
      const tpl = q.templateBySlug(SLUG);
      if (!tpl || tpl.status !== 'published') throw new InputError('not_found', 404);
      html(res, lavenderCreatePage());
      return true;
    }

    if (req.method === 'GET' && p === '/lavender-bloom/demo') {
      html(res, renderBloom({ customer_data: DEMO }, { baseUrl, isPreview: true }));
      return true;
    }

    let m = p.match(/^\/lavender-bloom\/preview\/([A-Za-z0-9_-]+)$/);
    if (req.method === 'GET' && m) {
      const pg = q.paigaamById(m[1]);
      if (!pg || pg.template_slug !== SLUG) throw new InputError('not_found', 404);
      if (!isAdmin && !owned(req, pg.id)) throw new InputError('forbidden', 403);
      html(res, renderBloom(pg, { baseUrl, isPreview: true }));
      return true;
    }

    if (req.method === 'POST' && p === '/api/lavender-bloom/draft') {
      const body = await jsonBody(req);
      const data = validate(body.customer_data);
      let id = body.id;
      if (id) {
        editable(req, id);
        q.paigaamUpdate(id, { customer_data: data, customer_name: data.recipientName });
      } else {
        const tpl = q.templateBySlug(SLUG);
        if (!tpl || tpl.status !== 'published') throw new InputError('not_found', 404);
        let hash = owner(req);
        if (!hash) {
          const token = crypto.randomBytes(32).toString('hex');
          hash = crypto.createHash('sha256').update(token).digest('hex');
          res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${new URL(baseUrl).protocol === 'https:' ? '; Secure' : ''}`);
        }
        const count = db.prepare('SELECT COUNT(*) n FROM lavender_owners WHERE owner_hash=? AND created_at>?').get(hash, Date.now() - 86400000).n;
        if (count >= 20) throw new InputError('limit', 429);
        const pg = q.paigaamInsert({ template_id: tpl.id, customer_data: data, customer_name: data.recipientName });
        id = pg.id;
        db.prepare('INSERT INTO lavender_owners VALUES(?,?,?)').run(id, hash, Date.now());
      }
      reply(res, 200, { id, previewUrl: '/lavender-bloom/preview/' + id });
      return true;
    }

    if (req.method === 'POST' && p === '/api/lavender-bloom/publish') {
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
      const allowEphemeral = process.env.LAVENDER_ALLOW_EPHEMERAL_PUBLISH === '1';
      if (!PERSISTENT && !allowEphemeral && !['localhost', '127.0.0.1', '::1'].includes(host)) throw new InputError('storage_unavailable', 503);
      validate(pg.customer_data);
      let slug;
      do { slug = 'lavender-' + crypto.randomBytes(9).toString('hex'); } while (q.paigaamSlugTaken(slug));
      q.paigaamUpdate(id, { slug, status: 'published', payment_status: 'paid', published_at: new Date().toISOString() });
      reply(res, 200, { slug, url: baseUrl + '/p/' + slug });
      return true;
    }

    throw new InputError('not_found', 404);
  } catch (e) {
    if (!(e instanceof InputError)) console.error('[lavender-bloom]', e.message);
    reply(res, e.status || 500, { error: e.code || 'server_error' });
    return true;
  }
}

module.exports = { handle, owned, SLUG, DEMO };
