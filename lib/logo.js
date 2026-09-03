'use strict';
/** Inline SVG: the Paigaam dove carrying an envelope. Single accent colour. */
function doveSVG(color = '#8F1018', extra = '') {
  return `<svg viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A dove carrying an envelope" ${extra}>
  <g stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M18 44 C 30 30, 48 24, 64 30 C 58 22, 60 14, 68 10 C 66 18, 70 22, 76 24 C 90 28, 102 22, 110 12 C 108 26, 100 38, 86 44 C 74 49, 62 48, 52 42"/>
    <path d="M64 30 C 74 34, 84 34, 92 30"/>
    <path d="M30 52 C 40 56, 52 56, 62 52"/>
    <circle cx="103" cy="16" r="1.4" fill="${color}" stroke="none"/>
    <path d="M18 44 C 12 48, 8 54, 8 60 C 16 58, 24 54, 30 52"/>
    <rect x="40" y="56" width="26" height="17" rx="1.5"/>
    <path d="M40 57 L 53 66 L 66 57"/>
  </g>
</svg>`;
}
module.exports = { doveSVG };
