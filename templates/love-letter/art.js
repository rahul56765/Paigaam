/** Original botanical illustrations. Self-contained, decorative, and resolution independent. */
const ink = '#500719';
const svg = (viewBox, content) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" aria-hidden="true" focusable="false">${content}</svg>`;
const defs = (p) => `<defs>
  <radialGradient id="${p}-petal" cx=".33" cy=".23" r=".85"><stop stop-color="#e65d70"/><stop offset=".32" stop-color="#bd304c"/><stop offset=".74" stop-color="#941b32"/><stop offset="1" stop-color="#500719"/></radialGradient>
  <linearGradient id="${p}-fold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f38a92"/><stop offset=".28" stop-color="#c64760"/><stop offset=".65" stop-color="#941b32"/><stop offset="1" stop-color="#650b25"/></linearGradient>
  <linearGradient id="${p}-leaf" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#7d8b62"/><stop offset=".48" stop-color="#455e45"/><stop offset="1" stop-color="#203e35"/></linearGradient>
  <linearGradient id="${p}-paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff9ed"/><stop offset=".46" stop-color="#fff1dc"/><stop offset="1" stop-color="#d8bca4"/></linearGradient>
  <linearGradient id="${p}-satin" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#500719"/><stop offset=".24" stop-color="#941b32"/><stop offset=".43" stop-color="#de6c81"/><stop offset=".57" stop-color="#a82c46"/><stop offset="1" stop-color="#500719"/></linearGradient>
</defs>`;

