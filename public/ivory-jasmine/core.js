/* Ivory Jasmine's scoped media adapter. The established Shaadi core is unchanged.
 * Load after shaadi-paigaam/core.js; use IJCore in this template's renderer/editor.
 * Only URL-bearing schema fields are mapped; user-authored text is never rewritten.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../shaadi-paigaam/core.js'));
  else root.IJCore = factory(root.SPCore);
})(typeof self !== 'undefined' ? self : this, function (base) {
  'use strict';
  const own = /^\/ivory-jasmine\/media\/[a-f0-9]{48}\.(jpg|png|webp|mp3|m4a|ogg|aac|wav)$/;
  const foreign = /^\/(?:shaadi-paigaam|suvarna-vivah)\/media\//;
  function mapMedia(raw, fn) {
    const d = JSON.parse(JSON.stringify(raw || {}));
    if (Array.isArray(d.photos)) for (const p of d.photos) if (p && typeof p === 'object') p.url = fn(p.url);
    if (d.couplePhoto && typeof d.couplePhoto === 'object') d.couplePhoto.url = fn(d.couplePhoto.url);
    if (d.music && typeof d.music === 'object') d.music.url = fn(d.music.url);
    return d;
  }
  function input(url) {
    if (/^\/ivory-jasmine\/art\/demo-[1-5]\.webp$/.test(url || '')) return url.replace('/ivory-jasmine/art/', '/shaadi-paigaam/art/');
    if (own.test(url || '')) return url.replace('/ivory-jasmine/media/', '/shaadi-paigaam/media/');
    return foreign.test(url || '') ? '' : url;
  }
  function output(url) { return typeof url === 'string' ? url.replace(/^\/shaadi-paigaam\/(media|art)\//, '/ivory-jasmine/$1/') : url; }
  const sample = JSON.parse(JSON.stringify(base.SAMPLE));
  sample.palette = { id: 'custom', custom: { primary: '#58634B', accent: '#A78B59', bg: '#FFFCF5' } };
  sample.font = 'royal';
  sample.lang = { enabled: ['en', 'hi', 'mr'], default: 'en', base: 'en' };
  sample.photos = [
    { url: '/ivory-jasmine/art/demo-1.webp', alt: 'Illustrative white jasmine mandap', fx: 50, fy: 50 },
    { url: '/ivory-jasmine/art/demo-2.webp', alt: 'Illustrative wedding garlands and heirlooms', fx: 50, fy: 50 },
  ];
  sample.music = { track: 'upload', url: '', title: '', startMuted: false, rightsOk: false };
  return Object.assign({}, base, {
    SAMPLE: sample,
    validate: function (raw, opts) {
      const result = base.validate(mapMedia(raw, input), opts);
      result.data = mapMedia(result.data, output);
      if (result.data.events.length > base.LIMITS.events) {
        const main = result.data.events.find(e => e.main);
        result.data.events = result.data.events.filter(e => !e.main).slice(0, base.LIMITS.events - 1).concat(main ? [main] : []);
      }
      return result;
    },
    isImage: function (url) { return base.isImage(input(url)); },
    isAudio: function (url) { return base.isAudio(input(url)); },
  });
});
