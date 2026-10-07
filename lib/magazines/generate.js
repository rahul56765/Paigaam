'use strict';
/**
 * Generation pipeline: preparing -> uploading -> generating -> exporting -> ready (or failed).
 *
 * Idempotent + resumable: every Canva id (asset ids, autofill job, design, export jobs) is saved
 * the moment it is known, so a retry continues from the last good step and NEVER creates a second
 * design. Only a Canva job that reported `failed` has its saved id cleared (so it can be re-created).
 * Duplicate submits are absorbed by a compare-and-swap status change.
 * Never calls update_design: reader submissions always create a NEW design from the Brand Template.
 */
const fs = require('node:fs');
const path = require('node:path');
const cfg = require('./config');
const store = require('./store');
const client = require('./canvaClient');
const validate = require('./validate');
const storage = require('./storage');
const { bySlug } = require('./registry');

const queue = [];
const running = new Set();
let active = 0;

function enqueue(id) {
  if (running.has(id) || queue.includes(id)) return;
  queue.push(id);
  pump();
}
function pump() {
  while (active < cfg.CONCURRENCY && queue.length) {
    const id = queue.shift();
    running.add(id); active++;
    run(id).catch((e) => console.error('[magazines] unexpected pipeline error:', e && e.code || e && e.message))
      .finally(() => { running.delete(id); active--; pump(); });
  }
}

/** Validate the order and flip draft|failed -> queued exactly once. Returns { started, order, error? }. */
function start(orderId) {
  const order = store.getOrder(orderId);
  if (!order) return { started: false, error: 'not_found' };
  if (order.status !== 'draft' && order.status !== 'failed') return { started: false, order }; // in progress or ready: no-op
  const mapping = bySlug(order.template_slug);
  if (!mapping || !store.isPublished(mapping.slug)) return { started: false, order, error: 'template_unavailable' };
  if (!store.isConnected()) return { started: false, order, error: 'canva_not_connected' };
  const check = validate.validateFields(mapping, store.orderFields(order));
  if (!check.ok) return { started: false, order, error: 'invalid_fields', details: check.errors };
  const missing = validate.missingImages(mapping, store.listUploads(order.id));
  if (missing.length) return { started: false, order, error: 'missing_photos', details: missing };
  const won = store.casStatus(order.id, ['draft', 'failed'], 'queued',
    { error_code: null, error_stage: null, attempts: order.attempts + 1 });
  if (!won) return { started: false, order: store.getOrder(order.id) }; // a concurrent submit already started it
  enqueue(order.id);
  return { started: true, order: store.getOrder(order.id) };
}

async function run(orderId) {
  let stage = 'preparing';
  const setStage = (s) => { stage = s; store.casStatus(orderId, store.IN_PROGRESS, s); };
  try {
    setStage('preparing');
    let order = store.getOrder(orderId);
    const mapping = bySlug(order.template_slug);
    if (!mapping || !store.isPublished(mapping.slug)) throw new client.CanvaError('template_unavailable', { retryable: false });

    // Live dataset must still match the mapping — blocks generation if the Canva design drifted.
    const live = validate.compareDataset(mapping, await client.getDataset(mapping.canvaTemplateId));
    if (!live.ok) { store.saveValidation(mapping.slug, live); throw new client.CanvaError('template_mismatch', { retryable: false }); }

    /* ---- uploading: reader photos -> Canva assets (asset ids, never raw URLs) ---- */
    setStage('uploading');
    const uploadsDir = storage.uploadsDir(orderId);
    for (const slot of mapping.images) {
      const up = store.getUpload(orderId, slot.key);
      if (!up) throw new client.CanvaError('missing_photos', { retryable: false });
      if (up.canva_asset_id) continue; // resume: already uploaded
      const buf = fs.readFileSync(storage.safePath(uploadsDir, up.filename));
      let job = await client.uploadAsset(buf, `${mapping.slug}-${slot.key}`);
      if (job.status !== 'success') job = await client.pollJob(client.getAssetUpload, job.id);
      if (!job.asset || !job.asset.id) throw new client.CanvaError('canva_job_failed');
      store.setAssetId(orderId, slot.key, job.asset.id);
    }

    /* ---- generating: Autofill from the Brand Template (new design per reader) ---- */
    setStage('generating');
    order = store.getOrder(orderId);
    if (!order.design_id) {
      let jobId = order.autofill_job_id;
      if (!jobId) {
        const data = {};
        for (const [name, text] of Object.entries(validate.canvaText(mapping, store.orderFields(order)))) data[name] = { type: 'text', text };
        for (const u of store.listUploads(orderId)) {
          const slot = mapping.images.find(s => s.key === u.slot);
          if (slot) data[slot.canvaName] = { type: 'image', asset_id: u.canva_asset_id };
        }
        const created = await client.createAutofill({ templateId: mapping.canvaTemplateId, data, title: `${mapping.name} ${orderId.slice(0, 8)}` });
        jobId = created.id;
        store.patchOrder(orderId, { autofill_job_id: jobId }); // persist before polling so a crash can resume
      }
      let job;
      try { job = await client.pollJob(client.getAutofill, jobId); }
      catch (e) { if (e.jobFailed) store.patchOrder(orderId, { autofill_job_id: null }); throw e; }
      const designId = job.result && job.result.design && job.result.design.id;
      if (!designId) { store.patchOrder(orderId, { autofill_job_id: null }); throw new client.CanvaError('canva_job_failed'); }
      store.patchOrder(orderId, { design_id: designId });
    }

    /* ---- exporting: PDF always; PNG only for single-page designs ---- */
    setStage('exporting');
    order = store.getOrder(orderId);
    const outDir = storage.outputDir(orderId);
    if (!order.pdf_file) await exportFile({ orderId, type: 'pdf', jobCol: 'pdf_job_id', fileCol: 'pdf_file', maxBytes: cfg.MAX_PDF_BYTES, magic: (b) => b.slice(0, 5).toString('latin1') === '%PDF-', outDir, singleOnly: false });
    if (mapping.pageCount === 1 && !store.getOrder(orderId).png_file) {
      await exportFile({ orderId, type: 'png', jobCol: 'png_job_id', fileCol: 'png_file', maxBytes: cfg.MAX_PNG_BYTES, magic: (b) => b.readUInt32BE(0) === 0x89504E47, outDir, singleOnly: true });
    }

    store.casStatus(orderId, store.IN_PROGRESS, 'ready', { ready_at: Date.now(), error_code: null, error_stage: null });
    storage.removeOrderFiles(orderId, { keepOutput: true }); // reader's source photos are no longer needed
  } catch (e) {
    const code = e && e.code && typeof e.code === 'string' ? e.code : 'internal_error';
    console.error(`[magazines] order ${orderId.slice(0, 8)} failed at ${stage}: ${code}${e && e.providerCode ? ' (' + e.providerCode + ')' : ''}`);
    store.casStatus(orderId, store.IN_PROGRESS, 'failed', { error_code: code, error_stage: stage });
  }
}

