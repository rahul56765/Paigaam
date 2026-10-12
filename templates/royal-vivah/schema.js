'use strict';

// The shared family validator enforces this template's editable-copy allowlist.
module.exports = require('../../lib/bfday/fields').makeSchema(require('./config'));
