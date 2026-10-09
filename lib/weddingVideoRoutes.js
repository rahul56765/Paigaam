'use strict';
/**
 * Wedding invitation video generator (isolated feature).
 * Editor:  /wedding-video                  form + live Remotion preview (wedding-video/dist/editor.js)
 * Share:   /w/:id                          rendered film, MP4 downloads, guest RSVP / wishes
 * Assets:  /wedding-video/assets/*         template art, fonts, brand (wedding-video/public)
 * Media:   /wedding-video/media/:file      customer music uploads (unguessable names)
 * API:     /api/wedding-video/...          invites, music upload, renders, RSVPs
 * Story scenes are fixed, pre-produced template clips (wedding-video/public/stories); nothing is AI-generated per customer.
 * Privacy: drafts are readable only by the creating browser (owner cookie, stored hashed).
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const store = require('./weddingVideo/store');
const jobs = require('./weddingVideo/jobs');
const { streamFile } = require('./streamFile');
const { page, esc } = require('./layout');

const ROOT = path.join(__dirname, '..', 'wedding-video');
const ASSET_DIR = path.join(ROOT, 'public');
const DIST_DIR = path.join(ROOT, 'dist');
const COOKIE = 'paigaam_wv';
const MAX = { music: 20 * 1024 * 1024 };
const PER_INVITE = { music: 4 };
const ASSET_MIME = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.map': 'application/json' };

let schemaMod = null; // ESM schema shared with the composition (normalize/validate)
const schema = () => schemaMod || (schemaMod = import('../wedding-video/src/lib/schema.js'));
let started = false;

class HttpError extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }
const json = (res, code, obj, headers = {}) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(obj)); };
const html = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(body); };
const secure = (baseUrl) => { try { return new URL(baseUrl).protocol === 'https:'; } catch { return false; } };

function ownerToken(req) {
  const raw = (req.headers.cookie || '').split(';').map((x) => x.trim()).find((x) => x.startsWith(COOKIE + '='));
  const v = raw ? raw.slice(COOKIE.length + 1) : '';
  return /^[a-f0-9]{64}$/.test(v) ? v : null;
}
function ensureOwner(req, res, baseUrl) {
  let tok = ownerToken(req);
  let setCookie = null;
  if (!tok) {
    tok = crypto.randomBytes(32).toString('hex');
    setCookie = `${COOKIE}=${tok}; Path=/; Max-Age=${60 * 60 * 24 * 365}; HttpOnly; SameSite=Lax${secure(baseUrl) ? '; Secure' : ''}`;
  }
  return { hash: store.hash(tok), setCookie };
}
function ownInvite(req, id) {
  const inv = store.getInvite(id);
  if (!inv) throw new HttpError(404, 'not_found');
  const tok = ownerToken(req);
  if (!tok || store.hash(tok) !== inv.owner_hash) throw new HttpError(403, 'forbidden');
  return inv;
}
function readBody(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > max) { reject(new HttpError(413, 'too_large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req, max = 512 * 1024) {
  const b = await readBody(req, max);
  try { return JSON.parse(b.toString('utf8') || '{}'); } catch { throw new HttpError(400, 'bad_json'); }
}
/** Magic-byte sniffing; never trust the client's content-type. */
function sniff(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg', type: 'image' };
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png', type: 'image' };
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return { ext: 'webp', mime: 'image/webp', type: 'image' };
  if (buf.slice(4, 8).toString() === 'ftyp') {
    const brand = buf.slice(8, 12).toString();
    if (/^(M4A |M4B )/.test(brand)) return { ext: 'm4a', mime: 'audio/mp4', type: 'audio' };
    return { ext: 'mp4', mime: 'video/mp4', type: 'video' };
  }
  if (buf.slice(0, 3).toString() === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return { ext: 'mp3', mime: 'audio/mpeg', type: 'audio' };
  return null;
}
// tiny in-memory rate limiter (per process)
const hits = new Map();
function limited(key, max, windowMs) {
  const t = Date.now();
  const arr = (hits.get(key) || []).filter((x) => t - x < windowMs);
  arr.push(t); hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}
const ipOf = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

/* ---------- pages ---------- */
function editorPage(baseUrl) {
  const v = (() => { try { return fs.statSync(path.join(DIST_DIR, 'editor.js')).mtimeMs.toString(36); } catch { return '0'; } })();
  return page('Wedding Invitation Video — Paigaam', `
<div id="wv-root" data-asset-base="/wedding-video/assets">
  <noscript>The video editor needs JavaScript.</noscript>
  <div style="padding:80px 20px;text-align:center;font-family:Georgia,serif;color:#8F1018">Loading the editor…</div>
</div>`, { current: '/wedding-video', noFooter: true, scripts: `<script src="/wedding-video/static/editor.js?v=${v}" defer></script>`, canonical: '/wedding-video' });
}

function sharePage(inv, baseUrl, isOwner) {
  const d = inv.data || {};
  const c = d.couple || {};
  const names = d.meta && d.meta.order === 'groom_first' ? `${c.groom || ''} & ${c.bride || ''}` : `${c.bride || ''} & ${c.groom || ''}`;
  const r916 = store.latestRender(inv.id, '9x16');
  const r169 = store.latestRender(inv.id, '16x9');
  const wishes = store.wishesFor(inv.id);
  const map = d.closing && d.closing.mapLink;
  const vid = r916 ? `<video src="/w/${inv.id}/video-9x16.mp4" controls playsinline preload="metadata" style="width:100%;max-width:420px;aspect-ratio:9/16;border-radius:14px;background:#000;box-shadow:0 18px 40px rgba(90,20,30,.25)"></video>`
    : `<div style="padding:60px 20px;border:1px dashed #d8b4a0;border-radius:14px">The film is still being prepared. Please check back soon.</div>`;
  return page(`${esc(names)} — Wedding Invitation`, `
<main style="max-width:980px;margin:0 auto;padding:32px 18px 60px;font-family:'Josefin Sans',system-ui,sans-serif;color:#5a1a24">
  <h1 style="font-family:Georgia,serif;font-weight:400;text-align:center;font-size:2.2rem;margin:.2em 0">${esc(names)}</h1>
  <p style="text-align:center;margin-top:0;opacity:.8">${esc((d.mainCard && d.mainCard.dateLine) || '')}${d.mainCard && d.mainCard.venueLine ? ' · ' + esc(d.mainCard.venueLine) : ''}</p>
  <div style="display:flex;flex-wrap:wrap;gap:28px;justify-content:center;align-items:flex-start;margin-top:22px">
    <div style="flex:1 1 320px;max-width:420px;text-align:center">${vid}
      <div style="display:flex;gap:10px;justify-content:center;margin-top:14px;flex-wrap:wrap">
        ${r916 ? `<a class="btn" href="/w/${inv.id}/video-9x16.mp4?download=1" style="padding:10px 16px;border-radius:999px;background:#8F1018;color:#fff;text-decoration:none">Download MP4 (9:16)</a>` : ''}
        ${r169 ? `<a class="btn" href="/w/${inv.id}/video-16x9.mp4?download=1" style="padding:10px 16px;border-radius:999px;border:1px solid #8F1018;color:#8F1018;text-decoration:none">Download MP4 (16:9)</a>` : ''}
        ${map ? `<a href="${esc(map)}" target="_blank" rel="noopener noreferrer" style="padding:10px 16px;border-radius:999px;border:1px solid #8F1018;color:#8F1018;text-decoration:none">Directions</a>` : ''}
      </div>
    </div>
    <div style="flex:1 1 320px;max-width:440px">
      <h2 style="font-family:Georgia,serif;font-weight:400">RSVP &amp; wishes</h2>
      <form id="rsvp" style="display:grid;gap:10px">
        <input name="name" required maxlength="60" placeholder="Your name" style="padding:12px;border:1px solid #e3c9bb;border-radius:10px">
        <select name="attending" style="padding:12px;border:1px solid #e3c9bb;border-radius:10px"><option value="yes">Joyfully attending</option><option value="maybe">Hoping to attend</option><option value="no">Regretfully can't attend</option></select>
        <input name="guests" type="number" min="1" max="20" value="1" style="padding:12px;border:1px solid #e3c9bb;border-radius:10px" aria-label="Number of guests">
        <textarea name="message" maxlength="500" rows="3" placeholder="Your wishes for the couple (shown below)" style="padding:12px;border:1px solid #e3c9bb;border-radius:10px"></textarea>
        <button style="padding:12px;border:0;border-radius:999px;background:#8F1018;color:#fff;font-size:1rem">Send</button>
        <div id="rsvp-msg" role="status"></div>
      </form>
      <div style="margin-top:22px">${wishes.map((w) => `<blockquote style="margin:0 0 12px;padding:12px 14px;background:#fff7f0;border-left:3px solid #e07a8f;border-radius:6px">${esc(w.message)}<br><small style="opacity:.7">— ${esc(w.name)}</small></blockquote>`).join('')}</div>
      ${isOwner ? `<p><a href="/wedding-video?invite=${inv.id}">Edit this invitation</a> · <a href="/api/wedding-video/invites/${inv.id}/rsvps.csv">Download RSVPs (CSV)</a></p>` : ''}
    </div>
  </div>
</main>
<script>
document.getElementById('rsvp').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target); const m = document.getElementById('rsvp-msg');
  const r = await fetch('/api/wedding-video/w/${inv.id}/rsvp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(f)) });
  m.textContent = r.ok ? 'Thank you! Your RSVP has been sent.' : 'Sorry, that could not be sent. Please try again.';
  if (r.ok) e.target.reset();
});
</script>`, { current: `/w/${inv.id}`, noFooter: true, canonical: null, headExtra: '<meta name="robots" content="noindex">' });
}

/* ---------- router ---------- */
async function handle(req, res, u, ctx = {}) {
  const p = u.pathname;
  if (!(p === '/wedding-video' || p.startsWith('/wedding-video/') || p.startsWith('/api/wedding-video/') || /^\/w\/[a-f0-9]{24}(\/|$)/.test(p))) return false;
  if (!started) { started = true; jobs.start({ baseUrl: ctx.baseUrl }); }
  const baseUrl = ctx.baseUrl || '';
  try {
    // static
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (p === '/wedding-video') { html(res, 200, editorPage(baseUrl)); return true; }
      let m;
      if ((m = /^\/wedding-video\/assets\/((?:art|fonts|brand|stories|sample|music)\/[\w\-.]+)$/.exec(p))) {
        const file = path.join(ASSET_DIR, m[1]);
        if (!streamFile(req, res, file, ASSET_MIME[path.extname(file)] || 'application/octet-stream', 'public, max-age=86400')) throw new HttpError(404, 'not_found');
        return true;
      }
      if ((m = /^\/wedding-video\/static\/(editor\.js(?:\.map)?)$/.exec(p))) {
        if (!streamFile(req, res, path.join(DIST_DIR, m[1]), ASSET_MIME[path.extname(m[1])], 'public, max-age=300')) throw new HttpError(404, 'editor_not_built');
        return true;
      }
      if ((m = /^\/wedding-video\/media\/([a-f0-9]{32}\.(?:mp3|m4a))$/.exec(p))) {
        const row = store.mediaByFile(m[1]);
        if (!row || !streamFile(req, res, store.mediaPath(row.filename), row.mime, 'private, max-age=86400')) throw new HttpError(404, 'not_found');
        return true;
      }
      if ((m = /^\/w\/([a-f0-9]{24})\/?$/.exec(p))) {
        const inv = store.getInvite(m[1]);
        if (!inv) throw new HttpError(404, 'not_found');
        const tok = ownerToken(req);
        html(res, 200, sharePage(inv, baseUrl, !!tok && store.hash(tok) === inv.owner_hash));
        return true;
      }
      if ((m = /^\/w\/([a-f0-9]{24})\/video-(9x16|16x9)\.mp4$/.exec(p))) {
        const r = store.latestRender(m[1], m[2]);
        if (!r) throw new HttpError(404, 'not_rendered');
        if (u.searchParams.get('download')) res.setHeader('Content-Disposition', `attachment; filename="wedding-invitation-${m[2]}.mp4"`);
        if (!streamFile(req, res, path.join(store.RENDER_DIR, r.result.file), 'video/mp4', 'public, max-age=3600')) throw new HttpError(404, 'not_found');
        return true;
      }
    }

    // API
    let m;
    if (p === '/api/wedding-video/config' && req.method === 'GET') {
      const { SAMPLE } = await schema();
      const sample = JSON.parse(JSON.stringify(SAMPLE));
      let music = [];
      try { music = JSON.parse(fs.readFileSync(path.join(ASSET_DIR, 'music', 'library.json'), 'utf8')).filter((m) => m && /^music\/[\w\-.]+$/.test(m.src) && fs.existsSync(path.join(ASSET_DIR, m.src))); } catch { /* no library */ }
      const { STORY_LIBRARY } = await import('../wedding-video/src/lib/themes.js');
      return json(res, 200, { sample, music, stories: STORY_LIBRARY }), true;
    }
    if (p === '/api/wedding-video/invites' && req.method === 'POST') {
      const { normalize } = await schema();
      const own = ensureOwner(req, res, baseUrl);
      if (store.invitesToday(own.hash) >= 20 || limited('inv:' + ipOf(req), 30, 3600000)) throw new HttpError(429, 'rate_limited');
      const body = await readJson(req);
      const id = store.createInvite(own.hash, normalize(body.data));
      return json(res, 201, { id }, own.setCookie ? { 'Set-Cookie': own.setCookie } : {}), true;
    }
    if ((m = /^\/api\/wedding-video\/invites\/([a-f0-9]{24})$/.exec(p))) {
      const inv = ownInvite(req, m[1]);
      if (req.method === 'GET') return json(res, 200, { id: inv.id, data: inv.data, jobs: store.jobsForInvite(inv.id), share: `/w/${inv.id}` }), true;
      if (req.method === 'PUT') {
        const { normalize } = await schema();
        const body = await readJson(req);
        store.updateInvite(inv.id, normalize(body.data));
        return json(res, 200, { ok: true }), true;
      }
    }
    if ((m = /^\/api\/wedding-video\/invites\/([a-f0-9]{24})\/media$/.exec(p)) && req.method === 'POST') {
      const inv = ownInvite(req, m[1]);
      const kind = u.searchParams.get('kind');
      if (!MAX[kind]) throw new HttpError(400, 'bad_kind');
      if (store.mediaCount(inv.id, kind) >= PER_INVITE[kind]) throw new HttpError(429, 'too_many_files');
      const buf = await readBody(req, MAX[kind]);
      const t = sniff(buf);
      const ok = t && (t.type === 'audio' || t.ext === 'mp4');
      if (!ok) throw new HttpError(415, 'unsupported_file');
      const saved = store.addMedia(inv.id, kind, kind === 'music' && t.ext === 'mp4' ? 'm4a' : t.ext, kind === 'music' && t.ext === 'mp4' ? 'audio/mp4' : t.mime, buf);
      return json(res, 201, { url: saved.url }), true;
    }
    if ((m = /^\/api\/wedding-video\/invites\/([a-f0-9]{24})\/render$/.exec(p)) && req.method === 'POST') {
      const inv = ownInvite(req, m[1]);
      const b = await readJson(req, 4096);
      if (store.activeJobs(inv.id, 'render') >= 2 || limited('render:' + inv.id, 12, 86400000)) throw new HttpError(429, 'rate_limited');
      const id = jobs.enqueue(inv.id, 'render', { format: b.format === '16x9' ? '16x9' : '9x16' });
      return json(res, 202, { jobId: id }), true;
    }
    if ((m = /^\/api\/wedding-video\/jobs\/([a-f0-9]{24})$/.exec(p)) && req.method === 'GET') {
      const job = store.getJob(m[1]);
      if (!job) throw new HttpError(404, 'not_found');
      ownInvite(req, job.invite_id);
      return json(res, 200, { id: job.id, kind: job.kind, status: job.status, stage: job.stage, progress: job.progress, result: job.result, error: job.error }), true;
    }
    if ((m = /^\/api\/wedding-video\/w\/([a-f0-9]{24})\/rsvp$/.exec(p)) && req.method === 'POST') {
      const inv = store.getInvite(m[1]);
      if (!inv) throw new HttpError(404, 'not_found');
      const ip = ipOf(req);
      if (limited('rsvp:' + ip, 10, 3600000) || store.rsvpsFromIpToday(inv.id, ip) >= 10) throw new HttpError(429, 'rate_limited');
      const b = await readJson(req, 8192);
      const name = String(b.name || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 60);
      if (!name) throw new HttpError(400, 'name_required');
      store.addRsvp(inv.id, {
        name,
        attending: ['yes', 'no', 'maybe'].includes(b.attending) ? b.attending : 'yes',
        guests: Math.max(1, Math.min(20, parseInt(b.guests, 10) || 1)),
        message: String(b.message || '').replace(/[\u0000-\u0009\u000b-\u001f]/g, '').trim().slice(0, 500),
      }, ip);
      return json(res, 201, { ok: true }), true;
    }
    if ((m = /^\/api\/wedding-video\/invites\/([a-f0-9]{24})\/rsvps(\.csv)?$/.exec(p)) && req.method === 'GET') {
      const inv = ownInvite(req, m[1]);
      const rows = store.rsvpsFor(inv.id);
      if (!m[2]) return json(res, 200, { rsvps: rows }), true;
      const cell = (v) => `"${String(v).replace(/"/g, '""').replace(/^[=+\-@]/, "'$&")}"`;
      const csv = ['name,attending,guests,message,date', ...rows.map((r) => [r.name, r.attending, r.guests, r.message, new Date(r.created_at).toISOString()].map(cell).join(','))].join('\n');
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="rsvps.csv"', 'Cache-Control': 'no-store' });
      res.end(csv);
      return true;
    }
    if (p.startsWith('/api/wedding-video/')) throw new HttpError(404, 'not_found');
    return false;
  } catch (e) {
    if (e instanceof HttpError) {
      if (p.startsWith('/api/')) json(res, e.status, { error: e.code });
      else html(res, e.status, page('Not found — Paigaam', `<main style="padding:80px 20px;text-align:center">This page isn't available.</main>`, { noFooter: true }));
      return true;
    }
    console.error('[wedding-video] error:', e);
    json(res, 500, { error: 'server_error' });
    return true;
  }
}

module.exports = { handle, sniff };
