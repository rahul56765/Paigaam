'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const SOURCE=path.join(__dirname,'../assets/chandni-royale'),DEST=path.join(__dirname,'../public/assets/chandni-royale');
function ensureChandniRoyaleMedia(){
 const manifest=JSON.parse(fs.readFileSync(path.join(SOURCE,'manifest.json'),'utf8')),healed=[];
 for(const [name,spec]of Object.entries(manifest)){
  if(!/^[a-z0-9-]+\.(webp|mp4)$/.test(name)||!spec||!/^[a-f0-9]{64}$/.test(spec.sha256)||!Number.isInteger(spec.parts)||spec.parts<1||spec.parts>100||!Number.isInteger(spec.bytes)||spec.bytes<1)throw new Error('Invalid Chandni Royale manifest entry');
  const file=path.join(DEST,name),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
  try{if(hash(fs.readFileSync(file))===spec.sha256)continue;}catch(_){}
  const parts=[];for(let i=1;i<=spec.parts;i++)parts.push(fs.readFileSync(path.join(SOURCE,name+'.b64.part'+String(i).padStart(2,'0')),'utf8').trim());
  const bytes=Buffer.from(parts.join(''),'base64');if(bytes.length!==spec.bytes||hash(bytes)!==spec.sha256)throw new Error('Chandni Royale media checksum mismatch: '+name);
  fs.mkdirSync(DEST,{recursive:true});const temp=file+'.'+process.pid+'.tmp';fs.writeFileSync(temp,bytes);fs.renameSync(temp,file);healed.push(name);
 }return healed;
}
module.exports={ensureChandniRoyaleMedia};
