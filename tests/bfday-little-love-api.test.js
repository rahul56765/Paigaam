'use strict';
// Exercise the real family HTTP routes against a disposable SQLite database.
// This isolates them from unrelated optional image/creator dependencies.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const config = require('../templates/little-love/config');
function wav() {
  const b = Buffer.alloc(44 + 1600); b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(1600, 40); return b;
}
test('Little Love: real family editor, preview, owner checks, uploads, save and publish lifecycle', async t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-little-love-'));
  const old = process.env.DATA_DIR; process.env.DATA_DIR = temporary;
  const { db, q } = require('../db');
  const routes = require('../lib/bfdayRoutes');
  const family = require('../lib/bfday/family');
  q.templateInsert({ name: config.name, slug: config.slug, category: config.category, status: 'published', config });
  let base;
  const server = http.createServer(async (req, res) => {
    try {
      if (!await routes.handle(req, res, new URL(req.url, base), { baseUrl: base, isAdmin: false })) { res.writeHead(404); res.end(); }
    } catch (e) { res.writeHead(500); res.end(e.code || e.message); }
  });
  t.after(async () => { server.closeAllConnections(); await new Promise(r => server.close(r)); db.close(); fs.rmSync(temporary, { recursive: true, force: true }); if (old === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = old; });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${server.address().port}`;
  const post = (p, cookie, body, type = 'application/json') => fetch(base + p, { method: 'POST', headers: { 'content-type': type, ...(cookie ? { cookie } : {}) }, body: type === 'application/json' ? JSON.stringify(body) : body });
  const prefix = '/api/little-love';
  let r = await fetch(base + '/create/little-love'); assert.equal(r.status, 200); assert.match(await r.text(), /f-musicLink/);
  r = await fetch(base + '/little-love/demo'); assert.equal(r.status, 200); assert.match(await r.text(), /ll-page--memories/);
  r = await post('/little-love/preview-frame', null, { customer_data: { ...config.demo, loveLetter: 'A live editor update' } }); assert.equal(r.status, 200); assert.match(await r.text(), /A live editor update/);
  r = await post(prefix + '/draft', null, { customer_data: config.demo }); assert.equal(r.status, 200); const draft = await r.json(); const cookie = r.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(base + draft.previewUrl)).status, 403);
  assert.equal((await post(prefix + '/upload-audio?id=' + draft.id, null, wav(), 'audio/wav')).status, 403);
  assert.equal((await post(prefix + '/upload-audio?id=' + draft.id, cookie, Buffer.from('not audio'), 'audio/wav')).status, 400);
  r = await post(prefix + '/upload-audio?id=' + draft.id, cookie, wav(), 'audio/wav'); assert.equal(r.status, 200); const recording = (await r.json()).url;
  r = await post(prefix + '/upload?id=' + draft.id, cookie, require('./bfday-helpers').png(), 'image/png'); assert.equal(r.status, 200); const portrait = (await r.json()).url;
  assert.equal((await fetch(base + recording)).status, 404);
  assert.equal((await fetch(base + portrait)).status, 404);
  assert.equal((await post(prefix + '/draft', cookie, { id: draft.id, customer_data: { ...config.demo, musicLink: 'javascript:alert(1)' } })).status, 400);
  const data = { ...config.demo, musicUpload: recording, portrait, loveLetter: 'Our real saved letter', playlist: [{ title: 'A second song', url: 'https://cdn.example.test/our-song.mp3' }] };
  r = await post(prefix + '/draft', cookie, { id: draft.id, customer_data: data }); assert.equal(r.status, 200);
  assert.equal(q.paigaamById(draft.id).customer_data.musicUpload, recording);
  r = await fetch(base + draft.previewUrl, { headers: { cookie } }); assert.equal(r.status, 200); const preview = await r.text(); assert.match(preview, /Our real saved letter/); assert.ok(preview.includes(recording)); assert.ok(preview.includes(portrait));
  r = await post(prefix + '/publish', cookie, { id: draft.id }); assert.equal(r.status, 200); const published = await r.json();
  const row = q.paigaamById(draft.id); assert.equal(row.status, 'published'); assert.equal(row.template_slug, 'little-love');
  const html = family.bySlug('little-love').render(row, { baseUrl: base, isPreview: false }); assert.match(html, /data-preview="false"/); assert.ok(html.includes(recording)); assert.ok(html.includes('/p/' + published.slug));
  assert.equal((await fetch(base + recording)).status, 200); assert.equal((await fetch(base + portrait)).status, 200);
  assert.equal((await post(prefix + '/publish', cookie, { id: draft.id })).status, 200);
  assert.equal((await post(prefix + '/draft', cookie, { id: draft.id, customer_data: data })).status, 403);
  assert.equal((await post(prefix + '/upload-audio?id=' + draft.id, cookie, wav(), 'audio/wav')).status, 403);
});

test('Little Love: packed assets restore to a clean directory and verify byte-for-byte', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'little-love-art-'));
  try {
    const { prepare } = require('../scripts/prepare-little-love');
    assert.equal(prepare({ outputDir: temporary }), 10);
    assert.equal(prepare({ outputDir: temporary, verifyOnly: true }), 10);
    fs.writeFileSync(path.join(temporary, 'tulips.webp'), 'broken');
    assert.throws(() => prepare({ outputDir: temporary, verifyOnly: true }), /missing or changed/);
    prepare({ outputDir: temporary });
    assert.equal(prepare({ outputDir: temporary, verifyOnly: true }), 10);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});

test('Little Love: exact YouTube IDs and mobile-host playlist links share one server-derived playback policy', () => {
  const schema = require('../templates/little-love/schema');
  const { render } = require('../templates/little-love/render');
  const id = 'dQw4w9WgXcQ';
  for (const url of ['https://youtu.be/' + id + 'extra', 'https://www.youtube.com/watch?v=' + id + 'extra', 'https://evil.test/watch?v=' + id, 'https://youtu.be/' + id + '/unexpected']) {
    assert.equal(schema.youtubeId(url), '');
    assert.throws(() => schema.validate({ ...config.demo, musicLink: url }, { mode: 'strict' }));
  }
  const playlist = [{ title: 'A mobile-host YouTube link', url: 'https://m.youtube.com/watch?v=' + id }];
  const html = render({ customer_data: { ...config.demo, playlist } });
  const payload = JSON.parse(html.match(/id="llPlaylistData">([^<]+)<\/script>/)[1]);
  assert.equal(payload[1].youtubeId, id);
  assert.equal(payload[0].youtubeId, '');
});
