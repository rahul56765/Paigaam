'use strict';
/**
 * Magazine routes (isolated from greeting templates, payments and publishing).
 * Reader:  /magazines, /magazines/:slug, /magazines/m/:id[/magazine.pdf|png], /api/magazines/...
 * Admin:   /admin/magazines, /admin/canva/{connect,callback,disconnect}, /admin/magazines/:slug/{validate,publish,unpublish}
 * Privacy: draft photos are readable only by the creating browser (owner cookie); finished files are served by an
 *          unguessable 128-bit id (capability link), never by Canva's expiring URLs.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const cfg = require('./magazines/config');
const store = require('./magazines/store');
const client = require('./magazines/canvaClient');
const validate = require('./magazines/validate');
const storage = require('./magazines/storage');
const generate = require('./magazines/generate');
const preview = require('./magazines/preview');
const views = require('./magazines/views');
const { sniffImage } = require('./magazines/image');
const { MAGAZINES, bySlug } = require('./magazines/registry');
const { streamFile } = require('./streamFile');

const COOKIE = 'paigaam_mag';
const uploading = new Set();

store.ensureTemplateRows(MAGAZINES);
fs.mkdirSync(cfg.ROOT, { recursive: true });
setImmediate(() => {
  try { generate.resumeInterrupted(); generate.sweep(); } catch (e) { console.error('[magazines] startup tasks failed:', e.message); }
  // Create one cached fictional sample for each published multi-page template when missing.
  for (const mapping of MAGAZINES) {
    if (mapping.pageCount > 1 && store.isPublished(mapping.slug) && preview.needsSample(mapping)) {
      preview.refreshSample(mapping).catch(e => console.error('[magazines] fictional sample preview failed:', mapping.slug, e && e.code || e && e.message || 'error'));
    }
  }
});
setInterval(() => { try { generate.sweep(); } catch { /* next tick */ } }, 3600000).unref();

class HttpError extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }

function ownerHash(req) {
  const raw = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='));
  const v = raw ? raw.slice(COOKIE.length + 1) : '';
  return /^[a-f0-9]{64}$/.test(v) ? store.hashOwner(v) : null;
}
const isOwner = (req, order) => { const h = ownerHash(req); return !!h && h === order.owner_hash; };
const secure = (baseUrl) => { try { return new URL(baseUrl).protocol === 'https:'; } catch { return false; } };

function sendJson(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}
function sendHtml(res, status, html, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(html);
}
const redirect = (res, to) => { res.writeHead(302, { Location: to, 'Cache-Control': 'no-store' }); res.end(); };

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0, tooBig = false;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { // keep draining (bounded) so the client receives a clean 413 instead of a reset
        tooBig = true; chunks.length = 0;
        if (size > limit * 4) { req.destroy(); reject(new HttpError(413, 'too_large')); }
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => (tooBig ? reject(new HttpError(413, 'too_large')) : resolve(Buffer.concat(chunks))));
    req.on('error', () => reject(new HttpError(400, 'bad_request')));
  });
}
async function readJson(req) {
  const buf = await readBody(req, 16 * 1024);
  if (!buf.length) return {};
  try { const v = JSON.parse(buf.toString('utf8')); return v && typeof v === 'object' ? v : {}; } catch { throw new HttpError(400, 'bad_request'); }
}

/* ---------- helpers ---------- */
function mappingFor(slug) { const m = bySlug(slug); if (!m) throw new HttpError(404, 'not_found'); return m; }
function loadOwned(req, id) {
  const order = store.getOrder(id);
  if (!order) throw new HttpError(404, 'not_found');
  if (!isOwner(req, order)) throw new HttpError(403, 'forbidden');
  return order;
}
const editable = (order) => { if (!(order.status === 'draft' || order.status === 'failed')) throw new HttpError(409, 'locked'); };
const available = (slug) => store.isPublished(slug) && store.isConnected();

