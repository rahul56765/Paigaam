'use strict';
// Deterministic binary restoration for the text-only repository delivery path.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const source = path.join(root, 'assets/divya-vivah');
const destination = path.join(root, 'public/divya-vivah');
const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
for (const file of manifest.files) {
 if (!/^(?:fonts\/)?[A-Za-z0-9._-]+$/.test(file.path)) throw new Error('Invalid Divya Vivah asset path');
 const encoded = file.parts.map(name => {
  if (!/^[A-Za-z0-9._-]+$/.test(name)) throw new Error('Invalid Divya Vivah asset part');
  return fs.readFileSync(path.join(source, name), 'utf8').trim();
 }).join('');
 const bytes = Buffer.from(encoded, 'base64');
 if (bytes.length !== file.bytes || crypto.createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error('Divya Vivah asset checksum mismatch: ' + file.path);
 const dest = path.join(destination, file.path);
 fs.mkdirSync(path.dirname(dest), {recursive:true});
 fs.writeFileSync(dest, bytes);
}
console.log('[divya-vivah] restored and verified ' + manifest.files.length + ' assets');
