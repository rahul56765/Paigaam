'use strict';
/**
 * Sawaal routes — draft, live preview, preview, publish, visitor answers.
 *
 * Same shape as the Maafi module: a creator-cookie ownership table, drafts in
 * the shared paigaams table, free instant publishing, and a stateless live
 * preview that follows the sender's keystrokes.
 *
 * One extra this template owns — the questionnaire records answers. Visitors
 * POST their scene choices to /api/sawaal/answer and their selfie to
 * /api/sawaal/upload; the sender reads them on a private responses page
 * (/sawaal/responses/:id), gated by the same creator cookie as the preview.
 * Uploads follow the Love Album pattern: raw bytes, magic-byte sniffed
 * server-side, no sharp.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { db, q, PERSISTENT, DATA_DIR } = require('../db');
const { validate, InputError } = require('../templates/sawaal/schema');
const { renderSawaal, QUIZ_ANSWERS, MEDIA } = require('../templates/sawaal/render');
const { sawaalCreatePage } = require('../pages/sawaalCreate');
const { streamFile } = require('./streamFile');

// Additive table: nothing existing is touched.
db.exec(`CREATE TABLE IF NOT EXISTS sawaal_owners (
 paigaam_id TEXT PRIMARY KEY REFERENCES paigaams(id) ON DELETE CASCADE,
 owner_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sawaal_owner_idx ON sawaal_owners(owner_hash);
CREATE TABLE IF NOT EXISTS sawaal_answers (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 paigaam_id TEXT NOT NULL REFERENCES paigaams(id) ON DELETE CASCADE,
 scene TEXT NOT NULL, answer TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sawaal_answers_idx ON sawaal_answers(paigaam_id);
CREATE TABLE IF NOT EXISTS sawaal_uploads (
 filename TEXT PRIMARY KEY,
 paigaam_id TEXT NOT NULL REFERENCES paigaams(id) ON DELETE CASCADE,
 bytes INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sawaal_uploads_inv ON sawaal_uploads(paigaam_id);
CREATE TABLE IF NOT EXISTS sawaal_visitors (
 token TEXT PRIMARY KEY,
 paigaam_id TEXT NOT NULL REFERENCES paigaams(id) ON DELETE CASCADE,
 created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sawaal_visitors_idx ON sawaal_visitors(paigaam_id);`);

const SLUG = 'sawaal';
const COOKIE = 'paigaam_creator';
const MAX_UPLOAD = 5 * 1024 * 1024;
const uploadDir = path.join(DATA_DIR, 'sawaal-uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const rates = new Map();

/** The creator cookie, hashed — we never store the raw token. */
function owner(req) {
  const raw = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='));
  const value = raw ? raw.slice(COOKIE.length + 1) : '';
  return /^[a-f0-9]{64}$/.test(value) ? crypto.createHash('sha256').update(value).digest('hex') : null;
}