// Each petal is a closed, asymmetric organic contour rather than an ellipse.
function bloom(p, x, y, scale = 1, rotation = 0) {
  const outer = Array.from({ length: 7 }, (_, i) => `<path transform="rotate(${i * 51.43})" d="M-8 15 C-30 17-52 1-48-20 C-46-35-34-36-26-43 C-19-50-6-45 0-39 C18-37 31-21 24-7 C18 4 7 11-8 15Z" fill="url(#${p}-petal)" stroke="#630e28" stroke-width=".65"/><path transform="rotate(${i * 51.43})" d="M-46-20 C-42-34-33-31-25-40 C-16-46-8-39 0-37" stroke="#f49a9f" stroke-opacity=".55" stroke-width="1.15" stroke-linecap="round"/>`).join('');
  const inner = Array.from({ length: 6 }, (_, i) => `<g transform="rotate(${i * 60 + 23})"><path d="M-5 15 C-22 12-35-2-28-17 C-24-28-12-30-4-25 C5-29 20-24 21-14 C24-1 8 10-5 15Z" fill="url(#${p}-fold)" stroke="#710e29" stroke-width=".75"/><path d="M-26-17 C-22-27-14-25-6-24 C2-26 10-24 15-19" stroke="#ee8796" stroke-opacity=".7" stroke-width=".9" stroke-linecap="round"/></g>`).join('');
  return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})"><path d="M-44 19 0 44 43 17 30-29-8-42-42-18Z" fill="#3d5140"/>${outer}${inner}<path d="M-17 8 C-25-5-10-21 3-18 C21-19 28-2 14 12 C5 23-12 22-17 8Z" fill="#850f30"/><path d="M-16 5 C-19-8-5-17 5-12 C15-15 22-2 13 5 C8 9-4 13-5 5 C-6-1 4-5 8-1" stroke="#e16d83" stroke-width="3.8" stroke-linecap="round"/><path d="M-9 12 C0 17 15 10 16 1 M-4-8 C2-12 9-8 9-3" stroke="#f5bbc9" stroke-opacity=".65" stroke-width=".85" stroke-linecap="round"/><path d="M-8 3 C-6-5 5-6 6 1 C7 7-1 9-4 5" fill="#500719"/></g>`;
}
function leaf(p, x, y, scale = 1, rotation = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})"><path d="M0 0 C-21-7-37-29-32-64 C-9-52 8-32 0 0Z" fill="url(#${p}-leaf)" stroke="#344b38" stroke-width="1"/><path d="M0 0-29-58 M-8-17-25-22 M-13-29-30-36 M-18-39-17-48 M-6-14-3-29" stroke="#b7bb87" stroke-opacity=".55" stroke-width=".85" stroke-linecap="round"/></g>`;
}
function ribbon(p, x, y, scale = 1, rotation = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})">
  <path d="M-9 3 C-23 43-30 71-58 100 L-25 90-11 111 C-1 76 11 37 10 10Z" fill="url(#${p}-satin)" stroke="#500719" stroke-width="1.3"/>
  <path d="M7 7 C19 38 30 78 54 93 L31 92 19 110 C13 75-4 43-8 14Z" fill="url(#${p}-satin)" stroke="#500719" stroke-width="1.3"/>
  <path d="M-5 0 C-22-17-65-51-83-34 C-102-15-75 16-54 22 C-35 27-15 14-5 6Z" fill="url(#${p}-satin)" stroke="#500719" stroke-width="1.4"/>
  <path d="M7-1 C28-27 66-48 80-32 C97-11 70 16 51 20 C31 23 16 11 7 6Z" fill="url(#${p}-satin)" stroke="#500719" stroke-width="1.4"/>
  <path d="M-77-28 C-61-28-31-10-13 1 C-35-2-66-10-77-28Z M74-26 C55-25 28-8 15 1 C38-4 59-10 74-26Z" fill="#500719" opacity=".64"/>
  <path d="M-79-28 C-90-9-60 12-42 13 M77-26 C82-10 62 9 45 12 M-10 27 C-16 55-25 77-31 88 M15 31 C24 62 26 79 33 87" stroke="#f5bbc9" stroke-opacity=".6" stroke-width="2" stroke-linecap="round"/>
  <path d="M-11-10 C-6-13 7-12 12-8 L13 11 C6 17-6 16-12 9Z" fill="url(#${p}-satin)" stroke="#500719" stroke-width="1.5"/><path d="M-5-8 C-8-2-6 6-4 11" stroke="#f5bbc9" stroke-opacity=".75" stroke-width="2"/>
  </g>`;
}

const bouquet = svg('0 0 520 660', `${defs('bouquet')}
<g stroke-linejoin="round" stroke-linecap="round">
<path d="M103 250 259 551 425 240 341 205 252 240 173 204Z" fill="#ddc8ac" stroke="#b99a83" stroke-width="1.5"/>
<g stroke="#496044" stroke-width="4"><path d="M146 182 270 559 M224 142 266 560 M301 141 260 563 M370 194 250 555 M103 265 265 552 M416 270 255 553"/></g>
${[[139,247,1.3,-53],[171,188,1.1,-26],[229,178,1.1,13],[303,173,1.3,50],[359,220,1.3,78],[399,285,1.2,93],[115,310,1.2,-52],[192,326,1.1,-16],[349,338,1.1,91],[262,204,1,1],[414,226,.9,65],[107,212,.9,-34],[342,130,.9,35],[206,127,.9,-30]].map(a=>leaf('bouquet',...a)).join('')}
<g fill="#d8b9a6"><circle cx="128" cy="165" r="3"/><circle cx="136" cy="153" r="2.5"/><circle cx="389" cy="160" r="3"/><circle cx="401" cy="169" r="2"/></g>
<g stroke="#7d8b62" stroke-width="1.1"><path d="M149 218 128 165 M133 183 136 153 M365 223 389 160 M381 186 401 169"/></g>
${[[184,173,.88,-20],[261,140,.94,12],[337,178,.92,38],[125,238,.84,-28],[215,235,1.08,18],[305,232,1.03,-17],[389,244,.85,28],[163,305,.93,-12],[261,311,1.05,23],[353,306,.86,-25],[226,367,.77,-8],[305,365,.72,35]].map(a=>bloom('bouquet',...a)).join('')}
<path d="M92 301 C113 334 162 345 203 338 L267 548 237 599 C190 538 120 416 92 301Z" fill="url(#bouquet-paper)" stroke="#b99a83" stroke-width="1.5"/>
<path d="M427 295 C401 332 366 349 317 339 L247 549 278 600 C333 522 399 414 427 295Z" fill="url(#bouquet-paper)" stroke="#b99a83" stroke-width="1.5"/>
<path d="M103 317 C157 366 206 424 253 546 M417 313 C373 361 320 460 266 551" stroke="#fffaf1" stroke-width="3"/>
<path d="M143 371 231 535 M383 373 288 539 M164 391 229 506 M351 409 294 515" stroke="#bf9a82" stroke-width="1" opacity=".6"/>
<path d="M239 546 222 614 256 603 286 620 277 546" fill="url(#bouquet-paper)" stroke="#b99a83" stroke-width="1.3"/>
<path d="M246 559 237 600 M269 560 275 604" stroke="#c1a38b" stroke-width="1.2"/>
${ribbon('bouquet',260,518,.86,-6)}
</g>`);

const rose = svg('0 0 240 320', `${defs('rose')}
<path d="M130 111 C104 177 151 235 108 307" stroke="#3f5940" stroke-width="4" stroke-linecap="round"/>
<path d="m123 182 9 8-10 5 m5 53-8 9 4-13" fill="#3f5940"/>
${leaf('rose',127,221,1.12,-62)}${leaf('rose',126,257,1.03,70)}${leaf('rose',117,170,.72,-40)}
${bloom('rose',122,94,1.45,-12)}`);

function tulip(p, x, y, scale, rotation) {
  return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})"><path d="M0 0 C-8 49 14 104-5 171" stroke="#52664b" stroke-width="3.4" stroke-linecap="round"/><path d="M-1 145 C-44 103-35 77-44 58 C-16 76-9 106-1 145Z" fill="url(#${p}-leaf)"/><path d="M2 115 C36 79 29 50 43 32 C38 79 26 105 2 115Z" fill="url(#${p}-leaf)"/><path d="M0 0 C-23-1-35-20-30-51 C-18-43-12-45-3-60 C8-48 17-44 30-52 C35-21 25 0 0 0Z" fill="url(#${p}-petal)" stroke="#79122c" stroke-width="1.2"/><path d="M-1-1 C-22-17-17-41-3-60 C9-45 16-20-1-1Z" fill="url(#${p}-fold)" stroke="#941b32" stroke-width=".8"/><path d="M-25-45 C-27-24-19-12-12-9 M-3-52 C-10-39-11-25-7-14 M25-44 C27-27 20-15 12-10" stroke="#f5bbc9" stroke-opacity=".6" stroke-width="1.2" stroke-linecap="round"/></g>`;
}
const tulips = svg('0 0 270 340', `${defs('tulips')}${tulip('tulips',79,122,.94,-23)}${tulip('tulips',181,123,.98,23)}${tulip('tulips',134,84,1.13,2)}<path d="M99 288 C121 277 151 278 171 287" stroke="#941b32" stroke-width="5" stroke-linecap="round"/><path d="M132 286 C112 271 101 289 120 292 L135 286 C151 270 168 287 147 292Z" fill="#f5bbc9" stroke="#941b32" stroke-width="2"/><path d="m133 290-10 29 m15-29 15 25" stroke="#941b32" stroke-width="3" stroke-linecap="round"/>`);

