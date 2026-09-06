'use strict';
// Ganpati Courtyard test suite: caption engine, schema, API lifecycle, export.
// Run: node --test tests/courtyard-api.test.js (a live server is provided by
// scripts/test-courtyard.js, which also drives the restart/persistence check).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { buildCues, assFor, familyLine, withDefaults, DEFAULTS } = require('../templates/ganpati-courtyard/captions');
const { validate, InputError } = require('../templates/ganpati-courtyard/schema');

const BASE = process.env.COURTYARD_BASE_URL || 'http://127.0.0.1:3999';
const SLUG = 'ganpati-courtyard';

/* ---------------- caption engine ---------------- */

test('untouched data yields the designed Marathi card', () => {
  const cues = buildCues({});
  assert.equal(cues.length, 4);
  assert.equal(cues[0].lines[0].text, DEFAULTS.greeting);
  assert.equal(cues[1].lines[0].text, DEFAULTS.mainTitle);
  assert.equal(cues[2].lines[0].text, familyLine(DEFAULTS.familyName));
  assert.equal(cues[3].lines[0].text, 'गणपती आगमन');
  assert.ok(cues[3].lines[1].text.includes(DEFAULTS.eventDate));
  assert.ok(cues[3].lines[2].text.includes(DEFAULTS.venueName));
});

test('cue timings follow the agreed composition (0-2/2-5/5-8/8-10)', () => {
  const [a, b, c, d] = buildCues({}).map((cue) => [cue.start, cue.end]);
  assert.deepEqual([a[0], a[1]], [0.05, 2.0]);
  assert.deepEqual([b[0], b[1]], [2.0, 5.0]);
  assert.deepEqual([c[0], c[1]], [5.0, 8.0]);
  assert.deepEqual([d[0], d[1]], [8.0, 9.9]);
});

test('family name wraps into the fixed line', () => {
  assert.equal(familyLine('देशमुख'), 'आमच्या देशमुख परिवारातर्फे');
  assert.equal(familyLine('  '), familyLine(''));
  assert.ok(familyLine('').includes(DEFAULTS.familyName));
});

test('all captions sit inside the upper safe area (never over the procession)', () => {
  for (const cue of buildCues({})) {
    for (const line of cue.lines) {
      assert.ok(line.y >= 150 && line.y <= 545, `y=${line.y} outside the 150-545 sky band`);
    }
  }
});

test('long values shrink instead of overflowing', () => {
  const long = 'अतिशय दीर्घ नाव जे बरेच जात आहे पण अजून संपत नाही';
  const ass = assFor({ familyName: long, mainTitle: long });
  const hero = ass.split('\n').find((l) => l.includes(long.slice(0, 6)) && l.includes('fs'));
  const fam = ass.split('\n').find((l) => l.includes('आमच्या अतिशय'));
  assert.ok(hero && /fs(\d+)/.test(hero) && Number(hero.match(/fs(\d+)/)[1]) < 68, 'hero shrank below its base size in the burned-in captions');
  assert.ok(fam && /fs(\d+)/.test(fam) && Number(fam.match(/fs(\d+)/)[1]) < 41, 'family line shrank below its base size');
});

test('ASS escapes braces, backslashes and control characters', () => {
  const ass = assFor({ familyName: 'na{\\}me\u0007bad', greeting: '॥ श्री गणेशाय नमः ॥' });
  const dialogue = ass.split('\n').filter((l) => l.startsWith('Dialogue')).join('\n');
  assert.ok(!dialogue.includes('{\\}'), 'no raw override braces from user text');
  assert.ok(!dialogue.includes('\u0007'));
  assert.ok(ass.includes('PlayResX: 720'));
});

/* ---------------- schema ---------------- */

test('validate: blanks become defaults, unknown keys are dropped', () => {
  const clean = validate({ familyName: 'देशमुख', evil: '<script>', city: 'पुणे' });
  assert.equal(clean.familyName, 'देशमुख');
  assert.equal(clean.city, 'पुणे');
  assert.equal(clean.evil, undefined);
  assert.ok('greeting' in clean, 'all seven fields always persist');
});

test('validate: rejects oversized, non-string and control-char input', () => {
  assert.throws(() => validate({ familyName: 'x'.repeat(61) }), InputError);
  assert.throws(() => validate({ familyName: 42 }), InputError);
  assert.throws(() => validate({ city: 'bad\u0000nul' }), InputError);
  assert.throws(() => validate('not an object'), InputError);
  assert.throws(() => validate(null), InputError);
});

/* ---------------- media integrity ---------------- */

