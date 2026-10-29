'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paigaam-creator-analytics-'));process.env.DATA_DIR=dir;
const store=require('../lib/creators/store');const views=require('../pages/creators');const {db}=require('../db');
after(()=>{db.close();fs.rmSync(dir,{recursive:true,force:true});});
const now=()=>new Date().toISOString();
test('successful login records only coarse categories and safe admin activity summaries',()=>{
 const c=store.createCreator({username:'privacytest',display_name:'Privacy Test',password:'a secure privacy password',commission_bps:1200,coupon_code:'PRIVACY12',discount_bps:500},'admin');
 const ua='Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile/15E148 CUSTOM-UNIQUE-IDENTIFIER-DO-NOT-STORE';
 const t=now(),session=store.createSession(c.id);const result=store.recordCreatorLogin(c.id,ua,t);
 assert.equal(result.login_count,1);assert.equal(result.last_login_at,t);assert.equal(result.last_activity_at,t);assert.equal(result.last_device_type,'phone');assert.equal(result.last_browser,'Chrome');assert.equal(result.last_os,'Android');
 assert.equal(store.getSession(session).creator.id,c.id);
 const persisted=db.prepare('SELECT * FROM partner_creators WHERE id=?').get(c.id);
 assert.equal(JSON.stringify(persisted).includes('CUSTOM-UNIQUE-IDENTIFIER-DO-NOT-STORE'),false);
 assert.equal(db.prepare('SELECT details FROM partner_audit WHERE action=\'creator.login\' AND entity_id=?').get(c.id).details.includes('CUSTOM-UNIQUE-IDENTIFIER-DO-NOT-STORE'),false);
 assert.equal(db.prepare("SELECT 1 FROM pragma_table_info('partner_creators') WHERE name LIKE '%ip%' OR name LIKE '%user_agent%'").get(),undefined);
 const analytics=store.creatorAnalytics(c.id);assert.equal(analytics.active_sessions,1);assert.equal(analytics.last_browser,'Chrome');
 const summary=store.adminSummary(),row=summary.creators.find(x=>x.creator.id===c.id);assert.equal(row.activity.login_count,1);assert.equal(row.activity.last_os,'Android');
 const html=views.adminListPage({creators:[c],summary,csrf:'test'});assert.match(html,/Last login/);assert.match(html,/Android/);assert.match(html,/Chrome/);assert.match(html,/>Logins</);assert.match(html,/Sessions/);assert.doesNotMatch(html,/CUSTOM-UNIQUE-IDENTIFIER-DO-NOT-STORE/);
 const detail=views.adminDetailPage({data:store.dashboard(c.id),activity:analytics,csrf:'test',idempotencyKey:'x'});assert.match(detail,/Device · browser · OS/);assert.match(detail,/Phone/);assert.match(detail,/Successful logins/);
});
test('coarse browser, OS and device classifiers use allowlisted values without storing raw strings',()=>{
 const samples=[
  ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',{device_type:'phone',browser:'Safari',os:'iOS'}],
  ['Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',{device_type:'tablet',browser:'Safari',os:'iOS'}],
  ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Edg/125.0.0.0',{device_type:'desktop',browser:'Edge',os:'Windows'}],
  ['Mozilla/5.0 (X11; CrOS x86_64 15964.66.0) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',{device_type:'desktop',browser:'Chrome',os:'ChromeOS'}],
  ['',{device_type:'unknown',browser:'Other',os:'Unknown'}]
 ];for(const [ua,expected] of samples)assert.deepEqual(store.classifyDevice(ua),expected);
});
test('last activity updates only on authenticated activity and is throttled to one write per minute',()=>{
 const c=store.createCreator({username:'activitytest',display_name:'Activity Test',password:'a secure activity password',commission_bps:1000,coupon_code:'ACTIVITY1',discount_bps:0},'admin');
 const login='2026-10-29T12:00:00.000Z',token=store.createSession(c.id);store.recordCreatorLogin(c.id,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0',login);
 assert.equal(store.recordCreatorActivity(c.id,'2026-10-29T12:00:20.000Z'),false);
 assert.equal(store.recordCreatorActivity(c.id,'2026-10-29T12:01:01.000Z'),true);
 assert.equal(store.creatorAnalytics(c.id).last_activity_at,'2026-10-29T12:01:01.000Z');
 store.updateCreator(c.id,{active:false},'admin');assert.equal(store.recordCreatorActivity(c.id,'2026-10-29T12:03:00.000Z'),false);assert.equal(store.getSession(token),null);
});
