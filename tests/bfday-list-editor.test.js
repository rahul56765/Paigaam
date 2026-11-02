'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { normalizeFields, makeSchema } = require('../lib/bfday/fields');
const config = require('../templates/shubh-sangam/config');
const schema = require('../templates/shubh-sangam/schema');

class Element {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.listeners = {}; this.style = {}; this.value = ''; this.className = ''; this.hidden = false; this.disabled = false; this._text = ''; this.classList = { add: c => { this.className += ' ' + c; }, toggle() {} }; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); this.children.push(c); c.parentNode = this; return c; }
  removeChild(c) { const n = this.children.indexOf(c); if (n < 0) throw Error('not a child'); this.children.splice(n, 1); c.parentNode = null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  removeAttribute(k) { delete this.attrs[k]; }
  set textContent(v) { this.children.forEach(c => { c.parentNode = null; }); this.children = []; this._text = String(v); }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  matches(s) { if (s.startsWith('#')) return this.id === s.slice(1); if (s.startsWith('.')) return this.className.split(/\s+/).includes(s.slice(1)); const m = s.match(/^([\w-]+)?\[([^=]+)=["']?([^"'\]]+)["']?\]$/); return m ? (!m[1] || this.tagName === m[1].toUpperCase()) && String(this.attrs[m[2]] ?? this[m[2]]) === m[3] : this.tagName === s.toUpperCase(); }
  querySelectorAll(s) { const out = []; function visit(e) { for (const c of e.children) { if (c.matches(s)) out.push(c); visit(c); } } visit(this); return out; }
  querySelector(s) { return this.querySelectorAll(s)[0] || null; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  dispatchEvent(e) { e.target = this; for (const f of this.listeners[e.type] || []) f(e); }
  click() { if (!this.disabled) this.dispatchEvent({ type: 'click', preventDefault() {} }); }
  focus() { this.focused = true; }
  getContext() { return { fillRect() {}, drawImage() {} }; }
  toBlob(cb, type) { cb({ size: 1000, type }); }
}
const photo = n => '/bfday/uploads/' + String(n).repeat(48).slice(0, 48) + '.jpg';
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
function setup(fields, stepFields, { strictPublish = false } = {}) {
  const doc = new Element('document'); const window = {};
  doc.createElement = tag => new Element(tag);
  doc.getElementById = id => doc.querySelector('#' + id);
  function add(tag, id, parent = doc) { const e = new Element(tag); e.id = id; parent.appendChild(e); return e; }
  add('script', 'bfSpec').textContent = JSON.stringify({ slug: 'shubh-sangam', lastStep: stepFields.length, fields, stepFields });
  const form = add('form', 'bfForm');
  for (let i = 0; i <= stepFields.length; i++) { const section = add('section', null, form); section.className = 'step'; section.setAttribute('data-step', i); section.appendChild(new Element('h2')); }
  for (const id of ['back', 'next', 'publish', 'savePreview']) add('button', id, form);
  for (const id of ['status', 'formError', 'review']) add('div', id);
  for (const f of fields) { if (f.type === 'list') { const host = add('div', null, form); host.setAttribute('data-list', f.id); const btn = add('button', null, form); btn.setAttribute('data-add', f.id); } else if (f.type === 'image') { const host = add('div', null, form); host.setAttribute('data-image', f.id); } else add('input', 'f-' + f.id, form); }
  const requests = []; let finishUpload, savedData;
  const context = { document: doc, window, Promise, console, URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }, setTimeout: () => 1, clearTimeout() {}, navigator: {}, Image: class { constructor() { this.naturalWidth = 100; this.naturalHeight = 200; } set src(v) { queueMicrotask(() => this.onload()); } },
    fetch: async (url, opts) => {
      requests.push({ url, opts });
      if (url.includes('/upload?')) { if (finishUpload) await finishUpload; return { ok: true, json: async () => ({ url: photo('a') }) }; }
      if (url.endsWith('/draft')) savedData = JSON.parse(opts.body).customer_data;
      if (strictPublish && url.endsWith('/publish')) {
        try { schema.validate({ ...config.demo, ...savedData }, { mode: 'strict' }); }
        catch (err) { return { ok: false, json: async () => ({ error: err.code }) }; }
      }
      return { ok: true, json: async () => ({ id: 'draft1', previewUrl: '/preview', url: '/published' }) };
    } };
  vm.createContext(context); vm.runInContext(fs.readFileSync(require.resolve('../public/bfday/create.js'), 'utf8'), context);
  return { doc, form, window, requests, host: id => form.querySelector('[data-list="' + id + '"]'), add: id => form.querySelector('[data-add="' + id + '"]'), blockUpload: p => { finishUpload = p; } };
}
const fields = normalizeFields(config.fields).filter(f => ['events', 'gallery'].includes(f.id));
const button = (row, label) => row.querySelector('[aria-label="' + label + '"]');
const file = row => row.querySelector('input[type="file"]');
const snapshot = v => JSON.parse(JSON.stringify(v));

