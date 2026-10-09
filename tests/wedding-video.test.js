'use strict';
/**
 * Wedding video feature: HTTP end-to-end tests against a real server process.
 * Story scenes are fixed template clips; nothing calls an AI API. Full MP4 render is opt-in (WV_RENDER_TEST=1) because it takes minutes.
 */
const test = require('node:test');
const assert = require('node:assert');
const { spawn, execFileSync } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wvtest-'));
let server; let base;

const JPG = path.join(TMP, 'photo.jpg');
const MP3 = path.join(TMP, 'tune.mp3');
execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=orange:s=360x640', '-frames:v', '1', JPG]);
execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:a', 'libmp3lame', MP3]);

function startServer() {
  return new Promise((resolve, reject) => {
    const port = 31000 + Math.floor(Math.random() * 2000);
    base = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(port), BASE_URL: base, DATA_DIR: path.join(TMP, 'data') },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    const onData = (d) => { out += d; if (/listening|running|http:\/\//i.test(out)) resolve(); };
    server.stdout.on('data', onData); server.stderr.on('data', (d) => { out += d; });
    server.on('exit', (c) => reject(new Error('server exited ' + c + '\n' + out)));
    setTimeout(resolve, 4000);
  });
}

const jar = { cookie: '' };
async function req(method, url, { body, raw, cookie = true } = {}) {
  const headers = {};
  if (cookie && jar.cookie) headers.cookie = jar.cookie;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const r = await fetch(base + url, { method, headers, body: raw || (body !== undefined ? JSON.stringify(body) : undefined), redirect: 'manual' });
  const sc = r.headers.get('set-cookie');
  if (sc && cookie) jar.cookie = sc.split(';')[0];
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch { /* html */ }
  return { status: r.status, json, text, headers: r.headers };
}

test.before(async () => { await startServer(); });
test.after(() => { server && server.kill(); fs.rmSync(TMP, { recursive: true, force: true }); });

let inviteId;

test('editor page and assets are served', async () => {
  const p = await req('GET', '/wedding-video');
  assert.equal(p.status, 200);
  assert.match(p.text, /wv-root/);
  assert.doesNotMatch(p.text, /data-veo/);
  const a = await req('GET', '/wedding-video/assets/art/band_h.jpg');
  assert.equal(a.status, 200);
  const st = await req('GET', '/wedding-video/assets/stories/story1.mp4');
  assert.equal(st.status, 200);
  const f = await req('GET', '/wedding-video/assets/fonts/Italiana-Regular.ttf');
  assert.equal(f.status, 200);
  const bad = await req('GET', '/wedding-video/assets/art/../../package.json');
  assert.notEqual(bad.status, 200);
});

test('config returns the reference sample', async () => {
  const c = await req('GET', '/api/wedding-video/config');
  assert.equal(c.status, 200);
  assert.equal(c.json.sample.couple.bride, 'Shravi');
  assert.equal(c.json.sample.events.length, 4);
  assert.equal(c.json.veo, undefined);
  assert.deepEqual(Object.keys(c.json.stories), ['cycling', 'proposal', 'blessing', 'walk']);
  assert.deepEqual(c.json.sample.stories.map((x) => x.scene), ['cycling', 'proposal', 'blessing', 'walk']);
});

test('create, read and update an invitation (owner only, normalised)', async () => {
  const c = await req('GET', '/api/wedding-video/config');
  const data = c.json.sample;
  data.couple.bride = 'A'.repeat(500);
  data.events.push({ preset: 'reception', title: 'Reception', date: 'not-a-date', timings: [{ time: '8 PM' }] });
  const r = await req('POST', '/api/wedding-video/invites', { body: { data } });
  assert.equal(r.status, 201);
  inviteId = r.json.id;
  assert.match(inviteId, /^[a-f0-9]{24}$/);
  assert.match(jar.cookie, /^paigaam_wv=[a-f0-9]{64}$/);
  const g = await req('GET', `/api/wedding-video/invites/${inviteId}`);
  assert.equal(g.status, 200);
  assert.equal(g.json.data.couple.bride.length, 40, 'names are length-limited');
  assert.equal(g.json.data.events[4].theme, 'reception');
  assert.equal(g.json.data.events[4].date, '', 'invalid dates are dropped');
  const other = await req('GET', `/api/wedding-video/invites/${inviteId}`, { cookie: false });
  assert.equal(other.status, 403);
  data.couple.bride = 'Shravi';
  const u = await req('PUT', `/api/wedding-video/invites/${inviteId}`, { body: { data } });
  assert.equal(u.status, 200);
  const g2 = await req('GET', `/api/wedding-video/invites/${inviteId}`);
  assert.equal(g2.json.data.couple.bride, 'Shravi');
});

test('only music uploads are accepted, sniffed by magic bytes', async () => {
  const fake = await req('POST', `/api/wedding-video/invites/${inviteId}/media?kind=music`, { raw: Buffer.from('<?php echo 1; ?>xxxxxxxxxxxx') });
  assert.equal(fake.status, 415);
  const photo = await req('POST', `/api/wedding-video/invites/${inviteId}/media?kind=photo`, { raw: fs.readFileSync(JPG) });
  assert.equal(photo.status, 400, 'customer photos are not part of the fixed template');
  const ok = await req('POST', `/api/wedding-video/invites/${inviteId}/media?kind=music`, { raw: fs.readFileSync(MP3) });
  assert.equal(ok.status, 201);
  assert.match(ok.json.url, /^\/wedding-video\/media\/[a-f0-9]{32}\.mp3$/);
  assert.equal((await req('GET', ok.json.url)).status, 200);
  const notOwner = await req('POST', `/api/wedding-video/invites/${inviteId}/media?kind=music`, { raw: fs.readFileSync(MP3), cookie: false });
  assert.equal(notOwner.status, 403);
  const gen = await req('POST', `/api/wedding-video/invites/${inviteId}/stories/s1/generate`, { body: {} });
  assert.equal(gen.status, 404, 'no per-customer AI generation endpoint');
});

test('story scenes only come from the template library', async () => {
  const g = await req('GET', `/api/wedding-video/invites/${inviteId}`);
  const data = g.json.data;
  data.stories = [{ scene: 'walk', after: 'main', holdSec: 4 }, { scene: 'hacker', src: 'https://evil.example/x.mp4' }];
  await req('PUT', `/api/wedding-video/invites/${inviteId}`, { body: { data } });
  const g2 = await req('GET', `/api/wedding-video/invites/${inviteId}`);
  assert.equal(g2.json.data.stories.length, 1);
  assert.equal(g2.json.data.stories[0].src, 'stories/story4.mp4');
});

test('share page, RSVP and wishes', async () => {
  const s = await req('GET', `/w/${inviteId}`, { cookie: false });
  assert.equal(s.status, 200);
  assert.match(s.text, /Shravi &amp; Lakshya/);
  assert.match(s.text, /still being prepared/);
  const r = await req('POST', `/api/wedding-video/w/${inviteId}/rsvp`, { body: { name: 'Guest <b>One</b>', attending: 'yes', guests: 3, message: 'Congratulations!' }, cookie: false });
  assert.equal(r.status, 201);
  const s2 = await req('GET', `/w/${inviteId}`, { cookie: false });
  assert.match(s2.text, /Congratulations!/);
  assert.ok(!s2.text.includes('<b>One</b>'), 'guest input is escaped');
  const list = await req('GET', `/api/wedding-video/invites/${inviteId}/rsvps`);
  assert.equal(list.json.rsvps[0].guests, 3);
  const csv = await req('GET', `/api/wedding-video/invites/${inviteId}/rsvps.csv`);
  assert.match(csv.text, /^name,attending,guests,message,date/);
  const noAuth = await req('GET', `/api/wedding-video/invites/${inviteId}/rsvps`, { cookie: false });
  assert.equal(noAuth.status, 403);
  const missing = await req('GET', '/w/aaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(missing.status, 404);
});

test('full MP4 render (opt-in: WV_RENDER_TEST=1)', { skip: process.env.WV_RENDER_TEST !== '1', timeout: 30 * 60 * 1000 }, async () => {
  // short film: two events, no stories, quick holds
  const c = await req('GET', '/api/wedding-video/config');
  const data = c.json.sample;
  data.stories = [{ scene: 'proposal', after: data.events[0].id, holdSec: 3 }]; data.events = data.events.slice(0, 2);
  data.timing = { openerHoldSec: 6, mainHoldSec: 3, endHoldSec: 1.5 };
  data.events.forEach((e) => { e.holdSec = 2.5; }); data.closing.holdSec = 3;
  await req('PUT', `/api/wedding-video/invites/${inviteId}`, { body: { data } });
  const r = await req('POST', `/api/wedding-video/invites/${inviteId}/render`, { body: { format: '9x16' } });
  assert.equal(r.status, 202);
  let job;
  for (;;) {
    job = (await req('GET', `/api/wedding-video/jobs/${r.json.jobId}`)).json;
    if (job.status === 'done' || job.status === 'failed') break;
    await new Promise((res) => setTimeout(res, 3000));
  }
  assert.equal(job.status, 'done', job.error);
  const v = await fetch(`${base}/w/${inviteId}/video-9x16.mp4`);
  assert.equal(v.status, 200);
  assert.equal(v.headers.get('content-type'), 'video/mp4');
});
