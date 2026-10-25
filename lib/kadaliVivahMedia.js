'use strict';
// Restore original artwork and the byte-identical owner-supplied opening film.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const SOURCE = path.join(__dirname, '../assets/kadali-vivah');
const DEST = path.join(__dirname, '../public/kadali-vivah');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function ensureKadaliVivahMedia() {
  const file = path.join(SOURCE, 'manifest.json');
  if (!fs.existsSync(file)) return [];
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8')), healed = [];
  for (const [key, spec] of Object.entries(manifest)) {
    if (!/^(art\/[a-z0-9-]+\.webp|opening\.(mp4)|opening-(poster|end)\.jpg)$/.test(key)) throw new Error('invalid Kadali media path: ' + key);
    const expected = typeof spec === 'string' ? spec : spec.sha256;
    if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error('invalid Kadali checksum');
    const target = path.join(DEST, key); fs.mkdirSync(path.dirname(target), {recursive:true});
    try { if (hash(fs.readFileSync(target)) === expected) continue; } catch {}
    let encoded;
    if (typeof spec === 'string') encoded = fs.readFileSync(path.join(SOURCE, key.replace('/', '__') + '.b64'), 'utf8').trim();
    else {
      if (!Number.isInteger(spec.parts) || spec.parts < 1 || spec.parts > 20) throw new Error('invalid Kadali media parts');
      encoded = Array.from({length:spec.parts}, (_, i) => fs.readFileSync(path.join(SOURCE, key + '.b64.part' + String(i+1).padStart(2,'0')), 'utf8').trim()).join('');
    }
    const bytes = Buffer.from(encoded, 'base64');
    if (hash(bytes) !== expected || (spec.bytes && bytes.length !== spec.bytes)) throw new Error('Kadali media checksum mismatch: ' + key);
    const tmp = target + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, bytes, {mode:0o644}); fs.renameSync(tmp, target); healed.push(key);
  }
  return healed;
}
module.exports = {ensureKadaliVivahMedia};
