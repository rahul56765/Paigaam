"use strict";
/**
 * Harness to verify the ported Saalgirah audio.js in a fake-AudioContext
 * environment under Node. Stubs the Web Audio API, loads the file, then
 * exercises every public method and asserts correctness.
 *
 * Patches setInterval/clearInterval so the audio engine's arp timer does not
 * keep the Node process alive.
 */

const fs = require("fs");
const path = require("path");

// ---- Patch setInterval so it fires once then is auto-cleared ----
// The audio engine uses setInterval for the arpeggio. In the harness we
// just need to verify it was scheduled; we do not want it to run forever.
var _intervals = {};
var _nextId = 1000;
var origSetInterval = global.setInterval;
var origClearInterval = global.clearInterval;

global.setInterval = function (fn, ms) {
  // Fire the callback once after 0ms (so startMusic/transitionToScene
  // logic executes) then return a fake id we track but never re-fire.
  var id = _nextId++;
  _intervals[id] = true;
  // Schedule one async execution so the arp logic runs
  setImmediate(fn);
  return id;
};
global.clearInterval = function (id) {
  delete _intervals[id];
};

// ---- Stub Web Audio API ----

var oscillatorsCreated = 0;
var gainsCreated = 0;
var filtersCreated = 0;
var buffersCreated = 0;
var bufferSourcesCreated = 0;
var connectCalls = 0;
var startCalls = 0;
var stopCalls = 0;
var errors = [];

function makeParam(initialValue) {
  return {
    value: initialValue || 0,
    setValueAtTime: function () {},
    exponentialRampToValueAtTime: function () {},
    setTargetAtTime: function () {},
    cancelScheduledValues: function () {},
  };
}

function FakeOscillator() {
  oscillatorsCreated++;
  this.type = "sine";
  this.frequency = makeParam(440);
  this.detune = makeParam(0);
  this.connect = function () { connectCalls++; };
  this.start = function () { startCalls++; };
  this.stop = function () { stopCalls++; };
}

function FakeGain() {
  gainsCreated++;
  this.gain = makeParam(1);
  this.connect = function () { connectCalls++; };
}

function FakeBiquadFilter() {
  filtersCreated++;
  this.type = "lowpass";
  this.frequency = makeParam(350);
  this.Q = makeParam(1);
  this.connect = function () { connectCalls++; };
}

function FakeBuffer(channels, length, rate) {
  buffersCreated++;
  this._length = length;
}
FakeBuffer.prototype.getChannelData = function () {
  return new Float32Array(this._length);
};

function FakeBufferSource() {
  bufferSourcesCreated++;
  this.buffer = null;
  this.connect = function () { connectCalls++; };
  this.start = function () { startCalls++; };
  this.stop = function () { stopCalls++; };
}

function FakeDestination() {}

function FakeAudioContext() {
  this.state = "running";
  this.currentTime = 0;
  this.sampleRate = 44100;
  this.destination = new FakeDestination();
  this.resume = function () { return Promise.resolve(); };
  this.createOscillator = function () { return new FakeOscillator(); };
  this.createGain = function () { return new FakeGain(); };
  this.createBiquadFilter = function () { return new FakeBiquadFilter(); };
  this.createBuffer = function (ch, len) { return new FakeBuffer(ch, len); };
  this.createBufferSource = function () { return new FakeBufferSource(); };
}

// ---- Minimal browser-like global environment ----

var fakeWindow = {
  AudioContext: FakeAudioContext,
  webkitAudioContext: undefined,
  SaalgirahAudio: undefined,
};

// ---- Load audio.js using Function wrapper ----

var filePath = path.resolve(__dirname, "../public/saalgirah/audio.js");
var source = fs.readFileSync(filePath, "utf8");

var wrapper = new Function("window", source);
try {
  wrapper(fakeWindow);
} catch (e) {
  errors.push("Load error: " + e.message);
}

var api = fakeWindow.SaalgirahAudio;

// ---- Assertions ----

function assert(condition, message) {
  if (!condition) {
    errors.push("FAIL: " + message);
    console.error("FAIL:", message);
  } else {
    console.log("PASS:", message);
  }
}

// 1. Global was set
assert(api !== undefined && api !== null, "window.SaalgirahAudio is defined");

