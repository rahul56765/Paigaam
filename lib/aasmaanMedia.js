'use strict';
// Restore original generated artwork from portable, checksummed source chunks.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const SOURCE=path.join(__dirname,'../assets/aasmaan'),DEST=path.join(__dirname,'../public/aasmaan');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function ensureAasmaanMedia(){
 const manifestPath=path.join(SOURCE,'manifest.json');if(!fs.existsSync(manifestPath))return [];
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8')),healed=[];
 fs.mkdirSync(DEST,{recursive:true});
 for(const [name,spec] of Object.entries(manifest)){
  if(!/^[a-z0-9-]+\.webp$/.test(name)||!spec||!/^[a-f0-9]{64}$/.test(spec.sha256)||!Number.isInteger(spec.parts)||spec.parts<1||spec.parts>30)throw new Error('Invalid Aasmaan media manifest: '+name);
  const target=path.join(DEST,name);let intact=false;try{intact=hash(fs.readFileSync(target))===spec.sha256}catch{}
  if(intact)continue;
  let encoded='';for(let i=1;i<=spec.parts;i++)encoded+=fs.readFileSync(path.join(SOURCE,name+'.b64.part'+String(i).padStart(2,'0')),'utf8').trim();
  const bytes=Buffer.from(encoded,'base64');if(hash(bytes)!==spec.sha256)throw new Error('Aasmaan media checksum mismatch: '+name);
  const tmp=target+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,bytes,{mode:0o644});fs.renameSync(tmp,target);healed.push(name);
 }
 return healed;
}
module.exports={ensureAasmaanMedia};
