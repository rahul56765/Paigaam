import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { D1 } from './d1-shim.mjs';
import { handleAdmin } from '../src/admin.mjs';

const origin = 'https://paigaam.example';
const salt = Uint8Array.from({ length: 16 }, (_, i) => i + 1);
const password = 'fixture only — not a default credential';
const key = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
const hash = Buffer.from(await webcrypto.subtle.deriveBits({ name:'PBKDF2', hash:'SHA-256', iterations:600000, salt }, key, 256)).toString('hex');
const verifier = `pbkdf2-sha256$600000$${Buffer.from(salt).toString('hex')}$${hash}`;
function fixture(t) {
  const db = new D1(); t.after(() => db.raw.close());
  db.raw.exec(readFileSync(new URL('../migrations/0002_admin.sql', import.meta.url),'utf8'));
  db.raw.prepare('INSERT INTO templates (slug,name,price,currency) VALUES (?,?,?,?)').run('rose', 'Rose <script>alert(1)</script>', 19900, 'INR');
  return { DB:db, ADMIN_USERNAME:'owner@example.test', ADMIN_PASSWORD_VERIFIER:verifier, ADMIN_ORIGIN:origin };
}
function req(path, { method='GET', cookie, data, originHeader=origin, extra={} } = {}) {
  const h = new Headers(extra); if (cookie) h.set('cookie',cookie);
  if (method === 'POST') { if (originHeader !== null) h.set('origin',originHeader); h.set('content-type','application/x-www-form-urlencoded'); }
  return new Request(origin + path, { method, headers:h, ...(method === 'POST' ? { body:new URLSearchParams(data || {}) } : {}) });
}
async function signIn(env, username='owner@example.test', pass=password) {
  return handleAdmin(req('/admin/login', { method:'POST', data:{ email:username, password:pass } }),env);
}
async function authenticated(env) {
  const r = await signIn(env); assert.equal(r.status,303); return r.headers.get('set-cookie').split(';')[0];
}
async function csrf(env, cookie) {
  const r = await handleAdmin(req('/admin/templates',{cookie}),env); assert.equal(r.status,200);
  return (await r.text()).match(/name="csrf" value="([a-f0-9]{64})"/)[1];
}
function post(path,cookie,token,fields={}) { return req(path,{method:'POST',cookie,data:{csrf:token,...fields}}); }

test('fail closed when any configuration, HTTPS origin, or migration is absent or invalid', async t => {
  const e = fixture(t);
  assert.equal(await handleAdmin(req('/templates'),e),null);
  for (const altered of [
    {ADMIN_USERNAME:undefined}, {ADMIN_USERNAME:''}, {ADMIN_PASSWORD_VERIFIER:undefined},
    {ADMIN_PASSWORD_VERIFIER:verifier.replace('600000','100000')},
    {ADMIN_PASSWORD_VERIFIER:'plaintext'}, {ADMIN_ORIGIN:undefined},
    {ADMIN_ORIGIN:origin+'/'}, {ADMIN_ORIGIN:'http://paigaam.example'}, {DB:null}
  ]) assert.equal((await handleAdmin(req('/admin/login'),{...e,...altered})).status,503);
  assert.equal((await handleAdmin(new Request('http://paigaam.example/admin/login'),e)).status,503);
  const unmigrated = new D1(); t.after(() => unmigrated.raw.close());
  assert.equal((await handleAdmin(req('/admin/login'),{...e,DB:unmigrated})).status,503);
  assert.equal((await handleAdmin(req('/admin/login'),{...e,DB:{prepare(){throw Error('outage')}}})).status,503);
});

test('wrong username and password indistinguishable; durable global limit survives requests and resets only on expiry', async t => {
  const e = fixture(t);
  const a = await signIn(e, 'nobody@example.test'); const b = await signIn(e,'owner@example.test','bad');
  assert.equal(a.status,401); assert.equal(b.status,401); assert.equal(await a.text(),await b.text());
  for (let i=0;i<3;i++) assert.equal((await signIn(e,'x','bad')).status,401);
  const blocked = await signIn(e); assert.equal(blocked.status,429); assert.equal(blocked.headers.get('set-cookie'),null);
  assert.equal(e.DB.raw.prepare("SELECT attempts FROM admin_login_limits WHERE bucket='global'").get().attempts,6);
  e.DB.raw.exec('UPDATE admin_login_limits SET window_until=0');
  assert.equal((await signIn(e)).status,303);
  assert.equal(e.DB.raw.prepare("SELECT attempts FROM admin_login_limits WHERE bucket='global'").get().attempts,1);
});

