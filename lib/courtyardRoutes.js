'use strict';
/**
 * Ganpati Courtyard routes — draft, preview, publish, export.
 *
 * Follows the Saalgirah module: creator-cookie ownership in its own additive
 * table, drafts/publishing reusing the paigaams table. On top of that it adds
 * the MP4 export: ffmpeg burns the caption cues (templates/ganpati-courtyard/
 * captions.js) into the untouched source video, keeping its original audio.
 * The rendered file is cached on the data volume and served with Range
 * support, so the download is a true, re-downloadable MP4.
 */
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { db, q, DATA_DIR, PERSISTENT } = require('../db');
const { validate, InputError } = require('../templates/ganpati-courtyard/schema');
const { assFor, timelineForClient } = require('../templates/ganpati-courtyard/captions');
const { courtyardCreatePage } = require('../pages/ganpatiCourtyardCreate');
const { streamFile } = require('./streamFile');

// Additive table: nothing existing is touched.
db.exec(`CREATE TABLE IF NOT EXISTS ganpati_courtyard_owners (
 paigaam_id TEXT PRIMARY KEY REFERENCES paigaams(id) ON DELETE CASCADE,
 owner_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS ganpati_courtyard_owner_idx ON ganpati_courtyard_owners(owner_hash);`);

const SLUG = 'ganpati-courtyard';
const COOKIE = 'paigaam_creator';
const MEDIA = path.join(__dirname, '../public/ganpati-courtyard/media');
const EXPORT_DIR = path.join(DATA_DIR, 'exports', SLUG);
const rates = new Map();

function owner(req) {
  const raw = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='));
  const value = raw ? raw.slice(COOKIE.length + 1) : '';
  return /^[a-f0-9]{64}$/.test(value) ? crypto.createHash('sha256').update(value).digest('hex') : null;
}

function owned(req, id) {
  const record = db.prepare('SELECT owner_hash FROM ganpati_courtyard_owners WHERE paigaam_id=?').get(id);
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
  if (r.count > 60) throw new InputError('limit', 429);
}

/** A believable card for /ganpati-courtyard/demo and the collection thumbnails. */
const DEMO = {
  greeting: '॥ श्री गणेशाय नमः ॥',
  mainTitle: 'बाप्पा येत आहेत…',
  familyName: 'देशमुख',
  eventDate: 'सोमवार, १४ सप्टेंबर २०२६',
  eventTime: 'सकाळी १०:३०',
  venueName: 'पाटील वाडा, शनिवार पेठ',
  city: 'पुणे',
};

/* ---------------- ffmpeg ---------------- */

function ffmpegPath() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  return 'ffmpeg';
}

function run(cmd, args, timeoutMs, env = process.env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'], env });
    let err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, timeoutMs);
    child.stderr.on('data', (c) => { if (err.length < 8000) err += c; });
    child.on('error', (e) => { clearTimeout(timer); resolve({ ok: false, code: -1, stderr: String(e.message) }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ ok: code === 0, code, stderr: err }); });
  });
}

/**
 * Render the personalised MP4. Returns the absolute path of the finished file.
 * The video stream is re-encoded (captions must be burned in) at matching
 * resolution/fps; the original AAC audio stream is copied untouched — the
 * customer's download keeps the original sound.
 */
