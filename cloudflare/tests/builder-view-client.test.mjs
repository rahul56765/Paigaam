import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { list } from '../src/catalog.generated.mjs';
import { builderPage } from '../src/views.mjs';

// A deliberately small DOM and mock fetch, not an end-to-end browser or API test.
// It exercises the actual editor selected by the unlocked view and its emitted spec.
class Element {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attrs = {};
    this.listeners = {};
    this.style = {};
    this.className = '';
    this.value = '';
    this.disabled = false;
    this.hidden = false;
    this._text = '';
    this.classList = {
      add: name => { this.className += ' ' + name; },
      toggle: () => {},
    };
  }
  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    this.children.push(child);
    child.parentNode = this;
    return child;
  }
  removeChild(child) {
    this.children.splice(this.children.indexOf(child), 1);
    child.parentNode = null;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(name, value) {
    this.attrs[name] = String(value);
    if (name === 'id') this.id = String(value);
    if (name === 'class') this.className = String(value);
  }
  getAttribute(name) { return this.attrs[name] ?? null; }
  removeAttribute(name) { delete this.attrs[name]; delete this[name]; }
  set textContent(value) { this.children = []; this._text = String(value); }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
    const attr = /^(\w+)?\[([^=\]]+)=["']?([^"'\]]+)["']?\]$/.exec(selector);
    if (attr) return (!attr[1] || this.tagName === attr[1].toUpperCase()) && String(this.attrs[attr[2]] ?? this[attr[2]]) === attr[3];
    return this.tagName === selector.toUpperCase();
  }
  querySelectorAll(selector) {
    if (selector === '#progress li') return this.querySelector('#progress')?.querySelectorAll('li') || [];
    const parts = selector.split(',').map(x => x.trim());
    const found = [];
    function walk(el) {
      for (const child of el.children) {
        if (parts.some(part => child.matches(part))) found.push(child);
        walk(child);
      }
    }
    walk(this);
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  dispatch(type) {
    const event = { type, target: this, preventDefault() {} };
    for (const fn of this.listeners[type] || []) fn(event);
  }
  click() { if (!this.disabled) this.dispatch('click'); }
  focus() { this.focused = true; }
  pause() {}
  load() {}
  getContext() { return { fillRect() {}, drawImage() {} }; }
  toBlob(callback, mime) { callback({ type: mime, size: 100 }); }
}

const flush = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };
const draftId = 'a'.repeat(18);
const photoUrl = '/bfday/uploads/' + 'b'.repeat(48) + '.jpg';
const songUrl = '/bfday/uploads/' + 'c'.repeat(48) + '.mp3';
const origin = 'http://localhost:8787';

