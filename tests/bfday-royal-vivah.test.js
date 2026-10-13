'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../templates/royal-vivah/config');
const schema = require('../templates/royal-vivah/schema');
const { render, dateParts } = require('../templates/royal-vivah/render');

test('Royal Vivah sample passes the shared strict family schema', () => {
  assert.doesNotThrow(() => schema.validate(config.demo, { mode: 'strict' }));
  assert.equal(config.steps.length, 4);
  assert.ok(config.steps.flatMap(x => x.fields).includes('mapLink'));
  assert.equal(schema.FIELDS.some(f => f.id === 'bgmSong'), false, 'the invitation must stay silent with no extra music control');
});

test('date formatting matches the Save the Date and full invitation styles', () => {
  assert.deepEqual(dateParts('2025-12-04'), { save: '4TH DEC 2025', full: '4TH DECEMBER 2025', final: '4 DECEMBER 2025' });
  assert.equal(dateParts('not-a-date').full, 'not-a-date');
});

test('server render contains all five scenes, event rows and an editable venue link', () => {
  const html = render({ customer_data: config.demo }, { isPreview: true, baseUrl: 'https://paigaam.cc' });
  for (const id of ['envelope', 'save-date', 'families', 'events', 'invitation']) assert.match(html, new RegExp(`id="${id}"`));
  for (const art of ['envelope.webp', 'save-date.webp', 'families.webp', 'events.webp', 'invitation.webp']) assert.ok(html.includes('/royal-vivah/' + art));
  for (const event of config.demo.events) assert.ok(html.includes(event.name.replace(/&/g, '&amp;')));
  assert.match(html, /href="https:\/\/www\.google\.com\/maps\/search/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /Tap to open/);
  assert.match(html, /src="\/royal-vivah\/envelope-open\.mp4"/);
  assert.ok(!html.includes('class="rv-envelope__open-video" src="/royal-vivah/envelope-open.mp4" poster="/royal-vivah/envelope.webp" muted'), 'the supplied opener audio stays enabled after the tap');
});

test('customer copy is escaped and untrusted map schemes are not emitted', () => {
  const data = {
    ...config.demo,
    brideName: '<img src=x onerror=alert(1)>',
    invitationLead: '</p><script>alert(1)</script><p>',
    mapLink: 'javascript:alert(1)',
  };
  const html = render({ customer_data: data }, { isPreview: true });
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!html.includes('href="javascript:'));
});
