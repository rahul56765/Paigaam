'use strict';
// Run after editing the public botanical/share assets. Runtime restores these text-packed bytes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const files = ['cloth.webp', 'envelope.webp', 'feet.webp', 'garland-left.webp', 'garland-right.webp', 'itinerary-leaves.webp', 'save-leaves-right.webp', 'save-leaves.webp', 'thumbnail.webp'];
const target = path.join(root, 'assets', 'patra-vivah');
fs.mkdirSync(target, { recursive: true });
const manifest = {};
for (const file of files) {
  const data = fs.readFileSync(path.join(root, 'public', 'patra-vivah', file));
  manifest['patra-vivah/' + file] = crypto.createHash('sha256').update(data).digest('hex');
  fs.writeFileSync(path.join(target, file + '.b64'), data.toString('base64') + '\n');
}
fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Packed ' + files.length + ' Patra Vivah assets.');
