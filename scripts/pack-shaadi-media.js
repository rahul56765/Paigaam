'use strict';
// Packs Shaadi Paigaam binary media (art + music) into checksummed base64 text
// under assets/shaadi-paigaam/ — git only ever carries text. Restored at boot
// by lib/shaadiPaigaamMedia.js. Run after changing any file in
// public/shaadi-paigaam/{art,music}/:  node scripts/pack-shaadi-media.js
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.join(__dirname, '..'), out = path.join(root, 'assets/shaadi-paigaam');
fs.mkdirSync(out, { recursive: true });
const manifest = {};
for (const dir of ['art', 'music', 'fonts']) {
  const src = path.join(root, 'public/shaadi-paigaam', dir);
  if (!fs.existsSync(src)) continue;
  for (const f of fs.readdirSync(src).sort()) {
    if (!/^[a-z0-9-]+\.(webp|jpg|png|mp3|ttf)$/.test(f)) continue;
    const bytes = fs.readFileSync(path.join(src, f));
    const key = dir + '/' + f;
    manifest[key] = crypto.createHash('sha256').update(bytes).digest('hex');
    fs.writeFileSync(path.join(out, dir + '__' + f + '.b64'), bytes.toString('base64') + '\n');
  }
}
for (const f of fs.readdirSync(out)) if (f.endsWith('.b64') && !manifest[f.replace('__', '/').replace(/\.b64$/, '')]) fs.rmSync(path.join(out, f));
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log('packed', Object.keys(manifest).length, 'files');
