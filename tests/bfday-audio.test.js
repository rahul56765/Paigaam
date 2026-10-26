'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { normalizeFields, makeSchema, audioIn, imagesIn } = require('../lib/bfday/fields');
const { sniffAudio, checkAudio, MAX_BYTES } = require('../lib/bfday/audio');
const audioField = { id: 'musicUpload', type: 'audio', label: 'Upload a song' };
const config = { slug: 'audio-fixture', fields: [audioField], backgroundMusic: false };
const URL = '/bfday/uploads/' + 'a'.repeat(48) + '.mp3';

function wav() {
  const buf = Buffer.alloc(46);
  buf.write('RIFF'); buf.writeUInt32LE(38, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(44100, 24); buf.writeUInt32LE(88200, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(2, 40);
  return buf;
}
function mp3(id3 = false) {
  const frame = Buffer.alloc(417); Buffer.from([0xff,0xfb,0x90,0]).copy(frame);
  return id3 ? Buffer.concat([Buffer.from([0x49,0x44,0x33,4,0,0,0,0,0,0]), frame]) : frame;
}
function ogg(codec = 'opus') {
  const packet = Buffer.alloc(codec === 'opus' ? 19 : 30);
  if (codec === 'opus') { packet.write('OpusHead'); packet[8] = 1; packet[9] = 2; }
  else { packet[0] = 1; packet.write('vorbis', 1); packet[11] = 2; packet.writeUInt32LE(44100, 12); packet[29] = 1; }
  const head = Buffer.alloc(28); head.write('OggS'); head[5] = 2; head[26] = 1; head[27] = packet.length;
  return Buffer.concat([head, packet]);
}
function box(tag, bytes) {
  const head = Buffer.alloc(8); head.writeUInt32BE(8 + bytes.length); head.write(tag, 4);
  return Buffer.concat([head, bytes]);
}
function m4a(handler = 'soun') {
  const hdlr = Buffer.alloc(12); hdlr.write(handler, 8);
  return Buffer.concat([
    box('ftyp', Buffer.from('M4A \0\0\0\0isom', 'binary')),
    box('moov', box('trak', box('mdia', box('hdlr', hdlr)))), box('mdat', Buffer.from([1,2,3,4])),
  ]);
}

test('audio schema: normalized opt-in musicUpload; only canonical local audio URLs survive', () => {
  const fields = normalizeFields([audioField]);
  assert.equal(fields[0].required, false);
  assert.ok(Object.isFrozen(fields[0]));
  const schema = makeSchema(config);
  assert.equal(schema.validate({}).musicUpload, '');
  for (const ext of ['mp3','m4a','ogg','wav']) {
    const url = URL.replace(/mp3$/, ext);
    for (const mode of ['strict', 'draft', 'lenient']) assert.equal(schema.validate({ musicUpload: url }, { mode }).musicUpload, url);
    assert.deepEqual(audioIn(fields, { musicUpload: url }), [url]);
    assert.deepEqual(imagesIn(fields, { musicUpload: url }), []);
  }
  for (const bad of [URL + '?x=1', URL + '#track', URL.toUpperCase(), URL.replace('.mp3','.jpg'), URL.replace('/uploads/', '/uploads/../'), 'https://example.com/a.mp3', 'data:audio/mpeg;base64,aaa', 42, {}, ['x']]) {
    assert.throws(() => schema.validate({ musicUpload: bad }));
    assert.throws(() => schema.validate({ musicUpload: bad }, { mode: 'draft' }));
    assert.equal(schema.validate({ musicUpload: bad }, { mode: 'lenient' }).musicUpload, '');
  }
  assert.equal(makeSchema({ fields: [{ id: 'name', type: 'text', label: 'Name' }] }).validate({ musicUpload: URL }).musicUpload, undefined);
  assert.throws(() => normalizeFields([{ ...audioField, default: URL }]));
  assert.throws(() => normalizeFields([{ ...audioField, id: 'other' }]));
  assert.throws(() => normalizeFields([{ id: 'songs', type: 'list', label: 'Songs', item: audioField }]));
});

test('audio sniffing validates MP3 frames/ID3, M4A audio tracks, Ogg codecs, and RIFF/WAVE chunks', () => {
  for (const [buf, type, ext] of [[mp3(),'audio/mpeg','mp3'], [mp3(true),'audio/mp3','mp3'], [wav(),'audio/wav','wav'], [wav(),'audio/x-wav','wav'], [ogg(),'audio/ogg','ogg'], [ogg('vorbis'),'application/ogg','ogg'], [m4a(),'audio/mp4','m4a']]) {
    assert.equal(sniffAudio(buf), ext);
    assert.equal(checkAudio(buf, type), null);
    assert.equal(checkAudio(buf, 'image/png'), 'invalid_audio');
    assert.equal(checkAudio(buf, ext === 'wav' ? 'audio/mpeg' : 'audio/wav'), 'invalid_audio');
  }
  for (const buf of [Buffer.from('<script>alert(1)</script>'), Buffer.from('ID3\x04\0\0\0\0\0\0'), mp3().subarray(0, 16), wav().subarray(0,44), ogg().subarray(0,30), m4a('vide'), box('ftyp', Buffer.from('M4A \0\0\0\0isom', 'binary'))]) {
    assert.equal(sniffAudio(buf), null);
    assert.equal(checkAudio(buf, 'audio/mpeg'), 'invalid_audio');
  }
  assert.equal(checkAudio(Buffer.alloc(MAX_BYTES + 1), 'audio/wav'), 'too_large');
  const exact = Buffer.alloc(MAX_BYTES); mp3().copy(exact);
  assert.equal(checkAudio(exact, 'audio/mpeg'), null, 'the 15 MiB boundary is inclusive');
});

test('audio wizard emits an upload control without changing link or image controls', () => {
  const { bfdayCreatePage } = require('../pages/bfdayCreate');
  const base = structuredClone(require('./fixtures/bfday-fixture/config'));
  base.fields.push(audioField); base.steps[1].fields.push(audioField.id);
  const schema = makeSchema(base);
  const html = bfdayCreatePage({ slug: base.slug, config: base, fields: schema.FIELDS });
  assert.match(html, /data-audio="musicUpload"/);
  assert.match(html, /MP3, M4A, OGG or WAV, up to 15 MB/);
  assert.match(html, /data-image="cover"/);
  assert.match(html, /id="f-song"/);
  const client = fs.readFileSync(path.join(__dirname, '../public/bfday/create.js'), 'utf8');
  assert.match(client, /upload-audio\?id=/);
  assert.match(client, /controls\[f.id\] = audioControl/);
  assert.match(client, /Song added and saved/);
});

test('audio route: capability gate, CSRF/ownership, size, MIME/header validation, private serving, save, publish and cleanup', async t => {
  // This test process owns a temporary DB, never the developer's persistent DB.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-audio-'));
  const previous = process.env.DATA_DIR;
  process.env.DATA_DIR = dir;
  const { q, db } = require('../db');
  const family = require('../lib/bfday/family');
  const routes = require('../lib/bfdayRoutes');
  const schema = makeSchema(config);
  family.install({ slug: config.slug, fields: schema.FIELDS, schema, config, render: () => 'audio fixture' });
  q.templateInsert({ name: 'Audio fixture', slug: config.slug, category: 'Test', status: 'published', config });
  const noAudio = { ...config, slug: 'no-audio-fixture', fields: [{ id: 'name', label: 'Name', type: 'text' }] };
  const noSchema = makeSchema(noAudio);
  family.install({ slug: noAudio.slug, fields: noSchema.FIELDS, schema: noSchema, config: noAudio, render: () => '' });
  q.templateInsert({ name: 'No audio fixture', slug: noAudio.slug, category: 'Test', status: 'published', config: noAudio });
  let base;
  const server = http.createServer(async (req, res) => {
    if (!await routes.handle(req, res, new global.URL(req.url, base), { baseUrl: base, isAdmin: req.headers['x-test-admin'] === 'yes' })) { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
  t.after(async () => {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    db.close(); fs.rmSync(dir, { recursive: true, force: true });
    if (previous === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = previous;
  });
  const post = (p, cookie, body, type = 'application/json', headers = {}) => fetch(base + p, { method: 'POST', headers: { 'content-type': type, ...(cookie ? { cookie } : {}), ...headers }, body: type === 'application/json' ? JSON.stringify(body) : body });
  async function draft(slug = config.slug) {
    const r = await post(`/api/${slug}/draft`, null, { customer_data: {} });
    assert.equal(r.status, 200);
    return { ...(await r.json()), cookie: r.headers.get('set-cookie').split(';')[0] };
  }
  const a = await draft(), b = await draft(), no = await draft(noAudio.slug);
  const upload = (who, buf = wav(), type = 'audio/wav', headers = {}) => post(`/api/${config.slug}/upload-audio?id=${a.id}`, who, buf, type, headers);
  assert.equal((await upload(null)).status, 403);
  assert.equal((await upload(b.cookie)).status, 403);
  assert.equal((await upload(a.cookie, wav(), 'audio/wav', { origin: 'https://evil.example' })).status, 403);
  assert.equal((await upload(a.cookie, wav(), 'audio/wav', { 'sec-fetch-site': 'cross-site' })).status, 403);
  assert.equal((await post(`/api/${noAudio.slug}/upload-audio?id=${no.id}`, no.cookie, wav(), 'audio/wav')).status, 404);
  assert.equal((await upload(a.cookie, Buffer.from('not audio'))).status, 400);
  assert.equal((await upload(a.cookie, wav(), 'audio/mpeg')).status, 400);
  assert.equal((await upload(a.cookie, wav(), 'text/html')).status, 400);
  assert.equal((await upload(a.cookie, Buffer.alloc(MAX_BYTES + 1))).status, 413);
  const urls = [];
  for (const [buf, type, ext] of [[mp3(),'audio/mpeg','mp3'], [m4a(),'audio/mp4','m4a'], [ogg(),'audio/ogg','ogg'], [wav(),'audio/wav','wav']]) {
    const r = await upload(a.cookie, buf, type); assert.equal(r.status, 200);
    const { url } = await r.json(); urls.push(url);
    assert.match(url, new RegExp('^/bfday/uploads/[a-f0-9]{48}\\.' + ext + '$'));
    const filename = path.join(dir, 'bfday-uploads', path.basename(url));
    assert.deepEqual(fs.readFileSync(filename), buf);
    assert.equal(fs.statSync(filename).mode & 0o777, 0o600);
    assert.equal((await fetch(base + url)).status, 404);
    const own = await fetch(base + url, { headers: { cookie: a.cookie } });
    assert.equal(own.status, 200); assert.equal(own.headers.get('content-type'), type);
    assert.equal(own.headers.get('x-content-type-options'), 'nosniff');
    const range = await fetch(base + url, { headers: { cookie: a.cookie, range: 'bytes=0-7' } });
    assert.equal(range.status, 206); assert.deepEqual(Buffer.from(await range.arrayBuffer()), buf.subarray(0,8));
    assert.equal((await fetch(base + url, { method: 'HEAD', headers: { cookie: a.cookie } })).status, 200);
    assert.equal((await fetch(base + url, { headers: { 'x-test-admin': 'yes' } })).status, 200);
  }
  assert.equal((await post(`/api/${config.slug}/draft`, b.cookie, { id: b.id, customer_data: { musicUpload: urls[0] } })).status, 403, 'no cross-draft reference theft');
  assert.equal((await post(`/api/${config.slug}/draft`, a.cookie, { customer_data: { musicUpload: urls[0] } })).status, 400, 'cannot create a fresh draft with an existing upload');
  assert.equal((await post(`/api/${config.slug}/draft`, a.cookie, { id: a.id, customer_data: { musicUpload: urls[3] } })).status, 200);
  assert.equal(q.paigaamById(a.id).customer_data.musicUpload, urls[3]);
  assert.equal((await post(`/api/${config.slug}/publish`, a.cookie, { id: a.id })).status, 200);
  assert.equal((await fetch(base + urls[3])).status, 200, 'referenced music becomes public on publish');
  for (const url of urls.slice(0,3)) {
    assert.equal((await fetch(base + url)).status, 404);
    assert.ok(!fs.existsSync(path.join(dir, 'bfday-uploads', path.basename(url))), 'replaced files cleaned up');
  }
  assert.equal((await upload(a.cookie)).status, 403, 'published upload is final');
});