test('assets decode to the checksummed originals', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/ganpati-courtyard/manifest.json'), 'utf8'));
  const { createHash } = require('node:crypto');
  const dir = path.join(__dirname, '../assets/ganpati-courtyard/');
  for (const [name, expected] of Object.entries(manifest)) {
    // Large assets may be split across .partN files (git-transfer size limits).
    const parts = fs.readdirSync(dir).filter((f) => f.startsWith(name + '.b64.part')).sort();
    const b64 = parts.length
      ? parts.map((p) => fs.readFileSync(path.join(dir, p), 'utf8').trim()).join('')
      : fs.readFileSync(path.join(dir, name + '.b64'), 'utf8').trim();
    const bytes = Buffer.from(b64, 'base64');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, name + ' round-trips');
  }
  assert.ok(manifest['courtyard.mp4'], 'the source video is shipped');
  assert.ok(manifest['TiroDevanagariMarathi-Regular.ttf'], 'the Devanagari font is shipped');
});

/* ---------------- live API (server from scripts/test-courtyard.js) ---------------- */

async function api(method, url, { body, cookie, origin = BASE } = {}) {
  const r = await fetch(BASE + url, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(method === 'POST' ? { origin } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r;
}

test('live: full lifecycle — draft, preview, publish, export, download, re-download', { skip: !process.env.COURTYARD_BASE_URL }, async () => {
  let r = await api('POST', '/api/ganpati-courtyard/draft', { body: { customer_data: { familyName: 'पडताळणी', city: 'पुणे' } } });
  assert.equal(r.status, 200);
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const { id } = await r.json();

  r = await api('GET', `/ganpati-courtyard/preview/${id}`, { cookie });
  assert.equal(r.status, 200);
  const previewHtml = await r.text();
  assert.ok(previewHtml.includes('COURTYARD_TIMELINE'), 'editor carries the shared timeline');
  assert.ok(previewHtml.includes('पडताळणी'), 'preview restores the saved field');

  r = await api('POST', '/api/ganpati-courtyard/publish', { cookie, body: { id } });
  assert.equal(r.status, 200);
  const { slug, url } = await r.json();
  assert.ok(slug.startsWith('ganpati-'));

  r = await api('POST', '/api/ganpati-courtyard/export', { cookie, body: { id } });
  assert.equal(r.status, 200);
  const { url: videoUrl } = await r.json();

  r = await fetch(BASE + videoUrl);
  assert.equal(r.status, 200);
  const bytes = Buffer.from(await r.arrayBuffer());
  assert.ok(bytes.length > 100000, 'a real video came back');
  const out = path.join('/tmp', `courtyard-e2e-${id}.mp4`);
  fs.writeFileSync(out, bytes);
  const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,codec_type:format=duration', '-of', 'csv', out]).toString();
  assert.ok(probe.includes('h264,video'), 'h264 video stream present');
  assert.ok(probe.includes('aac,audio'), 'original audio preserved (not muted)');
  assert.ok(Math.abs(parseFloat(probe.split(',').pop()) - 10.0) < 0.2, 'duration is the original ~10s');
  fs.rmSync(out, { force: true });

  r = await fetch(url);
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.ok(html.includes('Download this video'), 'public page offers the download');
  assert.ok(html.includes(videoUrl.split('/').pop()), 'public page points at the rendered file');
});

test('live: ownership — strangers cannot export drafts or edit', { skip: !process.env.COURTYARD_BASE_URL }, async () => {
  let r = await api('POST', '/api/ganpati-courtyard/draft', { body: { customer_data: { familyName: 'मालक' } } });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const { id } = await r.json();

  r = await api('POST', '/api/ganpati-courtyard/export', { body: { id } });
  assert.equal(r.status, 403);
  r = await api('GET', `/ganpati-courtyard/preview/${id}`);
  assert.equal(r.status, 403);
  r = await api('GET', `/api/ganpati-courtyard/paigaam/${id}`);
  assert.equal(r.status, 403);

  r = await api('POST', '/api/ganpati-courtyard/export', { cookie, body: { id } });
  assert.equal(r.status, 200, 'the owner can export');
});

test('live: CSRF cross-site writes refused', { skip: !process.env.COURTYARD_BASE_URL }, async () => {
  const r = await api('POST', '/api/ganpati-courtyard/draft', { body: { customer_data: {} }, origin: 'https://evil.example' });
  assert.equal(r.status, 403);
});

test('live: generic endpoints refuse courtyard paigaams', { skip: !process.env.COURTYARD_BASE_URL }, async () => {
  let r = await api('POST', '/api/ganpati-courtyard/draft', { body: { customer_data: { familyName: 'नकाशा' } } });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const { id } = await r.json();
  r = await api('POST', '/api/free-publish', { cookie, body: { id } });
  assert.equal(r.status, 403);
  r = await api('POST', '/api/render-preview', { cookie, body: { id, template: SLUG } });
  assert.equal(r.status, 403, 'generic preview refuses');
});
