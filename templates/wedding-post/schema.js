'use strict';
/**
 * Wedding Post validation is generated from templates/wedding-post/config.js.
 * The shared family schema whitelists every editable field and keeps game,
 * timeline, photo and map-link data safe for render.js.
 */
module.exports = require('../../lib/bfday/fields').makeSchema(require('./config'));
