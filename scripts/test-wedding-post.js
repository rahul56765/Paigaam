'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const result = spawnSync(process.execPath, ['--test', 'tests/wedding-post.test.js'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exit(result.status == null ? 1 : result.status);
