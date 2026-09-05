'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {db,q,DATA_DIR,PERSISTENT}=require('../db');
const {validate,InputError}=require('../templates/ganapati-aagman/schema');
const {renderInvitation}=require('../templates/ganapati-aagman/render');
const words=require('../templates/ganapati-aagman/translations');
const {ganapatiCreatePage}=require('../pages/ganapatiCreate');
const {streamFile}=require('./streamFile');
const uploadDir=path.join(DATA_DIR,'ganapati-uploads');
fs.mkdirSync(uploadDir,{recursive:true});
// Additive tables: existing invitations, templates and admin records are never rebuilt.
db.exec(`CREATE TABLE IF NOT EXISTS ganapati_owners (
 invitation_id TEXT PRIMARY KEY REFERENCES paigaams(id) ON DELETE CASCADE,
 owner_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS ganapati_owner_idx ON ganapati_owners(owner_hash);
CREATE TABLE IF NOT EXISTS ganapati_uploads (
 filename TEXT PRIMARY KEY, invitation_id TEXT NOT NULL REFERENCES paigaams(id) ON DELETE CASCADE,
 bytes INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS ganapati_upload_inv ON ganapati_uploads(invitation_id);`);
const SLUG='ganapati-aagman', COOKIE='paigaam_creator';
const inFlight=new Set(),rates=new Map();
function owner(req){
 const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));
 const value=raw?raw.slice(COOKIE.length+1):'';
 return /^[a-f0-9]{64}$/.test(value)?crypto.createHash('sha256').update(value).digest('hex'):null;
}
function owned(req,id){const record=db.prepare('SELECT owner_hash FROM ganapati_owners WHERE invitation_id=?').get(id);return !!record&&record.owner_hash===owner(req);}
function editable(req,id){const pg=q.paigaamById(id);if(!pg||pg.template_slug!==SLUG)throw new InputError('not_found',404);if(!owned(req,id))throw new InputError('forbidden',403);if(pg.status!=='draft')throw new InputError('forbidden',403);return pg;}
function published(id){const pg=q.paigaamById(id);return pg&&pg.template_slug===SLUG&&['published','active'].includes(pg.status)?pg:null;}
function reply(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));}
function html(res,body){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'SAMEORIGIN','Referrer-Policy':'strict-origin-when-cross-origin'});res.end(body);}
async function read(req,limit){
 const declared=Number(req.headers['content-length']);if(declared>limit){req.resume();throw new InputError('too_large',413);}
 const chunks=[];let size=0;
 for await(const chunk of req){size+=chunk.length;if(size>limit)throw new InputError('too_large',413);chunks.push(chunk);}
 return Buffer.concat(chunks);
}
async function jsonBody(req){if(!(req.headers['content-type']||'').startsWith('application/json'))throw new InputError();try{return JSON.parse((await read(req,32768)).toString('utf8'));}catch(e){if(e instanceof InputError)throw e;throw new InputError();}}
function csrf(req,base){
 const origin=req.headers.origin;
 if(req.headers['sec-fetch-site']==='cross-site'||(origin&&origin!==new URL(base).origin))throw new InputError('forbidden',403);
}
function rate(req){
 const now=Date.now(),key=req.socket.remoteAddress||'unknown';
 if(rates.size>5000)rates.clear();
 let r=rates.get(key);if(!r||r.until<now)r={count:0,until:now+600000};
 r.count++;rates.set(key,r);if(r.count>240)throw new InputError('limit',429);
}
function verifyPhotos(id,data){for(const photo of data.photos){const row=db.prepare('SELECT invitation_id FROM ganapati_uploads WHERE filename=?').get(path.basename(photo.url));if(!row||row.invitation_id!==id)throw new InputError('forbidden',403);}}
function cleanup(){
 // Only unreferenced, old uploads are eligible. Never delete a published photo.
 const cutoff=Date.now()-7*86400000;
 for(const row of db.prepare('SELECT * FROM ganapati_uploads WHERE created_at < ?').all(cutoff)){
  const pg=q.paigaamById(row.invitation_id);
  if(pg&&(pg.customer_data.photos||[]).some(p=>path.basename(p.url)===row.filename))continue;
  fs.rmSync(path.join(uploadDir,row.filename),{force:true});db.prepare('DELETE FROM ganapati_uploads WHERE filename=?').run(row.filename);
 }
}
function ics(pg){
 const d=pg.customer_data,t=words[d.language];
 const escape=s=>String(s||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
 const start=new Date(d.eventDate+'T'+d.eventTime+':00+05:30');
 const stamp=date=>date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
 // RFC5545 UTF-8 line folding at no more than 75 octets.
 const fold=line=>{let rows=[],current='',bytes=0;for(const c of line){let n=Buffer.byteLength(c);if(bytes+n>75){rows.push(current);current=' ';bytes=1;}current+=c;bytes+=n;}rows.push(current);return rows.join('\r\n');};
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Paigaam//Ganapati Aagman//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',`UID:${pg.id}@paigaam.cc`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(new Date(+start+2*3600000))}`,`SUMMARY:${escape(t.title+' — '+d.familyName)}`,`DESCRIPTION:${escape(d.customMessage||t.messageDefault)}`,`LOCATION:${escape(d.venueName+', '+d.address)}`,'END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
async function handle(req,res,u,{baseUrl,isAdmin=false}={}){
 const p=u.pathname.replace(/\/+$/,'')||'/';
 const handles=p==='/create/'+SLUG||p==='/ganapati/demo'||p.startsWith('/ganapati/preview/')||p.startsWith('/ganapati/uploads/')||p.startsWith('/api/ganapati/');
 if(!handles)return false;
 try{
  if(req.method==='POST'){csrf(req,baseUrl);rate(req);}
  if(req.method==='GET'&&p==='/create/'+SLUG){const tpl=q.templateBySlug(SLUG);if(!tpl||tpl.status!=='published')throw new InputError('not_found',404);html(res,ganapatiCreatePage());return true;}
  if(req.method==='GET'&&p==='/ganapati/demo'){
   const lang=['en','hi','mr'].includes(u.searchParams.get('lang'))?u.searchParams.get('lang'):'en';
   const samples={en:['The Deshmukh family','Our home','Pune, Maharashtra'],hi:['देशमुख परिवार','हमारा घर','पुणे, महाराष्ट्र'],mr:['देशमुख कुटुंब','आमचे घर','पुणे, महाराष्ट्र']};const s=samples[lang];
   html(res,renderInvitation({customer_data:{language:lang,familyName:s[0],eventDate:'2026-09-14',eventTime:'11:00',venueName:s[1],address:s[2]}},{baseUrl,isPreview:true}));return true;
  }
  let m=p.match(/^\/ganapati\/preview\/([A-Za-z0-9_-]+)$/);
  if(req.method==='GET'&&m){const pg=q.paigaamById(m[1]);if(!pg||pg.template_slug!==SLUG)throw new InputError('not_found',404);if(!isAdmin&&!owned(req,pg.id))throw new InputError('forbidden',403);html(res,renderInvitation(pg,{baseUrl,isPreview:true}));return true;}
  m=p.match(/^\/ganapati\/uploads\/([a-f0-9]{48}\.webp)$/);
  if(['GET','HEAD'].includes(req.method)&&m){
   const row=db.prepare('SELECT invitation_id FROM ganapati_uploads WHERE filename=?').get(m[1]);
   const pub=row&&published(row.invitation_id);
   const visible=pub&&(pub.customer_data.photos||[]).some(photo=>path.basename(photo.url)===m[1]);
   if(!row||(!visible&&!isAdmin&&!owned(req,row.invitation_id)))throw new InputError('not_found',404);
   if(!streamFile(req,res,path.join(uploadDir,m[1]),'image/webp','private, max-age=0, must-revalidate'))throw new InputError('not_found',404);
   return true;
  }
  m=p.match(/^\/api\/ganapati\/calendar\/([A-Za-z0-9_-]+)$/);
  if(req.method==='GET'&&m){const pg=published(m[1]);if(!pg)throw new InputError('not_found',404);res.writeHead(200,{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="ganapati-aagman.ics"','Cache-Control':'no-store'});res.end(ics(pg));return true;}
  if(req.method==='POST'&&p==='/api/ganapati/draft'){
   const body=await jsonBody(req),data=validate(body.customer_data);let id=body.id;
   if(id){const pg=editable(req,id);verifyPhotos(pg.id,data);q.paigaamUpdate(id,{customer_data:data,customer_name:data.familyName});}
   else{
    const tpl=q.templateBySlug(SLUG);if(!tpl||tpl.status!=='published')throw new InputError('not_found',404);
    if(data.photos.length)throw new InputError();
    let hash=owner(req);
    if(!hash){const token=crypto.randomBytes(32).toString('hex');hash=crypto.createHash('sha256').update(token).digest('hex');res.setHeader('Set-Cookie',`${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${new URL(baseUrl).protocol==='https:'?'; Secure':''}`);}
    const count=db.prepare('SELECT COUNT(*) n FROM ganapati_owners WHERE owner_hash=? AND created_at>?').get(hash,Date.now()-86400000).n;
    if(count>=20)throw new InputError('limit',429);
    const pg=q.paigaamInsert({template_id:tpl.id,customer_data:data,customer_name:data.familyName});id=pg.id;
    db.prepare('INSERT INTO ganapati_owners VALUES(?,?,?)').run(id,hash,Date.now());
   }
   reply(res,200,{id,previewUrl:'/ganapati/preview/'+id});return true;
  }
  if(req.method==='POST'&&p==='/api/ganapati/upload'){
   const id=u.searchParams.get('id');if(!id)throw new InputError();editable(req,id);
   if(inFlight.has(id))throw new InputError('limit',429);inFlight.add(id);
   try{
    cleanup();
    if(!['image/jpeg','image/png','image/webp'].includes(req.headers['content-type']))throw new InputError('invalid_image');
    if(db.prepare('SELECT COUNT(*) n FROM ganapati_uploads WHERE invitation_id=?').get(id).n>=30)throw new InputError('limit');
    if(db.prepare('SELECT COALESCE(SUM(bytes),0) n FROM ganapati_uploads').get().n>500*1024*1024)throw new InputError('limit',507);
    const buffer=await read(req,2*1024*1024);
    const sharp=require('sharp');let output;
    try{
     const image=sharp(buffer,{limitInputPixels:20000000,failOn:'warning'}),meta=await image.metadata();
     const allowed={'image/jpeg':'jpeg','image/png':'png','image/webp':'webp'};
     if(meta.format!==allowed[req.headers['content-type']]||!meta.width||!meta.height||meta.pages>1)throw new Error('bad image');
     output=await image.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer();
    }catch{throw new InputError('invalid_image');}
    const filename=crypto.randomBytes(24).toString('hex')+'.webp';
    fs.writeFileSync(path.join(uploadDir,filename),output,{flag:'wx',mode:0o600});
    db.prepare('INSERT INTO ganapati_uploads VALUES(?,?,?,?)').run(filename,id,output.length,Date.now());
    reply(res,200,{url:'/ganapati/uploads/'+filename});return true;
   }finally{inFlight.delete(id);}
  }
  if(req.method==='POST'&&p==='/api/ganapati/publish'){
   const {id}=await jsonBody(req);const pg=q.paigaamById(id);if(!pg||pg.template_slug!==SLUG)throw new InputError('not_found',404);if(!owned(req,id))throw new InputError('forbidden',403);
   if(['published','active'].includes(pg.status)){reply(res,200,{slug:pg.slug,url:baseUrl+'/p/'+pg.slug});return true;}
   if(pg.status!=='draft')throw new InputError('forbidden',403);
   const tpl=q.templateBySlug(SLUG);if(!tpl||tpl.status!=='published'||tpl.price!==0)throw new InputError('forbidden',403);
   const host=new URL(baseUrl).hostname;
   if(!PERSISTENT&&!['localhost','127.0.0.1','::1'].includes(host))throw new InputError('storage_unavailable',503);
   const data=validate(pg.customer_data);verifyPhotos(id,data);
   let slug;do{slug='ganapati-'+crypto.randomBytes(9).toString('hex');}while(q.paigaamSlugTaken(slug));
   q.paigaamUpdate(id,{slug,status:'published',payment_status:'paid',published_at:new Date().toISOString()});
   reply(res,200,{slug,url:baseUrl+'/p/'+slug});return true;
  }
  throw new InputError('not_found',404);
 }catch(e){if(!(e instanceof InputError))console.error('[ganapati]',e.message);reply(res,e.status||500,{error:e.code||'server_error'});return true;}
}
module.exports={handle,owned,ics,SLUG};
