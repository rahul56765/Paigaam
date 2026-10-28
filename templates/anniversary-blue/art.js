'use strict';

/**
 * Original pen-and-paper illustrations for Anniversary Blue.
 * Every asset is self-contained: no fonts, images, filters, fragment IDs or URLs.
 * Strings can be inserted directly into a server-rendered HTML document.
 */
const INK = '#30416e';
const BLUE = '#a8c8e6';
const PAPER = '#fafaf5';
const RED = '#b94d52';
const svg = (body, viewBox = '0 0 300 300') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" aria-hidden="true" focusable="false"><g stroke="${INK}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;

const couple = svg(`
  <path d="M49 262c-7-36-11-68 2-96-23-15-24-52-5-71-5-30 15-58 44-58 26-9 57 8 65 33 23-26 64-25 86-3 23 22 18 58 9 77 25 33 15 88 13 119-41 17-172 19-214-1Z" fill="${PAPER}" stroke="${PAPER}" stroke-width="14"/>
  <path d="M51 254c-6-39-8-73 17-94l54-5 35 49-3 60Z" fill="${BLUE}"/>
  <path d="M145 258c-1-28-4-73 22-91 17-10 37-10 54-3 29 19 31 56 27 94-28 12-71 14-103 0Z" fill="${PAPER}"/>
  <path d="m171 180 10 76m14-82 10 85m11-77 11 72" stroke="${BLUE}" stroke-width="8" opacity=".65"/>
  <path d="m87 143-2 24q16 17 30-1l-4-24m65 4-3 23q15 15 30-2l-4-25" fill="#edcdb6"/>
  <path d="M58 98c-5 33 3 59 33 62 27 4 44-15 47-44l-8-34-59-6Z" fill="#f2d6c2"/>
  <path d="M54 114c-16-19-3-47 14-51-1-22 31-32 48-19 24-1 41 22 31 43-2 14-10 23-17 26l-8-29c-16 13-35 12-48 4-2 13-7 22-20 26Z" fill="${INK}"/>
  <path d="M68 66c12-14 30-15 45-10m-48 20 9-5" stroke="#7185a4" stroke-width="2"/>
  <path d="M159 103c-4 30 2 58 29 60 28 1 43-18 41-46l-9-31-50-7Z" fill="#f2d6c2"/>
  <path d="M155 120c-21-29-2-62 22-65 26-12 58 7 58 34 10 29-3 51-15 61l-2-44c-20-1-35-16-40-25-2 15-10 24-23 28Z" fill="#454552"/>
  <path d="M173 67c16-8 35 2 41 13m9 30 1 21" stroke="#89909c" stroke-width="2"/>
  <path d="m81 119 5 2m22-1 5-2m65 3 5 2m20-2 5-2" stroke-width="3"/>
  <path d="M93 138q8 7 15-1m76 3q8 6 14-2"/>
  <path d="m97 122-3 8h5m91-5-2 8h4" stroke="#bf9583" stroke-width="1.5"/>
  <ellipse cx="77" cy="133" rx="7" ry="3" fill="#dfae9e" stroke="none"/><ellipse cx="210" cy="134" rx="7" ry="3" fill="#dfae9e" stroke="none"/>
  <path d="M66 179c10 32 44 52 80 48l50-19c12-4 6-21-6-17l-45 13c-23-1-43-15-48-32" fill="${BLUE}"/>
  <path d="M221 180c-5 20-28 33-54 35l-58-20c-14-6-21 10-9 17l58 27c34 4 66-9 79-30" fill="${PAPER}"/>
  <path d="m111 197-9 14m88-18 6 14m-46 20 11 11" stroke="#6982a4" stroke-width="1.5"/>
  <path d="m71 232 7 24m155-22-5 21M59 267q86 9 184-2" opacity=".55"/>
  <path d="M146 44c-10-12-23 1 0 16 24-15 11-28 0-16Z" fill="${BLUE}" stroke-width="2"/>
`);

