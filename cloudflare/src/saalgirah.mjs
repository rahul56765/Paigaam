/** Unrouted Saalgirah preview adapter. No checkout or publication path exists.
 * Original schema, wizard and artwork are pure modules; do not import routes.
 * D1 is the fresh Cloudflare store, never the legacy database.
 */
import schema from '../../templates/saalgirah/schema.js';
import renderer from '../../templates/saalgirah/render.js';
import builder from '../../pages/saalgirahCreate.js';
import * as store from './store.mjs';
import { DRAFT_ADMISSION } from './admission-policy.mjs';
import { fail, identity, assertOrigin, readJSON, json, html } from './security.mjs';

export const DEMO = Object.freeze({
  recipientName: 'Meher', senderName: 'Rahul',
  line1: 'I was going to write something normal…',
  line2: 'but you’re not exactly a normal person to me.',
  line3: 'So… I made you this.',
  attentionLine: 'Okay… now that I have your attention.', wishLine: '',
  closingLine: 'I LOVE YOU.',
  note: 'Thank you for every ordinary day you make feel like something.',
});
const ID = /^[a-f0-9]{18}$/;
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'";
const NOTICE = '<aside role="status" style="padding:8px 20px;background:#5b1725;color:white;text-align:center;font:12px/1.45 system-ui">Cloudflare preview · Publishing and payments are unavailable. Draft saving is disabled by default.</aside>';
const output = markup => html(markup, 200, { 'Content-Security-Policy': CSP });

// Retain the original wizard and IDs, but remove checkout and lock the button
// even if the original script later tries to re-enable it. Never embed stored
// customer data in the original wizardBoot: its original escaping is unsafe.
function wizard(opts) {
  let page = builder.saalgirahCreatePage(opts)
    .replace(/<script[^>]+src="\/js\/(?:paigaam-pay|creator-coupon)\.js[^>]*><\/script>/g, '')
    .replace(/<button type="button" id="publish" class="button publish">[\s\S]*?<\/button>/, '<button type="button" id="publish" class="button publish" disabled aria-disabled="true">Publishing unavailable</button>')
    .replace(/<p class="hint">(?:Secure payment via Razorpay|Free\. The link stays live;)[\s\S]*?<\/p>/, '<p class="hint">Publishing and payment are unavailable in this preview.</p>')
    .replace(/(<body\b[^>]*>)/i, '$1' + NOTICE);
  const guard = `<script>(function(){function lock(){var b=document.getElementById('publish');if(b){if(!b.disabled)b.disabled=true;b.setAttribute('aria-disabled','true');if(b.textContent!=='Publishing unavailable')b.textContent='Publishing unavailable';}}document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('#publish')){e.preventDefault();e.stopImmediatePropagation();}},true);document.addEventListener('DOMContentLoaded',function(){lock();new MutationObserver(lock).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});});})();</script>`;
  return page.replace('</body>', guard + '</body>');
}
function storage(env) { if (!env.DB) throw fail('storage_unavailable', 503); }
async function owned(env, id, person) {
  if (typeof id !== 'string' || !ID.test(id)) throw fail('not_found', 404);
  const invite = await store.getInvite(env.DB, id);
  if (!invite || invite.template_slug !== 'saalgirah') throw fail('not_found', 404);
  if (!person.hash || person.hash !== invite.owner_hash) throw fail('forbidden', 403);
  return invite;
}
async function route(request, env, path, url) {
  const method = request.method;
  if (method === 'POST') assertOrigin(request);
  if (method === 'GET' && path === '/saalgirah/demo')
    return output(renderer.renderLetter({ customer_data: DEMO }, { baseUrl: url.origin, isPreview: true }));
  if (method === 'GET' && path === '/create/saalgirah') {
    const template = env.DB ? await store.getTemplate(env.DB, 'saalgirah') : null;
    // Current D1 catalog has neither legacy status nor list_price or resume API.
    return output(wizard({ price: template ? template.price / 100 : 0, listPrice: 0 }));
  }
  if (method === 'GET' && path === '/saalgirah/preview-frame') {
    const raw = url.searchParams.get('d') || '{}';
    if (new TextEncoder().encode(raw).length > 16384) throw fail('too_large', 413);
    let data;
    try { data = schema.validate(JSON.parse(raw)); } catch { data = schema.validate(DEMO); }
    return output(renderer.renderLetter({ customer_data: data }, { baseUrl: url.origin, isPreview: true }));
  }
  const match = path.match(/^\/saalgirah\/preview\/([^/]+)$/);
  if (method === 'GET' && match) {
    storage(env);
    const invite = await owned(env, match[1], await identity(request));
    return output(renderer.renderLetter({ customer_data: invite.customer_data }, { baseUrl: url.origin, isPreview: true }));
  }
  if (method === 'POST' && path === '/api/saalgirah/draft') {
    if (env.DRAFTS_ENABLED !== 'true') throw fail('drafts_offline', 503);
    storage(env);
    const body = await readJSON(request, 16384);
    const data = schema.validate(body.customer_data);
    const person = await identity(request, !body.id);
    let invite;
    if (body.id) {
      invite = await owned(env, body.id, person);
      if (invite.status !== 'draft') throw fail('draft_locked', 409);
      invite = await store.updateInvite(env.DB, invite.id, person.hash, data);
      if (!invite) throw fail('draft_locked', 409);
    } else {
      if (!await store.getTemplate(env.DB, 'saalgirah')) throw fail('template_unavailable', 503);
      invite = await store.createInvite(env.DB, 'saalgirah', person.hash, data, DRAFT_ADMISSION);
      if (!invite) throw fail('limit', 429);
    }
    return json({ id: invite.id, previewUrl: '/saalgirah/preview/' + invite.id }, 200,
      person.cookie ? { 'Set-Cookie': person.cookie } : {});
  }
  if (method === 'POST' && path === '/api/saalgirah/publish') {
    await readJSON(request, 16384);
    throw fail('payments_offline', 503);
  }
  throw fail('not_found', 404);
}
/** handleSaalgirah(request: Request, env?: { DB, DRAFTS_ENABLED }) -> Promise<Response|null>.
 * null means unrelated path; matching namespace but unsupported route returns 404.
 */
export async function handleSaalgirah(request, env = {}) {
  const url = new URL(request.url), path = url.pathname.replace(/\/+$/, '') || '/';
  if (!(path === '/create/saalgirah' || path.startsWith('/create/saalgirah/') ||
        path === '/saalgirah' || path.startsWith('/saalgirah/') ||
        path === '/api/saalgirah' || path.startsWith('/api/saalgirah/'))) return null;
  try { return await route(request, env, path, url); }
  catch (e) { return json({ error: e?.status ? (e.code || 'validation') : 'server_error' }, e?.status || 500); }
}
