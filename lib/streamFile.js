'use strict';
const fs=require('node:fs');
function streamFile(req,res,file,type,cache='public, max-age=3600'){
 let stat;try{stat=fs.statSync(file);if(!stat.isFile())return false;}catch{return false;}
 const total=stat.size,etag='"'+total.toString(16)+'-'+Math.trunc(stat.mtimeMs).toString(16)+'"';
 const headers={'Content-Type':type,'Accept-Ranges':'bytes','Cache-Control':cache,'X-Content-Type-Options':'nosniff','ETag':etag};
 if(req.headers['if-none-match']===etag&&!req.headers.range){res.writeHead(304,headers);res.end();return true;}
 let start=0,end=total-1,status=200;
 const range=req.headers.range;
 if(range&&(!req.headers['if-range']||req.headers['if-range']===etag)){
  const match=range.match(/^bytes=(\d*)-(\d*)$/);
  if(!match||(!match[1]&&!match[2])){res.writeHead(416,{...headers,'Content-Range':`bytes */${total}`});res.end();return true;}
  if(!match[1])start=Math.max(0,total-Number(match[2]));else{start=Number(match[1]);if(match[2])end=Math.min(total-1,Number(match[2]));}
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=total||start<0){res.writeHead(416,{...headers,'Content-Range':`bytes */${total}`});res.end();return true;}
  status=206;headers['Content-Range']=`bytes ${start}-${end}/${total}`;
 }
 headers['Content-Length']=Math.max(0,end-start+1);res.writeHead(status,headers);
 if(req.method==='HEAD'||total===0)res.end();else{const stream=fs.createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);}
 return true;
}
module.exports={streamFile};
