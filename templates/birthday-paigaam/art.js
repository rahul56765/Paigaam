'use strict';
/**
 * Birthday Paigaam — the original art kit, as inline SVG strings.
 *
 * Every character and object here was drawn for this template (no stock, no
 * borrowed characters). Fills use palette classes (.f-blush, .f-lav, …) that
 * the stylesheet maps to the sender's chosen colours, so the whole kit
 * recolours itself when the palette changes. Ink lines use .s-ink.
 */

const HEART = 'M12 21.2s-7.6-4.6-10-9.4C0.3 8.2 2.2 3.8 6.4 3.8c2.5 0 4.1 1.4 5.6 3.4 1.5-2 3.1-3.4 5.6-3.4 4.2 0 6.1 4.4 4.4 8-2.4 4.8-10 9.4-10 9.4z';
const SPARKLE = 'M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z';

const heart = (cls = 'f-acc', extra = '') =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" ${extra}><path class="${cls}" d="${HEART}"/></svg>`;

const sparkle = (cls = 'f-gold', extra = '') =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" ${extra}><path class="${cls}" d="${SPARKLE}"/></svg>`;

/** A circle of n outward scallops, as one path. */
function scallopPath(cx, cy, R, n) {
  const a = R * Math.sin(Math.PI / n) * 1.16;
  const pt = i => {
    const t = (2 * Math.PI * i) / n - Math.PI / 2;
    return [cx + R * Math.cos(t), cy + R * Math.sin(t)].map(v => v.toFixed(2));
  };
  let d = `M${pt(0).join(' ')}`;
  for (let i = 1; i <= n; i++) d += ` A${a.toFixed(2)} ${a.toFixed(2)} 0 0 1 ${pt(i).join(' ')}`;
  return d + 'Z';
}

/** The scalloped circular photo frame (the photo itself is an <img> laid inside). */
function scallopFrame() {
  return `<svg class="bp-frame__art" viewBox="0 0 300 300" aria-hidden="true" focusable="false">
  <path class="f-lav s-ink" stroke-width="3" d="${scallopPath(150, 150, 128, 20)}"/>
  <circle cx="150" cy="150" r="118" fill="none" class="s-white" stroke-width="2.5" stroke-dasharray="2 9" stroke-linecap="round"/>
  <circle cx="150" cy="150" r="106" class="f-cream s-ink" stroke-width="3"/>
</svg>`;
}

/* ------------------------------------------------------------- party cat */

const CAT_EARS_L = 'M50 110 Q46 64 64 50 Q86 66 98 90 Z';
const CAT_EARS_R = 'M170 110 Q174 64 156 50 Q134 66 122 90 Z';
const CAT_HAT = 'M112 8 L80 82 Q112 94 144 80 Z';

/** Sticker-style cat head in a party hat (white sticker edge + soft shadow). */
function partyCat() {
  const silhouette = `<path d="${CAT_EARS_L}"/><path d="${CAT_EARS_R}"/><ellipse cx="110" cy="136" rx="68" ry="58"/>
    <g transform="rotate(-12 112 70)"><path d="${CAT_HAT}"/><circle cx="112" cy="9" r="11"/></g>`;
  return `<svg class="bp-cat" viewBox="-12 -14 244 226" aria-hidden="true" focusable="false">
  <g class="bp-sticker-edge">${silhouette}</g>
  <path class="f-peach s-ink" stroke-width="3.2" stroke-linejoin="round" d="${CAT_EARS_L}"/>
  <path class="f-blush" d="M60 100 Q58 74 66 64 Q80 76 88 92 Z"/>
  <path class="f-peach s-ink" stroke-width="3.2" stroke-linejoin="round" d="${CAT_EARS_R}"/>
  <path class="f-blush" d="M160 100 Q162 74 154 64 Q140 76 132 92 Z"/>
  <ellipse class="f-cream s-ink" stroke-width="3.2" cx="110" cy="136" rx="66" ry="56"/>
  <g class="s-peachdeep" fill="none" stroke-width="5" stroke-linecap="round">
    <path d="M98 84 Q102 96 100 106"/><path d="M110 82 V102"/><path d="M122 84 Q118 96 120 106"/>
  </g>
  <g class="bp-cat__eyes s-ink" fill="none" stroke-width="4.5" stroke-linecap="round">
    <path d="M72 134 Q83 121 94 134"/><path d="M126 134 Q137 121 148 134"/>
  </g>
  <ellipse class="f-blush" cx="70" cy="150" rx="12" ry="7" opacity=".9"/>
  <ellipse class="f-blush" cx="150" cy="150" rx="12" ry="7" opacity=".9"/>
  <path class="f-acc" d="M103 143 Q110 138 117 143 Q110 152 103 143Z"/>
  <path class="s-ink" fill="none" stroke-width="3" stroke-linecap="round" d="M97 154 Q103.5 161 110 154 Q116.5 161 123 154"/>
  <g class="s-ink" stroke-width="2.2" stroke-linecap="round" opacity=".7">
    <path d="M58 142 L30 136"/><path d="M58 151 L30 154"/><path d="M162 142 L190 136"/><path d="M162 151 L190 154"/>
  </g>
  <g transform="rotate(-12 112 70)">
    <path class="f-lav s-ink" stroke-width="3.2" stroke-linejoin="round" d="${CAT_HAT}"/>
    <path class="s-acc" fill="none" stroke-width="6" stroke-linecap="round" d="M101 34 Q112 39 123 34"/>
    <path class="s-acc" fill="none" stroke-width="6" stroke-linecap="round" d="M92 58 Q112 66 132 58"/>
    <circle class="f-gold" cx="104" cy="47" r="3.2"/><circle class="f-gold" cx="122" cy="48" r="3.2"/>
    <circle class="f-gold" cx="98" cy="72" r="3.2"/><circle class="f-gold" cx="126" cy="74" r="3.2"/>
    <path class="s-cream" fill="none" stroke-width="8" stroke-linecap="round" d="M84 82 Q112 96 140 80"/>
    <circle class="f-acc s-ink" stroke-width="3" cx="112" cy="9" r="10"/>
  </g>
</svg>`;
}

/* ---------------------------------------------------------- peeking bunny */

