// Unrouted foundation; no registration, recovery, admin reset or legacy import.
// Enabling requires deployment security review, nodejs_compat, a trusted edge which
// overwrites CF-Connecting-IP, an HMAC key, and verified CPU/memory feasibility.
import { randomBytes, scryptSync, timingSafeEqual, createHash, createHmac } from 'node:crypto';
import { isIP } from 'node:net';

const COOKIE = 'pg_partner_session', LOGIN_COOKIE = 'pg_partner_login_csrf';
const WEEK = 7 * 86400000, WINDOW = 15 * 60000;
const MAXMEM = 64 * 1024 * 1024;
const DUMMY_SALT = '000000000000000000000000000000000000000000000000';
const DUMMY_HASH = '00'.repeat(64);
const token = () => randomBytes(32).toString('base64url');
const hash = s => createHash('sha256').update(s).digest('hex');
const equal = (a,b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b));
const validToken = s => typeof s === 'string' && /^[A-Za-z0-9_-]{43}$/.test(s);
const validPassword = p => typeof p === 'string' && p.length >= 12 && p.length <= 256 && Buffer.byteLength(p) <= 1024;
const validUser = u => typeof u === 'string' && /^[a-z0-9][a-z0-9_-]{2,31}$/.test(u);
const response = (status, obj = {}, headers = {}) => new Response(JSON.stringify(obj), {status, headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const cookie = (name,value,age) => `${name}=${value}; Path=/; Max-Age=${age}; Secure; HttpOnly; SameSite=Strict`;
function cookies(req) {
 const result = Object.create(null);
 for (const part of (req.headers.get('cookie') || '').split(';')) {
  const i=part.indexOf('='); if(i<1) continue;
  const k=part.slice(0,i).trim(), v=part.slice(i+1).trim();
  if (k in result) result[k]=null; else result[k]=v;
 }
 return result;
}
function config(env, req) {
 if (env?.CREATOR_AUTH_ENABLED !== 'true' || env?.CREATOR_AUTH_TRUST_CF_CONNECTING_IP !== 'true' || !env?.DB || typeof env.DB.prepare !== 'function' || typeof env.DB.batch !== 'function') return null;
 try {
  const origin = new URL(env.CREATOR_AUTH_ORIGIN);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || origin.origin !== env.CREATOR_AUTH_ORIGIN || new URL(req.url).origin !== origin.origin) return null;
  const key=env.CREATOR_AUTH_RATE_KEY;
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(key) || Buffer.from(key,'base64url').length !== 32 || Buffer.from(key,'base64url').toString('base64url') !== key) return null;
  return {db:env.DB,origin:origin.origin,key:Buffer.from(key,'base64url')};
 } catch { return null; }
}
function requireOrigin(req,c) { return req.headers.get('origin') === c.origin; }
async function json(req) {
 const len=req.headers.get('content-length');
 if (len && (!/^\d+$/.test(len) || Number(len)>4096)) throw Error('body');
 if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type') || '') || !req.body) throw Error('body');
 const reader=req.body.getReader(); let size=0; const chunks=[];
 while (true) { const {value,done}=await reader.read(); if(done) break; size+=value.byteLength; if(size>4096) { await reader.cancel(); throw Error('body'); } chunks.push(value); }
 const obj=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw Error('body'); return obj;
}
// The original Node implementation passes the hex representation itself as the
// UTF-8 salt, NOT Buffer.from(salt,'hex'). No legacy records are loaded here.
export function verifyLegacyPassword(password, salt, digest) {
 if (!validPassword(password) || typeof salt !== 'string' || !/^[a-f0-9]{48}$/.test(salt) || typeof digest !== 'string' || !/^[a-f0-9]{128}$/.test(digest)) return false;
 const got=scryptSync(password,salt,64,{N:16384,r:8,p:1,maxmem:MAXMEM});
 return timingSafeEqual(got,Buffer.from(digest,'hex'));
}
function derive(password,salt) { return scryptSync(password,Buffer.from(salt,'hex'),64,{N:16384,r:8,p:5,maxmem:MAXMEM}).toString('hex'); }
// Returns credential material only. Caller must separately establish authority
// for provisioning; there is intentionally no unauthenticated provisioning API.
export function createPasswordVerifier(password) {
 if (!validPassword(password)) throw Error('invalid password');
 const salt=randomBytes(24).toString('hex');
 return {algorithm:'scrypt-v1',salt,password_hash:derive(password,salt),version:token()};
}
const hmac = (key,s) => createHmac('sha256',key).update(s).digest('hex');
function loginCsrf(key,now) {
 const payload=`${now}.${token()}`;
 return `${payload}.${hmac(key,'login-csrf\0'+payload)}`;
}
function validLoginCsrf(key,value,now) {
 if(typeof value!=='string') return false;
 const m=/^(\d{13})\.([A-Za-z0-9_-]{43})\.([a-f0-9]{64})$/.exec(value);
 if(!m || Number(m[1])>now || now-Number(m[1])>=1800000) return false;
 return equal(m[3],hmac(key,'login-csrf\0'+m[1]+'.'+m[2]));
}
const rateSql = `INSERT INTO creator_auth_rate_limits(bucket,window_start,attempts) VALUES(?,?,1)
 ON CONFLICT(bucket) DO UPDATE SET window_start=excluded.window_start,
 attempts=CASE WHEN window_start=excluded.window_start THEN attempts+1 ELSE 1 END RETURNING attempts`;
