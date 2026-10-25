/* Chandni Royale's isolated editor/server data contract. Shared Shaadi defaults are untouched. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.CRCore = factory(root.SPCore);
})(typeof window !== 'undefined' ? window : this, function (C) {
  'use strict';
  function validate(input, opts) {
    const src = input && typeof input === 'object' ? input : {};
    const events = Array.isArray(src.events) ? src.events : [];
    // Include the automatically supplied main ceremony within the twenty-function limit.
    const hasMain = events.slice(0, 20).some(e => e && e.main);
    const result = C.validate(Object.assign({}, src, {
      events: events.slice(0, hasMain ? 20 : 19),
      rsvp: Object.assign({}, src.rsvp, { email: '', meal: false, mealOptions: [] }),
    }), Object.assign({}, opts, { templateSlug: 'chandni-royale', requireWhatsAppRsvp: true }));
    const d = result.data;
    // Uploaded song only. No built-in track, remote audio, autoplay or opener upload field.
    if (!d.music.url) d.music = { track: '', url: '', title: '', startMuted: true, rightsOk: false };
    else { d.music.track = 'upload'; d.music.startMuted = true; }
    d.rsvp = { whatsapp: d.rsvp.whatsapp, deadline: d.rsvp.deadline, maxGuests: 1, meal: false, mealOptions: [], email: '' };
    if (!d.rsvp.whatsapp && !result.errors.some(e => e.path === 'rsvp.whatsapp')) {
      result.errors.push({ path: 'rsvp.whatsapp', msg: 'Add the organiser’s WhatsApp number so guests can RSVP.' });
    }
    if (d.music.url && !d.music.rightsOk && !result.errors.some(e => e.path === 'music.rightsOk')) {
      result.errors.push({ path: 'music.rightsOk', msg: 'Please confirm you have the right to use this song.' });
    }
    if (events.length > 20) result.warnings.push({ path: 'events', msg: 'You can add up to 20 functions.' });
    return result;
  }
  const SAMPLE = JSON.parse(JSON.stringify(C.SAMPLE));
  SAMPLE.photos = [];
  SAMPLE.couplePhoto = null;
  SAMPLE.music = { track: '', url: '', title: '', startMuted: true, rightsOk: false };
  SAMPLE.palette = { id: 'custom', custom: { primary: '#702f32', accent: '#B79B64', bg: '#F5F0E6' } };
  SAMPLE.font = 'classic';
  SAMPLE.rsvp = { whatsapp: '', deadline: '', meal: false, mealOptions: [], email: '' };
  return Object.assign({}, C, { validate, SAMPLE });
});
