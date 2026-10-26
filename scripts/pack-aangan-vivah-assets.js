'use strict';
// Pack the reference-guided invitation illustrations as small text-only base64
// files plus SHA-256 metadata. The shared bfday asset loader restores them into
// public/aangan-vivah/ at server startup.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public/aangan-vivah');
const outDir = path.join(root, 'assets/aangan-vivah');
const files = ['door.webp', 'door-left.webp', 'door-right.webp', 'monogram.webp', 'invitation.webp', 'haldi.webp', 'sangeet.webp', 'wedding.webp', 'reception.webp', 'closing.webp'];
fs.mkdirSync(outDir, { recursive: true });
const manifest = {};
for (const name of files) {
  const bytes = fs.readFileSync(path.join(publicDir, name));
  manifest[`aangan-vivah/${name}`] = crypto.createHash('sha256').update(bytes).digest('hex');
  fs.writeFileSync(path.join(outDir, `${name}.b64`), bytes.toString('base64') + '\n');
}
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Packed ${files.length} Aangan Vivah illustrations (${(Object.values(manifest).length)} checksums).`);
