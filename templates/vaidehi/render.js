'use strict';
const config = require('./config');
const schema = require('./schema');
const { resolve } = require('../../lib/bfday/fields');
const { escape: esc, multiline, head, previewBadge } = require('../../lib/bfday/page');
const { qrSVG } = require('../../lib/qrcode');
const A = '/vaidehi/';
function dateParts(value) {
  if (!value) return { day:'', month:'', year:'', weekday:'', full:'' };
  const d = new Date(value + 'T12:00:00Z');
  if (!Number.isFinite(+d)) return { day:'', month:'', year:'', weekday:'', full:'' };
  const fmt = options => d.toLocaleDateString('en-GB', { ...options, timeZone:'UTC' });
  return { day:d.getUTCDate(), month:fmt({month:'short'}), year:d.getUTCFullYear(), weekday:fmt({weekday:'long'}), full:fmt({day:'numeric',month:'long',year:'numeric'}) };
}
function displayTime(value) {
  const m = schema.timeMinutes(value); if (m === null) return '';
  return `${Math.floor(m/60)%12 || 12}:${String(m%60).padStart(2,'0')} ${m>=720?'PM':'AM'}`;
}
function directions(name, address, explicit) {
  return (explicit ? new URL(explicit).href : '') || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([name,address].filter(Boolean).join(', ').toWellFormed());
}
function view(data) {
  const d = resolve(config, data, schema);
  for (const key of ['events','gallery']) if (data && Array.isArray(data[key]) && !data[key].length) d[key] = [];
  const map = directions(d.venueName,d.venueAddress,d.mapsUrl);
  return { ...d, map, qr:d.qrDestination ? new URL(d.qrDestination).href : map,
    date:dateParts(d.weddingDate), day:d.weddingDay || dateParts(d.weddingDate).weekday,
    countdownDateText:dateParts(d.countdownDate || d.weddingDate).full, countdownTimeText:displayTime(d.countdownTime || d.weddingTime),
    target:schema.timestamp(d.countdownDate || d.weddingDate, d.countdownTime || d.weddingTime, d.utcOffset),
    events:d.events.map(e => ({...e, date:schema.eventDate(d.weddingDate,e), time:e.time || d.weddingTime,
      venueName:e.venueName || d.venueName, venueAddress:e.venueAddress || d.venueAddress,
      map:directions(e.venueName || d.venueName,e.venueAddress || d.venueAddress,e.mapsUrl || ((!e.venueName && !e.venueAddress) ? d.mapsUrl : ''))
    })) };
}
const ornament = '<span class="vv-floret" aria-hidden="true">❧</span>';
function leaves() { return `<img class="vv-leaves vv-leaves--left" src="${A}leaves.webp" alt="" width="500" height="650"><img class="vv-leaves vv-leaves--right" src="${A}leaves.webp" alt="" width="500" height="650">`; }
// All ornaments are separate, text-free assets extracted from the supplied
// cover reference. The names, announcement and date remain real HTML below.
function coverLeaves() {
  return `<img class="vv-cover-leaf vv-cover-leaf--left" src="${A}cover-leaves-left.webp" alt="" width="315" height="384"><img class="vv-cover-leaf vv-cover-leaf--right" src="${A}cover-leaves-right.webp" alt="" width="304" height="399">`;
}
function coverRoses() {
  const points=[[20,71,-18,1],[81,70,29,2],[16,84,18,3],[84,86,-26,1],[22,96,43,2],[77,101,-13,3],[12,111,20,1],[87,119,-32,2],[19,125,-8,3]];
  return `<div class="vv-cover-roses" aria-hidden="true">${points.map(([x,y,r,n])=>`<img src="${A}cover-rose-${n}.webp" alt="" width="37" height="39" style="--rose-x:${x}%;--rose-y:${y}cqw;--rose-turn:${r}deg">`).join('')}</div>`;
}
function fallingPetals() {
  const petals=[[1,22,-4,-5,3.2,7,30],[3,27,-18,7,3.8,8,-20],[5,25,-8,-8,3,7,80],[2,31,-25,5,4,8,15],[4,24,-14,-6,3.5,9,115],[95,28,-21,7,3,7,-35],[97,23,-11,-6,3.7,8,45],[99,32,-27,-8,3.1,7,120],[96,26,-3,6,4,9,10],[98,30,-17,-5,3.3,8,-70]];
  return `<div class="vv-petal-layer" aria-hidden="true" inert>${petals.map(([x,t,delay,drift,w,h,r])=>`<span class="vv-petal-fall" style="--petal-x:${x}%;--petal-time:${t}s;--petal-delay:${delay}s;--petal-drift:${drift}px;--petal-width:${w}px;--petal-height:${h}px;--petal-turn:${r}deg"><i></i></span>`).join('')}</div>`;
}
function section(id,label,extra='') { return `<section id="vv-${id}" class="vv-section vv-${id} ${extra}" data-vv-section aria-label="${esc(label)}" tabindex="-1">`; }
function dateBlock(d) { return `<div class="vv-date-line"><span>${esc(d.date.month)}</span><i></i><strong>${esc(d.date.day)}</strong><i></i><span>${esc(d.date.year)}</span></div>`; }
function namePair(d,cls='') { return `<div class="vv-names ${cls}"><span>${esc(d.groomName)}</span><em>and</em><span>${esc(d.brideName)}</span></div>`; }
function mapLink(map,label='Open location') { return `<a class="vv-map-link" href="${esc(map)}" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-7.5 7-13A7 7 0 0 0 5 8c0 5.5 7 13 7 13Z"/><circle cx="12" cy="8" r="2.5"/></svg>${esc(label)}</a>`; }
function eventCard(e,index) {
  return `<li class="vv-event vv-reveal" style="--vv-event:${index}"><span class="vv-event-node" aria-hidden="true"></span><article><details><summary><span class="vv-event-time">${esc(displayTime(e.time))}</span><h3>${esc(e.name)}</h3><time datetime="${esc(e.date)}">${esc(dateParts(e.date).full)}</time><span class="vv-event-more">Venue details <span aria-hidden="true">+</span></span></summary><div class="vv-event-expanded"><p class="vv-event-venue">${esc(e.venueName)}</p><p class="vv-event-address">${multiline(e.venueAddress)}</p><a href="${esc(e.map)}" target="_blank" rel="noopener noreferrer" aria-label="${esc('Directions for '+e.name)}">Directions ↗</a></div></details></article></li>`;
}
function qrWidth(value) {
  try { const { size } = require('../../lib/qrcode').makeQR(value); return Math.min(94,Math.max(24,(size+8)*100/160)); }
  catch { return 60; }
}
function qrMarkup(value) {
  try { return qrSVG(value,{dark:'#424b3a',light:'#ffffff',module:3,margin:4}); }
  catch { return '<span class="vv-qr-error">Use a shorter destination link to generate a QR code.</span>'; }
}
function render(paigaam={}, opts={}) {
  const d=view(paigaam.customer_data);
  let photos=[...d.gallery];
  if (d.couplePhoto && !photos.some(p=>p.photo===d.couplePhoto)) photos.unshift({photo:d.couplePhoto,caption:'Together, forever'});
  const title=[d.groomName,d.brideName].filter(Boolean).join(' & ') || 'Your wedding invitation';
  const links=[['cover','Invitation'],['details','Wedding details'],['moments','Our moments'],['welcome','Friends and family'],['blessings','Blessings and venue'],['schedule','Wedding schedule'],['countdown','Countdown']];
  return `<!DOCTYPE html><html lang="en" class="vv-html"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${head({paigaam,opts,title:title+' · Vaidehi',description:[d.date.full,d.venueName].filter(Boolean).join(' · ') || config.description,themeColor:'#f8f5e9',image:d.couplePhoto || (d.gallery[0] && d.gallery[0].photo) || config.ogImage})}
<link rel="preload" as="font" type="font/ttf" crossorigin href="${A}fonts/cormorant.ttf"><link rel="preload" as="font" type="font/ttf" crossorigin href="${A}fonts/great-vibes.ttf"><link rel="preload" as="image" href="${A}cover-attire.webp">
<link rel="stylesheet" href="${A}invite.css?v=2"><script defer src="${A}invite.js?v=2"></script></head>
<body class="vv-body" data-preview="${!!opts.isPreview}"><a class="vv-skip" href="#vv-cover">Skip to invitation</a>
<div class="vv-gate" id="vv-gate" hidden><span class="vv-gate-ornament" aria-hidden="true">❧</span><p class="vv-brand-word">PAIGAAM</p><p class="vv-gate-tagline">a beautiful beginning</p><button id="vv-open" type="button"><span>Open invitation</span><small>${esc(title)}</small><span class="vv-open-arrow" aria-hidden="true">↓</span></button></div>
<main class="vv-invitation" id="vv-invitation">
${section('cover','Wedding invitation')}<img class="vv-couple-art vv-cover-attire" src="${A}cover-attire.webp" alt="Waist-down watercolor of a bride in red and a groom in cream, joined by tied red wedding fabric" width="1056" height="690" fetchpriority="high"><img class="vv-garland vv-garland--left" src="${A}cover-garland-left.webp" alt="" width="184" height="1100"><img class="vv-garland vv-garland--right" src="${A}cover-garland-right.webp" alt="" width="184" height="1100">${coverRoses()}<div class="vv-cover-copy vv-reveal"><p class="vv-script">Save the Date</p><h1 class="vv-sr">${esc(title)}</h1>${namePair(d)}<p class="vv-announcement">are getting married</p>${dateBlock(d)}<p class="vv-weekday">${esc(d.day)}</p></div>${coverLeaves()}<a class="vv-scroll-cue" href="#vv-details" aria-label="Wedding details">⌄</a></section>
${section('details','Date, time and venue')}<div class="vv-details-copy vv-reveal"><p class="vv-script">Together with our families</p>${ornament}<p class="vv-full-date">${esc(d.date.full)}</p><p class="vv-weekday">${esc(d.day)}</p><p class="vv-detail-time">${esc(displayTime(d.weddingTime))}</p><h2>${esc(d.venueName)}</h2><p class="vv-address">${multiline(d.venueAddress)}</p>${mapLink(d.map)}</div>${leaves()}</section>
${section('moments','Our Moments')}<div class="vv-moments-sticky"><header class="vv-section-heading"><p class="vv-script">Captured in Love</p>${ornament}<h2>Our Moments</h2></header>${photos.length?`<div class="vv-photo-stack" id="vv-photo-stack" aria-roledescription="carousel" aria-label="Couple photographs"><div class="vv-photo-back vv-photo-back--one" aria-hidden="true"></div><div class="vv-photo-back vv-photo-back--two" aria-hidden="true"></div>${photos.map((p,i)=>`<button class="vv-polaroid${i===0?' is-active':''}" data-vv-photo="${i}" type="button" aria-label="${esc('Enlarge photograph '+(i+1)+(p.caption?': '+p.caption:''))}"><img src="${esc(p.photo)}" alt="${esc(p.caption || 'Couple photograph '+(i+1))}" width="800" height="800" loading="lazy"><span>${esc(p.caption)}</span></button>`).join('')}</div><div class="vv-gallery-controls"><button type="button" data-vv-photo-prev aria-label="Previous photograph">‹</button><span data-vv-photo-counter aria-live="polite">1 / ${photos.length}</span><button type="button" data-vv-photo-next aria-label="Next photograph">›</button></div><p class="vv-gallery-hint">scroll to discover · tap to view</p>`:`<div class="vv-empty-gallery">${ornament}<p>Our story is just beginning.</p></div>`}</div></section>
${section('welcome','Dear Friends and Family')}<img class="vv-temple-art" src="${A}temple.webp" alt="" width="1100" height="1640" loading="lazy"><div class="vv-welcome-copy vv-reveal"><p class="vv-script">Welcome</p><h2>Dear Friends<br>&amp; Family,</h2><p>${multiline(d.invitationMessage)}</p></div></section>
${section('blessings','Family blessings and wedding venue')}<div class="vv-blessings-copy vv-reveal"><p class="vv-script">With your blessings</p>${ornament}<p class="vv-blessing-note">${multiline(d.blessingMessage)}</p>${d.groomFamily||d.brideFamily?`<div class="vv-families">${d.groomFamily?`<p>${esc(d.groomFamily)}</p>`:''}${d.groomFamily&&d.brideFamily?'<em>&amp;</em>':''}${d.brideFamily?`<p>${esc(d.brideFamily)}</p>`:''}</div>`:''}${namePair(d,'vv-names--small')}<p class="vv-blessing-date">${esc(d.date.full)} · ${esc(displayTime(d.weddingTime))}</p></div><div class="vv-venue-copy vv-reveal"><p class="vv-script">Our Venue</p>${ornament}<h2>${esc(d.venueName)}</h2><p class="vv-address">${multiline(d.venueAddress)}</p><a class="vv-qr" style="--vv-qr-size:${qrWidth(d.qr)}cqw" href="${esc(d.qr)}" target="_blank" rel="noopener noreferrer" aria-label="Open QR code destination">${qrMarkup(d.qr)}</a><p class="vv-qr-label">Scan to open</p>${mapLink(d.map)}</div><img class="vv-garden-art" src="${A}garden.webp" alt="" width="1100" height="733" loading="lazy"></section>
${section('schedule','Wedding Schedule')}<header class="vv-section-heading vv-reveal"><p class="vv-script">Celebrating the Moments</p>${ornament}<h2>Wedding Schedule</h2></header>${d.events.length?`<ol class="vv-timeline">${d.events.map(eventCard).join('')}</ol>`:'<p class="vv-no-events">We look forward to celebrating with you.</p>'}</section>
${section('countdown','Wedding Countdown')}${d.countdownPhoto?`<div class="vv-countdown-photo"><img src="${esc(d.countdownPhoto)}" alt="Wedding portrait of ${esc(title)}" width="800" height="800" loading="lazy"></div>`:`<img class="vv-hands-art" src="${A}hands.webp" alt="Bride and groom joining hands" width="1100" height="1640" loading="lazy">`}<div class="vv-countdown-copy vv-reveal"><h2>Count Down</h2><div class="vv-timer" role="timer" aria-label="Time until the wedding"${d.target!==null?` data-target="${d.target}"`:''}>${['days','hours','minutes','seconds'].map((unit,i)=>`<div><strong data-unit="${unit}">00</strong><span>${['days','hours','min','sec'][i]}</span></div>`).join('')}</div><p class="vv-countdown-status" role="status">${d.target===null?'Add your wedding date and time to begin the countdown.':''}</p><p class="vv-countdown-date">${esc(d.countdownDateText)} · ${esc(d.countdownTimeText)}</p><p class="vv-script vv-countdown-names">${esc(d.groomName)} &amp; ${esc(d.brideName)}</p></div></section>
<footer class="vv-footer"><span aria-hidden="true">❧</span><a href="https://paigaam.cc/" target="_blank" rel="noopener noreferrer">PAIGAAM</a><small>beautiful greetings, made personal</small><a class="vv-back-top" href="#vv-cover">Back to the beginning ↑</a></footer></main>
${fallingPetals()}
<nav class="vv-navigation" aria-label="Invitation sections" hidden><button type="button" data-vv-prev aria-label="Previous section">‹</button><div>${links.map(([id,label],i)=>`<a href="#vv-${id}" aria-label="${label}"${i===0?' aria-current="location"':''}><span class="vv-sr">${label}</span></a>`).join('')}</div><button type="button" data-vv-next aria-label="Next section">›</button></nav>
${d.musicUpload?`<div class="vv-music"><audio id="vv-audio" src="${esc(d.musicUpload)}" preload="none" loop></audio><button id="vv-music-toggle" type="button" aria-label="Play background music" aria-pressed="false">♪</button><span id="vv-music-status" role="status"></span></div>`:''}
<dialog class="vv-lightbox" id="vv-lightbox" aria-label="Photograph viewer"><button type="button" data-vv-lightbox-close aria-label="Close photograph">×</button><button type="button" data-vv-lightbox-prev aria-label="Previous photograph">‹</button><figure><img alt="" width="800" height="800"><figcaption></figcaption></figure><button type="button" data-vv-lightbox-next aria-label="Next photograph">›</button></dialog>
${previewBadge(opts)}<noscript><p class="vv-noscript">All invitation details are available below. Enable JavaScript for the live countdown and photo viewer.</p><style>.vv-moments-sticky{position:static}.vv-moments{height:auto!important}.vv-photo-stack{height:auto;display:grid;gap:2rem;margin:3rem auto}.vv-polaroid{position:relative!important;opacity:1!important;visibility:visible!important;transform:none!important;pointer-events:auto!important}.vv-polaroid[aria-hidden]{display:block}.vv-photo-back,.vv-gallery-controls,.vv-gallery-hint{display:none}.vv-moments{padding-bottom:4rem}</style></noscript></body></html>`;
}
module.exports = { render, view, dateParts, displayTime, directions };
