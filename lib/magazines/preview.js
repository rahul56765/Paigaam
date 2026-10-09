'use strict';
/** Cached Canva cover thumbnail and one fictional Autofill sample PDF per multi-page Brand Template. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cfg = require('./config');
const client = require('./canvaClient');
const { canvaSampleData } = require('./sampleData');
const { sniffImage } = require('./image');

const SLUG = /^[a-z0-9-]{1,60}$/;
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const ASSET_DIR = path.join(__dirname, 'sample-assets');
const sampleRuns = new Map();
let assetUploadRun = null;

const dir = () => { const d = path.join(cfg.ROOT, 'previews'); fs.mkdirSync(d, { recursive: true }); return d; };
const samplePdfPath = (slug) => path.join(dir(), `${slug}.sample.pdf`);
const sampleStatePath = (slug) => path.join(dir(), `${slug}.sample.json`);
const assetCachePath = () => path.join(dir(), 'sample-assets.json');
const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } };
function writeJson(file, value) {
  const tmp = file + '.part';
  fs.writeFileSync(tmp, JSON.stringify(value), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

/** Returns { file, mime } for the cached one-page Canva Brand Template thumbnail. */
function find(slug) {
  if (!SLUG.test(slug)) return null;
  for (const [mime, ext] of Object.entries(EXT)) {
    const file = path.join(dir(), `${slug}.${ext}`);
    if (fs.existsSync(file)) return { file, mime };
  }
  return null;
}
async function refresh(mapping) {
  const meta = await client.getBrandTemplate(mapping.canvaTemplateId);
  const url = meta && meta.thumbnail && meta.thumbnail.url;
  if (!url) return false;
  const buf = await client.downloadExport(url, 15 * 1024 * 1024);
  const sniff = sniffImage(buf);
  if (!sniff) return false;
  for (const ext of Object.values(EXT)) fs.rmSync(path.join(dir(), `${mapping.slug}.${ext}`), { force: true });
  const target = path.join(dir(), `${mapping.slug}.${sniff.ext}`);
  fs.writeFileSync(target + '.part', buf, { mode: 0o600 });
  fs.renameSync(target + '.part', target);
  return true;
}

/** Returns the cached, fictional multi-page sample PDF or null. Never serves Canva's expiring URLs. */
function findSamplePdf(slug) {
  if (!SLUG.test(slug)) return null;
  const file = samplePdfPath(slug);
  return fs.existsSync(file) ? { file, mime: 'application/pdf' } : null;
}

function sampleAssetPool() {
  const names = fs.readdirSync(ASSET_DIR).filter(f => /^moment-\d+\.jpg\.b64$/.test(f)).sort();
  if (!names.length) throw new Error('sample assets missing');
  return names.map((name) => {
    const buf = Buffer.from(fs.readFileSync(path.join(ASSET_DIR, name), 'utf8').trim(), 'base64');
    if (buf.length < 1000 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) throw new Error('sample asset invalid');
    return { name: name.replace(/\.b64$/, ''), buf };
  });
}

function getSampleAssetIds() {
  if (assetUploadRun) return assetUploadRun;
  assetUploadRun = getSampleAssetIdsOnce().finally(() => { assetUploadRun = null; });
  return assetUploadRun;
}
async function getSampleAssetIdsOnce() {
  const file = assetCachePath(), cache = readJson(file), pool = sampleAssetPool();
  for (const asset of pool) {
    if (typeof cache[asset.name] === 'string' && /^[A-Za-z0-9_-]{3,100}$/.test(cache[asset.name])) continue;
    let job = await client.uploadAsset(asset.buf, `paigaam-fictional-${asset.name}`);
    if (!job || !job.id) throw new Error('sample asset upload did not return a job');
    if (job.status !== 'success') job = await client.pollJob(client.getAssetUpload, job.id);
    const assetId = job && job.asset && job.asset.id;
    if (typeof assetId !== 'string' || !assetId) throw new Error('sample asset upload did not return an asset id');
    cache[asset.name] = assetId;
    writeJson(file, cache); // save every completed upload so retries never upload it twice
  }
  return pool.map(a => ({ name: a.name, assetId: cache[a.name] }));
}