function setup(slug, { paidResponse = false, holdPhoto = false, holdPublish = false } = {}) {
  let releasePhoto, releasePublish;
  const photoGate = holdPhoto ? new Promise(resolve => { releasePhoto = resolve; }) : null;
  const publishGate = holdPublish ? new Promise(resolve => { releasePublish = resolve; }) : null;
  const template = list.find(t => t.slug === slug);
  const html = builderPage(template, { baseUrl: origin, enableFreeBuilder: true, price: 0 });
  assert.doesNotMatch(html, /function lock\(\)|paigaam-pay\.js|creator-coupon\.js/);
  const spec = JSON.parse(html.match(/<script type="application\/json" id="bfSpec">([\s\S]*?)<\/script>/)[1]);
  const scriptPath = [...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)]
    .map(match => match[1].split('?')[0])
    .find(src => src === '/bfday/create.js' || src === `/${slug}/editor.js`);
  assert.ok(scriptPath, slug);
  const script = readFileSync(new URL('../../public' + scriptPath, import.meta.url), 'utf8');

  const doc = new Element('document');
  doc.body = new Element('body');
  doc.appendChild(doc.body);
  doc.createElement = tag => new Element(tag);
  doc.getElementById = id => doc.querySelector('#' + id);
  const add = (tag, id, parent = doc.body) => {
    const el = new Element(tag);
    if (id) el.setAttribute('id', id);
    parent.appendChild(el);
    return el;
  };
  add('script', 'bfSpec').textContent = JSON.stringify(spec);
  const wizard = add('main', 'wizard');
  const progress = add('ol', 'progress', wizard);
  for (let i = 0; i < spec.lastStep + 2; i++) add('li', null, progress);
  const form = add('form', 'bfForm', wizard);
  for (let i = 0; i <= spec.lastStep; i++) {
    const section = add('section', null, form);
    section.className = 'step';
    section.setAttribute('data-step', i);
    add('h2', null, section);
  }
  for (const id of ['back', 'next', 'publish']) add('button', id, form);
  for (const id of ['stepCounter', 'status', 'formError', 'review', 'previewState']) add('p', id, form);
  for (const f of spec.fields) {
    if (f.type === 'image' || f.type === 'audio' || f.type === 'list') {
      const host = add('div', null, form);
      host.setAttribute(f.type === 'image' ? 'data-image' : f.type === 'audio' ? 'data-audio' : 'data-list', f.id);
      if (f.type === 'list') add('button', null, form).setAttribute('data-add', f.id);
    } else {
      const wrap = add('div', null, form);
      const field = add(f.type === 'textarea' ? 'textarea' : f.type === 'select' ? 'select' : 'input', 'f-' + f.id, wrap);
      field.type = f.type === 'bgm' ? 'text' : f.type;
      if ((f.type === 'select' || f.slider) && f.default != null) field.value = String(f.default);
    }
  }
  const liveFrame = add('iframe', 'liveFrame', wizard);
  liveFrame.contentWindow = { postMessage() {} };
  const result = add('section', 'publishedResult');
  result.hidden = true;
  for (const [tag, id] of [['h1', 'resultTitle'], ['input', 'publishedUrl'], ['a', 'openPublished'], ['a', 'whatsapp'], ['img', 'qrImage'], ['button', 'copyLink'], ['p', 'shareStatus']]) add(tag, id, result);

  const win = new Element('window');
  win.document = doc;
  win.scrollTo = () => {};
  win.loveCrop = async () => ({ type: 'image/jpeg', size: 100 });
  win.anniversaryCrop = win.loveCrop;
  let couponCalls = 0;
  win.PaigaamCouponFlow = { mountInline() { couponCalls++; } };
  const requests = [];
  const unexpected = [];
  const fetch = async (url, options) => {
    requests.push({ url, options });
    if (url === `/${slug}/preview-frame`) return { ok: true, text: async () => '<p>preview</p>' };
    let body;
    if (url === `/api/${slug}/draft`) body = { id: draftId, previewUrl: `/${slug}/preview/${draftId}` };
    else if (url === `/api/${slug}/upload?id=${draftId}`) { if (photoGate) await photoGate; body = { url: photoUrl }; }
    else if ([`/api/${slug}/upload-audio?id=${draftId}`, `/api/${slug}/audio?id=${draftId}`].includes(url)) body = { url: songUrl };
    else if (url === `/api/${slug}/publish`) { if (publishGate) await publishGate; body = paidResponse ? { razorpay: true } : { url: origin + '/p/fake-local-result' }; }
    else { unexpected.push(url); throw new Error('Unexpected fetch: ' + url); }
    return { ok: true, json: async () => body };
  };
  const context = {
    document: doc, window: win, location: { origin }, console, fetch, Promise,
    URL: { createObjectURL: () => 'blob:local-mock', revokeObjectURL() {} },
    Image: class { constructor() { this.naturalWidth = 1200; this.naturalHeight = 800; } set src(value) { queueMicrotask(() => this.onload?.()); } },
    setTimeout: () => 1, clearTimeout() {}, navigator: {},
  };
  vm.runInNewContext(script, context, { filename: scriptPath, timeout: 2000 });
  return { doc, form, html, spec, result, requests, unexpected, couponCalls: () => couponCalls,
    releasePhoto: () => releasePhoto?.(), releasePublish: () => releasePublish?.() };
}

