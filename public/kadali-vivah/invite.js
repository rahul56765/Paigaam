/* Kadali Vivah v2 — original scroll-directed 3D wedding invitation.
 * Only the data/editor contract is shared with Paigaam. No existing invitation
 * renderer, visual markup, art library or guest-form UI is used here. */
(function () {
  'use strict';
  const C = window.SPCore, I = window.SPI18N;
  const cfg = JSON.parse(document.getElementById('sp-boot').textContent);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const live = cfg.mode === 'live', thumb = cfg.mode === 'thumb';
  let data = C.validate(cfg.data, {allowPast:true}).data, lang = data.lang.default;
  let stage = null, raf = 0, clock = 0, audio = null, audioWanted = false, galleryIndex = 0;
  let destroyed = false, renderGeneration = 0, revealObserver = null;
  let videoStarted = false, opened = live || thumb || cfg.autoOpen, sectionMetrics = [];
  let pendingProgress = 0, lastRenderTime = 0;
  const $ = (s,root=document) => root.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const T = key => I.t(lang, key), X = path => C.txt(data, lang, path);
  const pair = () => (data.couple.order === 'bride' ? ['bride','groom'] : ['groom','bride']);
  const couple = () => pair().map(s => X('couple.'+s+'.first')).join(' & ');
  const ornament = '<svg class="sigil" viewBox="0 0 120 40" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width=".8"><path d="M4 20H39Q49 20 60 6Q71 20 81 20H116M37 20Q51 20 60 34Q69 20 83 20M60 6Q42 19 60 34Q78 19 60 6Z"/><circle cx="60" cy="20" r="4"/><path d="M8 20q8-17 18-5q-10 13-18 5m104 0q-8-17-18-5q10 13 18 5"/></g></svg>';
  const icon = name => ({arrow:'↗',close:'×',play:'▶',pause:'Ⅱ',replay:'↺',down:'↓',calendar:'＋',music:'♪',sound:'♫',pin:'⌖'}[name] || '✧');
  const mediaURL = p => window.KVPreviewMedia && window.KVPreviewMedia[p] || p;

  function theme() {
    const palette = C.buildPalette(data.palette), root = document.documentElement;
    Object.entries(palette.vars).forEach(([k,v]) => root.style.setProperty(k,v));
    const f = C.FONT_BY_ID[data.font] || C.FONTS[0];
    root.style.setProperty('--font-names', f.script); root.style.setProperty('--font-body', f.serif);
    root.lang = lang; root.dir = I.LANGS[lang].dir;
    const link = $('#sp-fonts'); if (link) link.href = C.googleFontsHref(data.font,data.lang.enabled);
    if (stage) stage.setPalette(palette.palette);
    return palette.palette;
  }

  function introMarkup() {
    if (opened) return '';
    return `<div class="film-gate" id="intro" role="dialog" aria-modal="true" aria-label="Open your wedding invitation">
      <div class="film-room" aria-hidden="true"></div>
      <video id="openingFilm" playsinline preload="none" poster="/kadali-vivah/opening-poster.jpg" aria-label="Original wedding opening film"></video>
      <button class="film-start" id="openBtn" type="button"><span class="film-start-ring">${icon('play')}</span><span>${esc(T('tapToOpen'))}</span></button>
      <p class="film-status" id="filmStatus" role="status" aria-live="polite"></p>
      <div class="film-tools"><button id="filmPause" type="button" hidden aria-label="Pause opening">${icon('pause')}</button><button id="skipBtn" type="button">Skip opening ${icon('arrow')}</button></div>
    </div>`;
  }
  function shell() {
    document.body.innerHTML = `<div class="scene-wrap" id="sceneWrap" aria-hidden="true"><div id="stage"></div><div class="scene-shade"></div><div class="scene-grain"></div></div>
      ${introMarkup()}
      <div id="page" ${!opened?'inert':''}>
        <header class="journey-header"><a href="#hero" class="brand-mark" id="monogram" aria-label="Wedding invitation"></a><span class="journey-label">A WEDDING CELEBRATION</span><button type="button" id="replayBtn" aria-label="Replay the original opening film">${icon('replay')}</button></header>
        <nav class="chapter-nav" id="chapterNav" aria-label="Invitation chapters"></nav>
        <main id="story"></main>
        <footer class="journey-footer">${esc(T('madeWith'))} <a href="https://paigaam.cc" target="_blank" rel="noopener noreferrer">PAIGAAM</a></footer>
      </div>
      <div class="utility" ${!opened?'inert':''}><button id="musicBtn" type="button" hidden aria-label="Play optional music">${icon('music')}</button><select id="langSelect" aria-label="Invitation language"></select></div>
      ${cfg.mode==='preview'?`<div class="preview-badge">${esc(T('previewBadge'))}</div>`:''}`;
    document.body.classList.toggle('film-locked',!opened);
    document.documentElement.classList.toggle('intro-on',!opened);
    $('#replayBtn').onclick = replay;
    if (!opened) bindFilm();
    if (opened) initializeStage();
  }
  function bindFilm() {
    const v=$('#openingFilm'), start=$('#openBtn'), pause=$('#filmPause'), status=$('#filmStatus');
    start.onclick = async () => {
      status.textContent = 'Loading the opening…'; start.disabled=true;
      if (!v.getAttribute('src')) v.src = cfg.videoSrc || '/kadali-vivah/opening.mp4';
      try { await v.play(); videoStarted=true; start.hidden=true; pause.hidden=false; status.textContent=''; $('#intro').classList.add('playing'); }
      catch { start.disabled=false; start.hidden=false; status.textContent='Tap to try again, or skip the opening.'; }
    };
    pause.onclick=()=>{ if(v.paused){v.play().catch(()=>{});pause.textContent=icon('pause');pause.setAttribute('aria-label','Pause opening');}else{v.pause();pause.textContent=icon('play');pause.setAttribute('aria-label','Resume opening');} };
    v.addEventListener('waiting',()=>{if(videoStarted)status.textContent='Buffering…';});
    v.addEventListener('playing',()=>status.textContent='');
    v.addEventListener('ended',finishFilm);
    v.addEventListener('error',()=>{status.textContent='The opening could not load. You can retry or continue to the invitation.';start.hidden=false;start.disabled=false;});
    $('#skipBtn').onclick=finishFilm;
    start.focus({preventScroll:true});
  }
  function finishFilm() {
    const intro=$('#intro'); if(!intro||opened)return;
    opened=true; const v=$('#openingFilm'); if(v)v.pause();
    intro.classList.add('finished'); intro.setAttribute('inert',''); intro.setAttribute('aria-hidden','true');
    document.body.classList.remove('film-locked');document.documentElement.classList.remove('intro-on');
    $('#page').removeAttribute('inert');$('.utility').removeAttribute('inert');
    initializeStage(); updateScroll(); $('#hero').focus({preventScroll:true});
    if(reduced)intro.remove();else intro.addEventListener('transitionend',()=>intro.remove(),{once:true});
    // Safety removal is independent of WebGL init, media readiness and CSS support.
    setTimeout(()=>{if(intro.isConnected)intro.remove();},1000);
  }
  function replay() {
    if(stage){stage.dispose();stage=null;}
    if(audio)audio.pause(); opened=false; videoStarted=false;
    shell();render();scrollTo({top:0,behavior:'instant'});
  }
  function initializeStage() {
    if(stage||destroyed||!window.KadaliStage)return;
    try {
      stage=window.KadaliStage.create($('#stage'),{reduced:reduced||thumb,palette:C.buildPalette(data.palette).palette,onReady:()=>$('#sceneWrap')?.classList.add('gl-ready')});
      stage.setProgress(pendingProgress);
    } catch { $('#sceneWrap').classList.add('scene-fallback'); }
  }

  function plate(id, num, title, content, options={}) {
    return `<section class="chapter ${options.side||''} ${options.extra||''}" id="${id}" data-chapter="${id}" tabindex="-1"><div class="chapter-space" aria-hidden="true"></div><div class="chapter-inner"><article class="ceremony-plate"><div class="plate-relief" aria-hidden="true"></div><div class="plate-face"><div class="chapter-kicker"><span>${String(num).padStart(2,'0')}</span><span>${esc(title)}</span><i></i></div>${content}</div><div class="plate-foot" aria-hidden="true">${ornament}</div></article></div></section>`;
  }
  function namesMarkup() {
    return pair().map((side,n)=>`${n?'<span class="name-amp">&amp;</span>':''}<div class="person"><h1 class="name">${esc(X('couple.'+side+'.first'))}</h1>${!data.couple.showParents&&X('couple.'+side+'.last')?`<span class="surname">${esc(X('couple.'+side+'.last'))}</span>`:''}${data.couple.showParents?`<p class="parent-line">${esc(C.parentLine(data,lang,side))}</p>`:''}</div>`).join('');
  }
  function heroMarkup() {
    return plate('hero',1,T('gettingMarried'),`<p class="blessing-invocation">Two souls. One sacred beginning.</p>${ornament}<div class="couple-names">${namesMarkup()}</div><div class="hero-date"><span>${esc(C.fmtDate(data.wedding.date,lang,'long'))}</span><span>${esc(X('venue.city'))}</span></div><a href="#s-welcome" class="scroll-invitation">Scroll to enter ${icon('down')}</a>`,{extra:'hero-chapter'});
  }
  function welcomeMarkup() {
    const text=C.fillNames(X('welcome.text'),data,lang);
    return plate('s-welcome',2,T('withLove'),`${data.couplePhoto?`<div class="portrait-portal"><img src="${esc(mediaURL(data.couplePhoto.url))}" alt="${esc(couple())}" style="object-position:${data.couplePhoto.fx}% ${data.couplePhoto.fy}%"></div>`:''}<h2>A promise,<br><em>with blessings.</em></h2><p class="ceremony-copy">${esc(text)}</p>${ornament}`,{side:'right',extra:'family-chapter'});
  }
  function dateMarkup() {
    return plate('s-scratch',3,T('saveOurDate'),`<div class="date-orbit"><span class="orbit-ring r1" aria-hidden="true"></span><span class="orbit-ring r2" aria-hidden="true"></span><div class="date-seal"><span>${esc(C.fmtDate(data.wedding.date,lang,'weekday'))}</span><strong>${esc(C.fmtDate(data.wedding.date,lang,'daymonth'))}</strong><span>${esc(C.fmtTime(data.wedding.time,lang))}</span></div></div><h2>${esc(T('countdownTitle'))}</h2><div class="countdown" id="cd" role="timer">${['days','hours','minutes','seconds'].map(k=>`<div><strong data-k="${k}">00</strong><span>${esc(T(k))}</span></div>`).join('')}</div><button class="action outline" type="button" id="calendarBtn">${esc(T('saveTheDate'))} ${icon('calendar')}</button>`,{extra:'date-chapter'});
  }
  function galleryMarkup() {
    if(!data.sections.photos||!data.photos.length)return '';
    return plate('s-photos',4,T('photosTitle'),`<h2>Moments to<br><em>treasure.</em></h2><div class="memory-stage" id="memoryStage">${data.photos.map((p,n)=>`<figure class="memory ${n===galleryIndex?'selected':''}" style="--slot:${n}" data-photo="${n}"><img src="${esc(mediaURL(p.url))}" alt="${esc(p.alt||couple())}" style="object-position:${p.fx}% ${p.fy}%" loading="lazy"><figcaption>${String(n+1).padStart(2,'0')} / ${String(data.photos.length).padStart(2,'0')}</figcaption></figure>`).join('')}</div><div class="memory-controls"><button type="button" id="photoPrev" aria-label="Previous photo">←</button><span>${esc(T('photosTitle'))}</span><button type="button" id="photoNext" aria-label="Next photo">→</button></div>`,{side:'right',extra:'gallery-chapter'});
  }
  function eventsMarkup() {
    const events=data.events.filter(e=>data.sections.preWedding||['wedding','arrival','reception'].includes(e.type)).slice().sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
    return plate('s-timeline',data.photos.length?5:4,T('timelineTitle'),`<h2>Every ritual.<br><em>Every joy.</em></h2><div class="rituals">${events.map((e,n)=>`<article class="ritual-ticket" style="--ticket:${n}"><span class="ritual-number">${String(n+1).padStart(2,'0')}</span><div><h3>${esc(C.eventName(data,lang,e))}</h3><p class="ritual-when">${esc(C.fmtDate(e.date,lang,'short'))} · ${esc(C.fmtTime(e.start,lang))}${e.end?' – '+esc(C.fmtTime(e.end,lang)):''}</p>${C.txt(data,lang,'events.'+e.id+'.venue')?`<p>${esc(C.txt(data,lang,'events.'+e.id+'.venue'))}</p>`:''}${C.txt(data,lang,'events.'+e.id+'.note')?`<p class="ritual-note">${esc(C.txt(data,lang,'events.'+e.id+'.note'))}</p>`:''}${C.txt(data,lang,'events.'+e.id+'.dress')?`<p class="ritual-dress">${esc(C.txt(data,lang,'events.'+e.id+'.dress'))}</p>`:''}</div></article>`).join('')}</div>`,{side:'right',extra:'events-chapter'});
  }
  function venueBlock(v,prefix) {
    const links=C.mapsLinks(v);
    return `<div class="venue-plaque"><h3>${esc(X(prefix+'.name'))}</h3><p>${esc([X(prefix+'.address'),X(prefix+'.city'),X(prefix+'.state'),v.pin].filter(Boolean).join(', '))}</p><a class="action" href="${esc(links.google)}" target="_blank" rel="noopener noreferrer">${esc(T('openInMaps'))} ${icon('arrow')}</a></div>`;
  }
  function guestDetails() {
    const details=[];
    if(data.sections.dressCode){const dress=[X('dress.common'),X('dress.women')&&T('women')+': '+X('dress.women'),X('dress.men')&&T('men')+': '+X('dress.men')].filter(Boolean).join('\n');if(dress)details.push([T('dressTitle'),dress]);}
    if(data.sections.transport&&X('transport'))details.push([T('transportTitle'),X('transport')]);
    if(data.sections.accommodation&&(X('accommodation.text')||data.accommodation.code))details.push([T('accommodationTitle'),[X('accommodation.text'),data.accommodation.code].filter(Boolean).join('\n')]);
    if(data.sections.gifts&&X('gifts'))details.push([T('giftsTitle'),X('gifts')]);
    return details.length?`<div class="guest-details">${details.map(([title,text])=>`<details><summary>${esc(title)} <span>＋</span></summary><p>${esc(text)}</p></details>`).join('')}</div>`:'';
  }
  function venueMarkup() {
    return plate('s-venue',data.photos.length?6:5,T('venueTitle'),`<h2>Where our<br><em>forever begins.</em></h2>${venueBlock(data.venue,'venue')}${data.reception.enabled&&data.reception.name?venueBlock(data.reception,'reception'):''}${guestDetails()}`,{extra:'venue-chapter'});
  }
  function rsvpMarkup() {
    const yes=C.whatsappRsvpLink(data,true,lang), no=C.whatsappRsvpLink(data,false,lang);
    const closed=data.rsvp.deadline&&Date.now()>Date.parse(data.rsvp.deadline+'T23:59:59');
    let rsvp='';
    if(data.sections.rsvp){
      rsvp=`<h2>Your presence.<br><em>Our happiness.</em></h2>${data.rsvp.deadline?`<p class="rsvp-deadline">${esc(T('rsvpBy').replace('{date}',C.fmtDate(data.rsvp.deadline,lang,'long')))}</p>`:''}`;
      if(closed&&!live)rsvp+=`<p>${esc(T('rsvpClosed'))}</p>`;
      else rsvp+=`<div class="rsvp-choices">${[[yes,T('accept'),'yes'],[no,T('decline'),'no']].map(([href,label,answer])=>href?`<a class="action ${answer==='no'?'outline':''}" data-rsvp="${answer}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)} ${icon('arrow')}</a>`:`<button class="action ${answer==='no'?'outline':''}" type="button" data-rsvp="${answer}" disabled>${esc(label)} ${icon('arrow')}</button>`).join('')}</div><p class="rsvp-explain">${esc(yes?T('rsvpWhatsappHint'):'The organiser’s WhatsApp number activates these choices when the invitation is published.')}</p>`;
    }
    return plate('s-rsvp',data.photos.length?7:6,T('withLove'),`${rsvp}${ornament}<p class="closing-small">${esc(T('withLove'))}</p><div class="closing-names">${esc(couple())}</div>${X('closing')?`<p class="ceremony-copy">${esc(X('closing'))}</p>`:''}`,{side:'right',extra:'rsvp-chapter'});
  }

  function render() {
    const y=scrollY; renderGeneration++; const palette=theme();
    $('#story').innerHTML=heroMarkup()+welcomeMarkup()+dateMarkup()+galleryMarkup()+eventsMarkup()+venueMarkup()+rsvpMarkup();
    $('#monogram').textContent=pair().map(s=>X('couple.'+s+'.first').slice(0,1)).join(' · ');
    const chapters=$$('.chapter');
    $('#chapterNav').innerHTML=chapters.map((el,n)=>`<a href="#${el.id}" aria-label="Chapter ${n+1}: ${esc($('.chapter-kicker',el)?.textContent||'')}" data-nav="${n}"><span>${String(n+1).padStart(2,'0')}</span><i></i></a>`).join('');
    // Keep the existing editor's focus anchors without inheriting its page layout.
    const date=$('#s-scratch');if(date)date.dataset.alias='countdown';
    setupLanguage();setupMusic();bindCalendar();bindGallery();bindCountdown();bindReveals();
    fitNames();measure();scrollTo(0,y);updateScroll();
    if(stage)stage.setPalette(palette);
  }
  function setupLanguage() {
    const select=$('#langSelect');select.innerHTML=data.lang.enabled.map(l=>`<option value="${l}" ${l===lang?'selected':''}>${esc(I.LANGS[l].native)}</option>`).join('');
    select.hidden=data.lang.enabled.length<2;select.onchange=()=>setLang(select.value);
  }
  function setLang(value){if(!data.lang.enabled.includes(value))return;lang=value;render();}
  function fitNames(){
    const run=()=>{$$('.name').forEach(el=>{el.style.fontSize='';const max=innerWidth<650?64:86;let n=max;el.style.fontSize=n+'px';while(n>27&&el.scrollWidth>el.clientWidth+1){n-=2;el.style.fontSize=n+'px';}});};
    run();if(document.fonts)document.fonts.ready.then(()=>{if(!destroyed){run();measure();}});
  }
  function measure(){sectionMetrics=$$('.chapter').map(el=>({el,top:el.offsetTop,height:el.offsetHeight}));}
  function updateScroll(){
    if(destroyed)return;
    const y=scrollY, view=innerHeight||800, total=Math.max(1,(document.documentElement.scrollHeight-view));
    pendingProgress=Math.max(0,Math.min(1,y/total));
    if(stage&&opened)stage.setProgress(pendingProgress);
    let active=0;
    sectionMetrics.forEach((m,n)=>{
      const relative=(y+view*.5-(m.top+m.height*.5))/Math.max(view,m.height);
      const visible=Math.max(0,1-Math.abs(relative)*1.3);
      const p=Math.max(-1,Math.min(1,relative));
      m.el.style.setProperty('--pass',String(reduced?0:p));
      m.el.style.setProperty('--presence',String(reduced?1:visible));
      if(y+view*.55>=m.top)active=n;
    });
    $$('[data-nav]').forEach((el,n)=>{el.classList.toggle('active',n===active);if(n===active)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
    document.documentElement.style.setProperty('--journey',String(pendingProgress));
    raf=0;
  }
  function queueScroll(){if(!raf)raf=requestAnimationFrame(updateScroll);}
  function bindReveals(){
    if(revealObserver)revealObserver.disconnect();
    if(reduced||live||thumb||!('IntersectionObserver'in window)){$$('.ritual-ticket').forEach(el=>el.classList.add('entered'));return;}
    revealObserver=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('entered');revealObserver.unobserve(e.target);}}),{threshold:.12});
    $$('.ritual-ticket').forEach(el=>revealObserver.observe(el));
  }
  function bindCalendar(){
    $('#calendarBtn').onclick=()=>{const blob=new Blob([C.icsFor(data,lang,cfg.url||'')],{type:'text/calendar;charset=utf-8'});const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download='wedding-invitation.ics';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),2000);};
  }
  function bindCountdown(){
    clearInterval(clock);const target=C.zonedToUtc(data.wedding.date,data.wedding.time,data.wedding.tz);
    const tick=()=>{const diff=Math.max(0,Math.floor((target-Date.now())/1000)),values={days:Math.floor(diff/86400),hours:Math.floor(diff/3600)%24,minutes:Math.floor(diff/60)%60,seconds:diff%60};Object.entries(values).forEach(([k,v])=>{const el=$('[data-k="'+k+'"]');if(el)el.textContent=C.fmtNum(v,lang);});};tick();clock=setInterval(tick,1000);
  }
  function bindGallery(){
    const n=data.photos.length;if(!$('#memoryStage')||!n)return;
    const go=direction=>{galleryIndex=(galleryIndex+direction+n)%n;$$('.memory').forEach((el,index)=>{el.classList.toggle('selected',index===galleryIndex);el.style.setProperty('--away',String((index-galleryIndex+n)%n));});};
    $('#photoPrev').onclick=()=>go(-1);$('#photoNext').onclick=()=>go(1);go(0);
  }
  function setupMusic(){
    const button=$('#musicBtn');const source=data.sections.music?(data.music.track==='upload'?data.music.url:'/shaadi-paigaam/music/'+data.music.track+'.mp3'):'';
    button.hidden=!source||thumb;
    if(audio&&audio.getAttribute('src')!==source){audio.pause();audio.removeAttribute('src');audio.load();audio=null;audioWanted=false;}
    button.onclick=async()=>{
      if(!audio){audio=new Audio();audio.preload='none';audio.loop=true;audio.src=source;audio.volume=.5;}
      if(audio.paused){try{await audio.play();audioWanted=true;button.textContent=icon('sound');button.setAttribute('aria-label','Pause music');}catch{audioWanted=false;}}
      else{audio.pause();audioWanted=false;button.textContent=icon('music');button.setAttribute('aria-label','Play optional music');}
    };
  }
  function go(id){const aliases={countdown:'scratch',welcome:'welcome',hero:'hero'};const key=aliases[id]||id;const el=document.getElementById(key==='hero'?'hero':'s-'+key);if(el)el.scrollIntoView({behavior:reduced?'auto':'smooth',block:'start'});}
  function cleanup(){destroyed=true;cancelAnimationFrame(raf);clearInterval(clock);if(stage)stage.dispose();if(audio)audio.pause();if(revealObserver)revealObserver.disconnect();}
  window.addEventListener('scroll',queueScroll,{passive:true});
  window.addEventListener('resize',()=>{fitNames();measure();if(stage)stage.resize();queueScroll();});
  window.addEventListener('pagehide',cleanup,{once:true});
  document.addEventListener('visibilitychange',()=>{if(audio){if(document.hidden)audio.pause();else if(audioWanted)audio.play().catch(()=>{});}});
  document.addEventListener('keydown',event=>{
    const intro=$('#intro:not(.finished)');if(!intro)return;
    if(event.key==='Escape'){event.preventDefault();finishFilm();}
    if(event.key==='Tab'){
      const controls=Array.from(intro.querySelectorAll('button:not([hidden]):not(:disabled)'));const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&(document.activeElement===first||!intro.contains(document.activeElement))){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  });
  window.addEventListener('message',event=>{
    if(event.source!==parent||event.origin!==location.origin||!event.data||typeof event.data!=='object')return;
    const m=event.data;
    if(m.type==='sp:data'&&m.data){data=C.validate(m.data,{allowPast:true}).data;lang=m.lang&&data.lang.enabled.includes(m.lang)?m.lang:data.lang.default;render();if(m.focus&&opened)go(m.focus);}
    else if(m.type==='sp:replay')replay();
    else if(m.type==='sp:open')$('#openBtn')?.click();
    else if(m.type==='sp:lang')setLang(m.lang);
    else if(m.type==='sp:go')go(m.id);
    else if(m.type==='sp:scroll')scrollTo(0,m.y||0);
    else if(m.type==='sp:revealAll')$$('.ritual-ticket').forEach(el=>el.classList.add('entered'));
  });
  window.SPInvite={open:()=>$('#openBtn')?.click(),replay,setLang,go,reveal:()=>go('scratch'),stage:()=>stage?.stats()||null,progress:()=>pendingProgress};
  theme();shell();render();
  if(parent!==window)parent.postMessage({type:'sp:ready'},location.origin);
})();
