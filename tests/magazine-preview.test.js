'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

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

const { resultPage } = loadViews();
const order = { id: 'a'.repeat(32), status: 'ready' };

test('multipage magazine result contains a navigable, real-PDF preview', () => {
  const html = resultPage(order, { name: 'Birthday Story', pageCount: 7 }, { owner: true, ready: { png: false } });
  assert.match(html, /id="magReader"/);
  assert.match(html, /data-pdf="\/magazines\/m\/a{32}\/magazine\.pdf"/);
  assert.match(html, /id="magReaderPrev"/);
  assert.match(html, /id="magReaderNext"/);
  assert.match(html, /magazine-preview\.mjs/);
  assert.match(html, /Download PDF/);
  assert.doesNotMatch(html, /<object\b/);
});

test('single-page poster retains its existing PNG preview without PDF.js', () => {
  const html = resultPage(order, { name: 'Birthday Collage Poster', pageCount: 1 }, { owner: true, ready: { png: true } });
  assert.match(html, /mag-result-img/);
  assert.match(html, /magazine\.png/);
  assert.doesNotMatch(html, /magReader|magazine-preview\.mjs/);
});
