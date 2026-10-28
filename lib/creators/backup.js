'use strict';
/** Consistent local rollback snapshot before first creator migration on a populated DB.
 * Never served over HTTP. Financial history remains in the live DB on rollback. */
const fs = require('node:fs');
const path = require('node:path');
module.exports = function backupBeforeMigration(db) {
  const database = db.prepare('PRAGMA database_list').all().find(row => row.name === 'main');
  if (!database?.file || !db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='templates'").get()) return null;
  if (!db.prepare('SELECT 1 FROM templates LIMIT 1').get()) return null;
  const directory = path.join(path.dirname(database.file), 'backups');
  const target = path.join(directory, 'before-creator-partners-20261028.db');
  if (fs.existsSync(target)) return target;
  fs.mkdirSync(directory,{recursive:true,mode:0o700});
  const temporary=target+'.'+process.pid+'.tmp';
  try {
    db.prepare('VACUUM INTO ?').run(temporary);
    fs.chmodSync(temporary,0o600);
    // With the documented single replica there is one migration writer.
    fs.renameSync(temporary,target);
  } catch (err) { try { fs.unlinkSync(temporary); } catch {} throw err; }
  console.log('[creators] pre-migration SQLite backup created:',target);
  return target;
};