const bow = svg('0 0 240 235', `${defs('bow')}${ribbon('bow',120,83,1.16,-5)}`);

const bunny = svg('0 0 320 370', `<defs><linearGradient id="bunny-fur" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffefa"/><stop offset="1" stop-color="#f3e5d9"/></linearGradient><linearGradient id="bunny-ear" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fbd3d8"/><stop offset="1" stop-color="#e99aaf"/></linearGradient></defs>
<g stroke="${ink}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
<path d="M220 276 C242 251 272 268 260 289 C252 303 236 298 224 292" fill="#fffaf2"/>
<path d="M100 236 C78 265 83 309 108 325 C125 340 198 337 219 318 C240 297 234 261 213 234Z" fill="url(#bunny-fur)"/>
<path d="M115 147 C84 105 76 29 97 24 C121 18 143 99 139 137 M173 138 C173 92 196 20 217 30 C239 44 210 112 197 147" fill="url(#bunny-fur)"/>
<path d="M119 126 C104 98 93 49 101 43 C110 41 126 95 128 126 M184 125 C188 91 207 45 213 47 C223 56 200 111 194 127" fill="url(#bunny-ear)" stroke="none"/>
<path d="M89 167 C96 137 121 125 149 130 L157 123 166 132 C202 126 229 150 232 182 C238 220 209 245 161 246 C112 247 81 220 86 189 L80 183 89 179" fill="url(#bunny-fur)"/>
<path d="M129 190 C126 183 120 182 118 190 M187 190 C184 182 178 183 176 190" stroke-width="5"/>
<ellipse cx="109" cy="206" rx="13" ry="8" fill="#f5bbc9" stroke="none"/><ellipse cx="202" cy="206" rx="13" ry="8" fill="#f5bbc9" stroke="none"/>
<path d="M148 204 Q157 200 163 204 L156 211Z" fill="#941b32" stroke-width="2"/><path d="M156 211 C156 222 143 219 142 215 M156 211 C157 222 170 219 171 215" stroke-width="2.5"/>
<path d="m102 211-18-3 m19 11-17 3 m122-11 18-3 m-19 11 17 3" stroke="#967567" stroke-width="1.5"/>
<path d="M103 311 C80 308 77 330 99 336 C115 342 137 335 139 325 M185 325 C189 339 218 339 228 330 C243 315 221 307 210 313" fill="#fffaf2"/>
<g transform="rotate(-7 158 275)"><rect x="102" y="239" width="112" height="79" rx="5" fill="#fff1dc" stroke-width="3"/><path d="m105 244 53 40 53-40 M106 312l36-32 m68 32-36-32" stroke="#bc8b85" stroke-width="2"/><path d="M158 284 C141 274 144 264 151 264 C155 264 158 268 158 268 C166 257 180 270 158 284Z" fill="#941b32" stroke="#941b32" stroke-width="1"/></g>
<path d="M108 253 C85 238 79 259 91 271 C102 282 115 277 119 265 M209 250 C229 235 241 253 230 266 C222 278 211 277 203 265" fill="url(#bunny-fur)"/>
<path d="m95 258 7 6 m122-9-7 7 m-117 62 2 6 m112-7-2 6" stroke="#c2a79c" stroke-width="1.6"/>
</g>`);

