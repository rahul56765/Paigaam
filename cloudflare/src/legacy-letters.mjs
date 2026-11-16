// Original text-only customizers backed by the fresh Cloudflare store.
// Staged behind LEGACY_LETTERS_ENABLED; no legacy database is imported.
import * as store from './store.mjs';
import { fail, hash, identity, readJSON, assertOrigin, html, json, randomHex } from './security.mjs';
import { enforceRequestRate, rateLimiterReady } from './request-rate.mjs';
import { DRAFT_ADMISSION } from './admission-policy.mjs';
import maafiSchema from '../../templates/maafi/schema.js';
import maafiRender from '../../templates/maafi/render.js';
import maafiConfig from '../../templates/maafi/config.js';
import maafiBuilder from '../../pages/maafiCreate.js';
import saalSchema from '../../templates/saalgirah/schema.js';
import saalRender from '../../templates/saalgirah/render.js';
import saalConfig from '../../templates/saalgirah/config.js';
import saalBuilder from '../../pages/saalgirahCreate.js';
import lavenderSchema from '../../templates/lavender-bloom/schema.js';
import lavenderRender from '../../templates/lavender-bloom/render.js';
import lavenderConfig from '../../templates/lavender-bloom/config.js';
import lavenderBuilder from '../../pages/lavenderCreate.js';
import valentineSchema from '../../templates/valentine-say-yes/schema.js';
import valentineRender from '../../templates/valentine-say-yes/render.js';
import valentineConfig from '../../templates/valentine-say-yes/config.js';
import valentineBuilder from '../../pages/valentineCreate.js';
import awaitsSchema from '../../templates/love-awaits/schema.js';
import awaitsRender from '../../templates/love-awaits/render.js';
import awaitsConfig from '../../templates/love-awaits/config.js';
import awaitsBuilder from '../../pages/loveAwaitsCreate.js';

