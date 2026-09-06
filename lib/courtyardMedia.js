'use strict';
// Restores Ganpati Courtyard media from the checksummed base64 sources at boot.
// Same self-healing pattern as lib/ganapatiMedia.js: the git tree only ever
// carries base64 text; the browser and ffmpeg always receive ordinary bytes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const SOURCE = path.join(__dirname, '../assets/ganpati-courtyard');
const DEST = path.join(__dirname, '../public/ganpati-courtyard/media');

function ensureCourtyardMedia() {
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(SOURCE, 'manifest.json'), 'utf8')); }
  catch (e) { throw new Error('media manifest unavailable: ' + e.message); }
  fs.mkdirSync(DEST, { recursive: true });
  const healed = [];
  for (const [name, expected] of Object.entries(manifest)) {
    if (!/^[a-zA-Z0-9-]+\.(mp4|ttf|jpg)$/.test(name)) throw new Error('invalid media filename: ' + name);
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

module.exports = { ensureCourtyardMedia };
