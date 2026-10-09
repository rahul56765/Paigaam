/* Shaadi Paigaam — vector artwork. Every colour is a CSS variable, so a
 * palette change recolours everything instantly with no image regeneration.
 * Raster layers (door relief, courtyard scene) are neutral/tonal and tinted
 * in CSS (see invite.css: .door::before soft-light, .scene .tint mix-blend color). */
(function (root) {
  'use strict';
  const A = {};
  const f = (n) => Math.round(n * 100) / 100;

  /** Scalloped medallion outline (wavy oval). */
  function scallopPath(cx, cy, rx, ry, n, depth) {
    let d = '';
    const steps = n * 12;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const bump = 1 + depth * Math.pow(Math.abs(Math.cos((t * n) / 2)), 0.6) - depth * 0.5;
      const x = cx + Math.sin(t) * rx * bump, y = cy - Math.cos(t) * ry * bump;
      d += (i ? 'L' : 'M') + f(x) + ' ' + f(y);
    }
    return d + 'Z';
  }

  A.medallion = function (label) {
    const outer = scallopPath(110, 128, 92, 112, 18, 0.07);
    const inner = scallopPath(110, 128, 80, 99, 18, 0.06);
    return `<svg class="med-svg" viewBox="0 0 220 256" aria-hidden="true">
  <defs>
    <radialGradient id="medFill" cx="42%" cy="34%" r="75%"><stop offset="0" stop-color="var(--sp-champagne-light, #F6E8D2)"/><stop offset=".6" stop-color="var(--sp-champagne)"/><stop offset="1" stop-color="var(--sp-champagne-dark, #D9BD97)"/></radialGradient>
    <linearGradient id="medGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--sp-accent)"/><stop offset=".45" stop-color="#F3DFA6"/><stop offset=".6" stop-color="var(--sp-accent)"/><stop offset="1" stop-color="var(--sp-accent-deep, #8E6C30)"/></linearGradient>
    <filter id="medShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#000" flood-opacity=".35"/></filter>
  </defs>
  <g filter="url(#medShadow)"><path d="${outer}" fill="url(#medGold)"/></g>
  <path d="${scallopPath(110, 128, 88, 108, 18, 0.07)}" fill="url(#medFill)"/>
  <path d="${inner}" fill="none" stroke="url(#medGold)" stroke-width="1.6"/>
  <ellipse cx="110" cy="128" rx="66" ry="83" fill="none" stroke="url(#medGold)" stroke-width=".9" opacity=".8"/>
  <g fill="url(#medGold)" stroke="none" transform="translate(110 70)">
    <path d="M0 -16 C5 -9 9 -4 9 2 C9 8 4 11 0 13 C-4 11 -9 8 -9 2 C-9 -4 -5 -9 0 -16Z"/>
    <path d="M-4 9 C-14 8 -21 2 -23 -6 C-16 -4 -10 -1 -6 4Z M4 9 C14 8 21 2 23 -6 C16 -4 10 -1 6 4Z"/>
    <path d="M-12 15 H12" stroke="url(#medGold)" stroke-width="1.2"/>
  </g>
  <g transform="translate(110 186)" fill="url(#medGold)"><path d="M0 -6 L4 0 L0 6 L-4 0Z"/><path d="M-26 0 H-9 M9 0 H26" stroke="url(#medGold)" stroke-width="1"/></g>
  <path d="M60 104 Q110 96 160 104" fill="none" stroke="url(#medGold)" stroke-width=".8" opacity=".7"/>
  <path d="M60 158 Q110 166 160 158" fill="none" stroke="url(#medGold)" stroke-width=".8" opacity=".7"/>
</svg><span class="med-label">${label}</span>`;
  };

  /** Top valance: three swags of champagne silk with gold trim and pearl strands. */
  A.valance = function () {
    let pearls = '';
    const swag = (x0, x1, sag) => {
      const pts = [];
      for (let i = 0; i <= 18; i++) { const t = i / 18; const x = x0 + (x1 - x0) * t; const y = 22 + Math.sin(Math.PI * t) * sag; pts.push([x, y]); }
      return pts;
    };
    const swags = [[0, 140, 70], [130, 270, 78], [260, 400, 70]];
    let fabric = '', trims = '';
    swags.forEach(([a, b, s], k) => {
      const m = (a + b) / 2;
      fabric += `<path d="M${a} 0 H${b} V22 C${b - 18} ${22 + s * 1.05} ${a + 18} ${22 + s * 1.05} ${a} 22Z" fill="url(#valFab)"/>`;
      for (let r = 1; r <= 4; r++) fabric += `<path d="M${a + 4} ${10 + r * 3} C${a + 30} ${22 + s * (0.25 + r * 0.18)} ${b - 30} ${22 + s * (0.25 + r * 0.18)} ${b - 4} ${10 + r * 3}" fill="none" stroke="var(--sp-shade, rgba(120,90,60,.28))" stroke-width="${1.6 + r * 0.4}" opacity="${0.55 - r * 0.08}"/>`;
      trims += `<path d="M${a} 22 C${a + 18} ${22 + s * 1.05} ${b - 18} ${22 + s * 1.05} ${b} 22" fill="none" stroke="var(--sp-accent)" stroke-width="2.2"/>`;
      const strand = swag(a + 6, b - 6, s * 1.12);
      strand.forEach(([x, y], i) => { if (i % 1 === 0) pearls += `<circle cx="${f(x)}" cy="${f(y + 6)}" r="${i % 3 === 0 ? 2.6 : 2}" fill="url(#pearl)"/>`; });
      pearls += `<circle cx="${m}" cy="${f(28 + s * 1.12)}" r="4.2" fill="url(#pearl)"/>`;
    });
    // tails at both ends
    const tails = `<path d="M0 0 V118 C4 96 10 70 18 22 L22 0Z" fill="url(#valFab)"/><path d="M400 0 V118 C396 96 390 70 382 22 L378 0Z" fill="url(#valFab)"/>
      <path d="M0 118 C4 96 10 70 18 22" fill="none" stroke="var(--sp-accent)" stroke-width="1.6"/><path d="M400 118 C396 96 390 70 382 22" fill="none" stroke="var(--sp-accent)" stroke-width="1.6"/>`;
    for (let i = 0; i < 9; i++) pearls += `<circle cx="${f(6 + i * 1.3)}" cy="${f(30 + i * 9)}" r="2.1" fill="url(#pearl)"/><circle cx="${f(394 - i * 1.3)}" cy="${f(30 + i * 9)}" r="2.1" fill="url(#pearl)"/>`;
    return `<svg class="valance" viewBox="0 0 400 124" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
  <defs>
    <linearGradient id="valFab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sp-champagne-dark, #D9BD97)"/><stop offset=".45" stop-color="var(--sp-champagne)"/><stop offset="1" stop-color="var(--sp-champagne-light, #F6E8D2)"/></linearGradient>
    <radialGradient id="pearl" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#F3E9DA"/><stop offset="1" stop-color="#C8B496"/></radialGradient>
  </defs>
  <rect x="0" y="0" width="400" height="12" fill="url(#valFab)"/>
  ${fabric}${tails}${trims}
  <rect x="0" y="10" width="400" height="2" fill="var(--sp-accent)" opacity=".8"/>
  ${pearls}
</svg>`;
  };

  /** Gold cord tie-back with a tassel. */
  A.tieback = function () {
    return `<svg class="tie-svg" viewBox="0 0 60 120" aria-hidden="true">
  <defs><linearGradient id="tieG" x1="0" x2="1"><stop offset="0" stop-color="var(--sp-accent-deep, #8E6C30)"/><stop offset=".5" stop-color="#F0D99B"/><stop offset="1" stop-color="var(--sp-accent)"/></linearGradient></defs>
  <path d="M2 18 C18 30 42 30 58 18" fill="none" stroke="url(#tieG)" stroke-width="5" stroke-linecap="round"/>
  <path d="M2 18 C18 30 42 30 58 18" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.2" stroke-dasharray="3 3"/>
  <path d="M30 27 V44" stroke="url(#tieG)" stroke-width="3"/>
  <circle cx="30" cy="47" r="6" fill="url(#tieG)"/>
  <path d="M24 52 Q30 50 36 52 L40 96 Q30 101 20 96Z" fill="url(#tieG)"/>
  <g stroke="var(--sp-accent-deep, #8E6C30)" stroke-width=".7" opacity=".6">${[22, 25, 28, 31, 34, 37].map(x => `<path d="M${x + 0.5} 56 L${x - 1 + (x - 30) * 0.3} 96"/>`).join('')}</g>
</svg>`;
  };

  /* ---------- line icons: 24×24, stroke = currentColor (gold via CSS) */
  const I = (body, extra = '') => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;
  A.icon = {
    heart: I('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
    heartFill: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>`,
    rings: I('<circle cx="9" cy="14" r="5"/><circle cx="15" cy="14" r="5"/><path d="M9 9l1.5-3h-3zM15 9l1.5-3h-3z"/>'),
    sparkle: I('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>'),
    clock: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    hourglass: I('<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/>'),
    pin: I('<path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>'),
    dress: I('<path d="M9 3l-5 3 2 4 2-1v12h8V9l2 1 2-4-5-3c-.5 1.5-1.7 2.5-3 2.5S9.5 4.5 9 3z"/>'),
    party: I('<path d="M4 20l5-13 8 8z"/><path d="M14 4c0 1.5 1 2 2 2M19 9c-1.5 0-2 1-2 2M17 3l.5 1.5M20.5 6.5L19 7M12 7l1-3"/>'),
    car: I('<path d="M4 16v-3l2-5h12l2 5v3z"/><path d="M4 16v2h2v-2M18 16v2h2v-2"/><circle cx="7.5" cy="13.5" r=".8"/><circle cx="16.5" cy="13.5" r=".8"/>'),
    hotel: I('<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-4h4v4"/>'),
    gift: I('<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M3 9h18M12 9v11M12 9c-2-4-6-4-6-1.5S10 9 12 9zM12 9c2-4 6-4 6-1.5S14 9 12 9z"/>'),
    mail: I('<rect x="3.5" y="6" width="17" height="12" rx="1.2"/><path d="M4 7l8 6 8-6"/>'),
    camera: I('<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
    calendar: I('<rect x="4" y="5.5" width="16" height="14.5" rx="1.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>'),
    external: I('<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>'),
    copy: I('<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V4H4v12h4"/>'),
    globe: I('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.5 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.5-3.5-8.5s1-5.9 3.5-8.5z"/>'),
    soundOn: I('<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9c1 .8 1.5 1.8 1.5 3s-.5 2.2-1.5 3M18.5 6.5c1.7 1.4 2.5 3.4 2.5 5.5s-.8 4.1-2.5 5.5"/>'),
    soundOff: I('<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>'),
    lotus: I('<path d="M12 18c-3 0-7-2-8-6 3 0 5.5 1 8 3.5 2.5-2.5 5-3.5 8-3.5-1 4-5 6-8 6z"/><path d="M12 15.5c-1.8-2-2.5-4.5-2-8 1 .6 1.7 1.3 2 2 .3-.7 1-1.4 2-2 .5 3.5-.2 6-2 8z"/>'),
    arrival: I('<path d="M3 20h18M6 20V9l6-5 6 5v11M10 20v-6h4v6"/>'),
    ring: I('<circle cx="12" cy="14" r="6"/><path d="M9.5 8L12 4l2.5 4"/>'),
    mehendi: I('<path d="M8 21v-7l-2-4c-.5-1 .5-2 1.5-1.2L9 10V4.5a1 1 0 0 1 2 0V9V3.5a1 1 0 0 1 2 0V9V4.5a1 1 0 0 1 2 0V10.5V7a1 1 0 0 1 2 0v6c0 3-1.5 5-3 6v2"/><circle cx="12.5" cy="14" r="1.2"/>'),
    haldi: I('<path d="M5 12h14l-2 7H7z"/><path d="M8 12c0-2 1.5-3.5 4-3.5s4 1.5 4 3.5M12 8.5V5M10.5 6l1.5-1 1.5 1"/>'),
    music: I('<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/>'),
    baraat: I('<path d="M5 20l1-6 3-2 2 2 4-1 3 3v4"/><path d="M9 12V8l2-3 2 3"/><circle cx="17" cy="9" r="1.5"/>'),
    garland: I('<path d="M5 5c0 8 3 12 7 12s7-4 7-12"/><circle cx="7" cy="10" r="1.2"/><circle cx="9.5" cy="14" r="1.2"/><circle cx="12" cy="15.5" r="1.2"/><circle cx="14.5" cy="14" r="1.2"/><circle cx="17" cy="10" r="1.2"/>'),
    fire: I('<path d="M12 21c-3.5 0-6-2.3-6-5.5 0-3.5 3-5 3.5-8.5C12 9 14 11 14 13c1-1 1.3-2.2 1.2-3.5 2 1.6 2.8 3.6 2.8 6 0 3.2-2.5 5.5-6 5.5z"/>'),
    glasses: I('<path d="M7 3h4l-.5 5a1.6 1.6 0 0 1-3 0zM13 3h4l-.5 5a1.6 1.6 0 0 1-3 0zM9 9v9M15 9v9M7 18h4M13 18h4"/>'),
  };

  A.divider = function (kind) {
    const center = kind === 'diamond' ? '<path d="M50 3 L53 7 L50 11 L47 7Z" fill="currentColor"/>' : '<path fill="currentColor" d="M50 11s-4.2-2.6-4.2-6a2.4 2.4 0 0 1 4.2-1.6A2.4 2.4 0 0 1 54.2 5c0 3.4-4.2 6-4.2 6z"/>';
    return `<svg class="div-svg" viewBox="0 0 100 14" aria-hidden="true"><path d="M6 7 H42 M58 7 H94" stroke="currentColor" stroke-width=".6"/><circle cx="4" cy="7" r=".9" fill="currentColor"/><circle cx="96" cy="7" r=".9" fill="currentColor"/>${center}</svg>`;
  };

  /** Heart shape for the scratch card, in a 0..100 × 0..92 box. */
  A.heartPath = 'M50 90 C47 87 6 62 3 34 C1 14 15 2 29 2 C39 2 46 8 50 15 C54 8 61 2 71 2 C85 2 99 14 97 34 C94 62 53 87 50 90 Z';
  A.heartOutline = `<svg class="heart-out" viewBox="0 0 100 92" aria-hidden="true"><path d="${A.heartPath}" fill="var(--sp-card)" stroke="var(--sp-line)" stroke-width=".7"/><path d="${A.heartPath}" transform="translate(50 46) scale(.93) translate(-50 -46)" fill="none" stroke="var(--sp-line)" stroke-width=".35" opacity=".7"/></svg>`;

  /** Flourish under the closing names. */
  A.flourish = `<svg class="flourish" viewBox="0 0 200 24" aria-hidden="true"><path d="M10 12 C40 2 60 22 90 12 M110 12 C140 2 160 22 190 12" fill="none" stroke="currentColor" stroke-width=".8"/><path fill="currentColor" d="M100 19s-5-3-5-7a2.8 2.8 0 0 1 5-1.8A2.8 2.8 0 0 1 105 12c0 4-5 7-5 7z"/></svg>`;

  if (typeof module === 'object' && module.exports) module.exports = A; else root.SPArt = A;
})(typeof self !== 'undefined' ? self : this);
