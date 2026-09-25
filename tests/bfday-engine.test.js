'use strict';
// Run: node --test tests/bfday-engine.test.js
// Boyfriend Day family engine, no server: the loader's contract check, the
// field validator in all three modes, defaults, the render helpers, the image
// sniffer — and, for EVERY template registered in templates/bfday.js, a render
// contract + hostile-input escape audit. New templates are covered automatically.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const zlib = require('node:zlib');

const family = require('../lib/bfday/family');
const { normalizeFields, makeSchema, resolve, imagesIn, maxImages } = require('../lib/bfday/fields');
const { escape, jsonPayload, head } = require('../lib/bfday/page');
const { sniffImage, checkImage } = require('../lib/bfday/image');
const fixtureConfig = require('./fixtures/bfday-fixture/config');
const fixture = makeSchema(fixtureConfig);
const REGISTERED = require('../templates/bfday.js');

const { hostileFor } = require('./bfday-helpers');
const UP = n => '/bfday/uploads/' + String(n).repeat(48).slice(0, 48) + '.jpg';

/* ------------------------------------------------------------- loader */

test('family: every slug in templates/bfday.js loaded, none skipped', () => {
  assert.deepEqual(family.errors, [], 'a registered template broke the contract: ' + JSON.stringify(family.errors));
  const live = family.list.map(t => t.slug).filter(s => s !== 'bfday-fixture');
  assert.deepEqual(live, REGISTERED);
  assert.ok(REGISTERED.length >= 1);
});

test('family: each template has its own static assets and README', () => {
  for (const t of family.list.filter(x => x.slug !== 'bfday-fixture')) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'templates', t.slug, 'README.md')), t.slug + ' README.md');
    const pub = path.join(__dirname, '..', 'public', t.slug);
    const html = t.render({ customer_data: t.config.demo }, { baseUrl: 'https://paigaam.cc', isPreview: true });
    for (const m of html.matchAll(/(?:href|src)="(\/[^"]+\.(?:css|js))"/g)) {
      const file = path.join(__dirname, '..', 'public', m[1]);
      if (m[1].startsWith('/' + t.slug + '/')) assert.ok(fs.existsSync(file), `${t.slug}: ${m[1]} exists`);
    }
    if (fs.existsSync(pub)) assert.ok(fs.statSync(pub).isDirectory());
  }
});

test('family: slugs are unique across the whole registry and never reserved', () => {
  const { TEMPLATES } = require('../templates/registry');
  const slugs = TEMPLATES.map(t => t.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const t of family.list) assert.ok(!family.RESERVED.has(t.slug), t.slug);
  for (const t of family.list) assert.ok(slugs.includes(t.slug), t.slug + ' is in the registry');
});

/* ---------------------------------------------------------- spec check */

test('spec: bad field declarations fail loudly at boot', () => {
  const bad = [
    [{ id: 'a', type: 'colour', label: 'A' }], // unknown type
    [{ id: '1a', type: 'text', label: 'A' }], // bad id
    [{ id: 'templateVersion', type: 'text', label: 'A' }], // reserved
    [{ id: 'a', type: 'text' }], // no label
    [{ id: 'a', type: 'text', label: 'A' }, { id: 'a', type: 'text', label: 'B' }], // duplicate
    [{ id: 'a', type: 'text', label: 'A', maxLength: 3, default: 'toolong' }],
    [{ id: 'a', type: 'text', label: 'A', default: 'two\nlines' }],
    [{ id: 'a', type: 'select', label: 'A', options: ['x'], default: 'y' }],
    [{ id: 'a', type: 'select', label: 'A', options: [] }],
    [{ id: 'a', type: 'number', label: 'A', min: 5, max: 1 }],
    [{ id: 'a', type: 'image', label: 'A', default: 'data:image/png;base64,AAAA' }],
    [{ id: 'a', type: 'list', label: 'A' }], // neither item nor shape
    [{ id: 'a', type: 'list', label: 'A', item: { type: 'text' }, shape: [{ id: 'b', type: 'text', label: 'B' }] }],
    [{ id: 'a', type: 'list', label: 'A', shape: [{ id: 'b', type: 'list', label: 'B', item: { type: 'text' } }] }], // nested
    [{ id: 'a', type: 'list', label: 'A', item: { type: 'text', maxLength: 3 }, default: ['toolong'] }],
    [{ id: 'a', type: 'list', label: 'A', maxItems: 1, item: { type: 'text' }, default: ['x', 'y'] }],
    [{ id: 'a', type: 'list', label: 'A', required: true, item: { type: 'text' } }],
    [],
  ];
  for (const fields of bad) assert.throws(() => normalizeFields(fields), /\[bfday\]/, JSON.stringify(fields));
});

