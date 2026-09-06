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
    // Large assets may be split across .partN files (git-transfer size limits);
    // concatenate the parts in order, then verify the full checksum.
    let b64 = '';
    try {
      const parts = fs.readdirSync(SOURCE).filter((f) => f.startsWith(name + '.b64.part')).sort();
      if (parts.length) {
        for (const part of parts) b64 += fs.readFileSync(path.join(SOURCE, part), 'utf8').trim();
      } else {
        b64 = fs.readFileSync(path.join(SOURCE, name + '.b64'), 'utf8').trim();
      }
    } catch (e) { throw new Error('media source unreadable: ' + name + ' — ' + e.message); }
    const bytes = Buffer.from(b64, 'base64');
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('media checksum mismatch: ' + name);
    const tmp = target + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, bytes, { mode: 0o644 });
    fs.renameSync(tmp, target);
    healed.push(name);
  }
  return healed;
}

module.exports = { ensureCourtyardMedia };
