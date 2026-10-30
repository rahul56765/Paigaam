/* Shared server/creator validation. Parsing only: never fetches or resolves links. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PaigaamFamilyMaps = api;
})(typeof window === 'object' ? window : this, function () {
  'use strict';
  var warning = 'This is not a supported HTTPS Google Maps link. You can keep editing or save it; guests will not see a clickable link.';
  function parseFamilyMapLink(value) {
    if (typeof value !== 'string') return '';
    var raw = value.trim();
    if (!raw || raw.length > 500 || /[\s\\\u0000-\u001f\u007f]/.test(raw) || !/^https:\/\//i.test(raw)) return '';
    try {
      var u = new URL(raw), host = u.hostname.toLowerCase(), path = u.pathname;
      if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return '';
      // Country domains are deliberately bounded; never suffix-match "google".
      var google = ['google.com', 'www.google.com', 'google.co.in', 'www.google.co.in'].indexOf(host) !== -1;
      var accepted = google && /^\/maps(?:\/|$)/.test(path);
      if (host === 'maps.google.com') accepted = path === '/' || /^\/maps(?:\/|$)/.test(path);
      if (host === 'maps.app.goo.gl') accepted = /^\/[A-Za-z0-9_-]+\/?$/.test(path);
      if (host === 'goo.gl') accepted = /^\/maps\/[A-Za-z0-9_-]+\/?$/.test(path);
      return accepted ? u.href : '';
    } catch (_) { return ''; }
  }
  function familyMapState(value) {
    var href = parseFamilyMapLink(value);
    var invalid = typeof value === 'string' && !!value.trim() && !href;
    return { href: href, invalid: invalid, message: invalid ? warning : '' };
  }
  return { parseFamilyMapLink: parseFamilyMapLink, familyMapState: familyMapState };
});
