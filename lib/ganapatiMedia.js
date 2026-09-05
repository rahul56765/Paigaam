'use strict';
// Restores Ganapati media files from the checksummed base64 sources at boot.
// Keeps deployments working even when the host runs no build command; the
// browser always receives ordinary MP4/MP3/JPEG bytes, never base64.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const SOURCE=path.join(__dirname,'../assets/ganapati');
const DEST=path.join(__dirname,'../public/ganapati/media');
function ensureGanapatiMedia(){
  let manifest;
  try{manifest=JSON.parse(fs.readFileSync(path.join(SOURCE,'manifest.json'),'utf8'));}
  catch(e){throw new Error('media manifest unavailable: '+e.message);}
  fs.mkdirSync(DEST,{recursive:true});
  const healed=[];
  for(const [name,expected]of Object.entries(manifest)){
    if(!/^[a-z0-9-]+\.(mp4|mp3|jpg)$/.test(name))throw new Error('invalid media filename: '+name);
    const target=path.join(DEST,name);
    const intact=(()=>{try{return crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')===expected;}catch{return false;}})();
    if(intact)continue;
    const bytes=Buffer.from(fs.readFileSync(path.join(SOURCE,name+'.b64'),'utf8').trim(),'base64');
    if(crypto.createHash('sha256').update(bytes).digest('hex')!==expected)throw new Error('media checksum mismatch: '+name);
    const tmp=target+'.'+process.pid+'.tmp';
    fs.writeFileSync(tmp,bytes,{mode:0o644});
    fs.renameSync(tmp,target);
    healed.push(name);
  }
  return healed;
}
module.exports={ensureGanapatiMedia};
