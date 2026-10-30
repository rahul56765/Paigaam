'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const config = require('../templates/patra-vivah/config');
const schema = require('../templates/patra-vivah/schema');
const { resolve } = require('../lib/bfday/fields');
const maps = require('../public/bfday/family-maps');
const { bfdayCreatePage } = require('../pages/bfdayCreate');

test('family step is fourth after unchanged itinerary and before music; every field placed once', () => {
  assert.deepEqual(config.sections, ['cover', 'save', 'itinerary', 'family']);
  assert.deepEqual(config.steps.map(s => s.title), ['The couple', 'Save the Date', 'Itinerary', 'Family Welcome', 'Music']);
  const ids = config.steps.flatMap(s => s.fields);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), schema.FIELDS.map(f => f.id).sort());
  assert.deepEqual(config.steps[2].fields, ['itineraryHeading', 'days']);
  assert.equal(config.demo.days.length, 3);
  assert.equal(config.demo.days.reduce((n, d) => n + d.events.length, 0), 7);
  const data = resolve(config, schema.validate(config.demo), schema);
  assert.equal(data.regardsHeading, 'With warm regards');
  assert.equal(data.familyName, 'Deshpande Family');
  assert.equal(data.familyWelcome, 'Welcome');
  assert.equal(data.familyMapsLink, '');
  assert.equal(data.familyPhotoZoom, 100);
  assert.equal(data.familyPhotoX, 50);
  assert.equal(data.familyPhotoY, 50);
});

test('family fields retain original owned upload with bounded crop numbers and editable invalid Maps text', () => {
  const photo = '/bfday/uploads/' + 'b'.repeat(48) + '.jpg';
  const data = { ...config.demo, familyPhoto: photo, familyPhotoZoom: 225, familyPhotoX: 0, familyPhotoY: 100,
    familyMapsLink: 'javascript:alert(1)', familyVenue: 'The venue', familyAddress: 'First line\nSecond line' };
  for (const mode of ['strict', 'draft', 'lenient']) {
    const clean = schema.validate(data, { mode });
    assert.equal(clean.familyPhoto, photo);
    assert.equal(clean.familyMapsLink, data.familyMapsLink);
    assert.equal(schema.parseFamilyMapLink(clean.familyMapsLink), '');
    assert.equal(clean.familyAddress, data.familyAddress);
  }
  for (const [id, low, high] of [['familyPhotoZoom', 100, 250], ['familyPhotoX', 0, 100], ['familyPhotoY', 0, 100]]) {
    const f = schema.FIELDS.find(f => f.id === id);
    assert.equal(f.slider, true);
    for (const value of [low, high]) assert.equal(schema.validate({ ...data, [id]: value })[id], value);
    for (const value of [low - 1, high + 1, 125.5]) assert.throws(() => schema.validate({ ...data, [id]: value }));
  }
  assert.equal(schema.FIELDS.find(f => f.id === 'familyPhoto').tapToPick, true);
  assert.equal(schema.FIELDS.find(f => f.id === 'familyMapsLink').type, 'text');
  for (const id of ['regardsHeading', 'familyName', 'familyWelcome', 'familyVenue', 'familyAddress', 'familyMapsLink']) {
    const f = schema.FIELDS.find(f => f.id === id);
    assert.throws(() => schema.validate({ ...data, [id]: 'x'.repeat(f.maxLength + 1) }));
  }
  assert.throws(() => schema.validate({ ...data, familyPhoto: 'https://evil.example/photo.jpg' }));
});

test('shared Maps parser accepts bounded real Google Maps locations only, without network', () => {
  for (const link of ['https://www.google.com/maps?q=Venue', 'https://google.com/maps/place/Test',
    'https://google.co.in/maps', 'https://www.google.co.in/maps/', 'https://maps.google.com/?q=Venue',
    'https://maps.google.com/maps?q=Venue', 'https://maps.app.goo.gl/AbC123', 'https://goo.gl/maps/AbC123']) {
    assert.equal(maps.parseFamilyMapLink(link), new URL(link).href, link);
    assert.deepEqual(maps.familyMapState(link), { href: new URL(link).href, invalid: false, message: '' });
  }
  const invalid = ['javascript:alert(1)', 'data:text/html,hi', 'http://google.com/maps', '//google.com/maps',
    'https://google.com.evil.test/maps', 'https://evilgoogle.com/maps', 'https://google.co.in.evil/maps',
    'https://www.google.com@evil.test/maps', 'https://user:pass@google.com/maps', 'https://google.com:444/maps',
    'https://google.com/url?q=https://evil.test', 'https://google.com/maps-evil', 'https://google.com/maps/../url',
    'https://google.com/maps\\@evil.test', 'https://maps.app.goo.gl.evil.test/abc', 'https://goo.gl/anything/abc',
    'https://google.invalid/maps', 'https://maps.google.com.evil.test/', 'https://maps.app.goo.gl/',
    'https://google.com/ma\nps', 'https://google.com/maps blah', '<a href="https://google.com/maps">'];
  for (const link of invalid) {
    assert.equal(maps.parseFamilyMapLink(link), '', link);
    assert.equal(maps.familyMapState(link).invalid, true, link);
    assert.ok(maps.familyMapState(link).message);
  }
  for (const link of ['', '  ', null, undefined, {}]) {
    assert.equal(maps.parseFamilyMapLink(link), '');
    assert.equal(maps.familyMapState(link).invalid, false);
  }
  const browser = { window: {}, URL };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/bfday/family-maps'), 'utf8'), browser);
  assert.equal(browser.window.PaigaamFamilyMaps.parseFamilyMapLink(invalid[0]), '');
  assert.equal(browser.window.PaigaamFamilyMaps.parseFamilyMapLink('https://google.com/maps'), 'https://google.com/maps');
});

