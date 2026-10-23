'use strict';
// Pack Suvarna Vivah's video opener and poster into checksummed base64 text chunks.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const src = path.join(root, 'public/suvarna-vivah');
const out = path.join(root, 'assets/suvarna-vivah');
fs.mkdirSync(out, { recursive: true });
const manifest = {};
for (const name of ['opening.mp4', 'opening-poster.jpg']) {
  const bytes = fs.readFileSync(path.join(src, name));
  const encoded = bytes.toString('base64');
  const chunks = encoded.match(/[\s\S]{1,2000000}/g) || [];
  manifest[name] = { sha256: crypto.createHash('sha256').update(bytes).digest('hex'), parts: chunks.length };
  chunks.forEach((chunk, i) => fs.writeFileSync(path.join(out, name + '.b64.part' + String(i + 1).padStart(2, '0')), chunk + '\n'));
}
for (const name of fs.readdirSync(out)) if (name.endsWith('.b64.part' + '01') || name.includes('.b64.part')) {
  const match = /^(opening\.(?:mp4|jpg)|opening-poster\.jpg)\.b64\.part(\d+)$/.exec(name);
  if (!match || Number(match[2]) > (manifest[match[1]]?.parts || 0)) fs.rmSync(path.join(out, name));
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('packed', Object.keys(manifest).length, 'files into', Object.values(manifest).reduce((n, x) => n + x.parts, 0), 'parts');
