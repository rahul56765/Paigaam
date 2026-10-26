'use strict';
const config = require('./config');
const schema = require('./schema');
const { resolve } = require('../../lib/bfday/fields');
const { escape: esc, multiline, head, previewBadge } = require('../../lib/bfday/page');
const { bgmParse } = require('../../lib/bfday/bgm');
const ART = '/lotus-vivah/';
const TYPES = { wedding:'Wedding Ceremony', haldi:'Haldi', mehndi:'Mehndi', sangeet:'Sangeet', reception:'Reception' };
const botanical = require('./botanical-outlines.json');
function img(name, cls) {
  const a = botanical[name];
  return `<span class="lv-botanical ${cls}" aria-hidden="true"><svg class="lv-flower-surface" viewBox="0 0 ${a.width} ${a.height}" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><image href="${ART}${name}.webp" width="${a.width}" height="${a.height}"/><path class="lv-petal-halo" d="${a.outline}"/><path class="lv-petal-glint" d="${a.outline}" pathLength="1000"/></svg></span>`;
}
const COVER_PETALS = {
  left: 'M260 390C245 335 280 324 322 338C360 366 374 370 397 380C468 410 503 467 528 513L400 548C330 518 283 458 260 390Z',
  right: 'M521 480C499 423 547 349 588 311C626 278 674 248 721 230C725 337 737 401 691 465C650 472 630 491 591 490Z',
  front: 'M400 530C445 500 520 500 590 490C633 458 675 458 690 480C703 550 644 634 570 640C483 644 405 622 400 550Z',
};
function coverLotus(side) {
  const id = 'lv-cover-' + side;
  const a = botanical['cover-lotus'];
  const image = `<image href="${ART}cover-lotus.webp" width="1000" height="747"/>`;
  const defs = `<defs><mask id="${id}-outer" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="747"><rect width="1000" height="747" fill="white"/>${Object.values(COVER_PETALS).map(d=>`<path d="${d}" fill="black"/>`).join('')}</mask>${Object.entries(COVER_PETALS).map(([k,d])=>`<clipPath id="${id}-${k}"><path d="${d}"/></clipPath>`).join('')}</defs>`;
  return `<div class="lv-cover-bloom lv-cover-bloom--${side}"><svg viewBox="0 0 1000 747" class="lv-cover-flower" aria-hidden="true">${defs}<g class="lv-cover-layer lv-cover-layer--outer" mask="url(#${id}-outer)">${image}<path class="lv-petal-halo" d="${a.outline}"/><path class="lv-petal-glint" d="${a.outline}" pathLength="1000"/></g>${Object.entries(COVER_PETALS).map(([k,d])=>`<g class="lv-cover-layer lv-cover-layer--${k}" clip-path="url(#${id}-${k})">${image}<path class="lv-petal-halo lv-petal-seam" d="${d}"/><path class="lv-petal-glint" d="${d}" pathLength="1000"/></g>`).join('')}</svg></div>`;
}
function panelEdges(tag, attrs) { return `<${tag} class="lv-panel-edge" ${attrs}/><${tag} class="lv-panel-glint" ${attrs} pathLength="1000"/>`; }
function rectEdges(cls, radius = 0) { return `<svg class="lv-panel-outline ${cls}" viewBox="0 0 360 640" preserveAspectRatio="none" aria-hidden="true">${panelEdges('rect',`x="1.5" y="1.5" width="357" height="637" rx="${radius}"`)}</svg>`; }
function dateParts(value) {
  const d = new Date(value + 'T12:00:00Z');
  if (Number.isNaN(+d)) return { month:'', day:'', year:'', weekday:'' };
  return { month: d.toLocaleDateString('en-GB',{month:'long',timeZone:'UTC'}),day:d.getUTCDate(),year:d.getUTCFullYear(),weekday:d.toLocaleDateString('en-GB',{weekday:'long',timeZone:'UTC'}) };
}
function divider() { return '<div class="lv-divider lv-line" aria-hidden="true"><i></i><b></b><i></i></div>'; }
function dateBlock(value,time,d) {
  const p=dateParts(value);
  return `<div class="lv-date lv-reveal"><p class="lv-month">${esc(p.month)}</p><div class="lv-date-row"><span>${esc(p.weekday)}</span><strong>${esc(p.day)}</strong><span>${time ? esc(d.atLabel)+' '+esc(time) : ''}</span></div><p class="lv-year">${esc(p.year)}</p></div>`;
}
function names(d, stacked=false) { return `<p class="lv-names lv-reveal${stacked?' lv-names--stacked':''}"><span>${esc(d.brideName)}</span><i>${esc(d.coupleJoiner)}</i><span>${esc(d.groomName)}</span></p>`; }
function openPage(kind,label,index,color='') { return `<section class="lv-page lv-page--${kind}${index===0?' is-current':''}" data-lv-page data-kind="${kind}" aria-label="${esc(label)}" aria-hidden="${index===0?'false':'true'}"${index?' inert':''}${color?` style="--lv-panel:${esc(color)}"`:''}><div class="lv-paper"></div>`; }
function panel(kind) {
  if(kind==='wedding') return `<svg class="lv-shape lv-shape--wedding" viewBox="0 0 360 640" preserveAspectRatio="none" aria-hidden="true"><path class="lv-panel-fill" d="M180 6 C170 22 155 29 141 33 Q127 14 114 38 Q93 20 86 47 Q61 32 58 62 Q33 52 34 81 Q11 78 21 108 Q-1 114 14 138 L14 508 Q-1 529 22 538 Q12 565 38 566 Q36 592 62 585 Q69 611 94 599 Q111 623 136 610 C150 620 165 628 180 638 C195 628 210 620 224 610 Q249 623 266 599 Q291 611 298 585 Q324 592 322 566 Q348 565 338 538 Q361 529 346 508 L346 138 Q361 114 339 108 Q349 78 326 81 Q327 52 302 62 Q299 32 274 47 Q267 20 246 38 Q233 14 219 33 C205 29 190 22 180 6Z"/>${panelEdges('path','d="M180 6 C170 22 155 29 141 33 Q127 14 114 38 Q93 20 86 47 Q61 32 58 62 Q33 52 34 81 Q11 78 21 108 Q-1 114 14 138 L14 508 Q-1 529 22 538 Q12 565 38 566 Q36 592 62 585 Q69 611 94 599 Q111 623 136 610 C150 620 165 628 180 638 C195 628 210 620 224 610 Q249 623 266 599 Q291 611 298 585 Q324 592 322 566 Q348 565 338 538 Q361 529 346 508 L346 138 Q361 114 339 108 Q349 78 326 81 Q327 52 302 62 Q299 32 274 47 Q267 20 246 38 Q233 14 219 33 C205 29 190 22 180 6Z"')}</svg>`;
  if(kind==='haldi') return `<svg class="lv-shape lv-shape--haldi" viewBox="0 0 360 640" preserveAspectRatio="none" aria-hidden="true"><path class="lv-panel-fill" d="M0 640V123Q-1 100 18 99Q8 77 34 74Q29 52 56 53Q56 30 84 35Q94 12 119 23Q141 4 161 14L180 0L199 14Q219 4 241 23Q266 12 276 35Q304 30 304 53Q331 52 326 74Q352 77 342 99Q361 100 360 123V640Z"/>${panelEdges('path','d="M0 640V123Q-1 100 18 99Q8 77 34 74Q29 52 56 53Q56 30 84 35Q94 12 119 23Q141 4 161 14L180 0L199 14Q219 4 241 23Q266 12 276 35Q304 30 304 53Q331 52 326 74Q352 77 342 99Q361 100 360 123V640Z"')}</svg>`;
  if(kind==='mehndi') return `<svg class="lv-shape lv-shape--mehndi" viewBox="0 0 360 640" preserveAspectRatio="none" aria-hidden="true"><path class="lv-panel-fill" d="M0 0H360V532Q362 550 343 551Q354 572 331 576Q340 600 316 601Q319 623 295 620Q290 639 268 625Q246 643 225 627Q202 645 180 629Q158 645 135 627Q114 643 92 625Q70 639 65 620Q41 623 44 601Q20 600 29 576Q6 572 17 551Q-2 550 0 532Z"/>${panelEdges('path','d="M0 0H360V532Q362 550 343 551Q354 572 331 576Q340 600 316 601Q319 623 295 620Q290 639 268 625Q246 643 225 627Q202 645 180 629Q158 645 135 627Q114 643 92 625Q70 639 65 620Q41 623 44 601Q20 600 29 576Q6 572 17 551Q-2 550 0 532Z"')}</svg>`;
  return `<div class="lv-shape lv-shape--white lv-panel-fill"></div>${rectEdges('lv-outline--white',12)}`;
}
function eventArt(kind) {
  if(kind==='wedding') return img('stems','lv-wedding-right')+img('garden','lv-wedding-left')+img('blossom','lv-wedding-bottom');
  if(kind==='haldi') return img('garden','lv-haldi-left')+img('blossom','lv-haldi-top')+img('blossom','lv-haldi-bottom');
  if(kind==='mehndi') return img('garden','lv-mehndi-left')+img('blossom','lv-mehndi-bottom');
  return img('stems','lv-party-left')+img('blossom','lv-party-bottom');
}
function eventPage(e,index,d) {
  const kind=e.kind; const heading=e.heading||TYPES[kind];
  return openPage(kind,heading,index,e.panelColor)+panel(kind)+`<div class="lv-copy lv-copy--${kind}" data-lv-fit><div class="lv-copy-inner"><p class="lv-lead lv-reveal">${esc(e.lead)}</p><h2 class="lv-heading lv-reveal">${esc(heading)}</h2>${e.hostLine?`<p class="lv-host lv-reveal">${esc(e.hostLine)}</p>`:''}${kind==='wedding'?names(d):''}${divider()}${dateBlock(e.date,e.time,d)}${e.address?`<p class="lv-address lv-reveal"><em>${esc(d.addressLead)}</em>${multiline(e.address)}</p>`:''}</div></div>`+eventArt(kind)+'</section>';
}
function photo(d) {
  if(!d.couplePhoto)return '';
  return `<div class="lv-photo" style="--crop-zoom:${d.photoZoom/100};--crop-x:${d.photoX}%;--crop-y:${d.photoY}%"><img src="${esc(d.couplePhoto)}" alt="The couple"></div>`;
}
function render(paigaam={}, opts={}) {
  const d=resolve(config,paigaam.customer_data,schema);
  if(paigaam.customer_data && Array.isArray(paigaam.customer_data.events) && !paigaam.customer_data.events.length) d.events=[];
  const couple=`${d.brideName} ${d.coupleJoiner} ${d.groomName}`;
  const mark = d.monogramLogo ? `<div class="lv-save-mark${d.couplePhoto?' with-photo':''}"><span class="lv-logo" style="--crop-zoom:${d.logoZoom/100};--crop-x:${d.logoX}%;--crop-y:${d.logoY}%"><img src="${esc(d.monogramLogo)}" alt="Couple monogram"></span></div>` : (d.sealText ? `<div class="lv-save-mark${d.couplePhoto?' with-photo':''}"><span class="lv-initials">${esc(d.sealText)}</span></div>` : '');
  const pages=[];
  pages.push(openPage('cover','Lotus seal — tap to open',0)+`<div class="lv-cover-glow" aria-hidden="true"></div><div class="lv-cover-petals" aria-hidden="true">${coverLotus('top')}${coverLotus('bottom')}</div><button type="button" class="lv-seal" data-lv-open aria-label="${esc(d.coverHint||'Open invitation')}"><span class="lv-seal-shine" aria-hidden="true"></span></button><p class="lv-cover-hint">${esc(d.coverHint)}</p></section>`);
  pages.push(openPage('save',d.saveHeading,1)+`<div class="lv-save-strip"></div>${rectEdges('lv-outline--save')}${photo(d)}${mark}<div class="lv-copy lv-copy--save${d.couplePhoto?' has-photo':''}${!d.couplePhoto&&mark?' has-mark':''}" data-lv-fit><div class="lv-copy-inner"><h2 class="lv-heading lv-reveal">${esc(d.saveHeading)}</h2>${divider()}${dateBlock(d.saveDate,d.saveTime,d)}${divider()}${names(d,true)}</div></div>${img('garden','lv-save-upper')}${img('garden','lv-save-garden')}${img('stems','lv-save-stems')}${img('blossom','lv-save-bottom')}</section>`);
  d.events.filter(e=>e.visible!=='no'&&TYPES[e.kind]).forEach(e=>pages.push(eventPage(e,pages.length,d)));
  pages.push(openPage('thanks',d.thanksHeading,pages.length)+`<div class="lv-thanks-panel"></div>${rectEdges('lv-outline--thanks')}<div class="lv-copy lv-copy--thanks" data-lv-fit><div class="lv-copy-inner"><h2 class="lv-heading lv-reveal">${esc(d.thanksHeading)}</h2>${divider()}<p class="lv-message lv-reveal">${multiline(d.thanksMessage)}</p>${divider()}${names(d)}</div></div>${img('stems','lv-thanks-right')}${img('garden','lv-thanks-left')}${img('blossom','lv-thanks-bottom')}<div class="lv-ribbon" aria-hidden="true"></div></section>`);
  const yt=!d.musicUpload && bgmParse(d.musicLink);
  const audio=d.musicUpload || (!yt?d.musicLink:'');
  return `<!DOCTYPE html><html lang="en" class="lv-html"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${head({paigaam,opts,title:couple+' · Lotus Vivah',description:'A lotus invitation to celebrate '+couple,themeColor:d.pinkColor,image:config.ogImage})}<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Pinyon+Script&display=swap" rel="stylesheet"><link rel="stylesheet" href="/lotus-vivah/lotus.css?v=2"><script src="/lotus-vivah/lotus.js?v=2" defer></script></head><body class="lv-body" data-preview="${!!opts.isPreview}" style="--lv-pink:${d.pinkColor};--lv-yellow:${d.yellowColor};--lv-green:${d.greenColor};--lv-white:${d.paperColor}"><main class="lv-app" id="lvApp"><div class="lv-stage" id="lvStage"><div class="lv-card" id="lvCard">${pages.join('')}<div class="lv-petals" aria-hidden="true">${[0,1,2,3,4].map(i=>`<i style="--i:${i}"></i>`).join('')}</div><div class="lv-shine" aria-hidden="true"></div></div></div><nav class="lv-controls" aria-label="Invitation pages"><button type="button" data-lv-prev aria-label="Previous page" disabled>‹</button><div class="lv-navigation"><p class="lv-counter" aria-live="polite"><span data-lv-current>1</span> / ${pages.length}</p><div class="lv-dots">${pages.map((_,i)=>`<button type="button" data-lv-go="${i}" aria-label="Go to page ${i+1}"${i===0?' aria-current="page"':''}></button>`).join('')}</div></div><button type="button" data-lv-next aria-label="Next page">›</button></nav>${audio||yt?`<div class="lv-music" data-lv-music${yt?` data-youtube="${yt}"`:''}><button type="button" data-lv-music-toggle aria-label="Play music" aria-pressed="false">♪</button><span class="lv-music-status" role="status"></span>${audio?`<audio id="lvAudio" src="${esc(audio)}" preload="none" loop></audio>`:'<span data-lv-player></span>'}</div>`:''}<button class="lv-motion" type="button" data-lv-motion aria-label="Enable phone tilt" hidden>Enable tilt</button></main>${previewBadge(opts)}<noscript><style>.lv-html,.lv-body{height:auto;overflow:auto}.lv-app{height:auto;overflow:visible}.lv-stage{position:static;height:auto;display:block}.lv-card{position:static;width:min(100%,450px);height:auto;transform:none;margin:auto}.lv-page{position:relative;display:block!important;opacity:1!important;visibility:visible!important;transform:none!important;aspect-ratio:9/16;inset:auto}.lv-copy,.lv-reveal{opacity:1!important;transform:none!important;animation:none!important}.lv-controls,.lv-petals,.lv-shine,.lv-seal,.lv-music{display:none!important}</style><p>JavaScript is off. Scroll to read every card.</p></noscript></body></html>`;
}
module.exports={render,dateParts,TYPES};
