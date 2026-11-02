'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { render } = require('../templates/shubh-sangam/render');
const config = require('../templates/shubh-sangam/config');
const root = path.join(__dirname, '..');

test('event artwork follows event name across reordering and preserves customer photo and location', () => {
  const photo = '/bfday/uploads/' + 'a'.repeat(48) + '.webp';
  const events = [
    { ...config.demo.events[3], name: 'Wedding' },
    { ...config.demo.events[2], name: 'Sangeet', photo, venue: 'My Hall', address: '42 Road' },
    { ...config.demo.events[0], name: 'Haldi' },
  ];
  const html = render({customer_data:{...config.demo, events}});
  const cards = [...html.matchAll(/<article class="ss-event ss-event--(\w+)">([\s\S]*?)<\/article>/g)];
  assert.deepEqual(cards.map(m => m[1]), ['mandap', 'sangeet', 'haldi']);
  assert.match(cards[1][2], new RegExp(photo));
  assert.match(cards[1][2], /My Hall/);
  assert.match(cards[1][2], /42 Road/);
  assert.match(cards[1][2], /google\.com\/maps\/search/);
  assert.match(cards[1][2], /ss-event__overlay/);
});

test('event headings are escaped even inside art overlays', () => {
  const html = render({customer_data:{...config.demo, events:[{...config.demo.events[0],name:'Haldi <script>alert(1)</script>'}]}});
  assert.match(html, /Haldi &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});

test('packed art heals missing and corrupt files idempotently', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-art-'));
  try {
    fs.mkdirSync(path.join(temp,'lib','bfday'), {recursive:true});
    fs.cpSync(path.join(root,'lib','bfday','assets-shubh-sangam.js'), path.join(temp,'lib','bfday','assets-shubh-sangam.js'));
    fs.cpSync(path.join(root,'assets','shubh-sangam'),path.join(temp,'assets','shubh-sangam'),{recursive:true});
    const {assets, ensureShubhSangamAssets} = require(path.join(temp,'lib','bfday','assets-shubh-sangam.js'));
    assert.equal(assets.length, 8);
    assert.equal(ensureShubhSangamAssets().length, 8);
    assert.equal(ensureShubhSangamAssets().length, 0);
    fs.writeFileSync(path.join(temp,'public',assets[0].path), 'corrupt');
    assert.deepEqual(ensureShubhSangamAssets(), [assets[0].path]);
    assert.equal(ensureShubhSangamAssets().length, 0);
  } finally { fs.rmSync(temp,{recursive:true,force:true}); }
});

test('Mehendi and Reception have their own event artwork', () => {
  const html = render({customer_data:config.demo});
  const cards = [...html.matchAll(/<article class="ss-event ss-event--(\w+)">([\s\S]*?)<\/article>/g)];
  assert.deepEqual(cards.map(m => m[1]), ['haldi','mehendi','sangeet','mandap','reception']);
  assert.match(cards[1][2], /mehendi\.webp/);
  assert.match(cards[4][2], /reception\.webp/);
});
