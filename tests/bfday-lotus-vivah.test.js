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
const config = require('../templates/lotus-vivah/config');
const schema = require('../templates/lotus-vivah/schema');
const { render, dateParts } = require('../templates/lotus-vivah/render');
const family = require('../lib/bfday/family');
const root = path.resolve(__dirname, '..');
const demo = () => structuredClone(config.demo);
const htmlFor = (data = demo()) => render({ customer_data: data }, { isPreview: true, baseUrl: 'https://paigaam.cc' });
const kinds = html => [...html.matchAll(/<section\b[^>]*data-lv-page[^>]*data-kind="([^"]+)"/g)].map(m => m[1]);
const upload = ext => '/bfday/uploads/' + 'a'.repeat(48) + '.' + ext;
// Use boolean HTML checks: assertion failures should never dump whole documents.
const contains = (html, needle) => assert.ok(html.includes(needle), 'missing: ' + needle);
const excludes = (html, needle) => assert.ok(!html.includes(needle), 'unexpected: ' + needle);

test('Lotus Vivah: registry, strict demo, field placement and opt-in optional audio', () => {
  assert.ok(family.has(config.slug));
  assert.equal(family.errors.some(e => e.slug === config.slug), false);
  assert.equal(family.list.filter(t => t.slug === config.slug).length, 1);
  assert.doesNotThrow(() => schema.validate(demo(), { mode: 'strict' }));
  assert.equal(config.steps.length, 5);
  const placed = config.steps.flatMap(s => s.fields);
  assert.equal(new Set(placed).size, placed.length);
  assert.deepEqual([...placed].sort(), schema.FIELDS.map(f => f.id).sort());
  assert.equal(schema.FIELDS.find(f => f.id === 'musicUpload').required, false);
  assert.equal(schema.FIELDS.some(f => f.id === 'bgmSong'), false);
});