/** A bunny peeking over the top edge of the question card. Its bottom edge is the card's. */
function peekBunny() {
  return `<svg class="bp-bunny" viewBox="0 0 240 150" aria-hidden="true" focusable="false">
  <g class="bp-bunny__ears">
    <g transform="rotate(-14 88 52)"><ellipse class="f-white s-ink" stroke-width="3" cx="88" cy="52" rx="18" ry="46"/><ellipse class="f-blush" cx="88" cy="56" rx="8" ry="32"/></g>
    <g transform="rotate(14 152 52)"><ellipse class="f-white s-ink" stroke-width="3" cx="152" cy="52" rx="18" ry="46"/><ellipse class="f-blush" cx="152" cy="56" rx="8" ry="32"/></g>
    <g transform="translate(158 20) rotate(18)"><path class="f-acc s-ink" stroke-width="2.4" stroke-linejoin="round" d="M0 0 L-16 -9 L-16 9 Z M0 0 L16 -9 L16 9 Z"/><circle class="f-acc s-ink" stroke-width="2.4" r="4.5"/></g>
  </g>
  <ellipse class="f-white s-ink" stroke-width="3" cx="120" cy="118" rx="72" ry="52"/>
  <g class="bp-bunny__eyes">
    <circle class="f-ink" cx="96" cy="112" r="6.5"/><circle class="f-white" cx="98.5" cy="109" r="2.2"/>
    <circle class="f-ink" cx="144" cy="112" r="6.5"/><circle class="f-white" cx="146.5" cy="109" r="2.2"/>
  </g>
  <g class="bp-bunny__happy s-ink" fill="none" stroke-width="4" stroke-linecap="round">
    <path d="M88 114 Q96 104 104 114"/><path d="M136 114 Q144 104 152 114"/>
  </g>
  <ellipse class="f-blush" cx="80" cy="128" rx="11" ry="6.5" opacity=".9"/>
  <ellipse class="f-blush" cx="160" cy="128" rx="11" ry="6.5" opacity=".9"/>
  <path class="f-acc" d="M114.5 121 Q120 117 125.5 121 Q120 127.5 114.5 121Z"/>
  <path class="s-ink" fill="none" stroke-width="2.6" stroke-linecap="round" d="M112 130 Q116 135 120 130 Q124 135 128 130"/>
  <g class="f-white s-ink" stroke-width="3">
    <ellipse cx="82" cy="146" rx="20" ry="12"/><ellipse cx="158" cy="146" rx="20" ry="12"/>
  </g>
  <g class="s-ink" stroke-width="2" stroke-linecap="round" opacity=".55">
    <path d="M76 142 v7"/><path d="M86 141 v8"/><path d="M152 141 v8"/><path d="M162 142 v7"/>
  </g>
</svg>`;
}

/* --------------------------------------------------- the "how dare you" duo */

/** Two original characters: a huffy peach bear (arms crossed) and a sobbing bunny. */
function noDuo() {
  return `<svg class="bp-duo" viewBox="0 0 430 310" aria-hidden="true" focusable="false">
  <ellipse cx="130" cy="296" rx="84" ry="10" class="f-ink" opacity=".08"/>
  <ellipse cx="300" cy="296" rx="74" ry="10" class="f-ink" opacity=".08"/>
  <g class="bp-duo__bear">
    <circle class="f-peach s-ink" stroke-width="3" cx="76" cy="64" r="23"/><circle class="f-blush" cx="76" cy="64" r="12"/>
    <circle class="f-peach s-ink" stroke-width="3" cx="184" cy="64" r="23"/><circle class="f-blush" cx="184" cy="64" r="12"/>
    <ellipse class="f-peach s-ink" stroke-width="3" cx="130" cy="230" rx="74" ry="66"/>
    <ellipse class="f-cream" cx="130" cy="242" rx="44" ry="40"/>
    <ellipse class="f-peach s-ink" stroke-width="3" cx="130" cy="120" rx="70" ry="61"/>
    <ellipse class="f-cream s-ink" stroke-width="2.5" cx="130" cy="142" rx="29" ry="20"/>
    <ellipse class="f-ink" cx="130" cy="133" rx="8.5" ry="5.8"/>
    <path class="s-ink" fill="none" stroke-width="3" stroke-linecap="round" d="M119 153 Q130 146 141 153"/>
    <g class="s-ink" stroke-width="4.5" stroke-linecap="round"><path d="M86 98 L111 108"/><path d="M174 98 L149 108"/></g>
    <circle class="f-ink" cx="100" cy="118" r="5.5"/><circle class="f-ink" cx="160" cy="118" r="5.5"/>
    <ellipse class="f-blush" cx="86" cy="140" rx="12" ry="7.5" opacity=".95"/><ellipse class="f-blush" cx="174" cy="140" rx="12" ry="7.5" opacity=".95"/>
    <path class="s-ink" fill="none" stroke-width="30" stroke-linecap="round" d="M74 214 Q122 240 176 206"/>
    <path class="s-peach" fill="none" stroke-width="24" stroke-linecap="round" d="M74 214 Q122 240 176 206"/>
    <path class="s-ink" fill="none" stroke-width="30" stroke-linecap="round" d="M186 214 Q138 240 86 206"/>
    <path class="s-peach" fill="none" stroke-width="24" stroke-linecap="round" d="M186 214 Q138 240 86 206"/>
    <g class="s-acc bp-duo__vein" fill="none" stroke-width="4.5" stroke-linecap="round">
      <path d="M194 46 q8 7 16 0"/><path d="M194 70 q8 -7 16 0"/><path d="M190 50 q7 8 0 16"/><path d="M214 50 q-7 8 0 16"/>
    </g>
  </g>
  <g class="bp-duo__bunny">
    <g transform="rotate(-10 268 66)"><ellipse class="f-white s-ink" stroke-width="3" cx="268" cy="66" rx="17" ry="48"/><ellipse class="f-blush" cx="268" cy="70" rx="8" ry="33"/></g>
    <g transform="rotate(12 330 66)"><ellipse class="f-white s-ink" stroke-width="3" cx="330" cy="66" rx="17" ry="48"/><ellipse class="f-blush" cx="330" cy="70" rx="8" ry="33"/></g>
    <ellipse class="f-white s-ink" stroke-width="3" cx="300" cy="238" rx="64" ry="58"/>
    <ellipse class="f-lavlight" cx="300" cy="248" rx="38" ry="34"/>
    <ellipse class="f-white s-ink" stroke-width="3" cx="300" cy="142" rx="64" ry="55"/>
    <circle class="f-ink" cx="277" cy="136" r="11"/><circle class="f-white" cx="281" cy="131" r="4.5"/><circle class="f-white" cx="273" cy="141" r="2"/>
    <circle class="f-ink" cx="323" cy="136" r="11"/><circle class="f-white" cx="327" cy="131" r="4.5"/><circle class="f-white" cx="319" cy="141" r="2"/>
    <g class="bp-duo__tears" fill="none" stroke="#9EC3FF" stroke-width="7" stroke-linecap="round" opacity=".9">
      <path d="M270 150 Q266 178 272 206"/><path d="M330 150 Q334 178 328 206"/>
    </g>
    <ellipse class="f-blush" cx="264" cy="158" rx="11" ry="6.5"/><ellipse class="f-blush" cx="336" cy="158" rx="11" ry="6.5"/>
    <path class="f-acc s-ink" stroke-width="2.6" stroke-linejoin="round" d="M288 166 Q300 154 312 166 Q300 182 288 166Z"/>
    <circle class="f-white s-ink" stroke-width="3" cx="246" cy="168" r="14"/>
    <circle class="f-white s-ink" stroke-width="3" cx="354" cy="168" r="14"/>
  </g>
</svg>`;
}

