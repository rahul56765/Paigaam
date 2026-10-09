'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { spawn, execFileSync } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vvtest-'));
let server, base;
const PNG = path.join(TMP, 'mark.png'), OPAQUE_PNG = path.join(TMP, 'opaque.png'), MP3 = path.join(TMP, 'music.mp3'), MP4 = path.join(TMP, 'music.mp4'), SILENT_MP4 = path.join(TMP, 'silent.mp4');
execFileSync('ffmpeg', ['-v','error','-f','lavfi','-i','color=c=white@0.0:s=32x32,format=rgba','-frames:v','1',PNG]);
execFileSync('ffmpeg', ['-v','error','-f','lavfi','-i','color=c=white:s=32x32','-frames:v','1',OPAQUE_PNG]);
execFileSync('ffmpeg', ['-v','error','-f','lavfi','-i','sine=frequency=440:duration=2','-c:a','libmp3lame',MP3]);
execFileSync('ffmpeg', ['-v','error','-f','lavfi','-i','color=c=black:s=32x32:d=2','-f','lavfi','-i','sine=frequency=440:duration=2','-shortest','-c:v','libx264','-c:a','aac',MP4]);
execFileSync('ffmpeg', ['-v','error','-f','lavfi','-i','color=c=black:s=32x32:d=2','-c:v','libx264',SILENT_MP4]);
function startServer() {
  return new Promise((resolve, reject) => {
    const port = 33000 + Math.floor(Math.random() * 1500); base = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), BASE_URL: base, DATA_DIR: path.join(TMP,'data') }, stdio: ['ignore','pipe','pipe'] });
    let out = ''; const onData = (d) => { out += d; if (/listening|running|http:\/\//i.test(out)) resolve(); };
    server.stdout.on('data', onData); server.stderr.on('data', (d) => { out += d; });
    server.on('exit', (c) => reject(new Error(`server exited ${c}\n${out}`))); setTimeout(resolve, 4000);
  });
}
const jar = { cookie: '' };
async function req(method, url, { body, raw, cookie = true } = {}) {
  const headers = {}; if (cookie && jar.cookie) headers.cookie = jar.cookie; if (body !== undefined) headers['content-type'] = 'application/json';
  const r = await fetch(base + url, { method, headers, body: raw || (body !== undefined ? JSON.stringify(body) : undefined), redirect: 'manual' });
  const sc = r.headers.get('set-cookie'); if (sc && cookie) jar.cookie = sc.split(';')[0];
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {}
  return { status:r.status, json, text, headers:r.headers };
}
test.before(async () => startServer());
test.after(() => { if (server) server.kill(); fs.rmSync(TMP, { recursive:true, force:true }); });
let id;
test('Vivah editor and art assets are served independently', async () => {
  const page = await req('GET','/vivah-video'); assert.equal(page.status,200); assert.match(page.text,/vv-root/);
  assert.equal((await req('GET','/vivah-video/assets/art/vivah_arch_soft.jpg')).status,200);
  assert.equal((await req('GET','/vivah-video/assets/stories/mandap.mp4')).status,200);
  assert.equal((await req('GET','/wedding-video')).status,200);
});
test('sample uses fictional couple and switchable palette, with fixed film scenes', async () => {
  const c = await req('GET','/api/vivah-video/config'); assert.equal(c.status,200);
  assert.equal(c.json.sample.couple.bride,'Meera'); assert.equal(c.json.sample.couple.groom,'Arjun');
  assert.equal(c.json.sample.meta.palette,'soft'); assert.equal(c.json.sample.events[0].address,'Jaipur, Rajasthan');
  assert.equal(c.json.sample.meta.music.src,''); assert.deepEqual(Object.keys(c.json.stories),['mandap','couple']);
  assert.deepEqual(c.json.sample.stories.map((s)=>s.scene),['mandap','couple']);
});
test('create invite, owner-only settings and upload guards', async () => {
  const c = await req('GET','/api/vivah-video/config'); const data=c.json.sample; data.meta.palette='maroon_gold';
  const created=await req('POST','/api/vivah-video/invites',{body:{data}}); assert.equal(created.status,201); id=created.json.id;
  assert.match(jar.cookie,/^paigaam_vv=/);
  const g=await req('GET',`/api/vivah-video/invites/${id}`); assert.equal(g.json.data.meta.palette,'maroon_gold');
  assert.equal((await req('GET',`/api/vivah-video/invites/${id}`,{cookie:false})).status,403);
  const logo=await req('POST',`/api/vivah-video/invites/${id}/media?kind=logo`,{raw:fs.readFileSync(PNG)}); assert.equal(logo.status,201); assert.match(logo.json.url,/\.png$/);
  assert.equal((await req('GET',logo.json.url)).status,200);
  const qr=await req('POST',`/api/vivah-video/invites/${id}/media?kind=qr`,{raw:fs.readFileSync(PNG)}); assert.equal(qr.status,201);
  const audio=await req('POST',`/api/vivah-video/invites/${id}/media?kind=music`,{raw:fs.readFileSync(MP3)}); assert.equal(audio.status,201); assert.match(audio.json.url,/\.mp3$/);
  const audioMp4=await req('POST',`/api/vivah-video/invites/${id}/media?kind=music`,{raw:fs.readFileSync(MP4)}); assert.equal(audioMp4.status,201); assert.match(audioMp4.json.url,/\.mp4$/);
  const silentMp4=await req('POST',`/api/vivah-video/invites/${id}/media?kind=music`,{raw:fs.readFileSync(SILENT_MP4)}); assert.equal(silentMp4.status,415,'MP4 must contain an audio stream');
  const opaqueLogo=await req('POST',`/api/vivah-video/invites/${id}/media?kind=logo`,{raw:fs.readFileSync(OPAQUE_PNG)}); assert.equal(opaqueLogo.status,415,'logo PNG must contain transparency');
  const invalid=await req('POST',`/api/vivah-video/invites/${id}/media?kind=logo`,{raw:Buffer.from('not a png at all')}); assert.equal(invalid.status,415,'invalid logo bytes are rejected');
  for (let i=0; i<3; i++) assert.equal((await req('POST',`/api/vivah-video/invites/${id}/media?kind=logo`,{raw:fs.readFileSync(PNG)})).status,201);
  assert.equal((await req('POST',`/api/vivah-video/invites/${id}/media?kind=logo`,{raw:fs.readFileSync(PNG)})).status,429,'logo upload count is capped');
  const unsupported=await req('POST',`/api/vivah-video/invites/${id}/media?kind=qr`,{raw:fs.readFileSync(MP3)}); assert.equal(unsupported.status,415,'QR accepts only PNG');
  assert.equal((await req('POST',`/api/vivah-video/invites/${id}/media?kind=logo`,{raw:fs.readFileSync(PNG),cookie:false})).status,403);
});
test('uploads cannot choose arbitrary story sources; normalizer restores library clips', async () => {
  const g=await req('GET',`/api/vivah-video/invites/${id}`); const data=g.json.data;
  data.stories=[{scene:'couple',src:'https://evil.example/a.mp4',after:'e1'},{scene:'unknown',src:'https://evil.example/b.mp4'}];
  await req('PUT',`/api/vivah-video/invites/${id}`,{body:{data}});
  const saved=await req('GET',`/api/vivah-video/invites/${id}`); assert.equal(saved.json.data.stories.length,1); assert.equal(saved.json.data.stories[0].src,'stories/couple.mp4');
});
