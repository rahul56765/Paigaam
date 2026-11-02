'use strict';
// Focused, dependency-free contract tests. No server, DB, network or asset writes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const config = require('../templates/sita-kalyanam/config');
const schema = require('../templates/sita-kalyanam/schema');
const { render, dateLabel, timeLabel } = require('../templates/sita-kalyanam/render');
const root = path.resolve(__dirname, '..');
const demo = () => structuredClone(config.demo);
const htmlFor = (data = demo()) => render({ customer_data: data }, { isPreview: true, baseUrl: 'https://paigaam.cc' });
const upload = (n = 1, ext = 'webp') => '/bfday/uploads/' + n.toString(16).padStart(48, '0') + '.' + ext;
const contains = (html, text) => assert.ok(html.includes(text), 'missing: ' + text);
const excludes = (html, text) => assert.ok(!html.includes(text), 'unexpected: ' + text);
const escape = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const sectionIds = html => [...html.matchAll(/<section\b[^>]*data-sk-section="([^"]+)"/g)].map(m => m[1]);
const section = (html, id) => html.match(new RegExp('<section\\b[^>]*id="' + id + '"[^>]*>[\\s\\S]*?</section>'))?.[0] || '';
const eventsIn = html => [...section(html, 'events').matchAll(/<h3>([\s\S]*?)<\/h3>/g)].map(m => m[1]);
const gallerySources = html => [...section(html, 'moments').matchAll(/<img\b[^>]*src="([^"]+)"/g)].map(m => m[1]);

test('Sita Kalyanam: fictional demo passes strict validation and every field is editable once', () => {
  assert.equal(config.slug, 'sita-kalyanam');
  assert.doesNotThrow(() => schema.validate(demo(), { mode: 'strict' }));
  const placed = config.steps.flatMap(s => s.fields);
  assert.equal(new Set(placed).size, placed.length);
  assert.deepEqual([...placed].sort(), schema.FIELDS.map(f => f.id).sort());
  assert.deepEqual(schema.FIELDS.filter(f => f.type === 'list').map(f => [f.id, f.default]), [['events', []], ['gallery', []]]);
  assert.equal(config.backgroundMusic, false);
});

test('Sita Kalyanam: exactly nine story sections occur in the required order', () => {
  const expected = ['opening', 'cover', 'family', 'muhurtham', 'events', 'reception', 'venue', 'moments', 'countdown'];
  assert.deepEqual(config.sections, expected);
  assert.deepEqual(sectionIds(htmlFor()), expected);
  assert.deepEqual(sectionIds(htmlFor({})), expected);
});

test('Sita Kalyanam: a second customer and an empty draft never inherit demo identities or events', () => {
  const data = { ...demo(), groomName: 'Nikhil Rao', brideName: 'Kavya Menon', groomFather: 'Dev Rao', groomMother: 'Ila Rao', brideFather: 'Ravi Menon', brideMother: 'Uma Menon', venueName: 'Fictional Lotus Hall', venueAddress: '9 Imaginary Lane', receptionVenue: '', receptionAddress: '', events: [], gallery: [], weddingDate: '2028-02-29', receptionDate: '2028-03-01' };
  const html = htmlFor(data);
  for (const key of ['groomName', 'brideName', 'groomFather', 'groomMother', 'brideFather', 'brideMother', 'venueName', 'venueAddress']) contains(html, data[key]);
  for (const output of [html, htmlFor({}), render(), render({ customer_data: null })]) {
    for (const key of ['groomName', 'brideName', 'groomFather', 'groomMother', 'brideFather', 'brideMother', 'venueName']) excludes(output, config.demo[key]);
    excludes(output, '2027-08-15');
    assert.deepEqual(eventsIn(output), []);
  }
  contains(section(html, 'reception'), data.venueName);
  contains(section(html, 'reception'), data.venueAddress);
});

test('Sita Kalyanam: every custom display-copy field reaches the document, including optional labels', () => {
  const data = { ...demo(), musicUpload: upload(1, 'mp3'), qrUrl: 'https://example.com/our-wedding' };
  const excluded = new Set(['weddingTime', 'receptionTime', 'countdownTime', 'utcOffset']);
  const fields = schema.FIELDS.filter(f => ['text', 'textarea'].includes(f.type) && !excluded.has(f.id));
  for (const field of fields) data[field.id] = ('Custom ' + field.id).slice(0, field.maxLength);
  assert.doesNotThrow(() => schema.validate(data));
  const html = htmlFor(data);
  for (const field of fields.filter(f => f.id !== 'eventsEmptyMessage')) contains(html, data[field.id]);
  contains(htmlFor({ ...data, events: [] }), data.eventsEmptyMessage);
  const event = { ...data.events[0], name: 'Custom ceremony', venue: 'Event-specific hall', address: 'Event-specific address' };
  const eventHtml = section(htmlFor({ ...data, events: [event] }), 'events');
  for (const key of ['name', 'venue', 'address']) contains(eventHtml, event[key]);
});