/* ---------------------------------------------------------------- envelope */

function waxSeal() {
  const blob = 'M50 5C64 3 78 11 86 23C96 35 97 52 93 64C89 80 75 92 59 95C42 98 24 91 14 79C4 66 3 47 9 33C17 16 34 6 50 5Z';
  const body = `<path class="f-acc" d="${blob}"/>
    <path fill="#000" opacity=".12" d="M86 23C96 35 97 52 93 64C89 80 75 92 59 95C70 86 80 72 82 56C84 44 82 32 86 23Z"/>
    <circle cx="50" cy="50" r="31" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="3"/>
    <circle cx="50" cy="50" r="27" fill="#000" opacity=".08"/>
    <path transform="translate(34 35) scale(1.35)" fill="#fff" opacity=".55" d="${HEART}"/>
    <ellipse cx="36" cy="26" rx="11" ry="6" fill="#fff" opacity=".22" transform="rotate(-28 36 26)"/>`;
  return `<svg class="bp-seal" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
  <defs>
    <clipPath id="bpSealL"><path d="M0 0H52L45 30L56 50L43 70L53 100H0Z"/></clipPath>
    <clipPath id="bpSealR"><path d="M52 0H100V100H53L43 70L56 50L45 30Z"/></clipPath>
  </defs>
  <g class="bp-seal__half bp-seal__l" clip-path="url(#bpSealL)">${body}</g>
  <g class="bp-seal__half bp-seal__r" clip-path="url(#bpSealR)">${body}</g>
</svg>`;
}

function envelopeFront() {
  return `<svg class="bp-env__front" viewBox="0 0 400 276" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <path class="f-envside" d="M0 18 L200 158 L0 276Z"/>
  <path class="f-envside" d="M400 18 L200 158 L400 276Z"/>
  <path class="f-envfront" d="M0 276 L200 132 L400 276Z"/>
  <path fill="none" class="s-ink" stroke-opacity=".18" stroke-width="2" d="M0 276 L200 132 L400 276"/>
</svg>`;
}

function envelopeFlap() {
  return `<svg class="bp-env__flapart" viewBox="0 0 400 190" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <path class="f-envflap" d="M0 0 H400 L214 178 Q200 190 186 178 Z"/>
  <path fill="none" class="s-ink" stroke-opacity=".16" stroke-width="2" d="M0 0 L186 178 Q200 190 214 178 L400 0"/>
</svg>`;
}

function stamp() {
  return `<svg class="bp-stamp" viewBox="0 0 64 76" aria-hidden="true" focusable="false">
  <rect x="2" y="2" width="60" height="72" rx="3" class="f-white"/>
  <rect x="2" y="2" width="60" height="72" rx="3" fill="none" class="s-lavdeep" stroke-width="4" stroke-dasharray="0.1 7" stroke-linecap="round"/>
  <rect x="9" y="9" width="46" height="58" rx="2" class="f-blush"/>
  <path transform="translate(17 22) scale(1.25)" class="f-acc" d="${HEART}"/>
  <path class="s-white" fill="none" stroke-width="2" stroke-linecap="round" d="M14 58 q9 -6 18 0 t18 0"/>
</svg>`;
}

/* -------------------------------------------------------------- cassette */

function cassette() {
  const reel = (cx, cls) => `<g class="bp-reel ${cls}">
    <circle class="f-cream s-ink" stroke-width="3" cx="${cx}" cy="128" r="22"/>
    <circle class="f-ink" cx="${cx}" cy="128" r="7"/>
    ${[0, 60, 120, 180, 240, 300].map(a => `<rect class="f-ink" x="${cx - 2.2}" y="108" width="4.4" height="8" rx="2" transform="rotate(${a} ${cx} 128)"/>`).join('')}
  </g>`;
  return `<svg class="bp-cassette" viewBox="0 0 320 206" aria-hidden="true" focusable="false">
  <rect class="f-lav s-ink" stroke-width="3.5" x="6" y="6" width="308" height="194" rx="20"/>
  <rect class="f-cream s-ink" stroke-width="2.5" x="28" y="24" width="264" height="62" rx="10"/>
  <g class="s-blush" stroke-width="2" opacity=".9"><path d="M44 50 H276"/><path d="M44 66 H276"/></g>
  <rect class="f-acc" x="28" y="24" width="264" height="10" rx="5" opacity=".85"/>
  <rect class="f-plum s-ink" stroke-width="3" x="82" y="98" width="156" height="60" rx="30"/>
  <path class="f-tape" d="M128 106 H192 V150 H128 Z" opacity=".55"/>
  ${reel(128, 'bp-reel--l')}${reel(192, 'bp-reel--r')}
  <path class="f-lavdeep s-ink" stroke-width="3" stroke-linejoin="round" d="M64 200 L80 170 H240 L256 200"/>
  <g class="f-cream s-ink" stroke-width="2"><circle cx="22" cy="22" r="5"/><circle cx="298" cy="22" r="5"/><circle cx="22" cy="184" r="5"/><circle cx="298" cy="184" r="5"/><circle cx="160" cy="186" r="4"/></g>
  <path transform="translate(262 116) scale(1.1)" class="f-acc" d="${HEART}"/>
  <path transform="translate(30 118) scale(.9)" class="f-gold" d="${SPARKLE}"/>
</svg>`;
}

