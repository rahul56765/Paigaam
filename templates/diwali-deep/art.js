'use strict';

// Original engraved vector ornament. Every invocation has its own paint-server IDs.
let serial = 0;
const uid = (name) => `dd-${name}-${++serial}`;
const gold = '#d6aa58';
const pale = '#f4cd76';
const wine = '#721d2d';
const green = '#075345';
const repeat = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join('');
const attr = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (cls, content, box = '0 0 360 640') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" class="${cls}" aria-hidden="true" focusable="false" fill="none">${content}</svg>`;

function rosette(x, y, r, petals = 12, color = gold) {
  return `<g transform="translate(${x} ${y})" stroke="${color}" stroke-width=".65">${repeat(petals, (i) => `<g transform="rotate(${i * 360 / petals})"><path d="M0 0 Q${-r * .33} ${-r * .61} 0 ${-r} Q${r * .33} ${-r * .61} 0 0Z"/><path d="M0 ${-r * .24}V${-r * .81}"/></g>`)}<circle r="${r * .17}" fill="${color}"/><circle r="${r * 1.07}"/></g>`;
}

function paisley(x, y, scale = 1, angle = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})" stroke="${gold}" stroke-width=".8"><path d="M0 34C-24 22-18-6 2-12C22-18 30-2 20 7C10 16-1 5 7 0C-3 2-9 13-1 24C2 29 6 31 0 34Z"/><path d="M-1 29C-18 17-12-3 1-7C14-11 22-4 17 2C11 9 4 5 7 0"/><path d="M-6 20Q-2 13 3 12M-9 13Q-3 9 1 8M-9 6Q-4 2 0 1M-6-1Q0-3 3-4"/>${repeat(7, (i) => `<circle cx="${-10 + i * 3.3}" cy="${-5 - Math.sin(i / 6 * Math.PI) * 6}" r=".9" fill="${gold}" stroke="none"/>`)}<path d="M-1 25Q7 22 11 14Q2 15-1 25ZM-2 26Q-11 24-13 17Q-6 18-2 26Z"/></g>`;
}