export const letters = [
  { slug:'maafi', route:'maafi', schema:maafiSchema, render:maafiRender.renderMaafi, config:maafiConfig, builder:maafiBuilder.maafiCreatePage },
  { slug:'saalgirah', route:'saalgirah', schema:saalSchema, render:saalRender.renderLetter, config:saalConfig, builder:saalBuilder.saalgirahCreatePage },
  { slug:'lavender-tic-tac-toe-bloom', route:'lavender-bloom', schema:lavenderSchema, render:lavenderRender.renderBloom, config:lavenderConfig, builder:lavenderBuilder.lavenderCreatePage },
  { slug:'valentine-say-yes', route:'valentine-say-yes', schema:valentineSchema, render:valentineRender.renderValentine, config:valentineConfig, builder:valentineBuilder.valentineCreatePage },
  { slug:'love-awaits', route:'love-awaits', schema:awaitsSchema, render:awaitsRender.renderAwaits, config:awaitsConfig, builder:awaitsBuilder.loveAwaitsCreatePage },
];
const find = slug => letters.find(t=>t.slug===slug||t.route===slug);
export function letterCatalog(source,env) {
  if(env.LEGACY_LETTERS_ENABLED!=='true')return source;
  return source.map(t=>find(t.slug)?{...t,supported:true,portStatus:{supported:true}}:t);
}
const ID=/^[a-f0-9]{18}$/;
function ready(env) { if(!env.DB||env.DRAFTS_ENABLED!=='true')throw fail('drafts_offline',503); }
async function owned(env,id,person,t) {
  if(!ID.test(id||''))throw fail('not_found',404);
  const pg=await store.getInvite(env.DB,id);
  if(!pg||pg.template_slug!==t.slug)throw fail('not_found',404);
  if(!person.hash||pg.owner_hash!==person.hash)throw fail('forbidden',403);
  return pg;
}
const snapshot = data=>hash(JSON.stringify(data));
const result = (pg,origin)=>({slug:pg.public_slug,url:origin+'/p/'+pg.public_slug});
const digest = pg=>snapshot(pg.customer_data);
function render(t,pg,origin,preview) {
  return t.render({id:pg.id,slug:pg.public_slug,customer_data:pg.customer_data},{baseUrl:origin,isPreview:preview});
}
async function wizard(t,env) {
  ready(env);
  const quote=await store.getTemplate(env.DB,t.slug);
  if(!quote||quote.price!==0||env.FREE_PUBLISH_ENABLED!=='true'||!await rateLimiterReady(env))throw fail('template_unavailable',503);
  // Original UI and field IDs. Paid scripts are excluded from this free view.
  let page=t.builder({price:0,listPrice:0});
  page=page.replace(/<script[^>]+src="\/js\/(?:paigaam-pay|creator-coupon|welcome-back)\.js[^>]*><\/script>\s*/g,'');
  page=page.replace(/<section class="pc-inline-checkout[\s\S]*?<\/section>/g,'');
  return page.replace(/(<head\b[^>]*>)/i,'$1<script src="/js/cloudflare-letter-bridge.js?release=20261117"></script>');
}
export async function handleLetters(request,env) {
  if(env.LEGACY_LETTERS_ENABLED!=='true')return null;
  const u=new URL(request.url),p=u.pathname.replace(/\/+$/,'')||'/',origin=u.origin;
  let t,m,pg;
  // Public reads reuse the original renderer and preserve its per-link slug.
  if(request.method==='GET'&&(m=/^\/p\/([a-z0-9-]+)$/.exec(p))) {
    if(!env.DB)return null;
    pg=await store.getInviteByPublicSlug(env.DB,m[1]);t=pg&&find(pg.template_slug);
    return t?html(render(t,pg,origin,false)):null;
  }
  if(request.method==='GET'&&(m=/^\/create\/([a-z0-9-]+)$/.exec(p))&&(t=find(m[1])))return html(await wizard(t,env));
  if((m=/^\/([a-z0-9-]+)\/(demo|preview-frame|preview\/([a-f0-9]{18}))$/.exec(p))&&(t=find(m[1]))) {
    if(request.method==='GET'&&m[2]==='demo')return html(render(t,{customer_data:{recipientName:'Meher',senderName:'Rahul'}},origin,true));
    if(m[2]==='preview-frame'&&['GET','POST'].includes(request.method)) {
      if(request.method==='POST')assertOrigin(request);
      if(env.DRAFTS_ENABLED==='true')await enforceRequestRate(request,env,'preview_post');
      let data;
      if(request.method==='POST')data=(await readJSON(request,16384)).customer_data;
      else {const raw=u.searchParams.get('d')||'{}';if(new TextEncoder().encode(raw).length>16384)throw fail('too_large',413);try{data=JSON.parse(raw);}catch{data={};}}
      // Source renderers already apply their field whitelist and escaping.
      return html(render(t,{customer_data:t.schema.validate(data)},origin,true));
    }
    if(request.method==='GET'&&m[3]) {
      ready(env);pg=await owned(env,m[3],await identity(request),t);
      return html(render(t,pg,origin,true));
    }
    throw fail('not_found',404);
  }
  if(!(m=/^\/api\/([a-z0-9-]+)\/(draft|publish)$/.exec(p))||!(t=find(m[1])))return null;
  if(request.method!=='POST')throw fail('not_found',404);
  assertOrigin(request);ready(env);
  const body=await readJSON(request,16384),action=m[2];
  await enforceRequestRate(request,env,action==='publish'?'publish':body.id?'draft_update':'draft_create');
  const person=await identity(request,action==='draft'&&!body.id);
  if(action==='draft') {
    const data=t.schema.validate(body.customer_data);
    const quote=await store.getTemplate(env.DB,t.slug);if(!quote)throw fail('template_unavailable',503);
    if(body.id) {
      pg=await owned(env,body.id,person,t);
      // A lost publish response can be retried without attempting to edit the
      // published invitation. Different content remains locked.
      if(pg.status==='published') {
        if(JSON.stringify(pg.customer_data)!==JSON.stringify(data))throw fail('draft_locked',409);
      } else {
        pg=await store.updateInvite(env.DB,pg.id,person.hash,data);if(!pg)throw fail('draft_locked',409);
      }
    } else {
      pg=await store.createInvite(env.DB,t.slug,person.hash,data,DRAFT_ADMISSION);if(!pg)throw fail('limit',429);
    }
    return json({id:pg.id,previewUrl:'/'+t.route+'/preview/'+pg.id,snapshot:await digest(pg)},200,person.cookie?{'Set-Cookie':person.cookie}:{});
  }
  if(env.FREE_PUBLISH_ENABLED!=='true')throw fail('free_publish_not_enabled',503);
  pg=await owned(env,body.id,person,t);
  if(body.expected_snapshot!==await digest(pg))throw fail('draft_changed',409);
  const data=t.schema.validate(pg.customer_data);
  if(JSON.stringify(data)!==JSON.stringify(pg.customer_data))throw fail('validation');
  const replay=await store.getFreePublishedInvite(env.DB,pg.id,person.hash,t.slug,data);
  if(replay)return json(result(replay,origin));
  const quote=await store.getTemplate(env.DB,t.slug);if(!quote||quote.price!==0)throw fail('payments_offline',503);
  if(pg.status!=='draft')throw fail('draft_locked',409);
  for(let i=0;i<5;i++) {
    const slug=t.slug+'-free-'+randomHex(24);
    const published=await store.publishFree(env.DB,pg.id,person.hash,t.slug,data,slug);
    if(published)return json(result(published,origin));
    const winner=await store.getFreePublishedInvite(env.DB,pg.id,person.hash,t.slug,data);
    if(winner)return json(result(winner,origin));
    if(!await store.getInviteByPublicSlug(env.DB,slug))throw fail('free_publish_conflict',409);
  }
  throw fail('slug_unavailable',503);
}