/* ---------------------------------------------------------- record player */

function recordPlayer() {
  return `<svg class="bp-player" viewBox="0 0 340 270" aria-hidden="true" focusable="false">
  <rect class="f-peach s-ink" stroke-width="3.5" x="6" y="10" width="328" height="250" rx="26"/>
  <rect class="f-cream" x="20" y="24" width="300" height="222" rx="18" opacity=".55"/>
  <circle class="f-plum s-ink" stroke-width="3" cx="150" cy="135" r="104"/>
  <g class="bp-record">
    <circle cx="150" cy="135" r="98" fill="#2E2233"/>
    <g fill="none" stroke="#4A3956" stroke-width="1.6">
      <circle cx="150" cy="135" r="88"/><circle cx="150" cy="135" r="78"/><circle cx="150" cy="135" r="68"/><circle cx="150" cy="135" r="58"/><circle cx="150" cy="135" r="48"/>
    </g>
    <path d="M86 92 A78 78 0 0 1 150 57" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="7" stroke-linecap="round"/>
    <circle class="f-acc" cx="150" cy="135" r="32"/>
    <circle class="f-blush" cx="150" cy="135" r="24" opacity=".5"/>
    <path transform="translate(140 125) scale(.85)" class="f-cream" d="${HEART}"/>
    <circle class="f-cream" cx="150" cy="135" r="3.5"/>
  </g>
  <g class="bp-arm">
    <path d="M286 52 L276 176 L246 206" fill="none" class="s-ink" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M286 52 L276 176 L246 206" fill="none" class="s-cream" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <rect class="f-lav s-ink" stroke-width="2.5" x="232" y="196" width="26" height="18" rx="5" transform="rotate(42 245 205)"/>
    <circle class="f-lav s-ink" stroke-width="3" cx="286" cy="50" r="17"/>
    <circle class="f-cream" cx="286" cy="50" r="6"/>
  </g>
  <g class="f-cream s-ink" stroke-width="2.5"><circle cx="300" cy="226" r="10"/><circle cx="270" cy="232" r="7"/></g>
</svg>`;
}

/* ------------------------------------------------------------------ cake */

function drips(x, y, w, depthSeed) {
  let d = `M${x} ${y} H${x + w} V${y + 10}`;
  const n = Math.max(4, Math.round(w / 26));
  const step = w / n;
  for (let i = n; i > 0; i--) {
    const x1 = x + (i - 1) * step;
    const depth = 10 + ((i * 7 + depthSeed) % 4) * 6;
    d += ` Q${(x1 + step * 0.75).toFixed(1)} ${y + 10 + depth} ${(x1 + step * 0.5).toFixed(1)} ${y + 10 + depth * 0.6} Q${(x1 + step * 0.3).toFixed(1)} ${y + 6} ${x1.toFixed(1)} ${y + 10}`;
  }
  return d + 'Z';
}

function cake(candles = 5) {
  const n = Math.max(1, Math.min(9, candles));
  const left = 98, right = 202;
  const xs = Array.from({ length: n }, (_, i) => n === 1 ? 150 : left + ((right - left) * i) / (n - 1));
  const candle = (x, i) => `<g class="bp-candle" data-candle="${i}" role="button" tabindex="0" aria-label="Blow out candle ${i + 1}">
    <rect x="${x - 15}" y="20" width="30" height="92" fill="transparent"/>
    <rect class="f-cream s-ink" stroke-width="2.2" x="${(x - 5.5).toFixed(1)}" y="70" width="11" height="40" rx="3"/>
    <g class="s-acc" stroke-width="3" opacity=".85"><path d="M${x - 5} ${82} l10 -6"/><path d="M${x - 5} ${94} l10 -6"/><path d="M${x - 5} ${106} l10 -6"/></g>
    <path class="s-ink" stroke-width="2" stroke-linecap="round" d="M${x} 70 v-6"/>
    <g class="bp-flame" style="transform-origin:${x}px 62px">
      <circle cx="${x}" cy="50" r="17" fill="url(#bpFlameGlow)"/>
      <path fill="url(#bpFlame)" d="M${x} 34 C${x + 8} 44 ${x + 9} 52 ${x + 6} 58 C${x + 4} 63 ${x - 4} 63 ${x - 6} 58 C${x - 9} 52 ${x - 6} 44 ${x} 34Z"/>
    </g>
    <g class="bp-smoke" fill="#B9A9C9">
      <circle cx="${x}" cy="56" r="4"/><circle cx="${x + 4}" cy="46" r="5"/><circle cx="${x - 2}" cy="34" r="6"/>
    </g>
  </g>`;
  const sprinkles = [[70, 214, 20], [96, 236, -30], [128, 220, 50], [180, 232, -15], [214, 216, 35], [236, 238, -40], [110, 150, 30], [160, 156, -25], [196, 146, 60]]
    .map(([x, y, r], i) => `<rect class="${['f-acc', 'f-gold', 'f-lavdeep'][i % 3]}" x="${x}" y="${y}" width="10" height="3.6" rx="1.8" transform="rotate(${r} ${x + 5} ${y + 1.8})"/>`).join('');
  return `<svg class="bp-cake" viewBox="0 0 300 286" aria-label="A birthday cake with ${n} candle${n > 1 ? 's' : ''}" focusable="false">
  <defs>
    <radialGradient id="bpFlameGlow"><stop offset="0" stop-color="#FFE7A8" stop-opacity=".95"/><stop offset="1" stop-color="#FFE7A8" stop-opacity="0"/></radialGradient>
    <radialGradient id="bpFlame" cx="50%" cy="65%" r="60%"><stop offset="0" stop-color="#FFF8DA"/><stop offset=".5" stop-color="#FFC861"/><stop offset="1" stop-color="#F08A3C"/></radialGradient>
  </defs>
  <ellipse class="f-cream s-ink" stroke-width="3" cx="150" cy="262" rx="136" ry="18"/>
  <rect class="f-blush s-ink" stroke-width="3" x="36" y="176" width="228" height="84" rx="18"/>
  <path class="f-cream" d="${drips(36, 178, 228, 1)}"/>
  <rect class="f-lav s-ink" stroke-width="3" x="78" y="108" width="144" height="72" rx="16"/>
  <path class="f-cream" d="${drips(78, 110, 144, 3)}"/>
  ${sprinkles}
  ${[60, 150, 240].map(x => `<path transform="translate(${x - 9} 226) scale(.75)" class="f-acc" d="${HEART}"/>`).join('')}
  ${xs.map(candle).join('')}
</svg>`;
}

