/* Suvarna Vivah — original wedding invitation experience, backed by Shaadi's shared data schema. */
(() => {
  'use strict';
  const C = window.SPCore, I = window.SPI18N;
  const bootEl = document.getElementById('sp-boot'), mount = document.getElementById('sv-app');
  if (!C || !I || !bootEl || !mount) return;
  let boot; try { boot = JSON.parse(bootEl.textContent || '{}'); } catch { return; }
  let data = C.validate(boot.data || C.SAMPLE, { allowPast: true }).data;
  let lang = boot.lang || data.lang.default || 'en', countdownTimer = 0, toastTimer = 0, audio = null;
  const SEAL = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3c1.2 3.1 3.6 4.5 5.6 6.2-1.2 4.4-2.9 7.2-5.6 9.6-2.7-2.4-4.4-5.2-5.6-9.6C8.4 7.5 10.8 6.1 12 3Z" stroke="currentColor" stroke-width="1"/><path d="M8 11h8M9.5 15.5h5M10 20h4" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = k => I.t(lang, k);
  const pageOpened = Date.now();
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
    const p = data.couple[side] || {}, who = C.parentLine(data, lang, side);
    return who ? `<div class="sv-family__side"><span class="sv-family__names">${esc(who)}</span></div>` : '';
  };
  function eventCard(ev, n) {
    const time = [fmtTime(ev.start), ev.end ? fmtTime(ev.end) : ''].filter(Boolean).join(' – ');
    const venue = [ev.venue, ev.address].filter(Boolean).join(' · ');
    return `<article class="sv-event"><span class="sv-event__time">${esc(time || eventTime(ev))}</span><h3 class="sv-event__name">${esc(eventLabel(ev))}</h3>${venue ? `<p class="sv-event__venue">${esc(venue)}</p>` : ''}${ev.note ? `<p class="sv-event__note">${esc(C.txt(data, lang, `events.${ev.id}.note`) || ev.note)}</p>` : ''}</article>`;
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
  function photos() {
    const real = (data.photos || []).filter(p => p.url && !/\/art\/demo-/.test(p.url));
    if (data.couplePhoto && data.couplePhoto.url && !real.some(p => p.url === data.couplePhoto.url)) real.unshift({ ...data.couplePhoto, alt: 'A photograph of the couple' });
    if (!real.length) return '';
    return `<section class="sv-section sv-gallery" id="sv-gallery"><div class="sv-section__inner"><div class="sv-section__head"><span class="sv-section__index">04</span><div><p class="sv-kicker">${esc(T('photosTitle'))}</p><h2 class="sv-section__title">${esc(T('suvarnaGalleryTitle'))}</h2></div></div><div class="sv-gallery__grid">${real.slice(0, C.LIMITS.photos).map((p, i) => `<figure class="sv-gallery__item"><img src="${esc(p.url)}" alt="${esc(p.alt || `${T('photosTitle')} ${i + 1}`)}" style="object-position:${Math.max(0,Math.min(100,Number(p.fx)||50))}% ${Math.max(0,Math.min(100,Number(p.fy)||50))}%" loading="lazy"><figcaption>${esc(p.alt || T('photosTitle'))}</figcaption></figure>`).join('')}</div></div></section>`;
  }
  function detailCards() {
    const cards = [];
    if (data.sections.dressCode !== false && (data.dress.women || data.dress.men || data.dress.common)) cards.push(['01', T('dressTitle'), [data.dress.women, data.dress.men, data.dress.common].filter(Boolean).join('\n')]);
    if (data.sections.transport !== false && data.transport) cards.push(['02', T('transportTitle'), data.transport]);
    if (data.sections.accommodation !== false && data.accommodation.text) cards.push(['03', T('accommodationTitle'), data.accommodation.text + (data.accommodation.code ? `\n${T('bookingCode')}: ${data.accommodation.code}` : '')]);
    if (data.sections.gifts !== false && data.gifts) cards.push(['04', T('giftsTitle'), data.gifts]);
    if (!cards.length) return '';
    return `<section class="sv-section sv-details" id="sv-details"><div class="sv-section__inner"><div class="sv-section__head"><span class="sv-section__index">05</span><div><h2 class="sv-section__title">${esc(T('suvarnaDetailsTitle'))}</h2></div></div><div class="sv-details__grid">${cards.map(([n, title, text]) => `<article class="sv-detail"><span class="sv-detail__index">${n}</span><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`).join('')}</div></div></section>`;
  }
  function rsvp() {
    if (data.sections.rsvp === false) return '';
    const deadline = data.rsvp.deadline ? T('rsvpBy').replace('{date}', fmtDate(data.rsvp.deadline, 'full')) : '';
    const meals = data.rsvp.meal && data.rsvp.mealOptions.length ? `<div class="sv-field"><label for="sv-meal">${esc(T('meal'))}</label><select id="sv-meal"><option value="">${esc(T('select'))}</option>${data.rsvp.mealOptions.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select></div>` : '';
    return `<section class="sv-section sv-rsvp" id="sv-rsvp"><div class="sv-section__inner sv-rsvp__wrap"><div class="sv-rsvp__intro"><span class="sv-kicker">${esc(T('withLove'))}</span><h2 class="sv-section__title">${esc(T('rsvpTitle'))}</h2>${deadline ? `<p>${esc(deadline)}</p>` : ''}</div><form class="sv-rsvp__form" id="sv-rsvp-form" novalidate>
      <div class="sv-field"><label for="sv-name">${esc(T('yourName'))}</label><input id="sv-name" name="name" autocomplete="name" maxlength="60" required placeholder="${esc(T('yourNamePh'))}"></div>
      <div class="sv-field"><label for="sv-email">${esc(T('email'))}</label><input id="sv-email" name="email" type="email" autocomplete="email" maxlength="120" placeholder="${esc(T('emailPh'))}"></div>
      <div class="sv-field"><label for="sv-phone">${esc(T('phone'))}</label><input id="sv-phone" name="phone" type="tel" autocomplete="tel" maxlength="24" placeholder="${esc(T('phonePh'))}"></div>
      <div class="sv-field"><span class="sv-label">${esc(T('attending'))}</span><div class="sv-choice"><label><input type="radio" name="attending" value="yes" required> ${esc(T('accept'))}</label><label><input type="radio" name="attending" value="no"> ${esc(T('decline'))}</label></div></div>
      <div class="sv-field"><label for="sv-guests">${esc(T('guests'))}</label><select id="sv-guests" name="guests">${Array.from({length:Math.max(1,Math.min(8,data.rsvp.maxGuests||4))},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}</select></div>
      ${meals}
      <div class="sv-field sv-field--full"><label for="sv-message">${esc(T('message'))}</label><textarea id="sv-message" name="message" maxlength="500" placeholder="${esc(T('messagePh'))}"></textarea></div>
      <input name="website" class="sv-sr" tabindex="-1" autocomplete="off" aria-hidden="true">
      <button class="sv-button" type="submit">${esc(T('send'))}</button>
      <p id="sv-rsvp-status" class="sv-rsvp__status" role="status" aria-live="polite"></p>
      ${boot.mode === 'demo' || boot.mode === 'thumb' || !boot.rsvpUrl ? `<p class="sv-rsvp__hint">${esc(T('suvarnaPreviewRsvp'))}</p>` : ''}
    </form></div></section>`;
  }
  function pageMarkup() {
    const pair = coupleNames(), date = fmtDate(data.wedding.date, 'full'), time = fmtTime(data.wedding.time);
    const weddingEv = data.events.find(e => e.main) || data.events.find(e => e.type === 'wedding') || null;
    const v = data.venue || {}, venueName = v.name || (weddingEv && weddingEv.venue) || '';
    const venueText = [v.address, v.city, v.state, v.pin].filter(Boolean).join(', ');
    const map = v.name || v.address || v.city ? C.mapsLinks(v) : null;
    const welcome = C.fillNames(X('welcome.text'), data, lang);
    const parentData = data.couple.showParents ? family('groom') + family('bride') : '';
    const photoSection = data.sections.photos === false ? '' : photos();
    const dIndex = (data.sections.preWedding !== false && C.schedule(data).pre.length) ? '02' : '02';
    const heroMeta = [date, time, v.city].filter(Boolean);
    const hero = `<section class="sv-hero" id="sv-hero"><div class="sv-hero__copy"><p class="sv-eyebrow">${esc(T('gettingMarried'))}</p><div class="sv-hero__mark">${SEAL}</div><h1 class="sv-hero__names">${pair.map((n,i)=>`${i ? '<span class="sv-hero__and">&amp;</span>' : ''}<span class="sv-hero__name">${esc(n)}</span>`).join('')}</h1><div class="sv-hero__facts">${heroMeta.map((x,i)=>`${i ? '<i class="dot"></i>' : ''}<span>${esc(x)}</span>`).join('')}</div><div class="sv-hero__actions"><a class="sv-button" href="#sv-events">${esc(T('timelineTitle'))} <span aria-hidden="true">↘</span></a><a class="sv-text-link" href="#sv-rsvp">${esc(T('rsvpTitle'))} <span aria-hidden="true">↗</span></a></div></div><figure class="sv-hero__art"><img src="/suvarna-vivah/ceremony-still-life.webp" alt="${esc(T('suvarnaArtAlt'))}" fetchpriority="high"></figure><a class="sv-scroll" href="#sv-letter" aria-label="${esc(T('timelineTitle'))}">${esc(T('timelineTitle'))}</a></section>`;
    const letter = `<section class="sv-section sv-letter" id="sv-letter"><div class="sv-section__inner sv-letter__grid"><div><div class="sv-section__head"><span class="sv-section__index">01</span><div><p class="sv-kicker">${esc(T('withLove'))}</p><h2 class="sv-section__title">${esc(T('suvarnaLetterTitle'))}</h2></div></div><p class="sv-letter__body">${esc(welcome)}</p><p class="sv-letter__signature">${esc(T('withLove'))}</p><div class="sv-calendar"><a class="sv-button" href="#" id="sv-calendar">${esc(T('saveTheDate'))} <span aria-hidden="true">↗</span></a></div></div>${parentData ? `<aside class="sv-family">${parentData}</aside>` : ''}</div></section>`;
    const journey = `<section class="sv-section sv-journey" id="sv-events"><div class="sv-section__inner"><div class="sv-section__head"><span class="sv-section__index">${dIndex}</span><div><h2 class="sv-section__title">${esc(T('timelineTitle'))}</h2></div></div>${timeline()}</div></section>`;
    const venue = venueName || venueText ? `<section class="sv-section sv-venue" id="sv-venue"><div class="sv-section__inner"><div class="sv-section__head"><span class="sv-section__index">03</span><div><p class="sv-kicker">${esc(T('openInMaps'))}</p><h2 class="sv-section__title">${esc(T('venueTitle'))}</h2></div></div><div class="sv-venue__layout"><div><span class="sv-venue__number">01</span><h3 class="sv-venue__name">${esc(venueName || T('venueTitle'))}</h3><p class="sv-venue__address">${esc(venueText || [v.name, v.city].filter(Boolean).join(', '))}${v.pin ? ` · ${esc(v.pin)}` : ''}</p>${map ? `<div class="sv-venue__actions"><a class="sv-button" href="${esc(map.google)}" target="_blank" rel="noopener noreferrer">${esc(T('openInMaps'))} <span aria-hidden="true">↗</span></a><a class="sv-text-link" href="${esc(map.apple)}" target="_blank" rel="noopener noreferrer">Apple Maps</a></div>` : ''}</div><div class="sv-venue__tile" aria-hidden="true"><svg class="sv-venue__route" viewBox="0 0 440 300" fill="none"><path d="M-20 256c81-8 87-96 168-96s81 91 164 59 57-128 146-127" stroke="currentColor" stroke-opacity=".38" stroke-width="1" stroke-dasharray="3 7"/><path d="M-12 278c83-13 101-108 179-105s92 76 163 40 70-122 139-127" stroke="currentColor" stroke-opacity=".22" stroke-width="1"/><circle cx="311" cy="118" r="25" stroke="currentColor" stroke-width="1"/><circle cx="311" cy="118" r="4" fill="currentColor"/></svg><span class="sv-tile-label">${esc([v.city, v.state].filter(Boolean).join(' · ') || T('venueTitle'))}</span></div></div></div></section>` : '';
    const gallery = photoSection;
    const details = detailCards();
    const close = `<footer class="sv-footer"><div class="sv-footer__mark">${SEAL}</div><p class="sv-kicker">${esc(T('withLove'))}</p><p class="sv-footer__names">${pair.map(esc).join(' &amp; ')}</p><p class="sv-footer__signoff">${esc(T('madeWith'))}</p><a class="sv-text-link" href="#sv-hero" aria-label="${esc(T('suvarnaBackToTop'))}">${esc(T('suvarnaBackToTop'))} ↑</a><span class="sv-footer__credit">${esc(T('madeWith'))}</span></footer>`;
    const langSelect = data.lang.enabled.length > 1 ? `<select class="sv-language" id="sv-language" aria-label="${esc(T('language'))}">${data.lang.enabled.map(l=>`<option value="${esc(l)}" ${l===lang?'selected':''}>${esc(I.LANGS[l].native)}</option>`).join('')}</select>` : '';
    const music = data.sections.music !== false && (data.music.track || data.music.url) ? `<button class="sv-music" id="sv-music" type="button" aria-pressed="false">${esc(T('musicOn'))}</button>` : '';
    return `<div class="sv-site ${boot.mode==='preview'?'sv-site--preview':''}" id="sv-site"><header class="sv-nav"><a href="#sv-hero" class="sv-brand"><span class="sv-brand__seal">${SEAL}</span><span>Suvarna Vivah</span></a><nav class="sv-nav__links" aria-label="Invitation sections"><a href="#sv-events">${esc(T('timelineTitle'))}</a>${venue ? `<a href="#sv-venue">${esc(T('venueTitle'))}</a>` : ''}<a href="#sv-rsvp">${esc(T('rsvpTitle'))}</a>${langSelect}</nav></header><main>${hero}${letter}${journey}${venue}${gallery}${details}${rsvp()}</main>${close}${music}${boot.mode==='preview'?`<div class="sv-preview-badge">${esc(T('previewBadge'))}</div>`:''}<div id="sv-toast" class="sv-toast" role="status" aria-live="polite"></div></div>`;
  }
  function render() {
    mount.innerHTML = pageMarkup();
    document.documentElement.lang = lang;
    const L = I.LANGS[lang] || I.LANGS.en; document.documentElement.dir = L.dir;
    const built = C.buildPalette(data.palette); for (const [k,v] of Object.entries(built.vars)) document.documentElement.style.setProperty(k,v);
    const font = C.FONT_BY_ID[data.font] || C.FONTS[0]; document.documentElement.style.setProperty('--f-script',font.script); document.documentElement.style.setProperty('--f-serif',font.serif);
    const themeMeta = document.querySelector('meta[name=theme-color]'); if (themeMeta) themeMeta.content = built.palette.deep;
    const fontLink = document.getElementById('sv-fonts'); if (fontLink) fontLink.href = C.googleFontsHref(data.font, data.lang.enabled);
    bindCalendar(); bindRsvp(); bindMusic(); startCountdown(); bindLanguage();
    if (!boot.openingVideo) reveal();
    if (boot.mode === 'live' && window.parent !== window) window.parent.postMessage({ type: 'sp:ready' }, location.origin);
  }
  function bindCalendar() {
    const b = document.getElementById('sv-calendar'); if (!b) return;
    b.onclick = e => { e.preventDefault(); const href = URL.createObjectURL(new Blob([C.icsFor(data,lang,boot.url)], {type:'text/calendar;charset=utf-8'})); const a=document.createElement('a'); a.href=href; a.download=`${C.slugify(coupleNames().join('-'))||'wedding'}.ics`; a.click(); setTimeout(()=>URL.revokeObjectURL(href),1200); };
  }
  function bindLanguage() { const s=document.getElementById('sv-language'); if(s) s.onchange=()=>{lang=s.value;render();}; }
  function bindRsvp() {
    const form=document.getElementById('sv-rsvp-form'); if(!form)return;
    const status=document.getElementById('sv-rsvp-status');
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      if(!form.reportValidity())return;
      if(!boot.rsvpUrl){status.textContent=boot.mode==='demo'||boot.mode==='thumb'?T('suvarnaPreviewRsvp'):T('errGeneric');return;}
      const b=e.submitter; if(b){b.disabled=true;b.textContent=T('sending');}
      const attending=new FormData(form).get('attending');
      const payload={name:form.elements.name.value,email:form.elements.email.value,phone:form.elements.phone.value,attending,guests:Number(form.elements.guests.value)||1,meal:document.getElementById('sv-meal')?.value||'',message:document.getElementById('sv-message')?.value||'',website:form.elements.website.value,lang,t:Date.now()-pageOpened};
      try{
        let r=await fetch(boot.rsvpUrl,{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify(payload)});
        let j=await r.json().catch(()=>({}));
        if(r.status===409){if(window.confirm(T('duplicate'))){payload.confirmUpdate=true;r=await fetch(boot.rsvpUrl,{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify(payload)});j=await r.json().catch(()=>({}));}else{status.textContent=T('duplicate');if(b){b.disabled=false;b.textContent=T('send');}return;}}
        if(!r.ok||!j.ok)throw new Error(j.error||'error');
        form.innerHTML=`<div class="sv-rsvp__status" role="status">${esc(T(attending==='yes'?'thanksYes':'thanksNo'))}</div>`;
      }catch{status.textContent=T('errGeneric');if(b){b.disabled=false;b.textContent=T('send');}}
    });
  }
  function bindMusic(){
    const b=document.getElementById('sv-music');if(!b)return;
    const src=data.music.track==='upload'&&data.music.url?data.music.url:`/shaadi-paigaam/music/${encodeURIComponent(data.music.track||'shehnai-dawn')}.mp3`;
    if(audio){audio.pause();audio=null;}
    audio=new Audio(src);audio.loop=true;audio.preload='none';
    b.onclick=()=>{if(audio.paused){audio.play().then(()=>{b.setAttribute('aria-pressed','true');b.textContent=T('musicOff');}).catch(()=>{b.textContent=T('errGeneric');});}else{audio.pause();b.setAttribute('aria-pressed','false');b.textContent=T('musicOn');}};
  }
  function startCountdown(){
    if(countdownTimer)clearInterval(countdownTimer);
    const box=document.querySelector('[data-sv-countdown]');if(!box||!data.wedding.date)return;
    const tick=()=>{const target=C.zonedToUtc(data.wedding.date,data.wedding.time||'00:00',data.wedding.tz);let s=Math.max(0,Math.floor((target-Date.now())/1000));const vals={d:Math.floor(s/86400)};s%=86400;vals.h=Math.floor(s/3600);s%=3600;vals.m=Math.floor(s/60);vals.s=s%60;for(const [k,v] of Object.entries(vals)){const el=box.querySelector(`[data-unit="${k}"]`);if(el)el.textContent=C.fmtNum(v,lang);}};
    tick();countdownTimer=setInterval(tick,1000);
  }
  function toast(msg){const el=document.getElementById('sv-toast');if(!el)return;el.textContent=msg;el.classList.add('is-visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('is-visible'),3800);}
  function reveal(){const site=document.getElementById('sv-site');if(site)site.classList.add('is-revealed');document.body.classList.remove('sv-lock');document.documentElement.classList.remove('sv-lock');}
  function replay(){if(boot.openingVideo){location.reload();return;}window.scrollTo({top:0,behavior:'smooth'});}
  function go(id){const map={hero:'sv-hero',welcome:'sv-letter',timeline:'sv-events',venue:'sv-venue',photos:'sv-gallery'};const el=document.getElementById(map[id]||id);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});}
  window.SPInvite={open:reveal,reveal,replay,setLang:l=>{if(I.LANGS[l]){lang=l;render();}},go};
  window.addEventListener('message',e=>{
    if(e.origin!==location.origin||!e.data)return;
    if(e.data.type==='sp:data'&&e.data.data){const y=window.scrollY;data=C.validate(e.data.data,{allowPast:true}).data;if(e.data.lang&&I.LANGS[e.data.lang])lang=e.data.lang;else if(!data.lang.enabled.includes(lang))lang=data.lang.default;render();const opener=document.getElementById('svOpenerNames');if(opener)opener.textContent=coupleNames().join(' & ');if(e.data.focus)go(e.data.focus);else window.scrollTo(0,y);}
    else if(e.data.type==='sp:replay')replay();
    else if(e.data.type==='sp:open')reveal();
    else if(e.data.type==='sp:lang'&&e.data.lang)window.SPInvite.setLang(e.data.lang);
    else if(e.data.type==='sp:go')go(e.data.id);
    else if(e.data.type==='sp:revealAll')document.querySelectorAll('.sv-section').forEach(x=>x.classList.add('is-revealed'));
  });
  render();
  if(boot.autoOpen)reveal();
})();
