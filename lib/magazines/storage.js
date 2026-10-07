'use strict';
/** File layout under DATA_DIR/magazines. Names are server-generated; ids are validated hex. */
const fs = require('node:fs');
const path = require('node:path');
const cfg = require('./config');

const ID = /^[a-f0-9]{32}$/;
const NAME = /^[a-z0-9][a-z0-9_.-]{0,80}$/i;
const dir = (kind, id) => {
  if (!ID.test(String(id))) throw new Error('bad id');
  const d = path.join(cfg.ROOT, kind, id);
  fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  return d;
};
const uploadsDir = (id) => dir('uploads', id);
const outputDir = (id) => dir('output', id);
function safePath(base, name) {
  if (!NAME.test(String(name))) throw new Error('bad name');
  const full = path.resolve(base, name);
  if (path.dirname(full) !== path.resolve(base)) throw new Error('path escape');
  return full;
}
function removeOrderFiles(id, { keepOutput = false } = {}) {
  if (!ID.test(String(id))) return;
  fs.rmSync(path.join(cfg.ROOT, 'uploads', id), { recursive: true, force: true });
  if (!keepOutput) fs.rmSync(path.join(cfg.ROOT, 'output', id), { recursive: true, force: true });
}
module.exports = { ID, uploadsDir, outputDir, safePath, removeOrderFiles };