const camera = svg('0 0 300 230', `<defs><linearGradient id="camera-metal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff1dc"/><stop offset=".42" stop-color="#d7baa2"/><stop offset=".58" stop-color="#f6dfbf"/><stop offset="1" stop-color="#b88978"/></linearGradient><radialGradient id="camera-glass" cx=".35" cy=".3"><stop stop-color="#a97d83"/><stop offset=".32" stop-color="#50333f"/><stop offset=".7" stop-color="#29232d"/><stop offset="1" stop-color="#500719"/></radialGradient><pattern id="camera-leather" width="7" height="7" patternUnits="userSpaceOnUse"><path d="m1 2 2-1 m1 4 2-1" stroke="#f5bbc9" stroke-opacity=".16" stroke-width=".8"/></pattern></defs>
<g stroke="#500719" stroke-linejoin="round"><path d="M37 95 C-9 63 13 173 37 178 M264 97 C304 71 289 176 266 177" stroke-width="5"/><rect x="28" y="72" width="245" height="127" rx="15" fill="#941b32" stroke-width="4"/><rect x="30" y="106" width="241" height="66" fill="url(#camera-leather)" stroke="none"/><path d="M30 106V85 Q30 72 44 72 H98 L115 48 H176 L193 72 H258 Q271 72 271 86 V106Z" fill="url(#camera-metal)" stroke-width="3"/><path d="M31 176 H271 V186 Q271 199 258 199 H43 Q30 199 30 185Z" fill="url(#camera-metal)" stroke-width="3"/><rect x="119" y="59" width="51" height="25" rx="4" fill="#500719" stroke-width="2"/><rect x="125" y="64" width="39" height="14" rx="2" fill="#8e6f73" stroke-width="1"/><path d="m128 66 27 0-13 10h-14Z" fill="#fff1dc" opacity=".5" stroke="none"/><rect x="46" y="58" width="34" height="13" rx="4" fill="url(#camera-metal)" stroke-width="2"/><path d="m52 60 0 9 m6-9v9 m6-9v9 m6-9v9" stroke-width="1"/><rect x="216" y="60" width="27" height="12" rx="3" fill="#500719" stroke-width="2"/><circle cx="147" cy="138" r="53" fill="url(#camera-metal)" stroke-width="3"/><circle cx="147" cy="138" r="44" fill="#500719" stroke-width="2"/><circle cx="147" cy="138" r="36" fill="url(#camera-metal)" stroke-width="2"/><circle cx="147" cy="138" r="29" fill="url(#camera-glass)" stroke-width="3"/><circle cx="147" cy="138" r="20" stroke="#c3a0a0" stroke-opacity=".45"/><path d="M127 128 C129 116 144 113 151 117" stroke="#fff1dc" stroke-opacity=".7" stroke-width="4" stroke-linecap="round"/><circle cx="158" cy="150" r="5" fill="#f5bbc9" opacity=".35" stroke="none"/><rect x="218" y="83" width="34" height="15" rx="3" fill="#500719" stroke-width="2"/><circle cx="57" cy="91" r="6" fill="#941b32" stroke-width="2"/><path d="M44 119v39 m5-39v39 m5-39v39 m5-39v39 m5-39v39 M232 120v38 m5-38v38 m5-38v38 m5-38v38" stroke="#500719" stroke-opacity=".5" stroke-width="1.2"/><path d="M46 184h35 m137 0h36" stroke="#fff1dc" stroke-width="2" stroke-linecap="round"/></g>`);