/* -------------------------------------------------------------- balloons */

function balloon(colorClass = 'f-blush') {
  return `<svg class="bp-balloon" viewBox="0 0 60 132" aria-hidden="true" focusable="false">
  <path class="s-ink" fill="none" stroke-width="1.4" opacity=".55" d="M30 80 q-9 12 0 24 q9 12 0 26"/>
  <path class="${colorClass} s-ink" stroke-width="2.2" d="M30 4C48 4 58 20 58 37C58 57 44 73 30 77C16 73 2 57 2 37C2 20 12 4 30 4Z"/>
  <path class="${colorClass} s-ink" stroke-width="2" stroke-linejoin="round" d="M25 82 L30 75 L35 82Z"/>
  <ellipse cx="19" cy="25" rx="6" ry="10" fill="#fff" opacity=".45" transform="rotate(20 19 25)"/>
</svg>`;
}

function ribbon(colorClass = 's-acc') {
  return `<svg class="bp-ribbon" viewBox="0 0 60 160" aria-hidden="true" focusable="false">
  <path class="${colorClass}" fill="none" stroke-width="5" stroke-linecap="round" d="M30 4 C6 24 54 40 30 60 S6 96 30 116 S54 140 32 156"/>
</svg>`;
}

/* ------------------------------------------------------ stickers & doodles */

function starSticker() {
  const star = 'M50 6 L62 36 L94 38 L69 58 L78 90 L50 72 L22 90 L31 58 L6 38 L38 36 Z';
  return `<svg class="bp-sticker" viewBox="-8 -8 116 116" aria-hidden="true" focusable="false">
  <path d="${star}" class="bp-sticker-edge" stroke-linejoin="round"/>
  <path d="${star}" class="f-gold s-ink" stroke-width="3" stroke-linejoin="round"/>
  <circle class="f-ink" cx="41" cy="52" r="3.4"/><circle class="f-ink" cx="59" cy="52" r="3.4"/>
  <path class="s-ink" fill="none" stroke-width="2.6" stroke-linecap="round" d="M45 60 Q50 65 55 60"/>
  <ellipse class="f-blush" cx="35" cy="60" rx="5" ry="3"/><ellipse class="f-blush" cx="65" cy="60" rx="5" ry="3"/>
</svg>`;
}

function heartSticker() {
  return `<svg class="bp-sticker" viewBox="-3 -3 30 30" aria-hidden="true" focusable="false">
  <path d="${HEART}" class="bp-sticker-edge bp-sticker-edge--thin"/>
  <path d="${HEART}" class="f-acc s-ink" stroke-width=".9"/>
  <ellipse cx="7.6" cy="8.4" rx="2.2" ry="1.4" fill="#fff" opacity=".5" transform="rotate(-30 7.6 8.4)"/>
</svg>`;
}

function flowerSticker() {
  const petals = [0, 72, 144, 216, 288].map(a => `<ellipse cx="50" cy="26" rx="17" ry="22" transform="rotate(${a} 50 50)"/>`).join('');
  return `<svg class="bp-sticker" viewBox="-8 -8 116 116" aria-hidden="true" focusable="false">
  <g class="bp-sticker-edge">${petals}</g>
  <g class="f-lav s-ink" stroke-width="3">${petals}</g>
  <circle class="f-gold s-ink" stroke-width="3" cx="50" cy="50" r="15"/>
</svg>`;
}

const doodle = {
  star: `<svg class="bp-doodle" viewBox="0 0 40 40" aria-hidden="true"><path class="s-ink" fill="none" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" d="M20 4 L24 15 L36 15 L26 22 L30 34 L20 27 L10 34 L14 22 L4 15 L16 15 Z"/></svg>`,
  arrow: `<svg class="bp-doodle bp-doodle--arrow" viewBox="0 0 90 60" aria-hidden="true"><path class="s-ink" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M6 50 C 18 14, 50 6, 80 22 M66 12 L82 23 L68 34"/></svg>`,
  swirl: `<svg class="bp-doodle" viewBox="0 0 60 40" aria-hidden="true"><path class="s-ink" fill="none" stroke-width="2.4" stroke-linecap="round" d="M4 30 C 14 30, 18 10, 28 10 C 38 10, 38 26, 30 26 C 22 26, 26 8, 40 8 C 50 8, 54 20, 56 26"/></svg>`,
  sparkle: `<svg class="bp-doodle" viewBox="0 0 24 24" aria-hidden="true"><path class="f-gold" d="${SPARKLE}"/></svg>`,
  hearts: `<svg class="bp-doodle" viewBox="0 0 50 30" aria-hidden="true"><path class="s-acc" fill="none" stroke-width="2.2" d="M10 26s-7-4.4-9-8.4C-.4 14 1.6 10 5.4 10c2.2 0 3.4 1.2 4.6 3 1.2-1.8 2.4-3 4.6-3 3.8 0 5.8 4 4.4 7.6-2 4-9 8.4-9 8.4z"/><path class="f-blush" d="M36 18s-5-3-6.6-6.2C28.2 9.4 29.6 6.6 32.2 6.6c1.6 0 2.6.9 3.8 2.2 1.2-1.3 2.2-2.2 3.8-2.2 2.6 0 4 2.8 2.8 5.2C41 15 36 18 36 18z"/></svg>`,
};

function signatureSwash() {
  return `<svg class="bp-swash" viewBox="0 0 240 30" preserveAspectRatio="none" aria-hidden="true"><path class="s-acc" fill="none" stroke-width="3" stroke-linecap="round" d="M4 20 C 40 4, 78 32, 118 15 S 196 8, 236 18"/></svg>`;
}


