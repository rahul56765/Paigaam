'use strict';
// Node built-ins only. Never touches the development server or its DB/assets.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const vm = require('node:vm');
const crypto = require('node:crypto');
const config = require('../templates/patra-vivah/config');
const schema = require('../templates/patra-vivah/schema');
const { render } = require('../templates/patra-vivah/render');
const family = require('../lib/bfday/family');
const root = path.resolve(__dirname, '..');
const demo = () => structuredClone(config.demo);
const htmlFor = (data = demo()) => render({ customer_data: data }, { isPreview: true, baseUrl: 'https://paigaam.cc' });
const kinds = html => [...html.matchAll(/<section\b[^>]*data-pv-page[^>]*data-kind="([^"]+)"/g)].map(m => m[1]);
const upload = ext => '/bfday/uploads/' + 'a'.repeat(48) + '.' + ext;
// Use boolean HTML checks: assertion failures should never dump whole documents.
const contains = (html, needle) => assert.ok(html.includes(needle), 'missing: ' + needle);
const excludes = (html, needle) => assert.ok(!html.includes(needle), 'unexpected: ' + needle);

// Minimal DOM for the shipped interaction script, not an HTML/layout emulator.
function client({ reduced = false, width = 800, height = 400, audioEnabled = false } = {}) {
  class Node {
    constructor() { this.listeners = {}; this.attrs = {}; this.dataset = {}; this.values = {}; this.style = { setProperty: (k,v) => { this.values[k] = v; } }; const set = new Set(); this.classList = { add: (...keys) => keys.forEach(k => set.add(k)), remove: (...keys) => keys.forEach(k => set.delete(k)), toggle: (k,on) => on ? set.add(k) : set.delete(k), contains: k => set.has(k) }; }
    addEventListener(k,fn) { (this.listeners[k] ||= []).push(fn); }
    fire(k,e = {}) { for (const fn of this.listeners[k] || []) fn.call(this,e); }
    setAttribute(k,v) { this.attrs[k] = v; } removeAttribute(k) { delete this.attrs[k]; }
    querySelector() { return null; } querySelectorAll() { return []; }
  }
  const app = new Node(), stage = new Node(), card = new Node(), prev = new Node(), next = new Node(), counter = new Node(), open = new Node(), motion = new Node(), doc = new Node(), win = new Node(), reduce = new Node();
  const pages = Array.from({ length: 4 }, () => new Node()), dots = pages.map((_,i) => { const n = new Node(); n.dataset.pvGo = String(i); return n; });
  const music = new Node(), musicButton = new Node(), status = new Node(), audio = new Node(), video = new Node(), light = new Node(), coverStatus = new Node();
  let videoPlays=0;video.currentTime=0;video.play=()=>{videoPlays++;return Promise.resolve();};video.pause=()=>{};
  let plays = 0; audio.play = () => { plays++; return Promise.resolve(); }; audio.pause = () => audio.fire('pause');
  music.querySelector = s => s === 'button' ? musicButton : status;
  const selectors = { '[data-pv-prev]': prev,'[data-pv-next]': next,'[data-pv-current]': counter,'[data-pv-open]': open,'[data-pv-motion]': motion,'[data-pv-music]': audioEnabled ? music : null, '.pv-white-light':light, '.pv-cover-status':coverStatus };
  app.querySelector = s => selectors[s] || null; app.querySelectorAll = () => dots; card.querySelectorAll = () => pages;
  stage.clientWidth = width; stage.clientHeight = height;
  doc.getElementById = id => ({pvApp:app,pvStage:stage,pvCard:card,pvAudio:audioEnabled ? audio : null,pvOpeningVideo:video})[id];
  reduce.matches = reduced; win.matchMedia = () => reduce;
  let id = 0; const timers = new Map(), frames = new Map();
  vm.runInNewContext(fs.readFileSync(path.join(root,'public/patra-vivah/patra.js'),'utf8'), { document:doc,window:win,setTimeout: (fn,ms) => { timers.set(++id,{fn,ms}); return id; },clearTimeout: id => timers.delete(id),requestAnimationFrame: fn => { frames.set(++id,fn);return id; },cancelAnimationFrame:id=>frames.delete(id) });
  const tick = () => { const [id,item] = timers.entries().next().value || []; if (item) { timers.delete(id); item.fn(); } };
  const stepFrame = () => {const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn());};
  return { app,stage,card,pages,dots,prev,next,counter,open,doc,reduce,timers,tick,audio,musicButton,status,video,light,coverStatus,stepFrame,videoPlays:()=>videoPlays,plays:()=>plays };
}


