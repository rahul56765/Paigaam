'use strict';
// Restores the Suvarna Vivah video opener and poster from checksummed, chunked base64 sources.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const SOURCE = path.join(__dirname, '../assets/suvarna-vivah');
const DEST = path.join(__dirname, '../public/suvarna-vivah');
function ensureSuvarnaVivahMedia() {
  const mf = path.join(SOURCE, 'manifest.json');
  if (!fs.existsSync(mf)) return [];
  const manifest = JSON.parse(fs.readFileSync(mf, 'utf8'));
  const healed = [];
  for (const [name, spec] of Object.entries(manifest)) {
    if (!/^[a-z0-9-]+\.(mp4|jpg|webp)$/.test(name) || !spec || !/^[a-f0-9]{64}$/.test(spec.sha256) || !Number.isInteger(spec.parts) || spec.parts < 1 || spec.parts > 20) throw new Error('invalid Suvarna Vivah media manifest entry: ' + name);
    const target = path.join(DEST, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const intact = (() => { try { return crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex') === spec.sha256; } catch { return false; } })();
    if (intact) continue;
    const parts = [];
    for (let i = 0; i < spec.parts; i++) {
      const part = path.join(SOURCE, name + '.b64.part' + String(i + 1).padStart(2, '0'));
      if (!fs.existsSync(part)) throw new Error('missing Suvarna Vivah media part: ' + path.basename(part));
      parts.push(fs.readFileSync(part, 'utf8').trim());
    }
    const bytes = Buffer.from(parts.join(''), 'base64');
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== spec.sha256) throw new Error('Suvarna Vivah media checksum mismatch: ' + name);
    const tmp = target + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, bytes, { mode: 0o644 });
    fs.renameSync(tmp, target); healed.push(name);
  }
  return healed;
}
module.exports = { ensureSuvarnaVivahMedia };
