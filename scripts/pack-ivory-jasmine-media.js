'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'), source=path.join(root,'public/ivory-jasmine/art'),out=path.join(root,'assets/ivory-jasmine');fs.mkdirSync(out,{recursive:true});const manifest={};
for(const f of fs.readdirSync(source).filter(f=>/^[a-z0-9-]+\.webp$/.test(f))){const b=fs.readFileSync(path.join(source,f));manifest['art/'+f]=crypto.createHash('sha256').update(b).digest('hex');fs.writeFileSync(path.join(out,'art__'+f+'.b64'),b.toString('base64')+'\n');}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(Object.keys(manifest).length+' generated art assets packed');
