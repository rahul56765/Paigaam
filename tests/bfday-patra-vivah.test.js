'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const config = require('../templates/patra-vivah/config');
const schema = require('../templates/patra-vivah/schema');
const fields = require('../lib/bfday/fields');
const { bfdayCreatePage } = require('../pages/bfdayCreate');
const demo = () => structuredClone(config.demo);
const upload = ext => '/bfday/uploads/' + 'a'.repeat(48) + '.' + ext;
const entry = n => ({ time: '2:00 PM', event: 'Event ' + n, venue: 'Venue ' + n });

test('Patra Vivah config: discoverable, three pages, strict demo, all fields placed exactly once', () => {
  assert.ok(require('../templates/bfday').includes(config.slug));
  assert.doesNotThrow(() => schema.validate(demo()));
  assert.deepEqual(config.sections, ['cover', 'save', 'itinerary']);
  assert.equal(config.demo.saveDate, '2026-08-22');
  assert.equal(config.demo.saveHeading, 'Save the Date');
  assert.equal(config.demo.itineraryHeading, 'Wedding Itinerary');
  const placed = config.steps.flatMap(s => s.fields);
  assert.equal(new Set(placed).size, placed.length);
  assert.deepEqual(placed.slice().sort(), schema.FIELDS.map(f => f.id).sort());
  for (const id of ['couplePhoto', 'monogramLogo']) assert.equal(schema.FIELDS.find(f => f.id === id).preserveTransparency, true);
  assert.equal(schema.FIELDS.some(f => f.id === 'bgmSong'), false);
  // Parent renderer may still be in progress when this config/editor suite runs.
  if (fs.existsSync(path.join(__dirname, '../templates/patra-vivah/render.js'))) {
    assert.ok(require('../lib/bfday/family').has(config.slug));
  }
});

test('Patra Vivah nested contract survives validation and resolve, preserving authored order', () => {
  const data = demo(); data.days.reverse(); data.days[0].events.reverse();
  const clean = schema.validate(data);
  assert.deepEqual(clean.days, data.days);
  assert.deepEqual(fields.resolve(config, clean, schema).days, data.days);
  assert.deepEqual(fields.resolve(config, {}, schema).days, config.demo.days);
  data.days[0].ignored = 'no'; data.days[0].events[0].ignored = 'no'; data.ignored = 'no';
  const filtered = schema.validate(data);
  assert.equal(filtered.ignored, undefined);
  assert.equal(filtered.days[0].ignored, undefined);
  assert.equal(filtered.days[0].events[0].ignored, undefined);
  assert.notEqual(filtered.days[0], data.days[0]);
});

test('Patra Vivah finite capacity: 4 days and 10 total entries, not ten per day', () => {
  const data = demo();
  data.days = [3, 3, 2, 2].map((n, d) => ({ heading: 'Day ' + d, events: Array.from({ length: n }, (_, i) => entry(i)) }));
  assert.equal(schema.validate(data).days.length, 4);
  data.days[0].events.push(entry(11));
  for (const mode of ['strict', 'draft']) assert.throws(() => schema.validate(data, { mode }), e => e.code === 'itinerary_capacity');
  const limited = schema.validate(data, { mode: 'lenient' });
  assert.equal(limited.days.reduce((n, d) => n + d.events.length, 0), 10);
  data.days = Array.from({ length: 5 }, (_, i) => ({ heading: 'Day ' + i, events: [entry(i)] }));
  for (const mode of ['strict', 'draft']) assert.throws(() => schema.validate(data, { mode }));
  assert.equal(schema.validate(data, { mode: 'lenient' }).days.length, 4);
});

test('Patra Vivah strict requires complete nested itinerary, draft and lenient safely drop incomplete rows', () => {
  for (const days of [[], [{ heading: 'Day', events: [] }], [{ heading: 'Day', events: [{ ...entry(0), time: '' }] }], [{ heading: '', events: [entry(0)] }]]) {
    const data = { ...demo(), days };
    assert.throws(() => schema.validate(data));
    assert.doesNotThrow(() => schema.validate(data, { mode: 'draft' }));
    assert.doesNotThrow(() => schema.validate(data, { mode: 'lenient' }));
  }
  for (const days of ['bad', [null], [{ heading: 'Day', events: 'bad' }], [{ heading: 'Day', events: [42] }]]) {
    assert.throws(() => schema.validate({ ...demo(), days }));
    assert.doesNotThrow(() => schema.validate({ ...demo(), days }, { mode: 'lenient' }));
  }
});