/* ---------------------------------------------------------- validation */

test('validate: strict whitelists, trims, enforces required and every length', () => {
  const clean = fixture.validate({ toName: '  Arjun ', evil: '<x>', note: 'a\r\nb', days: '12' });
  assert.equal(clean.toName, 'Arjun');
  assert.equal(clean.note, 'a\nb');
  assert.equal(clean.days, 12);
  assert.ok(!('evil' in clean));
  assert.equal(clean.templateVersion, 1);
  const bad = [
    null, [], 'x', {},
    { toName: '' }, { toName: '   ' }, { toName: 5 }, { toName: 'x'.repeat(31) },
    { toName: 'a\nb' }, { toName: 'bell\u0007' }, { toName: 'A', note: 'x'.repeat(301) },
    { toName: 'A', days: 0 }, { toName: 'A', days: 1.5 }, { toName: 'A', days: 'many' },
    { toName: 'A', song: 'javascript:alert(1)' }, { toName: 'A', song: 'https://a b' }, { toName: 'A', song: 'ftp://x.y' },
    { toName: 'A', mood: 'angry' },
    { toName: 'A', cover: 'data:image/png;base64,AAAA' }, { toName: 'A', cover: 'https://evil.example/x.jpg' },
    { toName: 'A', cover: '/bfday/uploads/../../etc/passwd' },
    { toName: 'A', reasons: 'not a list' }, { toName: 'A', reasons: ['one'] }, // below minItems
    { toName: 'A', reasons: ['a', 'b', 'c', 'd', 'e', 'f'] }, // above maxItems
    { toName: 'A', reasons: ['x'.repeat(81), 'b'] },
    { toName: 'A', moments: [{ when: 'no caption' }] }, // half-filled row
    { toName: 'A', moments: ['string row'] },
  ];
  for (const data of bad) {
    assert.throws(() => fixture.validate(data), e => e.code === 'validation', JSON.stringify(data));
  }
});

test('validate: draft mode allows blanks and drops half-filled rows but keeps shape rules', () => {
  const d = fixture.validate({ toName: '', moments: [{ when: 'no caption' }, { caption: 'kept' }] }, { mode: 'draft' });
  assert.equal(d.toName, '');
  assert.deepEqual(d.moments, [{ photo: '', caption: 'kept', when: '' }]);
  assert.throws(() => fixture.validate({ toName: 'x'.repeat(31) }, { mode: 'draft' }), e => e.code === 'validation');
  assert.throws(() => fixture.validate(null, { mode: 'draft' }), e => e.code === 'validation');
});

test('validate: lenient mode never throws, whatever it is given', () => {
  const junk = [null, 7, 'x', [], { toName: { a: 1 } }, { toName: 'x'.repeat(500), note: 'a\u0000b', days: 1e12, song: 'javascript:x', mood: 'nope', cover: 'data:x', reasons: 'x', moments: [1, null, { caption: 5 }] }];
  for (const data of junk) {
    const out = fixture.validate(data, { mode: 'lenient' });
    assert.ok(out.toName.length <= 30);
    assert.ok(!/\u0000/.test(out.note));
    assert.ok(out.days === null || out.days <= 99999);
    assert.equal(out.song, '');
    assert.equal(out.cover, '');
  }
});

test('resolve: blanks become the designed defaults; short lists fall back whole', () => {
  const d = resolve(fixtureConfig, { toName: 'A', reasons: ['only one'], moments: [{ caption: 'mine' }] }, fixture);
  assert.equal(d.note, 'Default note.');
  assert.equal(d.days, 365);
  assert.equal(d.mood, 'soft');
  assert.equal(d.cover, '');
  assert.deepEqual(d.reasons, ['default reason one', 'default reason two'], 'below minItems → default list');
  assert.deepEqual(d.moments, [{ photo: '', caption: 'mine', when: 'someday' }], 'blank subfields → subfield default');
  const untouched = resolve(fixtureConfig, {}, fixture);
  assert.deepEqual(untouched.moments, [{ photo: '', caption: 'default moment', when: 'someday' }]);
});

test('images: every upload reference is found; the per-template cap is derived from the spec', () => {
  const data = fixture.validate({ toName: 'A', cover: UP(1), moments: [{ caption: 'c', photo: UP(2) }, { caption: 'd' }] });
  assert.deepEqual(imagesIn(fixture.FIELDS, data), [UP(1), UP(2)]);
  assert.equal(maxImages(fixture.FIELDS), 1 + 3);
});

