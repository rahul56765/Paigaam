'use strict';
// Restores Birthday Paigaam demo media (illustrated polaroids, portrait, share
// card, demo voice note) from checksummed base64 sources at boot — the same
// self-healing pattern as lib/loveAwaitsMedia.js: git only ever carries text.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const SOURCE = path.join(__dirname, '../assets/birthday-paigaam');
const DEST = path.join(__dirname, '../public/birthday-paigaam/demo-media');

function ensureBirthdayPaigaamMedia() {
  const manifest = JSON.parse(fs.readFileSync(path.join(SOURCE, 'manifest.json'), 'utf8'));
  fs.mkdirSync(DEST, { recursive: true });
  const healed = [];
  for (const [name, expected] of Object.entries(manifest)) {
    if (!/^bp-[a-z0-9-]+\.(jpg|mp3)$/.test(name)) throw new Error('invalid media filename: ' + name);
    const target = path.join(DEST, name);
    const intact = (() => { try { return crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex') === expected; } catch { return false; } })();
    if (intact) continue;
    const bytes = Buffer.from(fs.readFileSync(path.join(SOURCE, name + '.b64'), 'utf8').trim(), 'base64');
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('media checksum mismatch: ' + name);
    const tmp = target + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, bytes, { mode: 0o644 });
    fs.renameSync(tmp, target);
    healed.push(name);
  }
  return healed;
}

module.exports = { ensureBirthdayPaigaamMedia };