// 2. All public methods present
var expectedMethods = [
  "startMusic", "setScene", "transitionToScene",
  "isStarted", "isMuted", "setMuted", "toggleMute",
  "sfxPaper", "sfxChime", "sfxClick", "sfxSparkle",
  "sfxFlame", "sfxWhoosh", "sfxWarmChime",
];
expectedMethods.forEach(function (name) {
  assert(typeof api[name] === "function", "api." + name + " is a function");
});

// 3. State before startMusic
assert(api.isStarted() === false, "isStarted() is false before startMusic");
assert(api.isMuted() === false, "isMuted() is false initially");

// 4. setScene accepts all four scene names (no throw)
["calm", "reveal", "birthday", "love"].forEach(function (s) {
  try {
    api.setScene(s);
    assert(true, "setScene('" + s + "') does not throw");
  } catch (e) {
    assert(false, "setScene('" + s + "') threw: " + e.message);
  }
});

// 5. toggleMute / setMuted
api.setMuted(true);
assert(api.isMuted() === true, "isMuted() is true after setMuted(true)");
var toggleResult = api.toggleMute();
assert(toggleResult === false, "toggleMute() returns false after unmuting");
assert(api.isMuted() === false, "isMuted() is false after toggleMute");

// 6. startMusic — returns a promise; await it
var oscillatorsBefore = oscillatorsCreated;
var startPromise = api.startMusic();
assert(startPromise && typeof startPromise.then === "function",
  "startMusic() returns a thenable");

startPromise.then(function () {
  // Give one event-loop tick for setImmediate(tick) to fire
  return new Promise(function (r) { setImmediate(r); });
}).then(function () {
  assert(api.isStarted() === true, "isStarted() is true after startMusic resolves");
  assert(oscillatorsCreated > oscillatorsBefore,
    "oscillators were created during startMusic (total now: " + oscillatorsCreated + ")");

  // 7. transitionToScene for every scene
  ["calm", "reveal", "birthday", "love"].forEach(function (s) {
    try {
      api.transitionToScene(s);
      assert(true, "transitionToScene('" + s + "') does not throw");
    } catch (e) {
      assert(false, "transitionToScene('" + s + "') threw: " + e.message);
    }
  });

  // 8. All SFX methods
  var sfxMethods = [
    "sfxPaper", "sfxChime", "sfxClick", "sfxSparkle",
    "sfxFlame", "sfxWhoosh", "sfxWarmChime",
  ];
  var oscBeforeSfx = oscillatorsCreated;
  var bufBeforeSfx = buffersCreated;
  sfxMethods.forEach(function (name) {
    try {
      api[name]();
      assert(true, name + "() does not throw");
    } catch (e) {
      assert(false, name + "() threw: " + e.message);
    }
  });
  assert(oscillatorsCreated > oscBeforeSfx,
    "SFX methods created oscillators (before=" + oscBeforeSfx + " after=" + oscillatorsCreated + ")");
  assert(buffersCreated > bufBeforeSfx,
    "SFX noise buffers were created (before=" + bufBeforeSfx + " after=" + buffersCreated + ")");

  // 9. No extra window.* writes beyond what we pre-seeded
  var seeded = new Set(["AudioContext", "webkitAudioContext", "SaalgirahAudio"]);
  var extraWrites = Object.keys(fakeWindow).filter(function (k) {
    return !seeded.has(k);
  });
  assert(extraWrites.length === 0,
    "No unexpected window.* writes (found: [" + extraWrites.join(", ") + "])");

  // ---- Summary ----
  console.log("\n--- Summary ---");
  console.log("Oscillators created:", oscillatorsCreated);
  console.log("Gain nodes created:", gainsCreated);
  console.log("Biquad filters created:", filtersCreated);
  console.log("Buffers created:", buffersCreated);
  console.log("Buffer sources created:", bufferSourcesCreated);
  console.log("connect() calls:", connectCalls);
  console.log("start() calls:", startCalls);
  console.log("stop() calls:", stopCalls);

  if (errors.length === 0) {
    console.log("\nAll assertions passed.");
  } else {
    console.error("\n" + errors.length + " assertion(s) failed:");
    errors.forEach(function (e) { console.error(" -", e); });
    process.exit(1);
  }
}).catch(function (e) {
  console.error("Promise rejection:", e);
  process.exit(1);
});