const bouquet = svg(`
  <path d="m69 124 24-25-2-41 36-20 32 13 37-5 22 33-1 35 19 18-62 139-41 5Z" fill="${PAPER}" stroke="${PAPER}" stroke-width="15"/>
  <path d="m87 133 53 119 28-2 47-124-61 44Z" fill="#ece8dc"/>
  <path d="m118 93 35 132m42-141-43 141m-11-148 10 150" stroke="#6b8190" stroke-width="3"/>
  <path d="M129 161c-23-4-34-19-36-34 23 1 35 13 36 34Zm42-19c2-24 15-35 33-39-1 22-14 34-33 39Zm-24-23c-20-8-25-22-22-37 20 5 27 20 22 37Z" fill="#9bafaa"/>
  <path d="m100 135 21 19m77-44-20 24m-47-44 12 20" stroke="#647b79" stroke-width="1.5"/>
  <path d="M82 85c-12-15 1-30 13-28 0-17 25-22 34-8 18-4 30 15 21 29 4 21-18 36-34 27-14 8-34-2-34-20Z" fill="${RED}"/>
  <path d="M97 67c15-13 34-6 36 8-2 17-20 23-29 13-12-5-7-19 4-20 12-2 18 9 10 14l-9-5m-25 5 20 6m27-38-8 14m22 18-16 7" stroke="#793f50" stroke-width="2"/>
  <path d="M154 81c-11-13-6-30 10-33 9-15 29-12 34 3 19 1 24 22 12 34-3 19-25 25-37 14-12 1-20-6-19-18Z" fill="#c96667"/>
  <path d="M166 66c9-14 28-12 34 1 4 12-7 25-18 19-13 0-15-14-6-19 9-4 18 2 13 9l-9 1m-22 8 17-4m18-34-4 12m21 23-13 4" stroke="#8b4351" stroke-width="2"/>
  <path d="M125 117c-10-11-4-25 9-27 8-12 26-10 30 3 16 3 17 20 5 28-5 17-25 19-33 8-9 0-15-6-11-12Z" fill="#b74b55"/>
  <path d="M136 103c11-12 27 0 20 11-8 10-24 1-16-7l9 1m-20 13 11-6m24-20-10 8" stroke="#7e394b" stroke-width="2"/>
  <path d="m78 126 68 41-9 92-27-43Z" fill="${PAPER}"/>
  <path d="m220 121-58 52-10 86 32-45Z" fill="#e4e9e9"/>
  <path d="m91 145 42 30m69-28-30 30m-39 18 4 34m35-47-14 48" stroke="#a8b3b9" stroke-width="1.5"/>
  <path d="m134 214 31 1-1 13-29-1Z" fill="${INK}"/>
  <path d="M148 220c-48-45-65-9-37 8 12 6 25 1 37-8Zm6 0c41-41 63-11 40 6-13 9-29 1-40-6Z" fill="${BLUE}"/>
  <path d="m145 226-22 43 16-6 8 11 7-48 21 44 4-15 15 3-34-35" fill="${BLUE}"/>
  <path d="m116 215 26 6m42-7-25 7m-17 13-9 21m26-20 14 21" stroke="#6e91b3" stroke-width="1.5"/>
  <ellipse cx="151" cy="222" rx="8" ry="9" fill="${INK}"/>
`);

