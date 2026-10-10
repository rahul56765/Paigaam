'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

let faceCropRect;
test.before(async () => {
  ({ faceCropRect } = await import('../public/js/magazine-face-geometry.mjs'));
});

function assertFacesInside(crop, faces) {
  for (const face of faces) {
    assert.ok(face.x >= crop.left - 1 && face.y >= crop.top - 1, 'crop begins before each face');
    assert.ok(face.x + face.width <= crop.left + crop.width + 1, 'crop contains each face horizontally');
    assert.ok(face.y + face.height <= crop.top + crop.height + 1, 'crop contains each face vertically');
  }
}

test('face crop preserves the requested frame ratio and keeps a detected face inside', () => {
  const faces = [{ x: 710, y: 160, width: 180, height: 190 }];
  const crop = faceCropRect(faces, 1200, 900, 0.8);
  assert.ok(crop);
  assert.ok(Math.abs(crop.width / crop.height - 0.8) < 1e-10);
  assertFacesInside(crop, faces);
  assert.ok(crop.left >= 0 && crop.top >= 0);
  assert.ok(crop.left + crop.width <= 1200 && crop.top + crop.height <= 900);
});

test('group crop includes every detected face and stays within the photo edges', () => {
  const faces = [
    { x: 40, y: 180, width: 140, height: 160 },
    { x: 640, y: 120, width: 170, height: 180 },
  ];
  const crop = faceCropRect(faces, 900, 700, 1.3, 1.1);
  assert.ok(crop);
  assert.ok(Math.abs(crop.width / crop.height - 1.3) < 1e-10);
  assertFacesInside(crop, faces);
  assert.ok(crop.left >= 0 && crop.top >= 0);
  assert.ok(crop.left + crop.width <= 900 && crop.top + crop.height <= 700);
});

test('returns null when all faces cannot fit at the target ratio or no valid face exists', () => {
  assert.equal(faceCropRect([{ x: 0, y: 100, width: 460, height: 500 }, { x: 520, y: 100, width: 460, height: 500 }], 1000, 700, 0.45, 1.8), null);
  assert.equal(faceCropRect([], 1000, 700, 1), null);
  assert.equal(faceCropRect([{ x: 10, y: 10, width: -1, height: 20 }], 1000, 700, 1), null);
});

test('both live magazines declare a valid per-slot frame aspect and expose it in the upload UI', () => {
  const registry = require('../lib/magazines/registry');
  const views = require('../lib/magazines/views');
  for (const mapping of registry.MAGAZINES) {
    for (const slot of mapping.images) assert.ok(Number.isFinite(slot.frameAspect) && slot.frameAspect > 0.35 && slot.frameAspect < 3);
    const html = views.formPage(mapping);
    assert.ok(html.includes(`data-aspect="${mapping.images[0].frameAspect}"`));
    assert.match(html, /automatically frame detected faces/i);
    assert.match(html, /we don’t identify anyone/i);
  }
});
