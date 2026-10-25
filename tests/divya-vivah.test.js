'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../templates/divya-vivah/config');
const schema = require('../templates/divya-vivah/schema');
const renderer = require('../templates/divya-vivah/render');
const { resolve, normalizeFields } = require('../lib/bfday/fields');

const COPY_IDS = [
  'prayer', 'introduction', 'groomName', 'brideName', 'joiner', 'weddingHeading',
  'dateLabel', 'weekday', 'dayText', 'monthYearText', 'timeLabel', 'timePeriod',
  'timeText', 'timeSuffix', 'venueLabel', 'venueName', 'venueAddress',
  'presenceMessage', 'hostsLabel', 'familyDetails', 'contactText', 'gateLabel',
  'tapLabel', 'countdownHeading', 'countdownDescription', 'locationHeading',
  'directionsLabel', 'nextLabel', 'backLabel', 'weddingDayMessage',
  'afterWeddingMessage', 'daysLabel', 'hoursLabel', 'minutesLabel', 'secondsLabel',
];
const render = (data = config.demo, opts = {}) => renderer.renderDivya({ customer_data: data }, { isPreview: true, ...opts });

test('Divya Vivah has a free, silent bfday manifest and complete generated editor', () => {
  assert.equal(config.slug, 'divya-vivah');
  assert.equal(config.family, 'bfday');
  assert.equal(config.name, 'Divya Vivah');
  assert.equal(config.category, 'Wedding');
  assert.equal(config.price, 0);
  assert.equal(config.editable, true);
  assert.equal(config.backgroundMusic, false);
  assert.ok(config.steps.length > 0 && config.steps.length <= 7);
  const fields = normalizeFields(config.fields);
  const placed = config.steps.flatMap(step => step.fields);
  assert.deepEqual([...placed].sort(), fields.map(field => field.id).sort());
  assert.equal(new Set(placed).size, placed.length);
  assert.equal(schema.FIELDS.some(field => field.id === 'bgmSong'), false);
  for (const id of COPY_IDS) {
    const field = fields.find(field => field.id === id);
    assert.ok(field, `${id} must be editable`);
    assert.ok(['text', 'textarea'].includes(field.type));
    assert.ok(field.maxLength > 0 && field.maxLength <= 400, `${id} must be bounded`);
    assert.equal(field.default, config.demo[id]);
  }
  for (const id of ['brideName', 'groomName']) assert.equal(fields.find(field => field.id === id).maxLength, 26);
});

test('schema preserves Marathi Unicode, newlines and original sample copy', () => {
  const clean = schema.validate({ ...config.demo, unknown: 'must not persist' });
  assert.equal(clean.groomName, 'पियुष');
  assert.equal(clean.brideName, 'स्नेहा');
  assert.equal(clean.prayer, '॥ श्री गणेशाय नमः ॥');
  assert.equal(clean.monthYearText, 'मे २०२६');
  assert.equal(clean.weddingDate, '2026-05-24');
  assert.equal(clean.weddingTime, '18:00');
  assert.equal(clean.introduction, config.demo.introduction);
  assert.equal(clean.venueAddress, config.demo.venueAddress);
  assert.equal(clean.presenceMessage, config.demo.presenceMessage);
  assert.ok(!Object.hasOwn(clean, 'unknown'));
  const hints = config.fields.map(field => field.hint || '').join(' ');
  assert.match(hints, /Asia\/Kolkata/);
  assert.match(hints, /2026|२०२६/);
  assert.match(hints, /printed|displayed/i);
});

test('publishing rejects impossible dates, wrong time syntax and missing countdown settings', () => {
  for (const weddingDate of ['2027-02-29', '2026-04-31', '2027-13-01', '2027-00-10', '24-05-2027', '2027-05-00', '']) {
    assert.throws(() => schema.validate({ ...config.demo, weddingDate }), { code: 'validation', status: 400 });
  }
  for (const weddingTime of ['24:00', '18:60', '6:00', '18:00Z', '१८:००', '6 PM', '']) {
    assert.throws(() => schema.validate({ ...config.demo, weddingTime }), { code: 'validation', status: 400 });
  }
  for (const weddingDate of ['2028-02-29', '2027-05-24']) {
    for (const weddingTime of ['00:00', '18:00', '23:59']) assert.doesNotThrow(() => schema.validate({ ...config.demo, weddingDate, weddingTime }));
  }
  assert.doesNotThrow(() => schema.validate({}, { mode: 'draft' }));
  const defaults = resolve(config, { weddingDate: 'bad', weddingTime: '24:90' }, schema);
  assert.equal(defaults.weddingDate, '2026-05-24');
  assert.equal(defaults.weddingTime, '18:00');
});