const cake = svg(`
  <path d="M43 253v-30l13-11v-65l34-21V91l43-15V44h33v31l42 15v36l34 19v68l15 11v30Z" fill="${PAPER}" stroke="${PAPER}" stroke-width="14"/>
  <ellipse cx="150" cy="243" rx="111" ry="19" fill="${BLUE}"/>
  <ellipse cx="150" cy="236" rx="110" ry="18" fill="${PAPER}"/>
  <path d="M59 151v77c39 24 145 25 182-1v-76Z" fill="${INK}"/>
  <path d="M67 210q84 24 165-1m-165 13q83 23 165-1" stroke="#7185ab" stroke-width="1.5"/>
  <path d="M59 153c4-24 179-26 182 0v23c-6 15-15 12-18-1-4-16-14-13-17 1-5 22-18 22-22 0-4-16-16-16-20 0-4 21-19 20-22-1-4-16-16-15-20 0-4 18-18 20-22 1-4-17-13-17-18-2-5 17-18 15-23-1Z" fill="${PAPER}"/>
  <path d="M91 100v51c24 18 94 19 118-1v-50Z" fill="#dce7ed"/>
  <path d="M91 100v14c8 13 14-2 21 1 9 21 18 19 23 0 7-14 15 5 20 8 11 9 14-11 22-12 11-4 17 20 32 0v-11" fill="${PAPER}"/>
  <ellipse cx="150" cy="98" rx="59" ry="14" fill="${PAPER}"/>
  <path d="m144 57 13-1 3 41q-7 5-15 0Z" fill="${RED}"/>
  <path d="m146 65 11 5m-11 7 12 5m-11 6 12 5" stroke="#ecc6b8" stroke-width="2"/>
  <path d="m150 54 1-10"/>
  <path class="candle-flame" d="M151 46c-15-5-8-17 2-26-2 12 14 20-2 26Z" fill="#d3ac6c" stroke="#af8757" stroke-width="1.5"/>
  <path d="m111 133 3-7 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5Zm65 4 3-6 2 7 7 1-6 4 1 7-5-4-6 3 2-7-5-5Z" fill="${BLUE}" stroke-width="1.2"/>
  <path d="m82 191 2 5 6 1-5 4 1 6-5-3-5 2 2-5-4-4 6-1m133-7 2 5 6 1-4 4 1 6-5-3-5 2 1-5-4-4 6-1" stroke="#bdcce1" stroke-width="1.2"/>
  <path d="m45 91 2-9 4 8 10 2-9 4-2 9-4-9-9-2Zm199 29 2-6 3 6 6 2-6 2-2 7-3-6-6-2Z" fill="${BLUE}" stroke="none"/>
`);

const gift = svg(`
  <path d="m56 124 56-7-21-19-4-29 20-14 31 9 20 31 28-34 29-2 15 19-8 28-24 15 41 8 5 127-185 7Z" fill="${PAPER}" stroke="${PAPER}" stroke-width="15"/>
  <path d="m65 144 170-6-3 114-162 6Z" fill="#ede4d2"/>
  <path d="m195 140 40-2-3 114-36 2Z" fill="#ded4c1" stroke="none"/>
  <path d="m63 126 174-5 2 29-178 6Z" fill="${PAPER}"/>
  <path d="m131 154 32-1 4 102-31 1Z" fill="${INK}"/>
  <path d="m130 124 33-1 1 30-32 1Z" fill="${RED}"/>
  <path d="M144 122c-50-7-71-32-50-48 20-16 43 13 50 48Zm11-1c7-47 42-65 55-41 11 21-23 39-55 41Z" fill="${RED}"/>
  <path d="M139 114c-26-5-42-18-36-26 9-9 24 8 36 26Zm23-2c10-22 26-34 34-25 6 10-12 20-34 25Z" fill="#e3b4a8" stroke="#8b4351" stroke-width="1.5"/>
  <path d="m140 126-28 44 20-8 5 12 15-45 24 39 4-14 17 5-35-36" fill="${INK}"/>
  <path d="M141 118q10-9 19 0l1 14q-10 6-20 0Z" fill="${RED}"/>
  <path d="m78 173 2 64m6-63 1 18m89 48 13-1" stroke="#bcaf98" stroke-width="1.3"/>
  <path d="m188 172 25 7-9 33-26-7Z" fill="${PAPER}" stroke-width="1.5"/>
  <circle cx="199" cy="179" r="2" fill="${INK}" stroke="none"/>
  <path d="m199 177-41-45m29 61 12 3m-10-10 11 3" stroke-width="1.2"/>
`);

