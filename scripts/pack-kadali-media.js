'use strict';
// Original generated artwork; text-pack it for GitHub and verify hashes at boot.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.join(__dirname, '..'), out = path.join(root, 'assets/kadali-vivah');
fs.mkdirSync(out, {recursive:true});
const manifest = {};
for (const name of ['leaf','kalash','mandap']) {
  const key = 'art/' + name + '.webp';
  const bytes = fs.readFileSync(path.join(root, 'public/kadali-vivah', key));
  manifest[key] = crypto.createHash('sha256').update(bytes).digest('hex');
  fs.writeFileSync(path.join(out, key.replace('/','__')+'.b64'), bytes.toString('base64')+'\n');
}
fs.writeFileSync(path.join(out,'manifest.json'), JSON.stringify(manifest,null,2)+'\n');
console.log('Packed 3 Kadali Vivah art plates.');