/* ===================================================== round 2: vintage */

const GOLD_STOPS = '<stop offset="0" stop-color="#F7E9B8"/><stop offset=".3" stop-color="#C9A24A"/><stop offset=".52" stop-color="#F4E2A6"/><stop offset=".78" stop-color="#A8802F"/><stop offset="1" stop-color="#E9D08C"/>';
const gold = id => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${GOLD_STOPS}</linearGradient>`;
const ring = (cx, cy, R, n, fn) => Array.from({ length: n }, (_, i) => { const t = (2 * Math.PI * i) / n - Math.PI / 2; return fn(cx + R * Math.cos(t), cy + R * Math.sin(t), t, i); }).join('');

/**
 * The cameo frame: a lace scallop with eyelets, double gold hairlines, a row
 * of seed pearls, a silk bow and a small floral sprig. It is an OVERLAY — the
 * photo sits underneath, a touch larger than the window, so the pearls always
 * cover its edge (no gap can ever show).
 */
function cameoFrame() {
  const pearls = ring(160, 160, 113.5, 60, (x, y) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.7"/>`);
  const shine = ring(160, 160, 113.5, 60, (x, y) => `<circle cx="${(x - .8).toFixed(1)}" cy="${(y - .9).toFixed(1)}" r=".9"/>`);
  const eyelets = ring(160, 160, 138.5, 44, (x, y) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2"/>`);
  const scallop = scallopPath(160, 160, 146, 44);
  return `<svg class="bp-cameo" viewBox="0 0 320 320" aria-hidden="true" focusable="false">
  <defs>${gold('bpCamGold')}
    <mask id="bpCamMask"><rect width="320" height="320" fill="#fff"/><circle cx="160" cy="160" r="109" fill="#000"/></mask>
  </defs>
  <g mask="url(#bpCamMask)">
    <path class="f-lace" d="${scallop}"/>
    <path fill="none" stroke="url(#bpCamGold)" stroke-width="1.1" d="${scallop}"/>
    <g fill="none" stroke="url(#bpCamGold)" stroke-width=".8" opacity=".85">${eyelets}</g>
    <circle cx="160" cy="160" r="131" fill="none" stroke="url(#bpCamGold)" stroke-width=".8" stroke-dasharray="1 4.2" stroke-linecap="round"/>
    <circle cx="160" cy="160" r="125" class="f-paper"/>
    <circle cx="160" cy="160" r="125" fill="none" stroke="url(#bpCamGold)" stroke-width="1.8"/>
    <circle cx="160" cy="160" r="119.5" fill="none" stroke="url(#bpCamGold)" stroke-width=".7"/>
    <circle cx="160" cy="160" r="109.5" fill="none" stroke="url(#bpCamGold)" stroke-width="1.4"/>
    <g fill="#FFFDF7" stroke="#D8BE84" stroke-width=".6">${pearls}</g>
    <g fill="#fff" opacity=".95">${shine}</g>
  </g>
  <g class="bp-cameo__bow" transform="translate(160 22)">
    <path class="f-blush" stroke="url(#bpCamGold)" stroke-width=".9" d="M0 0 C-14 -16 -40 -16 -38 -2 C-36 10 -14 6 0 0Z"/>
    <path class="f-blush" stroke="url(#bpCamGold)" stroke-width=".9" d="M0 0 C14 -16 40 -16 38 -2 C36 10 14 6 0 0Z"/>
    <path class="f-blushdeep" opacity=".35" d="M-6 -1 C-16 -9 -30 -10 -32 -3 C-22 -6 -14 -4 -6 -1Z M6 -1 C16 -9 30 -10 32 -3 C22 -6 14 -4 6 -1Z"/>
    <path class="f-blush" stroke="url(#bpCamGold)" stroke-width=".9" d="M-3 2 L-16 26 L-10 24 L-7 31 L2 4Z"/>
    <path class="f-blush" stroke="url(#bpCamGold)" stroke-width=".9" d="M3 2 L16 26 L10 24 L7 31 L-2 4Z"/>
    <ellipse cx="0" cy="0" rx="6" ry="5" class="f-blushdeep" stroke="url(#bpCamGold)" stroke-width=".9"/>
  </g>
  <g class="bp-cameo__sprig" transform="translate(160 296)">
    <path fill="none" class="s-sage" stroke-width="1.3" stroke-linecap="round" d="M0 0 C-14 -2 -30 -8 -44 -18 M0 0 C14 -2 30 -8 44 -18"/>
    <g class="f-sage" opacity=".9">
      <path d="M-16 -4 C-20 -12 -14 -16 -10 -10 C-12 -7 -13 -5 -16 -4Z"/><path d="M-30 -10 C-36 -17 -30 -22 -25 -16 C-27 -13 -28 -11 -30 -10Z"/>
      <path d="M16 -4 C20 -12 14 -16 10 -10 C12 -7 13 -5 16 -4Z"/><path d="M30 -10 C36 -17 30 -22 25 -16 C27 -13 28 -11 30 -10Z"/>
    </g>
    <g class="f-blush" stroke="url(#bpCamGold)" stroke-width=".6">
      <circle cx="0" cy="-2" r="5.5"/><circle cx="-42" cy="-19" r="3.4"/><circle cx="42" cy="-19" r="3.4"/>
    </g>
    <circle cx="0" cy="-2" r="1.8" fill="#E9D08C"/>
  </g>
</svg>`;
}

/** What sits inside the cameo until a photo is added. */
function cameoPlaceholder(initial, invite) {
  return `<span class="bp-frame__empty">
    <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <defs>${gold('bpPhGold')}</defs>
      <circle cx="100" cy="100" r="74" fill="none" stroke="url(#bpPhGold)" stroke-width=".8" stroke-dasharray="2 5" stroke-linecap="round"/>
      <path fill="none" stroke="url(#bpPhGold)" stroke-width="1.3" stroke-linejoin="round" transform="translate(88 52) scale(1)" d="${HEART}"/>
      <path fill="none" stroke="url(#bpPhGold)" stroke-width=".9" stroke-linecap="round" d="M74 140 H92 M108 140 H126"/>
      <circle cx="100" cy="140" r="1.8" fill="#C9A24A"/>
    </svg>
    ${invite ? '<span class="bp-frame__invite">your photo<br>here</span>' : `<span class="bp-frame__mono">${initial}</span>`}
  </span>`;
}

