import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fullCatalog, fullBySlug, sourceMetadata, PORT_STATUS } from '../src/full-catalog.generated.mjs';
import { bySlug, list } from '../src/catalog.generated.mjs';
import { makeMetadata, clean } from '../scripts/full-catalog.mjs';

const require = createRequire(import.meta.url);
const { TEMPLATES } = require('../../templates/registry.js');
const familySlugs = require('../../templates/bfday.js');
const expected = [
  'sawaal','sau-wajah','love-awaits','maafi','love-album','valentine-say-yes',
  'lavender-tic-tac-toe-bloom','ganpati-courtyard','saalgirah','shaadi-paigaam',
  'suvarna-vivah','birthday-paigaam','ganapati-aagman','noor','meher','aashi','apology',
  'sealed-with-a-kiss','polaroid-scrapbook','little-love','scratch-reasons','unrejectable',
  'our-wrapped','know-us-quiz','meri-duniya','khulta','aakhri-sawaal','bfday-gift','raaz',
  'vivah','shubh-vivah','royal-vivah','aangan-vivah','lotus-vivah','vaidehi','sita-kalyanam',
  'patra-vivah','divya-vivah','inaam','purana-seekho','jashn','yaadon','nishaan','chamak',
  'daawat','wedding-post','birthday-atelier','love-letter','anniversary-blue','diwali-deep',
];
const plain = x => JSON.parse(JSON.stringify(x));

test('50 unique built-ins, fresh source seed order and stable rank', () => {
  assert.deepEqual(TEMPLATES.map(t => t.slug), expected);
  assert.deepEqual(fullCatalog.map(t => t.slug), expected);
  assert.deepEqual(sourceMetadata.map(t => t.sourceRank), expected.map((_, i) => i));
  assert.equal(new Set(fullCatalog.map(t => t.slug)).size, 50);
  assert.equal(fullBySlug('does-not-exist'), null);
});

test('fresh source metadata and seed defaults, including raw schema, theme and custom config', () => {
  for (const [i, original] of TEMPLATES.entries()) {
    const t = sourceMetadata[i];
    for (const key of ['slug','name','category','description','price','currency']) assert.deepEqual(t[key], original[key], `${original.slug}.${key}`);
    assert.equal(t.list_price, original.list_price ?? 0, original.slug);
    assert.equal(t.thumbnail_url, original.thumbnail_url || '', original.slug);
    assert.deepEqual(t.tags, original.tags || [], original.slug);
    assert.deepEqual(t.config.theme, original.theme, original.slug);
    assert.deepEqual(t.config.fields, original.fields, original.slug);
    assert.deepEqual(t.config.sections, original.sections, original.slug);
    assert.equal(t.config.custom, !!original.custom, original.slug);
    assert.equal(t.config.editable, original.editable !== false, original.slug);
    assert.equal(t.config.appPath, original.appPath, original.slug);
    assert.equal(fullBySlug(original.slug).sourceConfig, t.config);
  }
  assert.deepEqual(['noor','meher','aashi','apology','little-love','vaidehi','sita-kalyanam','divya-vivah'].map(s => fullBySlug(s).price), [499,349,0,299,99,99,99,99]);
  assert.deepEqual({ custom: fullBySlug('apology').config.custom, editable: fullBySlug('apology').config.editable, appPath: fullBySlug('apology').config.appPath }, { custom: true, editable: false, appPath: '/experiences/apology/' });
});

test('33 existing family members retain the exact live implementations; legacy 17 have no fake runtime', () => {
  assert.equal(list.length, 33);
  assert.deepEqual(fullCatalog.filter(t => t.supported).map(t => t.slug), familySlugs);
  assert.deepEqual(fullCatalog.filter(t => !t.supported).map(t => t.slug), expected.slice(0, 17));
  for (const slug of expected) {
    const entry = fullBySlug(slug), live = bySlug(slug);
    if (live) {
      assert.strictEqual(entry.portStatus, PORT_STATUS.SUPPORTED);
      for (const key of ['config','fields','schema','validate','render']) assert.strictEqual(entry[key], live[key], `${slug}.${key}`);
      assert.equal(typeof entry.render, 'function');
      assert.equal(typeof entry.validate, 'function');
    } else {
      assert.strictEqual(entry.portStatus, PORT_STATUS.NOT_MIGRATED);
      assert.equal(entry.reason, 'not_migrated');
      for (const key of ['render','validate','schema','demoUrl','createUrl','demoRoute','createRoute']) assert.equal(entry[key], undefined, `${slug}.${key}`);
    }
  }
});

test('reject missing, duplicate, extra or reordered source and family membership', () => {
  const changed = TEMPLATES.map(t => ({ ...t }));
  changed[1].slug = changed[0].slug;
  assert.throws(() => makeMetadata(changed, familySlugs), /unique slugs/);
  assert.throws(() => makeMetadata(TEMPLATES.slice(1), familySlugs), /50 unique/);
  assert.throws(() => makeMetadata(TEMPLATES, [...familySlugs.slice(0, 32), familySlugs[0]]), /33-member/);
  assert.throws(() => makeMetadata(TEMPLATES, [...familySlugs].reverse()), /order/);
  const swapped = [...TEMPLATES]; [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
  assert.throws(() => makeMetadata(swapped, familySlugs), /legacy/);
});

test('metadata allowlist drops data carriers, functions, undefined, unsafe keys and credential values', () => {
  const bad = JSON.parse('{"safe":"ok","customer_data":{"name":"secret"},"assets":{"data":"blob"},"password":"secret","__proto__":{"polluted":true}}');
  bad.fn = () => 1; bad.missing = undefined; bad.image = 'data:image/png;base64,AAAA'; bad.big = 'a'.repeat(300);
  bad.cycle = bad;
  assert.deepEqual(plain(clean(bad)), { safe: 'ok' });
  assert.equal({}.polluted, undefined);
  const modified = TEMPLATES.map(t => ({ ...t }));
  modified[0] = { ...modified[0], demo: { customer_data: 'private' }, assets: { data: 'base64' }, secret: 'dont-ship', fields: [{ id: 'password', type: 'text', default: 'dont-ship', injected: 'dont-ship' }, { id: 'normal', type: 'text', default: { password: 'dont-ship', safe: 'ok' } }] };
  const snap = makeMetadata(modified, familySlugs)[0];
  assert.deepEqual(plain(snap.config.fields), [{id:'password',type:'text'}, {id:'normal',type:'text',default:{safe:'ok'}}]);
  assert.doesNotMatch(JSON.stringify(snap), /dont-ship|base64|injected|customer_data/);
  assert.throws(() => makeMetadata(TEMPLATES.map((t,i) => i ? t : { ...t, thumbnail_url: '//evil.invalid/a' }), familySlugs), /Unsafe thumbnail/);
});

test('generated file is deterministic, static ESM and contains no encoded asset carriers', () => {
  const generated = fileURLToPath(new URL('../src/full-catalog.generated.mjs', import.meta.url));
  const before = readFileSync(generated, 'utf8');
  execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/full-catalog.mjs', import.meta.url))]);
  assert.equal(readFileSync(generated, 'utf8'), before);
  assert.doesNotMatch(before, /(?:data:[^"\s,]*;base64,|"(?:customer_data|assets|password|secret|api_key)"\s*:)/i);
  assert.doesNotMatch(before, /from ['"]node:|templates\/registry|lib\/bfday\/family/);
});
