import test from 'node:test';
import assert from 'node:assert';
import { SAMPLE, normalize, validate, LIMITS } from '../src/lib/schema.js';
import { buildTimeline, FPS } from '../src/lib/timeline.js';
const tl = (d) => buildTimeline(normalize(d), FPS);
const clone = (x) => structuredClone(x);

test('sample retains the reference-inspired scene order and duration', () => {
  const t = tl(SAMPLE);
  assert.equal(t.durationInFrames, 1738);
  assert.ok(Math.abs(t.durationInFrames / FPS - 57.94) < 2, 'around 58 seconds like the reference');
  assert.deepEqual(t.segments.map((s) => s.kind), ['opener','logo','main','event','event','story','event','story','closing','end']);
  assert.equal(t.segments[1].start / FPS, 4.9, 'logo beat follows the Ganesha opener');
  assert.deepEqual(t.segments.map((s) => s.exit?.type || null), ['paperReveal','stampZoom','slideSwap','slideSwap','fabricZoom','liftAway','fabricZoom','closingZoom','fadeToPaper',null]);
});

test('adding and removing events replans the film', () => {
  const base = tl(SAMPLE).durationInFrames;
  const more = clone(SAMPLE);
  more.events.push({ id:'e4', preset:'custom', title:'Reception', date:'2026-12-13', timings:[{ time:'8 PM' }], holdSec:5 });
  const longer = tl(more);
  assert.ok(longer.durationInFrames > base);
  assert.equal(longer.segments.filter((s) => s.kind === 'event').length, 4);
  const less = clone(SAMPLE); less.events = less.events.slice(0, 1); less.stories = [];
  assert.ok(tl(less).durationInFrames < base);
});

test('only neighbouring segments overlap', () => {
  for (const d of [SAMPLE, { ...clone(SAMPLE), stories: [] }, { ...clone(SAMPLE), events: [], stories: [] }]) {
    const segs = tl(d).segments;
    for (let i = 2; i < segs.length; i++) assert.ok(segs[i].start >= segs[i-2].start + segs[i-2].duration, `segment ${i} overlaps ${i-2}`);
  }
});

test('normalize clamps, sanitises uploads and derives fixed clip sources', () => {
  const d = clone(SAMPLE);
  d.couple.bride = 'x'.repeat(999);
  d.meta.palette = 'nope';
  d.meta.logoUpload = 'javascript:alert(1)';
  d.events = Array.from({ length: 40 }, (_, i) => ({ preset:'nope', title:`E${i}` }));
  d.stories = [{ scene:'unknown', src:'https://evil.example/a.mp4' }, { scene:'couple', src:'https://evil.example/b.mp4', after:'e1' }];
  const n = normalize(d);
  assert.equal(n.couple.bride.length, LIMITS.name);
  assert.equal(n.events.length, LIMITS.events);
  assert.equal(n.events[0].preset, 'custom');
  assert.equal(n.meta.palette, 'soft');
  assert.equal(n.meta.logoUpload, '');
  assert.equal(n.stories.length, 1);
  assert.equal(n.stories[0].src, 'stories/couple.mp4');
  assert.equal(validate(SAMPLE).length, 0);
});
