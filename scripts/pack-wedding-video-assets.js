'use strict';
// Dev tool: pack wedding-video/public/{art,fonts,brand} into assets/wedding-video/*.b64 + manifest
// (the repository integration is text-only). Run after changing template art.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const src = path.join(__dirname, '../wedding-video/public');
const out = path.join(__dirname, '../assets/wedding-video');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const manifest = {};
for (const dir of ['art', 'fonts', 'brand']) {
  for (const f of fs.readdirSync(path.join(src, dir)).sort()) {
    const rel = `${dir}/${f}`;
    if (!/^(art|fonts|brand)\/[\w\-.]+\.(jpg|webp|png|ttf)$/.test(rel)) continue;
    const bytes = fs.readFileSync(path.join(src, rel));
    manifest[rel] = crypto.createHash('sha256').update(bytes).digest('hex');
    fs.writeFileSync(path.join(out, rel.replace('/', '__') + '.b64'), bytes.toString('base64') + '\n');
  }
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(`[wedding-video] packed ${Object.keys(manifest).length} files`);
