'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../templates/wedding-post/config');
const schema = require('../templates/wedding-post/schema');
const { render, lineIcon } = require('../templates/wedding-post/render');
const family = require('../lib/bfday/family');

const html = render({ customer_data: config.demo }, { baseUrl: 'https://paigaam.cc', isPreview: true });

test('Wedding Post is registered as an editable Wedding template with a valid demo', () => {
  assert.equal(family.errors.length, 0, JSON.stringify(family.errors));
  assert.ok(family.has('wedding-post'));
  assert.equal(config.category, 'Wedding');
  assert.equal(config.editable, true);
  assert.deepEqual(schema.validate(config.demo, { mode: 'strict' }).weddingDate, '2027-02-21');
  assert.equal(config.demo.groomName, 'Raghav');
  assert.equal(config.demo.brideName, 'Ragini');
  assert.equal(require('../templates/bfday').includes('wedding-post'), true);
});

test('render has five distinct, correctly ordered 5:7 newspaper pages and the required sample copy', () => {
  const pageMatches = html.match(/<article class="wp-page[^\"]*" data-page="[0-4]"/g) || [];
  assert.equal(pageMatches.length, 5);
  assert.deepEqual(pageMatches.map(x => Number(x.match(/data-page="(\d)"/)[1])), [0, 1, 2, 3, 4]);
  for (const phrase of ['The Wedding Post', 'SPECIAL', 'About the couple', 'Raghav', 'Ragini', 'Shubh Mangal Lawns', '21 February 2027', 'Save the Date', 'The Love', 'Fun Facts About', 'Our Wedding Post', 'Wedding Day Timeline', 'Wedding Word Search', 'Wedding Maze', 'In Loving Memory', 'RECEPTION LOCATION']) assert.ok(html.includes(phrase), 'missing ' + phrase);
  assert.match(fs.readFileSync(path.join(__dirname, '../public/wedding-post/post.css'), 'utf8'), /aspect-ratio:5\/7/);
  assert.match(html, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox=/);
});

test('no-repeat content rules hold: one Save-the-Date marriage line, one thank-you message, two thank-you photos', () => {
  const save = html.split('data-page="1"')[1].split('data-page="2"')[0];
  const thank = html.split('data-page="3"')[1].split('data-page="4"')[0];
  assert.equal((save.match(/are getting married/g) || []).length, 1);
  assert.equal((thank.match(/are getting married/g) || []).length, 0);
  assert.equal((thank.match(/Thank you for being part of our Wedding Celebration/g) || []).length, 1);
  assert.equal((thank.match(/<figure>/g) || []).length, 2);
  assert.equal((html.split('data-page="2"')[1].split('data-page="3"')[0].match(/class="wp-moment"/g) || []).length, 3);
});

test('page 5 composes editable words with the current couple names', () => {
  function wordsFor(data) {
    const rendered = render({ customer_data: data }, { baseUrl: 'https://paigaam.cc', isPreview: true });
    const marker = '<script type="application/json" id="wpGameData">';
    const start = rendered.indexOf(marker);
    const end = rendered.indexOf('</script>', start);
    assert.ok(start >= 0 && end > start, 'word-search payload exists');
    return JSON.parse(rendered.slice(start + marker.length, end)).words;
  }
  const defaultWords = wordsFor(config.demo);
  for (const word of config.demo.wordList) assert.ok(defaultWords.includes(word));
  assert.ok(defaultWords.includes('Raghav'));
  assert.ok(defaultWords.includes('Ragini'));
  const changedWords = wordsFor({ ...config.demo, groomName: 'Aarav Sharma', brideName: 'Ananya Joshi', wordList: ['Cheers', 'Honeymoon', 'Save', 'Forever', 'Raghav', 'Ragini'] });
  assert.deepEqual(changedWords, ['Cheers', 'Honeymoon', 'Save', 'Forever', 'Aarav', 'Ananya']);
  assert.ok(!changedWords.includes('Raghav') && !changedWords.includes('Ragini'));
  const page5 = html.split('data-page="4"')[1];
  assert.ok(page5.includes('id="wpMaze"'));
  assert.ok(page5.includes('data-move="left"'));
  assert.ok(page5.includes('id="wpWordGrid"'));
  assert.ok(page5.includes('maps.google.com/?q=Shubh+Mangal+Lawns+Baner+Pune'));
  const js = fs.readFileSync(path.join(__dirname, '../public/wedding-post/games.js'), 'utf8');
  assert.match(js, /pointerdown/);
  assert.match(js, /pointermove/);
  assert.match(js, /ArrowLeft/);
  assert.match(js, /function makeMaze/);
  const navigation = fs.readFileSync(path.join(__dirname, '../public/wedding-post/post.js'), 'utf8');
  assert.match(navigation, /wp-turning-forward/);
  assert.match(navigation, /wp-turning-backward/);
  const css = fs.readFileSync(path.join(__dirname, '../public/wedding-post/post.css'), 'utf8');
  assert.match(css, /@keyframes wp-page-turn-forward/);
  assert.match(css, /@keyframes wp-page-turn-backward/);
  assert.match(css, /\.wp-event-heart\{position:absolute/);
  assert.match(html, /wp-event--copy-top/);
  assert.match(html, /wp-event--copy-bottom/);
  for (const kind of ['rings', 'camera', 'dinner', 'cake', 'sparkler']) assert.match(lineIcon(kind), /stroke-width="1\.55"/);
});

test('schema rejects non-HTTP map links and keeps event/word list limits', () => {
  assert.throws(() => schema.validate({ ...config.demo, mapLink: 'javascript:alert(1)' }, { mode: 'strict' }));
  assert.throws(() => schema.validate({ ...config.demo, timeline: Array(11).fill(config.demo.timeline[0]) }, { mode: 'strict' }));
  assert.throws(() => schema.validate({ ...config.demo, wordList: Array(13).fill('Wedding') }, { mode: 'strict' }));
});
