'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { MAGAZINES } = require('../lib/magazines/registry');
const { sampleValues, canvaSampleData } = require('../lib/magazines/sampleData');

function loadViews() {
  const src = fs.readFileSync(require.resolve('../lib/magazines/views'), 'utf8');
  const fakeModule = { exports: {} };
  const fakeRequire = (name) => {
    if (name === '../layout') return {
      page: (title, body, opts = {}) => `<!doctype html><title>${title}</title><body>${body}${opts.scripts || ''}</body>`,
      esc: (value) => String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]),
    };
    if (name === './canvaClient') return { safeMessage: () => 'Please try again.' };
    throw new Error(`Unexpected dependency in view unit test: ${name}`);
  };
  vm.runInThisContext(`(function(require,module,exports){${src}\n})`, { filename: 'lib/magazines/views.js' })(fakeRequire, fakeModule, fakeModule.exports);
  return fakeModule.exports;
}

const { resultPage, catalogue, samplePage } = loadViews();
const order = { id: 'a'.repeat(32), status: 'ready' };

test('multipage magazine result contains a navigable, real-PDF preview', () => {
  const html = resultPage(order, { name: 'Birthday Story', pageCount: 7 }, { owner: true, ready: { png: false } });
  assert.match(html, /id="magReader"/);
  assert.match(html, /data-pdf="\/magazines\/m\/a{32}\/magazine\.pdf"/);
  assert.match(html, /id="magReaderLeaf"/);
  assert.match(html, /id="magReaderFront"/);
  assert.match(html, /id="magReaderBack"/);
  assert.match(html, /id="magReaderPrev"/);
  assert.match(html, /id="magReaderNext"/);
  assert.match(html, /magazine-preview\.mjs/);
  assert.match(html, /Download PDF/);
  assert.doesNotMatch(html, /<object\b/);
});

test('multi-page catalogue card links to a fictional page-flip sample when one is cached', () => {
  const html = catalogue([{ slug: 'birthday-story', name: 'Birthday Story', tagline: 'A seven-page story.', pageCount: 7, hasPreview: true, hasSample: true }]);
  assert.match(html, /href="\/magazines\/sample\/birthday-story"/);
  assert.match(html, /Flip through sample/);
});

test('fictional sample page uses the shared PDF reader and keeps the create CTA', () => {
  const html = samplePage({ slug: 'birthday-story', name: 'Birthday Story', pageCount: 7 }, { pdfUrl: '/magazines/sample/birthday-story/sample.pdf' });
  assert.match(html, /Fictional sample/);
  assert.match(html, /data-pdf="\/magazines\/sample\/birthday-story\/sample\.pdf"/);
  assert.match(html, /magazine-preview\.mjs/);
  assert.match(html, /Create your own/);
});

test('fictional sample data fills required Birthday Story text within field limits', () => {
  const mapping = MAGAZINES.find(m => m.slug === 'birthday-story');
  const values = sampleValues(mapping);
  for (const field of mapping.fields) {
    if (field.required) assert.ok(values[field.key], `${field.key} should have a fictional sample value`);
    assert.ok([...values[field.key]].length <= field.maxLength, `${field.key} should respect its max length`);
  }
  assert.match(values.letter_page3, /grateful|ordinary/i);
  assert.match(values.letter_page7, /grateful|ordinary/i);
  const assets = Array.from({ length: 9 }, (_, i) => ({ assetId: `demo_asset_${i + 1}` }));
  const data = canvaSampleData(mapping, assets);
  assert.equal(Object.keys(data).filter(k => data[k].type === 'image').length, 19);
  assert.equal(data.wish_line_1.type, 'text');
  assert.equal(data.wish_line_2.type, 'text');
  assert.equal(data.wish_line_3.type, 'text');
  assert.equal(typeof data.letter_page3.text, 'string');
});

test('single-page poster retains its existing PNG preview without PDF.js', () => {
  const html = resultPage(order, { name: 'Birthday Collage Poster', pageCount: 1 }, { owner: true, ready: { png: true } });
  assert.match(html, /mag-result-img/);
  assert.match(html, /magazine\.png/);
  assert.doesNotMatch(html, /magReader|magazine-preview\.mjs/);
});