/* ---------------------------------------------------------- the envelope */

/** Laid-paper texture + soft fibres, shared by the envelope faces. */
function paperDefs(p) {
  return `<pattern id="${p}Laid" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 3H6" stroke="#8a6a4a" stroke-opacity=".07" stroke-width=".7"/></pattern>
  <filter id="${p}Grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .33  0 0 0 0 .25  0 0 0 .09 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
  ${gold(p + 'Gold')}`;
}

function envelopeFront2() {
  return `<svg class="bp-env__front" viewBox="0 0 400 276" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <defs>${paperDefs('bpEf')}
    <linearGradient id="bpEfShadeL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".0"/><stop offset="1" stop-color="#000" stop-opacity=".06"/></linearGradient>
    <linearGradient id="bpEfShadeB" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity=".05"/></linearGradient>
  </defs>
  <path class="f-envside" d="M0 0 L200 160 L0 276Z"/>
  <path fill="url(#bpEfShadeL)" d="M0 0 L200 160 L0 276Z"/>
  <path class="f-envside" d="M400 0 L200 160 L400 276Z"/>
  <path class="f-envfront" d="M0 276 L200 134 L400 276Z"/>
  <path fill="url(#bpEfShadeB)" d="M0 276 L200 134 L400 276Z"/>
  <rect width="400" height="276" fill="url(#bpEfLaid)"/>
  <rect width="400" height="276" filter="url(#bpEfGrain)" fill="#fff"/>
  <path fill="none" stroke="#7a5a44" stroke-opacity=".14" stroke-width="1.4" d="M0 276 L200 134 L400 276 M0 0 L196 157 M400 0 L204 157"/>
  <path fill="none" stroke="url(#bpEfGold)" stroke-width=".9" opacity=".75" d="M24 268 L200 146 L376 268"/>
  <rect x="6" y="6" width="388" height="264" rx="8" fill="none" stroke="url(#bpEfGold)" stroke-width=".8" stroke-dasharray="1 3.5" opacity=".7"/>
</svg>`;
}

/** The flap has two faces: laid paper outside, a floral lace liner inside (seen once it opens). */
function envelopeFlap2() {
  const out = 'M0 0 H400 L216 176 Q200 190 184 176 Z';
  const inn = 'M0 190 H400 L216 14 Q200 0 184 14 Z'; // drawn tip-up: it is seen after the flap swings open
  return `<div class="bp-flap__face bp-flap__face--out"><svg class="bp-env__flapart" viewBox="0 0 400 190" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <defs>${paperDefs('bpEl')}</defs>
  <path class="f-envflap" d="${out}"/>
  <path fill="url(#bpElLaid)" d="${out}"/>
  <path filter="url(#bpElGrain)" fill="#fff" d="${out}"/>
  <path fill="none" stroke="url(#bpElGold)" stroke-width=".9" opacity=".8" d="M22 8 L190 168 Q200 177 210 168 L378 8"/>
</svg></div><div class="bp-flap__face bp-flap__face--in"><svg class="bp-env__flapart" viewBox="0 0 400 190" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <defs>${gold('bpLinGold')}
    <pattern id="bpLiner" width="26" height="26" patternUnits="userSpaceOnUse">
      <rect width="26" height="26" class="f-blush"/>
      <g class="f-linerdot"><circle cx="13" cy="13" r="2.2"/><circle cx="13" cy="7.6" r="1.6"/><circle cx="13" cy="18.4" r="1.6"/><circle cx="7.6" cy="13" r="1.6"/><circle cx="18.4" cy="13" r="1.6"/><circle cx="0" cy="0" r="1"/><circle cx="26" cy="0" r="1"/><circle cx="0" cy="26" r="1"/><circle cx="26" cy="26" r="1"/></g>
    </pattern>
  </defs>
  <path class="f-envflap" d="${inn}"/>
  <path fill="url(#bpLiner)" transform="translate(0 6) scale(1 .96)" d="${inn}"/>
  <path fill="none" stroke="url(#bpLinGold)" stroke-width="1" d="M16 186 L188 22 Q200 11 212 22 L384 186"/>
</svg></div>`;
}

/** A satin ribbon across the envelope, held by the seal; the halves slide away when it cracks. */
function envelopeRibbon() {
  const band = (x, w) => `<rect x="${x}" y="178" width="${w}" height="16" fill="url(#bpRibSatin)"/><path d="M${x} 181 H${x + w} M${x} 191 H${x + w}" stroke="#fff" stroke-opacity=".35" stroke-width=".8"/>`;
  return `<svg class="bp-env__ribbon" viewBox="0 0 400 276" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <defs><linearGradient id="bpRibSatin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--blush-deep)"/><stop offset=".45" style="stop-color:var(--blush)"/><stop offset=".55" stop-color="#fff" stop-opacity=".9"/><stop offset=".62" style="stop-color:var(--blush)"/><stop offset="1" style="stop-color:var(--blush-deep)"/></linearGradient></defs>
  <g class="bp-ribbon__l">${band(0, 200)}
    <g transform="translate(92 186)">
      <path fill="url(#bpRibSatin)" stroke="#fff" stroke-opacity=".5" stroke-width=".7" d="M0 0 C-12 -20 -40 -22 -38 -6 C-36 6 -14 6 0 0Z M0 0 C12 -20 40 -22 38 -6 C36 6 14 6 0 0Z"/>
      <path fill="url(#bpRibSatin)" d="M-3 3 L-18 34 L-11 31 L-8 39 L3 5Z M3 3 L18 34 L11 31 L8 39 L-3 5Z"/>
      <ellipse rx="6.5" ry="6" style="fill:var(--blush-deep)"/>
    </g>
  </g>
  <g class="bp-ribbon__r">${band(200, 200)}</g>
</svg>`;
}