test('restore replaces placeholder and defaults, keeps max rows, empty lists, values and reordering', () => {
  const e = setup(fields, [['events'], ['gallery']]);
  assert.equal(e.host('events').children.length, 1);
  const events = config.demo.events.map((v, i) => ({ ...v, photo: photo(String(i + 1)) }));
  e.window.wizardApplyField('events', events);
  assert.equal(e.host('events').children.length, 5);
  assert.equal(e.host('events').children[0].querySelector('input[type="text"]').value, 'Haldi');
  assert.equal(e.host('events').children[0].querySelector('img').src, photo('1'));
  button(e.host('events').children[0], 'Move down').click();
  assert.equal(e.host('events').children[1].querySelector('input[type="text"]').value, 'Haldi');
  button(e.host('events').children[0], 'Remove').click();
  const gallery = Array.from({ length: 12 }, (_, i) => ({ photo: photo('a'), caption: 'C' + i }));
  e.window.wizardApplyField('gallery', gallery);
  assert.equal(e.host('gallery').children.length, 12);
  assert.equal(e.host('gallery').children[11].querySelector('input[type="text"]').value, 'C11');
  assert.equal(e.add('gallery').disabled, true);
  e.window.wizardApplyField('gallery', []);
  assert.equal(e.host('gallery').children.length, 1);
  assert.equal(e.host('gallery').children[0].querySelector('input[type="text"]').value, '');
  assert.equal(e.add('gallery').disabled, false);
  e.window.wizardApplyField('gallery', gallery.concat({ photo: photo('b'), caption: 'overflow' }));
  assert.equal(e.host('gallery').children.length, 12);
  assert.equal(e.host('gallery').children[11].querySelector('img').src, photo('a'));
});

test('nested upload follows moved row, saves its URL, and blocks publish until finished', async () => {
  const e = setup(fields, [['events'], ['gallery']]);
  e.window.wizardApplyField('events', [config.demo.events[0], config.demo.events[1]]);
  e.window.wizardApplyField('gallery', [{ photo: photo('b'), caption: 'memory' }]);
  let finish; e.blockUpload(new Promise(r => { finish = r; }));
  const row = e.host('events').children[0];
  file(row).files = [{ type: 'image/png', size: 100 }]; file(row).dispatchEvent({ type: 'change' });
  await flush(); assert(e.requests.some(r => r.url.includes('/upload?')));
  button(row, 'Move down').click(); e.doc.getElementById('publish').click(); await flush();
  assert.match(e.doc.getElementById('formError').textContent, /wait.*upload/i);
  assert(!e.requests.some(r => r.url.endsWith('/publish')));
  finish(); await flush();
  assert.equal(e.host('events').children[1].querySelector('img').src, photo('a'));
  e.doc.getElementById('publish').click(); await flush();
  const data = JSON.parse(e.requests.filter(r => r.url.endsWith('/draft')).at(-1).opts.body).customer_data;
  assert.equal(data.events[1].photo, photo('a')); assert.equal(data.events[1].name, 'Haldi');
  assert.equal(data.gallery[0].photo, photo('b'));
});

test('resume during upload cannot overwrite restored nested photos', async () => {
  const e = setup(fields, [['events'], ['gallery']]); let finish;
  e.blockUpload(new Promise(r => { finish = r; }));
  file(e.host('gallery').children[0]).files = [{ type: 'image/jpeg', size: 100 }];
  file(e.host('gallery').children[0]).dispatchEvent({ type: 'change' }); await flush();
  e.window.wizardApplyField('gallery', [{ photo: photo('b'), caption: 'restored' }]);
  e.doc.getElementById('publish').click(); await flush();
  assert(e.requests.some(r => r.url.endsWith('/publish')), 'an orphaned upload does not block publishing');
  finish(); await flush();
  assert.equal(e.host('gallery').children[0].querySelector('img').src, photo('b'));
  const data = JSON.parse(e.requests.filter(r => r.url.endsWith('/draft')).at(-1).opts.body).customer_data;
  assert.deepEqual(data.gallery, [{ photo: photo('b'), caption: 'restored' }]);
});

