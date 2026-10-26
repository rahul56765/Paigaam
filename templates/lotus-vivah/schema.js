'use strict';
const base = require('../../lib/bfday/fields').makeSchema(require('./config'));
const { bgmParse } = require('../../lib/bfday/bgm');
const COLOR = /^#[0-9a-f]{6}$/i;
function playableLink(value) {
  if (!value || bgmParse(value)) return true;
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && /\.(mp3|m4a|ogg|wav)$/i.test(u.pathname); } catch { return false; }
}
function validate(data, opts = {}) {
  const clean = base.validate(data, opts);
  const lenient = opts.mode === 'lenient';
  for (const key of ['pinkColor','yellowColor','greenColor','paperColor']) {
    if (clean[key] && !COLOR.test(clean[key])) { if (lenient) clean[key] = ''; else throw new base.InputError('invalid_colour'); }
  }
  const seen = new Set();
  clean.events = clean.events.filter(e => {
    if (seen.has(e.kind)) { if (lenient) return false; throw new base.InputError('duplicate_event'); }
    seen.add(e.kind);
    if (e.panelColor && !COLOR.test(e.panelColor)) { if (lenient) e.panelColor = ''; else throw new base.InputError('invalid_colour'); }
    return true;
  });
  if (!playableLink(clean.musicLink)) { if (lenient) clean.musicLink = ''; else throw new base.InputError('invalid_music_link'); }
  return clean;
}
module.exports = { ...base, validate, COLOR, playableLink };