/* ------------------------------------------------------------- helpers */

test('page: escape, JSON payload break-out, head meta', () => {
  assert.equal(escape(`<a href="x">'&`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
  const block = jsonPayload('p', { s: '</script><script>alert(1)</script> ' });
  assert.doesNotMatch(block.slice(0, -'</script>'.length), /<\/script>/i);
  assert.deepEqual(JSON.parse(block.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')), { s: '</script><script>alert(1)</script> ' });
  const pub = head({ paigaam: { slug: 'x-1' }, opts: { baseUrl: 'https://paigaam.cc/' }, title: 'T"<', description: 'D', image: '/bfday/uploads/a.jpg' });
  assert.match(pub, /<link rel="canonical" href="https:\/\/paigaam\.cc\/p\/x-1">/);
  assert.match(pub, /og:image" content="https:\/\/paigaam\.cc\/bfday\/uploads\/a\.jpg"/);
  assert.match(pub, /<title>T&quot;&lt;<\/title>/);
  const pre = head({ paigaam: { slug: 'x-1' }, opts: { baseUrl: 'https://paigaam.cc', isPreview: true }, title: 'T', description: 'D' });
  assert.match(pre, /noindex/);
  assert.doesNotMatch(pre, /canonical|og:url/);
});

/* --------------------------------------------------------------- images */

function png(w, h) {
  const b = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).copy(b);
  b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'ascii'); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  return b;
}
function jpeg(w, h) {
  // SOI, APP0 (16 bytes), SOF0 with height then width.
  return Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
    0xFF, 0xC0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xFF, 0xD9]);
}

test('image: real dimensions from the bytes; declared type must match', () => {
  assert.deepEqual(sniffImage(jpeg(640, 480)), { format: 'image/jpeg', width: 640, height: 480 });
  assert.deepEqual(sniffImage(png(300, 200)), { format: 'image/png', width: 300, height: 200 });
  assert.equal(checkImage(jpeg(640, 480), 'image/jpeg'), null);
  assert.equal(checkImage(jpeg(640, 480), 'image/png'), 'invalid_image');
  assert.equal(checkImage(png(10, 10), 'image/png'), 'invalid_image', 'too small');
  assert.equal(checkImage(Buffer.from('<svg onload=alert(1)>' + ' '.repeat(40)), 'image/jpeg'), 'invalid_image');
  assert.equal(checkImage(jpeg(640, 480), 'image/svg+xml'), 'invalid_image');
  assert.equal(sniffImage(Buffer.alloc(4)), null);
  assert.ok(zlib); // keep node:zlib import honest for future webp fixtures
});

/* ------------------------------------------- per-template render contract */

for (const t of family.list) {
  test(`render contract · ${t.slug}: demo, empty, junk and hostile data all render a full, safe page`, () => {
    const opts = { baseUrl: 'https://paigaam.cc' };
    const cases = [
      ['demo', { customer_data: t.config.demo }],
      ['empty', { customer_data: {} }],
      ['null', { customer_data: null }],
      ['no row', undefined],
      ['junk', { customer_data: { [t.fields[0].id]: { nested: true }, extra: '<x>' } }],
      ['hostile', { customer_data: hostileFor(t.fields) }],
    ];
    for (const [label, pg] of cases) {
      for (const isPreview of [true, false]) {
        const html = t.render(pg && { ...pg, slug: isPreview ? null : t.slug + '-0123456789abcdef01' }, { ...opts, isPreview });
        assert.equal(typeof html, 'string', label);
        assert.match(html, /^<!DOCTYPE html>/i, label);
        assert.match(html, /<\/html>\s*$/, label);
        assert.match(html, /<meta property="og:title" content="[^"]+">/, label);
        assert.match(html, /<meta property="og:description" content="[^"]+">/, label);
        assert.match(html, new RegExp(`data-preview="${isPreview}"`), label);
        if (isPreview) assert.match(html, /noindex/, label);
        else if (pg) assert.match(html, new RegExp(`og:url" content="https://paigaam\\.cc/p/${t.slug}-0123456789abcdef01"`), label);
        assert.doesNotMatch(html, /<script>alert|<img src=x|"><script>/, `${label}: unescaped sender markup`);
        assert.doesNotMatch(html.replace(/https:\/\/paigaam\.cc\/[^"'\s]*/g, ''), /paigaam\.cc/i, `${label}: hardcoded paigaam.cc branding`);
        assert.doesNotMatch(html, /__brokenImgHandler|ha-img-placeholder|close-fullscreen/, `${label}: hosting-sandbox leftovers`);
      }
    }
  });
}
