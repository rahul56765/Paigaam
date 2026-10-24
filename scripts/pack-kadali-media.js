'use strict';
// Package original artwork and the exact owner-uploaded film without transcoding.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),src=path.join(root,'public/kadali-vivah'),out=path.join(root,'assets/kadali-vivah');
fs.mkdirSync(out,{recursive:true});const manifest={};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const name of ['leaf','kalash','mandap']){
 const key='art/'+name+'.webp',bytes=fs.readFileSync(path.join(src,key));
 manifest[key]=hash(bytes);fs.writeFileSync(path.join(out,key.replace('/','__')+'.b64'),bytes.toString('base64')+'\n');
}
for(const key of ['opening.mp4','opening-poster.jpg','opening-end.jpg']){
 const bytes=fs.readFileSync(path.join(src,key)),encoded=bytes.toString('base64');
 if(key==='opening.mp4'&&hash(bytes)!=='bf1549420225f65fe2f4b0f411b2244f78442d61ec11da71af634e7952644c18')throw Error('Opening must be the exact original owner upload; do not transcode or replace it.');
 const chunks=encoded.match(/[\s\S]{1,1800000}/g)||[];
 manifest[key]={sha256:hash(bytes),parts:chunks.length,bytes:bytes.length};
 chunks.forEach((chunk,i)=>fs.writeFileSync(path.join(out,key+'.b64.part'+String(i+1).padStart(2,'0')),chunk+'\n'));
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Packed artwork and byte-identical owner film.');
