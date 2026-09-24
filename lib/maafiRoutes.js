'use strict';
/**
 * Maafi routes — draft, live preview, preview, publish.
 *
 * Same shape as the Valentine "Say Yes" module: a creator-cookie ownership
 * table, drafts in the shared paigaams table, free instant publishing. No
 * uploads, no media handling — the only state this template owns is
 * maafi_owners.
 *
 * One extra, stateless endpoint powers the generator's live preview pane:
 * GET /maafi/preview-frame?d=<json> renders the experience for whatever the
 * sender has typed so far — no draft, no cookie, no persistence. It is read-
 * only (GET), renders only defaults for unknown keys (validate() is applied
 * best-effort) and is throttled by the same rate limiter as the POSTs.
 */
const crypto = require('node:crypto');
const { db, q, PERSISTENT } = require('../db');
const { validate, InputError } = require('../templates/maafi/schema');
const { renderMaafi } = require('../templates/maafi/render');
const { maafiCreatePage } = require('../pages/maafiCreate');

// Additive table: nothing existing is touched.
db.exec(`CREATE TABLE IF NOT EXISTS maafi_owners (
 paigaam_id TEXT PRIMARY KEY REFERENCES paigaams(id) ON DELETE CASCADE,
 owner_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS maafi_owner_idx ON maafi_owners(owner_hash);`);

const SLUG = 'maafi';
const COOKIE = 'paigaam_creator';
const rates = new Map();

/** The creator cookie, hashed — we never store the raw token. */
function owner(req) {
  const raw = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='));
  const value = raw ? raw.slice(COOKIE.length + 1) : '';
  return /^[a-f0-9]{64}$/.test(value) ? crypto.createHash('sha256').update(value).digest('hex') : null;
}

function owned(req, id) {
  const record = db.prepare('SELECT owner_hash FROM maafi_owners WHERE paigaam_id=?').get(id);
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

/** A believable apology for /maafi/demo and the collection thumbnails. */
const DEMO = {
  recipientName: 'Meher',
  senderName: 'Rahul',
  headline: 'I’m really sorry ❤️',
  yesLabel: 'Okay baby, I forgive you 💖',
  noLabel: 'No, I’m still angry 😠',
  celebration: 'Yay! You forgave me! 😍💖🥳',
};

async function handle(req, res, u, { baseUrl, isAdmin = false } = {}) {
  const p = u.pathname.replace(/\/+$/, '') || '/';

  const handles = p === '/create/' + SLUG || p === '/maafi/demo' ||
    p.startsWith('/maafi/preview/') || p === '/maafi/preview-frame' || p.startsWith('/api/maafi/');
  if (!handles) return false;

  try {
    if (req.method === 'POST') { csrf(req, baseUrl); rate(req); }
    // The live preview frame is a GET, but it renders fresh HTML per keystroke
    // burst — throttle it like a POST so it can't be hammered either.
    if (req.method === 'GET' && p === '/maafi/preview-frame') rate(req);

    if (req.method === 'GET' && p === '/create/' + SLUG) {
      const tpl = q.templateBySlug(SLUG);
      if (!tpl || tpl.status !== 'published') throw new InputError('not_found', 404);
      html(res, maafiCreatePage());
      return true;
    }

    if (req.method === 'GET' && p === '/maafi/demo') {
      html(res, renderMaafi({ customer_data: DEMO }, { baseUrl, isPreview: true }));
      return true;
    }

    // Stateless live preview: whatever is in the `d` param, rendered — nothing
    // saved, nothing stored. Unknown/invalid shapes fall back to the defaults.
    if (req.method === 'GET' && p === '/maafi/preview-frame') {
      let data = {};
      try { data = JSON.parse(u.searchParams.get('d') || '{}') || {}; } catch { /* defaults hold */ }
      let clean;
      try { clean = validate(data); } catch { clean = { templateVersion: 1 }; } // renderer supplies the designed defaults
      html(res, renderMaafi({ customer_data: clean }, { baseUrl, isPreview: true }));
      return true;
    }

    let m = p.match(/^\/maafi\/preview\/([A-Za-z0-9_-]+)$/);
    if (req.method === 'GET' && m) {
      const pg = q.paigaamById(m[1]);
      if (!pg || pg.template_slug !== SLUG) throw new InputError('not_found', 404);
      if (!isAdmin && !owned(req, pg.id)) throw new InputError('forbidden', 403);
      html(res, renderMaafi(pg, { baseUrl, isPreview: true }));
      return true;
    }

    if (req.method === 'POST' && p === '/api/maafi/draft') {
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
        const count = db.prepare('SELECT COUNT(*) n FROM maafi_owners WHERE owner_hash=? AND created_at>?').get(hash, Date.now() - 86400000).n;
        if (count >= 20) throw new InputError('limit', 429);
        const pg = q.paigaamInsert({ template_id: tpl.id, customer_data: data, customer_name: data.recipientName });
        id = pg.id;
        db.prepare('INSERT INTO maafi_owners VALUES(?,?,?)').run(id, hash, Date.now());
      }
      reply(res, 200, { id, previewUrl: '/maafi/preview/' + id });
      return true;
    }

    if (req.method === 'POST' && p === '/api/maafi/publish') {
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
      const allowEphemeral = process.env.MAAFI_ALLOW_EPHEMERAL_PUBLISH === '1';
      if (!PERSISTENT && !allowEphemeral && !['localhost', '127.0.0.1', '::1'].includes(host)) throw new InputError('storage_unavailable', 503);
      validate(pg.customer_data);
      let slug;
      do { slug = 'maafi-' + crypto.randomBytes(9).toString('hex'); } while (q.paigaamSlugTaken(slug));
      q.paigaamUpdate(id, { slug, status: 'published', payment_status: 'paid', published_at: new Date().toISOString() });
      reply(res, 200, { slug, url: baseUrl + '/p/' + slug });
      return true;
    }

    throw new InputError('not_found', 404);
  } catch (e) {
    if (!(e instanceof InputError)) console.error('[maafi]', e.message);
    reply(res, e.status || 500, { error: e.code || 'server_error' });
    return true;
  }
}

module.exports = { handle, owned, SLUG, DEMO };
