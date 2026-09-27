'use strict';
/**
 * Builder engine tests (public/js/builder.js) on a stub DOM —
 * the step machine, autosave, validation and preview wiring.
 * Run: node scripts/test-builder.js
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* ---------- minimal stub DOM (same pattern as saalgirah-dom) ---------- */

function makeEl(tag, attrs = {}) {
  const el = {
    tagName: String(tag).toUpperCase(),
    style: {},
    dataset: attrs.dataset || {},
    hidden: !!attrs.hidden,
    children: [],
    listeners: {},
    value: attrs.value || '',
    textContent: '',
    innerHTML: '',
    disabled: false,
    files: attrs.files || null,
    type: attrs.type || '',
    setAttribute(k, v) { this['_attr_' + k] = v; },
    getAttribute(k) { return this['_attr_' + k] ?? null; },
    addEventListener(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); },
    removeEventListener() {},
    dispatch(ev, arg) {
      const evt = arg || { target: this, preventDefault() {}, stopPropagation() {} };
      (this.listeners[ev] || []).forEach(fn => fn(evt));
      // bubble input/change to the form — the builder delegates those listeners
      if ((ev === 'input' || ev === 'change') && this.parentElement && this.parentElement.form && this.parentElement !== this.parentElement.form) {
        ((this.parentElement.form.listeners || {})[ev] || []).forEach(fn => fn(evt));
      }
    },
    querySelector(sel) { return this._qs(sel); },
    querySelectorAll(sel) { return this._qsa(sel); },
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      toggle(c, on) { on === undefined ? (this._set.has(c) ? this._set.delete(c) : this._set.add(c)) : on ? this._set.add(c) : this._set.delete(c); },
      contains(c) { return this._set.has(c); },
    },
    focus() { el.focused = true; },
    scrollIntoView() {},
    closest() { return null; },
    offsetWidth: 100, // forces animation restart path
    contentDocument: null,
    // very small selector engine: '#id', '.class', '[attr]'
    _qs(sel) {
      if (sel.startsWith('#')) return this.owner.ids[sel.slice(1)] || null;
      if (sel === '[data-field]') return this._fields.find(f => !f._claimed) || null;
      if (sel === '.bstep__err') return this._errEl || null;
      return null;
    },
    _qsa(sel) {
      if (sel === '[data-field]') return this._fields.filter(f => f.parentElement === this);
      if (sel === '.bstep__err') return this._errEl ? [this._errEl] : [];
      return [];
    },
  };
  return el;
}

function buildHarness({ fields, initial = {}, savedLS = null }) {
  const ids = {};
  const form = makeEl('form');
  const steps = fields.map((f, i) => {
    const step = makeEl('fieldset');
    step._fields = [];
    step._errEl = makeEl('p');
    step._errEl.hidden = true;
    const input = makeEl(f.type === 'textarea' ? 'textarea' : 'input', { type: f.type });
    input.dataset.field = f.id;
    input.type = f.type || 'text';
    step._fields.push(input);
    input.parentElement = step;
    step.form = form;
    if (initial[f.id] && input.type !== 'file') input.value = initial[f.id];
    ids['f_' + f.id] = input;
    step._input = input;
    return step;
  });
  form._fields = steps.map(s => s._input);
  form.querySelectorAll = (sel) => {
    if (sel === '.bstep') return steps;
    if (sel === '[data-field]') return steps.map(s => s._input);
    return [];
  };
  form.dataset = { total: String(fields.length), template: 'noor', draft: '' };
  form.listeners = {}; // fresh — the makeEl default may hold nothing, but ensure clean
  ids.createForm = form;

  const btnBack = makeEl('button'); ids.btnBack = btnBack;
  const btnNext = makeEl('button'); ids.btnNext = btnNext;
  const frame = makeEl('iframe'); ids.liveFrame = frame;

  const lsStore = savedLS ? { [ 'paigaam.builder.noor' ]: JSON.stringify(savedLS) } : {};
  const fetches = [];
  const src = fs.readFileSync(process.env.BUILDER_SRC || path.join(__dirname, '..', 'public', 'js', 'builder.js'), 'utf8');

  const sandbox = { PAIGAAM_BOOT: { slug: 'noor', draftId: null, initial, fields } };
  sandbox.window = sandbox;
  sandbox.document = {
    getElementById: (id) => ids[id] || null,
    addEventListener() {},
    querySelectorAll() { return []; },
  };
  sandbox.fetch = (url, opts) => {
    fetches.push({ url, opts });
    return Promise.resolve({ text: () => Promise.resolve('<html>preview</html>'), json: () => Promise.resolve({ id: 'draftXYZ' }) });
  };
  sandbox.localStorage = {
    getItem: (k) => lsStore[k] ?? null,
    setItem: (k, v) => { lsStore[k] = v; },
    removeItem: (k) => { delete lsStore[k]; },
  };
  sandbox.setTimeout = setTimeout;
  sandbox.clearTimeout = clearTimeout;
  sandbox.matchMedia = () => ({ matches: false });
  sandbox.console = console;
  sandbox.window.paTrack = (ev, props) => { (sandbox._tracks = sandbox._tracks || []).push([ev, props]); };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'builder.js' });

  return { ids, steps, form, btnBack, btnNext, frame, lsStore, fetches, sandbox };
}