test('Lotus Vivah: eight cards in reference order, exact navigation count and accessible initial state', () => {
  const html = htmlFor();
  assert.deepEqual(kinds(html), ['cover','save','wedding','haldi','mehndi','sangeet','reception','thanks']);
  assert.equal((html.match(/data-lv-go="/g) || []).length, 8);
  assert.equal((html.match(/aria-hidden="false"/g) || []).length, 1);
  assert.equal((html.match(/aria-hidden="true" inert/g) || []).length, 7);
  contains(html, 'data-lv-current>1</span> / 8');
  contains(html, 'aria-live="polite"');
  contains(html, 'data-lv-prev aria-label="Previous page" disabled');
  contains(html, 'data-lv-open');
});

test('Lotus Vivah: any event can be hidden without changing remaining order', () => {
  for (let i = 0; i < 5; i++) {
    const data = demo(); data.events[i].visible = 'no';
    assert.deepEqual(kinds(htmlFor(data)), ['cover','save',...data.events.filter(e => e.visible !== 'no').map(e => e.kind),'thanks']);
  }
});

test('Lotus Vivah: reordered and removed event pages follow the authored list', () => {
  const data = demo(); data.events = [data.events[4],data.events[1],data.events[0]];
  assert.doesNotThrow(() => schema.validate(data));
  assert.deepEqual(kinds(htmlFor(data)), ['cover','save','reception','haldi','wedding','thanks']);
});

test('Lotus Vivah: all hidden and explicitly empty events leave exactly three fixed cards', () => {
  for (const events of [[], demo().events.map(e => ({ ...e, visible: 'no' }))]) {
    const data = { ...demo(), events };
    assert.equal(schema.validate(data).events.length, events.length);
    const html = htmlFor(data);
    assert.deepEqual(kinds(html), ['cover','save','thanks']);
    assert.equal((html.match(/data-lv-go="/g) || []).length, 3);
    contains(html, 'data-lv-current>1</span> / 3');
  }
});

test('Lotus Vivah: missing event input retains designed preview defaults', () => {
  const data = demo(); delete data.events;
  assert.equal(kinds(htmlFor(data)).length, 8);
});

test('Lotus Vivah: duplicate types including hidden duplicates are refused; preview de-duplicates', () => {
  for (const visible of ['yes','no']) {
    const data = demo(); data.events = [data.events[0], { ...data.events[0], visible }];
    for (const mode of ['strict','draft']) assert.throws(() => schema.validate(data, { mode }), e => e.code === 'duplicate_event');
    assert.equal(schema.validate(data, { mode: 'lenient' }).events.length, 1);
    assert.equal(kinds(htmlFor(data)).filter(k => k === 'wedding').length, 1);
  }
});

test('Lotus Vivah: only five known complete event designs are publishable', () => {
  for (const events of [[...demo().events,demo().events[0]], [{ ...demo().events[0], kind: 'evil' }], [{ ...demo().events[0], date: '' }]]) {
    assert.throws(() => schema.validate({ ...demo(), events }));
  }
});

test('Lotus Vivah: valid six-digit mixed-case colours render globally and per panel', () => {
  const data = { ...demo(), pinkColor: '#123aBc', yellowColor: '#000000', greenColor: '#FFFFFF', paperColor: '#abcdef' };
  data.events[0].panelColor = '#Ab1234';
  assert.doesNotThrow(() => schema.validate(data));
  const html = htmlFor(data);
  for (const pair of ['--lv-pink:#123aBc','--lv-yellow:#000000','--lv-green:#FFFFFF','--lv-white:#abcdef','--lv-panel:#Ab1234']) contains(html, pair);
});

test('Lotus Vivah: malformed colours fail strict/draft and fall back safely in previews', () => {
  for (const bad of ['red','#123','#1234567','123456','#gggggg','url(x)']) {
    for (const key of ['pinkColor','yellowColor','greenColor','paperColor','panelColor']) {
      const data = demo(); if (key === 'panelColor') data.events[0][key] = bad; else data[key] = bad;
      for (const mode of ['strict','draft']) assert.throws(() => schema.validate(data, { mode }));
      const clean = schema.validate(data, { mode: 'lenient' });
      const value = key === 'panelColor' ? clean.events[0][key] : clean[key];
      // Shared lenient text validation truncates before template colour validation.
      assert.equal(value, bad === '#1234567' ? '#123456' : '');
      assert.doesNotThrow(() => htmlFor(data));
    }
  }
});

test('Lotus Vivah: authored HTML and attribute quotes are escaped in all text regions', () => {
  const evil = '<svg onload=x>"\'&';
  const data = demo();
  for (const f of schema.FIELDS.filter(f => ['text','textarea'].includes(f.type) && !f.id.endsWith('Color'))) data[f.id] = evil.slice(0, f.maxLength);
  for (const e of data.events) for (const key of ['heading','lead','hostLine','time','address']) e[key] = evil;
  const html = htmlFor(data);
  excludes(html, '<svg onload=x>'); excludes(html, '"\'&</');
  contains(html, '&lt;svg onload=x&gt;'); contains(html, '&quot;'); contains(html, '&amp;');
});

test('Lotus Vivah: image and audio URL inputs reject external/data/script/traversal sources', () => {
  for (const key of ['monogramLogo','couplePhoto','musicUpload']) {
    for (const bad of ['javascript:alert(1)','data:image/svg+xml,<svg onload=x>','https://evil.example/x.png',upload('png') + '" onerror="x','/bfday/uploads/../x.png']) {
      const data = { ...demo(), [key]: bad };
      assert.throws(() => schema.validate(data));
      assert.equal(schema.validate(data, { mode: 'lenient' })[key], '');
      excludes(htmlFor(data), bad);
    }
  }
});

test('Lotus Vivah: calendar labels are UTC accurate, including leap day and year boundary', () => {
  for (const [value, month, day, year, weekday] of [
    ['2027-07-28','July',28,2027,'Wednesday'], ['2028-02-29','February',29,2028,'Tuesday'], ['2026-12-31','December',31,2026,'Thursday'], ['2027-01-01','January',1,2027,'Friday'],
  ]) assert.deepEqual(dateParts(value), { month,day,year,weekday });
  for (const bad of ['2027-02-29','2027-04-31','2027-13-01','2027-00-01','2027-01-00']) {
    assert.throws(() => schema.validate({ ...demo(), saveDate: bad }));
    const data = demo(); data.events[0].date = bad;
    assert.throws(() => schema.validate(data));
  }
  const html = htmlFor({ ...demo(), events: [], saveDate: '2028-02-29' });
  for (const needle of ['February','Tuesday','<strong>29</strong>','2028']) contains(html, needle);
});

test('Lotus Vivah: logo and optional portrait retain distinct crop frames and removable defaults', () => {
  const data = { ...demo(), monogramLogo: upload('png'), couplePhoto: upload('webp'), logoZoom: 175,logoX: 31,logoY: 62,photoZoom: 220,photoX: 0,photoY: 100 };
  assert.doesNotThrow(() => schema.validate(data));
  const html = htmlFor(data);
  contains(html, 'class="lv-logo" style="--crop-zoom:1.75;--crop-x:31%;--crop-y:62%"');
  contains(html, 'class="lv-photo" style="--crop-zoom:2.2;--crop-x:0%;--crop-y:100%"');
  contains(html, 'lv-copy--save has-photo'); excludes(html, 'class="lv-initials"');
  const customText = htmlFor({ ...data, monogramLogo: '', couplePhoto: '', sealText: 'PS' });
  contains(customText, 'class="lv-initials">PS</span>');
  const coverOnly = customText.split('data-kind="cover"')[1].split('</section>')[0];
  excludes(coverOnly, 'lv-initials'); excludes(coverOnly, 'Couple monogram');
  const fallback = htmlFor({ ...data, monogramLogo: '', couplePhoto: '' });
  excludes(fallback, 'class="lv-initials"'); excludes(fallback, 'class="lv-logo"'); excludes(fallback, 'class="lv-photo"'); excludes(fallback, 'lv-copy--save has-photo');
  for (const [key, value] of [['logoZoom',99],['photoZoom',221],['logoX',-1],['photoY',101]]) assert.throws(() => schema.validate({ ...data, [key]: value }));
  const logo = schema.FIELDS.find(f => f.id === 'monogramLogo');
  assert.equal(logo.preserveTransparency, true); assert.equal(logo.tapToPick, true);
});

test('Lotus Vivah: wizard exposes audio, image, list, and six live crop sliders', () => {
  const { bfdayCreatePage } = require('../pages/bfdayCreate');
  const html = bfdayCreatePage(family.bySlug(config.slug), { price: 0,listPrice: 0 });
  for (const needle of ['data-audio="musicUpload"','data-image="monogramLogo"','data-image="couplePhoto"','data-list="events"','id="f-musicLink"']) contains(html, needle);
  for (const id of ['logoZoom','logoX','logoY','photoZoom','photoX','photoY']) {
    assert.equal(schema.FIELDS.find(f => f.id === id).slider, true);
    contains(html, 'type="range" id="f-' + id + '"');
  }
});

test('Lotus Vivah: direct HTTPS audio and YouTube links are accepted; unsupported pages are refused', () => {
  for (const link of ['https://example.com/song.mp3','https://example.com/SONG.M4A?token=a&b=c','https://example.com/song.ogg','https://example.com/song.wav#part','https://youtu.be/dQw4w9WgXcQ','https://www.youtube.com/watch?v=dQw4w9WgXcQ']) {
    assert.equal(schema.validate({ ...demo(), musicLink: link }).musicLink, link);
    const html = htmlFor({ ...demo(), musicLink: link });
    contains(html, 'data-lv-music');
    if (link.includes('youtu')) { contains(html, 'data-youtube="dQw4w9WgXcQ"'); excludes(html, '<audio'); }
    else contains(html, '<audio id="lvAudio"');
  }
  for (const bad of ['http://example.com/song.mp3','https://open.spotify.com/track/123','https://music.apple.com/song/123','https://example.com/song.mp3.exe','https://example.com/?file=song.mp3','javascript:alert(1)','https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ']) {
    assert.throws(() => schema.validate({ ...demo(), musicLink: bad }));
    assert.equal(schema.validate({ ...demo(), musicLink: bad }, { mode: 'lenient' }).musicLink, '');
    excludes(htmlFor({ ...demo(), musicLink: bad }), '<audio');
  }
});

test('Lotus Vivah: uploaded music wins over native links and YouTube; blank music is silent', () => {
  for (const link of ['https://example.com/song.mp3','https://youtu.be/dQw4w9WgXcQ']) {
    const html = htmlFor({ ...demo(), musicUpload: upload('wav'), musicLink: link });
    contains(html, '<audio id="lvAudio" src="' + upload('wav') + '" preload="none" loop>');
    excludes(html, 'data-youtube='); excludes(html, link);
  }
  const html = htmlFor(); excludes(html, '<audio'); excludes(html, 'data-lv-music-toggle');
});

// Minimal DOM for the shipped interaction script, not an HTML/layout emulator.
function client({ reduced = false, width = 800, height = 400, audioEnabled = false } = {}) {
  class Node {
    constructor() { this.listeners = {}; this.attrs = {}; this.dataset = {}; this.values = {}; this.style = { setProperty: (k,v) => { this.values[k] = v; } }; const set = new Set(); this.classList = { add: k => set.add(k), remove: k => set.delete(k), toggle: (k,on) => on ? set.add(k) : set.delete(k), contains: k => set.has(k) }; }
    addEventListener(k,fn) { (this.listeners[k] ||= []).push(fn); }
    fire(k,e = {}) { for (const fn of this.listeners[k] || []) fn.call(this,e); }
    setAttribute(k,v) { this.attrs[k] = v; } removeAttribute(k) { delete this.attrs[k]; }
    querySelector() { return null; } querySelectorAll() { return []; }
  }
  const app = new Node(), stage = new Node(), card = new Node(), prev = new Node(), next = new Node(), counter = new Node(), open = new Node(), motion = new Node(), doc = new Node(), win = new Node(), reduce = new Node();
  const pages = Array.from({ length: 8 }, () => new Node()), dots = pages.map((_,i) => { const n = new Node(); n.dataset.lvGo = String(i); return n; });
  const music = new Node(), musicButton = new Node(), status = new Node(), audio = new Node();
  let plays = 0; audio.play = () => { plays++; return Promise.resolve(); }; audio.pause = () => audio.fire('pause');
  music.querySelector = s => s === 'button' ? musicButton : status;
  const selectors = { '[data-lv-prev]': prev,'[data-lv-next]': next,'[data-lv-current]': counter,'[data-lv-open]': open,'[data-lv-motion]': motion,'[data-lv-music]': audioEnabled ? music : null };
  app.querySelector = s => selectors[s] || null; app.querySelectorAll = () => dots; card.querySelectorAll = () => pages;
  stage.clientWidth = width; stage.clientHeight = height;
  doc.getElementById = id => ({lvApp:app,lvStage:stage,lvCard:card,lvAudio:audioEnabled ? audio : null})[id];
  reduce.matches = reduced; win.matchMedia = () => reduce;
  let id = 0; const timers = new Map();
  vm.runInNewContext(fs.readFileSync(path.join(root,'public/lotus-vivah/lotus.js'),'utf8'), { document:doc,window:win,setTimeout: (fn,ms) => { timers.set(++id,{fn,ms}); return id; },clearTimeout: id => timers.delete(id),requestAnimationFrame: fn => { fn(); return 1; } });
  const tick = () => { const [id,item] = timers.entries().next().value || []; if (item) { timers.delete(id); item.fn(); } };
  return { app,stage,card,pages,dots,prev,next,counter,open,doc,reduce,timers,tick,audio,musicButton,status, plays: () => plays };
}

test('Lotus Vivah: portrait layout is contained in wide, narrow and short available stages', () => {
  for (const [width,height] of [[1200,800],[320,600],[800,200],[260,330]]) {
    const c = client({width,height}); const w = parseFloat(c.card.values['--card-w']), h = parseFloat(c.card.values['--card-h']);
    assert.ok(w <= width && h <= height + 0.001); assert.ok(Math.abs(w / h - 9/16) < 0.00001);
    assert.ok(w <= 480);
  }
  const css = fs.readFileSync(path.join(root,'public/lotus-vivah/lotus.css'),'utf8');
  assert.ok(/aspect-ratio:\s*9\s*\/\s*16/.test(css));
  assert.ok(css.includes('safe-area-inset-bottom'));
  assert.ok(/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(css));
  assert.ok(css.includes('animation:none!important')); assert.ok(css.includes('transition:none!important'));
});

test('Lotus Vivah: navigation locks opening, updates dots/inert/current, and respects boundaries', () => {
  const c = client(); assert.equal(c.prev.disabled,true); assert.equal(c.counter.textContent,'1');
  c.next.fire('click'); c.next.fire('click'); assert.equal(c.counter.textContent,'1');
  assert.equal([...c.timers.values()][0].ms,1300); c.tick();
  assert.equal(c.counter.textContent,'2'); assert.equal(c.pages[0].inert,true); assert.equal(c.pages[1].inert,false);
  assert.equal(c.dots[1].attrs['aria-current'],'page');
  c.tick(); c.dots[7].fire('click'); assert.equal(c.counter.textContent,'8'); assert.equal(c.next.disabled,true);
  c.tick(); c.next.fire('click'); assert.equal(c.counter.textContent,'8');
  c.prev.fire('click'); assert.equal(c.counter.textContent,'7');
});

test('Lotus Vivah: arrows/swipe and reduced-motion opening use the same bounded navigation', () => {
  const c = client({ reduced:true });
  c.doc.fire('keydown',{target:{matches:()=>false},key:'ArrowRight',preventDefault(){}});
  assert.equal([...c.timers.values()][0].ms,0); c.tick(); c.tick();
  assert.equal(c.counter.textContent,'2');
  c.stage.fire('pointerdown',{target:{closest:()=>false},clientX:200,clientY:80,pointerId:1});
  c.stage.fire('pointerup',{clientX:100,clientY:82,pointerId:1});
  assert.equal(c.counter.textContent,'3'); c.tick();
  c.doc.fire('keydown',{target:{matches:()=>true},key:'ArrowRight',preventDefault(){throw Error('must ignore editor input');}});
  assert.equal(c.counter.textContent,'3');
  c.reduce.fire('change'); assert.equal(c.card.values['--tilt-x'],'0deg');
});

test('Lotus Vivah: uploaded audio starts synchronously on first cover gesture, with pause/retry controls', async () => {
  const c = client({ audioEnabled:true }); assert.equal(c.plays(),0);
  c.open.fire('click'); assert.equal(c.plays(),1); await Promise.resolve();
  assert.equal(c.musicButton.attrs['aria-pressed'],'true');
  c.musicButton.fire('click'); assert.equal(c.musicButton.attrs['aria-pressed'],'false');
  c.musicButton.fire('click'); assert.equal(c.plays(),2); await Promise.resolve();
  c.audio.fire('error'); assert.equal(c.musicButton.attrs['aria-pressed'],'false');
  assert.ok(c.status.textContent.includes('invitation is still available'));
});

test('Lotus Vivah: base64 art matches manifest; missing/corrupt files heal idempotently without touching shared assets', () => {
  const source = path.join(root,'lib/bfday/assets-lotus-vivah.js');
  const manifest = JSON.parse(fs.readFileSync(path.join(root,'assets/lotus-vivah/manifest.json'),'utf8'));
  const files = new Map(); const writes = [];
  const fakeFs = { readFileSync(file, encoding) { if (file.startsWith(path.join(root,'public') + path.sep)) { if (!files.has(file)) throw Error('ENOENT'); return files.get(file); } return fs.readFileSync(file,encoding); }, mkdirSync() {}, writeFileSync(file,data) { files.set(file,Buffer.from(data)); writes.push(file); } };
  const module = { exports:{} };
  vm.runInNewContext(fs.readFileSync(source,'utf8'), { module,exports:module.exports,__dirname:path.dirname(source),require: name => name === 'node:fs' ? fakeFs : require(name),Buffer });
  const { assets,ensureLotusVivahAssets } = module.exports;
  assert.equal(assets.length,Object.keys(manifest).length);
  for (const a of assets) assert.equal(crypto.createHash('sha256').update(Buffer.from(a.data,'base64')).digest('hex'),manifest[a.path]);
  assert.equal(ensureLotusVivahAssets().length,assets.length); assert.equal(ensureLotusVivahAssets().length,0);
  const damaged = path.join(root,'public',assets[0].path); files.set(damaged,Buffer.from('corrupt'));
  assert.equal(ensureLotusVivahAssets().length,1);
  assert.equal(crypto.createHash('sha256').update(files.get(damaged)).digest('hex'),assets[0].sha256);
  assert.equal(writes.length,assets.length+1);
});

function wav() {
  const b = Buffer.alloc(46); b.write('RIFF'); b.writeUInt32LE(38,4); b.write('WAVEfmt ',8); b.writeUInt32LE(16,16); b.writeUInt16LE(1,20); b.writeUInt16LE(1,22); b.writeUInt32LE(44100,24); b.writeUInt32LE(88200,28); b.writeUInt16LE(2,32); b.writeUInt16LE(16,34); b.write('data',36); b.writeUInt32LE(2,40); return b;
}

test('Lotus Vivah: isolated HTTP draft/save/image+audio upload/private preview/publish lifecycle', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'paigaam-lotus-'));
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
  const prefix = '/api/lotus-vivah';
  let r = await post(prefix+'/draft',null,{customer_data:demo()}); assert.equal(r.status,200);
  const cookie = r.headers.get('set-cookie').split(';')[0]; const draft = await r.json();
  assert.equal((await post(prefix+'/upload-audio?id='+draft.id,null,wav(),'audio/wav')).status,403);
  assert.equal((await post(prefix+'/upload-audio?id='+draft.id,cookie,Buffer.from('not audio'),'audio/wav')).status,400);
  r = await post(prefix+'/upload-audio?id='+draft.id,cookie,wav(),'audio/wav'); assert.equal(r.status,200); const song = (await r.json()).url;
  r = await post(prefix+'/upload?id='+draft.id,cookie,require('./bfday-helpers').png(),'image/png'); assert.equal(r.status,200); const logo = (await r.json()).url;
  assert.equal((await fetch(base+song)).status,404); assert.equal((await fetch(base+logo)).status,404);
  const data = { ...demo(), events:[], musicUpload:song, musicLink:'https://youtu.be/dQw4w9WgXcQ',monogramLogo:logo,logoZoom:175 };
  r = await post(prefix+'/draft',cookie,{id:draft.id,customer_data:data}); assert.equal(r.status,200);
  assert.equal(q.paigaamById(draft.id).customer_data.musicUpload,song);
  r = await fetch(base+draft.previewUrl,{headers:{cookie}}); assert.equal(r.status,200); const preview = await r.text();
  assert.deepEqual(kinds(preview),['cover','save','thanks']); contains(preview,song); contains(preview,logo); excludes(preview,'data-youtube=');
  r = await post(prefix+'/publish',cookie,{id:draft.id}); assert.equal(r.status,200); const pub = await r.json();
  const published = q.paigaamById(draft.id); assert.equal(published.status,'published');
  const live = family.bySlug(config.slug).render(published,{baseUrl:base,isPreview:false});
  contains(live,'data-preview="false"'); contains(live,song); contains(live,logo);
  assert.equal((await fetch(base+song)).status,200); assert.equal((await fetch(base+logo)).status,200);
  const again = await post(prefix+'/publish',cookie,{id:draft.id}); assert.equal(again.status,200); assert.equal((await again.json()).slug,pub.slug);
  assert.equal((await post(prefix+'/draft',cookie,{id:draft.id,customer_data:data})).status,403);
  assert.equal((await post(prefix+'/upload-audio?id='+draft.id,cookie,wav(),'audio/wav')).status,403);
});


test('Lotus revision: two complete flowers, eight masked petal layers and an always-plain seal', () => {
  const html = htmlFor({ ...demo(), monogramLogo: upload('png'), sealText: 'PS' });
  const cover = html.split('data-kind="cover"')[1].split('</section>')[0];
  assert.equal((cover.match(/class="lv-cover-bloom /g)||[]).length,2);
  assert.equal((cover.match(/class="lv-cover-layer /g)||[]).length,8);
  contains(cover,'cover-lotus.webp'); contains(cover,'lv-cover-glow');
  excludes(cover,'lv-cover-petal--'); excludes(cover,'lv-initials'); excludes(cover,'Couple monogram');
  assert.ok(/class="lv-seal"[^>]*><span class="lv-seal-shine" aria-hidden="true"><\/span><\/button>/.test(cover));
  const save = html.split('data-kind="save"')[1].split('</section>')[0];
  contains(save,'Couple monogram'); contains(save,'lv-save-mark');
  for(const name of ['lv-save-upper','lv-save-garden','lv-save-stems','lv-save-bottom']) contains(save,name);
});

test('Lotus revision: real silhouettes drive flower and panel light; parallax is bounded and motion-safe', () => {
  const html = htmlFor(); const css = fs.readFileSync(path.join(root,'public/lotus-vivah/lotus.css'),'utf8');
  const js = fs.readFileSync(path.join(root,'public/lotus-vivah/lotus.js'),'utf8');
  contains(html,'lv-petal-glint'); contains(html,'lv-panel-glint'); contains(html,'pathLength="1000"');
  contains(css,'stroke-dasharray:38 962'); contains(css,'lv-edge-travel'); contains(css,'lv-edge-breathe');
  contains(css,'--parallax-x'); contains(css,'prefers-reduced-motion:reduce');
  contains(js,"pendingY*1.7"); contains(js,"pendingX*1.7");
  const outlines = require('../templates/lotus-vivah/botanical-outlines.json');
  for(const a of Object.values(outlines)){assert.ok(a.width>0&&a.height>0);assert.ok(a.outline.startsWith('M'));assert.ok(a.outline.endsWith('Z'));assert.equal(/NaN|Infinity/.test(a.outline),false);}
});

test('Lotus revision: every event copy zone shares its original panel centre with larger default type', () => {
  const css = fs.readFileSync(path.join(root,'public/lotus-vivah/lotus.css'),'utf8');
  const rules = new Map();
  for(const m of css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/(?:(?<=})|^)\s*([^@{}]+)\{([^{}]*)\}/g)) {
    for(const selector of m[1].split(',').map(s=>s.trim())) {
      const values = rules.get(selector)||{};
      for(const prop of m[2].split(';')){const colon=prop.indexOf(':');if(colon>0)values[prop.slice(0,colon).trim()]=prop.slice(colon+1).trim();}
      rules.set(selector,values);
    }
  }
  const pct = (r,k) => Number.parseFloat(r[k]);
  for(const [kind,shape] of [['wedding','wedding'],['haldi','haldi'],['mehndi','mehndi'],['sangeet','white'],['reception','white']]) {
    const panel=rules.get('.lv-shape--'+shape),copy=rules.get('.lv-copy--'+kind);
    assert.ok(panel&&copy,kind);
    assert.ok(Math.abs(pct(panel,'left')+pct(panel,'width')/2-pct(copy,'left')-pct(copy,'width')/2)<.001,kind+' horizontal centre');
    assert.ok(Math.abs(pct(panel,'top')+pct(panel,'height')/2-pct(copy,'top')-pct(copy,'height')/2)<.001,kind+' vertical centre');
    assert.ok(pct(copy,'font-size')>=3.9,kind+' larger default type');
  }
});

test('Lotus refinement: the approved closed cover is byte-identical and no tilt-enable control is required', () => {
  const html=htmlFor(); const cover=html.split('data-kind="cover"')[1].split('</section>')[0];
  assert.equal(crypto.createHash('sha256').update(cover).digest('hex'),'d75946be97d2849938f290c4f21e081468c221434d18e7bc85cd03d914d6f7f6');
  contains(html,'class="lv-card-frame"'); excludes(html,'Enable tilt'); excludes(html,'data-lv-motion');
  const js=fs.readFileSync(path.join(root,'public/lotus-vivah/lotus.js'),'utf8');
  excludes(js,'.requestPermission(');
});

test('Lotus refinement: decorated side cards and balanced Mehndi keep their designs; Thank You has no ribbon', () => {
  const html=htmlFor();
  for(const kind of ['sangeet','reception']){
    const card=html.split('data-kind="'+kind+'"')[1].split('</section>')[0];
    for(const needle of ['border-spray.webp','lv-party-corner','lv-party-bottom','lv-shape--white'])contains(card,needle);
  }
  const mehndi=html.split('data-kind="mehndi"')[1].split('</section>')[0];contains(mehndi,'lv-shape--mehndi');contains(mehndi,'lv-mehndi-upper');
  const thanks=html.split('data-kind="thanks"')[1].split('</section>')[0];
  for(const cls of ['lv-thanks-right','lv-thanks-left','lv-thanks-bottom'])contains(thanks,cls);
  excludes(html,'lv-ribbon');assert.equal(config.demo.greenColor,'#8AB440');
});

test('Lotus refinement: persistent ambient motion/light and bounded two-second opening have reduced-motion fallback', () => {
  const css=fs.readFileSync(path.join(root,'public/lotus-vivah/lotus.css'),'utf8');
  for(const needle of ['lv-paper-float 13s ease-in-out infinite','lv-flower-float 8s ease-in-out infinite','lv-glow-always 4.8s ease-in-out infinite alternate','lv-edge-travel 9s linear infinite','lv-edge-travel 10s linear infinite','lv-card-shine 6.8s ease-in-out infinite'])contains(css,needle);
  contains(css,'@keyframes lv-glow-always{from{opacity:.62}to{opacity:.88}}');
  contains(css,'.lv-card-frame{animation:none!important;transform:none!important}');
  const c=client();c.open.fire('click');assert.equal(c.app.classList.contains('lv-opening'),true);
  assert.equal([...c.timers.values()][0].ms,1300);c.tick();assert.equal(c.counter.textContent,'2');
  assert.equal([...c.timers.values()][0].ms,700);c.tick();assert.equal(c.app.classList.contains('lv-opening'),false);
});