function statusPayload(order, mapping, req) {
  const ready = order.status === 'ready';
  return {
    id: order.id, status: order.status, owner: isOwner(req, order),
    error: order.status === 'failed' ? { code: order.error_code, message: client.safeMessage(order.error_code) } : null,
    files: ready ? { pdf: `/magazines/m/${order.id}/magazine.pdf`, png: order.png_file && mapping.pageCount === 1 ? `/magazines/m/${order.id}/magazine.png` : null } : null,
  };
}

/* ---------- reader API ---------- */
async function readerApi(req, res, p, u, { baseUrl }) {
  const m = req.method;
  if (m === 'POST' && p === '/api/magazines/drafts') {
    const { slug } = await readJson(req);
    const mapping = mappingFor(String(slug));
    if (!available(mapping.slug)) throw new HttpError(404, 'template_unavailable');
    let token = null, hash = ownerHash(req);
    if (!hash) { token = crypto.randomBytes(32).toString('hex'); hash = store.hashOwner(token); }
    if (store.ordersTodayFor(hash) >= cfg.DRAFTS_PER_DAY) throw new HttpError(429, 'limit');
    const order = store.createOrder(mapping.slug, hash);
    if (token) res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure(baseUrl) ? '; Secure' : ''}`);
    return sendJson(res, 201, { id: order.id });
  }
  if (m === 'GET' && p === '/api/magazines/drafts/current') {
    const hash = ownerHash(req);
    const mapping = mappingFor(String(u.searchParams.get('slug') || ''));
    const order = hash ? store.latestOrderFor(hash, mapping.slug) : null;
    if (!order || (order.status === 'ready' && Date.now() - order.ready_at > 3600000)) return sendJson(res, 200, { order: null });
    return sendJson(res, 200, { order: { id: order.id, status: order.status, fields: store.orderFields(order), slots: store.listUploads(order.id).map(x => x.slot) } });
  }
  let r;
  if ((r = p.match(/^\/api\/magazines\/drafts\/([a-f0-9]{32})\/photos\/([a-z0-9_]{1,24})$/))) {
    const [, id, slot] = r;
    const order = loadOwned(req, id), mapping = mappingFor(order.template_slug);
    const slotDef = mapping.images.find(s => s.key === slot);
    if (!slotDef) throw new HttpError(404, 'not_found');
    if (m === 'GET') { // private thumbnail for the owner only
      const up = store.getUpload(id, slot);
      if (!up) throw new HttpError(404, 'not_found');
      if (!streamFile(req, res, storage.safePath(storage.uploadsDir(id), up.filename), up.mime, 'private, no-store')) throw new HttpError(404, 'not_found');
      return;
    }
    editable(order);
    if (m === 'DELETE') {
      const up = store.getUpload(id, slot);
      if (up) { fs.rmSync(storage.safePath(storage.uploadsDir(id), up.filename), { force: true }); store.removeUpload(id, slot); }
      return sendJson(res, 200, { ok: true });
    }
    if (m === 'PUT') {
      if (uploading.has(id)) throw new HttpError(429, 'limit');
      uploading.add(id);
      try {
        const declared = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        if (!mapping.limits.mimes.includes(declared)) throw new HttpError(415, 'invalid_image');
        const buf = await readBody(req, mapping.limits.maxImageBytes);
        const sniff = sniffImage(buf);
        if (!sniff || sniff.mime !== declared) throw new HttpError(415, 'invalid_image'); // contents must match the claimed type
        if (!sniff.width || !sniff.height || Math.min(sniff.width, sniff.height) < mapping.limits.minImageSide || Math.max(sniff.width, sniff.height) > 12000) throw new HttpError(422, 'too_small');
        const dir = storage.uploadsDir(id);
        const filename = crypto.randomBytes(18).toString('hex') + '.' + sniff.ext;
        fs.writeFileSync(storage.safePath(dir, filename), buf, { flag: 'wx', mode: 0o600 });
        const prev = store.getUpload(id, slot);
        store.putUpload(id, slot, { filename, mime: sniff.mime, bytes: buf.length, width: sniff.width, height: sniff.height });
        if (prev) fs.rmSync(storage.safePath(dir, prev.filename), { force: true });
        if (order.status === 'failed') store.patchOrder(id, { autofill_job_id: null, design_id: null, pdf_job_id: null, png_job_id: null, pdf_file: null, png_file: null }); // changed photo => regenerate from scratch
        return sendJson(res, 200, { slot, bytes: buf.length, width: sniff.width, height: sniff.height });
      } finally { uploading.delete(id); }
    }
    throw new HttpError(405, 'method_not_allowed');
  }
  if ((r = p.match(/^\/api\/magazines\/drafts\/([a-f0-9]{32})$/)) && m === 'PUT') {
    const order = loadOwned(req, r[1]); editable(order);
    const mapping = mappingFor(order.template_slug);
    const body = await readJson(req);
    const check = validate.validateFields(mapping, body.fields);
    if (!check.ok) return sendJson(res, 422, { error: 'invalid_fields', details: check.errors });
    store.patchOrder(order.id, { fields_json: JSON.stringify(check.values) });
    if (order.status === 'failed') store.patchOrder(order.id, { autofill_job_id: null, design_id: null, pdf_job_id: null, png_job_id: null, pdf_file: null, png_file: null });
    return sendJson(res, 200, { ok: true });
  }
  if ((r = p.match(/^\/api\/magazines\/drafts\/([a-f0-9]{32})\/generate$/)) && m === 'POST') {
    const order = loadOwned(req, r[1]);
    const mapping = mappingFor(order.template_slug);
    await readJson(req);
    const result = generate.start(order.id); // idempotent: a double-click or retry never starts a second run
    if (result.error) return sendJson(res, result.error === 'not_found' ? 404 : 409, { error: result.error, details: result.details });
    return sendJson(res, 202, statusPayload(store.getOrder(order.id), mapping, req));
  }
  if ((r = p.match(/^\/api\/magazines\/([a-f0-9]{32})\/status$/)) && m === 'GET') {
    const order = store.getOrder(r[1]);
    if (!order) throw new HttpError(404, 'not_found');
    return sendJson(res, 200, statusPayload(order, mappingFor(order.template_slug), req));
  }
  throw new HttpError(404, 'not_found');
}

/* ---------- public pages ---------- */
async function pages(req, res, p, u, { isAdmin }) {
  if (p === '/magazines') {
    const items = MAGAZINES.filter(mg => available(mg.slug)).map(mg => ({ ...mg, hasPreview: !!preview.find(mg.slug), hasSample: !!preview.findSamplePdf(mg.slug) }));
    return sendHtml(res, 200, views.catalogue(items));
  }
  let r;
  if ((r = p.match(/^\/magazines\/sample\/([a-z0-9-]{1,60})\/sample\.pdf$/))) {
    const mapping = bySlug(r[1]);
    const found = mapping && (available(mapping.slug) || isAdmin) ? preview.findSamplePdf(mapping.slug) : null;
    if (!found) return sendHtml(res, 404, views.notFound(), { 'X-Robots-Tag': 'noindex' });
    res.setHeader('Content-Disposition', `inline; filename="paigaam-fictional-sample-${mapping.slug}.pdf"`);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (!streamFile(req, res, found.file, found.mime, 'public, max-age=3600')) return sendHtml(res, 404, views.notFound());
    return;
  }
  if ((r = p.match(/^\/magazines\/sample\/([a-z0-9-]{1,60})$/))) {
    const mapping = bySlug(r[1]);
    const found = mapping && (available(mapping.slug) || isAdmin) ? preview.findSamplePdf(mapping.slug) : null;
    if (!mapping || !found) return sendHtml(res, 404, views.notFound(), { 'X-Robots-Tag': 'noindex' });
    return sendHtml(res, 200, views.samplePage(mapping, { pdfUrl: `/magazines/sample/${mapping.slug}/sample.pdf` }),
      { 'Cache-Control': 'public, max-age=300', 'X-Robots-Tag': 'noindex, follow' });
  }
  if ((r = p.match(/^\/magazines\/preview\/([a-z0-9-]{1,60})$/))) {
    const mapping = bySlug(r[1]); const found = mapping && (available(mapping.slug) || isAdmin) ? preview.find(mapping.slug) : null;
    if (!found || !streamFile(req, res, found.file, found.mime, 'public, max-age=600')) return sendHtml(res, 404, views.notFound(), { 'X-Robots-Tag': 'noindex' });
    return;
  }
  if ((r = p.match(/^\/magazines\/m\/([a-f0-9]{32})$/))) {
    const order = store.getOrder(r[1]);
    if (!order) return sendHtml(res, 404, views.notFound(), { 'X-Robots-Tag': 'noindex' });
    const mapping = mappingFor(order.template_slug);
    return sendHtml(res, 200, views.resultPage(order, mapping, { owner: isOwner(req, order), ready: { png: !!order.png_file && mapping.pageCount === 1 } }),
      { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
  }
  if ((r = p.match(/^\/magazines\/m\/([a-f0-9]{32})\/magazine\.(pdf|png)$/))) {
    const order = store.getOrder(r[1]);
    const mapping = order && bySlug(order.template_slug);
    const kind = r[2];
    const file = order && order.status === 'ready' ? (kind === 'pdf' ? order.pdf_file : (mapping.pageCount === 1 ? order.png_file : null)) : null;
    if (!file) return sendHtml(res, 404, views.notFound(), { 'X-Robots-Tag': 'noindex' });
    res.setHeader('Content-Disposition', `${u.searchParams.get('download') ? 'attachment' : 'inline'}; filename="paigaam-magazine-${order.id.slice(0, 8)}.${kind}"`);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (!streamFile(req, res, storage.safePath(storage.outputDir(order.id), file), kind === 'pdf' ? 'application/pdf' : 'image/png', 'private, max-age=300')) {
      return sendHtml(res, 404, views.notFound());
    }
    return;
  }
  if ((r = p.match(/^\/magazines\/([a-z0-9-]{1,60})$/))) {
    const mapping = bySlug(r[1]);
    if (!mapping) return sendHtml(res, 404, views.notFound(), { 'X-Robots-Tag': 'noindex' });
    if (!available(mapping.slug)) {
      if (isAdmin) return sendHtml(res, 200, views.formPage(mapping, { preview: true, hasPreview: !!preview.find(mapping.slug) }));
      return sendHtml(res, 404, views.notFound(), { 'X-Robots-Tag': 'noindex' });
    }
    return sendHtml(res, 200, views.formPage(mapping, { hasPreview: !!preview.find(mapping.slug) }));
  }
  throw new HttpError(404, 'not_found');
}

/* ---------- admin ---------- */
function sameOrigin(req, baseUrl) {
  const origin = req.headers.origin || (req.headers.referer ? (() => { try { return new URL(req.headers.referer).origin; } catch { return ''; } })() : '');
  try { return !origin || origin === new URL(baseUrl).origin; } catch { return false; }
}
const flashTo = (res, msg) => redirect(res, '/admin/magazines?msg=' + encodeURIComponent(msg));

async function adminRoutes(req, res, p, u, { baseUrl, admin }) {
  if (!admin) return redirect(res, '/admin/login');
  const m = req.method;
  if (m !== 'GET' && !sameOrigin(req, baseUrl)) throw new HttpError(403, 'forbidden');
  if (m === 'GET' && p === '/admin/magazines') {
    const templates = MAGAZINES.map(mapping => ({ mapping, row: store.getTemplate(mapping.slug) }));
    return sendHtml(res, 200, views.adminPage({ configured: cfg.configured(), connection: store.getConnection(), templates, orders: store.listOrders(30), flash: (u.searchParams.get('msg') || '').slice(0, 200) }),
      { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
  }
  if (m === 'GET' && p === '/admin/canva/connect') {
    if (!cfg.configured()) return flashTo(res, 'Canva credentials are not configured on the server.');
    return redirect(res, client.beginAuthorization({ baseUrl, adminId: admin.id }));
  }
  if (m === 'GET' && p === '/admin/canva/callback') {
    if (u.searchParams.get('error')) return flashTo(res, 'Canva connection was cancelled.');
    try {
      await client.completeAuthorization({ code: String(u.searchParams.get('code') || ''), state: String(u.searchParams.get('state') || ''), baseUrl, adminId: admin.id });
      return flashTo(res, 'Canva account connected.');
    } catch (e) {
      return flashTo(res, e.code === 'oauth_state_invalid' ? 'That connection attempt expired or was invalid. Please try again.' : client.safeMessage(e.code));
    }
  }
  if (m === 'POST' && p === '/admin/canva/disconnect') { await client.revokeConnection(); return flashTo(res, 'Canva disconnected.'); }
  let r;
  if ((r = p.match(/^\/admin\/magazines\/([a-z0-9-]{1,60})\/(validate|publish|unpublish)$/)) && m === 'POST') {
    const mapping = mappingFor(r[1]);
    if (r[2] === 'unpublish') { store.setTemplateStatus(mapping.slug, 'draft'); return flashTo(res, `${mapping.name} unpublished.`); }
    if (r[2] === 'validate') {
      try {
        const result = validate.compareDataset(mapping, await client.getDataset(mapping.canvaTemplateId));
        store.saveValidation(mapping.slug, result);
        if (result.ok) {
          try { await preview.refresh(mapping); } catch { /* cover thumbnail is optional */ }
          if (mapping.pageCount > 1 && preview.needsSample(mapping)) {
            // Generate the fictional sample from this verified template in the background.
            // refreshSample is idempotent and resumes a saved Canva job rather than creating duplicates.
            setImmediate(() => preview.refreshSample(mapping).catch(e => {
              console.error('[magazines] fictional sample preview failed:', mapping.slug, e && e.code || e && e.message || 'error');
            }));
            return flashTo(res, `${mapping.name}: fields match Canva. A fictional sample preview is being generated; it will appear on the catalogue when ready.`);
          }
        }
        return flashTo(res, result.ok ? `${mapping.name}: fields match the live Canva template.` : `${mapping.name}: mismatch with the live Canva template — see details. Publishing is blocked.`);
      } catch (e) { return flashTo(res, `Validation failed: ${client.safeMessage(e.code)}`); }
    }
    const row = store.getTemplate(mapping.slug);
    if (!store.isConnected()) return flashTo(res, 'Connect Canva before publishing.');
    if (!row || !row.validated_at || !row.validation.ok) return flashTo(res, 'Validate against Canva successfully before publishing.');
    store.setTemplateStatus(mapping.slug, 'published');
    return flashTo(res, `${mapping.name} is now live at /magazines/${mapping.slug}.`);
  }
  if ((r = p.match(/^\/admin\/magazines\/orders\/([a-f0-9]{32})\/retry$/)) && m === 'POST') {
    const result = generate.start(r[1]);
    return flashTo(res, result.started ? 'Retry started.' : `Could not retry: ${result.error || 'not in a retryable state'}.`);
  }
  throw new HttpError(404, 'not_found');
}

async function handle(req, res, u, { baseUrl, admin = null } = {}) {
  const p = u.pathname.replace(/\/+$/, '') || '/';
  const isApi = p.startsWith('/api/magazines');
  const isPage = p === '/magazines' || p.startsWith('/magazines/');
  const isAdminRoute = p === '/admin/magazines' || p.startsWith('/admin/magazines/') || p.startsWith('/admin/canva/');
  if (!isApi && !isPage && !isAdminRoute) return false;
  try {
    if (isAdminRoute) await adminRoutes(req, res, p, u, { baseUrl, admin });
    else if (isApi) await readerApi(req, res, p, u, { baseUrl });
    else if (['GET', 'HEAD'].includes(req.method)) await pages(req, res, p, u, { isAdmin: !!admin });
    else throw new HttpError(405, 'method_not_allowed');
  } catch (e) {
    if (res.headersSent) { try { res.end(); } catch { /* socket gone */ } return true; }
    if (e instanceof HttpError) {
      if (isApi) sendJson(res, e.status, { error: e.code });
      else sendHtml(res, e.status, views.notFound(), { 'X-Robots-Tag': 'noindex' });
    } else {
      console.error('[magazines] route error:', e && e.message); // message only: never log request bodies or tokens
      if (isApi) sendJson(res, 500, { error: 'internal_error' });
      else sendHtml(res, 500, views.notFound());
    }
  }
  return true;
}
module.exports = { handle };
