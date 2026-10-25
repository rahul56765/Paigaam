'use strict';

const { makeSchema, isRealDate } = require('../../lib/bfday/fields');
const config = require('./config');
const base = makeSchema(config);
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const isWeddingTime = value => typeof value === 'string' && TIME.test(value);
const isMapQuery = value => !/(?:[a-z][a-z0-9+.-]*:\/\/|^(?:javascript|data):|^\/\/|\b(?:www\.|maps\.app\.goo\.gl|goo\.gl\/maps))/i.test(value);

function validate(data, options = {}) {
  const clean = base.validate(data, options);
  const mode = options.mode || 'strict';
  // makeSchema already validates real Gregorian calendar days, including leap
  // years, in strict/draft modes and blanks invalid dates for lenient rendering.
  // These explicit extra checks retain that behavior for the HH:mm text field.
  for (const [id, valid] of [
    ['weddingDate', isRealDate],
    ['weddingTime', isWeddingTime],
    ['mapQuery', isMapQuery],
  ]) {
    if (clean[id] && !valid(clean[id])) {
      if (mode === 'lenient') clean[id] = '';
      else throw new base.InputError('validation', 400);
    }
  }
  return clean;
}

module.exports = { ...base, validate, isWeddingTime };