test('Patra Vivah enforces every text length and strips control characters in permissive previews', () => {
  for (const f of schema.FIELDS.filter(f => f.maxLength)) {
    const data = { ...demo(), [f.id]: 'a'.repeat(f.maxLength + 1) };
    assert.throws(() => schema.validate(data));
    assert.doesNotThrow(() => schema.validate(data, { mode: 'lenient' }));
  }
  const itinerary = schema.FIELDS.find(f => f.id === 'days');
  const specs = [itinerary.shape[0], ...itinerary.shape[1].shape];
  for (const spec of specs) {
    const data = demo(), target = spec.id === 'heading' ? data.days[0] : data.days[0].events[0];
    target[spec.id] = 'x'.repeat(spec.maxLength + 1);
    assert.throws(() => schema.validate(data));
    const clean = schema.validate(data, { mode: 'lenient' });
    const result = spec.id === 'heading' ? clean.days[0].heading : clean.days[0].events[0][spec.id];
    assert.equal(result.length, spec.maxLength);
    target[spec.id] = 'A\u0000B\nC';
    assert.throws(() => schema.validate(data));
    const safe = schema.validate(data, { mode: 'lenient' });
    assert.ok(!JSON.stringify(safe).includes('\\u0000'));
  }
});

test('Patra Vivah audio: opt-in uploads, HTTPS direct audio and strictly parsed YouTube hosts', () => {
  for (const musicLink of ['https://cdn.example/song.mp3?key=1', 'https://cdn.example/song.M4A', 'https://cdn.example/song.ogg', 'https://cdn.example/song.wav', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ', 'https://youtube.com/shorts/dQw4w9WgXcQ']) {
    assert.equal(schema.validate({ ...demo(), musicLink }).musicLink, musicLink);
  }
  for (const musicLink of ['http://cdn.example/song.mp3', 'javascript:alert(1)', 'https://youtube.com.evil/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQevil', 'https://youtube.com/watch?v=dQw4w9WgXcQevil', 'https://user:pass@cdn.example/song.mp3', 'https://open.spotify.com/track/123']) {
    assert.throws(() => schema.validate({ ...demo(), musicLink }));
    assert.equal(schema.validate({ ...demo(), musicLink }, { mode: 'lenient' }).musicLink, '');
  }
  for (const ext of ['mp3', 'm4a', 'ogg', 'wav']) {
    const data = schema.validate({ ...demo(), musicUpload: upload(ext) });
    assert.deepEqual(fields.audioIn(schema.FIELDS, data), [upload(ext)]);
  }
  assert.throws(() => schema.validate({ ...demo(), musicUpload: 'https://cdn.example/song.mp3' }));
  const data = schema.validate({ ...demo(), couplePhoto: upload('png'), monogramLogo: upload('webp') });
  assert.deepEqual(fields.imagesIn(schema.FIELDS, data), [upload('png'), upload('webp')]);
  assert.equal(fields.maxImages(schema.FIELDS), 2);
});

test('Patra Vivah nested editor is strictly opt-in; other templates still reject nested list declarations', () => {
  const nested = structuredClone(config.fields.find(f => f.id === 'days'));
  delete nested.editor;
  assert.throws(() => fields.normalizeFields([nested]), /lists cannot be nested/);
  const deep = structuredClone(config.fields.find(f => f.id === 'days'));
  deep.shape[1].shape.push({ id: 'deeper', type: 'list', label: 'No', item: { type: 'text' } });
  assert.throws(() => fields.normalizeFields([deep]), /lists cannot be nested/);
});

test('Patra Vivah creator opts into nested editor before shared JS; existing creators do not', () => {
  const html = bfdayCreatePage({ slug: config.slug, config, fields: schema.FIELDS });
  assert.ok(html.includes('data-list="days"'));
  assert.ok(html.includes('data-add="days"'));
  assert.ok(html.includes('nested-itinerary'));
  assert.ok(html.indexOf('/bfday/itinerary-editor.js') < html.indexOf('/bfday/create.js'));
  assert.ok(html.includes('10 entries in total'));
  const other = require('../templates/lotus-vivah/config');
  const otherHTML = bfdayCreatePage({ slug: other.slug, config: other, fields: fields.normalizeFields(other.fields) });
  assert.ok(!otherHTML.includes('/bfday/itinerary-editor.js'));
  const shared = fs.readFileSync(path.join(__dirname, '../public/bfday/create.js'), 'utf8');
  assert.ok(shared.includes('c.problem()'));
  assert.ok(shared.includes('window.PaigaamItineraryEditor'));
});

// Tiny DOM harness tests the actual standalone editor script without browser/DB/dependencies.
function editorHarness() {
  class Node {
    constructor(tag, cls, text) { this.tagName = tag; this.className = cls || ''; this.children = []; this.listeners = {}; this.attributes = {}; this.disabled = false; this._text = text || ''; }
    appendChild(node) { if (node.parentNode) node.parentNode.removeChild(node); this.children.push(node); node.parentNode = this; return node; }
    removeChild(node) { this.children.splice(this.children.indexOf(node), 1); node.parentNode = null; }
    insertBefore(node, before) { this.children.splice(this.children.indexOf(before), 0, node); node.parentNode = this; }
    set textContent(text) { this._text = text; this.children.forEach(n => { n.parentNode = null; }); this.children = []; }
    get textContent() { return this._text + this.children.map(n => n.textContent).join(''); }
    setAttribute(k, v) { this.attributes[k] = v; }
    addEventListener(k, fn) { this.listeners[k] = fn; }
    click() { if (!this.disabled && this.listeners.click) this.listeners.click(); }
    focus() { focused = this; }
  }
  let focused = null, changed = 0;
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/bfday/itinerary-editor.js'), 'utf8'), { window });
  const parent = new Node('div'), host = new Node('div'), add = new Node('button'); parent.appendChild(host); parent.appendChild(add);
  const make = (tag, cls, text) => new Node(tag, cls, text);
  const scalarControl = (spec, initial) => {
    const el = make('input'); el.value = initial || ''; el.maxLength = spec.maxLength;
    return { el, get: () => el.value.trim(), focus: () => el.focus() };
  };
  const f = schema.FIELDS.find(f => f.id === 'days');
  const control = window.PaigaamItineraryEditor(f, host, add, { make, scalarControl, changed: () => { changed++; } });
  const all = node => [node, ...node.children.flatMap(all)];
  const buttons = (node, label) => all(node).filter(n => n.attributes['aria-label'] === label);
  const plain = x => JSON.parse(JSON.stringify(x));
  return { control, parent, host, add, buttons, all, plain, get changes() { return changed; }, get focused() { return focused; } };
}

test('Patra Vivah actual editor adds/removes/reorders both levels and resumes without duplicate rows', () => {
  const h = editorHarness();
  assert.deepEqual(h.plain(h.control.get()), config.demo.days);
  h.buttons(h.host, 'Move down day')[0].click();
  assert.equal(h.control.get()[0].heading, config.demo.days[1].heading);
  h.buttons(h.host.children[0], 'Move down entry')[0].click();
  assert.equal(h.control.get()[0].events[0].event, config.demo.days[1].events[1].event);
  h.buttons(h.host.children[0], 'Remove entry')[0].click();
  assert.equal(h.control.get()[0].events.length, config.demo.days[1].events.length - 1);
  h.buttons(h.host, 'Remove day')[0].click();
  assert.equal(h.control.get().length, config.demo.days.length - 1);
  h.add.click(); assert.equal(h.control.get().length, config.demo.days.length);
  assert.ok(h.control.problem());
  h.control.set(config.demo.days);
  h.control.set(config.demo.days);
  assert.deepEqual(h.plain(h.control.get()), config.demo.days);
  assert.equal(h.control.problem(), null);
  assert.equal(h.host.children.length, config.demo.days.length);
  assert.ok(h.changes > 0);
});

test('Patra Vivah actual editor enforces capacity and uses text-only controls for malicious copy', () => {
  const h = editorHarness();
  const value = Array.from({ length: 4 }, (_, i) => ({ heading: 'Day ' + i, events: [entry(i)] }));
  h.control.set(value); assert.equal(h.add.disabled, true);
  const addEntry = day => h.all(day).find(n => n.tagName === 'button' && n._text === 'Add an entry');
  for (let i = 0; i < 6; i++) addEntry(h.host.children[0]).click();
  assert.equal(h.control.get().reduce((n, d) => n + d.events.length, 0), 10);
  assert.ok(h.host.children.every(day => addEntry(day).disabled));
  h.buttons(h.host.children[0], 'Remove entry')[0].click();
  assert.equal(addEntry(h.host.children[0]).disabled, false);
  const malicious = '<img src=x onerror=alert(1)>';
  h.control.set([{ heading: malicious, events: [{ time: '2PM', event: malicious, venue: malicious }] }]);
  assert.equal(h.control.get()[0].heading, malicious);
  assert.equal(h.all(h.host).some(n => n.tagName === 'img'), false);
  h.control.set([]); assert.ok(h.control.problem());
  h.control.focus(); assert.equal(h.focused, h.add);
});