const cat = svg(`
  <path d="M56 260c-22-21-13-50 10-54 2-16 7-31 17-45l-4-40-12-37 33-1 21-46 20 8 22 36 31-8 17 30 6 55c21 31 28 60 18 91l-44 20-104 2Z" fill="${PAPER}" stroke="${PAPER}" stroke-width="14"/>
  <path d="M97 199c-42-20-62 9-42 37 13 16 34 17 54 7" fill="none" stroke="#707b87" stroke-width="22"/>
  <path d="M97 199c-42-20-62 9-42 37 13 16 34 17 54 7" fill="none" stroke="#aab2b9" stroke-width="13"/>
  <path d="M95 158c-17 26-19 65-6 91 18 16 91 20 118 1 15-31 5-69-12-93Z" fill="#aab2b9"/>
  <path d="M123 170c-12 17-15 48-10 70 16 14 44 16 61 1 6-25 0-53-13-70Z" fill="#e6e7e4" stroke="none"/>
  <path d="m82 126-7-43 37 17c18-9 42-9 60-1l34-24-2 52c16 32-1 63-55 66-49 2-78-28-67-67Z" fill="#adb5bd"/>
  <path d="m84 94 5 26 14-16Zm96 10 16-16-1 29Z" fill="#d5b5b2" stroke="#74818f" stroke-width="1.5"/>
  <path d="m127 108 5 18m11-21 1 19m13-17-3 17m-64 18 16 5m-16 6 16 3m83-18-16 7m18 5-17 5" stroke="#707d8c" stroke-width="4"/>
  <path d="M105 146c6-9 15-9 23-1-7 10-16 10-23 1Zm53-1c7-9 17-10 24-3-4 11-16 13-24 3Z" fill="#c6cfb1" stroke-width="1.8"/>
  <ellipse cx="117" cy="145" rx="2.8" ry="6" fill="${INK}" stroke="none"/><ellipse cx="169" cy="143" rx="2.8" ry="6" fill="${INK}" stroke="none"/>
  <path d="M118 158c-7 5-7 17 1 21 8 5 17 1 24-3 8 6 18 7 25 0 6-6 3-15-6-20" fill="#e8e7e3" stroke="none"/>
  <path d="m136 159 13-1-6 7Z" fill="#ad8d90" stroke-width="1.4"/>
  <path d="M143 165v6m0 0q-6 5-11 1m11-1q6 5 11 0m-28-7-38-4m37 10-36 7m73-15 37-8m-37 15 37 3" stroke-width="1.2"/>
  <path d="m94 201 11 8m-13 8 11 7m88-24-12 9m17 8-13 7" stroke="#7c8998" stroke-width="4"/>
  <path d="M111 219v27c-13-1-22 4-19 11 3 8 34 8 39 0l5-28m29-10 2 28c-10 1-16 7-12 12 5 7 32 6 37-2l-8-34" fill="#b7bfc5"/>
  <path d="m103 251 1 7m8-8 1 8m52-5 1 7m9-8 1 7" stroke-width="1.2"/>
  <path d="m103 97 23-62 47 60q-32 12-70 2Z" fill="${BLUE}"/>
  <path d="m115 67 37-3m-43 20 55-3" stroke="${PAPER}" stroke-width="9"/>
  <path d="m103 97 23-62 47 60q-32 12-70 2Z"/>
  <path d="M119 31c-1-9 11-15 17-7 9 3 4 16-5 16-8 4-15-2-12-9Z" fill="${PAPER}" stroke-width="1.8"/>
`);

