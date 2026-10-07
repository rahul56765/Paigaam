'use strict';
/** Cached sample image of each Brand Template (Canva thumbnail), copied to DATA_DIR so it never depends on expiring URLs. */
const fs = require('node:fs');
const path = require('node:path');
const cfg = require('./config');
const client = require('./canvaClient');
const { sniffImage } = require('./image');

const dir = () => { const d = path.join(cfg.ROOT, 'previews'); fs.mkdirSync(d, { recursive: true }); return d; };
const SLUG = /^[a-z0-9-]{1,60}$/;
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Returns { file, mime } or null. */
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
module.exports = { find, refresh };
