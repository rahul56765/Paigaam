'use strict';
function safeURL(value) { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; } }
function spotifyURL(value) { const u = safeURL(value); return u && new URL(u).hostname === 'open.spotify.com' ? u : ''; }
module.exports = {safeURL,spotifyURL};