const camera = svg(`
  <path d="m40 102 31-6 15-30 47-1 18 24 80-2 26 18 5 126-23 19-186 2-17-22Z" fill="${PAPER}" stroke="${PAPER}" stroke-width="14"/>
  <path d="M66 105c-12-48 10-65 44-54" stroke="#343943" stroke-width="7"/>
  <path d="m44 106 202-3 4 125q-1 12-15 13l-177 4q-14-1-15-13Z" fill="#292e38"/>
  <path d="m44 106 37-5 13-27 35-1 18 25 89-1q13 0 12 12l-1 28-204 4Z" fill="#e0e1df"/>
  <path d="m54 150 29-1-1 77-27 1Z" fill="#404650" stroke="#161e30" stroke-width="1.5"/>
  <path d="m60 156-1 63m7-64-1 63m7-64-1 63" stroke="#616775" stroke-width="1"/>
  <path d="m182 108 45-1 1 20-45 1Z" fill="#fafaf5"/>
  <path d="m188 112 1 11m7-11v10m7-10v10m7-10v10m7-10v10" stroke="#acb9c4" stroke-width="2"/>
  <path d="m98 86 28-1 9 12-45 1Z" fill="#303c50"/>
  <path d="m58 96 18-1v10l-18 1Z" fill="#3d4757"/>
  <circle cx="146" cy="172" r="54" fill="#161f2d" stroke="#89939b" stroke-width="4"/>
  <circle cx="146" cy="172" r="44" fill="#526378" stroke="#111c30" stroke-width="4"/>
  <circle cx="146" cy="172" r="33" fill="#1d2c42" stroke="#9faebd" stroke-width="2"/>
  <circle cx="146" cy="172" r="25" fill="#101f32" stroke="#40556f" stroke-width="3"/>
  <path d="M125 163c3-10 10-16 20-17" stroke="${BLUE}" stroke-width="5"/>
  <path d="M158 191q9-4 12-15" stroke="#6584a5" stroke-width="2"/>
  <circle cx="155" cy="160" r="5" fill="#e5edf0" stroke="none"/>
  <path d="m109 133 5 4m-13 6 6 3m-10 8 6 1m3 46 5-3m76-40 6-2m-9-9 5-3m-12-8 4-4" stroke="#b2bbc4" stroke-width="1.5"/>
  <circle cx="220" cy="154" r="5" fill="${BLUE}" stroke-width="1.5"/>
  <path d="m208 220 24-1m-24 5 14-1m-153 10 23-1" stroke="#929ca8" stroke-width="1.2"/>
`);

const headphones = svg(`
  <path d="M52 229C17 94 66 40 145 36c91-7 140 58 108 186l-21 29-44-10-12-56 23-28c6-48-15-69-50-69-38 1-59 26-48 72l24 25-10 61-42 10Z" fill="${PAPER}" stroke="${PAPER}" stroke-width="13"/>
  <path d="M62 178C24 13 271 5 238 176" stroke="${INK}" stroke-width="26"/>
  <path d="M62 168C38 28 259 19 239 165" stroke="${BLUE}" stroke-width="17"/>
  <path d="M72 111c20-65 120-77 154-6" stroke="${PAPER}" stroke-width="4"/>
  <path d="m62 142 6 45m169-47-5 45" stroke="#899fb8" stroke-width="9"/>
  <path d="M52 170q16-12 30 3l19 60q-9 20-28 15l-18-26Z" fill="${BLUE}"/>
  <path d="M80 169c13-6 24-4 28 9l16 51c4 15-7 24-21 24-9 0-12-7-15-15l-15-48c-3-11-3-17 7-21Z" fill="${INK}"/>
  <path d="M85 181q10-8 14 4l16 47q3 12-8 11Z" fill="#e3edf2" stroke="#829ab6" stroke-width="1.5"/>
  <path d="M245 169q-16-12-30 3l-17 61q10 20 29 14l16-26Z" fill="${BLUE}"/>
  <path d="M216 168c-13-5-24-3-28 10l-14 51c-4 15 7 24 21 23 9 0 12-7 15-15l13-48c3-11 3-17-7-21Z" fill="${INK}"/>
  <path d="M211 180q-10-7-14 5l-14 47q-3 12 8 10Z" fill="#e3edf2" stroke="#829ab6" stroke-width="1.5"/>
  <path d="m60 184 7 24m174-25-5 25" stroke="${PAPER}" stroke-width="4"/>
  <path d="M205 251c0 33-54 34-65 14-9-15 10-26 19-16 12 15-12 32-34 20" stroke="${INK}" stroke-width="3"/>
`);