const hearts = svg('0 0 300 240', `<g stroke-linecap="round" stroke-linejoin="round"><path d="M130 194 C105 172 42 135 37 91 C31 38 99 26 129 74 C160 17 228 38 224 89 C220 132 159 177 130 194Z" stroke="#941b32" stroke-width="3"/><path d="M130 184 C96 156 53 128 47 94 C39 48 97 42 124 83 M139 78 C165 35 216 51 213 87" stroke="#f5bbc9" stroke-width="1.8"/><path d="M225 214 C212 199 173 175 176 150 C179 122 209 121 224 142 C242 113 279 129 273 154 C267 178 240 202 225 214Z" stroke="#500719" stroke-width="2.5"/><path d="M43 49 C35 39 15 27 18 15 C21 2 35 5 41 15 C51 0 70 8 65 21 C62 32 49 44 43 49Z" stroke="#941b32" stroke-width="2"/><path d="m245 47 7-14 m5 27 15-3 M20 157l-7-9 m11 23-13 3 M147 215v11 m-6-5h12" stroke="#941b32" stroke-width="1.8"/><circle cx="265" cy="91" r="2" fill="#941b32"/><circle cx="91" cy="215" r="2.5" fill="#f5bbc9"/><path d="m252 108 3 5-3 5-3-5Z" fill="#f5bbc9"/></g>`);
module.exports = {bouquet, rose, tulips, bunny, bow, camera, hearts};