const NOOR_FIELDS = [
  { id: 'brideName', type: 'text', required: true },
  { id: 'groomName', type: 'text', required: true },
  { id: 'message', type: 'textarea', required: false },
];

test('builder: first step visible, second hidden; final label switches to Preview my Paigaam', () => {
  const h = buildHarness({ fields: NOOR_FIELDS });
  assert.equal(h.steps[0].hidden, false, 'step 0 visible');
  assert.equal(h.steps[1].hidden, true, 'step 1 hidden');
  h.steps[0]._input.value = 'Ayesha';
  h.btnNext.dispatch('click');
  assert.equal(h.steps[1].hidden, false, 'Next reveals step 2');
  assert.equal(h.btnBack.hidden, false, 'Back appears after step 1');
  h.steps[1]._input.value = 'Imran';
  h.btnNext.dispatch('click');
  assert.ok(h.btnNext.innerHTML.includes('Preview my Paigaam'), 'final CTA on last step');
  h.btnBack.dispatch('click');
  assert.equal(h.steps[1].hidden, false, 'Back returns to step 2 (index 1)');
  assert.equal(h.steps[2].hidden, true, 'step 3 hidden again');
  assert.equal(h.steps[0]._input.value, 'Ayesha', 'going back never loses input');
});

test('builder: typing updates preview (debounced), saves locally + server draft', async () => {
  const h = buildHarness({ fields: NOOR_FIELDS });
  const input = h.steps[0]._input;
  input.value = 'Ayesha';
  input.dispatch('input');
  await new Promise(r => setTimeout(r, 30)); // let timers run (local save is sync)
  assert.ok(h.lsStore['paigaam.builder.noor'].includes('Ayesha'), 'localStorage autosave');
  await new Promise(r => setTimeout(r, 1600)); // preview debounce 350 + draft debounce 1200
  assert.ok(h.fetches.some(f => f.url === '/api/render-preview'), 'render-preview called');
  assert.ok(h.fetches.some(f => f.url === '/api/drafts'), 'draft saved');
  assert.ok((h.sandbox._tracks || []).some(([ev]) => ev === 'creation_started'), 'creation_started tracked');
  assert.ok((h.sandbox._tracks || []).some(([ev]) => ev === 'personalization_started'), 'legacy funnel marker kept');
});

test('builder: validation blocks Next on a required empty field, friendly message', () => {
  const h = buildHarness({ fields: NOOR_FIELDS });
  h.steps[0]._input.value = '';
  h.btnNext.dispatch('click');
  assert.equal(h.steps[1].hidden, true, 'blocked');
  assert.ok(!h.steps[0]._errEl.hidden, 'error visible');
  assert.ok(h.steps[0]._errEl.textContent.length > 5, 'friendly copy present');
  h.steps[0]._input.value = 'Ayesha';
  h.btnNext.dispatch('click');
  assert.equal(h.steps[1].hidden, false, 'passes once filled');
});

test('builder: restore — values from localStorage survive a reload, restore keeps step', () => {
  const saved = { values: { brideName: 'Ayesha', groomName: 'Imran' }, images: {}, step: 2, at: Date.now() };
  const h = buildHarness({ fields: NOOR_FIELDS, savedLS: saved });
  assert.equal(h.steps[0]._input.value, 'Ayesha', 'bride restored');
  assert.equal(h.steps[1]._input.value, 'Imran', 'groom restored');
  assert.equal(h.steps[2].hidden, false, 'restored to saved step');
});

test('builder: server draft (boot.initial) seeds inputs and final save clears local state', async () => {
  const h = buildHarness({ fields: NOOR_FIELDS, initial: { brideName: 'Zoya' } });
  assert.equal(h.steps[0]._input.value, 'Zoya', 'draft prefilled');
  // walk to the end and finish
  h.steps[0]._input.value = 'Zoya'; h.steps[0]._input.dispatch('input');
  h.btnNext.dispatch('click');
  h.steps[1]._input.value = 'Imran'; h.steps[1]._input.dispatch('input');
  h.btnNext.dispatch('click');
  h.steps[2]._input.value = 'You two!'; h.steps[2]._input.dispatch('input');
  h.btnNext.dispatch('click'); // final: Preview my Paigaam
  await new Promise(r => setTimeout(r, 30));
  const draftCall = h.fetches.find(f => f.url === '/api/drafts');
  assert.ok(draftCall, 'final draft saved');
  const body = JSON.parse(draftCall.opts.body);
  assert.equal(body.customer_data.brideName, 'Zoya', 'data complete');
  assert.equal(body.customer_data.groomName, 'Imran', 'data complete 2');
});