test('Sita Kalyanam: names, parents, multiline long copy and caption attributes escape HTML', () => {
  const payload = '<script>alert("x")</script> & \'quoted\'';
  const data = demo();
  for (const field of schema.FIELDS.filter(f => ['text', 'textarea'].includes(f.type) && !['weddingTime', 'receptionTime', 'countdownTime', 'utcOffset'].includes(f.id))) data[field.id] = payload.slice(0, field.maxLength);
  data.invitationMessage = payload + '\n' + 'A'.repeat(600);
  data.gallery = [{ image: upload(), caption: payload }];
  const html = htmlFor(data);
  excludes(html, '<script>alert(');
  excludes(html, 'data-caption="' + payload);
  contains(html, escape(payload));
  contains(html, 'A'.repeat(600));
  contains(html, 'data-caption="' + escape(payload) + '"');
  contains(html, '<br>');
});

test('Sita Kalyanam: maximum-length names and copy are retained; overlong input is rejected or trimmed', () => {
  const data = { ...demo(), groomName: 'G'.repeat(80), brideName: 'B'.repeat(80), groomFather: 'F'.repeat(80), invitationMessage: 'I'.repeat(800) };
  assert.doesNotThrow(() => schema.validate(data));
  for (const key of ['groomName', 'brideName', 'groomFather', 'invitationMessage']) contains(htmlFor(data), data[key]);
  assert.throws(() => schema.validate({ ...data, groomName: 'G'.repeat(81) }));
  assert.equal(schema.validate({ ...data, groomName: 'G'.repeat(81) }, { mode: 'lenient' }).groomName.length, 80);
});

test('Sita Kalyanam: weekdays derive from civil dates, ignoring stale supplied weekday fields', () => {
  for (const [date, weekday] of [['2027-08-15', 'Sunday'], ['2028-02-29', 'Tuesday'], ['2027-01-01', 'Friday']]) {
    assert.equal(schema.weekday(date), weekday);
    const html = section(htmlFor({ ...demo(), weddingDate: date, weddingDay: 'Wrongday', weekday: 'Wrongday' }), 'muhurtham');
    contains(html, weekday); excludes(html, 'Wrongday'); contains(html, 'datetime="' + date + '"');
  }
  assert.equal(schema.weekday('2027-02-29'), '');
});

test('Sita Kalyanam: dates and 24-hour inputs display readable local dates and AM/PM times', () => {
  assert.equal(dateLabel('2028-02-29'), '29 February 2028');
  assert.equal(dateLabel(''), '');
  for (const [time, expected] of [['00:00', '12:00 AM'], ['06:45', '6:45 AM'], ['12:00', '12:00 PM'], ['19:00', '7:00 PM'], ['23:59', '11:59 PM']]) assert.equal(timeLabel(time), expected);
  assert.equal(timeLabel('24:00'), '');
  const html = htmlFor();
  contains(section(html, 'muhurtham'), '15 August 2027'); contains(section(html, 'muhurtham'), '6:45 AM');
  contains(section(html, 'reception'), '7:00 PM');
  for (const key of ['weddingDate', 'receptionDate', 'countdownDate']) assert.throws(() => schema.validate({ ...demo(), [key]: '2027-02-29' }));
  for (const key of ['weddingTime', 'receptionTime', 'countdownTime']) for (const value of ['24:00', '12:60', '6:45', '7 PM']) assert.throws(() => schema.validate({ ...demo(), [key]: value }));
});