async function renderVideo(paigaam) {
  const src = path.join(MEDIA, 'courtyard.mp4');
  if (!fs.existsSync(src)) throw new InputError('media_missing', 500);
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
  const out = path.join(EXPORT_DIR, `${paigaam.id}.mp4`);
  const tmp = `${out}.${process.pid}.tmp.mp4`;
  const ass = path.join(EXPORT_DIR, `${paigaam.id}.ass`);
  fs.writeFileSync(ass, assFor(paigaam.customer_data), 'utf8');
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
  // libass picks fonts through fontconfig; FONTCONFIG_FILE points it at a
  // minimal config that scans ONLY our bundled-font directory, so Tiro
  // Devanagari Marathi renders even on hosts with no system fonts. If the
  // host's fontconfig rejects the file, retry once with the default config.
  const conf = path.join(EXPORT_DIR, 'fonts.conf');
  fs.writeFileSync(conf, `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${MEDIA}</dir>
  <cachedir>${EXPORT_DIR}/fc-cache</cachedir>
</fontconfig>
`);
  const baseArgs = [
    '-y', '-v', 'error',
    '-i', src,
    '-vf', `ass=${JSON.stringify(ass).slice(1, -1)}`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
    '-pix_fmt', 'yuv420p', '-r', '24', '-g', '48',
    '-c:a', 'copy',            // original sound, untouched
    '-movflags', '+faststart',
    tmp,
  ];
  const attempt = (env) => run(ffmpegPath(), baseArgs, 120000, env);
  let r = await attempt({ ...process.env, FONTCONFIG_FILE: conf });
  if (!r.ok) {
    const firstError = r.stderr.slice(-400);
    r = await attempt(process.env);
    if (!r.ok) r.firstError = firstError;
  }
  try {
    if (!r.ok || !fs.existsSync(tmp) || fs.statSync(tmp).size < 100000) {
      console.error('[ganpati-courtyard] ffmpeg failed:', r.code, (r.stderr || r.firstError || '').slice(-600));
      throw new InputError('render_failed', 502);
    }
    fs.renameSync(tmp, out);
    return out;
  } finally {
    try { fs.unlinkSync(ass); } catch { /* already removed */ }
    try { fs.unlinkSync(tmp); } catch { /* still rendering or already renamed */ }
  }
}

/* ---------------- request handling ---------------- */