const star = svg(`
  <path d="m148 40 27 72 79 5-60 53 18 81-68-43-65 41 18-79-56-54 78-5Z" fill="${PAPER}" stroke="${PAPER}" stroke-width="15"/>
  <path d="m148 40 27 72 79 5-60 53 18 81-68-43-65 41 18-79-56-54 78-5Z" fill="${BLUE}" stroke-width="3"/>
  <path d="m148 68 18 56 59 3-44 36 12 59-49-29-45 29 12-57-40-38 57-3Z" stroke="${PAPER}" stroke-width="2"/>
  <path d="m56 53 15 16m164-12-11 17M38 193l20-4m190 18-16-11m-88 64-1 15" stroke-width="2"/>
`);

const hearts = svg(`
  <path d="M112 93c-55-66-138 8 9 111C251 91 157 29 112 93Z" fill="${PAPER}" stroke="${PAPER}" stroke-width="16"/>
  <path d="M112 93c-55-66-138 8 9 111C251 91 157 29 112 93Z" fill="${BLUE}" stroke-width="3.5"/>
  <path d="M74 91c-21-5-29 15-13 35m5 9 7 7" stroke="${PAPER}" stroke-width="4"/>
  <path d="M210 171c-26-33-66 6 2 59 72-57 21-94-2-59Z" fill="${PAPER}" stroke="${PAPER}" stroke-width="13"/>
  <path d="M210 171c-26-33-66 6 2 59 72-57 21-94-2-59Z" fill="${PAPER}" stroke-width="3"/>
  <path d="M210 182c-18-21-39 1 2 34 44-37 15-59-2-34Z" stroke="#7095bd" stroke-width="1.8"/>
  <path d="m203 73 8-16m9 28 17-6M52 181l-12 9m27 4-6 15" stroke-width="2"/>
`);

const pin = svg(`
  <path d="m101 59 59-20 25 26-4 38 34 51-10 22-35 9-34 75-20 9 13-95-37-21 1-23 27-32Z" fill="${PAPER}" stroke="${PAPER}" stroke-width="12"/>
  <path d="m141 164-20 96 12-10 31-82" fill="#a8b4be" stroke-width="2"/>
  <path d="m144 182-19 65" stroke="${PAPER}" stroke-width="2"/>
  <path d="m120 88 48-15 2 38 30 35-62 25-29-35 24-33Z" fill="${RED}"/>
  <path d="m151 101 4 25 26 25" stroke="#e0a6a0" stroke-width="4"/>
  <ellipse cx="146" cy="72" rx="38" ry="19" transform="rotate(-18 146 72)" fill="#ce7170"/>
  <path d="M116 72q24-21 52-12" stroke="#efc7bb" stroke-width="3"/>
  <ellipse cx="153" cy="153" rx="53" ry="19" transform="rotate(-18 153 153)" fill="${RED}"/>
  <path d="M106 153q16-13 34-16m36-8 16 4" stroke="#e2a29a" stroke-width="2"/>
`);

const tape = svg(`
  <path d="m31 97 236-21-6 12 9 10-8 12 9 10-7 13 8 12-239 23 7-13-10-11 9-12-10-11 10-12Z" fill="${PAPER}" stroke="${PAPER}" stroke-width="8"/>
  <path d="m31 97 236-21-6 12 9 10-8 12 9 10-7 13 8 12-239 23 7-13-10-11 9-12-10-11 10-12Z" fill="${BLUE}" fill-opacity=".6" stroke="#819cb6" stroke-width="1"/>
  <path d="m54 97 6 65m15-67 6 65m15-67 6 65m15-67 6 65m15-67 6 65m15-67 6 65m15-67 6 65m15-67 6 65m15-67 6 65m15-67 6 65" stroke="${PAPER}" stroke-width="8" opacity=".55"/>
  <path d="m46 109 204-19M45 151l210-19" stroke="${PAPER}" stroke-width="1.5" opacity=".65"/>
`, '0 0 300 210');

