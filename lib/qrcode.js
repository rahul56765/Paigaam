'use strict';
/**
 * QR Code generation for Paigaam.
 *
 * Uses the battle-tested `qrcode-generator` library (Kazuhiko Arase, MIT),
 * vendored at ./vendor/qrcode-generator.js. We render the module matrix to our
 * own SVG so we can brand the colours (ivory bg, burgundy/ink modules).
 *
 * qrcode(typeNumber=0 → auto version, errorCorrection 'M').
 */
const qrcode = require('./vendor/qrcode-generator.js');

/**
 * Build the module matrix for a payload.
 * Returns { matrix: 2D array of 0/1, size }.
 */
function makeQR(text) {
  const qr = qrcode(0, 'M');       // 0 = auto-select smallest version
  qr.addData(String(text), 'Byte');
  qr.make();
  const size = qr.getModuleCount();
  const matrix = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) row.push(qr.isDark(r, c) ? 1 : 0);
    matrix.push(row);
  }
  return { matrix, size };
}

/**
 * Render an SVG string.
 * @param text   payload (a URL, e.g. https://paigaam.cc/p/rahul)
 * @param opts   { module, margin, dark, light }
 */
function qrSVG(text, { module = 4, margin = 4, dark = '#3B2420', light = '#FBF4ED' } = {}) {
  const { matrix, size } = makeQR(text);
  const dim = (size + margin * 2) * module;
  let pathD = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) pathD += `M${(c + margin) * module} ${(r + margin) * module}h${module}v${module}h-${module}z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" role="img" aria-label="QR code" shape-rendering="crispEdges"><rect width="${dim}" height="${dim}" fill="${light}"/><path d="${pathD}" fill="${dark}"/></svg>`;
}

module.exports = { makeQR, qrSVG };
