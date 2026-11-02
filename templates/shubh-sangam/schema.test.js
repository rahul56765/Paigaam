'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('./config');
const schema = require('./schema');
const engine = require('../../lib/bfday/fields');
const clone = x => JSON.parse(JSON.stringify(x));
const withDemo = patch => Object.assign(clone(config.demo), patch);

test('config fields and steps satisfy bfday field and step conventions', () => {
  const fields = engine.normalizeFields(config.fields, config.slug);
  assert.equal(config.family, 'bfday');
  const placed = config.steps.flatMap(step => step.fields);
  assert.ok(config.steps.length <= 7);
  assert.deepEqual([...placed].sort(), fields.map(f => f.id).sort());
  assert.equal(new Set(placed).size, placed.length);
  assert.equal(fields.some(f => /monogram|seal|initial/i.test(f.id)), false);
});
test('demo is strict-valid; all demo event moments are as specified', () => {
  const d = schema.validate(config.demo);
  assert.deepEqual(d.events.map(e => e.name), ['Haldi', 'Mehendi', 'Sangeet', 'Wedding', 'Reception']);
  assert.deepEqual(d.events.map(e => { const v = schema.deriveEvent(e, d); return [v.date, v.time]; }), [
    ['2027-02-20', '10:00'], ['2027-02-20', '16:00'], ['2027-02-20', '19:00'], ['2027-02-21', '19:15'], ['2027-02-22', '19:00'],
  ]);
  const date = schema.deriveWedding(d);
  assert.equal(date.weekday, 'Sunday');
  assert.equal(date.iso, '2027-02-21T13:45:00.000Z');
  assert.equal(date.timeZone, 'Asia/Kolkata');
});
test('central wedding date and time drive linked events and computed weekday', () => {
  const d = schema.validate(withDemo({ weddingDate: '2027-02-22', weddingTime: '09:30' }));
  const ev = schema.deriveEvent(d.events[3], d);
  assert.equal(ev.weekday, 'Monday'); assert.equal(ev.iso, '2027-02-22T04:00:00.000Z');
  assert.equal(schema.deriveEvent(d.events[0], d).date, '2027-02-20');
});
test('strict validation rejects invalid real dates, times and incomplete rows', () => {
  for (const d of [withDemo({ weddingDate: '2027-02-29' }), withDemo({ weddingTime: '24:00' }), withDemo({ weddingTime: '7:15 PM' }), withDemo({ events: [{ name: 'Party', timing: 'custom', date: '', time: '' }] })]) {
    assert.throws(() => schema.validate(d), schema.InputError);
  }
  assert.equal(schema.deriveDateTime('2027-02-29', '10:00'), null);
  assert.equal(schema.deriveDateTime('2027-02-20', 'xx'), null);
});
test('draft allows partial custom event; lenient data remains safe', () => {
  const d = withDemo({ events: [{ name: 'Party', timing: 'custom' }] });
  assert.equal(schema.validate(d, { mode: 'draft' }).events.length, 1);
  const l = schema.validate(withDemo({ weddingTime: '77:77', events: [{name:'Party', timing:'custom', date:'2027-02-20', time:'99:00'}] }), { mode: 'lenient' });
  assert.equal(l.weddingTime, ''); assert.equal(l.events[0].time, ''); assert.equal(schema.deriveEvent(l.events[0], l), null);
});
test('lists are bounded, reorderable by input order, and can resolve empty', () => {
  const d = withDemo({ events: [config.demo.events[4], config.demo.events[0]], gallery: [] });
  assert.deepEqual(schema.validate(d).events.map(e => e.name), ['Reception', 'Haldi']);
  assert.deepEqual(engine.resolve(config, withDemo({events: [], gallery: []}), schema).events, []);
  assert.throws(() => schema.validate(withDemo({ events: Array(13).fill(config.demo.events[0]) })), schema.InputError);
  assert.throws(() => schema.validate(withDemo({ gallery: Array(13).fill({photo:'', caption:'x'}) })), schema.InputError);
});
test('uploads use existing allowlists and extraction, including list photos and audio', () => {
  const photo = '/bfday/uploads/' + 'a'.repeat(48) + '.webp';
  const audio = '/bfday/uploads/' + 'b'.repeat(48) + '.mp3';
  const d = schema.validate(withDemo({ events: [{...config.demo.events[0], photo}], gallery: [{photo, caption:'Memory'}], musicUpload: audio }));
  assert.deepEqual(engine.imagesIn(schema.FIELDS, d), [photo, photo]);
  assert.deepEqual(engine.audioIn(schema.FIELDS, d), [audio]);
  assert.equal(engine.maxImages(schema.FIELDS), 27);
  assert.throws(() => schema.validate(withDemo({ gallery: [{photo:'https://evil.test/a.jpg', caption:'x'}] })), schema.InputError);
  assert.throws(() => schema.validate(withDemo({ musicUpload:'https://evil.test/x.mp3' })), schema.InputError);
});
test('maps, contacts, unknown keys and control characters remain safe', () => {
  assert.equal(schema.parseFamilyMapLink('https://maps.app.goo.gl/abc'), 'https://maps.app.goo.gl/abc');
  for (const v of ['javascript:alert(1)', 'https://google.com.evil.test/maps', 'http://google.com/maps', 'https://u:p@google.com/maps']) assert.equal(schema.parseFamilyMapLink(v), '');
  const d = schema.validate(withDemo({rsvpPhone:'+91 98765 43210', rsvpEmail:'guest@example.org', extra:'ignored'}));
  assert.deepEqual(schema.rsvpLinks(d), {phone:'tel:+919876543210', email:'mailto:guest%40example.org'});
  assert.equal(d.extra, undefined);
  assert.throws(() => schema.validate(withDemo({rsvpEmail:'a@example.org?bcc=evil@example.org'})), schema.InputError);
  assert.throws(() => schema.validate(withDemo({rsvpPhone:'123\n45678'})), schema.InputError);
  assert.deepEqual(schema.rsvpLinks({rsvpPhone:'javascript:hi',rsvpEmail:'x\ny@example.org'}), {phone:'', email:''});
});