test('Sita Kalyanam: countdown follows wedding edits and applies date/time overrides independently', () => {
  const data = { ...demo(), weddingDate: '2029-12-31', weddingTime: '23:15' };
  for (const [changes, expected] of [[{}, '2029-12-31T23:15:00+05:30'], [{ countdownDate: '2030-01-02' }, '2030-01-02T23:15:00+05:30'], [{ countdownTime: '09:30' }, '2029-12-31T09:30:00+05:30'], [{ countdownDate: '2030-01-02', countdownTime: '09:30', utcOffset: '-04:00' }, '2030-01-02T09:30:00-04:00']]) {
    assert.equal(schema.countdownTarget({ ...data, ...changes }), expected);
    contains(htmlFor({ ...data, ...changes }), 'data-target="' + expected + '"');
  }
  assert.equal(schema.countdownTarget({}), '');
  assert.equal(schema.countdownTarget({ weddingDate: '2030-01-01' }), '');
  for (const bad of ['05:30', '+14:01', '-15:00', '+05:60']) assert.throws(() => schema.validate({ ...data, utcOffset: bad }));
  for (const valid of ['+14:00', '-14:00', '+00:00', '-03:30']) assert.doesNotThrow(() => schema.validate({ ...data, utcOffset: valid }));
});

test('Sita Kalyanam: exported pure countdown handles future, exact expiry, past and incomplete targets', () => {
  const { countdownParts } = require('../public/sita-kalyanam/invitation.js');
  const now = Date.parse('2030-01-01T00:00:00Z');
  assert.deepEqual(countdownParts(now + (86400 + 7200 + 180 + 4) * 1000, now), { days: 1, hours: 2, minutes: 3, seconds: 4, expired: false, valid: true });
  for (const target of [now, now - 1000, new Date(now - 86400000)]) assert.deepEqual(countdownParts(target, now), { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true, valid: true });
  for (const target of ['', undefined, 'not a date', '2030-01-01']) assert.deepEqual(countdownParts(target, now), { days: 0, hours: 0, minutes: 0, seconds: 0, expired: false, valid: false });
  const data = { ...demo(), weddingDate: '2030-01-01', weddingTime: '12:00', utcOffset: '+05:30' };
  const first = countdownParts(schema.countdownTarget(data), now);
  const second = countdownParts(schema.countdownTarget({ ...data, utcOffset: '+00:00' }), now);
  assert.equal(first.hours, 6); assert.equal(first.minutes, 30); assert.equal(second.hours, 12);
});

test('Sita Kalyanam: zero, one and twenty events render only authored entries, allowing duplicate kinds', () => {
  for (const count of [0, 1, 20]) {
    const events = Array.from({ length: count }, (_, i) => ({ ...demo().events[0], name: 'Unique event ' + i }));
    const data = { ...demo(), events };
    assert.equal(schema.validate(data).events.length, count);
    assert.deepEqual(eventsIn(htmlFor(data)), events.map(e => e.name));
    if (!count) contains(section(htmlFor(data), 'events'), data.eventsEmptyMessage);
  }
  assert.throws(() => schema.validate({ ...demo(), events: Array.from({ length: 21 }, () => demo().events[0]) }));
});

test('Sita Kalyanam: adding, removing and reordering events preserves authored order and independent details', () => {
  const base = demo();
  const added = { kind: 'other', name: 'A different ceremony', date: '2028-02-29', time: '23:59', venue: 'Other Hall', address: 'Other Road' };
  const events = [added, base.events[2], base.events[0]];
  const html = htmlFor({ ...base, events });
  assert.deepEqual(eventsIn(html), events.map(e => e.name));
  contains(section(html, 'events'), '29 February 2028'); contains(section(html, 'events'), '11:59 PM');
  excludes(section(html, 'events'), base.events[1].name);
  assert.deepEqual(eventsIn(htmlFor({ ...base, events: events.slice(1) })), events.slice(1).map(e => e.name));
  for (const change of [{ kind: 'unknown' }, { name: '' }, { date: '2028-02-30' }, { time: '25:30' }]) assert.throws(() => schema.validate({ ...base, events: [{ ...added, ...change }] }));
});

test('Sita Kalyanam: gallery supports zero, one, multiple uploads and authored removal/reordering', () => {
  for (const count of [0, 1, 4, 12]) {
    const gallery = Array.from({ length: count }, (_, i) => ({ image: upload(i + 1), caption: 'Memory ' + i }));
    const data = { ...demo(), gallery };
    assert.equal(schema.validate(data).gallery.length, count);
    assert.deepEqual(gallerySources(htmlFor(data)), gallery.map(p => p.image));
    for (const photo of gallery) contains(section(htmlFor(data), 'moments'), '<figcaption>' + photo.caption + '</figcaption>');
    assert.deepEqual(gallerySources(htmlFor({ ...data, gallery: gallery.slice(1).reverse() })), gallery.slice(1).reverse().map(p => p.image));
  }
  assert.deepEqual(gallerySources(htmlFor({ ...demo(), couplePhoto: upload(8), gallery: [] })), [upload(8)]);
  assert.deepEqual(gallerySources(htmlFor({ ...demo(), couplePhoto: upload(8), gallery: [{ image: upload(9), caption: '' }] })), [upload(9)]);
});