async function handle(req, res, u, { baseUrl, isAdmin = false } = {}) {
  const p = u.pathname.replace(/\/+$/, '') || '/';
  const handles = p === '/create/' + SLUG || p === '/ganpati-courtyard/demo' ||
    p.startsWith('/ganpati-courtyard/preview/') || p.startsWith('/ganpati-courtyard/video/') ||
    p.startsWith('/api/ganpati-courtyard/');
  if (!handles) return false;

  try {
    if (req.method === 'POST') { csrf(req, baseUrl); rate(req); }

    if (req.method === 'GET' && p === '/create/' + SLUG) {
      const tpl = q.templateBySlug(SLUG);
      if (!tpl || tpl.status !== 'published') throw new InputError('not_found', 404);
      html(res, courtyardCreatePage());
      return true;
    }

    if (req.method === 'GET' && p === '/ganpati-courtyard/demo') {
      html(res, courtyardCreatePage({ demo: DEMO }));
      return true;
    }

    let m = p.match(/^\/ganpati-courtyard\/preview\/([A-Za-z0-9_-]+)$/);
    if (req.method === 'GET' && m) {
      const pg = q.paigaamById(m[1]);
      if (!pg || pg.template_slug !== SLUG) throw new InputError('not_found', 404);
      if (!isAdmin && !owned(req, pg.id)) throw new InputError('forbidden', 403);
      html(res, courtyardCreatePage({ paigaam: pg }));
      return true;
    }

    if (req.method === 'POST' && p === '/api/ganpati-courtyard/draft') {
      const body = await jsonBody(req);
      const data = validate(body.customer_data);
      let id = body.id;
      if (id) {
        editable(req, id);
        q.paigaamUpdate(id, { customer_data: data, customer_name: data.familyName });
      } else {
        const tpl = q.templateBySlug(SLUG);
        if (!tpl || tpl.status !== 'published') throw new InputError('not_found', 404);
        let hash = owner(req);
        if (!hash) {
          const token = crypto.randomBytes(32).toString('hex');
          hash = crypto.createHash('sha256').update(token).digest('hex');
          res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${new URL(baseUrl).protocol === 'https:' ? '; Secure' : ''}`);
        }
        const count = db.prepare('SELECT COUNT(*) n FROM ganpati_courtyard_owners WHERE owner_hash=? AND created_at>?').get(hash, Date.now() - 86400000).n;
        if (count >= 20) throw new InputError('limit', 429);
        const pg = q.paigaamInsert({ template_id: tpl.id, customer_data: data, customer_name: data.familyName });
        id = pg.id;
        db.prepare('INSERT INTO ganpati_courtyard_owners VALUES(?,?,?)').run(id, hash, Date.now());
      }
      reply(res, 200, { id, previewUrl: '/ganpati-courtyard/preview/' + id });
      return true;
    }

    if (req.method === 'POST' && p === '/api/ganpati-courtyard/publish') {
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
      const allowEphemeral = process.env.GANPATI_COURTYARD_ALLOW_EPHEMERAL_PUBLISH === '1';
      if (!PERSISTENT && !allowEphemeral && !['localhost', '127.0.0.1', '::1'].includes(host)) throw new InputError('storage_unavailable', 503);
      validate(pg.customer_data);
      let slug;
      do { slug = 'ganpati-' + crypto.randomBytes(9).toString('hex'); } while (q.paigaamSlugTaken(slug));
      q.paigaamUpdate(id, { slug, status: 'published', payment_status: 'paid', published_at: new Date().toISOString() });
      reply(res, 200, { slug, url: baseUrl + '/p/' + slug });
      return true;
    }

    if (req.method === 'POST' && p === '/api/ganpati-courtyard/export') {
      const { id } = await jsonBody(req);
      const pg = q.paigaamById(id);
      if (!pg || pg.template_slug !== SLUG) throw new InputError('not_found', 404);
      if (!isAdmin && !owned(req, id)) throw new InputError('forbidden', 403);
      validate(pg.customer_data);
      const out = path.join(EXPORT_DIR, `${pg.id}.mp4`);
      // A finished render for the CURRENT data is served instantly (re-download).
      const fresh = fs.existsSync(out) && fs.statSync(out).mtimeMs > (pg.updated_at ? new Date(pg.updated_at).getTime() : 0);
      if (!fresh) {
        if (!PERSISTENT) throw new InputError('storage_unavailable', 503);
        await renderVideo(pg);
      }
      reply(res, 200, { ready: true, url: `/ganpati-courtyard/video/${pg.id}.mp4` });
      return true;
    }

    m = p.match(/^\/ganpati-courtyard\/video\/([A-Za-z0-9_-]+)\.mp4$/);
    if (req.method === 'GET' && m) {
      const pg = q.paigaamById(m[1]);
      if (!pg || pg.template_slug !== SLUG) throw new InputError('not_found', 404);
      // The owner downloads while drafting; after publish the world can too.
      if (pg.status === 'draft' && !isAdmin && !owned(req, pg.id)) throw new InputError('forbidden', 403);
      const out = path.join(EXPORT_DIR, `${pg.id}.mp4`);
      if (!fs.existsSync(out)) throw new InputError('not_ready', 404);
      if (streamFile(req, res, out, 'video/mp4', 'public, max-age=300')) return true;
      throw new InputError('server_error', 500);
    }

    m = p.match(/^\/api\/ganpati-courtyard\/paigaam\/([A-Za-z0-9_-]+)$/);
    if (req.method === 'GET' && m) {
      const pg = q.paigaamById(m[1]);
      if (!pg || pg.template_slug !== SLUG) throw new InputError('not_found', 404);
      if (!isAdmin && !owned(req, pg.id)) throw new InputError('forbidden', 403);
      reply(res, 200, { id: pg.id, status: pg.status, slug: pg.slug, customer_data: pg.customer_data });
      return true;
    }

    throw new InputError('not_found', 404);
  } catch (e) {
    if (!(e instanceof InputError)) console.error('[ganpati-courtyard]', e.message);
    reply(res, e.status || 500, { error: e.code || 'server_error' });
    return true;
  }
}

module.exports = { handle, owned, SLUG, DEMO, renderVideo, timelineForClient };
