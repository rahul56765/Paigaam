'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const packedRoot = path.resolve(__dirname, '../assets/little-love');
function hash(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function prepare({ outputDir = path.resolve(__dirname, '../public/little-love'), verifyOnly = false } = {}) {
  const manifest = JSON.parse(fs.readFileSync(path.join(packedRoot, 'manifest.json'), 'utf8'));
  for (const item of manifest) {
    if (!/^(?:fonts\/)?[a-z0-9-]+\.(webp|ttf|mp3)$/.test(item.file) || !/^[a-z0-9.-]+\.b64$/.test(item.packed) || !/^[a-f0-9]{64}$/.test(item.sha256)) throw new Error('Invalid Little Love asset manifest');
    const bytes = Buffer.from(fs.readFileSync(path.join(packedRoot, item.packed), 'utf8').trim(), 'base64');
    if (bytes.length !== item.size || hash(bytes) !== item.sha256) throw new Error(`Little Love packed asset checksum failed: ${item.file}`);
    const destination = path.join(outputDir, item.file);
    if (fs.existsSync(destination) && hash(fs.readFileSync(destination)) === item.sha256) continue;
    if (verifyOnly) throw new Error(`Little Love generated asset is missing or changed: ${item.file}`);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes);
  }
  return manifest.length;
}
if (require.main === module) console.log(`[little-love] ${prepare({ verifyOnly: process.argv.includes('--verify') })} assets verified`);
module.exports = { prepare };
