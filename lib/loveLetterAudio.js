'use strict';
// Byte-level container checking; never trust an extension or browser MIME.
function audioExtension(b){
 if(!Buffer.isBuffer(b)||b.length<44)return null;
 if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WAVE'){
   let i=12,fmt=false,data=false;while(i+8<=b.length){const tag=b.toString('ascii',i,i+4),size=b.readUInt32LE(i+4);if(size>b.length-i-8)return null;if(tag==='fmt '&&size>=16){const format=b.readUInt16LE(i+8),channels=b.readUInt16LE(i+10),rate=b.readUInt32LE(i+12);fmt=[1,3].includes(format)&&channels>=1&&channels<=8&&rate>=8000&&rate<=192000;}if(tag==='data'&&size>0)data=true;i+=8+size+(size%2);}return fmt&&data?'wav':null;
 }
 let offset=0;if(b.toString('ascii',0,3)==='ID3'){if(![2,3,4].includes(b[3])||[b[6],b[7],b[8],b[9]].some(n=>n>127))return null;offset=10+((b[6]<<21)|(b[7]<<14)|(b[8]<<7)|b[9]);if(b[5]&16)offset+=10;}
 // Parse complete MPEG Layer III frames rather than accepting an ID3 label or a sync-looking prefix.
 const rates=[44100,48000,32000],mpeg1=[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320],mpeg2=[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160];
 let frames=0,i=offset;
 while(i+4<=b.length&&frames<2){
   const a=b[i+1],c=b[i+2],version=(a>>3)&3,layer=(a>>1)&3,bitrate=c>>4,sample=(c>>2)&3;
   if(b[i]!==255||(a&224)!==224||version===1||layer!==1||!bitrate||bitrate===15||sample===3)return null;
   const rate=rates[sample]/(version===3?1:version===2?2:4),kbps=(version===3?mpeg1:mpeg2)[bitrate];
   const length=Math.floor((version===3?144:72)*kbps*1000/rate)+((c>>1)&1);
   if(i+length>b.length)return null;i+=length;frames++;
 }
 if(frames>=2)return 'mp3';
 return null;
}
module.exports={audioExtension};
