'use strict';
// Disposable local test server, isolated data, and a real restart/persistence check.
const {spawn}=require('node:child_process'),{once}=require('node:events');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
(async()=>{
 const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(r=>socket.close(r));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paigaam-ganapati-test-')),base='http://127.0.0.1:'+port,out=path.join(root,'test-output');fs.mkdirSync(out,{recursive:true});
 let server;
 async function start(){server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',BASE_URL:base,DATA_DIR:dir},stdio:['ignore','pipe','pipe']});server.stderr.on('data',x=>process.stderr.write(x));await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Test server startup timeout')),15000);server.stdout.on('data',chunk=>{if(chunk.toString().includes('admin →')){clearTimeout(timer);resolve();}});server.on('exit',code=>{clearTimeout(timer);reject(new Error('Test server exited '+code));});});}
 async function stop(){if(server&&server.exitCode===null){server.kill('SIGTERM');await once(server,'exit');}}
 try{
  await start();
  const test=spawn(process.execPath,['--test','tests/ganapati-api.test.js','tests/ganapati-browser.test.js'],{cwd:root,env:{...process.env,GANAPATI_BASE_URL:base,GANAPATI_SCREENSHOT_DIR:out},stdio:'inherit'});
  const [code]=await once(test,'exit');if(code!==0)throw new Error('Ganapati test suite failed');
  const data={language:'mr',familyName:'पडताळणी कुटुंब',eventDate:'2026-09-14',eventTime:'11:00',venueName:'घर',address:'पुणे',photos:[]};
  let r=await fetch(base+'/api/ganapati/draft',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({customer_data:data})});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0],{id}=await r.json();
  const image=await require('sharp')({create:{width:20,height:20,channels:3,background:'#ffdd88'}}).jpeg().toBuffer();
  r=await fetch(base+'/api/ganapati/upload?id='+id,{method:'POST',headers:{cookie,'content-type':'image/jpeg'},body:image});assert.equal(r.status,200);const photo=await r.json();data.photos=[{url:photo.url,alt:'पडताळणी'}];
  r=await fetch(base+'/api/ganapati/draft',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({id,customer_data:data})});assert.equal(r.status,200);
  r=await fetch(base+'/api/ganapati/publish',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({id})});const pub=await r.json();assert.equal(r.status,200);
  await stop();await start();
  r=await fetch(pub.url);assert.equal(r.status,200);assert.ok((await r.text()).includes(data.familyName));assert.equal((await fetch(base+photo.url)).status,200);
  console.log('PASS: published URL, personalized data and uploaded photograph survive a full server restart.');
 }finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