function vine(x, y, length, angle = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${angle})" stroke="${gold}" stroke-width=".65"><path d="M0 0Q14 ${length / 3} 0 ${length * .67}Q-8 ${length * .85} 0 ${length}"/>${repeat(8, (i) => {
    const yy = i * length / 9 + 6;
    const side = i % 2 ? -1 : 1;
    return `<path d="M4 ${yy + 9}Q${side * 21} ${yy + 4} ${side * 19} ${yy - 8}Q${side * 3} ${yy - 5} 4 ${yy + 9}ZM4 ${yy + 9}L${side * 15} ${yy - 4}"/>`;
  })}</g>`;
}

const aperture = 'M180 49C175 77 155 81 144 98C132 115 145 122 145 122C115 112 91 130 91 154C91 164 96 171 96 171C68 179 54 201 62 224C65 232 70 240 70 240C45 251 45 276 62 294C47 327 54 366 71 383C53 405 61 436 81 447C76 487 112 528 149 541C168 548 177 561 180 580C183 561 192 548 211 541C248 528 284 487 279 447C299 436 307 405 289 383C306 366 313 327 298 294C315 276 315 251 290 240C290 240 295 232 298 224C306 201 292 179 264 171C264 171 269 164 269 154C269 130 245 112 215 122C215 122 228 115 216 98C205 81 185 77 180 49Z';

/** Full-height green card and engraved Mughal aperture; deliberately contains no type or lamp. */
function coverArt() {
  const id = uid('cover');
  const corners = [[23, 31, 0], [337, 31, 90], [337, 609, 180], [23, 609, 270]];
  return svg('dd-cover-art', `<defs>
    <mask id="${id}-outside"><rect width="360" height="640" fill="white"/><path d="${aperture}" fill="black" stroke="black" stroke-width="13"/></mask>
    <clipPath id="${id}-frame"><rect x="20" y="28" width="320" height="584"/></clipPath>
    <pattern id="${id}-grain" width="9" height="11" patternUnits="userSpaceOnUse"><path d="M2 2h.4M7 7h.3" stroke="#f0cf87" stroke-opacity=".15" stroke-width=".5"/></pattern>
  </defs>
  <rect width="360" height="640" fill="${green}"/>
  <rect x="20" y="28" width="320" height="584" fill="#354f39" stroke="${gold}" stroke-width="2.6"/>
  <path d="M21 344C78 369 81 477 180 524C267 480 288 380 339 344V611H21Z" fill="${wine}"/>
  <g clip-path="url(#${id}-frame)" mask="url(#${id}-outside)" opacity=".91">
    ${repeat(7, (i) => vine(30 + i * 48, 18, 155, -15 + i * 5))}
    ${repeat(6, (i) => paisley(37 + i * 57, 60 + (i % 2) * 33, .95, i % 2 ? -20 : 20))}
    ${repeat(5, (i) => `<g>${paisley(27, 177 + i * 71, 1.18, -28)}${paisley(333, 177 + i * 71, -1.18, 28)}</g>`)}
    ${repeat(7, (i) => vine(22 + i * 51, 475 + (i % 2) * 25, 165, i % 2 ? -22 : 16))}
    ${repeat(7, (i) => paisley(31 + i * 50, 558 + (i % 2) * 20, 1, i * 33))}
    ${repeat(5, (i) => rosette(27 + i * 77, 345 + (i % 2) * 70, 16))}
    ${corners.map(([x, y, a]) => `<g transform="translate(${x} ${y}) rotate(${a})"><path d="M0 0H76C72 39 39 77 0 80Z" fill="${wine}" stroke="${gold}" stroke-width="1.8"/><path d="M4 4H68C64 36 35 66 4 71Z" stroke="${gold}"/><path d="M8 8H59C57 33 32 56 8 60" stroke="${gold}" stroke-width=".6"/>${repeat(10, (i) => `<path d="M${8 + i * 5.6} 5Q${8 + i * 5.6} ${16 + i * 2} ${3 + i * 3} ${24 + i * 4}" stroke="${gold}" stroke-width=".65"/>`)}<path d="M8 10Q37 20 43 43Q20 38 8 10ZM8 10L35 35M8 10Q13 30 9 44M8 10Q28 15 42 12" stroke="${pale}" stroke-width="1.1"/>${repeat(12, (i) => `<circle cx="${Math.cos(i * Math.PI / 22) * 75}" cy="${Math.sin(i * Math.PI / 22) * 75}" r="1.2" fill="${gold}"/>`)}</g>`).join('')}
  </g>
  <path d="${aperture}" fill="${green}" stroke="#6c3325" stroke-width="26"/>
  <path d="${aperture}" stroke="${gold}" stroke-width="22"/>
  <path d="${aperture}" stroke="#9c6737" stroke-width="16"/>
  <path d="${aperture}" stroke="${pale}" stroke-width="13.5"/>
  <path d="${aperture}" stroke="#c99145" stroke-width="10.5"/>
  <path d="${aperture}" stroke="#79502c" stroke-width=".65"/>
  <path d="${aperture}" stroke="#f3cb77" stroke-width="2" stroke-dasharray=".65 4"/>
  <g stroke="#80552d" stroke-width=".55" opacity=".85">${[[166,77,-43],[150,92,-48],[138,110,15],[119,123,-8],[99,139,-52],[91,157,75],[78,182,-38],[61,204,-75],[65,227,65],[55,262,-80],[58,282,58],[55,316,-85],[57,349,80],[65,374,58],[63,414,75],[79,448,75],[87,476,55],[105,502,44],[130,526,26],[158,546,42],[175,565,70]].map(([x,y,a])=>[false,true].map(m=>`<g ${m?'transform="translate(360 0) scale(-1 1)"':''}><g transform="translate(${x} ${y}) rotate(${a})"><path d="M-8-3C-4-9 6-8 7-2C8 3 0 5-1 1C-2-2 3-3 3 0M-8 4Q0-1 8 4M-6-3Q-3-1-3 2"/></g></g>`).join('')).join('')}</g>
  <g mask="url(#${id}-outside)" stroke="${gold}" stroke-width=".7">
    ${repeat(11, (i) => `<g transform="translate(${62 + i * 23.6} ${560 + Math.abs(i - 5) * 5}) rotate(${(i - 5) * 9})"><path d="M0 0Q-12-15-9-28Q2-24 0 0ZM0 0Q14-14 12-27Q0-24 0 0ZM0 0V-31"/></g>`)}
  </g>
  <rect x="20" y="28" width="320" height="584" stroke="${gold}" stroke-width="2"/>
  <rect x="24" y="32" width="312" height="576" stroke="${gold}" stroke-width=".65"/>
  <rect width="360" height="640" fill="url(#${id}-grain)"/>
  <g fill="${gold}" opacity=".6">${[[112,273],[248,273],[96,336],[264,336],[119,392],[241,392],[106,462],[254,462]].map(([x,y])=>`<path d="M${x} ${y-2}l1 2-1 2-1-2Z"/>`).join('')}</g>`);
}

function flame(x, y, scale = 1) {
  return `<g class="dd-flame" transform="translate(${x} ${y}) scale(${scale})"><ellipse class="dd-art-glow" cx="0" cy="-12" rx="13" ry="21" fill="#ffc842" opacity=".12"/><path d="M0 0C-14-5-8-17-1-31C1-19 13-9 0 0Z" fill="#f4b82b"/><path d="M0 0C-8-4-4-12 0-21C1-13 7-5 0 0Z" fill="#ffe79a"/><path d="M0 0C-3-2-2-6 0-11C2-6 3-3 0 0Z" fill="#fff9db"/></g>`;
}

function hangingLamp(x, bowlY, size, id) {
  const top = Math.max(20, bowlY - 61);
  return `<g class="dd-hanging" style="transform-origin:${x}px ${top}px"><g stroke="${pale}" stroke-width=".9"><path d="M${x} ${top}V${bowlY-34}"/>${repeat(8, (i) => `<circle cx="${x}" cy="${top + i * (bowlY - 34 - top) / 8}" r="1.1" fill="${gold}"/>`)}<circle cx="${x}" cy="${bowlY-33}" r="2.3"/><path d="M${x} ${bowlY-30}L${x-size*.42} ${bowlY}M${x} ${bowlY-30}L${x+size*.42} ${bowlY}"/></g><g transform="translate(${x} ${bowlY})"><path d="M${-size/2} 0Q${-size*.43} 15 0 18Q${size*.43} 15 ${size/2} 0Z" fill="url(#${id}-brass)" stroke="${pale}" stroke-width=".8"/><path d="M${-size*.43} 5Q0 17 ${size*.43} 5" stroke="#a63b24" stroke-width="1.7"/><ellipse rx="${size/2}" ry="${size*.13}" fill="#a73123" stroke="${pale}" stroke-width="1.3"/><ellipse rx="${size*.37}" ry="${size*.055}" fill="#eea522"/>${repeat(7, (i) => `<circle cx="${(i-3)*size*.12}" cy="${8+Math.sin(i/6*Math.PI)*4}" r="1" fill="${pale}"/>`)}<path d="M0 18V23M-3 25L0 20L3 25L0 28Z" stroke="${gold}" fill="${gold}"/>${flame(0, -1, .61)}</g></g>`;
}

function mandala(x,y,r) {
  return `<g transform="translate(${x} ${y})">${repeat(16, i=>`<g transform="rotate(${i*22.5})"><path d="M0 0Q${-r*.22} ${-r*.64} 0 ${-r}Q${r*.22} ${-r*.64} 0 0Z" fill="#9b002b" stroke="${gold}" stroke-width="1.1"/><path d="M0 ${-r*.3}L${-r*.105} ${-r*.65}L0 ${-r*.89}L${r*.105} ${-r*.65}Z" stroke="${gold}" stroke-width=".7"/><path d="M0 0Q${-r*.2} ${-r*.38} 0 ${-r*.68}Q${r*.2} ${-r*.38} 0 0Z" fill="#e6b745" stroke="#7d162a" stroke-width="1.3"/><path d="M0 ${-r*.14}Q${-r*.1} ${-r*.35} 0 ${-r*.53}Q${r*.1} ${-r*.35} 0 ${-r*.14}Z" fill="#9b002b"/></g>`)}<circle r="${r*.28}" fill="#c38c2f" stroke="${gold}"/>${rosette(0,0,r*.25,12,'#81132a')}<circle r="${r*.07}" fill="${pale}"/></g>`;
}

function rangoli(id) {
  return `<g class="dd-rangoli" transform="translate(180 552)"><g transform="scale(.915 .34)">
  ${repeat(16, i=>`<g transform="rotate(${i*22.5})"><path d="M0 0Q-25-57 0-132Q25-57 0 0Z" fill="${i%2?'#b90031':'#820e2c'}" stroke="#bf8436" stroke-width="1"/><path d="M0-37Q-15-66 0-111Q15-66 0-37Z" fill="${i%2?'#d9982c':'#287164'}"/><path d="M0-52Q-6-76 0-97Q6-76 0-52Z" fill="${i%2?'#43826b':'#f2bf4c'}"/></g>`)}
  <circle r="67" fill="#b53627" stroke="${gold}" stroke-width="3"/><circle r="59" fill="#2d7862" stroke="#781f2d" stroke-width="3"/>
  ${repeat(12,i=>`<g transform="rotate(${i*30})"><path d="M0 0Q-20-24 0-52Q20-24 0 0Z" fill="#dba332" stroke="#a31c2d" stroke-width="1.3"/><path d="M0-10Q-8-24 0-39Q8-24 0-10Z" fill="#ad002c"/></g>`)}<circle r="18" fill="#9f002d" stroke="${gold}" stroke-width="2"/>
  ${repeat(48,i=>`<ellipse cx="${145*Math.cos(i*Math.PI/24)}" cy="${145*Math.sin(i*Math.PI/24)}" rx="${i%2?1.6:2.5}" ry="${i%2?2:3.2}" fill="${gold}" transform="rotate(${i*7.5} ${145*Math.cos(i*Math.PI/24)} ${145*Math.sin(i*Math.PI/24)})"/>`)}
  </g>
  <g transform="translate(-35 -54) scale(.35)">${diyaInner(id + '-rangoli')}</g></g>`;
}

/** Transparent invitation-page overlay; central text stays unobstructed. */
function festiveArt() {
  const id = uid('festive');
  return svg('dd-festive-art', `<defs><linearGradient id="${id}-brass" x2="0" y2="1"><stop stop-color="#f7ce62"/><stop offset="1" stop-color="#c77c28"/></linearGradient>${diyaDefs(id+'-rangoli')}</defs>
  <g fill="#ad002c" stroke="${gold}" stroke-width="1.5">
    <path d="M0 0H180Q155 35 119 9Q83 42 47 22Q26 78 0 107Z"/>
    <path d="M360 0H180Q205 35 241 9Q277 42 313 22Q334 78 360 107Z"/>
  </g>
  <g class="dd-trim-glow" stroke="${pale}" stroke-width=".7">${repeat(23,i=>{
    const x=i*16+4; const y= x<180 ? (x<50?24:12+12*Math.sin((x-40)/115*Math.PI)): (x>310?24:12+12*Math.sin((320-x)/115*Math.PI));
    return `<path d="M${x} ${y}v6"/><circle cx="${x}" cy="${y+8}" r="1.65" fill="${gold}"/>`;
  })}</g>
  ${hangingLamp(16,146,25,id)}${hangingLamp(40,111,25,id)}${hangingLamp(58,73,25,id)}
  ${hangingLamp(344,146,25,id)}${hangingLamp(320,111,25,id)}${hangingLamp(302,73,25,id)}
  <g>${[false,true].map(m=>`<g ${m?'transform="translate(360 0) scale(-1 1)"':''}>
    <path d="M0-3H56C48 40 33 78 9 99C4 135 11 169 18 207L0 214Z" fill="#ad002c"/>
    <path d="M43 0C34 46 21 74 0 92M15 0C13 40 6 56-3 66M3 113C1 146 9 177 10 208" stroke="#7a062e" stroke-width="4"/>
    <path d="M52 0C45 38 26 78 3 95M0 213L18 207" stroke="${gold}" stroke-width="5"/>
    <path d="M48 0C41 39 24 75 1 91" stroke="${pale}" stroke-width="1"/>
    ${repeat(15,i=>{const t=i/14;const x=49-47*t;const y=t*92;return `<circle cx="${x}" cy="${y}" r="1.45" fill="#a0092c"/>`;})}
    ${repeat(5,i=>`<path d="M${i*4-1} ${213-i}v5" stroke="${gold}" stroke-width="1"/><circle cx="${i*4-1}" cy="${220-i}" r="1.6" fill="${pale}"/>`)}
    ${repeat(15,i=>{const x=5+(i%3)*11;const y=12+Math.floor(i/3)*22;return `<path d="M${x-1.5} ${y}h3M${x} ${y-1.8}v3.6" stroke="${gold}" stroke-width=".7"/>`;})}
    ${rosette(16,27,8,8)}${rosette(6,72,7,8)}${rosette(6,173,7,8)}
    ${repeat(7,i=>`<path d="M${3+i%2*6} ${115+i*12}l1.3 2-1.3 2-1.3-2Z" fill="${gold}"/>`)}
  </g>`).join('')}</g>
  <g transform="translate(180 0)"><path d="M0 0C-8 8-8 15 0 24C8 15 8 8 0 0Z" fill="#e5a330"/><path d="M0 4C-4 10-4 15 0 19C4 15 4 10 0 4Z" fill="#307362"/><path d="M-2 0Q-14 2-19 13Q-4 14 0 3Q4 14 19 13Q14 2 2 0" fill="#bd6a27" stroke="${gold}" stroke-width="1"/></g>
  ${rangoli(id)}${mandala(-4,642,77)}${mandala(364,642,77)}`);
}

function diyaDefs(id) {
  return `<linearGradient id="${id}-bowl" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#a1322c"/><stop offset=".55" stop-color="#831b27"/><stop offset="1" stop-color="#5b1522"/></linearGradient><linearGradient id="${id}-oil" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#681323"/><stop offset="1" stop-color="#c24133"/></linearGradient>`;
}

