import { Buffer } from 'node:buffer';
import * as store from './store.mjs';
import * as payments from './payments.mjs';
import { fail, randomHex, identity, assertOrigin, readJSON, readBytes, json, html } from './security.mjs';
import { list, bySlug } from './catalog.generated.mjs';
import { fullCatalog, fullBySlug } from './full-catalog.generated.mjs';
import { originalHomePage, originalGalleryPage, originalDetailPage, originalOccasionPage, originalOccasionsIndex, originalLegalPage, originalContactPage, builderPage } from './views.mjs';
import occasions from '../../lib/occasions.js';
import fields from '../../lib/bfday/fields.js';
import images from '../../lib/bfday/image.js';
import audio from '../../lib/bfday/audio.js';
import qr from '../../lib/qrcode.js';

const ID = /^[a-f0-9]{18}$/;
const FILE = /^[a-f0-9]{48}\.(?:jpg|png|webp|mp3|m4a|ogg|wav)$/;
const unavailable = () => html('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Paigaam · migration preview</title><body style="padding:48px;font:18px system-ui;max-width:700px;margin:auto"><h1>This feature is not available in the Cloudflare preview.</h1><p>No payment has been taken here. Existing Railway invitations and customer data have not been imported.</p><a href="/">Back to the collection</a></body></html>', 503);
function requireStorage(env) { if (!env.DB || !env.MEDIA) throw fail('storage_unavailable',503); }
function requireDrafts(env) { requireStorage(env); if (env.DRAFTS_ENABLED !== 'true') throw fail('drafts_offline',503); }
async function owned(env, id, person, slug) {
  if (!ID.test(id || '')) throw fail('not_found',404);
  const pg = await store.getInvite(env.DB,id);
  if (!pg || (slug && pg.template_slug !== slug)) throw fail('not_found',404);
  if (!person.hash || pg.owner_hash !== person.hash) throw fail('forbidden',403);
  return pg;
}
const KEEPSAKE_AUDIO = new Set(['love-letter','anniversary-blue']);
function refs(t,data) {
  const urls=[...fields.imagesIn(t.fields,data), ...fields.audioIn(t.fields,data)];
  // These original editors expose uploaded music as a text songUrl field.
  // External HTTPS music stays external; local media still needs ownership checks.
  if(KEEPSAKE_AUDIO.has(t.slug)&&typeof data?.songUrl==='string'&&data.songUrl.startsWith('/bfday/uploads/')) urls.push(data.songUrl);
  return [...new Set(urls)];
}
async function verifyMedia(env,t,pg,data) {
  for (const url of refs(t,data)) {
    const match = /^\/bfday\/uploads\/([^/?#]+)$/.exec(url);
    if (!match || !FILE.test(match[1])) throw fail('invalid_upload');
    const upload = await store.getUpload(env.DB,match[1]);
    if (!upload || upload.invite_id !== pg.id || !await env.MEDIA.head(match[1])) throw fail('invalid_upload');
  }
}
function render(t,data,origin,preview=true) { return t.render({customer_data:data},{baseUrl:origin,isPreview:preview}); }
async function quote(env,t) { const live = await store.getTemplate(env.DB,t.slug); if (!live) throw fail('template_unavailable',503); return live; }
function result(pg,origin) { return {slug:pg.public_slug,url:origin+'/p/'+pg.public_slug}; }
async function capture(env,order,paymentId) {
  const p = await payments.fetchPayment(env,paymentId);
  if (!payments.validateCapturedPayment(p,{orderId:order.gateway_order_id,amount:order.amount,currency:order.currency})) throw fail('payment_mismatch',400);
  const pg = await store.getInvite(env.DB,order.invite_id);
  if (!pg) throw fail('not_found',404);
  const t = bySlug(pg.template_slug); if (!t) throw fail('template_unavailable',503);
  const data = t.schema.validate(pg.customer_data,{mode:'strict'});
  await verifyMedia(env,t,pg,data);
  const settled = await store.settleOrder(env.DB,order.gateway_order_id,paymentId,t.slug+'-'+randomHex(9));
  if (!settled) throw fail('settlement_conflict',409);
  return settled.invite;
}
async function handle(request,env) {
  const u = new URL(request.url), origin=u.origin, path=u.pathname.replace(/\/+$/,'')||'/';
  if (request.method==='GET' && path==='/status') return json({application:'paigaam-cloudflare-preview',templates:fullCatalog.length,portedTemplates:list.length,checkout:payments.checkoutMode(env).mode,video:false,legacyDataImported:false,catalogOrder:'source-seed-not-legacy-db'});
  if (path==='/api/razorpay/webhook' && request.method==='POST') {
    requireStorage(env); const raw = await readBytes(request,262144);
    if (!await payments.verifyWebhookSignature(env,raw,request.headers.get('x-razorpay-signature'))) throw fail('invalid_signature',401);
    let body; try {body=JSON.parse(new TextDecoder().decode(raw));}catch{throw fail('validation');}
    if (body.event!=='payment.captured') return json({received:true,handled:false});
    const p=body.payload?.payment?.entity, order=p?.order_id&&await store.getOrderByGateway(env.DB,p.order_id);
    if (!order) throw fail('unknown_order',409); // Never silently acknowledge missing legacy orders.
    await capture(env,order,p.id); return json({received:true,handled:true});
  }
  if (request.method==='POST') assertOrigin(request);
  if (path==='/api/razorpay/verify' && request.method==='POST') {
    requireStorage(env); const b=await readJSON(request),person=await identity(request);
    if (!await payments.verifyCheckoutSignature(env,{orderId:b.razorpay_order_id,paymentId:b.razorpay_payment_id,signature:b.razorpay_signature})) throw fail('invalid_signature',401);
    const order=await store.getOrderByGateway(env.DB,b.razorpay_order_id); if(!order)throw fail('not_found',404);
    await owned(env,order.invite_id,person);
    return json(result(await capture(env,order,b.razorpay_payment_id),origin));
  }
  if(request.method==='GET'&&path==='/')return html(originalHomePage(fullCatalog));
  if(request.method==='GET'&&path==='/templates'){
    const valid=(key,choices,def)=>choices.includes(u.searchParams.get(key))?u.searchParams.get(key):def;
    const state={q:(u.searchParams.get('q')||'').slice(0,200),occasion:valid('occasion',['all',...occasions.OCCASIONS.map(o=>o.slug)],'all'),price:valid('price',['all','free','under','over'],'all'),sort:valid('sort',['newest','popular','price-asc','price-desc'],'newest')};
    return html(originalGalleryPage(fullCatalog,state));
  }
  if(request.method==='GET'&&path==='/occasions')return html(originalOccasionsIndex(fullCatalog));
  if(request.method==='GET'&&path==='/contact')return html(originalContactPage());
  if(request.method==='GET'&&['/privacy','/terms','/refund'].includes(path))return html(originalLegalPage(path.slice(1)));
  let m=path.match(/^\/templates\/([a-z0-9-]+)$/);
  if(request.method==='GET'&&m){const occasion=occasions.OCCASIONS.find(o=>o.slug===m[1]);if(occasion)return html(originalOccasionPage(occasion,fullCatalog));const t=fullBySlug(m[1]);return t?html(originalDetailPage(t,{baseUrl:origin})):unavailable();}
  const legacyDemoFiles={ '/maafi/demo':'/maafi/demo.data', '/saalgirah/demo':'/legacy/saalgirah.data', '/lavender-bloom/demo':'/legacy/lavender-tic-tac-toe-bloom.data', '/lavender-tic-tac-toe-bloom/demo':'/legacy/lavender-tic-tac-toe-bloom.data', '/valentine-say-yes/demo':'/legacy/valentine-say-yes.data' };
  if(request.method==='GET'&&Object.hasOwn(legacyDemoFiles,path)){
    if(!env.ASSETS)throw fail('not_found',404);
    const asset=await env.ASSETS.fetch(new Request(new URL(legacyDemoFiles[path],origin),request));
    if(!asset.ok)throw fail('not_found',404);
    const headers=new Headers(asset.headers);headers.set('Content-Type','text/html; charset=utf-8');headers.set('Cache-Control','private, no-store');headers.set('X-Robots-Tag','noindex, nofollow');headers.set('X-Content-Type-Options','nosniff');
    return new Response(asset.body,{status:asset.status,headers});
  }
  m=path.match(/^\/template-view\/([a-z0-9-]+)$/);
  if(request.method==='GET'&&m){
    if(['noor','meher','aashi'].includes(m[1])){
      if(!env.ASSETS)throw fail('not_found',404);
      const asset=await env.ASSETS.fetch(new Request(new URL('/classic/'+m[1]+'.data',origin),request));
      if(!asset.ok)throw fail('not_found',404);
      const headers=new Headers(asset.headers);headers.set('Content-Type','text/html; charset=utf-8');headers.set('Cache-Control','private, no-store');headers.set('X-Robots-Tag','noindex, nofollow');headers.set('X-Content-Type-Options','nosniff');
      return new Response(asset.body,{status:asset.status,headers});
    }
    const t=bySlug(m[1]);return t?html(render(t,t.config.demo,origin,true)):unavailable();
  }
  if (request.method==='GET' && path==='/api/qr') {
    const value=u.searchParams.get('url')||''; let target;try{target=new URL(value);}catch{throw fail('validation');}
    if(target.origin!==origin||!target.pathname.startsWith('/p/')||value.length>1024)throw fail('validation');
    return new Response(qr.qrSVG(value),{headers:{'Content-Type':'image/svg+xml','Cache-Control':'public,max-age=3600'}});
  }
  m=path.match(/^\/p\/([a-z0-9-]+)$/);
  if(m&&request.method==='GET') {requireStorage(env);const pg=await store.getInviteByPublicSlug(env.DB,m[1]);if(!pg)throw fail('not_found',404);const t=bySlug(pg.template_slug);return t?html(render(t,pg.customer_data,origin,false)):unavailable();}
  m=path.match(/^\/bfday\/uploads\/([^/]+)$/);
  if(m&&['GET','HEAD'].includes(request.method)) {
    requireStorage(env);if(!FILE.test(m[1]))throw fail('not_found',404);
    const upload=await store.getUpload(env.DB,m[1]),pg=upload&&await store.getInvite(env.DB,upload.invite_id);
    if(!pg)throw fail('not_found',404); const t=bySlug(pg.template_slug),person=await identity(request);
    const isPublic=pg.status==='published'&&t&&refs(t,pg.customer_data).includes('/bfday/uploads/'+m[1]);
    if(!isPublic&&person.hash!==pg.owner_hash)throw fail('not_found',404);
    const requestedRange=request.headers.has('range');
    const obj=await env.MEDIA.get(m[1],requestedRange?{range:request.headers}:undefined);if(!obj)throw fail('not_found',404);
    const partial=requestedRange&&obj.range;
    const headers=new Headers({'Content-Type':upload.mime,'Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'});
    if(partial){headers.set('Content-Range',`bytes ${obj.range.offset}-${obj.range.offset+obj.range.length-1}/${obj.size}`);headers.set('Content-Length',String(obj.range.length));}else headers.set('Content-Length',String(obj.size));
    return new Response(request.method==='HEAD'?null:obj.body,{status:partial?206:200,headers});
  }
  m=path.match(/^\/create\/([a-z0-9-]+)$/);
  if(m&&request.method==='GET') {const t=bySlug(m[1]);if(!t)return unavailable();const live=env.DB?await store.getTemplate(env.DB,t.slug):null;return html(builderPage(t,{price:live?live.price/100:t.config.price||0,listPrice:t.config.list_price||0,baseUrl:origin}));}
  m=path.match(/^\/([a-z0-9-]+)\/(demo|preview-frame|preview\/([a-f0-9]{18}))$/);
  if(m){const t=bySlug(m[1]);if(t){
    if(m[2]==='demo'&&request.method==='GET')return html(render(t,t.config.demo,origin));
    if(m[2]==='preview-frame'&&['POST','GET'].includes(request.method)){let data={};if(request.method==='POST')data=(await readJSON(request)).customer_data;else{try{data=JSON.parse(u.searchParams.get('d')||'{}');}catch{}}
      return html(render(t,t.schema.validate(data,{mode:'lenient'}),origin));}
    if(m[3]&&request.method==='GET'){requireStorage(env);const pg=await owned(env,m[3],await identity(request),t.slug);return html(render(t,pg.customer_data,origin));}
  }}
  m=path.match(/^\/api\/([a-z0-9-]+)\/(draft|upload|upload-audio|audio|publish)$/);
  if(m&&request.method==='POST') {
    const t=bySlug(m[1]);if(!t)throw fail('not_found',404);requireDrafts(env);
    const action=m[2],person=await identity(request,action==='draft');
    if(action==='draft') {
      const b=await readJSON(request),data=t.schema.validate(b.customer_data,{mode:'draft'});let pg;
      if(b.id){pg=await owned(env,b.id,person,t.slug);await verifyMedia(env,t,pg,data);pg=await store.updateInvite(env.DB,pg.id,person.hash,data);if(!pg)throw fail('draft_locked',409);}
      else{if(refs(t,data).length)throw fail('invalid_upload');await quote(env,t);pg=await store.createInvite(env.DB,t.slug,person.hash,data);}
      return json({id:pg.id,previewUrl:`/${t.slug}/preview/${pg.id}`},200,person.cookie?{'Set-Cookie':person.cookie}:{});
    }
    if(['upload','upload-audio','audio'].includes(action)) {
      const pg=await owned(env,u.searchParams.get('id'),person,t.slug);if(pg.status!=='draft')throw fail('draft_locked',409);
      const isImage=action==='upload', keepsake=!isImage&&action==='audio'&&KEEPSAKE_AUDIO.has(t.slug);
      const kind=isImage?'image':'audio',cap=isImage?fields.maxImages(t.fields)*3+6:keepsake?5:9;
      if(isImage&&!fields.maxImages(t.fields))throw fail('not_found',404);
      if(!isImage&&!keepsake&&!t.fields.some(f=>f.type==='audio'))throw fail('not_found',404);
      const prior=await store.listUploads(env.DB,pg.id);
      const count=prior.filter(o=>isImage?o.mime.startsWith('image/'):o.mime.startsWith('audio/')||o.mime==='application/ogg').length;
      if(count>=cap)throw fail('limit',429);
      let mime=(request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase(),ext;
      const types=isImage?images.EXT:audio.EXT;
      // Preserve the two original MP3/WAV editors' octet-stream contract, but
      // infer and validate the actual container instead of trusting that header.
      if(keepsake){if(mime!=='application/octet-stream'&&!['mp3','wav'].includes(types[mime]))throw fail('invalid_audio');}
      else if(!types[mime])throw fail(isImage?'invalid_image':'invalid_audio');
      const bytes=Buffer.from(await readBytes(request,isImage?2*1024*1024:keepsake?12*1024*1024:audio.MAX_BYTES));
      if(keepsake){
        ext=audio.sniffAudio(bytes);
        if(!['mp3','wav'].includes(ext)||(mime!=='application/octet-stream'&&types[mime]!==ext))throw fail('invalid_audio');
        mime=ext==='mp3'?'audio/mpeg':'audio/wav';
      }else{
        const problem=isImage?images.checkImage(bytes,mime):audio.checkAudio(bytes,mime);if(problem)throw fail(problem,problem==='too_large'?413:400);
        ext=types[mime];
      }
      const key=randomHex(24)+'.'+ext;await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:mime}});
      // The preflight count is only an optimization. The D1 INSERT rechecks the
      // cap atomically; losing concurrent requests must remove their R2 object.
      try {if(!await store.addUpload(env.DB,{key,invite_id:pg.id,mime,size:bytes.length},{kind,maxCount:cap}))throw fail('upload_not_accepted',409);}catch(e){await env.MEDIA.delete(key);throw e;}
      return json({url:'/bfday/uploads/'+key});
    }
    if(action==='publish') {
      if(!payments.checkoutMode(env).enabled)throw fail('payments_offline',503);
      const {id}=await readJSON(request),pg=await owned(env,id,person,t.slug);if(pg.status==='published')return json(result(pg,origin));
      const data=t.schema.validate(pg.customer_data,{mode:'strict'});await verifyMedia(env,t,pg,data);const live=await quote(env,t);
      if(live.price===0)throw fail('free_publish_not_enabled',503);
      let order=await store.getOrderForInvite(env.DB,id);
      if(!order){order=await store.beginCheckout(env.DB,id,person.hash,live.price,live.currency,pg.customer_data);if(!order)throw fail('checkout_in_progress',409);
        const gateway=await payments.razorpayCreateOrder(env,{amount:order.amount,currency:order.currency,receipt:order.id,notes:{paigaam_id:id}});
        order=await store.setGatewayOrder(env.DB,order.id,gateway.id);if(!order)throw fail('checkout_reconciliation_required',409);
      }
      if(order.status==='creating')throw fail('checkout_reconciliation_required',409);
      return json({razorpay:true,keyId:env.RAZORPAY_KEY_ID,orderId:order.gateway_order_id,amount:order.amount,currency:order.currency,name:'Paigaam',description:t.config.name});
    }
  }
  if(path.startsWith('/api/')||path.startsWith('/admin')||path.startsWith('/wedding-video')||path.startsWith('/magazines')||path.startsWith('/creators'))return unavailable();
  if(['GET','HEAD'].includes(request.method)&&env.ASSETS){const response=await env.ASSETS.fetch(request);if(response.status!==404)return response;}
  throw fail('not_found',404);
}
export default {async fetch(request,env){try{return await handle(request,env);}catch(e){if(!e?.status)console.error('Paigaam request failed');return json({error:e?.status?(e.code||'validation'):'server_error'},e?.status||500);}}};
