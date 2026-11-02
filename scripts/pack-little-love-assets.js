'use strict';
// Build-time only: pack original media for the text-only GitHub transport.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const files = ['tulips.webp', 'penguins.webp', 'matcha-cat.webp', 'bow-cat.webp', 'mini-bouquet.webp', 'song-cover.webp', 'thumbnail.webp', 'little-melody.mp3', 'fonts/pixelify.ttf', 'fonts/homemade-apple.ttf'];
const directory = path.join(root, 'assets/little-love');
fs.mkdirSync(directory, { recursive: true });
const manifest = files.map(file => {
  const bytes = fs.readFileSync(path.join(root, 'public/little-love', file));
  const packed = file.replaceAll('/', '--') + '.b64';
  fs.writeFileSync(path.join(directory, packed), bytes.toString('base64') + '\n');
  return { file, packed, size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
});
fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Packed ${manifest.length} Little Love assets (${manifest.reduce((n, item) => n + item.size, 0)} bytes).`);
