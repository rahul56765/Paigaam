'use strict';
// Run after placing the five original WebP artworks in public/assets/chandni-royale.
// The optional user-supplied opening film can be added here later, never invented.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const src=path.join(__dirname,'../public/assets/chandni-royale'),dest=path.join(__dirname,'../assets/chandni-royale');fs.mkdirSync(dest,{recursive:true});
const manifest={};for(const name of fs.readdirSync(src).sort()){
 if(!/^[a-z0-9-]+\.(webp|mp4)$/.test(name))continue;
 const bytes=fs.readFileSync(path.join(src,name)),b64=bytes.toString('base64'),parts=Math.ceil(b64.length/250000);
 if(parts>100)throw new Error('Media is too large: '+name);
 manifest[name]={bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),parts};
 for(let n=0;n<parts;n++)fs.writeFileSync(path.join(dest,name+'.b64.part'+String(n+1).padStart(2,'0')),b64.slice(n*250000,(n+1)*250000)+'\n');
}
fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log('Packed',Object.keys(manifest).length,'Chandni Royale original assets');
