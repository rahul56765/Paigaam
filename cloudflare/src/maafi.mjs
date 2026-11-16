/** Original Maafi wizard/draft adapter for a fresh Cloudflare data store.
 * UNROUTED. The original design has no photo upload. Never add fields or alter
 * its renderer. Publishing is fail-closed until payments and rate controls have
 * passed production integration. No calls to the payment gateway are made here.
 */
import schema from '../../templates/maafi/schema.js';
import renderer from '../../templates/maafi/render.js';
import builder from '../../pages/maafiCreate.js';
import * as store from './store.mjs';
import { DRAFT_ADMISSION } from './admission-policy.mjs';
import { fail, identity, assertOrigin, readJSON, json, html } from './security.mjs';
const ID = /^[a-f0-9]{18}$/;
const DEMO = { recipientName:'Meher',senderName:'Rahul',headline:'I’m really sorry ❤️',yesLabel:'Okay baby, I forgive you 💖',noLabel:'No, I’m still angry 😠',celebration:'Yay! You forgave me! 😍💖🥳' };
const NOTICE = '<aside role="status" style="padding:8px 20px;background:#5b1725;color:white;text-align:center;font:12px/1.45 system-ui">Cloudflare preview · Drafts, publishing and payments are unavailable.</aside>';
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'";
const output = markup => html(markup,200,{'Content-Security-Policy':CSP});
function storage(env){if(!env.DB)throw fail('storage_unavailable',503);}
function drafts(env){storage(env);if(env.DRAFTS_ENABLED!=='true')throw fail('drafts_offline',503);}
async function owned(env,id,person){if(!ID.test(id||''))throw fail('not_found',404);const p=await store.getInvite(env.DB,id);if(!p||p.template_slug!=='maafi')throw fail('not_found',404);if(!person.hash||person.hash!==p.owner_hash)throw fail('forbidden',403);return p;}
function wizard(opts){
 let page=builder.maafiCreatePage(opts).replace(/<script[^>]+src="\/js\/(?:paigaam-pay|creator-coupon)\.js[^>]*><\/script>\s*/g,'');
 page=page.replace(/<button type="button" id="publish" class="button publish">[\s\S]*?<\/button>/,'<button type="button" id="publish" class="button publish" disabled aria-disabled="true">Publishing unavailable</button>')
  .replace(/<p class="hint">(?:Secure payment via Razorpay|Free\. The link stays live;)[\s\S]*?<\/p>/,'<p class="hint">Publishing and payment are unavailable in this preview.</p>')
  .replace(/(<body\b[^>]*>)/i,'$1'+NOTICE);
 const guard=`<script>(function(){function lock(){var b=document.getElementById('publish');if(b){if(!b.disabled)b.disabled=true;b.setAttribute('aria-disabled','true');if(b.textContent!=='Publishing unavailable')b.textContent='Publishing unavailable';}}document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('#publish')){e.preventDefault();e.stopImmediatePropagation();}},true);document.addEventListener('DOMContentLoaded',function(){lock();new MutationObserver(lock).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});});})();</script>`;
 return page.replace('</body>',guard+'</body>');
}
async function route(request,env,path,url){
 const origin=url.origin,method=request.method;
 if(method==='POST')assertOrigin(request);
 if(method==='GET'&&path==='/maafi/demo')return output(renderer.renderMaafi({customer_data:DEMO},{baseUrl:origin,isPreview:true}));
 if(method==='GET'&&path==='/create/maafi'){const t=env.DB&&await store.getTemplate(env.DB,'maafi');return output(wizard({price:t?t.price/100:0,listPrice:0}));}
 if(method==='GET'&&path==='/maafi/preview-frame'){
   const raw=url.searchParams.get('d')||'{}';if(raw.length>16384)throw fail('too_large',413);
   let d;try{d=schema.validate(JSON.parse(raw));}catch{d={templateVersion:1};}
   return output(renderer.renderMaafi({customer_data:d},{baseUrl:origin,isPreview:true}));
 }
 const m=path.match(/^\/maafi\/preview\/([^/]+)$/);
 if(method==='GET'&&m){storage(env);const p=await owned(env,m[1],await identity(request));return output(renderer.renderMaafi({customer_data:p.customer_data},{baseUrl:origin,isPreview:true}));}
 if(method==='POST'&&path==='/api/maafi/draft'){
   drafts(env);const b=await readJSON(request,16384),data=schema.validate(b.customer_data),person=await identity(request,!b.id);let p;
   if(b.id){p=await owned(env,b.id,person);if(p.status!=='draft')throw fail('draft_locked',409);p=await store.updateInvite(env.DB,p.id,person.hash,data);if(!p)throw fail('draft_locked',409);}
   else{if(!await store.getTemplate(env.DB,'maafi'))throw fail('template_unavailable',503);p=await store.createInvite(env.DB,'maafi',person.hash,data,DRAFT_ADMISSION);if(!p)throw fail('limit',429);}
   return json({id:p.id,previewUrl:'/maafi/preview/'+p.id},200,person.cookie?{'Set-Cookie':person.cookie}:{});
 }
 if(method==='POST'&&path==='/api/maafi/publish')throw fail('payments_offline',503);
 throw fail('not_found',404);
}
export async function handleMaafi(request,env={}){
 const u=new URL(request.url),p=u.pathname.replace(/\/+$/,'')||'/';
 if(!(p==='/create/maafi'||p==='/maafi/demo'||p==='/maafi/preview-frame'||p.startsWith('/maafi/preview/')||p.startsWith('/api/maafi/')))return null;
 try{return await route(request,env,p,u);}catch(e){return json({error:e?.status?(e.code||'validation'):'server_error'},e?.status||500);}
}