for (const [slug, photoField, audioField] of [
  ['diwali-deep', 'familyPhoto', 'musicUpload'],
  ['love-letter', 'reminder0', 'songUrl'],
  ['anniversary-blue', 'songPhoto', 'songUrl'],
]) {
  test(`${slug}: unlocked source editor uses mocked same-origin draft, image, audio and free publish`, async () => {
    const h = setup(slug);
    await flush();
    const family = h.doc.getElementById('f-familyName');
    if (family) family.value = 'Example family';
    const photo = h.form.querySelector(`[data-image="${photoField}"]`).querySelector('input[type="file"]');
    assert.equal(photo.disabled, false);
    photo.files = [{ name: 'photo.jpg', type: 'image/jpeg', size: 200 }];
    photo.dispatch('change');
    await flush();
    const audioHost = audioField === 'songUrl' ? h.doc.getElementById('f-songUrl').parentNode : h.form.querySelector(`[data-audio="${audioField}"]`);
    const audio = audioHost.querySelector('input[type="file"]');
    assert.equal(audio.disabled, false);
    audio.files = [{ name: 'song.mp3', type: 'audio/mpeg', size: 200 }];
    audio.dispatch('change');
    await flush();
    for (let i = 0; i < h.spec.lastStep; i++) h.form.dispatch('submit');
    h.doc.getElementById('publish').click();
    await flush();
    const find = path => h.requests.filter(r => r.url === path);
    assert.ok(find(`/${slug}/preview-frame`).length, 'live preview');
    assert.ok(find(`/api/${slug}/draft`).length >= 2, 'owned draft saved');
    assert.equal(find(`/api/${slug}/upload?id=${draftId}`).length, 1, 'photo upload');
    const audioAction = audioField === 'songUrl' ? 'audio' : 'upload-audio';
    assert.equal(find(`/api/${slug}/${audioAction}?id=${draftId}`).length, 1, 'audio upload');
    assert.equal(find(`/api/${slug}/publish`).length, 1, 'free publish');
    const saved = JSON.parse(find(`/api/${slug}/draft`).at(-1).options.body);
    assert.equal(saved.id, draftId);
    assert.equal(saved.customer_data[photoField], photoUrl);
    assert.equal(saved.customer_data[audioField], songUrl);
    assert.deepEqual(JSON.parse(find(`/api/${slug}/publish`)[0].options.body), { id: draftId });
    assert.equal(h.doc.getElementById('publishedUrl').value, origin + '/p/fake-local-result');
    assert.equal(h.result.hidden, false);
    assert.match(h.doc.getElementById('qrImage').src, /^\/api\/qr\?url=/);
    assert.equal(h.couponCalls(), 0);
    assert.deepEqual(h.unexpected, []);
    assert.ok(h.requests.every(r => r.url.startsWith('/') && r.options.credentials === 'same-origin'));
  });
}

test('generic builder refuses to publish until an in-flight photo finishes', async () => {
  const h = setup('diwali-deep', { holdPhoto: true });
  await flush(); h.doc.getElementById('f-familyName').value = 'Example family';
  const photo = h.form.querySelector('[data-image="familyPhoto"]').querySelector('input[type="file"]');
  photo.files = [{ name: 'photo.jpg', type: 'image/jpeg', size: 200 }]; photo.dispatch('change'); await flush();
  assert.ok(h.requests.some(r => r.url === `/api/diwali-deep/upload?id=${draftId}`));
  for (let i = 0; i < h.spec.lastStep; i++) h.form.dispatch('submit');
  h.doc.getElementById('publish').click(); await flush();
  assert.equal(h.requests.filter(r => r.url === '/api/diwali-deep/publish').length, 0);
  assert.match(h.doc.getElementById('formError').textContent, /wait for your uploads/i);
  assert.equal(h.result.hidden, true);
  h.releasePhoto(); await flush();
  h.doc.getElementById('publish').click(); await flush();
  assert.equal(h.requests.filter(r => r.url === '/api/diwali-deep/publish').length, 1);
  assert.equal(h.result.hidden, false);
  const saved = JSON.parse(h.requests.filter(r => r.url === '/api/diwali-deep/draft').at(-1).options.body);
  assert.equal(saved.customer_data.familyPhoto, photoUrl);
});

test('generic builder freezes editing while publication is in flight', async () => {
  const h = setup('diwali-deep', { holdPublish: true });
  await flush(); h.doc.getElementById('f-familyName').value = 'Example family';
  for (let i = 0; i < h.spec.lastStep; i++) h.form.dispatch('submit');
  h.doc.getElementById('publish').click(); await flush();
  assert.ok(h.requests.some(r => r.url === '/api/diwali-deep/publish'));
  assert.equal(h.doc.getElementById('f-familyName').disabled, true);
  assert.equal(h.doc.getElementById('back').disabled, true);
  assert.equal(h.result.hidden, true);
  h.releasePublish(); await flush(); assert.equal(h.result.hidden, false);
});

test('an unexpected paid response cannot launch checkout from the free view (mocked)', async () => {
  const h = setup('diwali-deep', { paidResponse: true });
  await flush();
  h.doc.getElementById('f-familyName').value = 'Example family';
  for (let i = 0; i < h.spec.lastStep; i++) h.form.dispatch('submit');
  h.doc.getElementById('publish').click();
  await flush();
  assert.equal(h.result.hidden, true);
  assert.equal(h.doc.getElementById('publish').disabled, false);
  assert.match(h.doc.getElementById('formError').textContent, /Publishing didn’t work/);
  assert.equal(h.couponCalls(), 0);
  assert.deepEqual(h.unexpected, []);
});
