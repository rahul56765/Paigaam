'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const backup=require('../lib/creators/backup');
test('pre-migration backup is consistent, private, one-time and never changes source rows',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'creator-backup-test-'));const db=new DatabaseSync(path.join(dir,'source.db'));
 try{
  db.exec("PRAGMA journal_mode=WAL;CREATE TABLE templates(id TEXT PRIMARY KEY);INSERT INTO templates VALUES ('original');");
  const file=backup(db);assert.ok(fs.existsSync(file));assert.equal(fs.statSync(file).mode&0o777,0o600);
  const copy=new DatabaseSync(file,{readOnly:true});assert.equal(copy.prepare('SELECT id FROM templates').get().id,'original');assert.equal(copy.prepare('PRAGMA integrity_check').get().integrity_check,'ok');copy.close();
  const before=fs.readFileSync(file);db.exec("INSERT INTO templates VALUES ('later');");assert.equal(backup(db),file);assert.deepEqual(fs.readFileSync(file),before);assert.equal(db.prepare('SELECT COUNT(*) n FROM templates').get().n,2);
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
