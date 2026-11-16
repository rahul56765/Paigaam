import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scryptSync} from 'node:crypto';
import {D1} from './d1-shim.mjs';
import {handleCreatorAuth,createPasswordVerifier,verifyLegacyPassword} from '../src/creator-auth.mjs';
const origin='https://example.test', pw='password-for-creator';
const salt='abcdef0123456789abcdef0123456789abcdef0123456789';
const oldHash='145cd965db0dd8f0bf4edbbee94bdd26c22382c6873bcbb9f9e2cd80ee8c34f97168138b35b47bc9c8b2aea9f04b66eb4989ddfb5d75d282def1904ff60f5e8c';
const modernHash='9f48fb6f6b4ae7b15a1c1eccca0ae711055165986c59e6767c6480c1280cab2a34db0b61adcb9ed0b4576482d1f7fcfd7478be0a11659e112e6ce479719adc9a';
function setup() {
 const db=new D1(); for(const m of ['0002_admin.sql','0003_creators.sql','0005_creator_auth.sql']) db.raw.exec(readFileSync(new URL('../migrations/'+m,import.meta.url),'utf8'));
 db.raw.prepare("INSERT INTO creator_accounts(id,username,display_name,commission_bps,active,actor) VALUES('a','alice','Alice',1000,1,'admin'),('d','disabled','Disabled',1000,0,'admin')").run();
 const put=db.raw.prepare('INSERT INTO creator_credentials VALUES(?,?,?,?,?,?)');
 put.run('a','scrypt-v1',salt,modernHash,'version1',Date.now()); put.run('d','scrypt-v1',salt,modernHash,'version2',Date.now());
 const env={DB:db,CREATOR_AUTH_ENABLED:'true',CREATOR_AUTH_TRUST_CF_CONNECTING_IP:'true',CREATOR_AUTH_ORIGIN:origin,CREATOR_AUTH_RATE_KEY:Buffer.alloc(32,42).toString('base64url')}; return {db,env};
}
function call(env,route,{method='GET',headers={},body,path='/creator/login'}={}) { return handleCreatorAuth(new Request(origin+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env,route); }
function extractCookie(r) {return r.headers.get('set-cookie').split(';')[0];}
async function form(env){const r=await call(env,'login-form');return {cookie:extractCookie(r),csrf:(await r.json()).csrf};}
async function login(env,user='alice',pass=pw,ip='192.0.2.1') { const f=await form(env);const r=await call(env,'login',{method:'POST',headers:{origin,cookie:f.cookie,'x-csrf-token':f.csrf,'cf-connecting-ip':ip,'content-type':'application/json'},body:{username:user,password:pass}});return r; }
async function signed(env) {const r=await login(env);assert.equal(r.status,200);const value=await r.json();return {cookie:extractCookie(r),csrf:value.csrf};}
function post(env,route,s,body={},extra={}) {return call(env,route,{method:'POST',headers:{origin,cookie:s.cookie,'x-csrf-token':s.csrf,'content-type':'application/json',...extra},body});}

test('fixed synthetic legacy and OWASP-profile scrypt vectors, random salt and input bounds',()=>{
 assert.equal(verifyLegacyPassword(pw,salt,oldHash),true); assert.equal(verifyLegacyPassword('wrong-password',salt,oldHash),false);
 assert.equal(verifyLegacyPassword(pw,salt.toUpperCase(),oldHash),false);
 assert.equal(scryptSync(pw,Buffer.from(salt,'hex'),64,{N:16384,r:8,p:5,maxmem:64*1024*1024}).toString('hex'),modernHash);
 const a=createPasswordVerifier(pw), b=createPasswordVerifier(pw); assert.notEqual(a.salt,b.salt); assert.notEqual(a.version,b.version);
 assert.throws(()=>createPasswordVerifier('short')); assert.throws(()=>createPasswordVerifier('x'.repeat(257)));
});
test('feature and origin configuration fail closed, no inferred forwarded IP',async()=>{
 const {env}=setup();
 for(const patch of [{CREATOR_AUTH_ENABLED:'false'},{CREATOR_AUTH_TRUST_CF_CONNECTING_IP:'false'},{DB:null},{CREATOR_AUTH_ORIGIN:'http://example.test'},{CREATOR_AUTH_ORIGIN:'https://example.test/'},{CREATOR_AUTH_RATE_KEY:'bad'}]) assert.equal((await call({...env,...patch},'login-form')).status,503);
 const f=await form(env); const r=await call(env,'login',{method:'POST',headers:{origin,cookie:f.cookie,'x-csrf-token':f.csrf,'x-forwarded-for':'192.0.2.1','content-type':'application/json'},body:{username:'alice',password:pw}});assert.equal(r.status,503);
});
test('login cookie, origin and login-CSRF; unknown, disabled and bad password are indistinguishable',async()=>{
 const {env}=setup();const f=await form(env);assert.match(f.cookie,/^pg_partner_login_csrf=/);assert.match(f.csrf,/^\d{13}\.[A-Za-z0-9_-]{43}\.[a-f0-9]{64}$/);
 assert.equal((await call(env,'login',{method:'POST',headers:{origin:'https://evil.test',cookie:f.cookie,'x-csrf-token':f.csrf,'cf-connecting-ip':'192.0.2.1','content-type':'application/json'},body:{username:'alice',password:pw}})).status,403);
 assert.equal((await call(env,'login',{method:'POST',headers:{origin,cookie:f.cookie,'x-csrf-token':'wrong','cf-connecting-ip':'192.0.2.1','content-type':'application/json'},body:{username:'alice',password:pw}})).status,403);
 const outputs=[];for(const [u,p] of [['alice','wrong-password'],['nobody',pw],['disabled',pw],['!!!',pw],['alice','x'.repeat(300)]]) {const r=await login(env,u,p);outputs.push([r.status,await r.text()]);} assert.ok(outputs.every(x=>x[0]===401 && x[1]===outputs[0][1]));
});
test('session validation, expiry, CSRF and logout revocation',async()=>{
 const {db,env}=setup();assert.equal((await call(env,'session')).status,401);
 let s=await signed(env); const r=await call(env,'session',{headers:{cookie:s.cookie}});assert.equal(r.status,200);assert.equal((await r.json()).creator_id,'a');
 const raw=(await login(env)).headers.get('set-cookie');assert.match(raw,/Secure/);assert.match(raw,/HttpOnly/);assert.match(raw,/SameSite=Strict/);assert.match(raw,/Max-Age=604800/);
 assert.equal((await post(env,'logout',s,{}, {'x-csrf-token':'wrong'})).status,403);assert.equal((await post(env,'logout',s,{}, {origin:'https://evil.test'})).status,403);
 assert.equal((await post(env,'logout',s)).status,200);assert.equal((await call(env,'session',{headers:{cookie:s.cookie}})).status,401);
 s=await signed(env);db.raw.exec('UPDATE creator_auth_sessions SET expires_at=1');assert.equal((await call(env,'session',{headers:{cookie:s.cookie}})).status,401);
});
test('password reset is atomic and revokes every session, stale versions cannot authenticate',async()=>{
 const {db,env}=setup();const s1=await signed(env),s2=await signed(env);
 assert.equal((await post(env,'password',s1,{password:'new-password-for-creator',currentPassword:pw},{'x-csrf-token':'bad'})).status,403);
 assert.equal((await post(env,'password',s1,{password:'new-password-for-creator'})).status,400);
 assert.equal((await post(env,'password',s1,{password:'new-password-for-creator',currentPassword:'incorrect-password'})).status,401);
 assert.equal((await post(env,'password',s1,{password:'new-password-for-creator',currentPassword:pw})).status,200);
 for(const s of [s1,s2]) assert.equal((await call(env,'session',{headers:{cookie:s.cookie}})).status,401);
 assert.equal(db.raw.prepare('SELECT count(*) n FROM creator_auth_sessions').get().n,0);
 assert.equal((await login(env,'alice',pw)).status,401);assert.equal((await login(env,'alice','new-password-for-creator')).status,200);
});
test('legacy verification upgrades only on success; concurrent credential change prevents stale login',async()=>{
 const {db,env}=setup();db.raw.prepare("UPDATE creator_credentials SET algorithm='legacy-scrypt-v0',salt=?,password_hash=?,version='legacy' WHERE creator_id='a'").run(salt,oldHash);
 assert.equal((await login(env,'alice','wrong-password')).status,401); assert.equal(db.raw.prepare("SELECT algorithm FROM creator_credentials WHERE creator_id='a'").get().algorithm,'legacy-scrypt-v0');
 assert.equal((await login(env)).status,200);assert.equal(db.raw.prepare("SELECT algorithm FROM creator_credentials WHERE creator_id='a'").get().algorithm,'scrypt-v1');
 db.raw.prepare("UPDATE creator_credentials SET algorithm='legacy-scrypt-v0',salt=?,password_hash=?,version='legacy2' WHERE creator_id='a'").run(salt,oldHash);
 const original=db.batch.bind(db); let raced=false;
 db.batch=async statements=>{if(!raced && statements[0].sql.startsWith('UPDATE creator_credentials')) {raced=true;db.raw.prepare("UPDATE creator_credentials SET version='reset-won' WHERE creator_id='a'").run();}return original(statements);};
 assert.equal((await login(env)).status,401);assert.equal(db.raw.prepare("SELECT version FROM creator_credentials WHERE creator_id='a'").get().version,'reset-won');assert.equal(db.raw.prepare('SELECT count(*) n FROM creator_auth_sessions').get().n,0);
});
test('durable distributed account, IP and global limits, errors fail closed',async()=>{
 const {db,env}=setup(); for(let i=0;i<5;i++) assert.equal((await login(env,'alice','wrong-password')).status,401);assert.equal((await login(env,'alice','wrong-password')).status,429);
 assert.equal(db.raw.prepare("SELECT count(*) n FROM creator_auth_rate_limits WHERE bucket LIKE 'a:%'").get().n,1);
 assert.equal(JSON.stringify(db.raw.prepare('SELECT * FROM creator_auth_rate_limits').all()).includes('alice'),false);
 db.raw.exec('DELETE FROM creator_auth_rate_limits');
 // Preseed hashed IP by making one request; then reach the cap without burning CPU.
 await login(env,'someone',pw);db.raw.exec("UPDATE creator_auth_rate_limits SET attempts=20 WHERE bucket LIKE 'i:%'");assert.equal((await login(env,'someoneelse',pw)).status,429);
 db.raw.exec("UPDATE creator_auth_rate_limits SET attempts=60 WHERE bucket='global'");assert.equal((await login(env,'another',pw,'192.0.2.2')).status,429);
 db.prepare=()=>{throw Error('D1 down')};assert.equal((await login(env)).status,503);
});
test('duplicate cookies, wrong method and malformed body fail safely',async()=>{
 const {env}=setup();const f=await form(env);assert.equal((await call(env,'login',{method:'POST',headers:{origin,cookie:`${f.cookie}; ${f.cookie}`,'x-csrf-token':f.csrf,'cf-connecting-ip':'192.0.2.1','content-type':'application/json'},body:{username:'alice',password:pw}})).status,403);
 assert.equal((await call(env,'logout')).status,404);assert.equal((await call(env,'session',{headers:{cookie:'pg_partner_session=broken'}})).status,401);
});
test('disabled account sessions fail even if a session row is present',async()=>{
 const {db,env}=setup();const t='A'.repeat(43); const {createHash}=await import('node:crypto'); const h=createHash('sha256').update(t).digest('hex');
 db.raw.prepare('INSERT INTO creator_auth_sessions VALUES(?,?,?,?,?)').run(h,'d','version2','B'.repeat(43),Date.now()+60000);
 assert.equal((await call(env,'session',{headers:{cookie:'pg_partner_session='+t}})).status,401);
});
test('reset rollback leaves credential and session unchanged on storage failure',async()=>{
 const {db,env}=setup();const s=await signed(env);db.raw.exec("CREATE TRIGGER fail_password BEFORE UPDATE ON creator_credentials BEGIN SELECT RAISE(ABORT,'test failure'); END");
 assert.equal((await post(env,'password',s,{password:'another-long-password',currentPassword:pw})).status,503);
 assert.equal((await call(env,'session',{headers:{cookie:s.cookie}})).status,200);
 assert.equal(db.raw.prepare("SELECT version FROM creator_credentials WHERE creator_id='a'").get().version,'version1');
});
test('login CSRF is signed, expires server-side, and malformed bodies do not authenticate',async()=>{
 const {env}=setup();const {createHmac}=await import('node:crypto');const payload=`${Date.now()-1800001}.${'A'.repeat(43)}`;
 const expired=payload+'.'+createHmac('sha256',Buffer.from(env.CREATOR_AUTH_RATE_KEY,'base64url')).update('login-csrf\0'+payload).digest('hex');
 const headers={origin,cookie:'pg_partner_login_csrf='+expired,'x-csrf-token':expired,'cf-connecting-ip':'192.0.2.1','content-type':'application/json'};
 assert.equal((await call(env,'login',{method:'POST',headers,body:{username:'alice',password:pw}})).status,403);
 const f=await form(env);const r=await handleCreatorAuth(new Request(origin+'/creator/login',{method:'POST',headers:{...headers,cookie:f.cookie,'x-csrf-token':f.csrf},body:'{'}),env,'login');assert.equal(r.status,401);
});
test('concurrent attempts share durable account limit',async()=>{
 const {env}=setup();const rs=await Promise.all(Array.from({length:6},(_,i)=>login(env,'alice','wrong-password',`192.0.2.${i+1}`)));
 assert.equal(rs.filter(x=>x.status===401).length,5);assert.equal(rs.filter(x=>x.status===429).length,1);
});
