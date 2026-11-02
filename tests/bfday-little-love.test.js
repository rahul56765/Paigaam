'use strict';
// Dependency-free contract + client tests. Run: node --test tests/bfday-little-love.test.js
// Deliberately avoid the HTTP/server harness: it eagerly loads optional sharp.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const config = require('../templates/little-love/config');
const schema = require('../templates/little-love/schema');
const { render } = require('../templates/little-love/render');
const { resolve, imagesIn, audioIn, maxImages, InputError } = require('../lib/bfday/fields');
const { escape } = require('../lib/bfday/page');
const { checkAudio, sniffAudio, MAX_BYTES } = require('../lib/bfday/audio');
const root = path.resolve(__dirname, '..');
const asset = file => fs.readFileSync(path.join(root, 'public/little-love', file), 'utf8');
const script = asset('invite.js');
const css = asset('invite.css');
const image = '/bfday/uploads/' + 'a'.repeat(48) + '.jpg';
const audio = '/bfday/uploads/' + 'b'.repeat(48) + '.mp3';
const htmlFor = (data = config.demo, opts = {}) => render({ slug: 'our-little-love', customer_data: data }, { baseUrl: 'https://paigaam.cc', ...opts });
const invalid = (data, mode = 'strict') => assert.throws(() => schema.validate({ ...config.demo, ...data }, { mode }), e => e instanceof InputError && e.status === 400);
const pagesIn = html => [...html.matchAll(/<section\b[^>]*class="ll-page\b[^>]*>/g)].map(m => m[0]);
const stripIn = html => html.match(/<div class="ll-strip">([\s\S]*?)<\/div>/)[1];

test('Little Love is registered exactly once in the existing PAIGAAM family', () => {
  const registry = require('../templates/bfday');
  const family = require('../lib/bfday/family');
  assert.equal(registry.filter(slug => slug === 'little-love').length, 1);
  assert.deepEqual(family.errors, []);
  assert.equal(family.has('little-love'), true);
  const member = family.bySlug('little-love');
  assert.equal(member.config, config);
  assert.equal(member.schema, schema);
  assert.equal(member.render, render);
  assert.equal(family.isBuiltIn('little-love'), true);
  for (const slug of ['love-letter', 'anniversary-blue', 'diwali-deep']) assert.ok(family.has(slug), `${slug} remains registered`);
  assert.equal(family.displayName('little-love', config.demo), config.demo.senderName);
});

test('five wizard steps place every declared field once, and demo is publishable', () => {
  assert.equal(config.slug, 'little-love');
  assert.equal(config.family, 'bfday');
  assert.equal(config.editable, true);
  assert.equal(config.price, 99);
  assert.equal(config.currency, 'INR');
  assert.equal(config.thumbnail_url, '/little-love/thumbnail.webp');
  assert.equal(config.backgroundMusic, false);
  assert.equal(config.steps.length, 5);
  const placed = config.steps.flatMap(step => step.fields);
  assert.equal(new Set(placed).size, placed.length);
  assert.deepEqual([...placed].sort(), schema.FIELDS.map(f => f.id).sort());
  assert.deepEqual(schema.REQUIRED, ['senderName', 'recipientName']);
  assert.ok(!schema.FIELDS.some(f => f.id === 'bgmSong'));
  assert.doesNotThrow(() => schema.validate(config.demo, { mode: 'strict' }));
  assert.ok(!JSON.stringify(config.demo).includes('/bfday/uploads/'));
  assert.equal(config.create.scenes.length, 5);
});

test('strict publish requires both names; draft permits blanks but not malformed content', () => {
  invalid({ senderName: '' });
  invalid({ recipientName: '  ' });
  const draft = schema.validate({}, { mode: 'draft' });
  assert.equal(draft.senderName, '');
  assert.equal(draft.recipientName, '');
  assert.equal(draft.templateVersion, config.version);
  for (const mode of ['strict', 'draft']) {
    for (const data of [{ senderName: 'x'.repeat(41) }, { loveLetter: 'x'.repeat(901) }, { coverTitle: 'one\ntwo' }, { recipientName: 'name\u0000' }, { portrait: 'https://evil.test/p.jpg' }, { memoryNote: {} }]) invalid(data, mode);
    assert.throws(() => schema.validate(null, { mode }), InputError);
    assert.throws(() => schema.validate([], { mode }), InputError);
  }
});

test('schema whitelists top-level/nested keys without mutating sender data', () => {
  const input = JSON.parse(JSON.stringify({ ...config.demo, unknown: '<script>', bgmSong: 'dQw4w9WgXcQ' }));
  input.photoStrip[0].injected = 'discard';
  const snapshot = JSON.stringify(input);
  const clean = schema.validate(input);
  assert.equal(JSON.stringify(input), snapshot);
  assert.ok(!('unknown' in clean));
  assert.ok(!('bgmSong' in clean));
  assert.ok(!('injected' in clean.photoStrip[0]));
  assert.deepEqual(Object.keys(clean).sort(), ['templateVersion', ...schema.FIELDS.map(f => f.id)].sort());
});

test('lenient preview repairs malformed data and renderer never requires completed drafts', () => {
  const clean = schema.validate({ senderName: 'x'.repeat(80), recipientName: 'a\u0000b', loveLetter: 42, photoStrip: 'bad', musicLink: 'javascript:alert(1)', musicUpload: 'data:audio/mp3,aaa' }, { mode: 'lenient' });
  assert.equal(clean.senderName.length, 40);
  assert.equal(clean.recipientName, 'ab');
  assert.equal(clean.loveLetter, '');
  assert.equal(clean.musicLink, '');
  assert.equal(clean.musicUpload, '');
  for (const data of [undefined, null, [], 42, {}, { photoStrip: [null, {}, false], loveLetter: {} }]) {
    const html = htmlFor(data);
    assert.equal(pagesIn(html).length, 5);
    assert.equal((stripIn(html).match(/<img\b/g) || []).length, 4);
  }
});

test('all five distinct scrapbook pages render in reference order', () => {
  assert.deepEqual(config.sections, ['bouquet', 'letter', 'memories', 'song', 'doodles']);
  const html = htmlFor();
  const pages = pagesIn(html);
  assert.deepEqual(pages.map(tag => /ll-page--([a-z]+)/.exec(tag)[1]), ['cover', 'letter', 'memories', 'song', 'closing']);
  assert.deepEqual(pages.map(tag => Number(/data-page="(\d+)"/.exec(tag)[1])), [0, 1, 2, 3, 4]);
  for (const [i, page] of pages.entries()) {
    assert.match(page, /aria-label="[^"]+"/);
    // Before JS, all content remains available to the no-script fallback.
    assert.match(page, /aria-hidden="(?:false|true)"/);
    assert.equal(/\bis-current\b/.test(page), i === 0);
  }
  for (const marker of ['ll-tulips', 'll-portrait', 'll-letter-copy', 'll-kiss-corner', 'll-penguins', 'll-strip', 'll-song-player', 'll-matcha-cat', 'll-bow-cat', 'll-end-couple', 'll-end-cat', 'll-end-home']) assert.ok(html.includes(marker), marker);
});

test('every editable text field and photo caption is escaped in text and attributes', () => {
  // Short enough for every field, but exercises < > & both quote types.
  const hostile = '<b>"&\'QA</b>';
  const data = { ...config.demo };
  for (const field of schema.FIELDS) if (['text', 'textarea'].includes(field.type)) data[field.id] = hostile;
  data.photoStrip = Array.from({ length: 4 }, () => ({ photo: image, caption: hostile }));
  assert.doesNotThrow(() => schema.validate(data));
  const html = htmlFor(data);
  assert.ok(html.includes(escape(hostile)));
  assert.ok(!html.includes(hostile));
  assert.match(html, /alt="&lt;b&gt;&quot;&amp;&#39;QA&lt;\/b&gt;"/);
  assert.match(html, /<title>&lt;b&gt;/);
  assert.match(html, /aria-label="&lt;b&gt;/);
  const attack = '</script><img src=x onerror=alert(1)>';
  const attacked = htmlFor({ ...config.demo, loveLetter: attack + '\nsecond line', portrait: 'x" onerror="alert(1)', photoStrip: [{ photo: 'javascript:alert(1)', caption: attack }] });
  assert.ok(attacked.includes(escape(attack) + '<br>second line'));
  assert.ok(!attacked.includes(attack));
  assert.doesNotMatch(attacked, /(?:src|href)="(?:javascript:|data:|x")/);
  assert.doesNotMatch(attacked, /<img[^>]+\sonerror=/);
});

test('photo strip has exactly four ordered images with real alt captions', () => {
  const photos = [1, 2, 3, 4].map(n => ({ photo: `/bfday/uploads/${String(n).repeat(48)}.webp`, caption: `Our memory ${n}` }));
  const data = { ...config.demo, photoStrip: photos };
  assert.doesNotThrow(() => schema.validate(data));
  const strip = stripIn(htmlFor(data));
  assert.deepEqual([...strip.matchAll(/src="([^"]+)"/g)].map(m => m[1]), photos.map(p => p.photo));
  assert.deepEqual([...strip.matchAll(/alt="([^"]+)"/g)].map(m => m[1]), photos.map(p => p.caption));
  assert.equal((strip.match(/class="ll-strip-photo"/g) || []).length, 4);
  assert.equal(schema.FIELDS.find(f => f.id === 'photoStrip').minItems, 4);
  assert.equal(schema.FIELDS.find(f => f.id === 'photoStrip').maxItems, 4);
  invalid({ photoStrip: photos.slice(0, 3) });
  invalid({ photoStrip: [...photos, photos[0]] });
  assert.doesNotThrow(() => schema.validate({ ...data, photoStrip: photos.slice(0, 2) }, { mode: 'draft' }));
  for (const photoStrip of [[], photos.slice(0, 2), null]) assert.equal((stripIn(htmlFor({ ...config.demo, photoStrip })).match(/<img\b/g) || []).length, 4);
  assert.equal(maxImages(schema.FIELDS), 7);
  assert.deepEqual(imagesIn(schema.FIELDS, data), photos.map(p => p.photo));
});

test('memory upload accepts only canonical PAIGAAM MP3/M4A/OGG/WAV references', () => {
  assert.equal(schema.FIELDS.find(f => f.id === 'musicUpload').type, 'audio');
  for (const ext of ['mp3', 'm4a', 'ogg', 'wav']) {
    const url = audio.replace(/mp3$/, ext);
    for (const mode of ['strict', 'draft', 'lenient']) assert.equal(schema.validate({ ...config.demo, musicUpload: url }, { mode }).musicUpload, url);
    assert.deepEqual(audioIn(schema.FIELDS, { musicUpload: url }), [url]);
    assert.deepEqual(imagesIn(schema.FIELDS, { musicUpload: url }), []);
    assert.ok(htmlFor({ ...config.demo, musicUpload: url }).includes(`id="llMemoryAudio" src="${url}"`));
  }
  for (const bad of [audio + '?x=1', audio + '#clip', audio.replace('.mp3', '.jpg'), audio.replace('/uploads/', '/uploads/../'), audio.toUpperCase(), 'https://evil.test/a.mp3', 'data:audio/mpeg;base64,aaa', 'blob:fake', 42, {}]) {
    invalid({ musicUpload: bad }); invalid({ musicUpload: bad }, 'draft');
    assert.equal(schema.validate({ musicUpload: bad }, { mode: 'lenient' }).musicUpload, '');
  }
});

test('shared upload validator checks actual audio bytes, MIME and the inclusive 15 MiB cap', () => {
  const mp3 = Buffer.alloc(417); Buffer.from([0xff, 0xfb, 0x90, 0]).copy(mp3);
  assert.equal(sniffAudio(mp3), 'mp3');
  assert.equal(checkAudio(mp3, 'audio/mpeg'), null);
  assert.equal(checkAudio(mp3, 'image/png'), 'invalid_audio');
  assert.equal(checkAudio(Buffer.from('<script>not audio</script>'), 'audio/mpeg'), 'invalid_audio');
  assert.equal(checkAudio(mp3.subarray(0, 16), 'audio/mpeg'), 'invalid_audio');
  const max = Buffer.alloc(MAX_BYTES); mp3.copy(max);
  assert.equal(MAX_BYTES, 15 * 1024 * 1024);
  assert.equal(checkAudio(max, 'audio/mpeg'), null);
  assert.equal(checkAudio(Buffer.alloc(MAX_BYTES + 1), 'audio/mpeg'), 'too_large');
});

test('musicLink accepts HTTPS direct audio, including query strings, and allowlisted YouTube video forms', () => {
  for (const link of ['https://cdn.example.test/our-song.mp3', 'https://cdn.example.test/song.M4A?token=abc&v=2#start', 'https://cdn.example.test/song.ogg', 'https://cdn.example.test/song.wav']) {
    const clean = schema.validate({ ...config.demo, musicLink: link });
    assert.equal(clean.musicLink, link);
    const html = htmlFor(clean);
    assert.ok(html.includes(`id="llSongAudio" src="${escape(link)}"`));
    assert.doesNotMatch(html, /data-youtube="/);
  }
  for (const link of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com/shorts/dQw4w9WgXcQ', 'https://youtube.com/embed/dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ?t=10']) {
    assert.doesNotThrow(() => schema.validate({ ...config.demo, musicLink: link }));
    const html = htmlFor({ ...config.demo, musicLink: link });
    assert.match(html, /data-youtube="dQw4w9WgXcQ"/);
    assert.doesNotMatch(html, /id="llSongAudio" src=/);
    assert.doesNotMatch(html, /<iframe\b/); // Created only in response to a play gesture.
    assert.ok(!/<script[^>]+src="https:\/\/.*youtube/.test(html));
  }
});

test('musicLink rejects insecure schemes, deceptive YouTube hosts and non-audio/social URLs', () => {
  for (const bad of ['http://cdn.example.test/song.mp3', 'http://youtu.be/dQw4w9WgXcQ', '//youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ', 'javascript:alert(1)', 'data:audio/mp3,AAA', 'https://evil.test/watch?v=dQw4w9WgXcQ', 'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ', 'https://youtu.be.evil.test/dQw4w9WgXcQ', 'https://youtube.com@evil.test/watch?v=dQw4w9WgXcQ', 'https://user:password@cdn.example.test/song.mp3', 'https://www.youtube.com/watch?v=short', 'https://open.spotify.com/track/abc', 'https://instagram.com/reel/abc', 'https://cdn.example.test/song.mp3.exe', 'https://cdn.example.test/song?format=mp3', 'https://cdn.example.test/track.mp4']) {
    invalid({ musicLink: bad }); invalid({ musicLink: bad }, 'draft');
    assert.equal(schema.validate({ musicLink: bad }, { mode: 'lenient' }).musicLink, '', bad);
  }
});

test('additional playlist songs reuse the HTTPS/YouTube policy and escape embedded JSON', () => {
  const playlist = [{ title: '</script><b>ours</b>', url: 'https://cdn.example.test/second.mp3' }, { title: 'Video', url: 'https://youtu.be/dQw4w9WgXcQ' }];
  const clean = schema.validate({ ...config.demo, playlist });
  assert.equal(clean.playlist.length, 2);
  const html = htmlFor(clean);
  const json = html.match(/<script type="application\/json" id="llPlaylistData">([\s\S]*?)<\/script>/)[1];
  assert.ok(!json.includes('</script>'));
  assert.equal(JSON.parse(json).length, 3);
  assert.equal(JSON.parse(json)[1].title, playlist[0].title);
  assert.ok(html.includes(escape(playlist[0].title)));
  invalid({ playlist: [{ title: 'Bad', url: 'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ' }] });
  invalid({ playlist: [{ title: 'Bad', url: 'http://cdn.example.test/song.mp3' }] }, 'draft');
  assert.equal(schema.validate({ playlist: [{ title: 'Bad', url: 'https://evil.test/not-audio' }] }, { mode: 'lenient' }).playlist.length, 0);
  invalid({ playlist: Array.from({ length: 5 }, () => playlist[0]) });
});

test('blank music uses the original instrumental; uploaded voice note and song remain independent', () => {
  const html = htmlFor({ ...config.demo, musicUpload: audio, musicLink: 'https://cdn.example.test/ours.wav' });
  assert.match(html, new RegExp(`id="llMemoryAudio" src="${audio}"`));
  assert.match(html, /id="llSongAudio" src="https:\/\/cdn.example.test\/ours.wav"/);
  const blank = htmlFor({ ...config.demo, musicLink: '', musicUpload: '' });
  assert.equal((blank.match(/src="\/little-love\/little-melody\.mp3"/g) || []).length, 2);
  assert.doesNotMatch(blank, /<audio[^>]+(?:autoplay|loop)/);
  assert.match(blank, /preload="metadata"/);
  assert.match(config.fields.find(f => f.id === 'musicUpload').hint, /instrumental demo, not a recorded voice/);
});

test('accessible navigation, named play/seek controls, live status and reduced-motion styling exist', () => {
  const html = htmlFor();
  assert.match(html, /<html lang="en"/);
  assert.match(html, /aria-roledescription="carousel" aria-label="Five-page love card"/);
  assert.match(html, /data-prev aria-label="Previous page" disabled/);
  assert.match(html, /data-next aria-label="Next page"/);
  assert.deepEqual([...html.matchAll(/data-go="(\d)" aria-label="Go to page (\d)"/g)].map(m => [+m[1], +m[2]]), [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]]);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /aria-live="polite" aria-atomic="true"/);
  assert.match(html, /data-audio-status role="status"/);
  for (const kind of ['memory', 'song']) {
    assert.match(html, new RegExp(`data-play="${kind}" aria-label="Play [^"]+" aria-pressed="false"`));
    assert.match(html, new RegExp(`type="range" data-seek="${kind}"[^>]+aria-label="Seek [^"]+"`));
  }
  for (const label of ['Previous song', 'Next song', 'Play song', 'Open music playlist', 'Close playlist']) assert.ok(html.includes(`aria-label="${label}"`));
  for (const button of html.matchAll(/<button\b[^>]*>/g)) assert.match(button[0], /type="button"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /@media\(max-width:600px\) and \(orientation:portrait\)/);
  assert.match(html, /<noscript>/);
});

test('editor uses existing PAIGAAM wizard and upload controls rather than a separate app', () => {
  const { bfdayCreatePage } = require('../pages/bfdayCreate');
  const html = bfdayCreatePage({ slug: config.slug, config, fields: schema.FIELDS }, { price: 0, listPrice: 0 });
  assert.match(html, /data-audio="musicUpload"/);
  assert.match(html, /id="f-musicLink"/);
  assert.match(html, /data-list="photoStrip"/);
  for (const id of ['portrait', 'memoryPhoto', 'songCover']) assert.ok(html.includes(`data-image="${id}"`));
  assert.match(html, /\/bfday\/create\.js/);
  assert.ok(!fs.existsSync(path.join(root, 'public/little-love/package.json')));
});

test('all render/CSS asset references and thumbnail exist; original demo audio is valid MP3', () => {
  const html = htmlFor();
  const urls = new Set([...html.matchAll(/(?:src|href)="(\/little-love\/[^"#?]+)"/g)].map(m => m[1]));
  for (const m of css.matchAll(/url\(['"]?(\/little-love\/[^)'"?#]+)['"]?\)/g)) urls.add(m[1]);
  urls.add(config.thumbnail_url);
  for (const url of urls) {
    const local = path.join(root, 'public', url);
    assert.ok(fs.existsSync(local), `${url} must ship locally`);
    assert.ok(fs.statSync(local).size > 0, `${url} must not be empty`);
  }
  for (const name of ['tulips', 'penguins', 'mini-bouquet', 'matcha-cat', 'bow-cat']) assert.ok(html.includes(`/little-love/${name}.webp`), name);
  for (const filename of ['Pixelify-LICENSE.txt', 'Homemade-Apple-LICENSE.txt']) assert.ok(asset('fonts/' + filename).length > 100);
  const demo = fs.readFileSync(path.join(root, 'public/little-love/little-melody.mp3'));
  assert.equal(sniffAudio(demo), 'mp3');
  assert.equal(checkAudio(demo, 'audio/mpeg'), null);
});

test('no injected browser, screen-recording, social chrome or reference-site runtime survives', () => {
  const source = [htmlFor(), script, css, fs.readFileSync(path.join(root, 'templates/little-love/render.js'), 'utf8')].join('\n');
  assert.doesNotMatch(source, /browserbase|stagehand|playwright|__hyperagent|rrweb|session-replay|screenrecorder|MediaRecorder|getDisplayMedia|chrome-extension:\/\/|tiktok\.com|instagram\.com|facebook\.com|reels?\/|watermark|browser-toolbar|screen-recording/i);
  const scripts = [...htmlFor().matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(scripts, ['/little-love/invite.js']);
  assert.doesNotMatch(script, /document\.write|\.innerHTML\s*=|\beval\(|new Function\(/);
  assert.match(script, /youtube-nocookie\.com/);
  assert.match(script, /event\.source !== iframe\.contentWindow/);
  assert.match(script, /event\.origin !== 'https:\/\/www\.youtube-nocookie\.com'/);
});

test('shared PAIGAAM preview/canonical and social metadata stay intact', () => {
  assert.match(htmlFor(), /rel="canonical" href="https:\/\/paigaam\.cc\/p\/our-little-love"/);
  assert.match(htmlFor(), /og:site_name" content="Paigaam"/);
  const preview = htmlFor(config.demo, { isPreview: true });
  assert.match(preview, /noindex, nofollow, noarchive/);
  assert.match(preview, /bf-previewbadge/);
  assert.doesNotMatch(preview, /rel="canonical"/);
});

// Tiny hand-wired DOM, not a browser emulator. It executes the real invite.js
// with controlled media/timers and selectors present in the generated markup.
function client({ youtube = false, reduced = true, animated = false } = {}) {
  class El {
    constructor() {
      this.listeners = {}; this.attrs = {}; this.dataset = {}; this.disabled = false; this.hidden = false;
      this.textContent = ''; this.value = '0'; this.clientWidth = 800; this.clientHeight = 300;
      this.scrollHeight = 20; this.scrollWidth = 20;
      this.style = { setProperty() {} };
      const classes = new Set();
      this.classList = { add: c => classes.add(c), remove: c => classes.delete(c), toggle: (c, on) => on ? classes.add(c) : classes.delete(c), contains: c => classes.has(c) };
      this.queries = {}; this.lists = {};
    }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    emit(type, event = {}) { for (const fn of this.listeners[type] || []) fn({ type, target: this, ...event }); }
    click() { if (!this.disabled) this.emit('click'); }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    removeAttribute(k) { delete this.attrs[k]; }
    getAttribute(k) { return this.attrs[k]; }
    querySelector(q) { return this.queries[q] || null; }
    querySelectorAll(q) { return this.lists[q] || []; }
    closest() { return null; }
    focus() { focused = this; }
    appendChild(child) { this.child = child; }
    contains(child) { return child === this; }
    remove() {}
    load() {}
  }
  let focused = null;
  const doc = new El(), win = new El(), card = new El(), box = new El(), copy = new El();
  box.queries.p = copy; card.queries['[data-fit]'] = box;
  const pages = Array.from({ length: 5 }, () => { const e = new El(); e.queries['h1,h2'] = new El(); return e; });
  card.lists['[data-page]'] = pages;
  const dots = Array.from({ length: 5 }, (_, i) => { const e = new El(); e.dataset.go = String(i); return e; });
  const opens = [new El(), new El()]; card.lists['[data-open]'] = opens;
  const prev = new El(), next = new El(), count = new El(), replay = new El(), status = new El(), disc = new El(), host = new El();
  Object.assign(doc.queries, { '[data-prev]': prev, '[data-next]': next, '[data-current]': count, '[data-replay]': replay, '[data-audio-status]': status, '[data-disc]': disc, '[data-youtube-host]': host });
  doc.lists['[data-go]'] = dots;
  const ytCard = new El(); ytCard.dataset.youtube = 'dQw4w9WgXcQ';
  card.queries['.ll-song-player'] = ytCard;
  card.queries['[data-youtube]'] = youtube ? ytCard : null;
  if (!youtube) delete ytCard.dataset.youtube;
  ytCard.queries['.ll-song-title'] = new El();
  const panel = new El(); panel.hidden = true;
  const playlistData = new El(); playlistData.textContent = JSON.stringify([{ title: 'Our song', url: youtube ? 'https://youtu.be/dQw4w9WgXcQ' : '/little-love/little-melody.mp3' }]);
  doc.queries['[data-playlist-close]'] = new El();
  doc.lists['[data-track]'] = []; doc.lists['[data-track-step]'] = [];
  const media = {};
  for (const kind of ['memory', 'song']) {
    const m = new El(); m.paused = true; m.duration = 100; m.currentTime = 0; m.src = '/little-love/little-melody.mp3';
    m.pause = () => { m.paused = true; m.emit('pause'); };
    m.play = () => { m.paused = false; m.emit('playing'); return Promise.resolve(); };
    media[kind] = m;
    const seek = new El(), elapsed = new El(), duration = new El(), player = new El();
    seek.closest = () => player;
    doc.queries[`[data-seek="${kind}"]`] = seek;
    doc.queries[`[data-elapsed="${kind}"]`] = elapsed;
    doc.queries[`[data-duration="${kind}"]`] = duration;
    const buttons = Array.from({ length: kind === 'song' ? 2 : 1 }, () => { const e = new El(); e.dataset.play = kind; e.queries['[data-play-icon]'] = new El(); return e; });
    doc.lists[`[data-play="${kind}"]`] = buttons;
  }
  doc.lists['[data-play]'] = [...doc.lists['[data-play="memory"]'], ...doc.lists['[data-play="song"]']];
  const skips = [-10, 10].map(n => { const e = new El(); e.dataset.skip = String(n); return e; }); doc.lists['[data-skip]'] = skips;
  doc.getElementById = id => ({ llCard: card, llMemoryAudio: media.memory, llSongAudio: media.song, llPlaylist: panel, llPlaylistData: playlistData })[id] || null;
  if (youtube) media.song.duration = NaN;
  doc.body = new El();
  const messages = [];
  doc.createElement = () => { const e = new El(); e.contentWindow = { postMessage: (data, origin) => messages.push({ data: JSON.parse(data), origin }) }; return e; };
  const timers = new Map(); let timerId = 0;
  const reduce = new El(); reduce.matches = reduced;
  let finishAnimation;
  if (animated) {
    const animate = () => ({ finished: new Promise(r => { finishAnimation = r; }), cancel() {} });
    card.animate = animate;
    for (const page of pages) page.animate = animate;
  }
  const context = { document: doc, window: win, matchMedia: query => query.includes('prefers-reduced-motion') ? reduce : { matches: false }, location: { origin: 'https://paigaam.cc' }, setTimeout: (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId; }, clearTimeout: id => timers.delete(id), console };
  vm.runInNewContext(script, context, { filename: 'little-love/invite.js' });
  return { doc, win, card, pages, dots, opens, prev, next, count, replay, disc, panel, media, status, host, messages, skips, reduce, timers, focus: () => focused, finishAnimation: () => finishAnimation(), tick: ms => { for (const [id, t] of [...timers]) if (t.ms <= ms) { timers.delete(id); t.fn(); } } };
}

test('client executes opening, arrows, dots, keyboard, swipe and replay with accessible state', () => {
  const c = client();
  assert.equal(c.count.textContent, '1'); assert.equal(c.prev.disabled, true);
  assert.ok(c.pages.slice(1).every(p => p.inert));
  c.opens[0].click(); assert.equal(c.count.textContent, '2'); assert.equal(c.focus(), c.pages[1].querySelector('h1,h2'));
  c.next.click(); assert.equal(c.count.textContent, '3');
  c.prev.click(); assert.equal(c.count.textContent, '2');
  c.dots[4].click(); assert.equal(c.count.textContent, '5'); assert.equal(c.next.disabled, true); assert.equal(c.replay.hidden, false);
  assert.equal(c.dots[4].getAttribute('aria-current'), 'page');
  assert.equal(c.pages[4].getAttribute('aria-hidden'), 'false');
  c.replay.click(); assert.equal(c.count.textContent, '1');
  const key = (key, target = new (c.card.constructor)()) => c.doc.emit('keydown', { key, target, preventDefault() {} });
  key('End'); assert.equal(c.count.textContent, '5'); key('Home'); assert.equal(c.count.textContent, '1');
  key('ArrowRight'); assert.equal(c.count.textContent, '2'); key('ArrowLeft'); assert.equal(c.count.textContent, '1');
  key('ArrowRight', { closest: () => ({}) }); assert.equal(c.count.textContent, '1', 'range/input keys must not flip pages');
  c.card.emit('pointerdown', { clientX: 200, clientY: 40, pointerId: 1 });
  c.card.emit('pointerup', { clientX: 100, clientY: 42, pointerId: 1 }); assert.equal(c.count.textContent, '2');
  c.card.emit('pointerdown', { clientX: 200, clientY: 40, pointerId: 2 });
  c.card.emit('pointerup', { clientX: 190, clientY: 200, pointerId: 2 }); assert.equal(c.count.textContent, '2', 'vertical movement is not a turn');
});

test('animated turn locks duplicate navigation, swaps halfway, and unlocks after completion', async () => {
  const c = client({ reduced: false, animated: true });
  c.next.click(); assert.equal(c.next.disabled, true); assert.ok(c.dots.every(dot => dot.disabled));
  c.next.click(); assert.equal(c.count.textContent, '1');
  // Do not pin the motion designer's exact duration: execute the swap timer.
  assert.ok(c.timers.size > 0);
  c.tick(Math.max(...[...c.timers.values()].map(t => t.ms))); assert.equal(c.count.textContent, '2');
  c.finishAnimation(); await Promise.resolve(); await Promise.resolve();
  assert.equal(c.next.disabled, false); assert.equal(c.prev.disabled, false);
  assert.equal(c.card.classList.contains('is-turning'), false);
  c.next.click(); c.reduce.matches = true; c.reduce.emit('change');
  assert.equal(c.next.disabled, false, 'changing reduced motion must release the lock');
});

test('playlist opens without starting audio and supports close/Escape with focus restored', () => {
  const c = client();
  c.disc.click();
  assert.equal(c.panel.hidden, false);
  assert.equal(c.disc.getAttribute('aria-expanded'), 'true');
  assert.equal(c.media.song.paused, true);
  c.doc.queries['[data-playlist-close]'].click();
  assert.equal(c.panel.hidden, true); assert.equal(c.focus(), c.disc);
  c.disc.click(); c.doc.emit('keydown', { key: 'Escape' });
  assert.equal(c.panel.hidden, true); assert.equal(c.focus(), c.disc);
});

test('native audio is gesture-only, mutually exclusive, seekable, pausable and stopped on page/visibility changes', async () => {
  const c = client();
  const memoryPlay = c.doc.lists['[data-play="memory"]'][0];
  assert.equal(c.media.memory.paused, true); assert.equal(c.media.song.paused, true);
  memoryPlay.click(); assert.equal(c.media.memory.paused, false); assert.equal(memoryPlay.getAttribute('aria-pressed'), 'true');
  c.doc.lists['[data-play="song"]'][0].click(); assert.equal(c.media.memory.paused, true); assert.equal(c.media.song.paused, false);
  c.media.song.currentTime = 50; c.media.song.emit('loadedmetadata');
  const seek = c.doc.queries['[data-seek="song"]']; assert.equal(seek.disabled, false);
  seek.value = '750'; seek.emit('input'); assert.equal(c.media.song.currentTime, 75);
  seek.value = '1000'; seek.emit('input'); assert.equal(c.media.song.currentTime, 100);
  c.next.click(); assert.equal(c.media.song.paused, true);
  c.doc.lists['[data-play="song"]'][0].click(); c.doc.hidden = true; c.doc.emit('visibilitychange'); assert.equal(c.media.song.paused, true);
  c.media.song.play = () => Promise.reject(new Error('blocked'));
  c.doc.lists['[data-play="song"]'][0].click(); await Promise.resolve(); await Promise.resolve();
  assert.match(c.status.textContent, /could not start/);
  c.media.memory.emit('error'); assert.match(c.status.textContent, /unavailable/);
});

test('YouTube loads only on tap and rejects forged cross-origin/source messages', () => {
  const c = client({ youtube: true });
  assert.equal(c.host.child, undefined);
  c.doc.lists['[data-play="song"]'][0].click(); const iframe = c.host.child;
  assert.ok(iframe); assert.match(iframe.src, /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/);
  assert.match(iframe.title, /YouTube/);
  const data = { event: 'infoDelivery', info: { duration: 120, currentTime: 30, playerState: 1 } };
  const message = (source, origin, payload = data) => c.win.emit('message', { source, origin, data: payload });
  message(iframe.contentWindow, 'https://evil.test'); assert.notEqual(c.disc.getAttribute('aria-pressed'), 'true');
  message({}, 'https://www.youtube-nocookie.com'); assert.notEqual(c.disc.getAttribute('aria-pressed'), 'true');
  message(iframe.contentWindow, 'https://www.youtube-nocookie.com', '{bad json');
  message(iframe.contentWindow, 'https://www.youtube-nocookie.com'); assert.equal(c.disc.getAttribute('aria-pressed'), 'true');
  assert.equal(c.doc.queries['[data-duration="song"]'].textContent, '2:00');
  const seek = c.doc.queries['[data-seek="song"]']; seek.value = '500'; seek.emit('input');
  assert.equal(c.messages.at(-1).data.func, 'seekTo');
  assert.deepEqual(c.messages.at(-1).data.args, [60, true]);
  c.next.click(); assert.equal(c.messages.at(-1).data.func, 'pauseVideo');
  assert.ok(c.messages.every(m => m.origin === 'https://www.youtube-nocookie.com'));
});

test('regression: a late YouTube onReady must not restart playback after navigating away', () => {
  const c = client({ youtube: true });
  c.doc.lists['[data-play="song"]'][0].click(); const iframe = c.host.child;
  c.next.click();
  const before = c.messages.length;
  c.win.emit('message', { source: iframe.contentWindow, origin: 'https://www.youtube-nocookie.com', data: { event: 'onReady' } });
  assert.ok(!c.messages.slice(before).some(m => m.data.func === 'playVideo'), 'onReady after pause/navigation must preserve the stopped state');
});

for (const [providerState, label] of [[0, 'completion'], [2, 'pause in the embedded player']]) {
  test(`regression: one click replays YouTube after ${label}`, () => {
    const c = client({ youtube: true });
    const button = c.doc.lists['[data-play="song"]'][0];
    button.click(); const iframe = c.host.child;
    const send = data => c.win.emit('message', { source: iframe.contentWindow, origin: 'https://www.youtube-nocookie.com', data });
    send({ event: 'onReady' });
    send({ event: 'onStateChange', info: 1 });
    send({ event: 'onStateChange', info: providerState });
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    button.click();
    assert.equal(c.messages.at(-1).data.func, 'playVideo', 'the displayed Play action must not send pauseVideo');
  });
}

test('regression: embedded play resumes after a provider pause but late playback cannot undo navigation cancellation', () => {
  const c = client({ youtube: true });
  c.doc.lists['[data-play="song"]'][0].click(); const iframe = c.host.child;
  const send = data => c.win.emit('message', { source: iframe.contentWindow, origin: 'https://www.youtube-nocookie.com', data });
  send({ event: 'onReady' }); send({ event: 'onStateChange', info: 1 });
  send({ event: 'onStateChange', info: 2 });
  const before = c.messages.length;
  send({ event: 'onStateChange', info: 1 });
  assert.equal(c.disc.getAttribute('aria-pressed'), 'true');
  assert.ok(!c.messages.slice(before).some(m => m.data.func === 'pauseVideo'));
  c.next.click(); const cancelled = c.messages.length;
  send({ event: 'onStateChange', info: 1 });
  assert.ok(c.messages.slice(cancelled).some(m => m.data.func === 'pauseVideo'));
  assert.equal(c.disc.getAttribute('aria-pressed'), 'false');
});
