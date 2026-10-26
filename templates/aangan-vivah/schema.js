'use strict';

const config = require('./config');
const base = require('../../lib/bfday/fields').makeSchema(config);

function validate(data, options = {}) {
  const mode = options.mode || 'strict';
  const clean = base.validate(data, options);
  if (mode === 'strict') {
    const events = Array.isArray(clean.events) ? clean.events : [];
    const kinds = events.map(event => event.kind);
    if (new Set(kinds).size !== kinds.length) throw new base.InputError();
    if (!kinds.includes('wedding') || !kinds.includes('reception')) throw new base.InputError();
  }
  return clean;
}

module.exports = { ...base, validate };
