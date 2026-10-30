'use strict';
const config=require('./config');
const schema=require('./schema');
const {resolve}=require('../../lib/bfday/fields');
const {escape:esc,multiline,head,previewBadge}=require('../../lib/bfday/page');
const {bgmParse}=require('../../lib/bfday/bgm');
const art=require('./art');
function line(cls,value){return value?`<p class="${cls} dd-reveal">${multiline(value)}</p>`:'';}
function fit(cls,content){return `<div class="dd-fit ${cls}" data-dd-fit><div class="dd-fit-inner">${content}</div></div>`;}
function page(kind,label,index,body){return `<section class="dd-page dd-page--${kind}${index===0?' is-current':''}" data-dd-page data-kind="${kind}" aria-label="${esc(label)}" aria-hidden="${index!==0}" tabindex="-1"${index?' inert':''}>${body}</section>`;}
function divider(){return '<div class="dd-divider dd-reveal" aria-hidden="true"><i></i><b>◇</b><i></i></div>';}
function portrait(d){return `<div class="dd-portrait dd-reveal${d.familyPhoto?' has-photo':''}"><div class="dd-photo-window">${d.familyPhoto?`<img src="${esc(d.familyPhoto)}" alt="${esc(d.familyName)}" style="--zoom:${d.photoZoom/100};--x:${d.photoX}%;--y:${d.photoY}%" width="360" height="360">`:'<div class="dd-photo-placeholder" role="img" aria-label="A place for your family portrait"><svg viewBox="0 0 100 80" aria-hidden="true"><path d="M16 70Q14 48 31 46Q48 48 46 70M54 70Q52 48 69 46Q86 48 84 70M34 70Q34 56 50 55Q66 56 66 70"/><circle cx="31" cy="30" r="12"/><circle cx="69" cy="30" r="12"/><circle cx="50" cy="46" r="9"/></svg><span>Your family portrait</span></div>'}</div><i class="dd-frame-corner dd-frame-corner--tl">✧</i><i class="dd-frame-corner dd-frame-corner--tr">✧</i><i class="dd-frame-corner dd-frame-corner--bl">✧</i><i class="dd-frame-corner dd-frame-corner--br">✧</i></div>`;}
function render(paigaam={},opts={}){
  const d=resolve(config,paigaam.customer_data,schema);
  // Missing fields use the designed sample; an intentionally cleared optional line stays cleared.
  for(const f of config.fields) if(!f.required&&['text','textarea'].includes(f.type)&&paigaam.customer_data?.[f.id]==='')d[f.id]='';
  const cover=page('cover','Light the diya to open your invitation',0,
    art.coverArt()+fit('dd-cover-title',`<h1>${esc(d.coverTitle)}</h1>`)+
    `<button class="dd-light" type="button" data-dd-light aria-label="Swipe up or tap to light the diya"><span class="dd-wick-glow" aria-hidden="true"></span>${art.diya('dd-cover-diya')}<span class="dd-sparks" aria-hidden="true">${[0,1,2,3].map(i=>`<i style="--i:${i}"></i>`).join('')}</span></button><div class="dd-hint"><span class="dd-up" aria-hidden="true">↑</span>${fit('dd-hint-copy',`<p>${esc(d.coverHint)}</p>`)}<span class="dd-tap-hint">or tap the diya</span></div><div class="dd-cover-aura" aria-hidden="true"></div>`);
  const party=page('invitation','Diwali party invitation',1,art.festiveArt()+
    fit('dd-invited',line('dd-eyebrow',d.heading))+
    fit('dd-party-title',`<h2 class="dd-gold-title dd-reveal">${esc(d.title)}</h2>`)+
    fit('dd-party-subtitle',line('dd-script',d.subtitle))+divider()+
    fit('dd-tagline',line('dd-tracked',d.tagline))+
    fit('dd-host',line('dd-host-line',d.hostLine))+
    `<div class="dd-date dd-reveal">${fit('dd-weekday',line('',d.day))}${fit('dd-calendar',line('dd-date-number',d.date)+line('dd-month',d.month)+line('dd-year',d.year))}${fit('dd-time',line('',d.time))}</div>`+
    fit('dd-party-address',line('dd-address',d.address)));
  const welcome=page('welcome','Family welcome and thank you',2,art.festiveArt()+portrait(d)+
    fit('dd-regards',line('dd-script',d.regards))+
    fit('dd-family',`<h2 class="dd-gold-title dd-reveal">${esc(d.familyName)}</h2>`)+
    fit('dd-welcome-message',line('dd-welcome-text',d.welcomeMessage))+
    fit('dd-thanks',line('dd-script dd-golden',d.thankYou))+
    fit('dd-welcome-address',line('dd-address',d.address))+
    (d.mapsLink?`<a class="dd-maps dd-reveal" href="${esc(d.mapsLink)}" target="_blank" rel="noopener noreferrer">Open in Google Maps <span aria-hidden="true">↗</span></a>`:''));
  const yt=!d.musicUpload&&bgmParse(d.musicLink),audio=d.musicUpload||(!yt?d.musicLink:'');
  return `<!DOCTYPE html><html lang="en" class="dd-html"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${head({paigaam,opts,title:d.familyName+' · '+d.title,description:d.tagline.replace(/\n/g,' '),themeColor:'#385F50',image:config.ogImage})}<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400;6..96,500&family=Cormorant+Garamond:wght@400;500;600&family=Allura&family=Inter:wght@400;500&display=swap" rel="stylesheet"><link href="/diwali-deep/diwali.css?v=1" rel="stylesheet"><script defer src="/diwali-deep/diwali.js?v=1"></script></head><body class="dd-body" data-preview="${!!opts.isPreview}"><main class="dd-app" id="ddApp"><div class="dd-stage" id="ddStage"><div class="dd-frame" id="ddFrame"><div class="dd-card" id="ddCard">${cover}${party}${welcome}<div class="dd-leaves" aria-hidden="true">${[0,1,2,3,4,5].map(i=>`<i style="--i:${i}"></i>`).join('')}</div></div></div></div><nav class="dd-controls" aria-label="Invitation pages"><button type="button" data-dd-prev aria-label="Previous page" disabled>‹</button><div class="dd-dots">${['Light the diya','Party invitation','Family welcome'].map((s,i)=>`<button type="button" data-dd-go="${i}" aria-label="${s}"${!i?' aria-current="page"':''}><span></span></button>`).join('')}</div><button type="button" data-dd-next aria-label="Next page">›</button></nav><p class="dd-sr" data-dd-status aria-live="polite">Page 1 of 3: Light the diya</p><button class="dd-motion" type="button" data-dd-motion aria-pressed="false" aria-label="Pause decorative animations">Ⅱ</button>${audio||yt?`<div class="dd-music" data-dd-music${yt?` data-youtube="${yt}"`:''}><button type="button" data-dd-music-toggle aria-label="Play music" aria-pressed="false">♪</button><span class="dd-music-status" role="status"></span>${audio?`<audio id="ddAudio" src="${esc(audio)}" preload="none" loop></audio>`:'<span data-dd-player></span>'}</div>`:''}<div class="dd-golden-flood" aria-hidden="true"></div></main>${previewBadge(opts)}<noscript><style>.dd-html,.dd-body{height:auto;overflow:auto}.dd-app,.dd-stage,.dd-frame{position:static;height:auto;display:block;width:100%}.dd-card{width:360px;height:auto;transform:none;margin:auto}.dd-page{position:relative;height:640px;opacity:1;visibility:visible;transform:none}.dd-reveal{animation:none;opacity:1}.dd-controls,.dd-light,.dd-motion,.dd-music,.dd-hint,.dd-leaves{display:none}</style><p>JavaScript is off. Scroll to read all three invitation pages.</p></noscript></body></html>`;
}
module.exports={render};
