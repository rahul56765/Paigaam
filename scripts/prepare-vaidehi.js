'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const packedRoot = path.resolve(__dirname, '../assets/vaidehi');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function prepare({ outputDir = path.resolve(__dirname, '../public/vaidehi'), demoDir = path.resolve(__dirname, '../public/assets/bfday-demo'), verifyOnly = false } = {}) {
  const manifest = JSON.parse(fs.readFileSync(path.join(packedRoot, 'manifest.json'), 'utf8'));
  for (const item of manifest) {
    if (!/^(?:fonts\/)?[a-z0-9-]+\.(webp|ttf)$/.test(item.file) || !/^[a-z0-9.-]+\.b64$/.test(item.packed) || !/^[a-f0-9]{64}$/.test(item.sha256)) throw new Error('Invalid Vaidehi asset manifest');
    const bytes = Buffer.from(fs.readFileSync(path.join(packedRoot, item.packed), 'utf8').trim(), 'base64');
    if (bytes.length !== item.size || sha(bytes) !== item.sha256) throw new Error(`Vaidehi asset checksum failed: ${item.file}`);
    const destinations = [path.join(outputDir, item.file)];
    if (/^demo-[1-4]\.webp$/.test(item.file)) destinations.push(path.join(demoDir, 'vaidehi-' + item.file));
    for (const destination of destinations) {
      if (fs.existsSync(destination) && sha(fs.readFileSync(destination)) === item.sha256) continue;
      if (verifyOnly) throw new Error(`Vaidehi generated asset missing or changed: ${item.file}`);
      fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, bytes);
    }
  }
  return manifest.length;
}
if (require.main === module) console.log(`[vaidehi] ${prepare({ verifyOnly: process.argv.includes('--verify') })} assets verified`);
module.exports = { prepare };
