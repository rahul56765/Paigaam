'use strict';
// Shubh Sangam artwork is stored as checksummed text for text-only publishing.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..', '..', 'assets', 'shubh-sangam');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const assets = Object.entries(manifest).map(([assetPath, sha256]) => ({
  path: assetPath,
  sha256,
  data: fs.readFileSync(path.join(root, path.basename(assetPath) + '.b64'), 'utf8').trim(),
}));
function ensureShubhSangamAssets() {
  const publicRoot = path.join(__dirname, '..', '..', 'public');
  const written = [];
  for (const asset of assets) {
    const file = path.join(publicRoot, asset.path);
    let ok = false;
    try { ok = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') === asset.sha256; } catch { /* restore below */ }
    if (ok) continue;
    const bytes = Buffer.from(asset.data, 'base64');
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error(`Shubh Sangam asset checksum mismatch: ${asset.path}`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
    written.push(asset.path);
  }
  return written;
}
module.exports = { assets, ensureShubhSangamAssets };
