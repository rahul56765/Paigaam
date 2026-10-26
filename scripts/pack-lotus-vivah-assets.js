'use strict';
// Run after editing the public botanical/share assets. Runtime restores these text-packed bytes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const files = ['blossom.webp', 'stems.webp', 'garden.webp', 'petal.webp', 'thumbnail.webp', 'cover-lotus.webp', 'border-spray.webp'];
const target = path.join(root, 'assets', 'lotus-vivah');
fs.mkdirSync(target, { recursive: true });
const manifest = {};
for (const file of files) {
  const data = fs.readFileSync(path.join(root, 'public', 'lotus-vivah', file));
  manifest['lotus-vivah/' + file] = crypto.createHash('sha256').update(data).digest('hex');
  fs.writeFileSync(path.join(target, file + '.b64'), data.toString('base64') + '\n');
}
fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Packed ' + files.length + ' Lotus Vivah assets.');