test('copy lengths, control characters and non-string values are bounded', () => {
  assert.throws(() => schema.validate({ ...config.demo, groomName: 'अ'.repeat(27) }));
  assert.throws(() => schema.validate({ ...config.demo, introduction: 'अ'.repeat(401) }));
  assert.throws(() => schema.validate({ ...config.demo, venueName: '\u0000' }));
  assert.throws(() => schema.validate({ ...config.demo, brideName: { malicious: true } }));
  assert.doesNotThrow(() => render({ brideName: {}, groomName: null, introduction: 'अ'.repeat(5000), weddingDate: 'bad', weddingTime: '99:99' }));
});

test('map pin is optional place/coordinates text, not a pasted URL', () => {
  const field = config.fields.find(field => field.id === 'mapQuery');
  assert.equal(field.type, 'text');
  assert.equal(field.required, undefined);
  for (const mapQuery of ['', '19.9975,73.7898', 'आनंदम लॉन्स, नाशिक']) assert.doesNotThrow(() => schema.validate({ ...config.demo, mapQuery }));
  for (const mapQuery of ['https://maps.google.com/?q=Nasik', 'javascript:alert(1)', '//evil.example/maps', 'https://maps.app.goo.gl/example']) assert.throws(() => schema.validate({ ...config.demo, mapQuery }));
});

test('renderer exports both the template function and the family render contract', () => {
  assert.equal(typeof renderer.renderDivya, 'function');
  assert.equal(typeof renderer.render, 'function');
  assert.equal(typeof renderer.render({ customer_data: config.demo }, { isPreview: true }), 'string');
  const html = render();
  assert.match(html, /<html[^>]+lang="mr"/);
  assert.match(html, /\/divya-vivah\/invite\.css/);
  assert.match(html, /\/divya-vivah\/invite\.js/);
  for (const id of ['prayer', 'groomName', 'brideName', 'gateLabel', 'tapLabel', 'venueName', 'familyDetails', 'nextLabel', 'backLabel', 'countdownHeading', 'locationHeading']) assert.ok(html.includes(config.demo[id]), `${id} sample must appear`);
  assert.match(html, /https:\/\/www\.google\.com\/maps/);
  assert.match(html, /noopener/);
});

test('every visible copy field reaches rendered HTML or safe runtime state', () => {
  const replacements = Object.fromEntries(COPY_IDS.map((id, index) => [id, `E${String(index).padStart(2, '0')}मराठी`]));
  const html = render({ ...config.demo, ...replacements });
  for (const [id, value] of Object.entries(replacements)) assert.ok(html.includes(value), `${id} must not be hardcoded`);
});

test('customer content is escaped in HTML and map queries cannot become executable URLs', () => {
  const html = render({
    ...config.demo,
    groomName: '<svg onload=alert(1)>',
    introduction: '</p><script>alert(1)</script><p>',
    venueName: 'A & B <Hall>',
    venueAddress: '\" onload=\"alert(1)',
    mapQuery: 'javascript:alert(1)',
  });
  assert.ok(!html.includes('<svg onload=alert(1)>'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;svg onload=alert(1)&gt;'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('A &amp; B &lt;Hall&gt;'));
  assert.doesNotMatch(html, /(?:href|src)="(?:javascript|data):/i);
  assert.doesNotMatch(html, /<iframe[^>]+onload="alert\(1\)"/i);
});

test('family registration loads Divya Vivah without contract errors', () => {
  // Registration is owned by the parent integration task, not this fixture.
  const family = require('../lib/bfday/family');
  assert.deepEqual(family.errors.filter(error => error.slug === 'divya-vivah'), []);
  const entry = family.bySlug('divya-vivah');
  assert.ok(entry, 'parent must register divya-vivah in templates/bfday.js');
  assert.equal(entry.config, config);
  assert.equal(typeof entry.render, 'function');
});
