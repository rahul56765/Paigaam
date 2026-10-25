'use strict';
// Schema/editor-boundary checks only; these do not replace browser interaction tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../public/ivory-jasmine/core');
const base = require('../public/shaadi-paigaam/core');
const clone = x => JSON.parse(JSON.stringify(x));
const media = ext => '/ivory-jasmine/media/' + 'a'.repeat(48) + '.' + ext;

test('all five Ivory demo-art URLs validate and survive repeated editor normalization', () => {
  const d = clone(C.SAMPLE);
  d.photos = Array.from({ length: 5 }, (_, i) => ({ url: `/ivory-jasmine/art/demo-${i + 1}.webp`, alt: 'Demo ' + i }));
  d.couplePhoto = { url: d.photos[0].url, fx: 25, fy: 75 };
  const first = C.validate(d).data;
  assert.deepEqual(first.photos.map(p => p.url), d.photos.map(p => p.url));
  assert.equal(first.couplePhoto.url, d.couplePhoto.url);
  assert.deepEqual(C.validate(first).data.photos, first.photos);
  for (const p of first.photos) {
    assert.equal(C.isImage(p.url), true);
    assert.equal(fs.existsSync(path.join(__dirname, '../public', p.url)), true);
  }
});

test('all supported Ivory photo extensions survive the shared schema adapter', () => {
  for (const ext of ['jpg', 'png', 'webp']) {
    const d = clone(C.SAMPLE); d.photos = [{ url: media(ext) }]; d.couplePhoto = { url: media(ext) };
    assert.equal(C.isImage(media(ext)), true);
    assert.equal(C.isAudio(media(ext)), false);
    const result = C.validate(d).data;
    assert.equal(result.photos[0].url, media(ext));
    assert.equal(result.couplePhoto.url, media(ext));
  }
});

test('uploaded music extensions survive normalization with rights and muted flags', () => {
  for (const ext of ['mp3', 'm4a', 'ogg', 'aac', 'wav']) {
    const d = clone(C.SAMPLE); d.music = { track: 'upload', url: media(ext), title: 'Our song', rightsOk: true, startMuted: true };
    assert.equal(C.isAudio(media(ext)), true);
    assert.equal(C.isImage(media(ext)), false);
    assert.deepEqual(C.validate(d).data.music, d.music);
  }
});

test('foreign uploads, malformed names, external URLs and traversal are rejected', () => {
  for (const url of [media('jpg').replace('ivory-jasmine', 'shaadi-paigaam'), media('jpg').replace('ivory-jasmine', 'suvarna-vivah'), '/ivory-jasmine/media/nope.jpg', '/ivory-jasmine/art/demo-6.webp', '/ivory-jasmine/media/../art/demo-1.webp', 'https://example.com/photo.jpg', 'javascript:alert(1)']) {
    assert.equal(C.isImage(url), false, url);
    assert.equal(C.isAudio(url), false, url);
    const d = clone(C.SAMPLE); d.photos = [{ url }]; d.couplePhoto = { url }; d.music = { track: 'upload', url };
    const result = C.validate(d).data;
    assert.equal(result.photos.length, 0, url);
    assert.equal(result.couplePhoto, null, url);
    assert.equal(result.music.url, '', url);
  }
});

test('URL mapping never rewrites customer-authored text or mutates input', () => {
  const d = clone(C.SAMPLE); d.gifts = '/shaadi-paigaam/media/ is just text';
  const before = JSON.stringify(d);
  const result = C.validate(d).data;
  assert.equal(result.gifts, d.gifts);
  assert.equal(JSON.stringify(d), before);
  assert.notEqual(C.SAMPLE, base.SAMPLE);
  assert.equal(base.SAMPLE.photos[0].url.startsWith('/shaadi-paigaam/'), true);
});

test('twenty custom events preserve IDs and manual order across editor normalization', () => {
  const d = clone(C.SAMPLE);
  d.events = Array.from({ length: 20 }, (_, i) => ({ id: 'ev-test-' + i, type: 'custom', name: 'Celebration ' + i, date: '2027-05-20', start: '12:00', venue: 'Courtyard', main: i === 0 })).reverse();
  const result = C.validate(C.validate(d).data).data;
  assert.deepEqual(result.events.map(e => e.id), d.events.map(e => e.id));
  assert.equal(result.events.filter(e => e.main).length, 1);
});

test('browser adapter exposes IJCore without replacing the shared SPCore', () => {
  const context = vm.createContext({ self: {}, console });
  for (const file of ['shaadi-paigaam/i18n.js', 'shaadi-paigaam/core.js', 'ivory-jasmine/core.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public', file), 'utf8'), context, { filename: file });
  }
  assert.equal(typeof context.self.IJCore.validate, 'function');
  assert.equal(context.self.IJCore.isImage('/ivory-jasmine/art/demo-1.webp'), true);
  assert.equal(context.self.SPCore.isImage('/ivory-jasmine/art/demo-1.webp'), false);
  const result = context.self.IJCore.validate(context.self.IJCore.SAMPLE).data;
  assert.equal(result.photos[0].url, '/ivory-jasmine/art/demo-1.webp');
});

test('WhatsApp yes/no links carry invitation context, not a public storage endpoint', () => {
  const d = clone(C.SAMPLE); d.rsvp.whatsapp = '+919999999999';
  for (const attending of [true, false]) {
    const link = new URL(C.whatsappRsvpLink(d, attending, 'en'));
    assert.equal(link.origin, 'https://wa.me');
    assert.equal(link.pathname, '/919999999999');
    assert.match(link.searchParams.get('text'), /Aarav & Ananya/);
    assert.equal(link.searchParams.get('text').includes('/api/'), false);
  }
});
