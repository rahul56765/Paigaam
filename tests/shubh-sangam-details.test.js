'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const config = require('../templates/shubh-sangam/config');
const { deriveDateTime } = require('../templates/shubh-sangam/schema');
const { render } = require('../templates/shubh-sangam/render');
const demo = patch => ({ ...structuredClone(config.demo), ...patch });

test('highlighted wedding details, directions and countdown reflect editor values', () => {
  const html = render({customer_data: demo({
    weddingDate: '2028-01-01', weddingTime: '00:15', venue: 'A & B Hall',
    venueAddress: '42 Garden Road', venueMapsLink: 'https://maps.app.goo.gl/abc', events: [],
  })});
  const details = html.match(/<div class="ss-wedding-details"[\s\S]*?<\/div>/)[0];
  assert.match(details, /Saturday, 1 January 2028/);
  assert.match(details, /Wedding time \/ Muhurat: 12:15 am IST/i);
  assert.match(details, /A &amp; B Hall/);
  assert.match(details, /42 Garden Road/);
  assert.match(details, /href="https:\/\/maps.app.goo.gl\/abc"/);
  assert.doesNotMatch(details, /Royal Orchid|21 February 2027/);
  assert.match(html, /data-countdown="2027-12-31T18:45:00.000Z"/);
  assert.equal(deriveDateTime('2028-01-01', '00:15').weekday, 'Saturday');
});

test('incomplete date/time does not fabricate a countdown; location fallback uses edited address', () => {
  const html = render({customer_data: demo({weddingDate:'2028-01-01', weddingTime:'', venue:'New Hall', venueAddress:'New Street', venueMapsLink:'', events:[]})});
  assert.match(html, /Saturday, 1 January 2028/);
  assert.doesNotMatch(html, /data-countdown=/);
  assert.doesNotMatch(html, /Wedding time \/ Muhurat:/);
  assert.match(html, /google\.com\/maps\/search\/\?api=1&amp;query=New%20Street/);
});

// Exercise the real browser script with controlled clock and interval, without any timezone assumptions.
function runCountdown(instant, now) {
  const values = Object.fromEntries(['days','hours','minutes','seconds'].map(k => [k,{textContent:''}]));
  const countdown = { dataset:{countdown:instant}, querySelector(s) { return values[/"(\w+)"/.exec(s)?.[1]] || null; } };
  const caption = {hidden:false}, ended = {hidden:true};
  const nodes = {'[data-countdown]':countdown, '[data-count-caption]':caption, '[data-count-ended]':ended};
  let current = now, tick, cleared = false;
  class Clock extends Date { static now() { return current; } }
  const document = {querySelector(s) { return nodes[s] || null; }};
  const window = {matchMedia() { return {matches:false}; }};
  const source = fs.readFileSync(path.join(__dirname, '../public/shubh-sangam/shubh-sangam.js'), 'utf8');
  vm.runInNewContext(source, {document, window, Date:Clock, setInterval(fn){ tick=fn; return 5; }, clearInterval(){cleared=true;}});
  return {values, caption, ended, get cleared(){return cleared;}, advance(ms){current=ms; tick();}};
}

test('countdown uses current absolute time, keeps final fractional second, and ends at the wedding', () => {
  const target = '2027-12-31T18:45:00.000Z';
  const t = Date.parse(target);
  const c = runCountdown(target, t - (2*86400 + 3*3600 + 4*60 + 5)*1000);
  assert.deepEqual(Object.fromEntries(Object.entries(c.values).map(([k,v])=>[k,v.textContent])), {days:'02',hours:'03',minutes:'04',seconds:'05'});
  assert.equal(c.ended.hidden, true); assert.equal(c.caption.hidden, false);
  c.advance(t-1); assert.equal(c.values.seconds.textContent, '01'); assert.equal(c.ended.hidden, true);
  c.advance(t); assert.equal(c.values.seconds.textContent, '00'); assert.equal(c.ended.hidden, false);
  assert.equal(c.caption.hidden, true); assert.equal(c.cleared, true);
});

test('past wedding starts at zero with ended state, never negative', () => {
  const target = '2027-12-31T18:45:00.000Z';
  const c = runCountdown(target, Date.parse(target) + 86400*1000);
  assert.deepEqual(Object.values(c.values).map(v=>v.textContent), ['00','00','00','00']);
  assert.equal(c.ended.hidden, false); assert.equal(c.caption.hidden, true); assert.equal(c.cleared, true);
});