function owned(req, id) {
  const record = db.prepare('SELECT owner_hash FROM sawaal_owners WHERE paigaam_id=?').get(id);
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

/* ------------------------------------------------------------ image sniff */
/* Same magic-byte sniffing as lib/loveRoutes.js — no sharp, no deps. */

function sniffImage(buf) {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    return { format: 'image/png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
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
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { format: 'image/webp', width: 1 + (buf[24] | buf[25] << 8 | buf[26] << 16), height: 1 + (buf[27] | buf[28] << 8 | buf[29] << 16) };
    if (chunk === 'VP8 ') return { format: 'image/webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') { const bits = (buf[21] | buf[22] << 8 | buf[23] << 16) >>> 0; return { format: 'image/webp', width: (bits & 0x3FFF) + 1, height: ((bits >> 14) & 0x3FFF) + 1 }; }
  }
  return null;
}

/* --------------------------------------------------------- visitor pages */

function escInline(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const SCENE_LABELS = { invite: 'The invitation', like: 'Do you like me', vibe: 'The vibe', day: 'The day', quiz: 'The quiz', selfie: 'The selfie', kiss: 'The final question' };

function responsesPage(pg, baseUrl) {
  const d = pg.customer_data || {};
  const rows = db.prepare('SELECT scene, answer, created_at FROM sawaal_answers WHERE paigaam_id=? ORDER BY created_at ASC, id ASC').all(pg.id);
  const answers = rows.map(row => {
    let answer;
    try { answer = JSON.parse(row.answer); } catch { answer = { raw: row.answer }; }
    return { scene: row.scene, answer, at: new Date(row.created_at).toISOString().replace('T', ' ').slice(0, 16) };
  });
  const selfie = answers.filter(a => a.scene === 'selfie' && a.answer && a.answer.url).pop();
  const quizRow = answers.filter(a => a.scene === 'quiz').pop();
  const score = quizRow && quizRow.answer ? quizRow.answer.score : null;
  const body = answers.map(a => {
    const detail = [];
    const an = a.answer || {};
    if (an.choice) detail.push(String(an.choice));
    if (an.text) detail.push(String(an.text));
    if (an.date) detail.push(String(an.date));
    if (an.score != null) detail.push(`score ${an.score}/4 (${Object.entries(an.answers || {}).map(([k, v]) => k + '=' + v).join(', ')})`);
    if (an.url) detail.push('selfie attached');
    return `<tr><td>${escInline(SCENE_LABELS[a.scene] || a.scene)}</td><td>${escInline(detail.join(' — '))}</td><td class="muted">${escInline(a.at)}</td></tr>`;
  }).join('');
  const link = `${(baseUrl || '').replace(/\/$/, '')}/sawaal/selfie/${pg.id}/${selfie ? path.basename(String(selfie.answer.url)) : ''}`;
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Sawaal responses · Paigaam</title>
<style>
body{font-family:ui-sans-serif,system-ui,sans-serif;margin:0;padding:32px 20px;background:#FFF7FA;color:#3B2430}
main{max-width:860px;margin:0 auto}
h1{font-size:1.6rem;margin:0 0 4px}.muted{color:#8F6A7A;font-weight:400;font-size:.85rem}
p.sub{color:#70657C;margin:0 0 24px}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #F6D9E4;border-radius:14px;overflow:hidden}
td,th{padding:10px 14px;text-align:left;font-size:.9rem;border-bottom:1px solid #F6D9E4;vertical-align:top}
th{background:#FFE3F0;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:#D92D8E}
td.muted{color:#8F6A7A;white-space:nowrap}
.score{display:inline-block;background:#FFE3F0;color:#D92D8E;border-radius:999px;padding:6px 16px;font-weight:800;margin:0 0 18px}
.selfie{margin:18px 0 26px}.selfie img{max-width:280px;border-radius:16px;border:1px solid #F6D9E4;box-shadow:0 10px 30px rgba(93,54,111,.15)}
.empty{padding:28px;text-align:center;color:#8F6A7A}
a{text-align;display:inline-block;margin-top:24px;color:#D92D8E}
</style></head><body><main>
<h1>Answers from ${escInline((d && d.recipientName) || 'them')}</h1>
<p class="sub">Private — only you (this browser) can open it. ${score != null ? '' : 'The quiz may still be on its way.'}</p>
${score != null ? `<span class="score">Quiz score: ${score} / 4</span>` : ''}
${selfie ? `<div class="selfie"><p class="sub" style="margin-bottom:8px">The selfie:</p><img src="/sawaal/selfie/${pg.id}/${path.basename(String(selfie.answer.url))}" alt="Their selfie"></div>` : ''}
<table><thead><tr><th>Scene</th><th>Answer</th><th>When</th></tr></thead>
<tbody>${body || '<tr><td colspan="3" class="empty">No answers yet — send them the link.</td></tr>'}</tbody></table>
<a href="/">← Paigaam</a>
</main></body></html>`;
}

/* ------------------------------------------------------- sample personality */

/** A believable questionnaire for /sawaal/demo and the collection thumbnails. */
const DEMO = {
  recipientName: 'Meher',
  senderName: 'Rahul',
  inviteTitle: 'Let’s schedule a date!',
  inviteIntro: 'Be a good girl & answer all the questions. I’ll worry about the rest.',
  likeTitle: 'Do you like Rahul?!?!',
  vibeTitle: 'How do you like it?',
  vibeOptions: ['Dinner & Chill', 'Coffee & Walking'],
  availableDays: nextFridays(),
  quizTitle: 'So you know us, huh?',
  quizIntro: 'Answer the following questions. They should be easy, I swear to god!',
  kissTitle: 'What if...?',
  kissIntro: 'What if Rahul couldn’t handle your cuteness and kissed you on the first date...',
  yesOutcome: 'I USED TO PRAY FOR TIMES LIKE THIS',
  shyOutcome: 'Pfff fine. I had to try it anyway',
  shyOutcomeLine: 'But I will be holding your hands, no questions asked!',
};

function nextFridays() {
  const out = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  while (out.length < 6) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 5) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/* --------------------------------------------------------------- handler */

async function handle(req, res, u, { baseUrl, isAdmin = false } = {}) {
  const p = u.pathname.replace(/\/+$/, '') || '/';

  const handles = p === '/create/' + SLUG || p === '/sawaal/demo' ||
    p.startsWith('/sawaal/preview/') || p === '/sawaal/preview-frame' ||
    p.startsWith('/sawaal/responses/') || p.startsWith('/sawaal/selfie/') ||
    p.startsWith('/api/sawaal/');
  if (!handles) return false;

  try {
    // Visitor POSTs (claim/answer/upload) come from the published page with no
    // creator cookie and a same-origin context — CSRF-checked, rate-limited.
    if (req.method === 'POST') { csrf(req, baseUrl); rate(req); }
    if (req.method === 'GET' && p === '/sawaal/preview-frame') rate(req);

    if (req.method === 'GET' && p === '/create/' + SLUG) {
      const tpl = q.templateBySlug(SLUG);
      if (!tpl || tpl.status !== 'published') throw new InputError('not_found', 404);
      html(res, sawaalCreatePage());
      return true;
    }

    if (req.method === 'GET' && p === '/sawaal/demo') {
      html(res, renderSawaal({ customer_data: DEMO }, { baseUrl, isPreview: true }));
      return true;
    }

    // Stateless live preview: whatever is in the `d` param, rendered — nothing
    // saved, nothing stored. Unknown/invalid shapes fall back to the defaults.
    if (req.method === 'GET' && p === '/sawaal/preview-frame') {
      let data = {};
      try { data = JSON.parse(u.searchParams.get('d') || '{}') || {}; } catch { /* defaults hold */ }
      let clean;
      try { clean = validate(data); } catch { clean = { templateVersion: 1 }; } // renderer supplies the designed defaults
      html(res, renderSawaal({ customer_data: clean }, { baseUrl, isPreview: true }));
      return true;
    }

    let m = p.match(/^\/sawaal\/preview\/([A-Za-z0-9_-]+)$/);
    if (req.method === 'GET' && m) {
      const pg = q.paigaamById(m[1]);
      if (!pg || pg.template_slug !== SLUG) throw new InputError('not_found', 404);
      if (!isAdmin && !owned(req, pg.id)) throw new InputError('forbidden', 403);
      html(res, renderSawaal(pg, { baseUrl, isPreview: true }));
      return true;
    }

    // The sender's private answers page — creator-gated like the preview.
    m = p.match(/^\/sawaal\/responses\/([A-Za-z0-9_-]+)$/);
    if (req.method === 'GET' && m) {
      const pg = q.paigaamById(m[1]);
      if (!pg || pg.template_slug !== SLUG) throw new InputError('not_found', 404);
      if (!isAdmin && !owned(req, pg.id)) throw new InputError('forbidden', 403);
      html(res, responsesPage(pg, baseUrl));
      return true;
    }

    // Selfies — same ownership rule as the Love Album's uploads.
    m = p.match(/^\/sawaal\/selfie\/([A-Za-z0-9_-]+)\/([a-f0-9]{48}\.(?:jpg|png|webp))$/);
    if (['GET', 'HEAD'].includes(req.method) && m) {
      const row = db.prepare('SELECT paigaam_id FROM sawaal_uploads WHERE filename=?').get(m[2]);
      if (!row || row.paigaam_id !== m[1]) throw new InputError('not_found', 404);
      const ownerPg = q.paigaamById(row.paigaam_id);
      const published = ownerPg && ['published', 'active'].includes(ownerPg.status);
      if (!published && !isAdmin && !owned(req, row.paigaam_id)) throw new InputError('not_found', 404);
      if (!streamFile(req, res, path.join(uploadDir, m[2]), 'image/' + m[2].split('.').pop(), 'private, max-age=0, must-revalidate')) throw new InputError('not_found', 404);
      return true;
    }

    /* ------------- visitor APIs (the published page calls these) ------------- */

    // Visitor session: mints (or returns) the visitor token bound to THIS
    // published paigaam. The visitor cookie authorises answer/upload posting —
    // separate from the creator cookie, so the sender's ownership never leaks
    // by walking their own flow.
    if (req.method === 'POST' && p === '/api/sawaal/claim') {
      const visitor = visitorToken(req);
      if (visitor) {
        const existing = db.prepare('SELECT paigaam_id FROM sawaal_visitors WHERE token=?').get(visitor.hash);
        if (existing && q.paigaamById(existing.paigaam_id)) return reply(res, 200, { id: existing.paigaam_id });
      }
      const { id } = await jsonBody(req).catch(() => ({}));
      const pg = q.paigaamById(id);
      if (!pg || pg.template_slug !== SLUG || !['published', 'active'].includes(pg.status)) throw new InputError('not_found', 404);
      const token = crypto.randomBytes(24).toString('hex');
      db.prepare('INSERT INTO sawaal_visitors VALUES(?,?,?)').run(token, pg.id, Date.now());
      res.setHeader('Set-Cookie', `paigaam_visitor=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${new URL(baseUrl).protocol === 'https:' ? '; Secure' : ''}`);
      reply(res, 200, { id: pg.id });
      return true;
    }

    if (req.method === 'POST' && p === '/api/sawaal/answer') {
      const { id, scene, answer } = await jsonBody(req);
      if (!id || !scene || answer == null || typeof answer !== 'object' || Array.isArray(answer)) throw new InputError();
      if (!Object.keys(SCENE_LABELS).includes(scene)) throw new InputError();
      const visitor = visitorToken(req);
      const allowed = visitor
        ? db.prepare('SELECT paigaam_id FROM sawaal_visitors WHERE token=?').get(visitor.hash)
        : null;
      if (!allowed || allowed.paigaam_id !== id) throw new InputError('forbidden', 403);
      const pg = q.paigaamById(id);
      if (!pg || pg.template_slug !== SLUG) throw new InputError('not_found', 404);
      const clean = JSON.stringify(cleanAnswer(scene, answer)).slice(0, 2000);
      db.prepare('INSERT INTO sawaal_answers(paigaam_id, scene, answer, created_at) VALUES(?,?,?,?)').run(id, scene, clean, Date.now());
      reply(res, 200, { ok: true });
      return true;
    }

    if (req.method === 'POST' && p === '/api/sawaal/upload') {
      const id = u.searchParams.get('id');
      if (!id) throw new InputError();
      const visitor = visitorToken(req);
      const allowed = visitor
        ? db.prepare('SELECT paigaam_id FROM sawaal_visitors WHERE token=?').get(visitor.hash)
        : null;
      if (!allowed || allowed.paigaam_id !== id) throw new InputError('forbidden', 403);
      const pg = q.paigaamById(id);
      if (!pg || pg.template_slug !== SLUG) throw new InputError('not_found', 404);
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(req.headers['content-type'])) throw new InputError('invalid_image');
      const buffer = await read(req, MAX_UPLOAD);
      const sniff = sniffImage(buffer);
      if (!sniff || !sniff.width || !sniff.height || sniff.width < 50 || sniff.height < 50) throw new InputError('invalid_image');
      const filename = crypto.randomBytes(24).toString('hex') + '.' + EXT[req.headers['content-type']];
      fs.writeFileSync(path.join(uploadDir, filename), buffer, { flag: 'wx', mode: 0o600 });
      db.prepare('INSERT INTO sawaal_uploads VALUES(?,?,?,?)').run(filename, id, buffer.length, Date.now());
      db.prepare('INSERT INTO sawaal_answers(paigaam_id, scene, answer, created_at) VALUES(?,?,?,?)')
        .run(id, 'selfie', JSON.stringify({ choice: 'selfie_uploaded', url: '/sawaal/selfie/' + id + '/' + filename }), Date.now());
      reply(res, 200, { ok: true, url: '/sawaal/selfie/' + id + '/' + filename });
      return true;
    }

    /* ------------- sender APIs (the generator calls these) ------------- */

    if (req.method === 'POST' && p === '/api/sawaal/draft') {
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
        const count = db.prepare('SELECT COUNT(*) n FROM sawaal_owners WHERE owner_hash=? AND created_at>?').get(hash, Date.now() - 86400000).n;
        if (count >= 20) throw new InputError('limit', 429);
        const pg = q.paigaamInsert({ template_id: tpl.id, customer_data: data, customer_name: data.recipientName });
        id = pg.id;
        db.prepare('INSERT INTO sawaal_owners VALUES(?,?,?)').run(id, hash, Date.now());
      }
      reply(res, 200, { id, previewUrl: '/sawaal/preview/' + id, responsesUrl: '/sawaal/responses/' + id });
      return true;
    }

    if (req.method === 'POST' && p === '/api/sawaal/publish') {
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
      const allowEphemeral = process.env.SAWAAL_ALLOW_EPHEMERAL_PUBLISH === '1';
      if (!PERSISTENT && !allowEphemeral && !['localhost', '127.0.0.1', '::1'].includes(host)) throw new InputError('storage_unavailable', 503);
      validate(pg.customer_data);
      let slug;
      do { slug = 'sawaal-' + crypto.randomBytes(9).toString('hex'); } while (q.paigaamSlugTaken(slug));
      q.paigaamUpdate(id, { slug, status: 'published', payment_status: 'paid', published_at: new Date().toISOString() });
      reply(res, 200, { slug, url: baseUrl + '/p/' + slug });
      return true;
    }

    throw new InputError('not_found', 404);
  } catch (e) {
    if (!(e instanceof InputError)) console.error('[sawaal]', e.message);
    reply(res, e.status || 500, { error: e.code || 'server_error' });
    return true;
  }
}

/** Visitor answers are whitelisted per scene; anything unknown is dropped. */
function cleanAnswer(scene, answer) {
  const clean = {};
  const s = v => (typeof v === 'string' ? v.slice(0, 300) : undefined);
  if (scene === 'quiz') {
    clean.choice = 'quiz';
    const answers = {};
    for (const k of ['q1', 'q2', 'q3', 'q4']) answers[k] = ['A', 'B', 'C', 'D'].includes(answer.answers && answer.answers[k]) ? answer.answers[k] : null;
    if (Object.values(answers).some(v => v === null)) throw new InputError();
    clean.answers = answers;
    clean.score = [answers.q1, answers.q2, answers.q3, answers.q4].filter((v, i) => v === QUIZ_ANSWERS['q' + (i + 1)]).length;
    return clean;
  }
  if (answer.choice !== undefined) {
    if (typeof answer.choice !== 'string') throw new InputError();
    clean.choice = s(answer.choice);
  }
  if (answer.text != null) { clean.text = s(answer.text); if (!clean.text) throw new InputError(); }
  if (answer.date != null) { clean.date = s(answer.date); if (!/^\d{4}-\d{2}-\d{2}$/.test(clean.date || '')) throw new InputError(); }
  if (answer.url != null) { clean.url = s(answer.url); if (!/^\/sawaal\/selfie\/[A-Za-z0-9_-]+\/[a-f0-9]{48}\.(?:jpg|png|webp)$/.test(clean.url || '')) throw new InputError(); }
  if (!Object.keys(clean).length) throw new InputError();
  return clean;
}

function visitorToken(req) {
  const raw = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('paigaam_visitor='));
  const value = raw ? raw.slice('paigaam_visitor='.length) : '';
  return /^[a-f0-9]{48}$/.test(value) ? { hash: value } : null;
}

module.exports = { handle, owned, SLUG, DEMO, MEDIA };
