'use strict';
// Lossless media packaging for the text-only repository integration.
// Build produces ordinary MP4/MP3/JPEG files; no runtime base64 or data URLs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const source=path.join(__dirname,'../assets/ganapati');
const dest=path.join(__dirname,'../public/ganapati/media');
const manifest=JSON.parse(fs.readFileSync(path.join(source,'manifest.json'),'utf8'));
fs.mkdirSync(dest,{recursive:true});
for(const [name,expected]of Object.entries(manifest)){
 if(!/^[a-z-]+\.(mp4|mp3|jpg)$/.test(name))throw new Error('Invalid media filename');
 const bytes=Buffer.from(fs.readFileSync(path.join(source,name+'.b64'),'utf8').trim(),'base64');
 const actual=crypto.createHash('sha256').update(bytes).digest('hex');
 if(actual!==expected)throw new Error('Media checksum mismatch: '+name);
 fs.writeFileSync(path.join(dest,name),bytes);
 console.log('[ganapati] '+name+' verified ('+bytes.length+' bytes)');
}
