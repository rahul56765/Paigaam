'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { canvaSampleData } = require('../lib/magazines/sampleData');

test('fictional sample generation creates once, caches its PDF and reuses Canva asset IDs', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-sample-test-'));
  const calls = { uploads: 0, autofills: 0, exports: 0, data: null };
  const client = {
    uploadAsset: async () => ({ id: `asset-job-${++calls.uploads}`, status: 'success', asset: { id: `asset-${calls.uploads}` } }),
    getAssetUpload: async () => ({}),
    createAutofill: async ({ data, title }) => { calls.autofills++; calls.data = data; assert.match(title, /PAIGAAM Fictional Sample/); return { id: 'autofill-job' }; },
    getAutofill: async () => ({ status: 'success', result: { design: { id: 'fictional-design-id', url: 'private-edit-url' } } }),
    createExport: async () => { calls.exports++; return { id: 'export-job' }; },
    getExport: async () => ({ status: 'success', urls: ['https://example.invalid/sample.pdf'] }),
    pollJob: async (fetchJob, id) => fetchJob(id),
    downloadExport: async () => Buffer.from('%PDF-1.7 fictional sample'),
  };
  const cfg = { ROOT: root, MAX_PDF_BYTES: 1024 * 1024 };
  const filename = path.join(__dirname, '../lib/magazines/preview.js');
  const source = fs.readFileSync(filename, 'utf8');
  const fakeModule = { exports: {} };
  const fakeRequire = (name) => {
    if (name === 'node:fs') return fs;
    if (name === 'node:path') return path;
    if (name === 'node:crypto') return require('node:crypto');
    if (name === './config') return cfg;
    if (name === './canvaClient') return client;
    if (name === './validate') return require('../lib/magazines/validate');
    if (name === './sampleData') return require('../lib/magazines/sampleData');
    if (name === './image') return { sniffImage: () => ({ mime: 'image/jpeg', ext: 'jpg' }) };
    throw new Error(`Unexpected dependency in sample test: ${name}`);
  };
  vm.runInThisContext(`(function(require,module,exports,__dirname){${source}\n})`, { filename }) (
    fakeRequire, fakeModule, fakeModule.exports, path.dirname(filename)
  );

  const mapping = {
    slug: 'birthday-story', name: 'Birthday Story', canvaTemplateId: 'template-id', pageCount: 7,
    fields: [{ key: 'letter_page3', canvaName: 'letter_page3', type: 'text', label: 'Love letter', required: true, maxLength: 450 }],
    images: [{ key: 'photo_1', canvaName: 'photo_1', type: 'image' }, { key: 'photo_2', canvaName: 'photo_2', type: 'image' }],
  };
  try {
    const first = await fakeModule.exports.refreshSample(mapping);
    assert.equal(first.mime, 'application/pdf');
    assert.equal(fs.readFileSync(first.file).subarray(0, 5).toString(), '%PDF-');
    assert.equal(calls.uploads, 9);
    assert.equal(calls.autofills, 1);
    assert.equal(calls.exports, 1);
    assert.equal(calls.data.photo_1.type, 'image');
    assert.equal(calls.data.letter_page3.type, 'text');
    assert.equal(fakeModule.exports.needsSample(mapping), false);

    await fakeModule.exports.refreshSample(mapping);
    assert.equal(calls.autofills, 1, 'repeat validation must not create another Canva design');
    assert.equal(calls.exports, 1, 'repeat validation reuses the cached sample PDF');
    assert.equal(calls.uploads, 9, 'repeat validation reuses cached Canva sample assets');
    const state = JSON.parse(fs.readFileSync(path.join(root, 'previews', 'birthday-story.sample.json'), 'utf8'));
    assert.equal(state.designId, 'fictional-design-id');
    assert.equal(Object.hasOwn(state, 'designUrl'), false, 'do not persist Canva edit URLs');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