test('Sita Kalyanam: optional family and venue photos can be added and removed without sample photography', () => {
  const data = { ...demo(), groomFamilyPhoto: upload(2), brideFamilyPhoto: upload(3), venuePhoto: upload(4) };
  assert.doesNotThrow(() => schema.validate(data));
  const html = htmlFor(data);
  contains(section(html, 'family'), upload(2)); contains(section(html, 'family'), upload(3)); contains(section(html, 'venue'), upload(4));
  const empty = htmlFor({ ...data, groomFamilyPhoto: '', brideFamilyPhoto: '', venuePhoto: '' });
  for (const src of [upload(2), upload(3), upload(4)]) excludes(empty, src);
  contains(section(empty, 'venue'), 'not a photograph of the venue');
});

test('Sita Kalyanam: maps default to encoded customer venue; safe custom directions and QR are optional', () => {
  const data = { ...demo(), venueName: 'Hall & Gardens', venueAddress: 'Line 1\nPune #42', mapsUrl: '', qrUrl: '' };
  assert.equal(schema.mapsHref(data), 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Hall & Gardens, Line 1\nPune #42'));
  excludes(section(htmlFor(data), 'venue'), 'class="sk-qr"');
  const custom = htmlFor({ ...data, mapsUrl: 'https://maps.example.com/place?a=1&b=2', qrUrl: 'https://example.com/invite?id=42' });
  contains(custom, 'href="https://maps.example.com/place?a=1&amp;b=2"');
  contains(custom, 'href="https://example.com/invite?id=42"');
  assert.match(section(custom, 'venue'), /class="sk-qr"[^>]*rel="noopener noreferrer"[^>]*><svg/);
  assert.equal(schema.mapsHref({}), '');
});

test('Sita Kalyanam: unsafe maps/QR destinations reject strict and cannot become active HTML in preview', () => {
  for (const key of ['mapsUrl', 'qrUrl']) for (const bad of ['javascript:alert(1)', 'data:text/html,<script>x</script>', 'http://example.com/a', 'https://user:pass@example.com/a', 'https://example.com/" onclick="alert(1)', 'https://example.com/a%0d%0aX', 'https://example.com/\\evil']) {
    const data = { ...demo(), [key]: bad };
    assert.throws(() => schema.validate(data), key + ': ' + bad);
    assert.equal(schema.validate(data, { mode: 'lenient' })[key], '');
    excludes(htmlFor(data), bad);
  }
});

test('Sita Kalyanam: image fields and galleries accept local uploads, not remote/data/traversal/XSS sources', () => {
  const keys = ['couplePhoto', 'groomFamilyPhoto', 'brideFamilyPhoto', 'venuePhoto'];
  for (const bad of ['https://evil.example/photo.jpg', 'javascript:alert(1)', 'data:image/svg+xml,<svg onload=x>', '/bfday/uploads/../photo.png', upload() + '" onerror="x']) {
    for (const key of keys) {
      assert.throws(() => schema.validate({ ...demo(), [key]: bad }));
      assert.equal(schema.validate({ ...demo(), [key]: bad }, { mode: 'lenient' })[key], '');
      excludes(htmlFor({ ...demo(), [key]: bad }), bad);
    }
    assert.throws(() => schema.validate({ ...demo(), gallery: [{ image: bad, caption: '' }] }));
    assert.deepEqual(gallerySources(htmlFor({ ...demo(), gallery: [{ image: bad, caption: '' }] })), []);
  }
});

test('Sita Kalyanam: direct HTTPS audio and valid YouTube links work, without autoplay', () => {
  for (const link of ['https://example.com/song.mp3', 'https://example.com/SONG.M4A?token=one&x=two', 'https://example.com/song.ogg', 'https://example.com/song.wav#start', 'https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com/shorts/dQw4w9WgXcQ']) {
    assert.doesNotThrow(() => schema.validate({ ...demo(), musicLink: link }));
    const html = htmlFor({ ...demo(), musicLink: link });
    if (link.includes('youtu')) { contains(html, 'data-youtube="dQw4w9WgXcQ"'); excludes(html, '<audio'); }
    else { contains(html, 'src="' + escape(link) + '"'); contains(html, '<audio'); }
    excludes(html, ' autoplay');
  }
});

test('Sita Kalyanam: unsupported music links are rejected and uploaded music always takes preference', () => {
  for (const bad of ['http://example.com/song.mp3', 'https://open.spotify.com/track/123', 'https://music.apple.com/song/123', 'https://example.com/song.mp3.exe', 'https://example.com/?file=song.mp3', 'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ', 'https://youtu.be/short', 'javascript:alert(1)']) {
    assert.throws(() => schema.validate({ ...demo(), musicLink: bad }));
    assert.equal(schema.validate({ ...demo(), musicLink: bad }, { mode: 'lenient' }).musicLink, '');
    excludes(htmlFor({ ...demo(), musicLink: bad }), '<audio');
    excludes(htmlFor({ ...demo(), musicLink: bad }), 'data-youtube=');
  }
  for (const link of ['https://example.com/song.mp3', 'https://youtu.be/dQw4w9WgXcQ']) {
    const html = htmlFor({ ...demo(), musicUpload: upload(1, 'wav'), musicLink: link });
    contains(html, 'src="' + upload(1, 'wav') + '"'); excludes(html, link); excludes(html, 'data-youtube=');
  }
  excludes(htmlFor(), '<audio'); excludes(htmlFor(), 'data-sk-music-toggle');
  assert.throws(() => schema.validate({ ...demo(), musicUpload: 'https://example.com/song.mp3' }));
});

test('Sita Kalyanam: independent renderer calls do not mutate input/defaults or leak across customers', () => {
  const original = demo(); const snapshot = structuredClone(original);
  const defaultsBefore = structuredClone(config.demo);
  const first = { ...demo(), groomName: 'Customer Alpha', gallery: [{ image: upload(7), caption: 'Alpha memory' }], events: [{ ...demo().events[0], name: 'Alpha event' }], musicUpload: upload(7, 'mp3') };
  const before = htmlFor(original);
  const a = htmlFor(first);
  const b = htmlFor({ ...demo(), groomName: 'Customer Beta', gallery: [], events: [], musicUpload: '' });
  contains(a, 'Customer Alpha'); contains(b, 'Customer Beta');
  for (const needle of ['Customer Alpha', 'Alpha memory', 'Alpha event', upload(7), upload(7, 'mp3')]) excludes(b, needle);
  assert.equal(htmlFor(original), before);
  assert.deepEqual(original, snapshot);
  assert.deepEqual(config.demo, defaultsBefore);
});

test('Sita Kalyanam: no-JS HTML remains an openable continuous invitation with static countdown date', () => {
  const html = htmlFor();
  contains(html, 'class="no-js sk-html"');
  assert.match(section(html, 'opening'), /<a\b[^>]*href="#cover"[^>]*>/);
  for (const id of config.sections) {
    const markup = section(html, id);
    assert.ok(markup, id + ' is server-rendered');
    assert.doesNotMatch(markup.slice(0, markup.indexOf('>')), /\b(?:hidden|inert)\b|aria-hidden="true"/);
  }
  assert.match(section(html, 'countdown'), /<noscript>[\s\S]*15 August 2027[\s\S]*6:45 AM[\s\S]*<\/noscript>/);
  const css = fs.readFileSync(path.join(root, 'public/sita-kalyanam/invitation.css'), 'utf8');
  assert.match(css, /\.no-js\s+\.sk-nojs-link\s*\{[^}]*display\s*:\s*block/);
});

test('Sita Kalyanam: rendered local illustration and runtime references exist', () => {
  const html = htmlFor();
  const refs = new Set([...html.matchAll(/(?:src|href)="(\/sita-kalyanam\/[^"?#]+)(?:\?[^"#]*)?"/g)].map(m => m[1]));
  assert.ok(refs.size > 0);
  for (const ref of refs) assert.ok(fs.existsSync(path.join(root, 'public', ref)), 'missing local asset: ' + ref);
});

test('Sita Kalyanam: packaged image hashes and asset-loader healing, when the concurrent loader is available', t => {
  const source = path.join(root, 'lib/bfday/assets-sita-kalyanam.js');
  const manifestPath = path.join(root, 'assets/sita-kalyanam/manifest.json');
  if (!fs.existsSync(source) || !fs.existsSync(manifestPath)) return t.skip('Concurrent asset loader/manifest is not yet present');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const files = new Map();
  const fakeFs = {
    readFileSync(file, encoding) {
      if (file.startsWith(path.join(root, 'public') + path.sep)) {
        if (!files.has(file)) throw Error('ENOENT');
        return files.get(file);
      }
      return fs.readFileSync(file, encoding);
    },
    mkdirSync() {},
    writeFileSync(file, data) { files.set(file, Buffer.from(data)); },
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(source, 'utf8'), { module, exports: module.exports, __dirname: path.dirname(source), require: name => ['node:fs', 'fs'].includes(name) ? fakeFs : require(name), Buffer });
  const { assets, ensureSitaKalyanamAssets } = module.exports;
  assert.ok(Array.isArray(assets) && assets.length > 0);
  assert.equal(assets.length, Object.keys(manifest).length);
  const hash = data => crypto.createHash('sha256').update(data).digest('hex');
  for (const asset of assets) assert.equal(hash(Buffer.from(asset.data, 'base64')), manifest[asset.path]);
  assert.equal(ensureSitaKalyanamAssets().length, assets.length);
  assert.equal(ensureSitaKalyanamAssets().length, 0);
  const damaged = path.join(root, 'public', assets[0].path);
  files.set(damaged, Buffer.from('corrupted'));
  assert.equal(ensureSitaKalyanamAssets().length, 1);
  assert.equal(hash(files.get(damaged)), assets[0].sha256);
});

test('Sita Kalyanam: linked event schedules and inherited venues track current customer details', () => {
  const d = schema.resolve({ ...demo(), weddingDate:'2028-02-29', weddingTime:'08:15', receptionDate:'2028-03-01', receptionTime:'20:30', venueName:'Changed Garden', venueAddress:'Changed Road', receptionVenue:'Evening Hall', receptionAddress:'Evening Road' });
  const wedding = schema.eventDetails({kind:'wedding',name:'Vows',schedule:'wedding',date:'',time:'',venue:'',address:''}, d);
  assert.equal(wedding.date,'2028-02-29'); assert.equal(wedding.time,'08:15'); assert.equal(wedding.venue,'Changed Garden'); assert.equal(wedding.address,'Changed Road');
  const reception = schema.eventDetails({...wedding,schedule:'reception',venue:'',address:''},d);
  assert.equal(reception.date,'2028-03-01'); assert.equal(reception.time,'20:30'); assert.equal(reception.venue,'Evening Hall');
  const override = schema.eventDetails({...wedding,venue:'Independent Venue',address:'Independent Road'},d);
  assert.equal(override.venue,'Independent Venue'); assert.equal(override.address,'Independent Road');
  assert.equal(schema.resolve({ ...d, events:[wedding] }).events.length,1);
});
test('Sita Kalyanam: incomplete custom event schedules can be saved as drafts but cannot publish', () => {
  const d={...demo(),events:[{kind:'haldi',name:'Custom Haldi',schedule:'custom',date:'',time:'',venue:'',address:''}]};
  assert.equal(schema.validate(d,{mode:'draft'}).events.length,1);
  assert.throws(()=>schema.validate(d,{mode:'strict'}),/event_schedule_required/);
  assert.equal(schema.resolve(d).events.length,0);
});

test('Sita Kalyanam: opener uses one unsliced still painting with a subtle aligned reduced-motion glow', () => {
  const html=htmlFor(), opening=section(html,'opening');
  assert.match(opening, /class="sk-touch-glow"/);
  assert.match(opening, /preserveAspectRatio="xMidYMid slice"/);
  assert.doesNotMatch(opening, /sk-hand--|sk-opening-clouds|clipPath/i);
  assert.match(opening, /data-sk-open/);
  for (const text of [config.demo.openingHeading,config.demo.openingMessage,config.demo.openingButton,'PAIGAAM']) contains(opening,text);
  const css=fs.readFileSync(path.join(root,'public/sita-kalyanam/invitation.css'),'utf8');
  assert.match(css,/\.sk-opening\{[^}]*url\('\/sita-kalyanam\/opening\.webp'\) center\/cover/);
  assert.match(css,/\.sk-touch-glow\{[^}]*animation:sk-touch-pulse 7s/);
  assert.doesNotMatch(css,/sk-hand--|sk-rama-reach|sk-sita-reach/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/animation:none!important/);
});
