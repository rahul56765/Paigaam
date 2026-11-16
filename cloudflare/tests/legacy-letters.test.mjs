import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
import { letters } from '../src/legacy-letters.mjs';
import { list } from '../src/catalog.generated.mjs';
import * as store from '../src/store.mjs';
import { D1 } from './d1-shim.mjs';
import { TEST_IP, TEST_RATE_KEY } from './rate-fixtures.mjs';
const origin='https://preview.example';
function post(path,body,cookie){return new Request(origin+path,{method:'POST',headers:{Origin:origin,'CF-Connecting-IP':TEST_IP,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});}
async function fixture(t){
  const DB=new D1();t.after(()=>DB.raw.close());
  await store.seedTemplates(DB,[...list,...letters].map(t=>({slug:t.slug,name:t.config.name,price:Math.round((t.config.price||0)*100),currency:'INR',config:t.config})));
  t.mock.method(globalThis,'fetch',async()=>{throw Error('No external gateway calls allowed');});
  return {DB,MEDIA:{},DRAFTS_ENABLED:'true',FREE_PUBLISH_ENABLED:'true',LEGACY_LETTERS_ENABLED:'true',RATE_LIMIT_HMAC_KEY:TEST_RATE_KEY};
}
async function draft(env,t){
  const r=await worker.fetch(post('/api/'+t.route+'/draft',{customer_data:{recipientName:'Ananya',senderName:'Rahul'}}),env);
  assert.equal(r.status,200,await r.clone().text());
  return {...await r.json(),cookie:r.headers.get('set-cookie').split(';')[0]};
}
for(const letter of letters){
 test(letter.slug+': original customizer, preview, free publication and owner replay',async t=>{
  const env=await fixture(t);
  const page=await worker.fetch(new Request(origin+'/create/'+letter.slug),env);
  assert.equal(page.status,200);const markup=await page.text();
  assert.match(markup,/id="publish"/);assert.match(markup,/cloudflare-letter-bridge\.js/);
  assert.doesNotMatch(markup,/<script[^>]+src="\/js\/(?:paigaam-pay|creator-coupon)\.js/);
  const d=await draft(env,letter);
  assert.match(d.snapshot,/^[a-f0-9]{64}$/);
  let response=await worker.fetch(new Request(origin+d.previewUrl,{headers:{Cookie:d.cookie}}),env);
  assert.equal(response.status,200);assert.ok((await response.text()).includes('Ananya'));
  const publish=()=>worker.fetch(post('/api/'+letter.route+'/publish',{id:d.id,expected_snapshot:d.snapshot},d.cookie),env);
  const requests=await Promise.all(Array.from({length:6},publish));
  assert.ok(requests.every(r=>r.status===200));
  const results=await Promise.all(requests.map(r=>r.json()));
  assert.ok(results.every(r=>r.url===results[0].url));
  response=await worker.fetch(new Request(results[0].url),env);
  assert.equal(response.status,200);assert.ok((await response.text()).includes('Ananya'));
  assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM orders').get().n,0);
  assert.equal(env.DB.raw.prepare("SELECT count(*) n FROM invites WHERE status='published'").get().n,1);
  // Lost response, unchanged retry: save must not attempt to edit publication.
  response=await worker.fetch(post('/api/'+letter.route+'/draft',{id:d.id,customer_data:{recipientName:'Ananya',senderName:'Rahul'}},d.cookie),env);
  assert.equal(response.status,200);assert.equal((await response.json()).snapshot,d.snapshot);
 });
 test(letter.slug+': owner, quote, flags, origin and expected snapshot fail closed',async t=>{
  const env=await fixture(t),d=await draft(env,letter),path='/api/'+letter.route+'/publish';
  let r=await worker.fetch(post(path,{id:d.id,expected_snapshot:d.snapshot}),env);
  assert.equal(r.status,403);
  r=await worker.fetch(post(path,{id:d.id},d.cookie),env);
  assert.equal(r.status,409);assert.equal((await r.json()).error,'draft_changed');
  r=await worker.fetch(post(path,{id:d.id,expected_snapshot:d.snapshot},d.cookie),{...env,FREE_PUBLISH_ENABLED:'false'});
  assert.equal(r.status,503);
  r=await worker.fetch(new Request(origin+path,{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'}),env);
  assert.equal(r.status,403);
  env.DB.raw.prepare('UPDATE templates SET price=100 WHERE slug=?').run(letter.slug);
  r=await worker.fetch(post(path,{id:d.id,expected_snapshot:d.snapshot},d.cookie),env);
  assert.equal(r.status,503);assert.equal((await store.getInvite(env.DB,d.id)).status,'draft');
  assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM orders').get().n,0);
 });
}
test('legacy text routes remain staged, reject updates from another tab, and appear in the catalogue only when explicitly enabled',async t=>{
 const env=await fixture(t),letter=letters[0],d=await draft(env,letter);
 let r=await worker.fetch(post('/api/maafi/draft',{id:d.id,customer_data:{recipientName:'Changed',senderName:'Rahul'}},d.cookie),env);
 assert.equal(r.status,200);const latest=await r.json();assert.notEqual(latest.snapshot,d.snapshot);
 r=await worker.fetch(post('/api/maafi/publish',{id:d.id,expected_snapshot:d.snapshot},d.cookie),env);
 assert.equal(r.status,409);assert.equal((await store.getInvite(env.DB,d.id)).status,'draft');
 r=await worker.fetch(post('/api/maafi/draft',{customer_data:{recipientName:'Ananya'}},d.cookie),{...env,LEGACY_LETTERS_ENABLED:undefined});
 assert.equal(r.status,404);
 const gallery=await (await worker.fetch(new Request(origin+'/templates/maafi'),env)).text();
 assert.match(gallery,/href="\/create\/maafi"/);
 const locked=await worker.fetch(new Request(origin+'/create/maafi'),{...env,DRAFTS_ENABLED:'false'});
 assert.equal(locked.status,503);
});
