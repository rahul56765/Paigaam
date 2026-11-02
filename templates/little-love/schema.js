'use strict';
const { makeSchema, InputError } = require('../../lib/bfday/fields');
const base = makeSchema(require('./config'));
function youtubeId(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password) return '';
    const host = u.hostname.toLowerCase(), parts = u.pathname.split('/').filter(Boolean);
    let id = '';
    if (host === 'youtu.be' && parts.length === 1) id = parts[0];
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
      if (u.pathname === '/watch') id = u.searchParams.get('v') || '';
      else if (parts.length === 2 && ['shorts', 'embed', 'live'].includes(parts[0])) id = parts[1];
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
  } catch { return ''; }
}
function playableLink(value) {
  if (!value) return true;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && (!!youtubeId(value) || /\.(mp3|m4a|ogg|wav)$/i.test(u.pathname));
  } catch { return false; }
}
function validate(input, opts = {}) {
  const d = base.validate(input, opts);
  if (!playableLink(d.musicLink)) {
    if (opts.mode === 'lenient') d.musicLink = '';
    else throw new InputError('invalid_musicLink');
  }
  d.playlist = d.playlist.filter(item => {
    if (playableLink(item.url)) return true;
    if (opts.mode === 'lenient') return false;
    throw new InputError('invalid_playlist');
  });
  return d;
}
module.exports = { ...base, validate, playableLink, youtubeId };