test('Patra runtime: exactly four pages and accessible initial navigation for any valid itinerary', () => {
  for (const days of [demo().days, [{ heading: 'One day', events: [demo().days[0].events[0]] }]]) {
    const html = htmlFor({ ...demo(), days });
    assert.deepEqual(kinds(html), ['cover', 'save', 'itinerary', 'family']);
    assert.equal((html.match(/data-pv-go="/g) || []).length, 4);
    assert.equal((html.match(/aria-hidden="false"/g) || []).length, 1);
    assert.equal((html.match(/aria-hidden="true" inert/g) || []).length, 3);
    contains(html, 'data-pv-current>1</span> / 4');
    contains(html, 'aria-live="polite"');
    contains(html, 'data-pv-prev aria-label="Previous page" disabled');
    contains(html, 'type="button" class="pv-open"');
  }
});

test('Patra runtime: all customer text including nested headings/time/event/venue is escaped', () => {
  const evil = '<svg onload=x>"\'&';
  const data = demo();
  for (const f of schema.FIELDS.filter(f => ['text', 'textarea'].includes(f.type))) data[f.id] = evil.slice(0, f.maxLength);
  for (const day of data.days) {
    day.heading = evil;
    for (const event of day.events) for (const key of ['time', 'event', 'venue']) event[key] = evil.slice(0, key === 'time' ? 16 : undefined);
  }
  const html = htmlFor(data);
  excludes(html, '<svg onload=x>'); excludes(html, '"\'&</');
  contains(html, '&lt;svg onload=x&gt;'); contains(html, '&quot;'); contains(html, '&#39;'); contains(html, '&amp;');
  contains(html, 'aria-label="&lt;svg onload=x&gt;&quot;&#39;&amp;"');
});

test('Patra runtime: image/audio sources reject script, data, external upload and traversal injection', () => {
  for (const key of ['monogramLogo', 'couplePhoto', 'musicUpload']) {
    for (const bad of ['javascript:alert(1)', 'data:image/svg+xml,<svg onload=x>', 'https://evil.example/x.png', upload('png') + '" onerror="x', '/bfday/uploads/../x.png']) {
      assert.throws(() => schema.validate({ ...demo(), [key]: bad }));
      assert.equal(schema.validate({ ...demo(), [key]: bad }, { mode: 'lenient' })[key], '');
      excludes(htmlFor({ ...demo(), [key]: bad }), bad);
    }
  }
  const html = htmlFor({ ...demo(), musicLink: 'https://cdn.example/song.mp3?one=1&two=2' });
  contains(html, 'src="https://cdn.example/song.mp3?one=1&amp;two=2"');
});

test('Patra runtime: blank music is silent, upload overrides native URL and YouTube', () => {
  for (const link of ['https://cdn.example/song.mp3', 'https://youtu.be/dQw4w9WgXcQ']) {
    const html = htmlFor({ ...demo(), musicUpload: upload('wav'), musicLink: link });
    contains(html, '<audio id="pvAudio" src="' + upload('wav') + '" loop preload="none">');
    excludes(html, 'data-youtube='); excludes(html, link);
  }
  excludes(htmlFor(), '<audio'); excludes(htmlFor(), 'data-pv-music');
  const yt = htmlFor({ ...demo(), musicLink: 'https://youtube.com/watch?v=dQw4w9WgXcQ' });
  contains(yt, 'data-youtube="dQw4w9WgXcQ"'); excludes(yt, '<audio');
  contains(htmlFor({ ...demo(), musicLink: 'https://cdn.example/song.ogg' }), '<audio id="pvAudio"');
});

test('Patra runtime: optional logo and photo coexist and disappear completely when removed', () => {
  const html = htmlFor({ ...demo(), monogramLogo: upload('png'), couplePhoto: upload('webp') });
  contains(html, 'src="' + upload('png') + '" alt="Couple logo"');
  contains(html, 'src="' + upload('webp') + '" alt="The couple"');
  excludes(htmlFor(), 'class="pv-media'); excludes(htmlFor(), 'pv-has-media');
});

test('Patra runtime: decoded video drives the opening, white light and navigation lock instead of a wall-clock jump', () => {
  const c=client();c.open.fire('click');assert.equal(c.videoPlays(),1);assert.equal(c.open.disabled,true);assert.equal(c.counter.textContent,'1');
  assert.equal([...c.timers.values()][0].ms,15000,'only a stalled-media watchdog is armed');
  c.next.fire('click');c.dots[3].fire('click');c.open.fire('click');assert.equal(c.videoPlays(),1);assert.equal(c.counter.textContent,'1');
  c.video.fire('playing');assert.equal(c.app.classList.contains('pv-video-playing'),true);
  c.video.currentTime=3;c.stepFrame();assert.equal(c.light.style.opacity,'0');assert.equal(c.counter.textContent,'1');
  c.video.currentTime=4.1;c.stepFrame();assert.ok(+c.light.style.opacity>0&&+c.light.style.opacity<1);
  c.video.currentTime=4.44;c.stepFrame();assert.equal(c.light.style.opacity,'1');assert.equal([...c.timers.values()][0].ms,160);
  c.tick();assert.equal(c.counter.textContent,'2');assert.equal(c.pages[1].inert,false);assert.equal(c.pages[0].inert,true);
  c.next.fire('click');assert.equal(c.counter.textContent,'2');c.stepFrame();assert.equal(c.light.style.opacity,'0');
  assert.equal([...c.timers.values()][0].ms,850);c.tick();assert.equal(c.app.classList.contains('pv-opening'),false);
  c.next.fire('click');assert.equal(c.counter.textContent,'3');assert.equal(c.next.disabled,false);c.tick();
  c.next.fire('click');assert.equal(c.counter.textContent,'4');assert.equal(c.next.disabled,true);c.tick();c.next.fire('click');assert.equal(c.counter.textContent,'4');
  c.prev.fire('click');assert.equal(c.counter.textContent,'3');
});

test('Patra runtime: reduced motion skips video and uses four-page dots, keyboard and swipe without opening delays',()=>{
 const c=client({reduced:true});c.dots[3].fire('click');assert.equal(c.counter.textContent,'4');assert.equal(c.videoPlays(),0);assert.equal(c.timers.size,0);
 c.doc.fire('keydown',{target:{matches:()=>true},key:'ArrowLeft',preventDefault(){throw Error('must ignore input');}});assert.equal(c.counter.textContent,'4');
 c.doc.fire('keydown',{target:{matches:()=>false},key:'ArrowLeft',preventDefault(){}});assert.equal(c.counter.textContent,'3');c.tick();
 c.stage.fire('pointerdown',{target:{closest:()=>false},clientX:100,clientY:80,pointerId:1});c.stage.fire('pointerup',{clientX:200,clientY:82,pointerId:1});assert.equal(c.counter.textContent,'2');
});

test('Patra runtime: media errors and stalled playback use a soft white fallback and never leave guests stuck',()=>{
 for(const mode of ['error','stall']){const c=client();c.open.fire('click');if(mode==='error')c.video.fire('error');else c.tick();assert.equal(c.light.style.opacity,'1');assert.ok(c.coverStatus.textContent.includes('Continuing'));c.tick();assert.equal(c.counter.textContent,'2');c.tick();assert.equal(c.app.classList.contains('pv-opening'),false);}
});

test('Patra runtime: first cover gesture starts native audio synchronously; pause/retry/error controls remain usable', async () => {
  const c = client({ audioEnabled: true }); assert.equal(c.plays(), 0);
  c.open.fire('click'); assert.equal(c.plays(), 1); await Promise.resolve();
  assert.equal(c.musicButton.attrs['aria-pressed'], 'true');
  c.open.fire('click'); assert.equal(c.plays(), 1);
  c.musicButton.fire('click'); assert.equal(c.musicButton.attrs['aria-pressed'], 'false');
  c.musicButton.fire('click'); assert.equal(c.plays(), 2); await Promise.resolve();
  c.audio.fire('error'); assert.equal(c.musicButton.attrs['aria-pressed'], 'false');
  contains(c.status.textContent, 'invitation is still available');
  c.doc.hidden = true; c.doc.fire('visibilitychange'); assert.equal(c.app.classList.contains('pv-paused'), true);
});

test('Patra runtime: 9:16 stage containment at wide, narrow and short sizes; perpetual animation has reduced-motion fallbacks', () => {
  for (const [width, height] of [[1200, 800], [320, 600], [800, 200], [260, 330]]) {
    const c = client({ width, height }); const scale = Number(c.card.values['--pv-scale']);
    assert.ok(720 * scale <= width + .001); assert.ok(1280 * scale <= height + .001); assert.ok(scale <= .75);
  }
  const css = fs.readFileSync(path.join(root, 'public/patra-vivah/patra.css'), 'utf8');
  contains(css, 'prefers-reduced-motion:reduce'); contains(css, 'animation:none!important');
  contains(css, '.pv-page.is-current .pv-reveal{opacity:1;transform:none}');
  contains(css, '.pv-petals{display:none}'); contains(css, 'infinite'); contains(css, 'safe-area-inset-bottom');
});

test('Patra runtime: every packed illustration matches manifest and missing/corrupt art heals idempotently only under Patra', () => {
  const source = path.join(root, 'lib/bfday/assets-patra-vivah.js');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/patra-vivah/manifest.json'), 'utf8'));
  const files = new Map(), writes = [];
  const fakeFs = {
    readFileSync(file, encoding) {
      if (file.startsWith(path.join(root, 'public') + path.sep)) { if (!files.has(file)) throw Error('ENOENT'); return files.get(file); }
      return fs.readFileSync(file, encoding);
    },
    mkdirSync() {},
    writeFileSync(file, data) { files.set(file, Buffer.from(data)); writes.push(file); },
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(source, 'utf8'), { module, exports: module.exports, __dirname: path.dirname(source), require: name => name === 'node:fs' ? fakeFs : require(name), Buffer });
  const { assets, ensurePatraVivahAssets } = module.exports;
  assert.equal(assets.length, Object.keys(manifest).length); assert.equal(assets.length, 11);
  for (const a of assets) {
    assert.equal(crypto.createHash('sha256').update(Buffer.from(a.data, 'base64')).digest('hex'), manifest[a.path]);
    assert.ok(a.path.startsWith('patra-vivah/')); assert.equal(path.basename(a.path), a.path.slice('patra-vivah/'.length));
  }
  assert.equal(ensurePatraVivahAssets().length, assets.length); assert.equal(ensurePatraVivahAssets().length, 0);
  const damaged = path.join(root, 'public', assets[0].path); files.set(damaged, Buffer.from('corrupt'));
  assert.equal(ensurePatraVivahAssets().length, 1); assert.equal(ensurePatraVivahAssets().length, 0);
  assert.equal(crypto.createHash('sha256').update(files.get(damaged)).digest('hex'), assets[0].sha256);
  assert.equal(writes.length, assets.length + 1);
  for (const file of writes) assert.ok(file.startsWith(path.join(root, 'public/patra-vivah') + path.sep));
});

function wav() {
  const b = Buffer.alloc(46); b.write('RIFF'); b.writeUInt32LE(38,4); b.write('WAVEfmt ',8); b.writeUInt32LE(16,16); b.writeUInt16LE(1,20); b.writeUInt16LE(1,22); b.writeUInt32LE(44100,24); b.writeUInt32LE(88200,28); b.writeUInt16LE(2,32); b.writeUInt16LE(16,34); b.write('data',36); b.writeUInt32LE(2,40); return b;
}

test('Patra runtime: isolated HTTP draft/save/image+audio upload/private preview/publish lifecycle', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'paigaam-patra-'));
  const previous = process.env.DATA_DIR; process.env.DATA_DIR = dir;
  const { q,db } = require('../db');
  const routes = require('../lib/bfdayRoutes');
  q.templateInsert({name:config.name,slug:config.slug,category:'Wedding',status:'published',config});
  let base;
  const server = http.createServer(async (req,res) => {
    try { if (!await routes.handle(req,res,new URL(req.url,base),{baseUrl:base,isAdmin:false})) { res.writeHead(404); res.end(); } }
    catch (e) { res.writeHead(500); res.end(e.code || e.message); }
  });
  t.after(async () => { server.closeAllConnections(); await new Promise(r => server.close(r)); db.close(); fs.rmSync(dir,{recursive:true,force:true}); if (previous === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = previous; });
  await new Promise(r => server.listen(0,'127.0.0.1',r)); base = 'http://127.0.0.1:' + server.address().port;
  const post = (p,cookie,data,type='application/json') => fetch(base+p,{method:'POST',headers:{'content-type':type,...(cookie ? {cookie} : {})},body:type === 'application/json' ? JSON.stringify(data) : data});
  const prefix = '/api/patra-vivah';
  let r = await post(prefix+'/draft',null,{customer_data:demo()}); assert.equal(r.status,200);
  const cookie = r.headers.get('set-cookie').split(';')[0]; const draft = await r.json();
  assert.equal((await fetch(base+draft.previewUrl)).status,403);
  assert.equal((await post(prefix+'/draft',null,{id:draft.id,customer_data:demo()})).status,403);
  assert.equal((await post(prefix+'/publish',null,{id:draft.id})).status,403);
  assert.equal((await post(prefix+'/upload?id='+draft.id,null,require('./bfday-helpers').png(),'image/png')).status,403);
  assert.equal((await post(prefix+'/upload-audio?id='+draft.id,null,wav(),'audio/wav')).status,403);
  assert.equal((await post(prefix+'/upload-audio?id='+draft.id,cookie,Buffer.from('not audio'),'audio/wav')).status,400);
  r = await post(prefix+'/upload-audio?id='+draft.id,cookie,wav(),'audio/wav'); assert.equal(r.status,200); const song = (await r.json()).url;
  r = await post(prefix+'/upload?id='+draft.id,cookie,require('./bfday-helpers').png(),'image/png'); assert.equal(r.status,200); const logo = (await r.json()).url;
  assert.equal((await fetch(base+song)).status,404); assert.equal((await fetch(base+logo)).status,404);
  assert.equal((await fetch(base+song,{headers:{cookie}})).status,200);
  assert.equal((await fetch(base+logo,{headers:{cookie}})).status,200);
  // Even the same owner cannot attach files belonging to a different draft.
  r = await post(prefix+'/draft',cookie,{customer_data:demo()}); assert.equal(r.status,200); const other = await r.json();
  assert.equal((await post(prefix+'/draft',cookie,{id:other.id,customer_data:{...demo(),musicUpload:song}})).status,403);
  assert.equal((await post(prefix+'/draft',cookie,{id:other.id,customer_data:{...demo(),monogramLogo:logo}})).status,403);
  assert.equal((await post(prefix+'/draft',cookie,{id:other.id,customer_data:{...demo(),familyPhoto:logo}})).status,403);
  const data = { ...demo(), days:demo().days.slice().reverse(), musicUpload:song, musicLink:'https://youtu.be/dQw4w9WgXcQ',monogramLogo:logo, familyPhoto:logo, familyPhotoZoom:175, familyPhotoX:10, familyPhotoY:90, familyMapsLink:'https://maps.google.com/?q=Venue', familyMapsLabel:'Find the family venue' };
  r = await post(prefix+'/draft',cookie,{id:draft.id,customer_data:data}); assert.equal(r.status,200);
  assert.equal(q.paigaamById(draft.id).customer_data.musicUpload,song);
  assert.deepEqual(q.paigaamById(draft.id).customer_data.days,data.days);
  assert.equal(q.paigaamById(draft.id).customer_data.familyPhoto,logo);
  assert.equal(q.paigaamById(draft.id).customer_data.familyPhotoZoom,175);
  r = await fetch(base+draft.previewUrl,{headers:{cookie}}); assert.equal(r.status,200); const preview = await r.text();
  assert.deepEqual(kinds(preview),['cover','save','itinerary','family']);
  contains(preview,'class="bf-previewbadge"');
  contains(preview,'--family-zoom:1.75;--family-x:10%;--family-y:90%');
  contains(preview,'Find the family venue');
  assert.ok(preview.indexOf(data.days[0].heading) < preview.indexOf(data.days[2].heading)); contains(preview,song); contains(preview,logo); excludes(preview,'data-youtube=');
  r = await post(prefix+'/publish',cookie,{id:draft.id}); assert.equal(r.status,200); const pub = await r.json();
  const published = q.paigaamById(draft.id); assert.equal(published.status,'published');
  const live = family.bySlug(config.slug).render(published,{baseUrl:base,isPreview:false});
  excludes(live,'class="bf-previewbadge"'); contains(live,song); contains(live,logo);
  assert.equal((await fetch(base+song)).status,200); assert.equal((await fetch(base+logo)).status,200);
  const again = await post(prefix+'/publish',cookie,{id:draft.id}); assert.equal(again.status,200); assert.equal((await again.json()).slug,pub.slug);
  assert.equal((await post(prefix+'/draft',cookie,{id:draft.id,customer_data:data})).status,403);
  assert.equal((await post(prefix+'/upload-audio?id='+draft.id,cookie,wav(),'audio/wav')).status,403);
  assert.equal((await post(prefix+'/upload?id='+draft.id,cookie,require('./bfday-helpers').png(),'image/png')).status,403);
});



test('Patra regression: accepted YouTube URL variants never render as native audio or switch duplicate video IDs', () => {
  for (const musicLink of [
    'https://youtu.be:443/dQw4w9WgXcQ',
    'https://youtube.com/watch?%76=dQw4w9WgXcQ',
    'https://youtube.com/watch?v=dQw4w9WgXcQ&v=abcdefghijk',
  ]) {
    for (const mode of ['strict', 'draft', 'lenient']) {
      const clean = schema.validate({ ...demo(), musicLink }, { mode });
      assert.equal(require('../lib/bfday/bgm').bgmParse(clean.musicLink), 'dQw4w9WgXcQ');
    }
    const html = htmlFor({ ...demo(), musicLink });
    contains(html, 'data-youtube="dQw4w9WgXcQ"'); excludes(html, '<audio');
  }
});
