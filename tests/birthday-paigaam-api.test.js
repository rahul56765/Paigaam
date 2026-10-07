'use strict';
// Birthday Paigaam API checks. Run via: node scripts/test-birthday-paigaam.js
const test = require('node:test');
const assert = require('node:assert/strict');
const base = process.env.BP_BASE_URL;
if (!base) throw new Error('BP_BASE_URL not set — run scripts/test-birthday-paigaam.js');

const JSONH = { 'content-type': 'application/json' };
async function post(path, body, headers = {}) {
  return fetch(base + path, { method: 'POST', headers: { ...JSONH, ...headers }, body: JSON.stringify(body) });
}
async function draft(data, cookie, id) {
  const r = await post('/api/birthday-paigaam/draft', { id, customer_data: data }, cookie ? { cookie } : {});
  const set = r.headers.get('set-cookie');
  return { r, cookie: cookie || (set ? set.split(';')[0] : null), body: await r.json().catch(() => ({})) };
}
// A tiny valid JPEG (64x64, generated once) and minimal audio signatures.
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAgAAAQABAAD//gAPTGF2YzYxLjMuMTAwAP/bAEMACBAQExATFhYWFhYWGhgaGxsbGhoaGhsbGx0dHSIiIh0dHRsbHR0gICIiJSYlIyMiIyYmKCgoMDAuLjg4OkVFU//EAE0AAQEAAAAAAAAAAAAAAAAAAAAHAQEBAQAAAAAAAAAAAAAAAAAAAwUQAQAAAAAAAAAAAAAAAAAAAAARAQAAAAAAAAAAAAAAAAAAAAD/wAARCABAAEADASIAAhEAAxEA/9oADAMBAAIRAxEAPwCqAIt8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//2Q==', 'base64');
const MP3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(64, 1)]);
const WAV = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(40)]);
async function upload(id, kind, buf, type, cookie) {
  return fetch(`${base}/api/birthday-paigaam/upload?id=${id}&kind=${kind}`, { method: 'POST', headers: { 'content-type': type, cookie }, body: buf });
}

test('demo, wizard and thumbnail render', async () => {
  for (const p of ['/birthday-paigaam/demo', '/create/birthday-paigaam', '/template-view/birthday-paigaam', '/templates/birthday-paigaam']) {
    const r = await fetch(base + p);
    assert.equal(r.status, 200, p);
  }
  const html = await (await fetch(base + '/birthday-paigaam/demo')).text();
  for (const s of ['unlock', 'question', 'letter', 'voice', 'song', 'scrapbook', 'finale']) assert.ok(html.includes(`data-screen="${s}"`), 'demo has ' + s);
  assert.ok(!html.includes('"1234"'), 'the passcode is never in the page in plain text');
  assert.ok(html.includes('bp-cameo') && html.includes('bp-frame__empty'), 'the cameo frame waits for a photo');
  assert.ok(!html.includes('bp-cat') && !html.includes('bp-portrait.jpg'), 'no cartoon cat or stand-in portrait in the frame');
  assert.ok(html.includes('bp-env__ribbon') && html.includes('bp-flap__face--in'), 'the new envelope (ribbon + lace liner) renders');
});

test('draft → validation, defaults, escaping, ownership', async () => {
  let { r, cookie, body } = await draft({ recipientName: '<b>Meher</b>', senderName: 'Rahul', letter: 'Hi [NAME]!\n\nLine two', passcode: '0712' });
  assert.equal(r.status, 200);
  assert.ok(cookie && body.id);
  const id = body.id;
  let page = await (await fetch(base + body.previewUrl, { headers: { cookie } })).text();
  assert.ok(page.includes('&lt;b&gt;Meher&lt;/b&gt;'), 'names are escaped');
  assert.ok(!page.includes('<b>Meher</b>'));
  assert.ok(page.includes('Hi &lt;b&gt;Meher&lt;/b&gt;!'), '[NAME] is filled in');
  assert.ok(page.includes('Forever yours,'), 'default sign-off used');
  // someone else cannot see or edit it
  assert.equal((await fetch(base + body.previewUrl)).status, 403);
  const other = await draft({ recipientName: 'X' }, null, id);
  assert.equal(other.r.status, 403);
  // bad values are refused
  for (const bad of [{ passcode: '12a4' }, { passcode: '12345' }, { recipientName: 'x'.repeat(41) }, { palette: { accent: 'red' } }, { font: 'comic' }, { photos: [{ url: 'https://evil.example/x.jpg' }] }, { whatsapp: 'call me' }, { candles: 12 }, { birthdayDate: '2024-02-30' }, { noMessages: Array(11).fill('no') }, { photoFocus: { x: 150 } }, { photoFocus: { y: 'top' } }, { recipientName: 'a\u0007' }]) {
    const res = await draft({ recipientName: 'Meher', ...bad }, cookie, id);
    assert.equal(res.r.status, 400, JSON.stringify(bad));
  }
  // unknown keys never persist
  await draft({ recipientName: 'Meher', evil: '<script>' }, cookie, id);
  page = await (await fetch(base + body.previewUrl, { headers: { cookie } })).text();
  assert.ok(!page.includes('evil'));
});

test('cross-site posts are refused', async () => {
  const r = await post('/api/birthday-paigaam/draft', { customer_data: { recipientName: 'A' } }, { origin: 'https://evil.example' });
  assert.equal(r.status, 403);
});

