/* Suvarna Vivah — original wedding invitation experience, backed by Shaadi's shared data schema. */
(() => {
  'use strict';
  const C = window.SPCore, I = window.SPI18N;
  const bootEl = document.getElementById('sp-boot'), mount = document.getElementById('sv-app');
  if (!C || !I || !bootEl || !mount) return;
  let boot; try { boot = JSON.parse(bootEl.textContent || '{}'); } catch { return; }
  let data = C.validate(boot.data || C.SAMPLE, { allowPast: true }).data;
  let readySent = false, sceneCleanup = null, scratchCleanup = null, filmOpen = false, activePhoto = 0;
  let lang = boot.lang || data.lang.default || 'en', countdownTimer = 0, toastTimer = 0, audio = null;
  const SEAL = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3c1.2 3.1 3.6 4.5 5.6 6.2-1.2 4.4-2.9 7.2-5.6 9.6-2.7-2.4-4.4-5.2-5.6-9.6C8.4 7.5 10.8 6.1 12 3Z" stroke="currentColor" stroke-width="1"/><path d="M8 11h8M9.5 15.5h5M10 20h4" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const labels = {
    en:{suvarnaVenueArt:'Ceremonial artwork · not a venue photograph',suvarnaHeroLine:'A sacred beginning. A lifetime together.',suvarnaLetterHeading:'Together, with our families',suvarnaCeremonyHeading:'Where two worlds become one',replay:'Watch the opening again',close:'Close',previous:'Previous photo',next:'Next photo'},
    hi:{suvarnaVenueArt:'सजावटी चित्र · स्थल की तस्वीर नहीं',suvarnaHeroLine:'शुभ आरंभ। जीवन भर का साथ।',suvarnaLetterHeading:'परिवारों के आशीर्वाद के साथ',suvarnaCeremonyHeading:'दो संसार, एक कहानी',replay:'प्रारंभ फिर देखें',close:'बंद करें',previous:'पिछली तस्वीर',next:'अगली तस्वीर'},
    mr:{suvarnaVenueArt:'सजावटी चित्र · स्थळाचे छायाचित्र नाही',suvarnaHeroLine:'शुभारंभ. आयुष्यभराची साथ.',suvarnaLetterHeading:'कुटुंबांच्या आशीर्वादाने',suvarnaCeremonyHeading:'दोन विश्वे, एक कहाणी',replay:'प्रारंभ पुन्हा पाहा',close:'बंद करा',previous:'मागील फोटो',next:'पुढील फोटो'},
    gu:{suvarnaVenueArt:'સુશોભન ચિત્ર · સ્થળનો ફોટો નથી',suvarnaHeroLine:'શુભ આરંભ. જીવનભરનો સાથ.',suvarnaLetterHeading:'પરિવારોના આશીર્વાદ સાથે',suvarnaCeremonyHeading:'બે જગત, એક કહાની',replay:'પ્રારંભ ફરી જુઓ',close:'બંધ કરો',previous:'પાછલો ફોટો',next:'આગળનો ફોટો'},
    ta:{suvarnaVenueArt:'அலங்கார ஓவியம் · இடத்தின் புகைப்படம் அல்ல',suvarnaHeroLine:'மங்கலத் தொடக்கம். வாழ்நாள் துணை.',suvarnaLetterHeading:'குடும்பங்களின் ஆசிகளுடன்',suvarnaCeremonyHeading:'இரு உலகங்கள் ஒன்றாகின்றன',replay:'தொடக்கத்தை மீண்டும் பார்க்க',close:'மூடு',previous:'முந்தைய படம்',next:'அடுத்த படம்'},
    te:{suvarnaVenueArt:'అలంకార చిత్రం · వేదిక ఫోటో కాదు',suvarnaHeroLine:'శుభారంభం. జీవితాంతం తోడు.',suvarnaLetterHeading:'కుటుంబాల ఆశీస్సులతో',suvarnaCeremonyHeading:'రెండు లోకాలు ఒకటయ్యే వేళ',replay:'ప్రారంభాన్ని మళ్లీ చూడండి',close:'మూసివేయి',previous:'మునుపటి ఫోటో',next:'తదుపరి ఫోటో'},
    ur:{suvarnaVenueArt:'آرائشی فن · مقام کی تصویر نہیں',suvarnaHeroLine:'مبارک آغاز۔ زندگی بھر کا ساتھ۔',suvarnaLetterHeading:'خاندانوں کی دعاؤں کے ساتھ',suvarnaCeremonyHeading:'دو دنیائیں، ایک کہانی',replay:'آغاز دوبارہ دیکھیں',close:'بند کریں',previous:'پچھلی تصویر',next:'اگلی تصویر'},
    ar:{suvarnaVenueArt:'رسم احتفالي · ليس صورة للمكان',suvarnaHeroLine:'بداية مباركة. ورفقة العمر.',suvarnaLetterHeading:'مع بركات عائلتينا',suvarnaCeremonyHeading:'حيث يصبح العالمان واحداً',replay:'شاهدوا الافتتاحية مجدداً',close:'إغلاق',previous:'الصورة السابقة',next:'الصورة التالية'}
  };
  const T = k => labels[lang]?.[k] || labels.en[k] || I.t(lang, k);
  const X = p => C.txt(data, lang, p);
  const fmtDate = (v, style = 'long') => C.fmtDate(v, lang, style);
  const fmtTime = v => C.fmtTime(v, lang);
  const coupleNames = () => {
    const sides = data.couple.order === 'bride' ? ['bride', 'groom'] : ['groom', 'bride'];
    return sides.map(s => X(`couple.${s}.first`)).filter(Boolean);
  };
  const mapUrl = v => C.mapsLinks(v).google;
  const eventLabel = ev => C.eventName(data, lang, ev);
  const eventTime = ev => [fmtDate(ev.date, 'short'), [fmtTime(ev.start), ev.end ? fmtTime(ev.end) : ''].filter(Boolean).join(' – ')].filter(Boolean).join(' · ');
  const family = side => {
    const who = C.parentLine(data, lang, side);
    return who ? `<div class="sv-family__side"><span class="sv-family__names">${esc(who)}</span></div>` : '';
  };
  const art = (name, cls = '', eager = false) => `<img class="${cls}" src="/suvarna-vivah/${name}.webp" alt="" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
  const flourish = () => `<div class="sv-flourish" aria-hidden="true">${SEAL}</div>`;
  const petals = () => `<div class="sv-petals" aria-hidden="true">${Array.from({length:9},(_,i)=>`<i class="sv-petal" style="--left:${i*12}%;--delay:${-i*2.3}s;--blur:${i%3===0?1:0}px"></i>`).join('')}</div>`;
  const headline = (kicker, title, sub = '') => `<div class="sv-section__head"><p class="sv-kicker">${esc(kicker)}</p><h2 class="sv-section__title">${esc(title)}</h2>${flourish()}${sub?`<p class="sv-section__sub">${esc(sub)}</p>`:''}</div>`;
  function eventCard(ev, n) {
    const time = [fmtTime(ev.start), ev.end ? fmtTime(ev.end) : ''].filter(Boolean).join(' – ');
    const venue = [ev.venue, ev.address].filter(Boolean).join(' · ');
    const links = venue ? C.mapsLinks({name:ev.venue,address:ev.address}) : null;
    return `<article class="sv-event"><span class="sv-event__time">${esc(time || eventTime(ev))}</span><h3 class="sv-event__name">${esc(eventLabel(ev))}</h3>${venue ? `<p class="sv-event__venue">${esc(venue)}</p>` : ''}${ev.note ? `<p class="sv-event__note">${esc(C.txt(data, lang, `events.${ev.id}.note`) || ev.note)}</p>` : ''}${links?`<a class="sv-event__map" href="${esc(links.google)}" target="_blank" rel="noopener noreferrer">${esc(T('openInMaps'))} ↗</a>`:''}</article>`;
  }
  function timeline() {
    const schedule = C.schedule(data), days = [];
    if (data.sections.preWedding !== false) for (const ev of schedule.pre) {
      let day = days.find(d => d.date === ev.date); if (!day) days.push(day = { date: ev.date, events: [] }); day.events.push(ev);
    }
    for (const day of schedule.days) days.push(day);
    if (!days.length) return '';
    return `<div class="sv-journey__days">${days.map((day, i) => `<div class="sv-day"><time class="sv-day__date">${esc(fmtDate(day.date, 'daymonth'))}${data.wedding.date && day.date === data.wedding.date ? `<br><span>${esc(String(new Date(day.date + 'T00:00:00Z').getUTCFullYear()))}</span>` : ''}</time><div class="sv-day__events">${day.events.map((ev, j) => eventCard(ev, j)).join('')}</div></div>`).join('')}</div>`;
  }
  function dateReveal() {
    const date = fmtDate(data.wedding.date, 'full'), time = fmtTime(data.wedding.time);
    return `<section class="sv-section sv-date" id="sv-date"><div class="sv-section__inner">${headline(T('saveOurDate'),T('suvarnaRevealDate'),T('suvarnaScratchHint'))}<div class="sv-date__layout"><div class="sv-date-reveal" id="sv-date-reveal"><div class="sv-date-reveal__under" aria-hidden="true" inert><div class="sv-date-reveal__seal">${SEAL}</div><p class="sv-date-reveal__label">${esc(I.eventTypeName('wedding',lang))}</p><h3>${esc(date)}</h3><p class="sv-date-reveal__time">${esc([time, data.venue.city].filter(Boolean).join(' · '))}</p><a class="sv-date-reveal__calendar" href="#" id="sv-calendar" tabindex="-1">${esc(T('saveTheDate'))} ↗</a></div><canvas class="sv-scratch" id="sv-scratch" aria-hidden="true"></canvas><button type="button" class="sv-date-reveal__button" id="sv-reveal-date">${esc(T('suvarnaRevealDate'))}</button></div><div class="sv-countdown" data-sv-countdown><p class="sv-countdown__kicker">${esc(T('countdownTitle'))}</p><div class="sv-countdown__grid">${[['d','days'],['h','hours'],['m','minutes'],['s','seconds']].map(([unit,key])=>`<div><strong data-unit="${unit}">00</strong><span>${esc(T(key))}</span></div>`).join('')}</div></div></div></div></section>`;
  }
  function currentPhotos() {
    const real = (data.photos || []).filter(p => p.url && !/\/art\/demo-/.test(p.url));
    if (data.couplePhoto?.url && !real.some(p => p.url === data.couplePhoto.url)) real.unshift({ ...data.couplePhoto, alt: T('photosTitle') });
    return real.slice(0,C.LIMITS.photos+1);
  }
  function photos() {
    const real = currentPhotos(); if(!real.length) return '';
    return `<section class="sv-section sv-gallery" id="sv-gallery"><div class="sv-section__inner">${headline(T('photosTitle'),T('suvarnaGalleryTitle'))}<div class="sv-gallery__grid">${real.map((p,i)=>`<figure class="sv-gallery__item"><button class="sv-gallery__button" type="button" data-photo="${i}" aria-label="${esc(p.alt||T('photosTitle'))}"><img src="${esc(p.url)}" alt="${esc(p.alt||`${T('photosTitle')} ${i+1}`)}" loading="lazy"></button>${p.alt?`<figcaption>${esc(p.alt)}</figcaption>`:''}</figure>`).join('')}</div></div></section>`;
  }
  function detailCards() {
    const cards=[];
    if(data.sections.dressCode!==false && (data.dress.women||data.dress.men||data.dress.common)) cards.push([T('dressTitle'),[data.dress.women,data.dress.men,data.dress.common].filter(Boolean).join('\n')]);
    if(data.sections.transport!==false && data.transport) cards.push([T('transportTitle'),data.transport]);
    if(data.sections.accommodation!==false && data.accommodation.text) cards.push([T('accommodationTitle'),data.accommodation.text+(data.accommodation.code?`\n${T('bookingCode')}: ${data.accommodation.code}`:'')]);
    if(data.sections.gifts!==false && data.gifts) cards.push([T('giftsTitle'),data.gifts]);
    if(!cards.length)return '';
    return `<section class="sv-section sv-details" id="sv-details"><div class="sv-section__inner">${headline('',T('suvarnaDetailsTitle'))}<div class="sv-details__grid">${cards.map(([title,text])=>`<details class="sv-detail"><summary>${esc(title)}</summary><p>${esc(text)}</p></details>`).join('')}</div></div></section>`;
  }
  function rsvp() {
    if(data.sections.rsvp===false)return '';
    const deadline=data.rsvp.deadline?T('rsvpBy').replace('{date}',fmtDate(data.rsvp.deadline,'full')):'';
    const closed=data.rsvp.deadline&&Date.now()>C.zonedToUtc(data.rsvp.deadline,'23:59',data.wedding.tz)+60000;
    const preview=['demo','thumb','live','preview'].includes(boot.mode);
    const yes=C.whatsappRsvpLink(data,true,lang),no=C.whatsappRsvpLink(data,false,lang);
    const choices=(closed&&!preview)?`<p class="sv-rsvp__hint">${esc(T('rsvpClosed'))}</p>`:`<p class="sv-rsvp__hint">${esc(T('rsvpWhatsappHint'))}</p><div class="sv-rsvp-actions">${yes&&no?`<a class="sv-button" href="${esc(yes)}" target="_blank" rel="noopener noreferrer">${esc(T('accept'))} ↗</a><a class="sv-button sv-button--outline" href="${esc(no)}" target="_blank" rel="noopener noreferrer">${esc(T('decline'))} ↗</a>`:`<button class="sv-button" type="button" disabled>${esc(T('accept'))}</button><button class="sv-button sv-button--outline" type="button" disabled>${esc(T('decline'))}</button>`}</div>${!yes||!no?`<p class="sv-rsvp__hint">${esc(T('contactFamily'))}</p>`:''}`;
    return `<section class="sv-section sv-rsvp" id="sv-rsvp"><div class="sv-section__inner sv-rsvp__wrap"><div class="sv-rsvp__intro"><p class="sv-kicker">${esc(T('withLove'))}</p><h2 class="sv-section__title">${esc(T('rsvpTitle'))}</h2>${deadline?`<p>${esc(deadline)}</p>`:''}</div><div class="sv-rsvp__compact">${choices}</div></div></section>`;
  }
  function pageMarkup() {
    const pair=coupleNames(),v=data.venue||{},venueName=v.name||'',venueText=[v.address,v.city,v.state,v.pin].filter(Boolean).join(', ');
    const map=venueName||venueText?C.mapsLinks(v):null;
    const welcome=C.fillNames(X('welcome.text'),data,lang), parents=data.couple.showParents?family('groom')+family('bride'):'';
    const hero=`<section class="sv-hero" id="sv-hero" data-scene><figure class="sv-hero__art">${art('sanctum','',true)}</figure>${art('banana-leaves','sv-leaf sv-leaf--left',true)}${art('banana-leaves','sv-leaf sv-leaf--right',true)}${petals()}<div class="sv-hero__copy"><p class="sv-eyebrow">${esc(T('gettingMarried'))}</p><div class="sv-hero__mark" aria-hidden="true">${SEAL}</div><h1 class="sv-hero__names">${pair.map((n,i)=>`${i?'<span class="sv-hero__and">&amp;</span>':''}<span class="sv-hero__name">${esc(n)}</span>`).join('')}</h1><div class="sv-hero__rule"></div><p class="sv-hero__invitation">${esc(T('suvarnaHeroLine'))}</p><p class="sv-hero__facts">${esc(v.city||'')}</p></div><div class="sv-film-bridge" aria-hidden="true">${art('film-end','',true)}</div><a class="sv-scroll" href="#sv-letter">${esc(T('tapToOpen'))}</a></section>`;
    const letter=`<section class="sv-section sv-letter" id="sv-letter">${art('toran','sv-letter__toran')}<div class="sv-letter__paper"><p class="sv-kicker">${esc(T('withLove'))}</p><h2 class="sv-section__title">${esc(T('suvarnaLetterHeading'))}</h2>${flourish()}<p class="sv-letter__body">${esc(welcome)}</p><p class="sv-letter__signature">${pair.map(esc).join(' &amp; ')}</p>${parents?`<aside class="sv-family">${parents}</aside>`:''}</div></section>`;
    const cinema=`<section class="sv-cinema" data-scene aria-label="Ceremonial garden artwork">${art('mandap','sv-cinema__art')}<div class="sv-cinema__copy"><p class="sv-kicker">${esc(T('withLove'))}</p><h2>${esc(T('suvarnaCeremonyHeading'))}</h2>${flourish()}<p>${esc(T('gettingMarried'))}</p></div></section>`;
    const journey=`<section class="sv-section sv-journey" id="sv-events"><div class="sv-section__inner">${headline(T('saveOurDate'),T('timelineTitle'))}${timeline()}</div></section>`;
    const venue=venueName||venueText?`<section class="sv-section sv-venue" id="sv-venue"><div class="sv-section__inner">${headline('',T('venueTitle'))}<div class="sv-venue__layout"><div class="sv-venue__copy"><div class="sv-hero__mark" aria-hidden="true">${SEAL}</div><h3 class="sv-venue__name">${esc(venueName||T('venueTitle'))}</h3><p class="sv-venue__address">${esc(venueText)}</p>${map?`<div class="sv-venue__actions"><a class="sv-button" href="${esc(map.google)}" target="_blank" rel="noopener noreferrer">${esc(T('openInMaps'))} ↗</a><a class="sv-text-link" href="${esc(map.apple)}" target="_blank" rel="noopener noreferrer">Apple Maps ↗</a></div>`:''}</div><div class="sv-venue__tile">${art('mandap')}<span class="sv-tile-label">${esc(T('suvarnaVenueArt'))}</span></div></div></div></section>`:'';
    const reception=data.reception?.enabled ? `<section class="sv-section sv-reception" id="sv-reception"><div class="sv-section__inner">${headline('',T('receptionVenue'))}<div class="sv-reception__card"><h3>${esc(data.reception.name)}</h3><p>${esc([data.reception.address,data.reception.city,data.reception.state,data.reception.pin].filter(Boolean).join(', '))}</p><a class="sv-button" href="${esc(C.mapsLinks(data.reception).google)}" target="_blank" rel="noopener noreferrer">${esc(T('openInMaps'))} ↗</a></div></div></section>`:'';
    const closing=C.fillNames(X('closing'),data,lang);
    const close=`<footer class="sv-footer"><div class="sv-footer__mark" aria-hidden="true">${SEAL}</div><p class="sv-kicker">${esc(T('withLove'))}</p><p class="sv-footer__names">${pair.map(esc).join(' &amp; ')}</p>${closing?`<p class="sv-footer__closing">${esc(closing)}</p>`:''}<a class="sv-text-link" href="#sv-hero">${esc(T('suvarnaBackToTop'))} ↑</a>${boot.openingVideo?`<button type="button" class="sv-text-link" id="sv-replay" style="border:0;background:none">${esc(T('replay'))} ↺</button>`:''}<p class="sv-footer__credit">${esc(T('madeWith'))}</p></footer>`;
    const langSelect=data.lang.enabled.length>1?`<select class="sv-language" id="sv-language" aria-label="${esc(T('language'))}">${data.lang.enabled.map(l=>`<option value="${esc(l)}" ${l===lang?'selected':''}>${esc(I.LANGS[l].native)}</option>`).join('')}</select>`:'';
    const music=data.sections.music!==false&&(data.music.track||data.music.url)?`<button class="sv-music" id="sv-music" type="button" aria-pressed="false" aria-label="${esc(T('musicOn'))}" title="${esc(T('musicOn'))}">♫</button>`:'';
    return `<div class="sv-site ${boot.openingVideo?'has-film':''} ${boot.mode==='preview'?'sv-site--preview':''}" id="sv-site"><header class="sv-nav"><a href="#sv-hero" class="sv-brand">${SEAL}<span>Suvarna Vivah</span></a><nav class="sv-nav__links" aria-label="Invitation sections"><a href="#sv-events">${esc(T('timelineTitle'))}</a>${data.sections.rsvp!==false?`<a href="#sv-rsvp">${esc(T('rsvpTitle'))}</a>`:''}${langSelect}</nav></header><main>${hero}${letter}${dateReveal()}${cinema}${journey}${venue}${reception}${data.sections.photos!==false?photos():''}${detailCards()}${rsvp()}</main>${close}${music}${boot.mode==='preview'?`<div class="sv-preview-badge">${esc(T('previewBadge'))}</div>`:''}<div id="sv-toast" class="sv-toast" role="status" aria-live="polite"></div><dialog class="sv-photo-dialog" id="sv-photo-dialog" aria-label="${esc(T('photosTitle'))}"><button class="sv-photo-dialog__close" type="button">${esc(T('close'))} ×</button><img id="sv-dialog-photo" alt=""><div class="sv-photo-dialog__nav"><button type="button" id="sv-photo-prev" aria-label="${esc(T('previous'))}">←</button><span id="sv-photo-count"></span><button type="button" id="sv-photo-next" aria-label="${esc(T('next'))}">→</button></div></dialog></div>`;
  }
  function render() {
    if(sceneCleanup)sceneCleanup(); if(scratchCleanup)scratchCleanup();
    if(audio){audio.pause();audio=null;}
    mount.innerHTML = pageMarkup();
    window.SVCurrentData = data;
    document.documentElement.lang = lang;
    const L = I.LANGS[lang] || I.LANGS.en; document.documentElement.dir = L.dir;
    const built = C.buildPalette(data.palette); for (const [k,v] of Object.entries(built.vars)) document.documentElement.style.setProperty(k,v);
    const font = C.FONT_BY_ID[data.font] || C.FONTS[0]; const native=C.scriptFontFor(lang); document.documentElement.style.setProperty('--f-script',native?.family||font.script); document.documentElement.style.setProperty('--f-serif',native?.family||font.serif); document.documentElement.classList.toggle('sv-native-script',!!native);
    const themeMeta = document.querySelector('meta[name=theme-color]'); if (themeMeta) themeMeta.content = built.palette.deep;
    const fontLink = document.getElementById('sv-fonts'); if (fontLink) fontLink.href = C.googleFontsHref(data.font, data.lang.enabled)+'&family=Inter:wght@400;500;600';
    bindScratch(); bindCalendar(); bindMusic(); startCountdown(); bindLanguage(); bindScenes(); bindPhotos(); fitNames();
    const replayButton=document.getElementById('sv-replay'); if(replayButton)replayButton.onclick=replay;
    if (!boot.openingVideo || filmOpen) reveal();
    if (!readySent && window.parent !== window) { readySent=true; window.parent.postMessage({ type: 'sp:ready' }, location.origin); }
  }
  function bindScratch() {
    const box=document.getElementById('sv-date-reveal'),canvas=document.getElementById('sv-scratch'),button=document.getElementById('sv-reveal-date');
    if(!box||!canvas||!button)return;
    const ctx=canvas.getContext('2d'),calendar=document.getElementById('sv-calendar');
    let drawing=false,last=null,revealed=false,progress=0,rect;
    const expose=(focus=false)=>{if(revealed)return;revealed=true;box.classList.add('is-revealed');canvas.style.pointerEvents='none';calendar.removeAttribute('tabindex');const under=box.querySelector('.sv-date-reveal__under');under.inert=false;under.removeAttribute('aria-hidden');button.setAttribute('aria-expanded','true');if(focus)calendar.focus({preventScroll:true});};
    if(!ctx){expose();return;}
    const paint=()=>{
      if(revealed)return;rect=canvas.getBoundingClientRect();if(!rect.width)return;
      const dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalCompositeOperation='source-over';
      const w=rect.width,h=rect.height,cx=w/2,cy=h/2;
      const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#b6893b');g.addColorStop(.27,'#f5d482');g.addColorStop(.51,'#dfb158');g.addColorStop(.7,'#f7d98f');g.addColorStop(1,'#a77b35');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
      ctx.strokeStyle='#805d2f77';ctx.lineWidth=.7;
      for(const r of [.44,.42,.3]){ctx.beginPath();ctx.arc(cx,cy,w*r,0,Math.PI*2);ctx.stroke();}
      for(let i=0;i<24;i++){const a=i*Math.PI/12;ctx.save();ctx.translate(cx,cy);ctx.rotate(a);ctx.beginPath();ctx.ellipse(w*.36,0,w*.045,w*.014,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#5b401e';ctx.font=`400 ${Math.max(25,w*.095)}px Georgia,serif`;ctx.fillText('✦',cx,cy-32);ctx.font=`500 ${Math.max(10,w*.039)}px system-ui,sans-serif`;ctx.fillText(T('scratchTitle'),cx,cy+2,w*.72);progress=0;
    };
    paint(); const observer=new ResizeObserver(paint);observer.observe(canvas);scratchCleanup=()=>observer.disconnect();
    const point=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
    canvas.addEventListener('pointerdown',e=>{drawing=true;last=point(e);canvas.setPointerCapture(e.pointerId);e.preventDefault();});
    canvas.addEventListener('pointermove',e=>{if(!drawing||revealed)return;const q=point(e);ctx.globalCompositeOperation='destination-out';ctx.lineWidth=42;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(q.x,q.y);ctx.stroke();progress+=Math.hypot(q.x-last.x,q.y-last.y);last=q;if(progress>Math.max(350,rect.width*2.1))expose();});
    const stop=()=>{drawing=false;last=null;};canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);button.onclick=()=>expose(true);
  }
  function fitNames(){
    const fit=()=>{for(const el of document.querySelectorAll('.sv-hero__name')){el.style.fontSize='';el.style.maxWidth='none';el.style.whiteSpace='nowrap';const max=el.parentElement.clientWidth;const size=parseFloat(getComputedStyle(el).fontSize),width=el.getBoundingClientRect().width;el.style.fontSize=Math.max(26,Math.min(size,size*max/Math.max(1,width)*.98))+'px';el.style.maxWidth='100%';el.style.whiteSpace='normal';}};
    fit();document.fonts?.ready.then(fit);
  }
  function bindScenes(){
    const reduce=matchMedia('(prefers-reduced-motion: reduce)');let frame=0;
    const update=()=>{frame=0;if(reduce.matches)return;for(const el of document.querySelectorAll('[data-scene]')){const r=el.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)continue;const p=Math.max(-1,Math.min(1,-r.top/Math.max(1,r.height)));el.style.setProperty('--scene',p.toFixed(3));}};
    const request=()=>{if(!frame)frame=requestAnimationFrame(update);};window.addEventListener('scroll',request,{passive:true});window.addEventListener('resize',request);request();
    sceneCleanup=()=>{window.removeEventListener('scroll',request);window.removeEventListener('resize',request);cancelAnimationFrame(frame);};
  }
  function bindPhotos(){
    const dialog=document.getElementById('sv-photo-dialog'),img=document.getElementById('sv-dialog-photo');let opener=null;
    const show=i=>{const list=currentPhotos();if(!list.length)return;activePhoto=(i+list.length)%list.length;img.src=list[activePhoto].url;img.alt=list[activePhoto].alt||T('photosTitle');document.getElementById('sv-photo-count').textContent=`${activePhoto+1} / ${list.length}`;};
    document.querySelectorAll('[data-photo]').forEach(b=>b.onclick=()=>{opener=b;show(Number(b.dataset.photo));dialog.showModal();});
    dialog.querySelector('.sv-photo-dialog__close').onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>opener?.focus({preventScroll:true}));
    document.getElementById('sv-photo-prev').onclick=()=>show(activePhoto-1);document.getElementById('sv-photo-next').onclick=()=>show(activePhoto+1);
    dialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')show(activePhoto-1);if(e.key==='ArrowRight')show(activePhoto+1);});
  }
  function bindCalendar() {
    const b = document.getElementById('sv-calendar'); if (!b) return;
    b.onclick = e => { e.preventDefault(); const href = URL.createObjectURL(new Blob([C.icsFor(data,lang,boot.url)], {type:'text/calendar;charset=utf-8'})); const a=document.createElement('a'); a.href=href; a.download=`${C.slugify(coupleNames().join('-'))||'wedding'}.ics`; a.click(); setTimeout(()=>URL.revokeObjectURL(href),1200); };
  }
  function bindLanguage() { const s=document.getElementById('sv-language'); if(s) s.onchange=()=>{const dateOpen=document.getElementById('sv-date-reveal')?.classList.contains('is-revealed');lang=s.value;render();if(dateOpen)document.getElementById('sv-reveal-date')?.click();document.getElementById('sv-language')?.focus({preventScroll:true});}; }
  function bindMusic(){
    const b=document.getElementById('sv-music');if(!b)return;
    const src=data.music.track==='upload'&&data.music.url?data.music.url:`/shaadi-paigaam/music/${encodeURIComponent(data.music.track||'shehnai-dawn')}.mp3`;
    if(audio){audio.pause();audio=null;}
    audio=new Audio();audio.loop=true;audio.preload='none';
    b.onclick=()=>{if(audio.paused){if(!audio.getAttribute('src'))audio.src=src;audio.play().then(()=>{b.setAttribute('aria-pressed','true');b.textContent='Ⅱ';b.setAttribute('aria-label',T('musicOff'));b.title=T('musicOff');}).catch(()=>{b.textContent=T('errGeneric');});}else{audio.pause();b.setAttribute('aria-pressed','false');b.textContent='♫';b.setAttribute('aria-label',T('musicOn'));b.title=T('musicOn');}};
  }
  function startCountdown(){
    if(countdownTimer)clearInterval(countdownTimer);
    const box=document.querySelector('[data-sv-countdown]');if(!box||!data.wedding.date)return;
    const tick=()=>{const target=C.zonedToUtc(data.wedding.date,data.wedding.time||'00:00',data.wedding.tz);if(target<Date.now()){box.innerHTML=`<p class="sv-countdown__ended">${esc(I.t(lang,'married'))}</p>`;clearInterval(countdownTimer);return;}let s=Math.max(0,Math.floor((target-Date.now())/1000));const vals={d:Math.floor(s/86400)};s%=86400;vals.h=Math.floor(s/3600);s%=3600;vals.m=Math.floor(s/60);vals.s=s%60;for(const [k,v] of Object.entries(vals)){const el=box.querySelector(`[data-unit="${k}"]`);if(el)el.textContent=C.fmtNum(v,lang);}};
    tick();countdownTimer=setInterval(tick,1000);
  }
  function toast(msg){const el=document.getElementById('sv-toast');if(!el)return;el.textContent=msg;el.classList.add('is-visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('is-visible'),3800);}
  function reveal(){
    const first=!filmOpen;filmOpen=true;const site=document.getElementById('sv-site');
    if(site){site.classList.add('is-revealed');if(first&&boot.openingVideo){site.classList.add('is-transitioning');const bridge=site.querySelector('.sv-film-bridge');bridge?.addEventListener('animationend',()=>site.classList.remove('is-transitioning'),{once:true});}}
    document.body.classList.remove('sv-lock');document.documentElement.classList.remove('sv-lock');
  }
  function openInvitation(){reveal();window.SVOpening?.close();}
  function replay(){
    if(boot.openingVideo&&window.SVOpening){filmOpen=false;const site=document.getElementById('sv-site');site?.classList.remove('is-revealed','is-transitioning');window.scrollTo({top:0,behavior:'instant'});window.SVOpening.show();return;}
    window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  function go(id){const map={hero:'sv-hero',welcome:'sv-letter',timeline:'sv-events',venue:'sv-venue',photos:'sv-gallery'};const el=document.getElementById(map[id]||id);if(el)el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
  window.SPInvite={open:openInvitation,reveal,replay,setLang:l=>{if(I.LANGS[l]){lang=l;render();}},go};
  window.addEventListener('message',e=>{
    if(e.origin!==location.origin||e.source!==window.parent||!e.data)return;
    if(e.data.type==='sp:data'&&e.data.data){const y=window.scrollY;data=C.validate(e.data.data,{allowPast:true}).data;if(e.data.lang&&I.LANGS[e.data.lang])lang=e.data.lang;else if(!data.lang.enabled.includes(lang))lang=data.lang.default;render();const opener=document.getElementById('svOpenerNames');if(opener)opener.textContent=coupleNames().join(' & ');if(e.data.focus)go(e.data.focus);else window.scrollTo(0,y);}
    else if(e.data.type==='sp:replay')replay();
    else if(e.data.type==='sp:open')openInvitation();
    else if(e.data.type==='sp:lang'&&e.data.lang)window.SPInvite.setLang(e.data.lang);
    else if(e.data.type==='sp:go')go(e.data.id);
    else if(e.data.type==='sp:revealAll'){openInvitation();document.getElementById('sv-reveal-date')?.click();}
  });
  render();
  if(boot.autoOpen)reveal();
})();