function element(value = '') {
  return { value, style: {}, attrs: {}, events: {}, hidden: false, textContent: '',
    classList: { values: [], add(v) { this.values.push(v); } },
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k] || null; },
    addEventListener(k, fn) { (this.events[k] ||= []).push(fn); },
    emit(k) { (this.events[k] || []).forEach(fn => fn()); },
    appendChild(child) { this.child = child; } };
}

test('DOM harness: family-only frame crop, live soft warning, restore updates, and clear behavior', () => {
  const section = element(), host = element(), image = element(), thumb = element(), empty = element();
  const inputs = { familyPhotoZoom: element('100'), familyPhotoX: element('50'), familyPhotoY: element('50'), familyMapsLink: element() };
  inputs.familyMapsLink.parentNode = element();
  inputs.familyMapsLink.setAttribute('aria-describedby', 'existing-hint');
  host.closest = () => section;
  host.querySelector = s => ({ img: image, '.bf-photo__thumb': thumb, '.bf-photo__empty': empty })[s];
  const form = { querySelector: s => s === '[data-image="familyPhoto"]' ? host : inputs[s.replace('#f-', '')] };
  const controls = Object.fromEntries(Object.entries(inputs).map(([id, input]) => [id, { set(v) { input.value = String(v); }, get() { return input.value; } }]));
  const context = { window: { PaigaamFamilyMaps: maps }, document: { createElement: () => element() } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/bfday/family-editor'), 'utf8'), context);
  context.window.PaigaamFamilyEditor(form, controls);
  const status = inputs.familyMapsLink.parentNode.child;
  assert.equal(status.hidden, true);
  assert.equal(image.style.transform, 'scale(1)');
  inputs.familyPhotoZoom.value = '250'; inputs.familyPhotoZoom.emit('input');
  assert.equal(image.style.transform, 'scale(2.5)');
  controls.familyPhotoX.set(0); controls.familyPhotoY.set(100);
  assert.equal(image.style.objectPosition, '0% 100%');
  assert.equal(image.style.transformOrigin, '0% 100%');
  assert.equal(inputs.familyMapsLink.attrs['aria-describedby'], 'existing-hint f-familyMapsLink-status');
  inputs.familyMapsLink.value = 'javascript:alert(1)'; inputs.familyMapsLink.emit('input');
  assert.equal(status.hidden, false);
  assert.ok(status.textContent.includes('not a supported'));
  assert.equal(controls.familyMapsLink.get(), 'javascript:alert(1)');
  assert.equal(inputs.familyMapsLink.attrs.href, undefined);
  assert.equal(inputs.familyMapsLink.attrs['aria-invalid'], undefined);
  controls.familyMapsLink.set('https://google.com/maps');
  assert.equal(status.hidden, true); assert.equal(status.textContent, '');
  controls.familyMapsLink.set('bad'); assert.equal(status.hidden, false);
  controls.familyMapsLink.set(''); assert.equal(status.hidden, true);
  assert.ok(thumb.classList.values.includes('bf-family-frame'));
  assert.ok(section.classList.values.includes('bf-family-editor'));
});

test('creator loads opt-in helper before shared wizard and uses text input plus existing pick/replace/remove control', () => {
  const html = bfdayCreatePage({ slug: config.slug, config, fields: schema.FIELDS });
  assert.ok(html.includes('/bfday/family-editor.css'));
  assert.ok(html.indexOf('/bfday/family-maps.js') < html.indexOf('/bfday/create.js'));
  assert.ok(html.indexOf('/bfday/family-editor.js') < html.indexOf('/bfday/create.js'));
  assert.match(html, /type="text" id="f-familyMapsLink"/);
  assert.match(html, /type="range" id="f-familyPhotoZoom"[^>]*min="100" max="250"/);
  assert.ok(html.includes('data-image="familyPhoto"'));
  const source = fs.readFileSync(require.resolve('../public/bfday/create'), 'utf8');
  assert.ok(source.includes("SLUG === 'patra-vivah' && window.PaigaamFamilyEditor"));
  assert.ok(source.includes("choose.textContent = value || src ? 'Replace '"));
  assert.ok(source.includes("remove.addEventListener('click'"));
  assert.ok(!fs.readFileSync(require.resolve('../public/bfday/family-editor'), 'utf8').includes('fetch('));
});