const { render } = require('./render');
test('sample has consistent, neutral copy and the requested location', () => {
  const d = schema.validate(config.demo);
  assert.equal(d.brideName, 'Meera Joshi'); assert.equal(d.groomName, 'Vivaan Kapoor');
  assert.equal(d.brideMother, 'Mrs. Kavita Joshi'); assert.equal(d.brideFather, 'Mr. Sanjay Joshi');
  assert.equal(d.groomMother, 'Mrs. Pooja Kapoor'); assert.equal(d.groomFather, 'Mr. Amit Kapoor');
  assert.equal(d.venue, 'The Royal Orchid Palace');
  assert.equal(d.venueAddress, '27 Emerald Avenue, Wakad, Pune, Maharashtra – 411057');
  assert.ok(!d.announcement.includes('Meera') && !d.announcement.includes('Vivaan'));
  const html = render({ customer_data: withDemo({ brideName: 'Nisha', groomName: 'Ravi' }) });
  assert.match(html, /Nisha/); assert.match(html, /Ravi/);
  assert.match(html, /The Royal Orchid Palace/);
  assert.doesNotMatch(html, /Meera|Vivaan/);
  assert.doesNotMatch(html, /wa\.me\//);
  assert.match(html, /Online RSVP is unavailable/);
});
test('renderer exposes the family preview state on the body', () => {
  assert.match(render({ customer_data: config.demo }, { isPreview: true }), /<body data-preview="true">/);
  assert.match(render({ customer_data: config.demo }, { isPreview: false }), /<body data-preview="false">/);
  assert.match(render(), /<body data-preview="false">/);
});
test('wedding weekday, date, muhurat, countdown and linked event all follow the same instant', () => {
  const html = render({ customer_data: withDemo({weddingDate:'2027-02-22', weddingTime:'09:30'}) });
  assert.ok((html.match(/Monday, 22 February 2027/g) || []).length >= 2);
  assert.match(html, /Wedding time \/ Muhurat: 9:30 am IST/i);
  assert.match(html, /data-countdown="2027-02-22T04:00:00.000Z"/);
  assert.match(html, /9:30 am/i);
  assert.match(html, /Saturday, 20 February 2027/);
});
test('event locations inherit central changes unless independently overridden', () => {
  const d = schema.validate(withDemo({ venue:'New venue', venueAddress:'New address', venueMapsLink:'https://maps.app.goo.gl/abc' }));
  assert.deepEqual(schema.eventLocation(d.events[0], d), {venue:'New venue', address:'New address', mapsLink:'https://maps.app.goo.gl/abc'});
  assert.deepEqual(schema.eventLocation({venue:'Other venue', address:'Other address', mapsLink:''}, d), {venue:'Other venue', address:'Other address', mapsLink:''});
  assert.deepEqual(schema.eventLocation({venue:'Other venue'}, d), {venue:'Other venue', address:'', mapsLink:''});
  assert.deepEqual(schema.eventLocation({mapsLink:'https://maps.app.goo.gl/def'}, d), {venue:'New venue', address:'New address', mapsLink:'https://maps.app.goo.gl/def'});
  const html = render({ customer_data: d });
  assert.ok((html.match(/New venue/g) || []).length >= 6);
  assert.doesNotMatch(html, /Royal Orchid Palace/);
});
test('international RSVP needs an explicit plus, known calling code and plausible length everywhere', () => {
  for (const n of ['9876543210','919876543210','+99912345678','+91','+910000000000000000','+1 23','javascript:alert(1)']) {
    assert.throws(() => schema.validate(withDemo({rsvpPhone:n})), schema.InputError, n);
    assert.equal(schema.internationalPhone(n), '');
    assert.doesNotMatch(render({customer_data:withDemo({rsvpPhone:n})}), /wa\.me\//);
  }
  const n = '+91 98765 43210';
  assert.equal(schema.internationalPhone(n), '919876543210');
  assert.match(render({customer_data:withDemo({rsvpPhone:n})}), /https:\/\/wa\.me\/919876543210/);
});
test('named partial event drafts and uploaded photos survive validation; publish still rejects incomplete events', () => {
  const photo = '/bfday/uploads/' + 'c'.repeat(48) + '.webp';
  const partial = withDemo({bridePhoto:photo, groomPhoto:photo, venuePhoto:photo, brideFamily:'Grandparents', events:[{name:'Ceremony', description:'Note', photo}]});
  const draft = schema.validate(partial, {mode:'draft'});
  assert.equal(draft.events.length, 1); assert.equal(draft.events[0].name, 'Ceremony');
  assert.equal(draft.events[0].description, 'Note'); assert.equal(draft.events[0].photo, photo);
  assert.equal(engine.imagesIn(schema.FIELDS, draft).length, 4);
  assert.throws(() => schema.validate(partial), schema.InputError);
  assert.throws(() => schema.validate(withDemo({events:[{timing:'wedding'}]})), schema.InputError);
  const html = render({customer_data: draft});
  assert.match(html, /Grandparents/); assert.equal((html.match(new RegExp(photo, 'g')) || []).length, 4);
});