/** Wax seal with a raised gold rim and an embossed initial, plus a lavender sprig tucked beneath. */
function waxSeal2(initial) {
  const blob = 'M50 5C64 3 78 11 86 23C96 35 97 52 93 64C89 80 75 92 59 95C42 98 24 91 14 79C4 66 3 47 9 33C17 16 34 6 50 5Z';
  const body = `<path class="f-acc" d="${blob}"/>
    <path fill="#000" opacity=".16" d="M86 23C96 35 97 52 93 64C89 80 75 92 59 95C70 86 80 72 82 56C84 44 82 32 86 23Z"/>
    <circle cx="50" cy="50" r="31" fill="none" stroke="url(#bpSealGold)" stroke-width="2.6"/>
    <circle cx="50" cy="50" r="27.5" fill="#000" opacity=".1"/>
    <circle cx="50" cy="50" r="27.5" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="1"/>
    <text x="50" y="61" text-anchor="middle" class="bp-seal__initial">${initial}</text>
    <ellipse cx="34" cy="24" rx="12" ry="5.5" fill="#fff" opacity=".22" transform="rotate(-30 34 24)"/>`;
  return `<svg class="bp-seal" viewBox="-30 -30 160 160" aria-hidden="true" focusable="false">
  <defs>${gold('bpSealGold')}
    <clipPath id="bpSealL"><path d="M-30 -30H52L45 30L56 50L43 70L53 130H-30Z"/></clipPath>
    <clipPath id="bpSealR"><path d="M52 -30H130V130H53L43 70L56 50L45 30Z"/></clipPath>
  </defs>
  <g class="bp-seal__sprig">
    <path fill="none" class="s-sage" stroke-width="1.6" stroke-linecap="round" d="M60 70 C 80 40, 96 18, 112 -6 M58 74 C 84 56, 104 46, 124 40"/>
    <g class="f-lavdeep">${[[100, 10], [106, 1], [111, -7], [95, 18], [112, 44], [118, 41], [104, 48]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3.2" ry="4.6" transform="rotate(35 ${x} ${y})"/>`).join('')}</g>
  </g>
  <g class="bp-seal__half bp-seal__l" clip-path="url(#bpSealL)">${body}</g>
  <g class="bp-seal__half bp-seal__r" clip-path="url(#bpSealR)">${body}</g>
</svg>`;
}

function stamp2() {
  const perf = Array.from({ length: 9 }, (_, i) => `<circle cx="${4 + i * 7}" cy="0" r="2.4"/><circle cx="${4 + i * 7}" cy="80" r="2.4"/>`).join('') +
    Array.from({ length: 12 }, (_, i) => `<circle cx="0" cy="${3 + i * 6.8}" r="2.4"/><circle cx="64" cy="${3 + i * 6.8}" r="2.4"/>`).join('');
  return `<svg class="bp-stamp" viewBox="-6 -6 76 92" aria-hidden="true" focusable="false">
  <defs>${gold('bpStGold')}<mask id="bpStPerf"><rect x="-6" y="-6" width="76" height="92" fill="#fff"/><g fill="#000">${perf}</g></mask></defs>
  <g mask="url(#bpStPerf)"><rect width="64" height="80" class="f-paper"/></g>
  <rect x="6" y="6" width="52" height="68" class="f-cream"/>
  <rect x="6" y="6" width="52" height="68" fill="none" stroke="url(#bpStGold)" stroke-width="1"/>
  <g transform="translate(32 36)">
    <path class="f-blush" stroke="url(#bpStGold)" stroke-width=".7" d="M0 -12 C8 -14 13 -6 9 1 C14 6 8 14 0 10 C-8 14 -14 6 -9 1 C-13 -6 -8 -14 0 -12Z"/>
    <path class="f-blushdeep" d="M0 -6 C4 -7 6 -3 4 0 C6 3 3 6 0 4 C-3 6 -6 3 -4 0 C-6 -3 -4 -7 0 -6Z"/>
    <path fill="none" class="s-sage" stroke-width="1.2" stroke-linecap="round" d="M0 10 C0 18 -2 24 -6 28 M0 18 C4 16 8 17 10 20"/>
  </g>
  <text x="32" y="69" text-anchor="middle" class="bp-stamp__text">WITH LOVE</text>
</svg>`;
}

function postmark() {
  return `<svg class="bp-postmark" viewBox="0 0 130 70" aria-hidden="true" focusable="false">
  <g fill="none" class="s-ink" stroke-opacity=".32" stroke-width="1.3">
    <circle cx="35" cy="35" r="27"/><circle cx="35" cy="35" r="21"/>
    <path d="M66 22 q8 -5 16 0 t16 0 t16 0 t14 0 M66 35 q8 -5 16 0 t16 0 t16 0 t14 0 M66 48 q8 -5 16 0 t16 0 t16 0 t14 0"/>
  </g>
  <text x="35" y="33" text-anchor="middle" class="bp-postmark__text">SEALED</text>
  <text x="35" y="44" text-anchor="middle" class="bp-postmark__text">♡</text>
</svg>`;
}

/** A slim, translucent pearl balloon for the finale (gradient #bpPearl lives in the finale defs). */
function pearlBalloon() {
  return `<svg class="bp-balloon bp-balloon--pearl" viewBox="0 0 60 150" aria-hidden="true" focusable="false">
  <path fill="none" stroke="#C9A24A" stroke-opacity=".7" stroke-width=".9" d="M30 82 q-6 16 0 32 q6 16 -1 34"/>
  <path fill="url(#bpPearl)" stroke="#fff" stroke-opacity=".7" stroke-width=".8" d="M30 3C46 3 56 18 56 36C56 56 43 75 30 79C17 75 4 56 4 36C4 18 14 3 30 3Z"/>
  <path fill="#E9D08C" d="M26.5 84 L30 78 L33.5 84Z"/>
  <ellipse cx="20" cy="24" rx="5" ry="10" fill="#fff" opacity=".55" transform="rotate(18 20 24)"/>
</svg>`;
}

module.exports = {
  cameoFrame, cameoPlaceholder, envelopeFront2, envelopeFlap2, envelopeRibbon, waxSeal2, stamp2, postmark, pearlBalloon,
  HEART, SPARKLE, heart, sparkle, scallopPath, scallopFrame, partyCat, peekBunny, noDuo,
  waxSeal, envelopeFront, envelopeFlap, stamp, cassette, recordPlayer, cake, balloon, ribbon,
  starSticker, heartSticker, flowerSticker, doodle, signatureSwash,
};
