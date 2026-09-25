'use strict';
/**
 * Validation for Meri Duniya (A Whole Website, Made For You).
 *
 * Generated from config.fields by the family engine: a whitelisting
 * validator with the max lengths declared there (the `together` date must be
 * a real YYYY-MM-DD). Only his name is required; generic copy falls back to
 * the designed defaults in render.js (via lib/bfday/fields.resolve), and
 * personal sections left empty are simply not rendered. Unknown keys never
 * persist.
 */
module.exports = require('../../lib/bfday/fields').makeSchema(require('./config'));