function diyaInner(id) {
  return `<ellipse class="dd-art-glow" cx="100" cy="134" rx="43" ry="77" fill="#efb52b" opacity=".07"/>
  <g class="dd-flame-shape" style="transform-origin:100px 170px"><g class="dd-flame" style="transform-origin:100px 170px">
    <path d="M100 170C49 155 76 99 100 40C102 85 156 147 100 170Z" fill="#dda419"/>
    <path d="M100 169C68 154 88 117 99 89C103 117 130 151 100 169Z" fill="#f3c54c"/>
    <path d="M100 169C83 157 94 132 100 119C104 138 116 158 100 169Z" fill="#fff0ad"/>
    <path d="M100 170C94 162 97 148 101 139C104 153 106 164 100 170Z" fill="#fffbe2"/>
  </g></g>
  <path d="M74 218L68 231Q99 240 132 231L126 218Z" fill="#6e1b25" stroke="#c08b48" stroke-width="1.1"/>
  <path d="M73 226Q100 233 128 226" stroke="${pale}" stroke-width="2.2" stroke-dasharray="2 2.8"/>
  <path d="M15 176C21 210 51 230 100 230C149 230 179 210 185 176Z" fill="url(#${id}-bowl)" stroke="#c3934b" stroke-width="1.5"/>
  <path d="M21 190Q100 217 179 190" stroke="${gold}" stroke-width="1.2"/>
  <path d="M26 198Q100 220 174 198" stroke="${gold}" stroke-width=".6"/>
  ${repeat(13,i=>{ const x=27+i*12.2; const yy=190+Math.sin(i/12*Math.PI)*10;return `<g transform="translate(${x} ${yy})"><path d="M-5 0Q0 10 5 0Q0 4-5 0Z" fill="${gold}"/><path d="M0 2V7" stroke="#7b2229" stroke-width=".55"/></g>`;})}
  <ellipse cx="100" cy="176" rx="85" ry="19" fill="#6a1725" stroke="${pale}" stroke-width="2.5"/>
  <ellipse cx="100" cy="177" rx="72" ry="12" fill="url(#${id}-oil)" stroke="#cb8e48" stroke-width=".7"/>
  <path d="M20 178Q100 209 180 178" stroke="${pale}" stroke-width="2.1" stroke-dasharray="2 3.2"/>
  <path d="M100 178C94 173 95 169 99 163C106 167 105 172 100 178Z" fill="#3e171b"/>
  <path d="M99 171C94 163 98 154 100 150C104 160 104 165 99 171Z" fill="#ad3921"/>
  <path d="M99 165L100 155L102 165Z" fill="#ffdf67"/>
  <g stroke="${gold}" stroke-width=".65" opacity=".83"><path d="M49 212Q69 219 82 216Q88 214 85 211Q81 208 78 212Q75 217 71 213M151 212Q131 219 118 216Q112 214 115 211Q119 208 122 212Q125 217 129 213"/><path d="M91 217Q100 208 109 217Q100 226 91 217ZM97 217h6"/></g>`;
}

/** Standalone lamp; native bowl baseline 230, flame tip 40. */
function diya(extraClass = '') {
  const id = uid('diya');
  return svg(`dd-diya ${attr(extraClass)}`.trim(), `<defs>${diyaDefs(id)}</defs>${diyaInner(id)}`, '0 0 200 240');
}

module.exports = { coverArt, festiveArt, diya };
