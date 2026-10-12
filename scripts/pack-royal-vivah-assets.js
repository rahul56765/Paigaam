'use strict';
// Store static wedding artwork as text-only base64 + a SHA-256 manifest so the
// repository's GitHub publishing path can ship it. Runtime restores each file
// into public/royal-vivah/ through lib/bfday/assets.js.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public/royal-vivah');
const outDir = path.join(root, 'assets/royal-vivah');
fs.mkdirSync(outDir, { recursive: true });
const manifest = {};
for (const file of ['envelope.webp', 'envelope-open.webp', 'envelope-open.mp4', 'save-date-handoff.mp4', 'save-date.webp', 'families.webp', 'events.webp', 'invitation.webp']) {
  const bytes = fs.readFileSync(path.join(publicDir, file));
  manifest['royal-vivah/' + file] = crypto.createHash('sha256').update(bytes).digest('hex');
  fs.writeFileSync(path.join(outDir, file + '.b64'), bytes.toString('base64') + '\n');
}
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('packed', Object.keys(manifest).length, 'Royal Vivah illustrations');
