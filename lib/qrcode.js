'use strict';
/**
 * Minimal QR Code generator (byte mode, EC level M) — zero dependencies.
 * Produces an SVG string. Sized for URLs up to ~120 chars (version ≤ 8).
 *
 * Implements: Reed-Solomon EC, mask 0, format info, static structure.
 */
const GF_EXP = new Uint8Array(512), GF_LOG = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) { GF_EXP[i] = x; GF_LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();
const gfMul = (a, b) => (a === 0 || b === 0) ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];

function rsGenerator(deg) {
  let poly = [1];
  for (let i = 0; i < deg; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
    }
    poly = next;
  }
  return poly;
}
function rsEncode(data, ecLen) {
  const gen = rsGenerator(ecLen);
  const res = data.concat(new Array(ecLen).fill(0));
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) for (let j = 0; j < gen.length; j++) res[i + j] ^= gfMul(gen[j], coef);
  }
  return res.slice(data.length);
}

// Version capacity (byte mode, EC-M): data codewords per version 1..10
const V_CAP_M = [14, 26, 42, 62, 84, 106, 122, 152, 180, 213];
// EC blocks for EC-M versions 1..10: [ecCodewordsPerBlock, [ [count, dataCodewords], ... ]]
const V_EC_M = [
  [10, [[1, 16]]], [16, [[1, 28]]], [26, [[1, 44]]], [18, [[2, 32]]], [24, [[2, 43]]],
  [16, [[4, 27]]], [18, [[4, 31]]], [22, [[2, 38], [2, 39]]], [22, [[3, 36], [2, 37]]], [26, [[4, 43], [1, 44]]],
];
const ALIGN_POS = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

// Format info bits for EC level M (01) and masks 0..7
const FORMAT_M = [0x5412, 0x5125, 0x5E7C, 0x5B4B, 0x45F9, 0x40CE, 0x4F97, 0x4AA0];

