'use strict';
// Restores Kadali Vivah art + music from checksummed base64 sources at boot
// (same self-healing pattern as lib/birthdayPaigaamMedia.js). Packed by
// scripts/pack-kadali-media.js.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const SOURCE = path.join(__dirname, '../assets/kadali-vivah');
const DEST = path.join(__dirname, '../public/kadali-vivah');

function ensureKadaliVivahMedia() {
  const file = path.join(SOURCE, 'manifest.json');
  if (!fs.existsSync(file)) return [];
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  const healed = [];
  for (const [key, expected] of Object.entries(manifest)) {
    if (!/^(art)\/[a-z0-9-]+\.(webp)$/.test(key)) throw new Error('invalid media name: ' + key);
    const target = path.join(DEST, key);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const intact = (() => { try { return crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex') === expected; } catch { return false; } })();
    if (intact) continue;
    const bytes = Buffer.from(fs.readFileSync(path.join(SOURCE, key.replace('/', '__') + '.b64'), 'utf8').trim(), 'base64');
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('media checksum mismatch: ' + key);
    const tmp = target + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, bytes, { mode: 0o644 });
    fs.renameSync(tmp, target);
    healed.push(key);
  }
  return healed;
}
module.exports = { ensureKadaliVivahMedia };