test('login cookies are host-bound, secret token is hashed in D1, overview protected, expiry and credential rotation invalidate sessions', async t => {
  const e = fixture(t);
  assert.equal((await handleAdmin(req('/admin'),e)).status,303);
  const r = await signIn(e); assert.equal(r.status,303);
  const set = r.headers.get('set-cookie');
  assert.match(set,/^__Host-paigaam_admin=[a-f0-9]{64}; Path=\//);
  for (const part of ['HttpOnly','Secure','SameSite=Strict','Max-Age=28800']) assert.ok(set.includes(part));
  const cookie = set.split(';')[0], token = cookie.split('=')[1];
  const row=e.DB.raw.prepare('SELECT * FROM admin_sessions').get();
  assert.notEqual(row.token_hash,token); assert.equal(row.token_hash.length,64);
  const page=await handleAdmin(req('/admin',{cookie}),e); assert.equal(page.status,200);
  const body=await page.text(); assert.match(body,/Your Paigaam, in good order/); assert.match(body,/fresh cloudflare data only/i);
  assert.equal(page.headers.get('cache-control'),'private, no-store, max-age=0');
  assert.equal((await handleAdmin(req('/admin',{cookie:cookie+'; '+cookie}),e)).status,303);
  assert.equal((await handleAdmin(req('/admin',{cookie}),{...e,ADMIN_USERNAME:'different'})).status,303);
  e.DB.raw.exec('UPDATE admin_sessions SET expires_at=0');
  assert.equal((await handleAdmin(req('/admin',{cookie}),e)).status,303);
});

test('origin and session-bound CSRF are mandatory for price and logout; POST logout invalidates session', async t => {
  const e=fixture(t), cookie=await authenticated(e), token=await csrf(e,cookie);
  for (const badOrigin of [null,'https://evil.example']) {
    assert.equal((await handleAdmin(req('/admin/login',{method:'POST',originHeader:badOrigin,data:{email:e.ADMIN_USERNAME,password}}),e)).status,403);
    assert.equal((await handleAdmin(req('/admin/templates/rose/price',{method:'POST',cookie,originHeader:badOrigin,data:{csrf:token,price:'100'}}),e)).status,403);
  }
  assert.equal((await handleAdmin(req('/admin/templates/rose/price',{method:'POST',cookie,extra:{'sec-fetch-site':'cross-site'},data:{csrf:token,price:'100'}}),e)).status,403);
  assert.equal((await handleAdmin(post('/admin/templates/rose/price',cookie,'0'.repeat(64),{price:'100'}),e)).status,403);
  assert.equal((await handleAdmin(post('/admin/logout',cookie,'bad'),e)).status,403);
  assert.equal((await handleAdmin(req('/admin/logout',{cookie}),e)).status,404);
  assert.equal(e.DB.raw.prepare('SELECT price FROM templates').get().price,19900);
  const out=await handleAdmin(post('/admin/logout',cookie,token),e);
  assert.equal(out.status,303); assert.match(out.headers.get('set-cookie'),/Max-Age=0/);
  assert.equal(e.DB.raw.prepare('SELECT count(*) AS n FROM admin_sessions').get().n,0);
  assert.equal((await handleAdmin(req('/admin',{cookie}),e)).status,303);
});

test('template listing escapes data; price updates only valid integer paise via guarded SQL, injection fails', async t => {
  const e=fixture(t), cookie=await authenticated(e), token=await csrf(e,cookie);
  const page=await (await handleAdmin(req('/admin/templates',{cookie}),e)).text();
  assert.match(page,/Rose &lt;script&gt;/); assert.doesNotMatch(page,/<script>alert/);
  assert.doesNotMatch(page,/Duplicate|Delete|New template|Publish/);
  for (const price of ['-1','1.5','1e4','001','100000001','0; DROP TABLE templates','', '99999999999999999']) {
    assert.equal((await handleAdmin(post('/admin/templates/rose/price',cookie,token,{price}),e)).status,400,price);
    assert.equal(e.DB.raw.prepare('SELECT price FROM templates').get().price,19900);
  }
  assert.equal((await handleAdmin(post('/admin/templates/rose/price',cookie,token,{price:'25001'}),e)).status,303);
  assert.equal(e.DB.raw.prepare('SELECT price FROM templates').get().price,25001);
  e.DB.raw.prepare('INSERT INTO templates (slug,name,price,currency) VALUES (?,?,?,?)').run('foreign', 'Foreign', 500, 'USD');
  assert.equal((await handleAdmin(post('/admin/templates/foreign/price',cookie,token,{price:'1'}),e)).status,404);
  assert.equal(e.DB.raw.prepare("SELECT price FROM templates WHERE slug='foreign'").get().price,500);
  assert.equal((await handleAdmin(post('/admin/templates/not-there/price',cookie,token,{price:'1'}),e)).status,404);
  assert.equal((await handleAdmin(post('/admin/templates/rose%27%20OR%201%3D1/price',cookie,token,{price:'1'}),e)).status,404);
  assert.equal(e.DB.raw.prepare("SELECT price FROM templates WHERE slug='rose'").get().price,25001);
  assert.equal((await handleAdmin(post('/admin/templates/rose/price',null,token,{price:'1'}),e)).status,303);
});

test('rate-limit or session write failure is closed; form duplicate input rejected', async t => {
  const e=fixture(t);
  const original=e.DB.prepare.bind(e.DB);
  e.DB.prepare = sql => sql.includes('INSERT INTO admin_login_limits') ? {bind(){return {first(){throw Error('DB failure')}}}} : original(sql);
  assert.equal((await signIn(e)).status,503);
  e.DB.prepare = original;
  const bad = new Request(origin+'/admin/login',{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:'email=a&email=b&password=x'});
  assert.equal((await handleAdmin(bad,e)).status,401);
  e.DB.prepare = sql => sql.includes('INSERT INTO admin_sessions') ? {bind(){return {run(){return {success:false}}}}} : original(sql);
  const r=await signIn(e); assert.equal(r.status,503); assert.equal(r.headers.get('set-cookie'),null);
});

test('unsupported runtime PBKDF2 work factor fails closed without issuing a session', async t => {
  const e=fixture(t), original=crypto.subtle.deriveBits;
  crypto.subtle.deriveBits = async () => { throw new Error('Unsupported work factor'); };
  try {
    const r=await signIn(e); assert.equal(r.status,503); assert.equal(r.headers.get('set-cookie'),null);
    assert.equal(e.DB.raw.prepare('SELECT count(*) AS n FROM admin_sessions').get().n,0);
  } finally { crypto.subtle.deriveBits = original; }
});
