/* Kadali Vivah — original ceremonial wedding website.
 * Shared functional foundation: Paigaam wedding schema and invitation mechanics.
 * Renders the whole invitation from one validated data object (core.validate),
 * so the published page, the demo and the editor's live preview are the same code.
 * Modes: guest (published) · demo · preview (owner, badge) · live (editor iframe) · thumb. */
(function () {
  'use strict';
  const C = window.SPCore, I = window.SPI18N, ART = window.SPArt;
  const bootEl = document.getElementById('sp-boot');
  const cfg = JSON.parse(bootEl ? bootEl.textContent : '{}');
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const live = cfg.mode === 'live', thumb = cfg.mode === 'thumb';
  let data = C.validate(cfg.data || C.SAMPLE, { allowPast: true }).data;
  let lang = pickLang();
  let scratched = false, introDone = false, countdownTimer = 0, carTimers = [], observer = null;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = k => I.t(lang, k);
  const dateLabels = {
    en: ['Unfold our date', 'Fold date closed'], hi: ['तारीख़ खोलें', 'तारीख़ बंद करें'],
    mr: ['तारीख उघडा', 'तारीख बंद करा'], gu: ['તારીખ ખોલો', 'તારીખ બંધ કરો'],
    ta: ['தேதியைத் திறக்கவும்', 'தேதியை மூடவும்'], te: ['తేదీని తెరవండి', 'తేదీని మూసివేయండి'],
    ur: ['تاریخ کھولیں', 'تاریخ بند کریں'], ar: ['اكشفوا الموعد', 'أغلقوا الموعد']
  };
  const dateLabel = () => (dateLabels[lang] || dateLabels.en)[scratched ? 1 : 0];
  const X = path => C.txt(data, lang, path);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function pickLang() {
    const en = data.lang.enabled;
    try { const saved = localStorage.getItem('sp-lang-' + (cfg.slug || cfg.id || 'demo')); if (saved && en.includes(saved)) return saved; } catch {}
    const q = new URLSearchParams(location.search).get('lang');
    if (q && en.includes(q)) return q;
    return data.lang.default;
  }

  /* =========================================================== theme */
  function applyTheme() {
    const built = C.buildPalette(data.palette);
    const root = document.documentElement;
    for (const [k, v] of Object.entries(built.vars)) root.style.setProperty(k, v);
    const f = C.FONT_BY_ID[data.font] || C.FONTS[0];
    const sf = C.scriptFontFor(lang);
    root.style.setProperty('--f-script', f.script);
    root.style.setProperty('--f-serif', f.serif + (sf ? ',' + sf.family : ''));
    root.style.setProperty('--f-script-fallback', sf ? sf.family : 'serif');
    root.style.setProperty('--f-script-scale', sf ? 1 : f.scriptScale);
    root.style.setProperty('--f-script-style', f.scriptStyle || 'normal');
    root.style.setProperty('--f-amp', f.amp || f.script);
    root.style.setProperty('--f-amp-style', f.ampStyle || f.scriptStyle || 'normal');
    root.style.setProperty('--f-script-case', f.scriptUpper ? 'uppercase' : 'none');
    root.style.setProperty('--f-script-track', f.scriptUpper ? '.08em' : '0');
    root.classList.toggle('dark-bg', built.palette.dark);
    root.classList.toggle('dark-scene', built.palette.dark);
    let link = document.getElementById('sp-fonts');
    const href = C.googleFontsHref(data.font, data.lang.enabled);
    if (!link) { link = document.createElement('link'); link.id = 'sp-fonts'; link.rel = 'stylesheet'; document.head.appendChild(link); }
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
    const L = I.LANGS[lang];
    root.lang = lang; root.dir = L.dir; root.dataset.script = lang === 'mr' ? 'deva' : L.script;
    const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = built.palette.primary;
  }

  /* Layered leaf parcel, an interactive scene rather than a video player. */
  let openingTimers = [], openingActive = false;
  const later = (fn, ms) => { const id = setTimeout(fn, ms); openingTimers.push(id); return id; };
  function clearOpening() { openingTimers.forEach(clearTimeout); openingTimers = []; }
  const petals = () => Array.from({length: 18}, (_, i) => `<i style="--i:${i};--x:${(i * 37 + 13) % 100}%;--r:${i * 23}deg"></i>`).join('');
  function shell(force) {
    clearOpening(); openingActive = false;
    const withIntro = force || (!live && !thumb && !cfg.autoOpen);
    document.body.classList.toggle('locked', !!withIntro);
    document.documentElement.classList.toggle('intro-on', !!withIntro);
    document.body.innerHTML = `
${withIntro ? `<div class="kv-opening" id="intro" role="dialog" aria-modal="true" aria-label="${esc(T('tapToOpen'))}">
  <div class="kv-ambience" aria-hidden="true"></div>
  <div class="kv-opening-caption"><span>PAIGAAM · KADALI VIVAH</span><p id="openingNames"></p></div>
  <div class="kv-ritual" aria-hidden="true"><img src="/kadali-vivah/art/kalash.webp" alt=""><div class="kv-halo"></div></div>
  <div class="kv-parcel" id="leafParcel" aria-hidden="true">
    <div class="kv-leaf kv-leaf-base"></div>
    <div class="kv-leaf kv-leaf-top"></div><div class="kv-leaf kv-leaf-bottom"></div>
    <div class="kv-leaf kv-leaf-left"></div><div class="kv-leaf kv-leaf-right"></div>
    <div class="kv-cord"><span class="kv-string"></span><svg viewBox="0 0 240 180" class="kv-bow"><defs><filter id="cord-shadow"><feDropShadow dx="1" dy="3" stdDeviation="2" flood-opacity=".5"/></filter><linearGradient id="gold-cord"><stop stop-color="#7d4c12"/><stop offset=".35" stop-color="#ffe4a0"/><stop offset=".6" stop-color="#c49a3d"/><stop offset="1" stop-color="#f7d687"/></linearGradient></defs><g fill="none" stroke="url(#gold-cord)" stroke-width="4" stroke-linecap="round" filter="url(#cord-shadow)"><path d="M120 74C30 76 34 6 75 25S119 81 120 74C135 0 195 8 186 45S132 79 120 74"/><path d="M120 74Q85 97 67 158M120 74Q148 109 165 158"/><path d="M113 72q9-9 17 3q-6 12-17 2z"/></g><g stroke="#d8ac52" stroke-width="2"><path d="M67 151l-9 21m11-20-2 22m3-22 6 21M164 151l-5 21m7-20 3 22m-1-22 11 19"/></g></svg></div>
  </div>
  <div class="kv-light" aria-hidden="true"></div><div class="kv-petals" aria-hidden="true">${petals()}</div>
  <div class="kv-open-controls"><button type="button" id="openBtn" class="kv-open-btn">${esc(T('tapToOpen'))}<span aria-hidden="true"> ↗</span></button><p id="openingStatus" role="status" aria-live="polite">A little blessing, wrapped with love.</p></div>
  <button type="button" id="skipBtn" class="kv-skip">Skip opening</button>
</div>` : ''}
<div class="page" id="page" ${withIntro ? 'inert' : ''}>
  <nav class="kv-nav"><a href="#hero" class="kv-monogram" id="navNames"></a><div><a href="#s-timeline">${esc(T('timelineTitle'))}</a><a href="#s-venue">${esc(T('venueTitle'))}</a><a href="#s-rsvp">${esc(T('rsvpTitle'))}</a></div><button type="button" id="replayBtn" aria-label="Replay the banana leaf opening">↺ <span>Unwrap again</span></button></nav>
  <header class="hero" id="hero" tabindex="-1"><div class="kv-hero-art" aria-hidden="true"><img src="/kadali-vivah/art/kalash.webp" alt="" fetchpriority="high" decoding="async"></div><div class="hero-text" id="heroText"></div><a class="kv-scroll" href="#s-welcome">${esc(T('welcomeTitle') === 'welcomeTitle' ? 'Scroll to celebrate' : T('gettingMarried'))}<span>↓</span></a></header>
  <main class="content" id="content"></main><footer id="closing"></footer>
</div>
<div class="fab-wrap fab-top" ${withIntro ? 'inert' : ''}><div><button class="music-btn" id="musicBtn" type="button" hidden></button></div></div>
<div class="fab-wrap fab-bot" ${withIntro ? 'inert' : ''}><div><div class="lang" id="lang" hidden></div></div></div>
${cfg.mode === 'preview' ? `<div class="badge">${esc(T('previewBadge'))}</div>` : ''}
<canvas class="confetti" id="confetti" aria-hidden="true"></canvas>`;
    introDone = !withIntro;
    if (withIntro) {
      $('#openBtn').addEventListener('click', openDoors);
      $('#skipBtn').addEventListener('click', finishOpening);
    }
    $('#replayBtn').addEventListener('click', replayIntro);
    if (reduce) document.documentElement.classList.add('rm');
    // Tiny pointer depth, never needed to use the invitation. No device-motion permission.
    const parcel = $('#leafParcel');
    if (parcel) parcel.addEventListener('click', openDoors);
    if (parcel && !reduce && matchMedia('(hover:hover)').matches) {
      $('#intro').addEventListener('pointermove', e => {
        if (openingActive) return;
        parcel.style.setProperty('--tilt-x', (-(e.clientY / innerHeight - .5) * 5) + 'deg');
        parcel.style.setProperty('--tilt-y', ((e.clientX / innerWidth - .5) * 7) + 'deg');
      });
    }
  }

  function renderHero() {
    const order = data.couple.order === 'bride' ? ['bride', 'groom'] : ['groom', 'bride'];
    const first = side => X(`couple.${side}.first`) || (side === 'groom' ? 'Groom' : 'Bride');
    const person = side => `<div class="kv-person"><h1 class="name" data-fit>${esc(first(side))}${!data.couple.showParents && X(`couple.${side}.last`) ? `<small>${esc(X(`couple.${side}.last`))}</small>` : ''}</h1>${data.couple.showParents ? `<p class="parents">${esc(C.parentLine(data, lang, side))}</p>` : ''}</div>`;
    $('#heroText').innerHTML = `<p class="kv-eyebrow">${esc(T('gettingMarried'))}</p><div class="kv-line"></div>${person(order[0])}<span class="amp">&amp;</span>${person(order[1])}<div class="kv-hero-date"><span>${esc(C.fmtDate(data.wedding.date, lang, 'long'))}</span><span>${esc([X('venue.name'), X('venue.city')].filter(Boolean).join(' · '))}</span></div><a href="#s-rsvp" class="btn">${esc(T('rsvpTitle'))} <span aria-hidden="true">↗</span></a>`;
    const initials = order.map(s => first(s).slice(0, 1)).join(' & ');
    $('#navNames').textContent = initials;
    const openingNames = $('#openingNames'); if (openingNames) openingNames.textContent = order.map(first).join(' & ');
    fitNames();
  }
  function fitNames() {
    // Shrink each name until it fits (≤2 lines), then give both names the same size so a
    // short name never towers over a long one.
    const run = () => {
      const els = $$('[data-fit]'); if (!els.length) return;
      const sizes = els.map(el => {
        const box = el.parentElement.getBoundingClientRect().width || 300;
        let size = Math.min(60, box / 4.6); const min = 24;
        el.style.fontSize = size + 'px';
        const fits = () => el.scrollWidth <= Math.ceil(el.clientWidth) + 1 && el.getBoundingClientRect().height <= size * 1.4 * 2.05;
        while (size > min && !fits()) { size -= 2; el.style.fontSize = size + 'px'; }
        return size;
      });
      const s = Math.min(...sizes);
      els.forEach(el => { el.style.fontSize = s + 'px'; });
    };
    run();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
  }

  function finishOpening() {
    const intro = $('#intro'); if (!intro || intro.classList.contains('gone')) return;
    clearOpening(); introDone = true; openingActive = false;
    intro.classList.add('gone'); intro.setAttribute('aria-hidden', 'true'); intro.setAttribute('inert', '');
    document.body.classList.remove('locked'); document.documentElement.classList.remove('intro-on');
    $$('#page, .fab-wrap').forEach(el => el.removeAttribute('inert'));
    $('#hero').classList.add('show'); $('#hero').focus({preventScroll:true});
    later(() => intro.remove(), reduce ? 0 : 750);
  }
  function openDoors() {
    const intro = $('#intro'); if (!intro || openingActive || introDone) return;
    if (reduce) { finishOpening(); return; }
    openingActive = true; $('#openBtn').disabled = true;
    $('#openingStatus').textContent = 'Unwrapping your invitation…';
    intro.classList.add('untie');
    later(() => { intro.classList.add('unfold'); $('#openingStatus').textContent = 'A new beginning, with blessings.'; }, 750);
    later(() => intro.classList.add('blessing'), 2100);
    later(() => intro.classList.add('petal-reveal'), 3200);
    later(finishOpening, 4800);
    // Sequence is timer-backed and has no video/decode/network dependency.
  }
  function replayIntro() { clearOpening(); scratched = false; introDone = false; shell(true); renderAll(); scrollTo(0,0); $('#openBtn').focus({preventScroll:true}); }
  document.addEventListener('keydown', e => {
    const intro = $('#intro'); if (!intro || intro.classList.contains('gone')) return;
    if (e.key === 'Escape') { e.preventDefault(); finishOpening(); }
    if (e.key === 'Tab') {
      const buttons = $$('button:not(:disabled)', intro); if (!buttons.length) return;
      const first = buttons[0], last = buttons[buttons.length-1];
      if (e.shiftKey && (document.activeElement === first || !intro.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* =========================================================== sections */
  const head = (icon, title, id) => `<div class="sec-head"><span class="sico">${ART.icon[icon] || ART.icon.heart}</span><h2 id="${id}">${esc(title)}</h2><span class="divider">${ART.divider('heart')}</span></div>`;
  const sec = (id, inner, extra = '') => `<section class="sec reveal ${extra}" id="s-${id}" aria-labelledby="h-${id}">${inner}</section>`;
  const when = ev => [C.fmtDate(ev.date, lang, 'short'), [C.fmtTime(ev.start, lang), ev.end ? C.fmtTime(ev.end, lang) : ''].filter(Boolean).join(' – ')].filter(Boolean).join(', ');
  const evx = (ev, f) => C.txt(data, lang, `events.${ev.id}.${f}`);

  function sections() {
    const out = [];
    const S = data.sections;
    // 3. welcome (+ optional couple photo)
    const welcome = C.fillNames(X('welcome.text'), data, lang);
    if (welcome || data.couplePhoto) {
      out.push(`<section class="sec reveal" id="s-welcome" aria-label="Welcome">${data.couplePhoto ? `<div class="cameo"><img src="${esc(data.couplePhoto.url)}" alt="${esc(X('couple.groom.first') + ' & ' + X('couple.bride.first'))}" style="object-position:${data.couplePhoto.fx}% ${data.couplePhoto.fy}%" loading="lazy"></div>` : ''}
        <span class="mini-heart">${ART.icon.heartFill}</span>${welcome ? `<p class="lead">${esc(welcome)}</p>` : ''}<span class="mini-heart">${ART.icon.heartFill}</span></section>`);
    }
    // A folded gold-leaf date card, with an accessible button (no scratch canvas).
    if (data.wedding.date) {
      out.push(sec('scratch', `${head('sparkle', T('saveOurDate'), 'h-scratch')}
        <div class="kv-date-card ${scratched ? 'done' : ''}" id="scratchBox"><div class="kv-date-under"><span class="so">${esc(T('foreverBegins'))}</span><strong>${esc(C.fmtDate(data.wedding.date, lang, 'long'))}</strong><span>${esc(C.fmtDate(data.wedding.date, lang, 'weekday'))} · ${esc(C.fmtTime(data.wedding.time, lang))}</span></div><div class="kv-date-fold" aria-hidden="true"><span>✦</span><span>${esc(T('saveOurDate'))}</span></div></div>
        <button class="reveal-btn" type="button" id="revealBtn" aria-expanded="${scratched}" aria-controls="scratchBox">${esc(dateLabel())} ↗</button><div><button class="btn ghost" type="button" id="icsBtn">${ART.icon.calendar}<span>${esc(T('saveTheDate'))}</span></button></div>`, 'scratch-sec'));
    }
    // 5. photos
    if (S.photos && (data.photos.length || live)) {
      const ph = data.photos;
      out.push(`<section class="sec reveal" id="s-photos" aria-label="${esc(T('photosTitle'))}">${ph.length ? `<div class="car" id="car">
        <div class="car-track" tabindex="0">${ph.map((p, i) => `<div class="car-slide"><img src="${esc(p.url)}" alt="${esc(p.alt || T('photosTitle') + ' ' + (i + 1))}" style="object-position:${p.fx}% ${p.fy}%" ${i ? 'loading="lazy"' : ''} decoding="async"></div>`).join('')}</div>
        ${ph.length > 1 ? `<button class="car-nav prev" type="button" aria-label="Previous">‹</button><button class="car-nav next" type="button" aria-label="Next">›</button><div class="car-dots">${ph.map((_, i) => `<button type="button" aria-label="${i + 1}"${i ? '' : ' class="on"'}></button>`).join('')}</div>` : ''}</div>`
        : `<div class="photo-ph">${ART.icon.camera}<span>${esc(T('photosSoon'))}</span></div>`}</section>`);
    }
    // 6. countdown
    if (data.wedding.date && data.wedding.time) {
      out.push(sec('countdown', `${head('hourglass', T('countdownTitle'), 'h-countdown')}<div class="cd" id="cd" role="timer" aria-live="off">${['days', 'hours', 'minutes', 'seconds'].map(k => `<div class="cd-box"><span class="cd-num" data-k="${k}">00</span><span class="cd-lab">${esc(T(k))}</span></div>`).join('')}</div>`));
    }
    out.push(`<section class="kv-mandap reveal" aria-label="Wedding mandap"><img src="/kadali-vivah/art/mandap.webp" alt="Illustrative Indian wedding mandap decorated with marigolds and banana leaves" loading="lazy"><div><span>${esc(T('withLove'))}</span><p>${esc(T('gettingMarried'))}</p></div></section>`);
    // 7. timeline
    const sch = C.schedule(data);
    if (sch.days.length) {
      const multi = sch.days.length > 1;
      out.push(sec('timeline', `${head('clock', T('timelineTitle'), 'h-timeline')}<div class="tl">${sch.days.map(d => `${multi ? `<div class="tl-day">${esc(C.fmtDate(d.date, lang, 'daymonth'))}</div>` : ''}${d.events.map(ev => {
        const venue = evx(ev, 'venue'), note = evx(ev, 'note'), dress = evx(ev, 'dress');
        return `<div class="tl-item"><h3>${esc(C.eventName(data, lang, ev))}</h3><div class="when">${esc(when(ev))}</div>${venue ? `<div class="where">${esc(venue)}</div>` : ''}${note ? `<div class="note">${esc(note)}${ART.icon.heartFill}</div>` : ''}${dress ? `<span class="dress">${esc(T('dressFor'))}: ${esc(dress)}</span>` : ''}</div>`;
      }).join('')}`).join('')}</div>`));
    }
    // 8. venue
    const vblock = (v, prefix, label) => {
      const addr = [C.txt(data, lang, prefix + '.address'), [C.txt(data, lang, prefix + '.city'), C.txt(data, lang, prefix + '.state')].filter(Boolean).join(', '), v.pin].filter(Boolean).join(', ');
      const links = C.mapsLinks(v);
      const embed = cfg.mapsKey && v.lat != null ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(cfg.mapsKey)}&q=${v.lat},${v.lng}&zoom=15` : links.osmEmbed;
      const open = isIOS ? links.apple : links.google;
      return `<div class="venue-block">${label ? `<div class="venue-label">${esc(label)}</div>` : ''}<p class="v-name">${esc(C.txt(data, lang, prefix + '.name'))}</p>${addr ? `<p class="v-addr">${esc(addr)}</p>` : ''}
        <div class="map"><div class="fallback">${ART.icon.pin}<span>${esc(T('mapUnavailable'))}</span></div>${embed ? `<iframe data-src="${esc(embed)}" title="${esc(T('venueTitle'))}: ${esc(v.name)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : ''}
        <a class="chip" href="${esc(open)}" target="_blank" rel="noopener">${esc(T('openInMaps'))}${ART.icon.external}</a></div>
        <a class="btn" href="${esc(links.google)}" target="_blank" rel="noopener">${ART.icon.pin}<span>${esc(T('viewOnGoogleMaps'))}</span></a></div>`;
    };
    if (data.venue.name || live) {
      out.push(sec('venue', `${head('pin', T('venueTitle'), 'h-venue')}${vblock(data.venue, 'venue', data.reception.enabled && data.reception.name ? I.eventTypeName('wedding', lang) : '')}${data.reception.enabled && data.reception.name ? vblock(data.reception, 'reception', T('receptionVenue')) : ''}`));
    }
    // 9. dress code
    if (S.dressCode) {
      const w = X('dress.women'), m = X('dress.men'), c = X('dress.common');
      if (w || m || c) out.push(sec('dress', `${head('dress', T('dressTitle'), 'h-dress')}${c ? `<div class="dc"><h3>${esc(T('everyone'))}</h3><span class="ln"></span><p>${esc(c)}</p></div>` : ''}${w ? `<div class="dc"><h3>${esc(T('women'))}</h3><span class="ln"></span><p>${esc(w)}</p></div>` : ''}${m ? `<div class="dc"><h3>${esc(T('men'))}</h3><span class="ln"></span><p>${esc(m)}</p></div>` : ''}`));
    }
    // 10. pre-wedding
    if (S.preWedding && sch.pre.length) {
      out.push(sec('pre', `${head('party', T('preWeddingTitle'), 'h-pre')}<div class="cards">${sch.pre.map(ev => {
        const venue = evx(ev, 'venue'), address = evx(ev, 'address'), note = evx(ev, 'note'), dress = evx(ev, 'dress');
        const q = [ev.venue, ev.address].filter(Boolean).join(', ');
        const icon = (I.EVENT_TYPES[ev.type] || {}).icon || 'sparkle';
        return `<article class="card"><div class="cico">${ART.icon[icon] || ART.icon.sparkle}</div><h3>${esc(C.eventName(data, lang, ev))}</h3><div class="when">${esc(when(ev))}</div>${venue || address ? `<div class="where">${esc([venue, address].filter(Boolean).join(', '))}</div>` : ''}${note ? `<div class="note">${esc(note)}</div>` : ''}${dress ? `<span class="dress">${esc(T('dressFor'))}: ${esc(dress)}</span>` : ''}${q ? `<div><a class="dir" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}" target="_blank" rel="noopener">${ART.icon.pin}${esc(T('openInMaps'))}</a></div>` : ''}</article>`;
      }).join('')}</div>`));
    }
    // 11-13. transport, accommodation, gifts
    if (S.transport && X('transport')) out.push(sec('transport', `${head('car', T('transportTitle'), 'h-transport')}<p class="lead">${esc(X('transport'))}</p>`));
    if (S.accommodation && (X('accommodation.text') || data.accommodation.code)) out.push(sec('stay', `${head('hotel', T('accommodationTitle'), 'h-stay')}${X('accommodation.text') ? `<p class="lead">${esc(X('accommodation.text'))}</p>` : ''}${data.accommodation.code ? `<div class="code"><span><small>${esc(T('bookingCode'))}</small><b>${esc(data.accommodation.code)}</b></span><button type="button" data-copy="${esc(data.accommodation.code)}">${ART.icon.copy}<span>${esc(T('copy'))}</span></button></div>` : ''}`));
    if (S.gifts && X('gifts')) out.push(sec('gifts', `${head('gift', T('giftsTitle'), 'h-gifts')}<p class="lead">${esc(X('gifts'))}</p>`));
    // 14. rsvp
    if (S.rsvp) out.push(sec('rsvp', `${head('mail', T('rsvpTitle'), 'h-rsvp')}${rsvpForm()}`));
    return out.join('');
  }

  function rsvpForm() {
    return cfg.simpleWhatsAppRsvp ? whatsappRsvpForm() : websiteRsvpForm();
  }
  function whatsappRsvpForm() {
    const r = data.rsvp;
    const closed = r.deadline && Date.now() > Date.parse(r.deadline + 'T23:59:59');
    if (closed && !live) return `<p class="lead">${esc(T('rsvpClosed'))}</p>`;
    const yes = C.whatsappRsvpLink(data, true, lang), no = C.whatsappRsvpLink(data, false, lang);
    if (!yes || !no) {
      return `<div class="rsvp">
        ${r.deadline ? `<p class="by">${esc(T('rsvpBy').replace('{date}', C.fmtDate(r.deadline, lang, 'long')))}</p>` : ''}
        <p class="rsvp-hint">${esc(T('rsvpWhatsappHint'))}</p>
        <div class="rsvp-actions"><button class="btn wide" type="button" disabled>${esc(T('accept'))}</button><button class="btn wide ghost" type="button" disabled>${esc(T('decline'))}</button></div>
        <p class="lead">${esc(T('contactFamily'))}</p>
      </div>`;
    }
    return `<div class="rsvp">
      ${r.deadline ? `<p class="by">${esc(T('rsvpBy').replace('{date}', C.fmtDate(r.deadline, lang, 'long')))}</p>` : ''}
      <p class="rsvp-hint">${esc(T('rsvpWhatsappHint'))}</p>
      <div class="rsvp-actions">
        <a class="btn wide" href="${esc(yes)}" target="_blank" rel="noopener noreferrer">${esc(T('accept'))}</a>
        <a class="btn wide ghost" href="${esc(no)}" target="_blank" rel="noopener noreferrer">${esc(T('decline'))}</a>
      </div>
    </div>`;
  }
  function websiteRsvpForm() {
    const r = data.rsvp;
    const closed = r.deadline && Date.now() > Date.parse(r.deadline + 'T23:59:59') ;
    if (closed && !live) return `<p class="lead">${esc(T('rsvpClosed'))}</p>`;
    const opts = Array.from({ length: r.maxGuests }, (_, i) => `<option value="${i + 1}">${C.fmtNum(i + 1, lang).replace(/^0/, '')}</option>`).join('');
    return `<form class="rsvp" id="rsvpForm" novalidate>
      ${r.deadline ? `<p class="by">${esc(T('rsvpBy').replace('{date}', C.fmtDate(r.deadline, lang, 'long')))}</p>` : ''}
      <div class="fld"><label for="rv-name">${esc(T('yourName'))}<span class="req">*</span></label><input id="rv-name" name="name" autocomplete="name" maxlength="60" placeholder="${esc(T('yourNamePh'))}" required><div class="err">${esc(T('errRequired'))}</div></div>
      <div class="fld"><label for="rv-email">${esc(T('email'))}<span class="req">*</span></label><input id="rv-email" name="email" type="email" inputmode="email" autocomplete="email" maxlength="120" placeholder="${esc(T('emailPh'))}"><div class="err">${esc(T('errEmail'))}</div></div>
      <div class="fld"><label for="rv-phone">${esc(T('phone'))}</label><input id="rv-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="18" placeholder="${esc(T('phonePh'))}"><div class="help">${esc(T('contactHint'))}</div><div class="err">${esc(T('errPhone'))}</div></div>
      <div class="fld"><label for="rv-att">${esc(T('attending'))}<span class="req">*</span></label><select id="rv-att" name="attending" required><option value="">${esc(T('select'))}</option><option value="yes">${esc(T('accept'))}</option><option value="no">${esc(T('decline'))}</option></select><div class="err">${esc(T('errRequired'))}</div></div>
      <div class="fld" id="rv-guests-f" hidden><label for="rv-guests">${esc(T('guests'))}</label><select id="rv-guests" name="guests">${opts}</select></div>
      ${r.meal ? `<div class="fld" id="rv-meal-f" hidden><label for="rv-meal">${esc(T('meal'))}</label><select id="rv-meal" name="meal"><option value="">${esc(T('select'))}</option>${r.mealOptions.map(m => `<option>${esc(m)}</option>`).join('')}</select></div>` : ''}
      <div class="fld"><label for="rv-msg">${esc(T('message'))}</label><textarea id="rv-msg" name="message" maxlength="500" rows="3" placeholder="${esc(T('messagePh'))}"></textarea></div>
      <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <button class="btn wide" type="submit" id="rv-send">${ART.icon.mail}<span>${esc(T('send'))}</span></button>
      <div class="rsvp-msg" id="rv-out" role="status" aria-live="polite"></div>
    </form>`;
  }

  function closing() {
    const order = data.couple.order === 'bride' ? ['bride', 'groom'] : ['groom', 'bride'];
    const names = order.map(s => X(`couple.${s}.first`)).filter(Boolean).join(' & ');
    $('#closing').innerHTML = `<div class="closing reveal"><div class="wl">${esc(T('withLove'))},</div><div class="cn">${order.map(s => X(`couple.${s}.first`)).filter(Boolean).map(esc).join(' <span class="amp-i">&amp;</span> ')}</div>${X('closing') ? `<p class="cl">${esc(X('closing'))}</p>` : ''}<span class="flourish">${ART.flourish}</span></div>
      <div class="foot">${esc(T('madeWith'))} · <a href="https://paigaam.cc" target="_blank" rel="noopener">paigaam.cc</a></div>`;
  }

  /* =========================================================== behaviours */
  function bindScratch() {
    const box = $('#scratchBox'), btn = $('#revealBtn'); if (!box || !btn) return;
    btn.addEventListener('click', () => {
      scratched = !scratched; box.classList.toggle('done', scratched); btn.setAttribute('aria-expanded', String(scratched)); btn.textContent = dateLabel() + ' ↗';
      if (scratched && !reduce) { const r = box.getBoundingClientRect(); burst(r.left+r.width/2, r.top+r.height/2); }
    });
  }

  /* glitter confetti */
  let parts = [], raf = 0;
  function burst(x, y) {
    const cv = $('#confetti'); if (!cv || reduce) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    const cs = getComputedStyle(document.documentElement);
    const cols = ['--sp-accent', '--sp-primary', '--sp-flower', '--sp-deep', '--sp-champagne'].map(k => cs.getPropertyValue(k).trim()).concat(['#F6E3A8', '#FFFFFF']);
    const n = reduce ? 40 : 170;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 9;
      parts.push({ x: x * dpr, y: y * dpr, vx: Math.cos(a) * s * dpr, vy: (Math.sin(a) * s - 6) * dpr, r: (1.5 + Math.random() * 3.5) * dpr, c: cols[i % cols.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, shape: i % 9 === 0 ? 'heart' : i % 3 === 0 ? 'rect' : 'dot', life: 1, tw: Math.random() * 6 });
    }
    // a gentle rain of glitter from the top, like the reference
    for (let i = 0; i < (reduce ? 0 : 90); i++) parts.push({ x: Math.random() * cv.width, y: -Math.random() * cv.height * 0.6, vx: (Math.random() - 0.5) * dpr, vy: (1 + Math.random() * 2) * dpr, r: (1 + Math.random() * 2.2) * dpr, c: cols[i % 4], rot: 0, vr: 0, shape: 'dot', life: 1, tw: Math.random() * 6, slow: true });
    if (!raf) raf = requestAnimationFrame(tick);
    function tick() {
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      parts = parts.filter(p => p.life > 0 && p.y < cv.height + 40);
      for (const p of parts) {
        p.vx *= p.slow ? 1 : 0.985; p.vy = p.vy * (p.slow ? 1 : 0.985) + (p.slow ? 0.01 : 0.22) * dpr; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.tw += 0.2;
        p.life -= p.slow ? 0.0035 : 0.006;
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4)) * (0.65 + 0.35 * Math.sin(p.tw));
        ctx.fillStyle = p.c;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        if (p.shape === 'rect') ctx.fillRect(-p.r, -p.r * 0.45, p.r * 2, p.r * 0.9);
        else if (p.shape === 'heart') { const s = p.r / 6; ctx.scale(s, s); ctx.beginPath(); ctx.moveTo(0, 6); ctx.bezierCurveTo(-8, 0, -6, -7, 0, -3); ctx.bezierCurveTo(6, -7, 8, 0, 0, 6); ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(0, 0, p.r * 0.75, 0, 6.283); ctx.fill(); }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (parts.length) raf = requestAnimationFrame(tick); else { raf = 0; ctx.clearRect(0, 0, cv.width, cv.height); }
    }
  }

  function bindIcs() {
    const b = $('#icsBtn'); if (!b) return;
    b.addEventListener('click', () => {
      const url = cfg.url || location.href.split('?')[0];
      if (isAndroid) {
        const s = C.zonedToUtc(data.wedding.date, data.wedding.time, data.wedding.tz), f = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
        const v = data.venue;
        const title = `${X('couple.groom.first')} & ${X('couple.bride.first')}`;
        window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${f(s)}/${f(s + 4 * 36e5)}&location=${encodeURIComponent([v.name, v.address, v.city].filter(Boolean).join(', '))}&details=${encodeURIComponent(url)}`, '_blank', 'noopener');
        return;
      }
      const blob = new Blob([C.icsFor(data, lang, url)], { type: 'text/calendar;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = C.slugify(X('couple.groom.first') + '-' + X('couple.bride.first')) + '-wedding.ics';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    });
  }

  function bindCarousel() {
    carTimers.forEach(clearInterval); carTimers = [];
    const car = $('#car'); if (!car) return;
    const track = $('.car-track', car), dots = $$('.car-dots button', car), n = $$('.car-slide', car).length;
    const go = i => track.scrollTo({ left: ((i + n) % n) * track.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
    const cur = () => Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    let idle = 0;
    track.addEventListener('scroll', () => { const i = cur(); dots.forEach((d, k) => d.classList.toggle('on', k === Math.abs(i))); idle = Date.now(); }, { passive: true });
    dots.forEach((d, k) => d.addEventListener('click', () => go(k)));
    const pv = $('.car-nav.prev', car), nx = $('.car-nav.next', car);
    if (pv) { pv.addEventListener('click', () => go(cur() - (document.dir === 'rtl' ? -1 : 1))); nx.addEventListener('click', () => go(cur() + (document.dir === 'rtl' ? -1 : 1))); }
    track.addEventListener('keydown', e => { if (e.key === 'ArrowRight') go(cur() + 1); if (e.key === 'ArrowLeft') go(cur() - 1); });
    if (n > 1 && !reduce && !thumb) carTimers.push(setInterval(() => { if (Date.now() - idle > 5000 && document.visibilityState === 'visible' && introDone) go(cur() + 1); }, 4500));
  }

  function bindCountdown() {
    clearInterval(countdownTimer);
    const cd = $('#cd'); if (!cd) return;
    const target = C.zonedToUtc(data.wedding.date, data.wedding.time, data.wedding.tz);
    const nums = {}; $$('.cd-num', cd).forEach(el => { nums[el.dataset.k] = el; });
    const tick = () => {
      let ms = target - Date.now();
      if (ms <= 0) {
        clearInterval(countdownTimer);
        cd.outerHTML = `<div class="cd-done">${esc(ms > -864e5 ? T('todayIsTheDay') : T('married'))}</div>`;
        return;
      }
      const s = Math.floor(ms / 1000);
      const vals = { days: Math.floor(s / 86400), hours: Math.floor(s % 86400 / 3600), minutes: Math.floor(s % 3600 / 60), seconds: s % 60 };
      for (const k in vals) { const t = C.fmtNum(vals[k], lang); if (nums[k].textContent !== t) nums[k].textContent = t; }
    };
    tick(); countdownTimer = setInterval(tick, 1000);
  }

  function bindMaps() {
    const frames = $$('.map iframe[data-src]'); if (!frames.length) return;
    const load = f => { if (!f.src) f.src = f.dataset.src; };
    if (!('IntersectionObserver' in window) || live) { frames.forEach(load); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { load(e.target); io.unobserve(e.target); } }), { rootMargin: '400px' });
    frames.forEach(f => io.observe(f));
  }

  function bindCopy() {
    $$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); } catch { const t = document.createElement('textarea'); t.value = b.dataset.copy; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch {} t.remove(); }
      const s = $('span', b), old = s.textContent; s.textContent = T('copied'); setTimeout(() => { s.textContent = old; }, 1600);
    }));
  }


  function bindRsvp() {
    const f = $('#rsvpForm'); if (!f) return;
    const opened = Date.now();
    let confirmUpdate = false;
    const att = $('#rv-att', f);
    att.addEventListener('change', () => { const yes = att.value === 'yes'; $('#rv-guests-f', f).hidden = !yes; const m = $('#rv-meal-f', f); if (m) m.hidden = !yes; });
    const out = $('#rv-out', f);
    const show = (msg, warn) => { out.textContent = msg; out.className = 'rsvp-msg show' + (warn ? ' warn' : ''); };
    f.addEventListener('submit', async e => {
      e.preventDefault();
      $$('.fld', f).forEach(x => x.classList.remove('bad'));
      const v = Object.fromEntries(new FormData(f).entries());
      let bad = false;
      const mark = (id, msg) => { const fl = $('#' + id, f).closest('.fld'); fl.classList.add('bad'); if (msg) $('.err', fl).textContent = msg; bad = true; };
      if (!String(v.name || '').trim()) mark('rv-name');
      const email = String(v.email || '').trim(), phone = String(v.phone || '').trim();
      if (!email && !phone) mark('rv-email', T('errContact'));
      if (email && !C.EMAIL_RE.test(email)) mark('rv-email', T('errEmail'));
      if (phone && !C.cleanPhone(phone).ok) mark('rv-phone', T('errPhone'));
      if (!v.attending) mark('rv-att');
      if (bad) { const first = $('.fld.bad input, .fld.bad select', f); if (first) first.focus(); return; }
      const btn = $('#rv-send', f), label = $('span', btn), old = label.textContent;
      btn.disabled = true; label.textContent = T('sending');
      const payload = { name: v.name, email, phone, attending: v.attending, guests: v.attending === 'yes' ? Number(v.guests || 1) : 0, meal: v.meal || '', message: v.message || '', website: v.website || '', t: Date.now() - opened, lang, confirmUpdate };
      try {
        if (!cfg.rsvpUrl) { await new Promise(r => setTimeout(r, 600)); return thank(payload.attending, true); }
        const r = await fetch(cfg.rsvpUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
        if (r.ok) return thank(payload.attending);
        const j = await r.json().catch(() => ({}));
        if (r.status === 409 && j.error === 'duplicate') { confirmUpdate = true; label.textContent = T('update'); btn.disabled = false; return show(T('duplicate'), true); }
        if (r.status === 410) return show(T('rsvpClosed'), true);
        show(r.status === 429 ? T('errSlow') : T('errGeneric'), true);
      } catch { show(T('errGeneric'), true); }
      btn.disabled = false; if (label.textContent === T('sending')) label.textContent = old;
    });
    function thank(a, demo) {
      f.innerHTML = `<div class="rsvp-done"><div class="big">${esc(a === 'yes' ? T('thanksYes') : T('thanksNo'))}</div>${demo ? '<p style="font-size:13px;opacity:.7;margin-top:10px">(Sample invitation: responses are not saved.)</p>' : ''}</div>`;
      if (a === 'yes') { const r = f.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + 40); }
    }
  }


  function bindReveal() {
    if (observer) observer.disconnect();
    const els = $$('.reveal');
    if (live || thumb || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    observer = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); observer.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(e => observer.observe(e));
  }

  /* =========================================================== music */
  let audio = null, musicWanted = false, audioSource = '';
  function musicSrc() {
    if (!data.sections.music) return '';
    if (data.music.track === 'upload' && data.music.url) return data.music.url;
    return '/shaadi-paigaam/music/' + data.music.track + '.mp3';
  }
  function createAudio() {
    if (audio) return;
    audio = new Audio(); audio.loop = true; audio.preload = 'none';
    audio.addEventListener('error', () => { if (audio.src) $('#musicBtn').hidden = true; });
  }
  function setupMusic() {
    const btn = $('#musicBtn'); if (!btn) return;
    const src = musicSrc();
    if (!src || thumb) {
      btn.hidden = true;
      if (audio) { musicWanted = false; audio.pause(); audio.removeAttribute('src'); audio.load(); audioSource = ''; }
      return;
    }
    btn.hidden = false;
    if (!cfg.lazyMusic) {
      createAudio();
      if (!audio.src.endsWith(src)) { const was = !audio.paused; audio.src = src; audioSource = src; if (was) audio.play().catch(() => {}); }
      btn.onclick = () => { if (audio.paused) startMusic(false); else { musicWanted = false; fade(0, () => audio.pause()); paintBtn(); } };
      paintBtn();
      return;
    }
    // For Shaadi Paigaam, do not create audio or request the file until a guest taps Play.
    if (audio && audioSource && audioSource !== src) {
      musicWanted = false; audio.pause(); audio.removeAttribute('src'); audio.load(); audioSource = '';
    }
    btn.onclick = () => {
      if (audio && !audio.paused) { musicWanted = false; fade(0, () => audio.pause()); paintBtn(); }
      else startMusic(false);
    };
    paintBtn();
  }
  function startMusic(fromDoor) {
    const src = musicSrc();
    if (!src) return;
    if (cfg.lazyMusic) {
      createAudio();
      if (audioSource !== src) { audio.src = src; audioSource = src; }
    } else if (!audio) return;
    if (fromDoor && data.music.startMuted) return;
    musicWanted = true;
    audio.volume = 0;
    audio.play().then(() => { fade(0.55); paintBtn(); }).catch(() => { musicWanted = false; paintBtn(); });
  }
  function fade(to, cb) {
    const from = audio.volume, t0 = performance.now(), d = 1200;
    const st = n => { const t = Math.max(0, Math.min(1, (n - t0) / d)); audio.volume = Math.max(0, Math.min(1, from + (to - from) * t)); if (t < 1) requestAnimationFrame(st); else if (cb) cb(); };
    requestAnimationFrame(st);
  }
  function paintBtn() {
    const btn = $('#musicBtn'); if (!btn) return;
    const on = audio && !audio.paused && musicWanted;
    btn.innerHTML = on ? ART.icon.soundOn : ART.icon.soundOff;
    btn.classList.toggle('playing', !!on);
    btn.setAttribute('aria-label', on ? T('musicOff') : T('musicOn'));
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  document.addEventListener('visibilitychange', () => { if (!audio) return; if (document.hidden) audio.pause(); else if (musicWanted) audio.play().catch(() => {}); });

  /* =========================================================== language */
  function setupLang() {
    const box = $('#lang'); const en = data.lang.enabled;
    if (en.length < 2 || thumb) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `<button class="lang-btn" type="button" aria-haspopup="true" aria-expanded="false">${ART.icon.globe}<span>${esc(I.LANGS[lang].native)}</span></button>
      <div class="lang-menu" role="menu">${en.map(l => `<button type="button" role="menuitemradio" aria-checked="${l === lang}" data-l="${l}"><span>${esc(I.LANGS[l].native)}</span><small>${esc(I.LANGS[l].name)}</small></button>`).join('')}</div>`;
    const b = $('.lang-btn', box);
    b.addEventListener('click', e => { e.stopPropagation(); const o = box.classList.toggle('open'); b.setAttribute('aria-expanded', o); });
    $$('[data-l]', box).forEach(x => x.addEventListener('click', () => { box.classList.remove('open'); setLang(x.dataset.l); }));
    document.addEventListener('click', () => box.classList.remove('open'));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') box.classList.remove('open'); });
  }
  function setLang(l) {
    if (!data.lang.enabled.includes(l)) return;
    lang = l;
    try { localStorage.setItem('sp-lang-' + (cfg.slug || cfg.id || 'demo'), l); } catch {}
    const y = scrollY;
    applyTheme(); renderAll(true);
    const med = $('.med-label'); if (med) med.textContent = T('tapToOpen');
    scrollTo(0, y);
  }

  /* =========================================================== render */
  function renderAll(keep) {
    renderHero();
    $('#content').innerHTML = sections();
    closing();
    bindScratch(); bindIcs(); bindCarousel(); bindCountdown(); bindMaps(); bindCopy(); bindRsvp(); bindReveal();
    setupMusic(); setupLang();
    if (introDone) $$('#heroText > *').forEach(el => { el.style.transitionDelay = '0ms'; });
  }

  window.addEventListener('resize', () => { clearTimeout(window.__fitT); window.__fitT = setTimeout(fitNames, 120); });

  // Editor live preview bridge (same-origin only).
  window.addEventListener('message', e => {
    if (e.source !== window.parent || e.origin !== location.origin || !e.data || typeof e.data !== 'object') return;
    const m = e.data;
    if (m.type === 'sp:data' && m.data) {
      data = C.validate(m.data, { allowPast: true }).data;
      // The editor preview follows the chosen preview language, else the invitation's default.
      lang = m.lang && data.lang.enabled.includes(m.lang) ? m.lang : (live ? data.lang.default : (data.lang.enabled.includes(lang) ? lang : data.lang.default));
      const y = scrollY;
      applyTheme(); renderAll(true);
      if (m.focus && !$('#intro:not(.gone)')) { const t = document.getElementById('s-' + m.focus) || (m.focus === 'hero' ? $('#hero') : null); if (t) t.scrollIntoView({ behavior: 'smooth', block: m.focus === 'hero' ? 'start' : 'center' }); else scrollTo(0, y); }
      else scrollTo(0, y);
    } else if (m.type === 'sp:replay') { replayIntro(); scrollTo(0, 0); }
    else if (m.type === 'sp:lang' && m.lang) setLang(m.lang);
    else if (m.type === 'sp:open') openDoors();
    else if (m.type === 'sp:revealAll') $$('.reveal').forEach(el => el.classList.add('in'));
    else if (m.type === 'sp:reveal') window.SPInvite.reveal();
    else if (m.type === 'sp:go') window.SPInvite.go(m.id);
    else if (m.type === 'sp:scroll') scrollTo(0, m.y || 0);
  });

  // Small hook for automated QA and the editor ("preview as guest").
  window.SPInvite = {
    open: openDoors, replay: replayIntro, setLang,
    reveal: () => { const b = document.getElementById('revealBtn'); if (b) b.click(); },
    go: id => { const t = document.getElementById('s-' + id); if (t) t.scrollIntoView({ block: 'start' }); },
  };

  applyTheme();
  shell();
  renderAll();
  if (window.parent !== window) window.parent.postMessage({ type: 'sp:ready' }, location.origin);
  if ($('#openBtn') && window.parent === window) $('#openBtn').focus({preventScroll:true});
})();