test('blank and partial rows respect strict and draft validation; list minimum counts filled rows', () => {
  const data = { ...config.demo, events: [{}], gallery: [{}] };
  assert.deepEqual(schema.validate(data).events, []); assert.deepEqual(schema.validate(data).gallery, []);
  assert.throws(() => schema.validate({ ...data, gallery: [{ caption: 'caption only' }] }), schema.InputError);
  assert.deepEqual(schema.validate({ ...data, gallery: [{ caption: 'caption only' }] }, { mode: 'draft' }).gallery, []);
  const partial = { ...data, events: [{ name: 'Party' }] };
  const draftEvent = schema.validate(partial, { mode: 'draft' }).events[0];
  assert.equal(draftEvent.name, 'Party'); assert.equal(draftEvent.timing, '');
  assert.throws(() => schema.validate(partial), err => err instanceof schema.InputError && err.code === 'event_name_and_timing_required');
  assert.throws(() => schema.validate({ ...data, events: [{ name: 'Party', timing: 'custom' }] }), err => err instanceof schema.InputError && err.code === 'event_datetime_required');
  assert.throws(() => schema.validate({ ...data, events: [{ name: 'Party', timing: 'custom', time: '25:00' }] }, { mode: 'draft' }), err => err instanceof schema.InputError && err.code === 'invalid_event_time');
  assert.equal(schema.validate({ ...data, events: [{ name: 'Party', timing: 'wedding' }] }).events[0].timing, 'wedding');
  assert.equal(schema.validate({ ...data, events: [{ name: 'Party', timing: 'custom', date: '2027-02-20', time: '19:00' }] }).events[0].time, '19:00');
  const list = normalizeFields([{ id: 'choices', type: 'list', label: 'Choices', minItems: 2, maxItems: 3, item: { type: 'text' } }]);
  const e = setup(list, [['choices']]); e.window.wizardApplyField('choices', ['one', '']);
  e.form.dispatchEvent({ type: 'submit', preventDefault() {} });
  assert.match(e.doc.getElementById('formError').textContent, /at least 2/);
  const s = makeSchema({ fields: [{ id: 'choices', type: 'list', label: 'Choices', minItems: 2, maxItems: 3, item: { type: 'text' } }], version: 1 });
  assert.throws(() => s.validate({ choices: ['one', ''] }), s.InputError);
  assert.deepEqual(s.validate({ choices: [] }).choices, []);
  e.window.wizardApplyField('choices', []); e.form.dispatchEvent({ type: 'submit', preventDefault() {} });
  assert.equal(e.doc.getElementById('formError').textContent, '');
});

test('client blocks partial required fields on the first step while allowing a blank gallery', () => {
  const e = setup(fields, [['gallery'], ['events']]);
  e.window.wizardApplyField('gallery', [{ photo: '', caption: 'caption only' }]);
  e.form.dispatchEvent({ type: 'submit', preventDefault() {} });
  assert.match(e.doc.getElementById('formError').textContent, /needs “Photo”/);
  e.doc.getElementById('publish').click();
  assert.match(e.doc.getElementById('formError').textContent, /needs “Photo”/);
  assert(!e.requests.some(r => r.url.endsWith('/draft')));
  e.window.wizardApplyField('gallery', []);
  e.form.dispatchEvent({ type: 'submit', preventDefault() {} });
  assert.equal(e.doc.getElementById('formError').textContent, '');
  e.window.wizardApplyField('events', [{ name: 'Party', timing: '' }]);
  e.form.dispatchEvent({ type: 'submit', preventDefault() {} });
  assert.equal(e.doc.getElementById('formError').textContent, '', 'event timing is optional during step navigation');
});

test('incomplete event can be saved as a draft but strict publish explains the missing timing', async () => {
  const e = setup(fields, [['events'], ['gallery']], { strictPublish: true });
  e.window.wizardApplyField('events', [{ name: 'Party', timing: '' }]);
  e.doc.getElementById('savePreview').click(); await flush();
  let data = JSON.parse(e.requests.filter(r => r.url.endsWith('/draft')).at(-1).opts.body).customer_data;
  assert.equal(data.events[0].name, 'Party'); assert.equal(data.events[0].timing, '');
  assert.equal(e.doc.getElementById('formError').textContent, '');
  e.doc.getElementById('publish').click(); await flush();
  assert(e.requests.some(r => r.url.endsWith('/publish')));
  assert.match(e.doc.getElementById('formError').textContent, /event.*name.*date and time/i);
  assert.equal(e.doc.getElementById('publish').disabled, false);
});

test('restoring a list with defaults and a minimum replaces all rows and creates only necessary blank rows', () => {
  const shaped = normalizeFields([{ id: 'things', type: 'list', label: 'Things', minItems: 2, maxItems: 3,
    shape: [{ id: 'title', type: 'text', label: 'Title', required: true }], default: [{ title: 'default 1' }, { title: 'default 2' }] }]);
  const e = setup(shaped, [['things']]);
  e.window.wizardApplyField('things', [{ title: 'one' }]);
  assert.equal(e.host('things').children.length, 2);
  assert.equal(e.host('things').children[0].querySelector('input').value, 'one');
  assert.equal(e.host('things').children[1].querySelector('input').value, '');
  e.form.dispatchEvent({ type: 'submit', preventDefault() {} });
  assert.match(e.doc.getElementById('formError').textContent, /at least 2/);
  e.window.wizardApplyField('things', []);
  assert.equal(e.host('things').children.length, 2);
  assert.equal(e.host('things').children[0].querySelector('input').value, '');
  e.form.dispatchEvent({ type: 'submit', preventDefault() {} });
  assert.equal(e.doc.getElementById('formError').textContent, '');
});
