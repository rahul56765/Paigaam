'use strict';
// Minimal renderer: prints every resolved value (escaped) so tests can assert on it.
const config = require('./config');
const schema = require('./schema');
const { resolve, imagesIn } = require('../../../lib/bfday/fields');
const { escape, multiline, jsonPayload, head, previewBadge } = require('../../../lib/bfday/page');

function render(paigaam = {}, opts = {}) {
  const d = resolve(config, paigaam && paigaam.customer_data, schema);
  const photo = imagesIn(schema.FIELDS, d)[0] || '';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
${head({ paigaam, opts, title: 'Fixture for ' + d.toName, description: 'A fixture for ' + d.toName, image: photo })}
</head><body data-preview="${!!opts.isPreview}">${previewBadge(opts)}
${jsonPayload('fxPayload', d)}
<h1 id="to">${escape(d.toName)}</h1><p id="note">${multiline(d.note)}</p><p id="days">${escape(d.days)}</p>
<p id="song">${escape(d.song)}</p><p id="mood">${escape(d.mood)}</p>
${d.cover ? `<img id="cover" src="${escape(d.cover)}" alt="">` : '<svg id="coverPlaceholder"></svg>'}
<ul id="reasons">${d.reasons.map(r => `<li>${escape(r)}</li>`).join('')}</ul>
<ul id="moments">${d.moments.map(m => `<li>${m.photo ? `<img src="${escape(m.photo)}" alt="">` : ''}<b>${escape(m.caption)}</b> <i>${escape(m.when)}</i></li>`).join('')}</ul>
</body></html>`;
}
module.exports = { render };
