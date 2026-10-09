import test from 'node:test';
import assert from 'node:assert';
import { SAMPLE, normalize, validate, LIMITS } from '../src/lib/schema.js';
import { buildTimeline, FPS } from '../src/lib/timeline.js';

const tl = (d) => buildTimeline(normalize(d), FPS);
const clone = (x) => structuredClone(x);

test('sample reproduces the reference length and cut points', () => {
  const t = tl(SAMPLE);
  assert.equal(t.durationInFrames, 2761); // 92.03s @ 30fps, same as the reference
  const starts = t.segments.map((s) => +(s.start / FPS).toFixed(2));
  assert.deepEqual(starts, [0, 11.2, 20, 28.5, 34.8, 41.8, 50.6, 61, 67.5, 74, 81.4, 88.8]);
  assert.deepEqual(t.segments.map((s) => s.exit && s.exit.type), ['stampZoom', 'sunZoom', 'propsZoom', 'slideSwap', 'liftAway', 'leafWipe', 'shrinkRise', 'fabricZoom', 'shrinkExit', 'closingZoom', 'fadeToPaper', null]);
});

test('adding / removing events adjusts the length automatically', () => {
  const base = tl(SAMPLE).durationInFrames;
  const more = clone(SAMPLE);
  more.events.push({ id: 'e5', preset: 'reception', title: 'Reception', date: '2025-11-03', timings: [{ time: '8 PM' }], holdSec: 6 });
  const t2 = tl(more);
  assert.ok(t2.durationInFrames > base);
  assert.equal(t2.segments.filter((s) => s.kind === 'event').length, 5);
  const less = clone(SAMPLE);
  less.events = less.events.slice(0, 2);
  less.stories = less.stories.filter((s) => s.after === 'e1');
  assert.ok(tl(less).durationInFrames < base);
});

test('stories sit on the backdrop of the following event', () => {
  const segs = tl(SAMPLE).segments.filter((s) => s.kind === 'story');
  assert.deepEqual(segs.map((s) => s.backdrop), ['sangeet', 'sangeet', 'baraat', 'baraat']);
});

test('only neighbouring segments overlap', () => {
  for (const d of [SAMPLE, { ...clone(SAMPLE), stories: [] }, { ...clone(SAMPLE), events: [], stories: [] }]) {
    const s = tl(d).segments;
    for (let i = 2; i < s.length; i++) assert.ok(s[i].start >= s[i - 2].start + s[i - 2].duration, `segment ${i} overlaps ${i - 2}`);
  }
});

test('normalize clamps and sanitises input', () => {
  const d = clone(SAMPLE);
  d.couple.bride = 'x'.repeat(999);
  d.events = Array.from({ length: 40 }, (_, i) => ({ preset: 'nope', title: 'E' + i }));
  d.stories = [{ src: 'javascript:alert(1)' }, { scene: 'blessing', src: 'https://cdn.example.com/a.mp4', after: 'zzz' }];
  d.meta.rsvpUrl = 'javascript:alert(1)';
  const n = normalize(d);
  assert.equal(n.couple.bride.length, LIMITS.name);
  assert.equal(n.events.length, LIMITS.events);
  assert.equal(n.events[0].preset, 'custom');
  assert.equal(n.stories.length, 1);
  assert.equal(n.stories[0].after, n.events[n.events.length - 1].id);
  assert.equal(n.stories[0].src, 'stories/story3.mp4', 'src always comes from the template library');
  assert.equal(n.meta.rsvpUrl, '');
  assert.equal(normalize({ stories: [{ scene: 'walk', frameSeq: { base: 'http://127.0.0.1:9/s', count: 5 } }] }).stories[0].frameSeq, null, 'local frame URLs only for the renderer');
});

test('validate flags missing names', () => {
  assert.deepEqual(validate(SAMPLE), []);
  assert.equal(validate({ couple: { bride: '', groom: 'x' }, events: [] }).length, 1);
});