async function limit(c,username,ip,now) {
 const minute=Math.floor(now/60000)*60000, window=Math.floor(now/WINDOW)*WINDOW;
 const global=await c.db.prepare(rateSql).bind('global',minute).first();
 if (!global || global.attempts>60) return false;
 // Retain counters only while they could affect a fixed window; indexed and
 // durable, rather than an isolate-local cleanup timer.
 await c.db.prepare('DELETE FROM creator_auth_rate_limits WHERE window_start<?').bind(now-2*WINDOW).run();
 const [a,b]=await c.db.batch([
  c.db.prepare(rateSql).bind('a:'+hmac(c.key,'account\0'+username),window),
  c.db.prepare(rateSql).bind('i:'+hmac(c.key,'ip\0'+ip),window),
 ]);
 if (!a?.results?.[0] || !b?.results?.[0]) throw Error('rate store failure');
 return a.results[0].attempts<=5 && b.results[0].attempts<=20;
}
async function current(c,req,now) {
 const t=cookies(req)[COOKIE]; if(!validToken(t)) return null;
 return c.db.prepare(`SELECT s.creator_id,s.csrf,s.token_hash,s.credential_version FROM creator_auth_sessions s
 JOIN creator_accounts a ON a.id=s.creator_id AND a.active=1
 JOIN creator_credentials v ON v.creator_id=s.creator_id AND v.version=s.credential_version
 WHERE s.token_hash=? AND s.expires_at>?`).bind(hash(t),now).first();
}
function csrf(req, expected) { return validToken(expected) && equal(req.headers.get('x-csrf-token'),expected); }
async function login(c,req,now) {
 if(!requireOrigin(req,c)) return response(403,{error:'forbidden'});
 const jar=cookies(req); if(!validLoginCsrf(c.key,jar[LOGIN_COOKIE],now) || !equal(req.headers.get('x-csrf-token'),jar[LOGIN_COOKIE])) return response(403,{error:'forbidden'});
 // Only trust this header when explicitly configured behind the validated edge.
 const rawIp=req.headers.get('cf-connecting-ip'), family=rawIp && isIP(rawIp);
 if(!family) return response(503,{error:'unavailable'});
 // Canonicalize IPv6 so textual aliases cannot evade a per-address bucket.
 let ip=rawIp;
 if(family===6) { try { ip=new URL(`http://[${rawIp}]/`).hostname.slice(1,-1); } catch { return response(503,{error:'unavailable'}); } }
 let body; try {body=await json(req);} catch {body={};}
 const username=typeof body.username==='string' ? body.username.trim().toLowerCase() : '';
 const u=validUser(username)?username:'invalid';
 if(!await limit(c,u,ip,now)) return response(429,{error:'try_later'},{'retry-after':'900'});
 const pass=validPassword(body.password)?body.password:'invalid-password-value';
 const row=await c.db.prepare(`SELECT a.id,a.active,v.algorithm,v.salt,v.password_hash,v.version FROM creator_accounts a
 JOIN creator_credentials v ON v.creator_id=a.id WHERE a.username=? COLLATE NOCASE`).bind(u).first();
 // Both profiles are computed even for unknown or malformed credentials.
 // This costs substantial CPU; feasibility is a hard prerequisite, not assumed.
 const oldValid = row?.algorithm==='legacy-scrypt-v0' && /^[a-f0-9]{48}$/.test(row.salt || '') && /^[a-f0-9]{128}$/.test(row.password_hash || '');
 const newValid = row?.algorithm==='scrypt-v1' && /^[a-f0-9]{48}$/.test(row.salt || '') && /^[a-f0-9]{128}$/.test(row.password_hash || '');
 const oldMatch=verifyLegacyPassword(pass,oldValid?row.salt:DUMMY_SALT,oldValid?row.password_hash:DUMMY_HASH);
 const salt=newValid?row.salt:randomBytes(24).toString('hex');
 const derived=derive(pass,salt);
 const newMatch=equal(derived,newValid?row.password_hash:DUMMY_HASH);
 if (!validUser(username) || !validPassword(body.password) || !row || row.active!==1 || !(oldValid?oldMatch:newValid&&newMatch)) return response(401,{error:'invalid_credentials'});
 let version=row.version;
 const session=token(), sessionHash=hash(session), sessionCsrf=token();
 if (oldValid) {
  const next=token();
  // Conditional update and insertion share the same atomic D1 batch. The insert
  // is conditional on winning the compare-and-swap; a racing reset wins safely.
  const results=await c.db.batch([
   c.db.prepare(`UPDATE creator_credentials SET algorithm='scrypt-v1',salt=?,password_hash=?,version=?,updated_at=? WHERE creator_id=? AND algorithm='legacy-scrypt-v0' AND salt=? AND password_hash=? AND version=? AND EXISTS(SELECT 1 FROM creator_accounts WHERE id=? AND active=1)`).bind(salt,derived,next,now,row.id,row.salt,row.password_hash,row.version,row.id),
   c.db.prepare(`INSERT INTO creator_auth_sessions(token_hash,creator_id,credential_version,csrf,expires_at) SELECT ?,a.id,v.version,?,? FROM creator_accounts a JOIN creator_credentials v ON v.creator_id=a.id WHERE a.id=? AND a.active=1 AND v.version=?`).bind(sessionHash,sessionCsrf,now+WEEK,row.id,next)
  ]);
  if(results[0]?.meta?.changes!==1 || results[1]?.meta?.changes!==1) return response(401,{error:'invalid_credentials'});
  version=next;
 } else {
  const r=await c.db.prepare(`INSERT INTO creator_auth_sessions(token_hash,creator_id,credential_version,csrf,expires_at) SELECT ?,a.id,v.version,?,? FROM creator_accounts a JOIN creator_credentials v ON v.creator_id=a.id WHERE a.id=? AND a.active=1 AND v.version=? AND v.algorithm='scrypt-v1' AND v.salt=? AND v.password_hash=?`).bind(sessionHash,sessionCsrf,now+WEEK,row.id,version,row.salt,row.password_hash).run();
  if(r?.meta?.changes!==1) return response(401,{error:'invalid_credentials'});
 }
 return response(200,{ok:true,csrf:sessionCsrf},{'set-cookie':cookie(COOKIE,session,7*86400)});
}
// route is deliberately explicit: no application router is modified by this file.
export async function handleCreatorAuth(req,env,route) {
 const c=config(env,req); if(!c) return response(503,{error:'unavailable'});
 try {
  const now=Date.now();
  if(route==='login-form' && req.method==='GET') { const v=loginCsrf(c.key,now); return response(200,{csrf:v},{'set-cookie':cookie(LOGIN_COOKIE,v,1800)}); }
  if(route==='login' && req.method==='POST') return await login(c,req,now);
  if(route==='session' && req.method==='GET') { const s=await current(c,req,now); return s?response(200,{creator_id:s.creator_id,csrf:s.csrf}):response(401,{error:'unauthorized'}); }
  if((route==='logout' || route==='password') && req.method==='POST') {
   if(!requireOrigin(req,c)) return response(403,{error:'forbidden'});
   const s=await current(c,req,now); if(!s) return response(401,{error:'unauthorized'});
   if(!csrf(req,s.csrf)) return response(403,{error:'forbidden'});
   if(route==='logout') { await c.db.prepare('DELETE FROM creator_auth_sessions WHERE token_hash=?').bind(s.token_hash).run(); return response(200,{ok:true},{'set-cookie':cookie(COOKIE,'',0)}); }
   let body; try { body=await json(req); } catch { return response(400,{error:'invalid_input'}); }
   if(!validPassword(body.password) || !validPassword(body.currentPassword)) return response(400,{error:'invalid_input'});
   // A stolen authenticated session alone must not permit a password change.
   // Administrator-initiated reset is a separate, unrouted future workflow.
   const credential=await c.db.prepare('SELECT algorithm,salt,password_hash FROM creator_credentials WHERE creator_id=? AND version=?').bind(s.creator_id,s.credential_version).first();
   let verified=false;
   if(credential?.algorithm==='legacy-scrypt-v0') verified=verifyLegacyPassword(body.currentPassword,credential.salt,credential.password_hash);
   else if(credential?.algorithm==='scrypt-v1' && /^[a-f0-9]{48}$/.test(credential.salt||'') && /^[a-f0-9]{128}$/.test(credential.password_hash||'')) verified=equal(derive(body.currentPassword,credential.salt),credential.password_hash);
   if(!verified) return response(401,{error:'invalid_credentials'});
   const v=createPasswordVerifier(body.password);
   // Session and current credential version must still be valid at the instant of
   // update. The trigger revokes every session in the same atomic statement.
   const r=await c.db.prepare(`UPDATE creator_credentials SET algorithm=?,salt=?,password_hash=?,version=?,updated_at=? WHERE creator_id=? AND version=? AND EXISTS(SELECT 1 FROM creator_auth_sessions s JOIN creator_accounts a ON a.id=s.creator_id AND a.active=1 WHERE s.token_hash=? AND s.creator_id=creator_credentials.creator_id AND s.credential_version=creator_credentials.version AND s.expires_at>?)`).bind(v.algorithm,v.salt,v.password_hash,v.version,now,s.creator_id,s.credential_version,s.token_hash,Date.now()).run();
   if(r?.meta?.changes!==1) return response(401,{error:'unauthorized'});
   return response(200,{ok:true},{'set-cookie':cookie(COOKIE,'',0)});
  }
  return response(404,{error:'not_found'});
 } catch { return response(503,{error:'unavailable'}); }
}