async function exportFile({ orderId, type, jobCol, fileCol, maxBytes, magic, outDir, singleOnly }) {
  const order = store.getOrder(orderId);
  let jobId = order[jobCol];
  if (!jobId) {
    const created = await client.createExport(order.design_id, type);
    jobId = created.id;
    store.patchOrder(orderId, { [jobCol]: jobId });
  }
  let job;
  try { job = await client.pollJob(client.getExport, jobId); }
  catch (e) { if (e.jobFailed) store.patchOrder(orderId, { [jobCol]: null }); throw e; }
  const urls = Array.isArray(job.urls) ? job.urls : [];
  if (!urls.length || (singleOnly && urls.length !== 1)) {
    if (singleOnly) return; // multi-page result: never offer a PNG
    throw new client.CanvaError('canva_job_failed');
  }
  const buf = await client.downloadExport(urls[0], maxBytes); // Canva URLs expire — copy into durable storage now
  if (!magic(buf)) throw new client.CanvaError('download_failed');
  const name = type === 'pdf' ? 'magazine.pdf' : 'magazine.png';
  const finalPath = storage.safePath(outDir, name), tmp = storage.safePath(outDir, name + '.part');
  fs.writeFileSync(tmp, buf, { mode: 0o600 });
  fs.renameSync(tmp, finalPath); // atomic: readers never see a half-written file
  store.patchOrder(orderId, { [fileCol]: name });
}

/** On boot: resume orders that were mid-pipeline (steps are resumable), bounded to recent ones. */
function resumeInterrupted() {
  for (const o of store.inProgressOrders()) {
    if (Date.now() - o.updated_at > 3600000) store.casStatus(o.id, store.IN_PROGRESS, 'failed', { error_code: 'interrupted', error_stage: o.status });
    else enqueue(o.id);
  }
}

/** Remove abandoned drafts, old failures and orphan files. Never touches ready magazines. */
function sweep() {
  const stale = store.staleOrders(Date.now() - cfg.DRAFT_TTL_MS, Date.now() - cfg.FAILED_TTL_MS);
  for (const { id } of stale) { storage.removeOrderFiles(id); store.deleteOrder(id); }
  const dir = path.join(cfg.ROOT, 'uploads');
  try {
    for (const id of fs.readdirSync(dir)) {
      const full = path.join(dir, id);
      if (!storage.ID.test(id)) continue;
      const order = store.getOrder(id);
      if (!order) { fs.rmSync(full, { recursive: true, force: true }); continue; }
      const known = new Set(store.listUploads(id).map(u => u.filename));
      for (const f of fs.readdirSync(full)) {
        const st = fs.statSync(path.join(full, f));
        if (!known.has(f) && Date.now() - st.mtimeMs > 3600000) fs.rmSync(path.join(full, f), { force: true });
      }
    }
  } catch { /* uploads dir may not exist yet */ }
  return stale.length;
}

module.exports = { start, run, enqueue, resumeInterrupted, sweep, _state: { queue, running } };
