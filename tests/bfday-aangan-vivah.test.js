'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../templates/aangan-vivah/config');
const schema = require('../templates/aangan-vivah/schema');
const { render, dateLabel } = require('../templates/aangan-vivah/render');
const family = require('../lib/bfday/family');

function htmlFor(data = config.demo) { return render({ customer_data: data }, { isPreview: true, baseUrl: 'https://paigaam.cc' }); }

test('Aangan Vivah is a valid family member with a strict demo and no music field', () => {
  assert.equal(family.has('aangan-vivah'), true);
  assert.doesNotThrow(() => schema.validate(config.demo, { mode: 'strict' }));
  assert.equal(schema.FIELDS.some(f => f.id === 'bgmSong'), false);
  assert.equal(config.steps.length, 4);
  const logo = schema.FIELDS.find(f => f.id === 'monogramLogo');
  assert.equal(logo.type, 'image');
  assert.equal(logo.preserveTransparency, true);
  assert.equal(logo.tapToPick, true);
  assert.equal(schema.FIELDS.find(f => f.id === 'monogramZoom').slider, true);
  assert.equal(schema.FIELDS.find(f => f.id === 'monogramPositionX').unit, '%');
});

test('the reference page flow renders in order with the door opener and accessible navigation', () => {
  const html = htmlFor();
  const order = ['A carved golden wedding door', 'Couple monogram, date and venue', 'Wedding invitation and family names', 'Haldi Ceremony', 'Sangeet Night', 'Wedding Ceremony', 'Wedding Reception', 'Thank-you message from the family'];
  let last = -1;
  for (const label of order) {
    const next = html.indexOf(`aria-label="${label}"`, last + 1);
    assert.ok(next > last, `${label} should appear after the preceding page`);
    last = next;
  }
  assert.match(html, /data-aw-open/);
  assert.match(html, /Tap to open/);
  assert.match(html, /data-aw-prev/);
  assert.match(html, /data-aw-next/);
  assert.match(html, /data-aw-dot="7"/);
  assert.match(html, /door-left\.webp/);
  assert.match(html, /door-right\.webp/);
  assert.match(html, /aw-golden-overlay/);
  assert.match(html, /aw-golden-rays/);
  assert.match(html, /aw-golden-sparkles/);
  const script = require('node:fs').readFileSync(require('node:path').join(__dirname, '../public/aangan-vivah/aangan.js'), 'utf8');
  assert.match(script, /function fitCopy/);
  assert.match(script, /getBoundingClientRect/);
  assert.match(script, /1650/);
  assert.match(script, /3300/);
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '../public/aangan-vivah/aangan.css'), 'utf8');
  assert.match(css, /\.aw-invitation\{top:12\.5%;height:56%;[^}]*padding-inline:17%/);
});

test('monogram keeps editable initials by default and accepts a transparent uploaded logo with crop settings', () => {
  const fallback = htmlFor();
  assert.match(fallback, /aw-monogram__initials/);
  assert.doesNotMatch(fallback, /aw-monogram__logo-frame/);

  const logoUrl = '/bfday/uploads/' + 'a'.repeat(48) + '.png';
  const data = { ...config.demo, monogramLogo: logoUrl, monogramZoom: 175, monogramPositionX: 63, monogramPositionY: 41 };
  assert.doesNotThrow(() => schema.validate(data, { mode: 'strict' }));
  const html = htmlFor(data);
  assert.match(html, /aw-monogram__logo-frame/);
  assert.match(html, /src="\/bfday\/uploads\/a{48}\.png"/);
  assert.match(html, /--aw-logo-zoom:1\.75;--aw-logo-x:63%;--aw-logo-y:41%/);
  assert.doesNotMatch(html, /aw-monogram__initials/);
  assert.throws(() => schema.validate({ ...data, monogramZoom: 250 }, { mode: 'strict' }));
});

test('logo editor preserves PNG alpha, adds accessible tap-to-pick and live crop sliders', () => {
  const { bfdayCreatePage } = require('../pages/bfdayCreate');
  const createPage = bfdayCreatePage(family.bySlug('aangan-vivah'), { price: 0, listPrice: 0 });
  assert.match(createPage, /type="range" id="f-monogramZoom"[^>]*value="100"/);
  assert.match(createPage, /data-range-value-for="monogramPositionX"/);
  const script = require('node:fs').readFileSync(require('node:path').join(__dirname, '../public/bfday/create.js'), 'utf8');
  assert.match(script, /prepareImage\(picked, f\.preserveTransparency\)/);
  assert.match(script, /canvas\.toBlob\(done, 'image\/png'\)/);
  assert.match(script, /Content-Type': blob\.type/);
  assert.match(script, /bf-photo__thumb--pickable/);
  assert.match(script, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(script, /updateRangeValue/);
});

test('optional Haldi and Sangeet rows can be hidden and event rows retain their chosen order', () => {
  const events = [config.demo.events[3], config.demo.events[2]];
  const html = htmlFor({ ...config.demo, events });
  assert.equal((html.match(/data-aw-page/g) || []).length, 6);
  assert.ok(!html.includes('haldi.webp'));
  assert.ok(!html.includes('sangeet.webp'));
  assert.ok(html.indexOf('Wedding Reception') < html.indexOf('Wedding Ceremony'));
});

test('strict publish validation requires unique events and the wedding and reception pages', () => {
  const duplicate = { ...config.demo, events: [config.demo.events[0], config.demo.events[1], config.demo.events[2], { ...config.demo.events[3], kind: 'wedding' }] };
  assert.throws(() => schema.validate(duplicate, { mode: 'strict' }));
  const missingCore = { ...config.demo, events: config.demo.events.filter(event => event.kind !== 'reception') };
  assert.throws(() => schema.validate(missingCore, { mode: 'strict' }));
});

test('names, event details and messages are safely escaped; dates format consistently', () => {
  const data = { ...config.demo, brideName: '<script>alert(1)</script>', invitationLine: '<img src=x>', events: config.demo.events.map((event, i) => i ? event : { ...event, themeLine: '<svg onload=alert(1)>' }) };
  const html = htmlFor(data);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('&lt;img src=x&gt;'));
  assert.ok(html.includes('&lt;svg onload=alert(1)&gt;'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.equal(dateLabel('2027-02-14'), '14 February 2027');
});
