'use strict';
// Decode and checksum the independent Vivah template asset pack.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const source = path.join(__dirname, '../assets/vivah-video');
const dest = path.join(__dirname, '../vivah-video/public');
if (!fs.existsSync(path.join(source, 'manifest.json'))) { console.log('[vivah-video] no asset pack; skipping'); process.exit(0); }
const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
let n = 0;
for (const [rel, expected] of Object.entries(manifest)) {
  if (!/^(art|fonts|brand|stories)\/[\w\-.]+\.(jpg|webp|png|ttf|mp4)$/.test(rel)) throw new Error('Invalid asset path: ' + rel);
  const target = path.join(dest, rel);
  if (fs.existsSync(target) && crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex') === expected) { n++; continue; }
  const base = rel.replace('/', '__');
  const single = path.join(source, base + '.b64');
  const b64 = fs.existsSync(single) ? fs.readFileSync(single, 'utf8').trim() : fs.readdirSync(source).filter((f) => f.startsWith(base + '.b64.part')).sort().map((f) => fs.readFileSync(path.join(source, f), 'utf8').trim()).join('');
  const bytes = Buffer.from(b64, 'base64');
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('Asset checksum mismatch: ' + rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  n++;
}
console.log(`[vivah-video] ${n} template assets verified`);