function makeQR(text) {
  const data = new TextEncoder().encode(text);
  let version = V_CAP_M.findIndex(c => c >= data.length + 2);
  if (version === -1) throw new Error('Text too long for QR');
  version += 1;
  const [ecLen, blocks] = V_EC_M[version - 1];
  const size = 17 + version * 4;

  // ---- bit stream: mode(4)=0100, count(8 for v1-9), data, terminator
  const bits = [];
  const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(0b0100, 4);
  push(data.length, 8);
  data.forEach(b => push(b, 8));
  const totalDataCw = blocks.reduce((s, [, c]) => s + c, 0);
  const capacityBits = totalDataCw * 8;
  push(0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8) bits.push(0);
  const padBytes = [0xEC, 0x11]; let pi = 0;
  const cw = [];
  for (let i = 0; i < bits.length; i += 8) cw.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  while (cw.length < totalDataCw) cw.push(padBytes[pi++ % 2]);

  // ---- split into blocks, EC, interleave
  const dataBlocks = [], ecBlocks = [];
  let off = 0;
  for (const [count, len] of blocks) {
    for (let i = 0; i < count; i++) {
      const blk = cw.slice(off, off + len); off += len;
      dataBlocks.push(blk); ecBlocks.push(rsEncode(blk, ecLen));
    }
  }
  const interleaved = [];
  const maxLen = Math.max(...dataBlocks.map(b => b.length));
  for (let i = 0; i < maxLen; i++) dataBlocks.forEach(b => { if (i < b.length) interleaved.push(b[i]); });
  for (let i = 0; i < ecLen; i++) ecBlocks.forEach(b => interleaved.push(b[i]));

  // ---- matrix
  const m = Array.from({ length: size }, () => new Array(size).fill(null));
  const finder = (r, c) => {
    for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
      const rr = r + i, cc = c + j;
      if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
      const inOuter = (i >= 0 && i <= 6 && j >= 0 && j <= 6);
      const edge = inOuter && (i === 0 || i === 6 || j === 0 || j === 6);
      const core = i >= 2 && i <= 4 && j >= 2 && j <= 4;
      m[rr][cc] = (edge || core) ? 1 : 0;
    }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
  for (let i = 8; i < size - 8; i++) { m[6][i] = i % 2 === 0 ? 1 : 0; m[i][6] = i % 2 === 0 ? 1 : 0; } // timing
  m[size - 8][8] = 1; // dark module
  // alignment
  const ap = ALIGN_POS[version - 1];
  for (const r of ap) for (const c of ap) {
    if (m[r][c] !== null) continue;
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++)
      m[r + i][c + j] = (Math.max(Math.abs(i), Math.abs(j)) !== 1) ? 1 : 0;
  }
  // reserve format info areas
  const fmtPos = [];
  for (let i = 0; i <= 8; i++) { if (i !== 6) { fmtPos.push([8, i]); } }
  for (let i = 0; i < 8; i++) fmtPos.push([size - 1 - i, 8]);
  for (let i = 0; i < 7; i++) fmtPos.push([8, size - 1 - i]);
  for (let i = 7; i >= 0; i--) { if (i !== 6) fmtPos.push([i === 7 ? size - 8 : i, 8]); }
  fmtPos.forEach(([r, c]) => { if (m[r][c] === null) m[r][c] = 0; });
  // version info (v >= 7)
  if (version >= 7) {
    // BCH version info
    const vBits = (() => { let v = version << 12; const g = 0x1F25; for (let i = 5; i >= 0; i--) if (v >> (i + 12) & 1) v ^= g << i; return (version << 12) | v; })();
    for (let i = 0; i < 18; i++) {
      const bit = (vBits >> i) & 1;
      m[Math.floor(i / 3)][size - 11 + (i % 3)] = bit;
      m[size - 11 + (i % 3)][Math.floor(i / 3)] = bit;
    }
  }

  // ---- place data (zigzag from bottom-right), mask 0
  let bitIdx = 0;
  const dataBits = [];
  interleaved.forEach(b => { for (let i = 7; i >= 0; i--) dataBits.push((b >> i) & 1); });
  const mask0 = (r, c) => (r + c) % 2 === 0;
  let upward = true;
  for (let c = size - 1; c > 0; c -= 2) {
    if (c === 6) c = 5;
    for (let i = 0; i < size; i++) {
      const r = upward ? size - 1 - i : i;
      for (const cc of [c, c - 1]) {
        if (m[r][cc] === null) {
          let bit = bitIdx < dataBits.length ? dataBits[bitIdx++] : 0;
          if (mask0(r, cc)) bit ^= 1;
          m[r][cc] = bit;
        }
      }
    }
    upward = !upward;
  }

  // ---- format info (mask 0)
  const fmt = FORMAT_M[0];
  const fmtBits = []; for (let i = 14; i >= 0; i--) fmtBits.push((fmt >> i) & 1);
  // positions around top-left
  const tl = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
  // other copies
  const tr = []; for (let i = 0; i < 8; i++) tr.push([8, size - 1 - i]);
  const bl = []; for (let i = 0; i < 7; i++) bl.push([size - 1 - i, 8]);
  const others = tr.concat(bl);
  tl.forEach(([r, c], i) => { m[r][c] = fmtBits[14 - i]; });
  others.forEach(([r, c], i) => { m[r][c] = fmtBits[i]; });

  return { matrix: m, size };
}

function qrSVG(text, { module = 4, margin = 4, dark = '#3B2420', light = '#FBF4ED' } = {}) {
  const { matrix, size } = makeQR(text);
  const dim = (size + margin * 2) * module;
  let rects = `<rect width="${dim}" height="${dim}" fill="${light}"/>`;
  let pathD = '';
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (matrix[r][c]) pathD += `M${(c + margin) * module} ${(r + margin) * module}h${module}v${module}h-${module}z`;
  }
  rects += `<path d="${pathD}" fill="${dark}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" role="img" aria-label="QR code">${rects}</svg>`;
}

module.exports = { makeQR, qrSVG };