function sampleFingerprint(mapping) {
  const shape = {
    canvaTemplateId: mapping.canvaTemplateId,
    pageCount: mapping.pageCount,
    fields: (mapping.fields || []).map(f => ({ key: f.key, canvaName: f.canvaName, canvaNames: f.canvaNames, type: f.type, label: f.label, maxLength: f.maxLength, required: f.required, defaultValue: f.defaultValue, sampleValue: f.sampleValue, placeholder: f.placeholder })),
    images: (mapping.images || []).map(i => ({ key: i.key, canvaName: i.canvaName, canvaNames: i.canvaNames })),
  };
  return crypto.createHash('sha256').update(JSON.stringify(shape)).digest('hex');
}
function needsSample(mapping) {
  if (!mapping || !SLUG.test(mapping.slug) || Number(mapping.pageCount) < 2) return false;
  const state = readJson(sampleStatePath(mapping.slug));
  return !findSamplePdf(mapping.slug) || state.fingerprint !== sampleFingerprint(mapping);
}
async function createSample(mapping) {
  if (!mapping || !SLUG.test(mapping.slug) || Number(mapping.pageCount) < 2) return null;
  if (!needsSample(mapping)) return findSamplePdf(mapping.slug);
  if (sampleRuns.has(mapping.slug)) return sampleRuns.get(mapping.slug);
  const work = createSampleOne(mapping).finally(() => sampleRuns.delete(mapping.slug));
  sampleRuns.set(mapping.slug, work);
  return work;
}

async function createSampleOne(mapping) {
  const stateFile = sampleStatePath(mapping.slug), pdfFile = samplePdfPath(mapping.slug);
  const fingerprint = sampleFingerprint(mapping);
  let state = readJson(stateFile);
  if (state.fingerprint && state.fingerprint !== fingerprint) {
    state = { v: 1, slug: mapping.slug, fingerprint };
  }
  state.v = 1;
  state.slug = mapping.slug;
  state.fingerprint = fingerprint;
  state.title = `PAIGAAM Fictional Sample — ${String(mapping.name || mapping.slug).slice(0, 120)}`;
  state.updatedAt = Date.now();

  // Each photo is uploaded once and cached by its bundled demo filename for future templates.
  const assets = (mapping.images || []).length ? await getSampleAssetIds() : [];
  if (!state.designId) {
    if (!state.autofillJobId) {
      const data = canvaSampleData(mapping, assets);
      const started = await client.createAutofill({ templateId: mapping.canvaTemplateId, data, title: state.title });
      if (!started || !started.id) throw new Error('sample Autofill did not return a job id');
      state.autofillJobId = started.id;
      writeJson(stateFile, state); // persist before polling; a restart must not create a duplicate design
    }
    let job;
    try { job = await client.pollJob(client.getAutofill, state.autofillJobId); }
    catch (e) {
      if (e && e.jobFailed) { state.autofillJobId = null; state.lastError = String(e.code || 'canva_job_failed'); writeJson(stateFile, state); }
      throw e;
    }
    const design = job && job.result && job.result.design;
    if (!design || typeof design.id !== 'string') throw new Error('sample Autofill completed without a design id');
    state.designId = design.id;
    writeJson(stateFile, state);
  }

  if (!state.exportJobId) {
    const started = await client.createExport(state.designId, 'pdf');
    if (!started || !started.id) throw new Error('sample PDF export did not return a job id');
    state.exportJobId = started.id;
    writeJson(stateFile, state);
  }
  let exported;
  try { exported = await client.pollJob(client.getExport, state.exportJobId); }
  catch (e) {
    if (e && e.jobFailed) { state.exportJobId = null; state.lastError = String(e.code || 'canva_job_failed'); writeJson(stateFile, state); }
    throw e;
  }
  const url = exported && Array.isArray(exported.urls) && exported.urls[0];
  if (!url) throw new Error('sample PDF export returned no URL');
  const pdf = await client.downloadExport(url, cfg.MAX_PDF_BYTES);
  if (pdf.length < 8 || pdf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('sample export is not a PDF');
  const tmp = pdfFile + '.part';
  fs.writeFileSync(tmp, pdf, { mode: 0o644 });
  fs.renameSync(tmp, pdfFile);
  state.readyAt = Date.now();
  state.pageCount = Number(mapping.pageCount) || null;
  state.lastError = null;
  writeJson(stateFile, state);
  return { file: pdfFile, mime: 'application/pdf' };
}

/** Retry any interrupted sample job for this mapping; existing PDFs are a no-op. */
async function refreshSample(mapping) { return createSample(mapping); }

module.exports = { find, refresh, findSamplePdf, refreshSample, needsSample, sampleAssetPool };
