'use strict';
// Lossless asset packaging for the text-only repository integration (same scheme as prepare-ganapati).
// Decodes assets/wedding-video/*.b64 into wedding-video/public/{art,fonts,brand} and verifies sha256.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const source = path.join(__dirname, '../assets/wedding-video');
const dest = path.join(__dirname, '../wedding-video/public');
if (!fs.existsSync(path.join(source, 'manifest.json'))) { console.log('[wedding-video] no asset pack; skipping'); process.exit(0); }
const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
let n = 0;
for (const [rel, expected] of Object.entries(manifest)) {
  if (!/^(art|fonts|brand)\/[\w\-.]+\.(jpg|webp|png|ttf)$/.test(rel)) throw new Error('Invalid asset path: ' + rel);
  const target = path.join(dest, rel);
  if (fs.existsSync(target) && crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex') === expected) { n++; continue; }
  const bytes = Buffer.from(fs.readFileSync(path.join(source, rel.replace('/', '__') + '.b64'), 'utf8').trim(), 'base64');
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('Asset checksum mismatch: ' + rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  n++;
}
console.log(`[wedding-video] ${n} template assets verified`);