/** Illustrated placeholders, deliberately not simulated personal photographs. */
function landscape(index = 0) {
  const n = ((Math.trunc(Number(index)) || 0) % 3 + 3) % 3;
  const scenes = [
    `<circle cx="292" cy="63" r="27" fill="#e7dcc1" stroke="none"/>
     <path d="M0 178 88 81l64 71 56-61 111 104 81-51v116H0Z" fill="#a8c8e6" stroke="none"/>
     <path d="m63 108 25-27 31 34-23-9-9 10-8-13-16 5m123 7 22-24 26 24-21-8-10 11Z" fill="${PAPER}" stroke="none"/>
     <path d="M0 208q107-46 205 0t195-14v66H0Z" fill="#718ba5" stroke="none"/>
     <path d="M0 238q84-28 170 0t230-6" stroke="#d7e4e8" stroke-width="2"/>
     <path d="m303 194 10-49 10 49m-17-14h14m25 22 9-39 9 39" stroke-width="2"/>`,
    `<circle cx="88" cy="70" r="25" fill="#e7dcc1" stroke="none"/>
     <path d="M0 166q81-83 174 0t226-18v112H0Z" fill="#bccfd2" stroke="none"/>
     <path d="M0 207q97-87 213-11t187-2v66H0Z" fill="#78929f" stroke="none"/>
     <path d="M213 260c-46-43-46-69-5-81-66 7-79 40-46 81" fill="#eae5d8" stroke="none"/>
     <path d="m54 203 2-73m-23 38q22-42 47 0-22 20-47 0Zm250 20 2-62m-23 29q20-36 43 0-19 19-43 0Z" fill="#a5b9b3" stroke-width="1.5"/>
     <path d="m332 214 3-14m-7 4 7 6 7-7m-235 21 3-13m-8 4 8 5 6-8" stroke-width="1.5"/>`,
    `<path d="M0 143h400v117H0Z" fill="#bed4e3" stroke="none"/>
     <circle cx="279" cy="68" r="28" fill="#e5d9bd" stroke="none"/>
     <path d="M0 223q94-39 166 2t234-7v42H0Z" fill="#e5deca" stroke="none"/>
     <path d="m32 166 81-1m29 12 62-1m49-17h62m-98 37h70m-235 5h58" stroke="${PAPER}" stroke-width="2"/>
     <path d="m132 151 20-10 23 10-12 8h-22Z" fill="${INK}" stroke-width="1.5"/>
     <path d="m153 96-1 47m-5-40-25 33h25Zm10 6 21 26h-21Z" fill="${PAPER}" stroke-width="1.5"/>
     <path d="m54 80q7-8 14 0 7-8 14 0m125 21q6-7 12 0 6-7 12 0" stroke-width="1.5"/>
     <path d="m311 239 12-5 10 6m-293 4 8-3 10 3" stroke="#aaac9e" stroke-width="1.5"/>`
  ];
  return svg(`<path d="M0 0h400v260H0Z" fill="${PAPER}" stroke="none"/>
    <path d="M0 0h400v143H0Z" fill="#e8eef0" stroke="none"/>
    <path d="M30 47q14-10 27 0m-13-5q6-17 19-6 14-4 18 8m244 62q14-10 29 0" stroke="${PAPER}" stroke-width="6"/>
    ${scenes[n]}
    <path d="M10 12h380v236H10Z" stroke="${PAPER}" stroke-width="3" opacity=".8"/>`, '0 0 400 260');
}

const stickers = Object.freeze({ couple, bouquet, cake, gift, cat, camera, headphones, star, hearts, pin, tape });
const aliases = Object.freeze({ embrace: 'couple', roses: 'bouquet', rose: 'bouquet', giftbox: 'gift', 'gift-box': 'gift', 'party-cat': 'cat', heart: 'hearts', pushpin: 'pin', 'doodle-star': 'star' });
/** Unknown names return an empty string; arbitrary input is never interpolated. */
function sticker(name) {
  const key = typeof name === 'string' ? name.toLowerCase() : '';
  if (key === 'landscape' || key === 'placeholder') return landscape();
  const canonical = Object.prototype.hasOwnProperty.call(aliases, key) ? aliases[key] : key;
  return Object.prototype.hasOwnProperty.call(stickers, canonical) ? stickers[canonical] : '';
}
module.exports = { sticker, stickers, couple, bouquet, cake, gift, cat, camera, headphones, star, hearts, pin, pushpin: pin, tape, landscape };
