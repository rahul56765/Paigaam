'use strict';
// Run: node --test tests/bfday-worlds.test.js
// Pure-logic checks for Meri Duniya, Khulta and Aakhri Sawaal, plus the
// engine's `date` field type they introduced.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeSchema, isRealDate } = require('../lib/bfday/fields');
const duniya = require('../templates/meri-duniya/render');
const duniyaConfig = require('../templates/meri-duniya/config');
const khulta = require('../templates/khulta/render');
const sawaal = require('../templates/aakhri-sawaal/render');

test('date field: real calendar days only', () => {
  assert.ok(isRealDate('2026-10-03'));
  assert.ok(isRealDate('2028-02-29'));
  for (const bad of ['2026-02-30', '2026-13-01', '26-10-03', '2026-10-3', '', 'tomorrow']) assert.ok(!isRealDate(bad), bad);
  const s = makeSchema({ slug: 'x', fields: [{ id: 'd', type: 'date', label: 'D' }] });
  assert.equal(s.validate({ d: '2026-10-03' }).d, '2026-10-03');
  assert.throws(() => s.validate({ d: '2026-02-30' }));
  assert.equal(s.validate({ d: '2026-02-30' }, { mode: 'lenient' }).d, '');
});

test('Music plays in the browser: YouTube song links render inline embeds, never a redirect link', () => {
  // Meri Duniya
  const dYt = duniya.render({ customer_data: { ...duniyaConfig.demo } }, { isPreview: true });
  assert.match(dYt, /class="md-song-play" data-yt="mt9xg0mmt28"/, 'Meri Duniya: YouTube song becomes a tap-to-play inline embed');
  assert.doesNotMatch(dYt, /a class="md-song" href=/, 'Meri Duniya: no bare song link that navigates away');
  const dSp = duniya.render({ customer_data: { ...duniyaConfig.demo, songUrl: 'https://open.spotify.com/track/x' } }, { isPreview: true });
  assert.match(dSp, /md-song--pill/, 'Meri Duniya: non-YouTube keeps the branded pill');
  assert.doesNotMatch(dSp, /data-yt=/, 'Meri Duniya: Spotify never embeds');

  // Aakhri Sawaal
  const sawaalConfig = require('../templates/aakhri-sawaal/config');
  const sYt = sawaal.render({ customer_data: sawaalConfig.demo }, { isPreview: true });
  assert.match(sYt, /class="as-songplay" data-yt="WWZxDA81JFk"/, 'Aakhri Sawaal: YouTube song becomes an inline embed');
  assert.doesNotMatch(sYt, /a class="as-song" href=/, 'Aakhri Sawaal: no bare song link that navigates away');

  // Khulta — song doors
  const khultaConfig = require('../templates/khulta/config');
  const kYt = khulta.render({ customer_data: khultaConfig.demo }, { isPreview: true });
  assert.match(kYt, /class="kh-songplay" data-yt=/, 'Khulta: a YouTube song door becomes an inline embed');
  assert.doesNotMatch(kYt, />Play it ↗</, 'Khulta: the old redirect button is gone');
});

test('Meri Duniya: days together counts in Asia/Kolkata; future dates hide the counter', () => {
  const now = Date.UTC(2026, 9, 2, 20, 0);           // 3 Oct 01:30 IST
  assert.equal(duniya.daysSince('2026-10-03', now), 0);
  assert.equal(duniya.daysSince('2026-10-01', now), 2);
  assert.equal(duniya.daysSince('2026-10-04', now), null);
  assert.equal(duniya.daysSince('', now), null);
});

test('Meri Duniya: empty or switched-off sections vanish and the journey renumbers', () => {
  const html = duniya.render({ customer_data: { recipientName: 'Aarav', letterOn: 'hide', reasonsOn: 'show' } }, { isPreview: true });
  assert.ok(!html.includes('id="letter"'), 'letter switched off');
  assert.ok(!html.includes('id="story"') && !html.includes('id="gallery"') && !html.includes('id="numbers"'), 'empty personal sections are skipped');
  const nums = [...html.matchAll(/<span class="md-num" aria-hidden="true">(\d+)<\/span>/g)].map(m => m[1]);
  assert.deepEqual(nums, ['01', '02'], 'reasons then question, no gaps');
  const full = duniya.render({ customer_data: duniyaConfig.demo }, { isPreview: true });
  assert.deepEqual([...full.matchAll(/<span class="md-num" aria-hidden="true">(\d+)<\/span>/g)].map(m => m[1]), ['01', '02', '03', '04', '05', '06']);
});

test('Khulta: unlock follows the start date in the chosen timezone', () => {
  const at = iso => Date.parse(iso);
  assert.equal(khulta.unlockedCount('2026-09-27', 'Asia/Kolkata', at('2026-09-26T18:29:00Z')), 0); // 23:59 IST on the 26th
  assert.equal(khulta.unlockedCount('2026-09-27', 'Asia/Kolkata', at('2026-09-26T18:31:00Z')), 1); // 00:01 IST on the 27th
  assert.equal(khulta.unlockedCount('2026-09-27', 'America/New_York', at('2026-09-26T18:31:00Z')), 0);
  assert.equal(khulta.unlockedCount('2026-09-27', 'Asia/Kolkata', at('2026-10-20T12:00:00Z')), 7);
  const today = khulta.dayNumber('2026-09-27');
  assert.equal(khulta.opensLabel('2026-09-27', 1, today), 'opens Monday');
  assert.equal(khulta.opensLabel('2026-10-20', 0, today), 'opens 20 Oct');
});

test('Khulta: locked doors say "opens {day}", previews unlock everything', () => {
  const data = { recipientName: 'Kabir', startDate: '2026-09-27' };
  const live = khulta.render({ customer_data: data, slug: 'khulta-0123456789abcdef01' }, { now: Date.parse('2026-09-28T06:00:00Z') });
  assert.match(live, /data-n="2" data-state="today"/);
  assert.match(live, /data-n="3" data-state="locked"/);
  assert.match(live, /<span class="kh-when">opens Tuesday<\/span>/);
  assert.doesNotMatch(live, /\d{1,2}:\d{2}:\d{2}/, 'no midnight countdown');
  const prev = khulta.render({ customer_data: data }, { isPreview: true, now: Date.parse('2026-09-20T06:00:00Z') });
  assert.doesNotMatch(prev, /data-state="locked"/);
  assert.match(prev, /class="kh-sim"/);
});

test('Aakhri Sawaal: WhatsApp numbers are reduced to digits, implausible ones dropped', () => {
  assert.equal(sawaal.waNumber('+91 98765 43210'), '919876543210');
  assert.equal(sawaal.waNumber('98765-43210'), '919876543210');
  assert.equal(sawaal.waNumber('098765 43210'), '919876543210');
  assert.equal(sawaal.waNumber('+1 (415) 555-0100'), '14155550100');
  assert.equal(sawaal.waNumber('12345'), '');
  assert.equal(sawaal.waNumber('call me'), '');
});

test('Aakhri Sawaal: at most three taps before the question', () => {
  const html = sawaal.render({ customer_data: { senderName: 'A', buildUp: ['one', 'two'] } }, { isPreview: true });
  const before = html.split('<section class="as-card as-card--question"')[0];
  assert.equal((before.match(/class="as-card /g) || []).length, 3, 'two lines + the heartbeat');
});