test('uploads: sniffed by bytes, private until published, own-draft only', async () => {
  const { cookie, body } = await draft({ recipientName: 'Asha' });
  const id = body.id;
  // photo
  let r = await upload(id, 'photo', JPEG, 'image/jpeg', cookie);
  assert.equal(r.status, 200);
  const photo = (await r.json()).url;
  assert.match(photo, /^\/birthday-paigaam\/media\/[a-f0-9]{48}\.jpg$/);
  // lying content type / junk bytes
  assert.equal((await upload(id, 'photo', Buffer.from('not an image at all, honestly'), 'image/jpeg', cookie)).status, 400);
  assert.equal((await upload(id, 'voice', Buffer.from('<html>definitely not audio</html>'), 'audio/mpeg', cookie)).status, 400);
  assert.equal((await upload(id, 'song', MP3, 'text/html', cookie)).status, 400);
  // audio
  r = await upload(id, 'voice', WAV, 'audio/wav', cookie); assert.equal(r.status, 200);
  const voice = (await r.json()).url; assert.match(voice, /\.wav$/);
  r = await upload(id, 'song', MP3, 'audio/mpeg', cookie); assert.equal(r.status, 200);
  const songUrl = (await r.json()).url; assert.match(songUrl, /\.mp3$/);
  // someone else cannot upload into it or read the files
  assert.equal((await upload(id, 'photo', JPEG, 'image/jpeg', '')).status, 403);
  assert.equal((await fetch(base + photo)).status, 404, 'private before publish');
  assert.equal((await fetch(base + photo, { headers: { cookie } })).status, 200, 'owner can see it');
  // save it, with captions
  let d = await draft({ recipientName: 'Asha', mainPhoto: photo, voiceUrl: voice, songUrl: songUrl, songTitle: 'Our tune', photos: [{ url: photo, caption: 'beach', back: 'secret!' }] }, cookie, id);
  assert.equal(d.r.status, 200);
  // another draft cannot reference these files
  const other = await draft({ recipientName: 'Ravi' }, cookie);
  const steal = await draft({ recipientName: 'Ravi', mainPhoto: photo }, cookie, other.body.id);
  assert.equal(steal.r.status, 400);
  // live preview only shows the owner's own uploads
  let lp = await (await post('/birthday-paigaam/preview-frame', { id, screen: 'scrapbook', customer_data: { recipientName: 'Asha', photos: [{ url: photo, caption: 'beach' }] } }, { cookie })).text();
  assert.ok(lp.includes(photo));
  lp = await (await post('/birthday-paigaam/preview-frame', { id, screen: 'scrapbook', customer_data: { recipientName: 'Asha', photos: [{ url: photo, caption: 'beach' }] } })).text();
  assert.ok(!lp.includes(photo), 'strangers do not get the photo in a preview');
  // publish → public
  r = await post('/api/birthday-paigaam/publish', { id }, { cookie });
  assert.equal(r.status, 200);
  const pub = await r.json();
  assert.match(pub.slug, /^birthday-paigaam-[a-f0-9]{18}$/);
  const page = await (await fetch(pub.url)).text();
  assert.ok(page.includes('Our tune') && page.includes('secret!') && page.includes(voice));
  assert.ok(page.includes('data-screen="voice"'), 'voice screen appears once a voice note exists');
  assert.equal((await fetch(base + photo)).status, 200, 'public after publish');
  const range = await fetch(base + songUrl, { headers: { range: 'bytes=0-9' } });
  assert.equal(range.status, 206, 'audio supports range requests (seeking, iOS)');
  // published pages can no longer be edited; publishing again is idempotent
  assert.equal((await draft({ recipientName: 'Changed' }, cookie, id)).r.status, 403);
  const again = await (await post('/api/birthday-paigaam/publish', { id }, { cookie })).json();
  assert.equal(again.slug, pub.slug);
});

test('screens can be switched off; voice screen skipped without a recording', async () => {
  const { cookie, body } = await draft({ recipientName: 'Neha', screens: { question: false, song: false, cake: false } });
  const page = await (await fetch(base + body.previewUrl, { headers: { cookie } })).text();
  assert.ok(!page.includes('data-screen="question"'));
  assert.ok(!page.includes('data-screen="song"'));
  assert.ok(!page.includes('data-screen="voice"'));
  assert.ok(!page.includes('class="bp-cake"'));
  assert.ok(page.includes('data-screen="letter"') && page.includes('data-screen="finale"'));
});

test('publishing requires their name', async () => {
  const { cookie, body } = await draft({ senderName: 'Only me' });
  const r = await post('/api/birthday-paigaam/publish', { id: body.id }, { cookie });
  assert.equal(r.status, 400);
});

test('generic endpoints refuse Birthday Paigaam', async () => {
  const { cookie, body } = await draft({ recipientName: 'Zoya' });
  assert.equal((await post('/api/free-publish', { id: body.id }, { cookie })).status, 403);
  assert.equal((await post('/api/drafts', { template: 'birthday-paigaam', customer_data: {} })).status, 403);
  assert.equal((await post('/api/render-preview', { template: 'birthday-paigaam', customer_data: {} })).status, 403);
  const wa = await fetch(base + '/go/whatsapp/' + body.id, { redirect: 'manual' });
  assert.equal(wa.status, 403);
});
