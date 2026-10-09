'use strict';
// Dev tool: pack wedding-video/public/{art,fonts,brand,stories} into assets/wedding-video/*.b64 + manifest
// (the repository integration is text-only). Run after changing template art.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const src = path.join(__dirname, '../wedding-video/public');
const out = path.join(__dirname, '../assets/wedding-video');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const manifest = {};
for (const dir of ['art', 'fonts', 'brand', 'stories']) {
  for (const f of fs.readdirSync(path.join(src, dir)).sort()) {
    const rel = `${dir}/${f}`;
    if (!/^(art|fonts|brand|stories)\/[\w\-.]+\.(jpg|webp|png|ttf|mp4)$/.test(rel)) continue;
    const bytes = fs.readFileSync(path.join(src, rel));
    manifest[rel] = crypto.createHash('sha256').update(bytes).digest('hex');
    const b64 = bytes.toString('base64');
    const base = rel.replace('/', '__');
    const PART = 2_400_000; // keep every text file small enough for API-based commits
    if (b64.length <= PART) fs.writeFileSync(path.join(out, base + '.b64'), b64 + '\n');
    else for (let i = 0, n = 0; i < b64.length; i += PART, n++) fs.writeFileSync(path.join(out, `${base}.b64.part${String(n).padStart(2, '0')}`), b64.slice(i, i + PART) + '\n');
  }
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(`[wedding-video] packed ${Object.keys(manifest).length} files`);
