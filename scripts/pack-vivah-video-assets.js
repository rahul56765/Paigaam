'use strict';
// Package Vivah public media as small base64 text chunks for GitHub API uploads.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const src = path.join(__dirname, '../vivah-video/public');
const out = path.join(__dirname, '../assets/vivah-video');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const manifest = {};
for (const dir of ['art', 'fonts', 'brand', 'stories']) {
  const folder = path.join(src, dir); if (!fs.existsSync(folder)) continue;
  for (const f of fs.readdirSync(folder).sort()) {
    const rel = `${dir}/${f}`;
    if (!/^(art|fonts|brand|stories)\/[\w\-.]+\.(jpg|webp|png|ttf|mp4)$/.test(rel)) continue;
    const bytes = fs.readFileSync(path.join(src, rel)); manifest[rel] = crypto.createHash('sha256').update(bytes).digest('hex');
    const b64 = bytes.toString('base64'), base = rel.replace('/', '__'), PART = 2_400_000;
    if (b64.length <= PART) fs.writeFileSync(path.join(out, base + '.b64'), b64 + '\n');
    else for (let i = 0, n = 0; i < b64.length; i += PART, n++) fs.writeFileSync(path.join(out, `${base}.b64.part${String(n).padStart(2, '0')}`), b64.slice(i, i + PART) + '\n');
  }
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(`[vivah-video] packed ${Object.keys(manifest).length} assets`);
