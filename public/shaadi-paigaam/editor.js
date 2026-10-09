/* Shaadi Paigaam — the customizer.
 * One data object (core.js schema) drives everything; every change validates
 * with the same core.validate the server uses, updates the live preview by
 * postMessage, autosaves to this device instantly and to the server every few
 * seconds, and can be undone. Publishing is impossible until the checklist is clear. */
(function () {
  'use strict';
  const C = window.SPCore, I = window.SPI18N, ART = window.SPArt;
  const boot = JSON.parse(document.getElementById('spe-boot').textContent);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const addDays = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

  /* ---------------------------------------------------------- icons */
  const svg = (b, w = 1.7) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${b}</svg>`;
  const IC = {
    undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'), redo: svg('<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>'),
    eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'), plus: svg('<path d="M12 5v14M5 12h14"/>'),
    trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'), dup: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
    up: svg('<path d="M12 19V5M6 11l6-6 6 6"/>'), down: svg('<path d="M12 5v14M6 13l6 6 6-6"/>'), chev: svg('<path d="M6 9l6 6 6-6"/>'),
    check: svg('<path d="M5 12l5 5L20 7"/>', 2.2), alert: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>'), info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.01"/>'),
    grip: svg('<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>', 2.4),
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 5v14l12-7z"/></svg>', pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
    upload: svg('<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>'), edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>'), x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    phone: svg('<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>'), tablet: svg('<rect x="4.5" y="2.5" width="15" height="19" rx="2"/><path d="M11 18.5h2"/>'), laptop: svg('<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>'),
    replay: svg('<path d="M4 12a8 8 0 1 0 2.4-5.7L4 9"/><path d="M4 4v5h5"/>'), link: svg('<path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1"/><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1"/>'),
    wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>',
    qr: svg('<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2"/>'),
    image: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 16l-5-5L5 19.5"/>'), pin: svg('<path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>'),
    lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="1.6"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
  };

  /* ---------------------------------------------------------- steps */
  const STEPS = [
    { id: 'couple', t: 'Couple & families', short: 'Couple', focus: 'hero' },
    { id: 'dates', t: 'Date & events', short: 'Events', focus: 'timeline' },
    { id: 'venue', t: 'Venue & travel', short: 'Venue', focus: 'venue' },
    { id: 'media', t: 'Photos & music', short: 'Photos', focus: 'photos' },
    { id: 'style', t: 'Colours & style', short: 'Style', focus: 'hero' },
    { id: 'lang', t: 'Language', short: 'Language', focus: 'welcome' },
    { id: 'review', t: 'Review & publish', short: 'Publish', focus: 'hero' },
  ];
  const STEP_OF = { couple: 0, welcome: 0, wedding: 1, events: 1, rsvp: 1, venue: 2, reception: 2, dress: 2, transport: 2, accommodation: 2, gifts: 2, sections: 2, photos: 3, couplePhoto: 3, music: 3, palette: 4, font: 4, lang: 5, i18n: 5, access: 6 };
  const TZ = [['Asia/Kolkata', 'India (IST)'], ['Asia/Dubai', 'UAE'], ['Asia/Kathmandu', 'Nepal'], ['Asia/Dhaka', 'Bangladesh'], ['Asia/Karachi', 'Pakistan'], ['Asia/Colombo', 'Sri Lanka'], ['Asia/Singapore', 'Singapore'], ['Asia/Kuala_Lumpur', 'Malaysia'], ['Asia/Riyadh', 'Saudi Arabia'], ['Asia/Qatar', 'Qatar'], ['Asia/Muscat', 'Oman'], ['Europe/London', 'United Kingdom'], ['Europe/Paris', 'Central Europe'], ['America/New_York', 'US & Canada Eastern'], ['America/Chicago', 'US Central'], ['America/Denver', 'US Mountain'], ['America/Los_Angeles', 'US & Canada Pacific'], ['America/Toronto', 'Toronto'], ['Australia/Sydney', 'Sydney'], ['Australia/Melbourne', 'Melbourne'], ['Australia/Perth', 'Perth'], ['Pacific/Auckland', 'New Zealand'], ['Africa/Nairobi', 'Kenya'], ['Africa/Johannesburg', 'South Africa'], ['Asia/Tokyo', 'Japan'], ['Asia/Hong_Kong', 'Hong Kong']];
  const EVENT_ORDER = ['mehendi', 'haldi', 'sangeet', 'engagement', 'baraat', 'varmala', 'pheras', 'arrival', 'reception', 'custom'];

  /* ---------------------------------------------------------- state */
  const S = { id: null, data: null, status: 'draft', live: false, slug: '', step: 0, touched: new Set(), tried: new Set(), undo: [], redo: [], lastPush: 0,
    dirty: false, synced: true, saving: null, manageUrl: '', v: null, previewLang: null, device: 'phone', tab: 'edit', slugTimer: 0, slugState: null, autoTr: {}, published: null };
  const LS = id => 'sp-ed:' + (id || 'new');

  function validateNow() { S.v = C.validate(S.data); return S.v; }
  function getP(path) {
    const parts = path.split('.'); let o = S.data;
    for (const p of parts) { if (o == null) return undefined; o = o[p]; }
    return o;
  }
  function setP(path, val) {
    const parts = path.split('.'); let o = S.data;
    for (let i = 0; i < parts.length - 1; i++) { if (o[parts[i]] == null || typeof o[parts[i]] !== 'object') o[parts[i]] = {}; o = o[parts[i]]; }
    o[parts[parts.length - 1]] = val;
  }
  const evById = id => S.data.events.find(e => e.id === id);

  /* ---------------------------------------------------------- undo */
  function pushUndo(force) {
    const now = Date.now(), snap = JSON.stringify(S.data);
    if (!force && now - S.lastPush < 800 && S.undo.length) { S.lastPush = now; return; }
    if (S.undo[S.undo.length - 1] === snap) return;
    S.undo.push(snap); if (S.undo.length > 80) S.undo.shift();
    S.redo = []; S.lastPush = now; paintUndo();
  }
  function undo() { if (!S.undo.length) return; S.redo.push(JSON.stringify(S.data)); S.data = JSON.parse(S.undo.pop()); S.lastPush = 0; afterRestore('Undone'); }
  function redo() { if (!S.redo.length) return; S.undo.push(JSON.stringify(S.data)); S.data = JSON.parse(S.redo.pop()); S.lastPush = 0; afterRestore('Redone'); }
  function afterRestore(msg) { changed({ noUndo: true }); renderStep(true); paintUndo(); toast(msg); }
  function paintUndo() { const u = $('#undoBtn'), r = $('#redoBtn'); if (u) u.disabled = !S.undo.length; if (r) r.disabled = !S.redo.length; }

  /* ---------------------------------------------------------- change pipeline */
  function changed(o = {}) {
    if (!o.noUndo) pushUndo();
    S.dirty = true; S.synced = false;
    saveLocal();
    validateNow();
    paintErrors(); paintProgress(); paintSave('busy', 'Saving…');
    postPreview(o.focus);
    scheduleSave();
  }
  // Called before a mutation so the *previous* state is what undo restores.
  function willChange() { pushUndo(); }

  function saveLocal() {
    try { localStorage.setItem(LS(S.id), JSON.stringify({ id: S.id, data: S.data, at: Date.now(), synced: S.synced })); if (S.id) localStorage.setItem('sp-ed:last', S.id); } catch {}
  }
  const scheduleSave = debounce(() => saveServer(), 2500);
  async function saveServer() {
    if (S.saving) { await S.saving; }
    if (!S.dirty && S.id) return;
    S.dirty = false;
    const body = JSON.stringify({ id: S.id || undefined, data: S.data });
    S.saving = (async () => {
      try {
        const r = await fetch('/api/shaadi-paigaam/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (r.status === 429) { paintSave('off', 'Saved on this device'); toast('You have made a lot of drafts today. Your work is safe on this device.'); }
          else if (r.status === 403 || r.status === 404) { paintSave('off', 'Saved on this device'); }
          else { S.dirty = true; paintSave('off', 'Offline: saved on this device'); }
          return;
        }
        if (!S.id && j.id) {
          S.id = j.id;
          try { localStorage.removeItem(LS(null)); } catch {}
          if (j.manageUrl) { S.manageUrl = j.manageUrl; try { localStorage.setItem('sp-ed:manage:' + j.id, j.manageUrl); } catch {} }
          history.replaceState(null, '', '/create/shaadi-paigaam?id=' + encodeURIComponent(j.id));
        }
        S.live = !!j.live; S.status = j.status;
        if (!S.dirty) { S.synced = true; saveLocal(); }
        paintSave('ok', S.live ? 'Saved as draft changes' : 'Saved');
        if (S.live) paintBanner();
      } catch { S.dirty = true; paintSave('off', 'Offline: saved on this device'); setTimeout(() => S.dirty && saveServer(), 8000); }
      finally { S.saving = null; }
    })();
    return S.saving;
  }
  async function ensureDraft() { if (!S.id) { S.dirty = true; await saveServer(); } if (S.saving) await S.saving; return S.id; }
  setInterval(() => { if (S.dirty) saveServer(); }, 4000);
  window.addEventListener('beforeunload', e => { if (!S.synced) { saveLocal(); e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.dirty) { saveLocal(); try { navigator.sendBeacon('/api/shaadi-paigaam/draft', new Blob([JSON.stringify({ id: S.id || undefined, data: S.data })], { type: 'application/json' })); } catch {} } });

  function paintSave(kind, text) { const el = $('#saveState'); if (!el) return; el.className = 'save ' + kind; $('span', el).textContent = text; }

  /* ---------------------------------------------------------- toast & modal */
  let toastT;
  function toast(msg, action, fn, ms = 4200) {
    const t = $('#toast'); t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
    if (action) $('button', t).onclick = () => { t.classList.remove('show'); fn(); };
    t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
  }
  function modal(html, opts = {}) {
    const m = $('#modal'); m.className = 'modal open' + (opts.full ? ' full' : '');
    m.innerHTML = `<div class="box" role="dialog" aria-modal="true">${html}</div>`;
    const close = () => { m.className = 'modal'; m.innerHTML = ''; document.removeEventListener('keydown', onKey); if (opts.onClose) opts.onClose(); if (opts.returnFocus) opts.returnFocus.focus(); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    m.onclick = e => { if (e.target === m && !opts.full) close(); };
    const first = $('button, input, select, textarea', m); if (first) setTimeout(() => first.focus(), 30);
    return { el: m, close };
  }
  function confirmBox(title, text, okLabel = 'Yes, continue', danger) {
    return new Promise(res => {
      const m = modal(`<h3>${esc(title)}</h3><p style="color:var(--muted);margin:0 0 16px">${esc(text)}</p><div class="row" style="justify-content:flex-end"><button class="btn ghost small" data-no>Cancel</button><button class="btn small" data-yes ${danger ? 'style="background:var(--err)"' : ''}>${esc(okLabel)}</button></div>`, { onClose: () => res(false) });
      $('[data-no]', m.el).onclick = () => { m.close(); };
      $('[data-yes]', m.el).onclick = () => { res(true); m.el.className = 'modal'; m.el.innerHTML = ''; };
    });
  }

  /* ---------------------------------------------------------- field builders */
  function fld(o) {
    const id = 'f-' + o.p.replace(/[^a-z0-9]/gi, '-');
    const val = o.value !== undefined ? o.value : getP(o.p);
    const max = o.max ? ` maxlength="${o.max}"` : '';
    const common = `id="${id}" class="in" ${o.bind === false ? '' : `data-path="${o.p}"`} ${o.kind ? `data-kind="${o.kind}"` : ''} ${o.attrs || ''}${max} ${o.req ? 'aria-required="true"' : ''} aria-describedby="${id}-m"`;
    let input;
    if (o.type === 'textarea') input = `<textarea ${common} rows="${o.rows || 3}" placeholder="${esc(o.ph || '')}">${esc(val || '')}</textarea>`;
    else if (o.type === 'select') input = `<select ${common}>${o.options.map(([v, l]) => `<option value="${esc(v)}"${String(val) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    else input = `<input ${common} type="${o.type || 'text'}" value="${esc(val == null ? '' : val)}" placeholder="${esc(o.ph || '')}" ${o.type === 'text' || !o.type ? 'autocomplete="off" spellcheck="true"' : ''}>`;
    const cnt = o.max && o.type !== 'select' ? `<span class="cnt" data-cnt="${id}">${Array.from(String(val || '')).length}/${o.max}</span>` : '';
    return `<div class="f ${o.cls || ''}" data-p="${o.ep || o.p}"><label for="${id}">${esc(o.label)}${o.req ? '<span class="req" aria-hidden="true">*</span>' : o.optional ? '<span class="opt">(optional)</span>' : ''}${cnt}</label>${input}
      <div class="msg e" id="${id}-m" role="alert">${IC.alert}<span></span></div><div class="msg w">${IC.info}<span></span></div>${o.hint ? `<div class="hint">${o.hint}</div>` : ''}</div>`;
  }
  const tgl = (p, label) => `<label class="tg"><input type="checkbox" data-path="${p}" ${getP(p) !== false ? 'checked' : ''}><span class="sw"></span><span>${esc(label)}</span></label>`;
  const card = (title, inner, o = {}) => `<section class="card ${o.off ? 'off' : ''}" ${o.focus ? `data-focus="${o.focus}"` : ''} ${o.id ? `id="${o.id}"` : ''}><h3>${esc(title)}${o.toggle || ''}</h3>${o.sub ? `<p class="sub">${o.sub}</p>` : ''}${inner}</section>`;
  const TITLES_F = [['mr', 'Mr.'], ['dr', 'Dr.'], ['late', 'Late'], ['none', 'No title']];
  const TITLES_M = [['mrs', 'Mrs.'], ['dr', 'Dr.'], ['late', 'Late'], ['none', 'No title']];

  /* ---------------------------------------------------------- STEP 1 */
  function stepCouple() {
    const d = S.data;
    const side = (k, who) => card(who === 'groom' ? 'Groom' : 'Bride', `<div class="grid2">
        ${fld({ p: `couple.${who}.first`, label: 'First name', req: true, max: C.LIMITS.first, kind: 'name', ph: who === 'groom' ? 'Aarav' : 'Ananya', attrs: 'autocapitalize="words"' })}
        ${fld({ p: `couple.${who}.last`, label: 'Family name', optional: true, max: C.LIMITS.last, kind: 'name', ph: who === 'groom' ? 'Deshmukh' : 'Kulkarni', attrs: 'autocapitalize="words"' })}
      </div>
      <div class="parents-f" ${d.couple.showParents ? '' : 'hidden'} style="margin-top:12px">
        <div class="lab">Father</div><div class="split">${fld({ p: `couple.${who}.fatherTitle`, label: 'Title', type: 'select', options: TITLES_F, cls: 'tiny' })}${fld({ p: `couple.${who}.father`, label: 'Name', max: C.LIMITS.parent, kind: 'name', ph: who === 'groom' ? 'Rajendra' : 'Prakash', attrs: 'autocapitalize="words"' })}</div>
        <div class="lab" style="margin-top:10px">Mother</div><div class="split">${fld({ p: `couple.${who}.motherTitle`, label: 'Title', type: 'select', options: TITLES_M, cls: 'tiny' })}${fld({ p: `couple.${who}.mother`, label: 'Name', max: C.LIMITS.parent, kind: 'name', ph: who === 'groom' ? 'Sunita' : 'Meera', attrs: 'autocapitalize="words"' })}</div>
        <div class="hint">The family name is added after the parents automatically: “${esc(C.parentLine(d, 'en', who) || 'Son of Mr. Rajendra & Mrs. Sunita Deshmukh')}”</div>
      </div>`, { focus: 'hero' });
    const styles = Object.entries(I.WELCOME).map(([k, w]) => `<button type="button" class="chip" data-style="${k}" aria-pressed="${d.welcome.style === k}">${esc(w.label)}</button>`).join('');
    return `<h2 class="step-h" tabindex="-1">Couple &amp; families</h2><p class="step-p">Names exactly as you want guests to read them. Long names shrink to fit automatically.</p>
      ${card('Whose name comes first?', `<div class="seg" role="group" aria-label="Name order"><button type="button" data-order="groom" aria-pressed="${d.couple.order !== 'bride'}">Groom first</button><button type="button" data-order="bride" aria-pressed="${d.couple.order === 'bride'}">Bride first</button></div>`)}
      ${side('g', 'groom')}${side('b', 'bride')}
      ${card("Parents' names", `<label class="tg"><input type="checkbox" data-path="couple.showParents" ${d.couple.showParents ? 'checked' : ''}><span class="sw"></span><span>Show the parents' lines under each name</span></label>`, { sub: 'Switch off for a simpler invitation. Your family name then appears under each first name.' })}
      ${card('Welcome message', `<div class="chips" role="group" aria-label="Ready-made styles" style="margin-bottom:10px">${styles}</div>
        ${fld({ p: 'welcome.text', label: 'Your message', type: 'textarea', rows: 5, max: C.LIMITS.welcome, hint: 'Tip: <b>{groom}</b> and <b>{bride}</b> become your first names automatically, in every language.' })}
        <div class="row"><button type="button" class="link" data-ins="{groom}">Insert groom's name</button><span style="color:var(--line)">|</span><button type="button" class="link" data-ins="{bride}">Insert bride's name</button></div>`, { focus: 'welcome', sub: 'Pick a style to start, then make it yours.' })}`;
  }

  /* ---------------------------------------------------------- STEP 2 */
  function stepDates() {
    const d = S.data;
    const at = d.wedding.date && d.wedding.time ? C.zonedToUtc(d.wedding.date, d.wedding.time, d.wedding.tz) : 0;
    const days = at ? Math.ceil((at - Date.now()) / 864e5) : null;
    const evs = d.events.map((e, i) => eventCard(e, i)).join('');
    const quick = EVENT_ORDER.map(t => `<button type="button" class="chip" data-add="${t}">${ART.icon[(I.EVENT_TYPES[t] || {}).icon] || ART.icon.sparkle}${esc(I.eventTypeName(t, 'en'))}</button>`).join('');
    const r = d.rsvp;
    return `<h2 class="step-h" tabindex="-1">Date &amp; events</h2><p class="step-p">The countdown, the Save the Date button and the timeline all follow these details.</p>
      ${card('Wedding date & time', `<div class="grid2">
          ${fld({ p: 'wedding.date', label: 'Date', req: true, type: 'date', attrs: `min="${addDays(today(), 1)}" max="${addDays(today(), 1500)}"` })}
          ${fld({ p: 'wedding.time', label: 'Time', req: true, type: 'time', attrs: 'step="300"' })}
          ${fld({ p: 'wedding.tz', label: 'Time zone', type: 'select', options: TZ.some(([v]) => v === d.wedding.tz) ? TZ : TZ.concat([[d.wedding.tz, d.wedding.tz]]), cls: 'full', hint: 'Guests abroad see a correct countdown. Daylight-saving changes are handled for you.' })}
        </div>${days != null && days > 0 ? `<p class="hint" style="margin-top:10px">${IC.check} ${esc(C.fmtDate(d.wedding.date, 'en', 'full'))} at ${esc(C.fmtTime(d.wedding.time, 'en'))}, that's <b>${days} day${days === 1 ? '' : 's'}</b> away.</p>` : ''}`, { focus: 'countdown' })}
      ${card('Events', `<p class="sub" style="margin-top:-6px">Events before the wedding day appear as Pre-Wedding Events cards; the rest form the Program Timeline, grouped by day and sorted by time. Drag to set the order of events that share a time.</p>
        <div id="evList">${evs}</div>
        <div class="lab" style="margin-top:12px">Add an event</div><div class="chips">${quick}</div>`, { focus: 'timeline' })}
      ${card('RSVP', `<div class="grid2">
          ${fld({ p: 'rsvp.deadline', label: 'Reply by', type: 'date', optional: true, attrs: `min="${today()}" ${d.wedding.date ? `max="${d.wedding.date}"` : ''}` })}
          ${fld({ p: 'rsvp.maxGuests', label: 'Max guests per reply', type: 'select', options: Array.from({ length: 20 }, (_, i) => [i + 1, String(i + 1)]) })}
          ${fld({ p: 'rsvp.email', label: 'Your email for new replies', type: 'email', optional: true, max: 120, ph: 'you@example.com', attrs: 'inputmode="email" autocomplete="email"' })}
          ${fld({ p: 'rsvp.whatsapp', label: 'Your WhatsApp number', type: 'tel', optional: true, max: 18, ph: '98765 43210', attrs: 'inputmode="tel" autocomplete="tel"' })}
        </div>
        <label class="check" style="margin-top:12px"><input type="checkbox" data-path="rsvp.meal" ${r.meal ? 'checked' : ''}><span>Ask guests for a meal preference</span></label>
        <div id="mealOpts" ${r.meal ? '' : 'hidden'} style="margin-top:8px">${fld({ p: 'rsvp.mealText', bind: false, value: r.mealOptions.join(', '), label: 'Meal choices (comma separated)', max: 160, ph: 'Vegetarian, Jain, Non-vegetarian' })}</div>
        <p class="hint">Replies appear in your private dashboard after publishing, with a CSV download. Only you can see them.</p>`, { toggle: tgl('sections.rsvp', 'Show RSVP'), off: d.sections.rsvp === false, focus: 'rsvp' })}`;
  }
  function eventSummary(e) {
    return [e.date ? C.fmtDate(e.date, 'en', 'short') : 'No date yet', e.start ? C.fmtTime(e.start, 'en') + (e.end ? ' – ' + C.fmtTime(e.end, 'en') : '') : ''].filter(Boolean).join(' · ') + (e.venue ? ' · ' + e.venue : '');
  }
  function eventCard(e, i) {
    const p = `events.${e.id}`;
    const errs = (S.v ? S.v.errors : []).filter(x => x.path.startsWith(p + '.'));
    const warns = (S.v ? S.v.warnings : []).filter(x => x.path.startsWith(p + '.'));
    const icon = ART.icon[(I.EVENT_TYPES[e.type] || {}).icon] || ART.icon.sparkle;
    const types = Object.keys(I.EVENT_TYPES).filter(t => t !== 'wedding' || e.main).map(t => [t, t === 'custom' ? 'Other / custom' : I.eventTypeName(t, 'en')]);
    const ev = (f, o) => fld(Object.assign({ p: `${p}.${f}`, bind: false, value: e[f], attrs: `data-ev="${e.id}" data-f="${f}" ${o.attrs || ''}` }, o));
    return `<div class="ev ${e.main ? 'main' : ''} ${S.openEv === e.id ? 'open' : ''}" data-id="${e.id}">
      <div class="ev-h" data-toggle="${e.id}" role="button" tabindex="0" aria-expanded="${S.openEv === e.id}">
        <span class="grip" data-grip="${e.id}" title="Drag to reorder" aria-hidden="true">${IC.grip}</span>
        <span class="eico">${icon}</span><span class="t"><b>${esc(e.name || 'Event')}</b><small>${esc(eventSummary(e))}</small></span>
        ${errs.length ? '<span class="flag">Needs info</span>' : warns.length ? '<span class="flag w">Check</span>' : ''}<span class="chev">${IC.chev}</span></div>
      <div class="ev-b">
        ${e.main ? `<div class="callout ok" style="margin-top:10px">${IC.info}<span>This is your main ceremony. Its date and time follow the wedding date above.</span></div>` : ''}
        <div class="grid2" style="margin-top:10px">
          ${e.main ? '' : ev('type', { label: 'Type', type: 'select', options: types })}
          ${ev('name', { label: 'Event name', req: true, max: C.LIMITS.eventName, cls: e.main ? 'full' : '' })}
          ${e.main ? '' : ev('date', { label: 'Date', req: true, type: 'date', attrs: `data-ev="${e.id}" data-f="date" min="${addDays(today(), -1)}"` })}
          ${e.main ? '' : ev('start', { label: 'Starts', req: true, type: 'time', attrs: `data-ev="${e.id}" data-f="start" step="300"` })}
          ${ev('end', { label: 'Ends', optional: true, type: 'time', attrs: `data-ev="${e.id}" data-f="end" step="300"` })}
          ${ev('venue', { label: 'Place', optional: true, max: C.LIMITS.eventVenue, ph: e.main ? 'Leave empty to use the main venue' : "Bride's residence", cls: 'full' })}
          ${ev('address', { label: 'Area / address', optional: true, max: C.LIMITS.eventAddress, ph: 'Kothrud, Pune', cls: 'full' })}
          ${ev('note', { label: 'Short note', optional: true, max: C.LIMITS.eventNote, ph: 'An evening of henna, music and chai', cls: 'full' })}
          ${ev('dress', { label: 'Dress code for this event', optional: true, max: C.LIMITS.eventDress, ph: 'Shades of green', cls: 'full' })}
        </div>
        <div class="ev-tools">
          <button type="button" class="iconbtn" data-move="-1" data-id="${e.id}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>${IC.up}</button>
          <button type="button" class="iconbtn" data-move="1" data-id="${e.id}" aria-label="Move down" ${i === S.data.events.length - 1 ? 'disabled' : ''}>${IC.down}</button>
          <button type="button" class="iconbtn" data-dup="${e.id}">${IC.dup}<span>Duplicate</span></button>
          ${e.main ? '' : `<button type="button" class="iconbtn" data-del="${e.id}" style="color:var(--err)">${IC.trash}<span>Remove</span></button>`}
        </div>
      </div></div>`;
  }

  /* ---------------------------------------------------------- STEP 3 */
  function venueBlock(prefix, title) {
    const v = S.data[prefix];
    const manual = S['manual_' + prefix] || (!v.verified && (v.name || v.address));
    return `<div class="ac" id="ac-${prefix}">
        <label class="lab" for="q-${prefix}">Search for the venue</label>
        <input id="q-${prefix}" class="in" type="search" autocomplete="off" placeholder="Type the venue name and city, e.g. Shree Palace Lawns Pune" aria-autocomplete="list" aria-controls="acl-${prefix}" aria-expanded="false">
        <div class="ac-list" id="acl-${prefix}" role="listbox"></div>
      </div>
      <div class="hint">${boot.mapsProvider === 'google' ? 'Search by Google Maps.' : 'Search by OpenStreetMap.'} Pick a suggestion so guests get exact directions. <button type="button" class="link" data-manual="${prefix}">${manual ? 'Hide manual entry' : "Can't find it? Enter it yourself"}</button></div>
      <div class="venue-fields" ${v.name || manual ? '' : 'hidden'} style="margin-top:12px">
        <div class="row" style="margin-bottom:8px">${v.verified ? `<span class="verified">${IC.check} Location confirmed</span>` : v.lat != null ? `<span class="verified" style="color:var(--warn)">${IC.pin} Pin placed by you</span>` : ''}</div>
        <div class="grid2">
          ${fld({ p: `${prefix}.name`, label: 'Venue name', req: true, max: C.LIMITS.venueName, cls: 'full' })}
          ${fld({ p: `${prefix}.address`, label: 'Street / area', req: true, max: C.LIMITS.venueAddress, cls: 'full' })}
          ${fld({ p: `${prefix}.city`, label: 'City', max: C.LIMITS.city })}
          ${fld({ p: `${prefix}.state`, label: 'State', max: C.LIMITS.state })}
          ${fld({ p: `${prefix}.pin`, label: 'PIN code', max: 6, attrs: 'inputmode="numeric" pattern="[0-9]*"' })}
        </div>
        <div class="f" data-p="${prefix}.map"><div class="minimap" id="map-${prefix}" aria-label="Map: drag the pin to the exact entrance"></div>
          <div class="msg e" role="alert">${IC.alert}<span></span></div>
          <div class="hint">Drag the pin to the exact entrance. <a href="${esc(C.mapsLinks(v).google)}" target="_blank" rel="noopener" id="test-${prefix}">Test the directions link ↗</a></div></div>
      </div>`;
  }
  function stepVenue() {
    const d = S.data, s = d.sections;
    return `<h2 class="step-h" tabindex="-1">Venue &amp; travel</h2><p class="step-p">The map, “Open in Maps” and “View on Google Maps” are made for you from the place you choose.</p>
      ${card('Wedding venue', venueBlock('venue'), { focus: 'venue' })}
      ${card('Reception at a different place?', `<label class="tg" style="margin-bottom:10px"><input type="checkbox" data-path="reception.enabled" ${d.reception.enabled ? 'checked' : ''}><span class="sw"></span><span>Yes, add a second venue</span></label>${d.reception.enabled ? venueBlock('reception') : ''}`, { focus: 'venue' })}
      ${card('Dress code', `${fld({ p: 'dress.women', label: 'Women', type: 'textarea', rows: 2, max: C.LIMITS.dress, optional: true })}${fld({ p: 'dress.men', label: 'Men', type: 'textarea', rows: 2, max: C.LIMITS.dress, optional: true })}${fld({ p: 'dress.common', label: 'For everyone', type: 'textarea', rows: 2, max: C.LIMITS.dress, optional: true, hint: 'Leave any box empty to skip it.' })}`, { toggle: tgl('sections.dressCode', 'Show'), off: s.dressCode === false, focus: 'dress' })}
      ${card('Transportation', fld({ p: 'transport', label: 'Shuttles, parking, directions', type: 'textarea', rows: 3, max: C.LIMITS.transport, optional: true }), { toggle: tgl('sections.transport', 'Show'), off: s.transport === false, focus: 'transport' })}
      ${card('Accommodation', `${fld({ p: 'accommodation.text', label: 'Where guests can stay', type: 'textarea', rows: 3, max: C.LIMITS.accommodation, optional: true })}${fld({ p: 'accommodation.code', label: 'Booking code', max: C.LIMITS.code, optional: true, ph: 'AARAVANANYA26', hint: 'Guests get a one-tap Copy button.' })}`, { toggle: tgl('sections.accommodation', 'Show'), off: s.accommodation === false, focus: 'stay' })}
      ${card('Gifts', fld({ p: 'gifts', label: 'A gentle note about gifts', type: 'textarea', rows: 3, max: C.LIMITS.gifts, optional: true }), { toggle: tgl('sections.gifts', 'Show'), off: s.gifts === false, focus: 'gifts' })}`;
  }

  /* ---------------------------------------------------------- STEP 4 */
  function stepMedia() {
    const d = S.data;
    const ph = d.photos.map((p, i) => `<div class="ph" data-ph="${i}" draggable="true"><img src="${esc(p.url)}" alt="${esc(p.alt || 'Photo ' + (i + 1))}">${/\/art\/demo-/.test(p.url) ? '<span class="tag">Sample</span>' : ''}
      <div class="tools"><button type="button" data-phalt="${i}" aria-label="Describe photo ${i + 1}">${IC.edit}</button><button type="button" data-phleft="${i}" aria-label="Move photo ${i + 1} earlier" ${i ? '' : 'hidden'}>${IC.up}</button><button type="button" data-phdel="${i}" aria-label="Remove photo ${i + 1}">${IC.trash}</button></div></div>`).join('');
    const canAdd = d.photos.length < C.LIMITS.photos;
    const tracks = C.MUSIC.map(m => `<label class="track ${d.music.track === m.id ? 'on' : ''}"><input type="radio" name="track" value="${m.id}" ${d.music.track === m.id ? 'checked' : ''}><span class="t"><b>${esc(m.title)}</b><small>${esc(m.instrument)} · ${esc(m.category)}</small></span><button type="button" class="play" data-play="/shaadi-paigaam/music/${m.id}.mp3" aria-label="Preview ${esc(m.title)}">${IC.play}</button></label>`).join('');
    return `<h2 class="step-h" tabindex="-1">Photos &amp; music</h2><p class="step-p">JPG, PNG or WEBP. We resize and compress for you, and you choose the crop so no face is ever cut off.</p>
      ${card(`Photo carousel (${d.photos.length}/${C.LIMITS.photos})`, `<div class="ph-grid" id="phGrid">${ph}${canAdd ? `<label class="ph add" tabindex="0">${IC.upload}<span>Add photos</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden id="phInput"></label>` : ''}</div>
        <div class="f" data-p="photos"><div class="msg e" role="alert">${IC.alert}<span></span></div><div class="msg w">${IC.info}<span></span></div></div>
        ${d.photos.some(p => /\/art\/demo-/.test(p.url)) ? `<button type="button" class="link" id="clearSamples">Remove the sample photos</button>` : ''}`, { toggle: tgl('sections.photos', 'Show'), off: d.sections.photos === false, focus: 'photos' })}
      ${card('Couple photo', `<div class="row">${d.couplePhoto ? `<div class="ph" style="width:96px;aspect-ratio:4/5"><img src="${esc(d.couplePhoto.url)}" alt="Couple photo"></div><button type="button" class="btn ghost small" id="cpDel">${IC.trash} Remove</button>` : ''}
          <label class="btn ghost small" tabindex="0">${IC.upload} ${d.couplePhoto ? 'Replace' : 'Add a couple photo'}<input type="file" accept="image/jpeg,image/png,image/webp" hidden id="cpInput"></label></div>
        <p class="hint">Optional. Appears in an arched gold frame above your welcome message.</p>`, { focus: 'welcome' })}
      ${card('Music', `<div id="tracks">${tracks}</div>
        <label class="track ${d.music.track === 'upload' ? 'on' : ''}"><input type="radio" name="track" value="upload" ${d.music.track === 'upload' ? 'checked' : ''} ${d.music.url ? '' : 'disabled'}><span class="t"><b>${d.music.url ? esc(d.music.title || 'Your song') : 'Your own song'}</b><small>${d.music.url ? 'Uploaded' : 'MP3, M4A or AAC, up to 10 MB'}</small></span>
          ${d.music.url ? `<button type="button" class="play" data-play="${esc(d.music.url)}" aria-label="Preview your song">${IC.play}</button>` : ''}<label class="btn ghost small" tabindex="0">${IC.upload} ${d.music.url ? 'Replace' : 'Upload'}<input type="file" accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/aac,audio/ogg" hidden id="muInput"></label></label>
        ${d.music.track === 'upload' ? `<div class="f" data-p="music.rightsOk"><label class="check"><input type="checkbox" data-path="music.rightsOk" ${d.music.rightsOk ? 'checked' : ''}><span>I own this song or have permission to use it. Film songs and commercial music are usually copyrighted.</span></label><div class="msg e" role="alert">${IC.alert}<span></span></div></div>` : ''}
        <label class="check" style="margin-top:10px"><input type="checkbox" data-path="music.startMuted" ${d.music.startMuted ? 'checked' : ''}><span>Start muted (guests tap the speaker to play)</span></label>
        <p class="hint">All ten library tracks are original compositions made for Paigaam, free to use.</p>`, { toggle: tgl('sections.music', 'Play music'), off: d.sections.music === false })}`;
  }

  /* ---------------------------------------------------------- STEP 5 */
  function palCard(p) {
    const b = C.buildPalette({ id: p.id }).palette;
    return `<button type="button" class="pal" data-pal="${p.id}" aria-pressed="${S.data.palette.id === p.id}" style="--a:${b.accent};--c:${b.champagne}">
      <span class="sw"><span class="door" style="background:linear-gradient(90deg,${b.deep},${b.mid},${b.primary}),url(/shaadi-paigaam/art/door-relief.webp) center/cover;background-blend-mode:soft-light"></span><span class="page" style="background:${b.bg};color:${b.heading}">A<span style="font-size:13px;color:${b.accent}">&amp;</span>A</span></span>
      <span class="nm"><i style="background:${b.primary}"></i><i style="background:${b.accent}"></i><i style="background:${b.flower}"></i>${esc(p.name)}</span><span class="tick">${IC.check}</span></button>`;
  }
  function stepStyle() {
    const d = S.data, cu = d.palette.custom;
    const built = C.buildPalette({ id: 'custom', custom: cu });
    const isCustom = d.palette.id === 'custom';
    const pk = (k, label, hint) => `<div class="f"><label for="pc-${k}">${esc(label)}</label><div class="picker"><input type="color" id="pc-${k}" value="${esc(cu[k])}" data-pc="${k}" aria-label="${esc(label)} colour picker"><input class="in" value="${esc(cu[k])}" data-hex="${k}" maxlength="7" aria-label="${esc(label)} hex code"></div><div class="hint">${esc(hint)}</div></div>`;
    const ct = (a, b, need, lab) => { const r = C.contrast(a, b); return `<span class="${r < need ? 'bad' : ''}">${esc(lab)} ${r.toFixed(1)}:1</span>`; };
    return `<h2 class="step-h" tabindex="-1">Colours &amp; style</h2><p class="step-p">Every palette recolours the doors, curtains, flowers, scratch heart, confetti, buttons and icons instantly.</p>
      ${card('Ready-made palettes', `<div class="pals">${C.PALETTES.map(palCard).join('')}</div>`, { focus: 'hero' })}
      ${card('Make your own', `<label class="tg" style="margin-bottom:12px"><input type="checkbox" id="useCustom" ${isCustom ? 'checked' : ''}><span class="sw"></span><span>Use my own colours</span></label>
        <div ${isCustom ? '' : 'hidden'}><div class="grid3">${pk('primary', 'Main colour', 'Doors, buttons, heart')}${pk('accent', 'Accent', 'Gold lines & medallion')}${pk('bg', 'Background', 'Page colour')}</div>
        <p class="hint">We create every other shade (shadows, text, cards, lines) for you, so it always looks harmonious.</p>
        <div class="f" data-p="palette"><div class="msg e" role="alert">${IC.alert}<span></span></div><div class="msg w">${IC.info}<span></span></div></div>
        <div class="contrast" aria-label="Readability checks">${ct(built.palette.heading, built.palette.bg, 4.5, 'Headings')}${ct(built.palette.body, built.palette.bg, 4.5, 'Text')}${ct(built.palette.buttonText, built.palette.button, 4.5, 'Buttons')}</div></div>`, { focus: 'scratch' })}
      <div class="row" style="margin:-4px 0 14px"><button type="button" class="btn ghost small" id="resetPal">${IC.undo} Reset to the default palette</button></div>
      ${card('Font style', `<div class="fonts">${C.FONTS.map(f => `<button type="button" class="font" data-font="${f.id}" aria-pressed="${d.font === f.id}"><span class="s" style="font-family:${f.script};${f.scriptStyle ? 'font-style:italic;' : ''}${f.scriptUpper ? 'text-transform:uppercase;font-size:20px;letter-spacing:.06em;' : ''}">${esc(C.txt(d, d.lang.base, 'couple.groom.first') || 'Aarav')}</span><small style="font-family:${f.serif}">${esc(f.name)}</small></button>`).join('')}</div>`, { focus: 'hero' })}`;
  }

  /* ---------------------------------------------------------- STEP 6 */
  function stepLang() {
    const d = S.data, en = d.lang.enabled;
    const list = Object.entries(I.LANGS).map(([k, L]) => `<label class="lang"><input type="checkbox" data-lang="${k}" ${en.includes(k) ? 'checked' : ''} ${k === d.lang.base ? 'disabled' : ''}><b>${esc(L.native)}</b><small>${esc(L.name)}${L.dir === 'rtl' ? ' · RTL' : ''}</small></label>`).join('');
    const opts = en.map(k => [k, I.LANGS[k].name + ' · ' + I.LANGS[k].native]);
    const fields = C.translatableFields(d);
    const panels = en.filter(l => l !== d.lang.base).map(l => {
      const tr = (d.i18n && d.i18n[l]) || {};
      const done = fields.filter(([p]) => tr[p]).length;
      const items = fields.map(([p, label]) => {
        const orig = C.getPath(d, p);
        const isName = /^couple\./.test(p);
        const long = String(orig || '').length > 70;
        const auto = S.autoTr[l + '|' + p];
        return `<div class="tr-item ${tr[p] ? '' : 'missing'}"><label class="lab" for="tr-${l}-${p.replace(/\W/g, '-')}">${esc(label)}${isName ? '<span class="opt">(optional)</span>' : ''}${auto ? '<span class="pill w">Auto-translated: please check</span>' : ''}</label>
          <div class="orig">${esc(orig)}</div>
          ${long ? `<textarea class="in" rows="3" id="tr-${l}-${p.replace(/\W/g, '-')}" data-tr="${l}|${p}" lang="${l}" dir="${I.LANGS[l].dir}" placeholder="${isName ? 'Type the name in ' + esc(I.LANGS[l].name) + ' script' : 'Type the ' + esc(I.LANGS[l].name) + ' version'}">${esc(tr[p] || '')}</textarea>`
            : `<input class="in" id="tr-${l}-${p.replace(/\W/g, '-')}" data-tr="${l}|${p}" lang="${l}" dir="${I.LANGS[l].dir}" value="${esc(tr[p] || '')}" placeholder="${isName ? 'Type the name in ' + esc(I.LANGS[l].name) + ' script' : 'Type the ' + esc(I.LANGS[l].name) + ' version'}">`}</div>`;
      }).join('');
      return card(`${I.LANGS[l].name} · ${I.LANGS[l].native}`, `<div class="row" style="margin-bottom:6px"><span class="pill ${done < fields.length ? 'w' : ''}">${done} of ${fields.length} translated</span><button type="button" class="btn ghost small" data-autotr="${l}" style="margin-left:auto">✨ Auto-translate the rest</button><button type="button" class="link" data-prevlang="${l}">Preview in ${esc(I.LANGS[l].name)}</button></div>
        <p class="hint">Headings, buttons and dates are translated for you. Anything you leave empty shows in ${esc(I.LANGS[d.lang.base].name)}. Auto-translation is a starting point: please read it before publishing.</p>
        <details ${S.openTr === l ? 'open' : ''} data-trwrap="${l}"><summary style="cursor:pointer;font-weight:600;margin:8px 0">Edit ${esc(I.LANGS[l].name)} text</summary><div class="tr">${items}</div></details>`, { id: 'tr-' + l });
    }).join('');
    return `<h2 class="step-h" tabindex="-1">Language</h2><p class="step-p">Guests switch languages with the floating pill. Each language gets the right fonts and layout, including right-to-left for Urdu and Arabic.</p>
      ${card('Languages on your invitation', `<div class="langs">${list}</div>`)}
      ${card('Main settings', `<div class="grid2">${fld({ p: 'lang.base', label: 'I typed my details in', type: 'select', options: Object.entries(I.LANGS).map(([k, L]) => [k, L.name]) })}${fld({ p: 'lang.default', label: 'Guests first see', type: 'select', options: opts })}</div>`)}
      ${panels}`;
  }

  /* ---------------------------------------------------------- STEP 7 */
  function stepReview() {
    const d = S.data, v = S.v;
    const items = C.checklist(v);
    const warnings = v.warnings.filter(w => /photos|welcome|venue\.pin|couple\..*father/.test(w.path));
    const sch = C.schedule(d);
    const b = C.buildPalette(d.palette).palette;
    const shown = C.TOGGLES.filter(k => d.sections[k]).map(k => C.TOGGLE_LABELS[k]);
    const hidden = C.TOGGLES.filter(k => !d.sections[k]).map(k => C.TOGGLE_LABELS[k]);
    const sum = (title, step, rows) => `<div class="card"><h3>${esc(title)}<button type="button" class="link" data-go="${step}" style="margin-left:auto">Edit</button></h3><dl>${rows.map(([k, val]) => `<dt>${esc(k)}</dt><dd>${val}</dd>`).join('')}</dl></div>`;
    const errs = items.filter(x => x.kind === 'error');
    const price = Number(boot.price) || 0;
    const ready = !errs.length;
    const slug = S.slug || (S.slugInput != null ? S.slugInput : (C.slugSuggestions(d)[0] || ''));
    if (S.slugInput == null) S.slugInput = slug;
    return `<h2 class="step-h" tabindex="-1">${S.live ? 'Review &amp; update' : 'Review &amp; publish'}</h2><p class="step-p">${S.live ? 'Changes go live instantly on the same link.' : price ? `Creating and previewing is free. You pay ₹${price.toLocaleString('en-IN')} only when you publish.` : 'Creating, previewing and publishing are free.'}</p>
      ${card('Privacy', `<div class="grid2">${fld({ p: 'access.passcode', label: 'Guest passcode', optional: true, max: C.LIMITS.passcode, ph: 'Leave empty for an open invitation', hint: 'Guests type this once to open the invitation.' })}
        ${fld({ p: 'access.expireDays', label: 'Close the invitation', type: 'select', options: [[0, 'Never'], [7, '7 days after the wedding'], [30, '30 days after the wedding'], [90, '90 days after the wedding'], [365, '1 year after the wedding']] })}</div>`)}
      <div class="sum">
        ${sum('Couple', 0, [['Names', esc(C.txt(d, d.lang.base, 'couple.groom.first') + ' ' + d.couple.groom.last) + ' &amp; ' + esc(d.couple.bride.first + ' ' + d.couple.bride.last)], ['Parents', d.couple.showParents ? 'Shown' : 'Hidden']])}
        ${sum('Date', 1, [['Wedding', esc(d.wedding.date ? C.fmtDate(d.wedding.date, 'en', 'full') + ', ' + C.fmtTime(d.wedding.time, 'en') : 'Not set')], ['Time zone', esc((TZ.find(t => t[0] === d.wedding.tz) || [0, d.wedding.tz])[1])], ['Events', esc(d.events.length + ' (' + sch.pre.length + ' before the wedding day)')], ['RSVP', d.sections.rsvp ? esc(d.rsvp.deadline ? 'By ' + C.fmtDate(d.rsvp.deadline, 'en', 'long') : 'On, no deadline') : 'Off']])}
        ${sum('Venue', 2, [['Wedding', esc([d.venue.name, d.venue.city].filter(Boolean).join(', ') || 'Not set')], ...(d.reception.enabled ? [['Reception', esc([d.reception.name, d.reception.city].filter(Boolean).join(', '))]] : [])])}
        ${sum('Look', 4, [['Palette', `<span style="display:inline-flex;gap:4px;vertical-align:middle">${[b.primary, b.accent, b.bg, b.flower].map(c => `<i style="width:14px;height:14px;border-radius:50%;background:${c};box-shadow:0 0 0 1px #0002;display:inline-block"></i>`).join('')}</span> ${esc(d.palette.id === 'custom' ? 'My own colours' : C.PALETTE_BY_ID[d.palette.id].name)}`], ['Font', esc(C.FONT_BY_ID[d.font].name)], ['Shown', esc(shown.join(', ') || 'Essentials only')], ...(hidden.length ? [['Hidden', esc(hidden.join(', '))]] : [])])}
        ${sum('Language', 5, [['Languages', esc(d.lang.enabled.map(l => I.LANGS[l].name).join(', '))], ['Guests see', esc(I.LANGS[d.lang.default].name + ' first')]])}
      </div>
      ${card('Checklist', `<ul class="cl">${items.map(x => `<li class="${x.kind === 'error' ? 'e' : 't'}">${x.kind === 'error' ? IC.alert : IC.info}<span>${esc(x.msg)}</span><button type="button" class="link" data-fix="${esc(x.path)}" data-step="${x.step - 1}">Fix</button></li>`).join('')}
        ${warnings.map(w => `<li class="w">${IC.info}<span>${esc(w.msg)}</span><button type="button" class="link" data-fix="${esc(w.path)}" data-step="${STEP_OF[w.path.split('.')[0]] || 0}">Review</button></li>`).join('')}
        ${!items.length && !warnings.length ? `<li class="ok">${IC.check}<span>Everything looks perfect.</span></li>` : ''}</ul>`, { id: 'checklistCard' })}
      ${S.live ? '' : card('Your link', `<div class="slug"><span>paigaam.cc/</span><input id="slugIn" aria-label="Your link: paigaam.cc/" value="${esc(slug)}" maxlength="40" autocapitalize="none" autocomplete="off" spellcheck="false" aria-describedby="slugSt"></div><div class="slug-st" id="slugSt" aria-live="polite"></div><div class="chips" id="slugSug" style="margin-top:8px"></div><p class="hint">Lowercase letters, numbers and hyphens. It can't change after publishing.</p>`)}
      <section class="card"><label class="check"><input type="checkbox" id="confirmed" ${S.confirmed ? 'checked' : ''}><span><b>I have checked all details</b>: names, dates, times, venue and spellings.</span></label>
        <div class="row" style="margin-top:14px"><button type="button" class="btn" id="publishBtn" style="flex:1">${S.live ? 'Update live invitation' : price ? `Publish · ₹${price.toLocaleString('en-IN')}` : 'Publish my invitation'}</button>
        <button type="button" class="btn ghost" id="guestBtn2">${IC.eye} Preview as guest</button></div>
        <p class="hint" id="pubWhy">${ready ? '' : `Publishing unlocks when the checklist above has no red items (${errs.length} left).`}</p></section>`;
  }

  /* ---------------------------------------------------------- dashboard (after publishing) */
  function dashboard() {
    const url = location.origin + '/' + S.slug;
    const names = C.txt(S.data, S.data.lang.base, 'couple.groom.first') + ' & ' + C.txt(S.data, S.data.lang.base, 'couple.bride.first');
    const tabs = [['edit', 'Edit invitation'], ['guests', 'Guests (RSVP)'], ['share', 'Share'], ['versions', 'Versions']];
    return `<div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${S.tab === k}">${l}</button>`).join('')}</div>
      <div id="dash"></div>`;
  }
  function shareHtml() {
    const url = location.origin + '/' + S.slug;
    const d = S.data;
    const names = [C.txt(d, d.lang.base, 'couple.groom.first'), C.txt(d, d.lang.base, 'couple.bride.first')];
    if (d.couple.order === 'bride') names.reverse();
    const msg = `${names.join(' & ')} are getting married! 💍\n${C.fmtDate(d.wedding.date, 'en', 'full')}\n${[d.venue.name, d.venue.city].filter(Boolean).join(', ')}\n\nOpen our invitation: ${url}`;
    const manage = S.manageUrl || (() => { try { return localStorage.getItem('sp-ed:manage:' + S.id) || ''; } catch { return ''; } })();
    return `<div class="card done-card"><div style="color:#B8924A;width:36px;height:36px;margin:0 auto">${ART.icon.heartFill}</div><h2>Your invitation is live</h2><p class="step-p" style="margin:0">Edit any time. Changes go live on the same link.</p>
      <div class="url"><input class="in" readonly value="${esc(url)}" id="liveUrl" aria-label="Invitation link"><button type="button" class="btn small" data-copy="${esc(url)}">${IC.link} Copy</button></div>
      <div class="share"><a class="btn wa" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${IC.wa} WhatsApp</a><a class="btn ghost" href="${esc(url)}" target="_blank" rel="noopener">${IC.eye} Open</a>
        <a class="btn ghost" href="/shaadi-paigaam/qr/${encodeURIComponent(S.id)}.png" download>${IC.qr} QR code</a><a class="btn ghost" href="/shaadi-paigaam/card/${encodeURIComponent(S.id)}.jpg?kind=story&download=1" download>${IC.image} Story image</a></div>
      <div class="og"><img src="/shaadi-paigaam/card/${encodeURIComponent(S.id)}.jpg?t=${Date.now()}" alt="The preview card guests see on WhatsApp" loading="lazy" onerror="this.parentNode.hidden=true"></div>
      <p class="hint">This is the preview card WhatsApp shows with your link.</p></div>
      ${manage ? card('Your private manage link', `<p class="sub">Bookmark this. It opens your editor and guest list on any phone or computer. Don't share it.</p><div class="url row"><input class="in" readonly value="${esc(manage)}" style="flex:1" aria-label="Private manage link"><button type="button" class="btn ghost small" data-copy="${esc(manage)}">Copy</button></div>`) : ''}`;
  }
  async function guestsHtml(box) {
    box.innerHTML = '<div class="empty">Loading replies…</div>';
    try {
      const r = await fetch('/api/shaadi-paigaam/rsvps?id=' + encodeURIComponent(S.id), { credentials: 'same-origin' });
      const j = await r.json();
      const t = j.totals;
      box.innerHTML = `<div class="stats"><div class="stat"><b>${t.responses}</b><small>Replies</small></div><div class="stat"><b>${t.attending}</b><small>Coming</small></div><div class="stat"><b>${t.guests}</b><small>Total guests</small></div><div class="stat"><b>${t.declined}</b><small>Can't come</small></div></div>
        ${Object.keys(t.meals).length ? `<p class="hint">Meals: ${Object.entries(t.meals).map(([k, n]) => esc(k) + ' ' + n).join(' · ')}</p>` : ''}
        <div class="row" style="margin:10px 0"><a class="btn ghost small" href="/shaadi-paigaam/rsvps/${encodeURIComponent(S.id)}.csv">Download CSV</a><button type="button" class="btn ghost small" id="rsvpRefresh">${IC.replay} Refresh</button></div>
        ${j.rows.length ? `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Name</th><th>Reply</th><th>Guests</th><th>Meal</th><th>Contact</th><th>Message</th></tr></thead><tbody>${j.rows.map(x => `<tr><td>${esc(x.name)}</td><td><span class="${x.attending === 'yes' ? 'yes' : 'no'}">${x.attending === 'yes' ? 'Coming' : 'Not coming'}</span></td><td>${x.guests || '–'}</td><td>${esc(x.meal || '–')}</td><td>${esc(x.email || '')}${x.email && x.phone ? '<br>' : ''}${esc(x.phone || '')}</td><td>${esc(x.message || '')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No replies yet. Share your link and they will appear here.</div>'}`;
      const rf = $('#rsvpRefresh', box); if (rf) rf.onclick = () => guestsHtml(box);
    } catch { box.innerHTML = '<div class="empty">Could not load replies. Check your connection and try again.</div>'; }
  }
  async function versionsHtml(box) {
    box.innerHTML = '<div class="empty">Loading…</div>';
    try {
      const j = await (await fetch('/api/shaadi-paigaam/versions?id=' + encodeURIComponent(S.id), { credentials: 'same-origin' })).json();
      box.innerHTML = j.versions.length ? `<p class="sub">Every time you publish or update, we keep a copy. Restoring loads it into the editor; nothing changes for guests until you press “Update live invitation”.</p><ul class="cl">${j.versions.map(x => `<li class="ok">${IC.check}<span>${esc(x.note || 'Saved')} · ${esc(new Date(x.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }))}</span><button type="button" class="link" data-restore="${x.id}">Restore</button></li>`).join('')}</ul>` : '<div class="empty">No versions yet.</div>';
      $$('[data-restore]', box).forEach(b => b.onclick = async () => {
        if (!(await confirmBox('Restore this version?', 'Your current draft will be replaced. You can undo this.', 'Restore'))) return;
        const r = await fetch('/api/shaadi-paigaam/restore', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ id: S.id, version: Number(b.dataset.restore) }) });
        if (!r.ok) return toast('Could not restore. Please try again.');
        willChange(); S.data = (await r.json()).data; S.tab = 'edit'; S.step = 0; changed({ noUndo: true }); render(); toast('Version restored. Press “Update live invitation” when ready.');
      });
    } catch { box.innerHTML = '<div class="empty">Could not load versions.</div>'; }
  }
  function paintBanner() {
    const el = $('#liveBanner'); if (!el) return;
    el.hidden = !S.live || S.tab !== 'edit';
    if (S.live) $('span', el).textContent = 'You are editing a live invitation. Changes are saved as a draft until you update.';
  }

  /* ---------------------------------------------------------- render */
  function render() {
    $('#app').innerHTML = `
      <header class="top">
        <a class="logo" href="/templates" aria-label="Paigaam home"><img src="/brand/logo-full.png" srcset="/brand/logo-full@2x.png 2x" alt="Paigaam" width="60" height="30"></a>
        <span class="title">Your wedding invitation</span><span class="sp"></span>
        <span class="save ok" id="saveState" role="status"><i></i><span>${S.synced ? 'Saved' : 'Saving…'}</span></span>
        <button type="button" class="iconbtn" id="undoBtn" aria-label="Undo" title="Undo (Ctrl+Z)">${IC.undo}</button>
        <button type="button" class="iconbtn" id="redoBtn" aria-label="Redo" title="Redo (Ctrl+Shift+Z)">${IC.redo}</button>
        <button type="button" class="iconbtn desk-only" id="guestBtn">${IC.eye}<span>Preview as guest</span></button>
      </header>
      <div class="panel">
        <div class="progress"><div class="bar" aria-hidden="true"><i id="barFill"></i></div><nav class="steps" id="stepNav" aria-label="Steps">${STEPS.map((s, i) => `<button type="button" data-step="${i}" title="${esc(s.t)}"><b>${i + 1}</b>${esc(s.short)}</button>`).join('')}</nav></div>
        <div class="body" id="body"></div>
        <div class="nav"><button type="button" class="btn ghost" id="backBtn">Back</button><button type="button" class="btn ghost mobile-only" id="mPrev">${IC.eye} Preview</button><span class="sp desk-only"></span><button type="button" class="link reset desk-only" id="resetStep">Reset this step</button><button type="button" class="btn" id="nextBtn">Next</button></div>
      </div>
      <div class="stage" aria-label="Live preview">
        <div class="stage-bar"><div class="devices" role="group" aria-label="Preview size">${[['phone', 'Phone'], ['tablet', 'Tablet'], ['laptop', 'Laptop']].map(([k, l]) => `<button type="button" data-dev="${k}" aria-pressed="${S.device === k}">${IC[k]}<span>${l}</span></button>`).join('')}</div>
          <button type="button" class="iconbtn" id="replayBtn">${IC.replay}<span>Replay opening</span></button>
          <select class="iconbtn" id="pvLang" aria-label="Preview language">${S.data.lang.enabled.map(l => `<option value="${l}" ${(S.previewLang || S.data.lang.default) === l ? 'selected' : ''}>${esc(I.LANGS[l].native)}</option>`).join('')}</select></div>
        <div class="frame-wrap" id="frameWrap"><div class="device phone" id="device"><span class="notch"></span><iframe id="pv" title="Live preview of your invitation" src="/shaadi-paigaam/frame" width="390" height="844"></iframe></div></div>
      </div>`;
    bindChrome();
    renderStep();
    sizeDevice();
  }
  function renderStep(keepScroll) {
    const body = $('#body'); const y = body.scrollTop;
    let html = '';
    if (S.live) html += `<div class="banner" id="liveBanner" ${S.tab === 'edit' ? '' : 'hidden'}>${IC.info}<span></span><button type="button" class="btn small" id="updateLive">Update live</button></div>${dashboard()}`;
    if (!S.live || S.tab === 'edit') html += [stepCouple, stepDates, stepVenue, stepMedia, stepStyle, stepLang, stepReview][S.step]();
    body.innerHTML = html;
    $$('#stepNav button').forEach((b, i) => b.setAttribute('aria-current', i === S.step ? 'step' : 'false'));
    $('.panel .nav').hidden = S.live && S.tab !== 'edit';
    $('#backBtn').disabled = S.step === 0;
    $('#nextBtn').textContent = S.step === STEPS.length - 1 ? 'Done' : (matchMedia('(max-width: 420px)').matches ? 'Next' : 'Next: ' + STEPS[S.step + 1].short);
    $('#nextBtn').hidden = S.step === STEPS.length - 1;
    bindStep();
    if (S.live) bindDash();
    paintErrors(); paintProgress(); paintBanner();
    if (keepScroll) body.scrollTop = y; else { body.scrollTop = 0; const h = $('.step-h', body); if (h && S.userNav) h.focus({ preventScroll: true }); }
  }
  function bindDash() {
    $$('[data-tab]').forEach(b => b.onclick = () => { S.tab = b.dataset.tab; renderStep(); });
    const box = $('#dash'); if (!box) return;
    if (S.tab === 'share') { box.innerHTML = shareHtml(); bindCopy(box); }
    if (S.tab === 'guests') guestsHtml(box);
    if (S.tab === 'versions') versionsHtml(box);
    const u = $('#updateLive'); if (u) u.onclick = () => publish();
  }
  function bindCopy(root) {
    $$('[data-copy]', root).forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); } catch { const t = document.createElement('textarea'); t.value = b.dataset.copy; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); } toast('Copied'); });
  }

  /* ---------------------------------------------------------- errors & progress */
  function paintErrors() {
    if (!S.v) validateNow();
    const errs = S.v.errors, warns = S.v.warnings;
    $$('.f[data-p]').forEach(f => {
      const p = f.dataset.p;
      const e = errs.find(x => x.path === p), w = warns.find(x => x.path === p);
      const show = e && (S.touched.has(p) || S.tried.has(S.step) || S.step === 6 || p === 'palette' || p === 'music.rightsOk');
      f.classList.toggle('bad', !!show);
      const em = $('.msg.e span', f); if (em) em.textContent = show ? e.msg : '';
      const input = $('.in', f); if (input) input.setAttribute('aria-invalid', show ? 'true' : 'false');
      f.classList.toggle('warned', !!w && !show);
      const wm = $('.msg.w span', f); if (wm) wm.textContent = w ? w.msg : '';
    });
    // event headers flags
    $$('.ev').forEach(ev => {
      const id = ev.dataset.id, p = 'events.' + id + '.';
      const h = $('.ev-h', ev); let flag = $('.flag', h);
      const hasE = errs.some(x => x.path.startsWith(p)), hasW = warns.some(x => x.path.startsWith(p));
      if (flag) flag.remove();
      if (hasE || hasW) { flag = document.createElement('span'); flag.className = 'flag' + (hasE ? '' : ' w'); flag.textContent = hasE ? 'Needs info' : 'Check'; $('.chev', h).before(flag); }
      const e = evById(id); if (e) { $('.t b', h).textContent = e.name || 'Event'; $('.t small', h).textContent = eventSummary(e); }
    });
    const btn = $('#publishBtn');
    if (btn) {
      const ok = !errs.length && $('#confirmed') && $('#confirmed').checked && (S.live || (S.slugState && S.slugState.available));
      btn.disabled = !ok;
      const why = $('#pubWhy');
      if (why) why.textContent = errs.length ? `Publishing unlocks when the checklist above has no red items (${errs.length} left).` : !$('#confirmed').checked ? 'Tick “I have checked all details” to continue.' : (!S.live && !(S.slugState && S.slugState.available)) ? 'Choose an available link above.' : '';
    }
  }
  function paintProgress() {
    if (!S.v) validateNow();
    const bad = new Set(S.v.errors.map(e => STEP_OF[e.path.split('.')[0]]));
    $$('#stepNav button').forEach((b, i) => { b.classList.toggle('bad', bad.has(i) && (S.tried.has(i) || S.visited && S.visited.has(i) && i !== S.step)); b.classList.toggle('done', !bad.has(i) && S.visited && S.visited.has(i) && i !== S.step); });
    const fill = $('#barFill'); if (fill) fill.style.width = Math.round(((S.step + 1) / STEPS.length) * 100) + '%';
    const ub = $('#updateLive'); if (ub) ub.disabled = !!S.v.errors.length;
  }

  /* ---------------------------------------------------------- preview */
  let pvReady = false, pvT = 0, pvFocus = null;
  function postPreview(focus) {
    if (focus) pvFocus = focus;
    clearTimeout(pvT);
    pvT = setTimeout(() => {
      const f = $('#pv'); if (!f || !pvReady) return;
      f.contentWindow.postMessage({ type: 'sp:data', data: S.data, focus: pvFocus, lang: S.previewLang || undefined }, location.origin);
      pvFocus = null;
      const g = $('#gpFrame'); if (g && g.dataset.ready) g.contentWindow.postMessage({ type: 'sp:data', data: S.data, lang: S.previewLang || undefined }, location.origin);
    }, 140);
  }
  window.addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.type === 'sp:ready') {
      const pv = $('#pv'), g = $('#gpFrame');
      if (pv && e.source === pv.contentWindow) { pvReady = true; postPreview(STEPS[S.step].focus); }
      if (g && e.source === g.contentWindow) { g.dataset.ready = '1'; g.contentWindow.postMessage({ type: 'sp:data', data: S.data, lang: S.previewLang || undefined }, location.origin); }
    }
  });
  const DEV = { phone: [390, 844], tablet: [820, 1180], laptop: [1366, 820] };
  function sizeDevice() {
    const wrap = $('#frameWrap'), dev = $('#device'), f = $('#pv'); if (!wrap || !dev) return;
    const [w, h] = DEV[S.device]; f.width = w; f.height = h;
    dev.className = 'device ' + S.device;
    const pad = S.device === 'phone' ? 24 : S.device === 'tablet' ? 32 : 46;
    const aw = wrap.clientWidth - 32, ah = wrap.clientHeight - 20;
    const sc = Math.min(1, aw / (w + pad), ah / (h + pad));
    dev.style.transform = `scale(${sc})`;
    dev.style.marginBottom = -((h + pad) * (1 - sc)) + 'px';
  }
  window.addEventListener('resize', debounce(sizeDevice, 100));

  function guestPreview() {
    const mobile = matchMedia('(max-width: 900px)').matches;
    let dev = mobile ? 'native' : 'phone';
    const m = modal(`<div class="gp-bar"><b style="font-family:'Cormorant Garamond',serif;font-size:20px">Preview as guest</b><span class="sp"></span>
      ${mobile ? '' : `<div class="devices" role="group" aria-label="Device">${[['phone', 'Phone'], ['tablet', 'Tablet'], ['laptop', 'Laptop']].map(([k, l]) => `<button type="button" data-gdev="${k}" aria-pressed="${dev === k}">${IC[k]}<span>${l}</span></button>`).join('')}</div>`}
      <button type="button" class="iconbtn" id="gpReplay">${IC.replay}<span>Replay</span></button><button type="button" class="iconbtn" id="gpClose" aria-label="Close preview">${IC.x}</button></div>
      <div class="gp-stage" id="gpStage"><div class="device ${dev}" id="gpDev"><iframe id="gpFrame" title="Guest preview" src="/shaadi-paigaam/frame?guest=1"></iframe></div></div>`, { full: true });
    const size = () => {
      if (dev === 'native') return;
      const st = $('#gpStage'), d = $('#gpDev'), f = $('#gpFrame'); if (!st) return;
      const [w, h] = DEV[dev]; f.width = w; f.height = h; d.className = 'device ' + dev;
      const pad = dev === 'phone' ? 24 : 40; const sc = Math.min(1, (st.clientWidth - 20) / (w + pad), (st.clientHeight - 16) / (h + pad));
      d.style.transform = `scale(${sc})`; d.style.transformOrigin = 'top center'; d.style.marginBottom = -((h + pad) * (1 - sc)) + 'px';
    };
    size(); window.addEventListener('resize', size);
    $$('[data-gdev]').forEach(b => b.onclick = () => { dev = b.dataset.gdev; $$('[data-gdev]').forEach(x => x.setAttribute('aria-pressed', x === b)); size(); });
    $('#gpReplay').onclick = () => { const f = $('#gpFrame'); f.dataset.ready = ''; f.src = '/shaadi-paigaam/frame?guest=1&r=' + Date.now(); };
    $('#gpClose').onclick = () => { window.removeEventListener('resize', size); m.close(); };
  }

  /* ---------------------------------------------------------- chrome bindings */
  function go(step, user) {
    if (step < 0 || step >= STEPS.length) return;
    S.visited = S.visited || new Set(); S.visited.add(S.step);
    S.step = step; S.userNav = !!user; S.tab = 'edit';
    renderStep(); postPreview(STEPS[step].focus);
    try { localStorage.setItem('sp-ed:step:' + (S.id || 'new'), String(step)); } catch {}
  }
  function bindChrome() {
    $('#undoBtn').onclick = undo; $('#redoBtn').onclick = redo; paintUndo();
    $('#guestBtn').onclick = guestPreview; $('#mPrev').onclick = guestPreview;
    $('#backBtn').onclick = () => go(S.step - 1, true);
    $('#nextBtn').onclick = () => {
      S.tried.add(S.step); validateNow(); paintErrors(); paintProgress();
      const firstBad = $('.f.bad');
      if (firstBad) { toast('A few details need your attention. You can also come back to them later.', 'Continue anyway', () => go(S.step + 1, true), 6000); firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' }); const i = $('.in', firstBad); if (i) i.focus({ preventScroll: true }); return; }
      go(S.step + 1, true);
    };
    $$('#stepNav button').forEach(b => b.onclick = () => go(Number(b.dataset.step), true));
    $('#resetStep').onclick = resetStep;
    $$('[data-dev]').forEach(b => b.onclick = () => { S.device = b.dataset.dev; $$('[data-dev]').forEach(x => x.setAttribute('aria-pressed', x === b)); sizeDevice(); });
    $('#replayBtn').onclick = () => { const f = $('#pv'); if (f) f.contentWindow.postMessage({ type: 'sp:replay' }, location.origin); };
    $('#pvLang').onchange = e => { S.previewLang = e.target.value; postPreview(); };
    document.onkeydown = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.target.matches('input,textarea')) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !e.target.matches('input,textarea')) { e.preventDefault(); redo(); }
    };
  }
  async function resetStep() {
    const id = STEPS[S.step].id;
    if (!(await confirmBox('Reset this step?', 'This puts the sample content back for this step only. You can undo it straight away.', 'Reset step'))) return;
    willChange();
    const s = clone(C.SAMPLE), d = S.data;
    if (id === 'couple') { d.couple = s.couple; d.welcome = s.welcome; }
    if (id === 'dates') { d.wedding = s.wedding; d.events = s.events; d.rsvp = s.rsvp; d.sections.rsvp = true; }
    if (id === 'venue') { d.venue = s.venue; d.reception = s.reception; d.dress = s.dress; d.transport = s.transport; d.accommodation = s.accommodation; d.gifts = s.gifts; ['dressCode', 'transport', 'accommodation', 'gifts'].forEach(k => d.sections[k] = true); }
    if (id === 'media') { d.photos = s.photos; d.couplePhoto = null; d.music = s.music; d.sections.photos = true; d.sections.music = true; }
    if (id === 'style') { d.palette = s.palette; d.font = s.font; }
    if (id === 'lang') { d.lang = s.lang; d.i18n = s.i18n; }
    if (id === 'review') { d.access = s.access; }
    changed({ noUndo: true }); renderStep(); toast('Step reset.', 'Undo', undo);
  }

  /* ---------------------------------------------------------- generic field binding */
  const NAME_BAD = /[\p{Extended_Pictographic}\p{N}@#$%^&*()_+=\[\]{}<>\\/|;:"~`!?,€£₹¥§°•…]/u;
  function bindStep() {
    const body = $('#body');
    $$('[data-path]', body).forEach(el => {
      const path = el.dataset.path;
      const isNum = path === 'rsvp.maxGuests' || path === 'access.expireDays';
      const ev = el.type === 'checkbox' ? 'change' : (el.tagName === 'SELECT' || el.type === 'date' || el.type === 'time' ? 'change' : 'input');
      el.addEventListener(ev, () => {
        let v = el.type === 'checkbox' ? el.checked : el.value;
        if (isNum) v = Number(v);
        if (path.endsWith('.pin')) { v = String(v).replace(/\D/g, '').slice(0, 6); if (el.value !== v) el.value = v; }
        if (path === 'accommodation.code') { v = v.toUpperCase().replace(/\s/g, ''); el.value = v; }
        setP(path, v);
        if (path === 'wedding.date' || path === 'wedding.time') { for (const e of S.data.events) if (e.main) { e.date = S.data.wedding.date; e.start = S.data.wedding.time; } }
        changed({ focus: focusFor(el) });
        counter(el);
        if (el.type === 'checkbox' && /^sections\.|showParents|reception\.enabled|rsvp\.meal$|music\./.test(path)) renderStep(true);
        if (path === 'lang.base' || path === 'lang.default') renderStep(true);
        if (path === 'wedding.date' && S.step === 1) refreshDays();
      });
      if (el.dataset.kind === 'name') bindName(el, () => { setP(path, el.value); changed({ focus: 'hero' }); });
      el.addEventListener('blur', () => { S.touched.add(el.closest('.f') ? el.closest('.f').dataset.p : path); paintErrors(); });
    });
    $$('[data-cnt]', body).forEach(c => counter($('#' + c.dataset.cnt)));
    $$('[data-style]', body).forEach(b => b.onclick = async () => {
      const k = b.dataset.style, cur = S.data.welcome.text, std = Object.values(I.WELCOME).some(w => w.en === cur);
      if (cur && !std && !(await confirmBox('Replace your message?', 'Your own words will be replaced by this style. You can undo it.', 'Use this style'))) return;
      willChange(); S.data.welcome.style = k; S.data.welcome.text = I.WELCOME[k][S.data.lang.base] || I.WELCOME[k].en;
      changed({ noUndo: true, focus: 'welcome' }); renderStep(true);
    });
    $$('[data-ins]', body).forEach(b => b.onclick = () => {
      const ta = $('#f-welcome-text'); const s = ta.selectionStart ?? ta.value.length, e = ta.selectionEnd ?? s;
      ta.value = ta.value.slice(0, s) + b.dataset.ins + ta.value.slice(e); ta.focus(); ta.setSelectionRange(s + b.dataset.ins.length, s + b.dataset.ins.length);
      ta.dispatchEvent(new Event('input'));
    });
    $$('[data-order]', body).forEach(b => b.onclick = () => { willChange(); S.data.couple.order = b.dataset.order; changed({ noUndo: true, focus: 'hero' }); renderStep(true); });
    bindEvents(body); bindVenue(body); bindMedia(body); bindStyle(body); bindLang(body); bindReview(body);
    $$('.card[data-focus]', body).forEach(c => c.addEventListener('focusin', () => { if (S.lastFocus !== c.dataset.focus) { S.lastFocus = c.dataset.focus; postPreview(c.dataset.focus); } }));
    const mt = $('#f-rsvp-mealText', body);
    if (mt) mt.addEventListener('input', () => { S.data.rsvp.mealOptions = mt.value.split(',').map(x => x.trim()).filter(Boolean).slice(0, 6); changed({ focus: 'rsvp' }); counter(mt); });
  }
  function focusFor(el) { const c = el.closest('[data-focus]'); return c ? c.dataset.focus : null; }
  function counter(el) {
    if (!el) return; const c = $(`[data-cnt="${el.id}"]`); if (!c) return;
    const n = Array.from(el.value).length, max = Number(el.getAttribute('maxlength')) || 0;
    c.textContent = `${n}/${max}`; c.classList.toggle('near', max && n > max * 0.9);
  }
  function bindName(el, commit) {
    el.addEventListener('input', () => {
      if (NAME_BAD.test(el.value)) { const pos = el.selectionStart; const v = el.value.replace(new RegExp(NAME_BAD.source, 'gu'), ''); const cut = el.value.length - v.length; el.value = v; try { el.setSelectionRange(Math.max(0, pos - cut), Math.max(0, pos - cut)); } catch {} commit(); }
    });
    el.addEventListener('beforeinput', e => {
      if (e.data && Array.from(e.data).length <= 2 && NAME_BAD.test(e.data)) {
        e.preventDefault();
        const f = el.closest('.f'); const w = $('.msg.w span', f);
        if (w) { w.textContent = 'Names can have letters, spaces, hyphens (-), apostrophes (\') and dots only.'; f.classList.add('warned'); setTimeout(() => { if (w.textContent.startsWith('Names can')) { w.textContent = ''; f.classList.remove('warned'); } }, 3500); }
      }
    });
    el.addEventListener('paste', () => setTimeout(() => { const v = el.value.replace(new RegExp(NAME_BAD.source, 'gu'), ''); if (v !== el.value) { el.value = v; commit(); } }, 0));
    el.addEventListener('blur', () => { const r = C.cleanName(el.value, Number(el.getAttribute('maxlength')) || 40); if (r.ok && r.value !== el.value) { el.value = r.value; commit(); } });
  }
  function refreshDays() { /* the date card re-renders on next step render; keep it light */ }

  /* ---------------------------------------------------------- events */
  function bindEvents(body) {
    const list = $('#evList', body); if (!list) return;
    $$('[data-toggle]', list).forEach(h => {
      const toggle = e => { if (e.target.closest('[data-grip]')) return; const id = h.dataset.toggle; S.openEv = S.openEv === id ? null : id; const ev = h.closest('.ev'); $$('.ev', list).forEach(x => { x.classList.toggle('open', x.dataset.id === S.openEv); $('.ev-h', x).setAttribute('aria-expanded', x.dataset.id === S.openEv); }); if (S.openEv) postPreview(evById(id) && evById(id).date < S.data.wedding.date ? 'pre' : 'timeline'); };
      h.addEventListener('click', toggle);
      h.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); } });
    });
    $$('[data-ev]', list).forEach(el => {
      const id = el.dataset.ev, f = el.dataset.f;
      const evt = el.tagName === 'SELECT' || el.type === 'date' || el.type === 'time' ? 'change' : 'input';
      el.addEventListener(evt, () => {
        const e = evById(id); if (!e) return;
        if (f === 'type') {
          const wasDefault = !e.name || e.name === I.eventTypeName(e.type, 'en');
          e.type = el.value; if (wasDefault) { e.name = el.value === 'custom' ? '' : I.eventTypeName(el.value, 'en'); const n = $(`[data-ev="${id}"][data-f="name"]`, list); if (n) n.value = e.name; }
          const ico = $(`.ev[data-id="${id}"] .eico`, list); if (ico) ico.innerHTML = ART.icon[(I.EVENT_TYPES[e.type] || {}).icon] || ART.icon.sparkle;
        } else e[f] = el.value;
        changed({ focus: e.date && S.data.wedding.date && e.date < S.data.wedding.date ? 'pre' : 'timeline' });
        counter(el);
      });
      el.addEventListener('blur', () => { S.touched.add(`events.${id}.${f}`); paintErrors(); });
    });
    $$('[data-move]', list).forEach(b => b.onclick = () => moveEvent(b.dataset.id, Number(b.dataset.move)));
    $$('[data-dup]', list).forEach(b => b.onclick = () => {
      willChange(); const i = S.data.events.findIndex(e => e.id === b.dataset.dup); const c = clone(S.data.events[i]);
      c.id = 'ev-' + Math.random().toString(36).slice(2, 8); delete c.main; if (c.type === 'wedding') c.type = 'custom';
      c.name = (c.name || 'Event') + ' (copy)'; if (!c.date) c.date = S.data.wedding.date;
      // carry translations across
      for (const l of Object.keys(S.data.i18n || {})) for (const fk of ['name', 'venue', 'address', 'note', 'dress']) { const v = S.data.i18n[l][`events.${b.dataset.dup}.${fk}`]; if (v) S.data.i18n[l][`events.${c.id}.${fk}`] = v; }
      S.data.events.splice(i + 1, 0, c); S.openEv = c.id; changed({ noUndo: true, focus: 'timeline' }); renderStep(true);
    });
    $$('[data-del]', list).forEach(b => b.onclick = () => {
      willChange(); const i = S.data.events.findIndex(e => e.id === b.dataset.del); const gone = S.data.events.splice(i, 1)[0];
      changed({ noUndo: true, focus: 'timeline' }); renderStep(true); toast(`Removed “${gone.name}”.`, 'Undo', undo, 7000);
    });
    $$('[data-add]', body).forEach(b => b.onclick = () => {
      if (S.data.events.length >= C.LIMITS.events) return toast(`You can add up to ${C.LIMITS.events} events.`);
      willChange(); const t = b.dataset.add, w = S.data.wedding.date || addDays(today(), 60);
      const date = { mehendi: addDays(w, -2), haldi: addDays(w, -1), sangeet: addDays(w, -1), engagement: addDays(w, -30), baraat: w, varmala: w, pheras: w, arrival: w, reception: addDays(w, 1) }[t] || w;
      const start = { mehendi: '18:30', haldi: '10:00', sangeet: '19:00', engagement: '18:00', baraat: '09:30', varmala: '11:00', pheras: '12:00', arrival: '10:00', reception: '19:30' }[t] || '';
      const e = { id: 'ev-' + Math.random().toString(36).slice(2, 8), type: t, name: t === 'custom' ? '' : I.eventTypeName(t, 'en'), date, start, end: '', venue: '', address: '', note: '', dress: '' };
      S.data.events.push(e); S.openEv = e.id; changed({ noUndo: true, focus: date < w ? 'pre' : 'timeline' }); renderStep(true);
      const n = $(`.ev[data-id="${e.id}"]`); if (n) { n.scrollIntoView({ behavior: 'smooth', block: 'center' }); const f = $(t === 'custom' ? '[data-f="name"]' : '[data-f="date"]', n); if (f) setTimeout(() => f.focus({ preventScroll: true }), 300); }
    });
    // drag to reorder (pointer events: mouse + touch)
    $$('[data-grip]', list).forEach(g => g.addEventListener('pointerdown', e => {
      e.preventDefault(); const card = g.closest('.ev'); card.classList.add('dragging'); g.setPointerCapture(e.pointerId);
      let target = null;
      const move = ev => {
        const cards = $$('.ev', list).filter(x => x !== card); $$('.ev', list).forEach(x => x.classList.remove('drop-before'));
        target = cards.find(x => ev.clientY < x.getBoundingClientRect().top + x.offsetHeight / 2) || null;
        if (target) target.classList.add('drop-before');
      };
      const up = () => {
        g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up);
        card.classList.remove('dragging'); $$('.ev', list).forEach(x => x.classList.remove('drop-before'));
        const from = S.data.events.findIndex(x => x.id === card.dataset.id);
        willChange(); const [item] = S.data.events.splice(from, 1);
        const to = target ? S.data.events.findIndex(x => x.id === target.dataset.id) : S.data.events.length;
        S.data.events.splice(to, 0, item); changed({ noUndo: true, focus: 'timeline' }); renderStep(true);
      };
      g.addEventListener('pointermove', move); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
    }));
  }
  function moveEvent(id, dir) {
    const i = S.data.events.findIndex(e => e.id === id), j = i + dir; if (j < 0 || j >= S.data.events.length) return;
    willChange(); const [x] = S.data.events.splice(i, 1); S.data.events.splice(j, 0, x); changed({ noUndo: true, focus: 'timeline' }); renderStep(true);
    const b = $(`.ev[data-id="${id}"] [data-move="${dir}"]`); if (b && !b.disabled) b.focus();
  }

  /* ---------------------------------------------------------- venue: autocomplete + map */
  let leafletP = null;
  function leaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletP) return leafletP;
    leafletP = new Promise((res, rej) => {
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(css);
      const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = () => res(window.L); s.onerror = () => { leafletP = null; rej(); }; document.head.appendChild(s);
    });
    return leafletP;
  }
  const maps = {};
  function bindVenue(body) {
    for (const prefix of ['venue', 'reception']) {
      const q = $('#q-' + prefix, body); if (!q) continue;
      const box = $('#ac-' + prefix, body), list = $('#acl-' + prefix, body);
      let results = [], sel = -1, ctrl = null;
      const close = () => { box.classList.remove('open'); q.setAttribute('aria-expanded', 'false'); };
      const paint = (msg) => {
        list.innerHTML = msg ? `<div class="none">${esc(msg)}</div>` : results.map((r, i) => `<button type="button" role="option" aria-selected="${i === sel}" data-i="${i}">${esc(r.name)}<small>${esc([r.address, r.city, r.state, r.pin].filter(Boolean).join(', '))}</small></button>`).join('');
        box.classList.add('open'); q.setAttribute('aria-expanded', 'true');
        $$('button', list).forEach(b => b.onmousedown = e => { e.preventDefault(); pick(results[Number(b.dataset.i)]); });
      };
      const search = debounce(async () => {
        const v = q.value.trim(); if (v.length < 3) return close();
        paint('Searching…');
        try { if (ctrl) ctrl.abort(); ctrl = new AbortController();
          const r = await fetch('/api/shaadi-paigaam/places?q=' + encodeURIComponent(v), { signal: ctrl.signal }); const j = await r.json();
          if (!r.ok) return paint('Search is busy right now. You can enter the address yourself below.');
          results = j.results || []; sel = -1; results.length ? paint() : paint('No matches. Try adding the city, or enter the address yourself.');
        } catch (e) { if (e.name !== 'AbortError') paint('Could not search. Check your connection, or enter the address yourself.'); }
      }, 380);
      q.addEventListener('input', search);
      q.addEventListener('keydown', e => {
        if (!box.classList.contains('open')) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); paint(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
        if (e.key === 'Enter' && sel >= 0) { e.preventDefault(); pick(results[sel]); }
        if (e.key === 'Escape') close();
      });
      q.addEventListener('blur', () => setTimeout(close, 150));
      const pick = r => {
        willChange(); close(); q.value = '';
        Object.assign(S.data[prefix], { name: r.name || S.data[prefix].name, address: r.address || '', city: r.city || '', state: r.state || '', pin: (r.pin || '').replace(/\D/g, '').slice(0, 6), country: r.country || 'IN', lat: r.lat, lng: r.lng, verified: true });
        S['manual_' + prefix] = false; changed({ noUndo: true, focus: 'venue' }); renderStep(true); toast('Venue added. Check the pin on the map.');
      };
      const mb = $(`[data-manual="${prefix}"]`, body);
      if (mb) mb.onclick = () => { S['manual_' + prefix] = !S['manual_' + prefix]; renderStep(true); if (S['manual_' + prefix]) { const n = $(`#f-${prefix}-name`); if (n) n.focus(); } };
      const mapEl = $('#map-' + prefix, body);
      if (mapEl) initMap(prefix, mapEl);
    }
  }
  async function initMap(prefix, el) {
    let L; try { L = await leaflet(); } catch { el.innerHTML = '<div class="hint" style="padding:16px">The map could not load. Your address will still work.</div>'; return; }
    if (!document.body.contains(el)) return;
    const v = S.data[prefix];
    const has = v.lat != null;
    const center = has ? [v.lat, v.lng] : [20.59, 78.96];
    const map = L.map(el, { scrollWheelZoom: false, attributionControl: true }).setView(center, has ? 16 : 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    const icon = L.divIcon({ className: '', html: `<div style="width:30px;height:30px;color:#8F1018;transform:translate(-50%,-100%);filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))">${IC.pin.replace('fill="none"', 'fill="#fff"')}</div>`, iconSize: [0, 0] });
    const mk = L.marker(center, { draggable: true, icon, keyboard: true, title: 'Drag to the exact entrance' }).addTo(map);
    if (!has && (v.city || v.address)) {
      fetch('/api/shaadi-paigaam/places?q=' + encodeURIComponent([v.address, v.city, v.state].filter(Boolean).join(', '))).then(r => r.json()).then(j => { const r = (j.results || [])[0]; if (r && r.lat != null) { map.setView([r.lat, r.lng], 14); mk.setLatLng([r.lat, r.lng]); } }).catch(() => {});
    }
    const place = async ll => {
      willChange(); const t = S.data[prefix]; t.lat = +ll.lat.toFixed(6); t.lng = +ll.lng.toFixed(6);
      changed({ noUndo: true, focus: 'venue' });
      const tl = $('#test-' + prefix); if (tl) tl.href = C.mapsLinks(t).google;
      try {
        const j = await (await fetch(`/api/shaadi-paigaam/reverse?lat=${t.lat}&lng=${t.lng}`)).json();
        const r = j.result; if (!r) return;
        let filled = false;
        for (const k of ['address', 'city', 'state', 'pin']) if (!t[k] && r[k]) { t[k] = k === 'pin' ? String(r[k]).replace(/\D/g, '').slice(0, 6) : r[k]; filled = true; }
        if (filled) { changed({ noUndo: true }); renderStep(true); }
      } catch {}
    };
    mk.on('dragend', () => place(mk.getLatLng()));
    map.on('click', e => { mk.setLatLng(e.latlng); place(e.latlng); });
    maps[prefix] = map;
    setTimeout(() => map.invalidateSize(), 200);
  }

  /* ---------------------------------------------------------- media: photos with crop, music */
  async function decode(file) {
    if (window.createImageBitmap) { try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch {} }
    return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = URL.createObjectURL(file); });
  }
  function cropTool(src, aspect, title) {
    return new Promise(resolve => {
      const W = src.width, H = src.height;
      const m = modal(`<h3>${esc(title)}</h3><p class="hint" style="margin:-4px 0 10px">Drag to move, use the slider to zoom. Keep faces inside the frame.</p>
        <div class="crop" id="cropBox" style="aspect-ratio:${aspect}"><img id="cropImg" alt="Photo being cropped"><div class="frame"></div></div>
        <input type="range" class="zoom" id="cropZoom" min="1" max="3" step="0.01" value="1" aria-label="Zoom">
        <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost small" id="cropCancel">Cancel</button><button type="button" class="btn small" id="cropOk">Use photo</button></div>`, { onClose: () => resolve(null) });
      const box = $('#cropBox'), img = $('#cropImg'), z = $('#cropZoom');
      const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(src, 0, 0);
      img.src = c.toDataURL('image/jpeg', 0.9);
      let bw, bh, base, zoom = 1, x = 0, y = 0;
      const layout = () => { bw = box.clientWidth; bh = box.clientHeight; base = Math.max(bw / W, bh / H); clampPos(); paint(); };
      const clampPos = () => { const s = base * zoom; x = Math.min(0, Math.max(bw - W * s, x)); y = Math.min(0, Math.max(bh - H * s, y)); };
      const paint = () => { const s = base * zoom; img.style.width = W + 'px'; img.style.height = H + 'px'; img.style.transform = `translate(${x}px,${y}px) scale(${s})`; };
      img.onload = () => { layout(); const s = base; x = (bw - W * s) / 2; y = (bh - H * s) / 2; clampPos(); paint(); };
      let drag = null;
      box.addEventListener('pointerdown', e => { drag = { sx: e.clientX, sy: e.clientY, x, y }; box.setPointerCapture(e.pointerId); });
      box.addEventListener('pointermove', e => { if (!drag) return; x = drag.x + e.clientX - drag.sx; y = drag.y + e.clientY - drag.sy; clampPos(); paint(); });
      box.addEventListener('pointerup', () => { drag = null; }); box.addEventListener('pointercancel', () => { drag = null; });
      const zoomTo = nz => { const cx = bw / 2, cy = bh / 2, s0 = base * zoom; zoom = Math.max(1, Math.min(3, nz)); const s1 = base * zoom; x = cx - (cx - x) * s1 / s0; y = cy - (cy - y) * s1 / s0; clampPos(); paint(); z.value = zoom; };
      z.oninput = () => zoomTo(Number(z.value));
      box.addEventListener('wheel', e => { e.preventDefault(); zoomTo(zoom * (e.deltaY < 0 ? 1.06 : 0.94)); }, { passive: false });
      box.tabIndex = 0;
      box.addEventListener('keydown', e => { const k = e.key, st = 10; if (k === 'ArrowLeft') x += st; else if (k === 'ArrowRight') x -= st; else if (k === 'ArrowUp') y += st; else if (k === 'ArrowDown') y -= st; else if (k === '+' || k === '=') return zoomTo(zoom + 0.1); else if (k === '-') return zoomTo(zoom - 0.1); else return; e.preventDefault(); clampPos(); paint(); });
      $('#cropCancel').onclick = () => m.close();
      $('#cropOk').onclick = () => {
        const s = base * zoom; const sx = -x / s, sy = -y / s, sw = bw / s, sh = bh / s;
        const [ar_w, ar_h] = aspect.split('/').map(Number);
        const outW = Math.min(1600, Math.round(sw)), outH = Math.round(outW * ar_h / ar_w);
        const out = document.createElement('canvas'); out.width = outW; out.height = outH;
        const ctx = out.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(c, sx, sy, sw, sh, 0, 0, outW, outH);
        m.el.className = 'modal'; m.el.innerHTML = ''; resolve(out);
      };
      setTimeout(layout, 30);
    });
  }
  async function toBlob(canvas) {
    for (const q of [0.84, 0.76, 0.68, 0.6]) {
      const b = await new Promise(r => canvas.toBlob(r, 'image/jpeg', q));
      if (b && b.size <= 1.8 * 1024 * 1024) return b;
    }
    return null;
  }
  function upload(kind, blob, type, onProgress) {
    return new Promise((res, rej) => {
      const x = new XMLHttpRequest();
      x.open('POST', `/api/shaadi-paigaam/upload?id=${encodeURIComponent(S.id)}&kind=${kind}`);
      x.setRequestHeader('Content-Type', type);
      x.upload.onprogress = e => e.lengthComputable && onProgress && onProgress(e.loaded / e.total);
      x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch {} x.status === 200 ? res(j) : rej(j.error || 'upload'); };
      x.onerror = () => rej('network');
      x.send(blob);
    });
  }
  const UPLOAD_ERR = { too_large: 'That file is too large.', invalid_image: 'That file does not look like a JPG, PNG or WEBP photo.', low_resolution: 'That photo is too small to look sharp.', invalid_audio: 'That file does not look like an MP3, M4A or AAC song.', limit: 'You have uploaded a lot of files today. Please try again later.', storage_full: 'Uploads are paused for a moment. Please try again later.', network: 'Your connection dropped. Please try again.' };
  async function addPhoto(file, aspect, title) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      if (/heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) return toast('iPhone HEIC photos can’t be used directly. Share the photo as JPG (or set Camera › Formats › Most Compatible) and try again.', null, null, 8000);
      return toast('Please choose a JPG, PNG or WEBP photo.');
    }
    if (file.size > 30 * 1024 * 1024) return toast('That photo is over 30 MB. Please choose a smaller one.');
    let bmp; try { bmp = await decode(file); } catch { return toast('We could not open that photo. Please try another.'); }
    const short = Math.min(bmp.width, bmp.height);
    if (short < 600) return toast(`This photo is too small (${bmp.width}×${bmp.height}). Use one at least 1200 pixels wide so it looks sharp on every screen.`, null, null, 8000);
    if (short < 800) toast('This photo is a little small, so it may look soft on big screens.');
    const canvas = await cropTool(bmp, aspect, title); if (!canvas) return null;
    const blob = await toBlob(canvas); if (!blob) return toast('That photo is too detailed to compress. Please try another.');
    await ensureDraft(); if (!S.id) return toast('Saving is not available right now. Please try again in a moment.');
    try { const j = await upload('photo', blob, 'image/jpeg', p => { const pr = $('#upProg'); if (pr) pr.style.width = Math.round(p * 100) + '%'; }); return j.url; }
    catch (e) { toast(UPLOAD_ERR[e] || 'The upload failed. Please try again.'); return null; }
  }
  function bindMedia(body) {
    const pi = $('#phInput', body);
    if (pi) pi.onchange = async () => {
      const files = Array.from(pi.files).slice(0, C.LIMITS.photos - S.data.photos.length);
      if (pi.files.length > files.length) toast(`Only ${C.LIMITS.photos} photos fit. We added the first ${files.length}.`);
      for (const f of files) {
        const url = await addPhoto(f, '4/3', 'Crop your photo');
        if (url) { willChange(); S.data.photos.push({ url, alt: '', fx: 50, fy: 50 }); changed({ noUndo: true, focus: 'photos' }); renderStep(true); }
      }
    };
    $$('.ph.add', body).forEach(l => l.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('input', l).click(); } }));
    $$('[data-phdel]', body).forEach(b => b.onclick = () => { willChange(); S.data.photos.splice(Number(b.dataset.phdel), 1); changed({ noUndo: true, focus: 'photos' }); renderStep(true); toast('Photo removed.', 'Undo', undo); });
    $$('[data-phleft]', body).forEach(b => b.onclick = () => { const i = Number(b.dataset.phleft); willChange(); const [p] = S.data.photos.splice(i, 1); S.data.photos.splice(i - 1, 0, p); changed({ noUndo: true, focus: 'photos' }); renderStep(true); });
    $$('[data-phalt]', body).forEach(b => b.onclick = () => {
      const i = Number(b.dataset.phalt), p = S.data.photos[i];
      const m = modal(`<h3>Describe this photo</h3><p class="hint">Helps guests who use screen readers. For example “Our engagement in Lonavala”.</p><input class="in" id="altIn" maxlength="120" value="${esc(p.alt)}"><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn small" id="altOk">Save</button></div>`);
      $('#altOk').onclick = () => { willChange(); p.alt = C.cleanText($('#altIn').value, 120); changed({ noUndo: true }); m.close(); };
    });
    // drag to reorder photos (desktop)
    let dragI = null;
    $$('.ph[data-ph]', body).forEach(el => {
      el.addEventListener('dragstart', () => { dragI = Number(el.dataset.ph); });
      el.addEventListener('dragover', e => e.preventDefault());
      el.addEventListener('drop', e => { e.preventDefault(); const to = Number(el.dataset.ph); if (dragI == null || dragI === to) return; willChange(); const [p] = S.data.photos.splice(dragI, 1); S.data.photos.splice(to, 0, p); dragI = null; changed({ noUndo: true, focus: 'photos' }); renderStep(true); });
    });
    const cs = $('#clearSamples', body); if (cs) cs.onclick = () => { willChange(); S.data.photos = S.data.photos.filter(p => !/\/art\/demo-/.test(p.url)); changed({ noUndo: true, focus: 'photos' }); renderStep(true); toast('Sample photos removed.', 'Undo', undo); };
    const ci = $('#cpInput', body);
    if (ci) ci.onchange = async () => { const f = ci.files[0]; if (!f) return; const url = await addPhoto(f, '4/5', 'Crop your couple photo'); if (url) { willChange(); S.data.couplePhoto = { url, fx: 50, fy: 50 }; changed({ noUndo: true, focus: 'welcome' }); renderStep(true); } };
    const cd = $('#cpDel', body); if (cd) cd.onclick = () => { willChange(); S.data.couplePhoto = null; changed({ noUndo: true, focus: 'welcome' }); renderStep(true); };
    $$('input[name=track]', body).forEach(r => r.onchange = () => { willChange(); S.data.music.track = r.value; changed({ noUndo: true }); renderStep(true); });
    $$('[data-play]', body).forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); playPreview(b); });
    const mi = $('#muInput', body);
    if (mi) mi.onchange = async () => {
      const f = mi.files[0]; if (!f) return;
      if (f.size > 10 * 1024 * 1024) return toast('That song is over 10 MB. Please choose a shorter or smaller file.');
      if (!/^audio\//.test(f.type) && !/\.(mp3|m4a|aac|ogg)$/i.test(f.name)) return toast('Please choose an MP3, M4A or AAC song.');
      await ensureDraft();
      toast('Uploading your song…', null, null, 20000);
      try { const j = await upload('music', f, f.type || 'audio/mpeg'); willChange(); S.data.music = Object.assign(S.data.music, { track: 'upload', url: j.url, title: C.cleanText(f.name.replace(/\.[a-z0-9]+$/i, ''), 60), rightsOk: false }); changed({ noUndo: true }); renderStep(true); toast('Song uploaded. Please confirm you have the right to use it.'); }
      catch (e) { toast(UPLOAD_ERR[e] || 'The upload failed. Please try again.'); }
    };
  }
  let auditionEl = null, auditionBtn = null;
  function playPreview(btn) {
    const src = btn.dataset.play;
    if (!auditionEl) { auditionEl = new Audio(); auditionEl.addEventListener('ended', () => { if (auditionBtn) auditionBtn.innerHTML = IC.play; }); auditionEl.addEventListener('error', () => { if (auditionBtn) { auditionBtn.innerHTML = IC.play; toast('This track could not play.'); } }); }
    if (auditionBtn === btn && !auditionEl.paused) { auditionEl.pause(); btn.innerHTML = IC.play; return; }
    if (auditionBtn) auditionBtn.innerHTML = IC.play;
    auditionEl.src = src; auditionEl.currentTime = 0; auditionEl.volume = 0.7;
    auditionEl.play().then(() => { btn.innerHTML = IC.pause; auditionBtn = btn; }).catch(() => toast('Tap again to play.'));
  }

  /* ---------------------------------------------------------- style */
  function bindStyle(body) {
    $$('[data-pal]', body).forEach(b => b.onclick = () => { willChange(); S.data.palette.id = b.dataset.pal; changed({ noUndo: true, focus: 'hero' }); renderStep(true); });
    const uc = $('#useCustom', body);
    if (uc) uc.onchange = () => {
      willChange();
      if (uc.checked) { const cur = C.PALETTE_BY_ID[S.data.palette.id] || C.PALETTES[0]; S.data.palette.custom = { primary: cur.primary, accent: cur.accent, bg: cur.bg }; S.data.palette.id = 'custom'; }
      else S.data.palette.id = 'royal-maroon';
      changed({ noUndo: true, focus: 'hero' }); renderStep(true);
    };
    const setC = (k, v) => { if (!/^#[0-9a-f]{6}$/i.test(v)) return false; willChange(); S.data.palette.custom[k] = v.toUpperCase(); S.data.palette.id = 'custom'; changed({ noUndo: true, focus: 'scratch' }); paintContrast(); return true; };
    $$('[data-pc]', body).forEach(i => i.addEventListener('input', () => { setC(i.dataset.pc, i.value); const h = $(`[data-hex="${i.dataset.pc}"]`); if (h) h.value = i.value.toUpperCase(); }));
    $$('[data-hex]', body).forEach(i => i.addEventListener('input', () => { let v = i.value.trim(); if (v && v[0] !== '#') v = '#' + v; if (setC(i.dataset.hex, v)) { const p = $(`[data-pc="${i.dataset.hex}"]`); if (p) p.value = v; } }));
    const rp = $('#resetPal', body); if (rp) rp.onclick = () => { willChange(); S.data.palette = clone(C.SAMPLE.palette); changed({ noUndo: true, focus: 'hero' }); renderStep(true); toast('Back to Royal Maroon.', 'Undo', undo); };
    $$('[data-font]', body).forEach(b => b.onclick = () => { willChange(); S.data.font = b.dataset.font; changed({ noUndo: true, focus: 'hero' }); renderStep(true); });
  }
  function paintContrast() {
    const wrap = $('.contrast'); if (!wrap) return;
    const b = C.buildPalette({ id: 'custom', custom: S.data.palette.custom }).palette;
    const ct = (a, c, need, lab) => { const r = C.contrast(a, c); return `<span class="${r < need ? 'bad' : ''}">${esc(lab)} ${r.toFixed(1)}:1</span>`; };
    wrap.innerHTML = ct(b.heading, b.bg, 4.5, 'Headings') + ct(b.body, b.bg, 4.5, 'Text') + ct(b.buttonText, b.button, 4.5, 'Buttons');
  }

  /* ---------------------------------------------------------- languages */
  function bindLang(body) {
    $$('[data-lang]', body).forEach(c => c.onchange = () => {
      willChange(); const l = c.dataset.lang, en = S.data.lang.enabled;
      if (c.checked && !en.includes(l)) en.push(l);
      if (!c.checked) { S.data.lang.enabled = en.filter(x => x !== l); if (S.data.lang.default === l) S.data.lang.default = S.data.lang.base; if (S.previewLang === l) S.previewLang = null; }
      changed({ noUndo: true }); renderStep(true); refreshPvLang();
    });
    $$('[data-tr]', body).forEach(el => el.addEventListener('input', () => {
      const [l, p] = el.dataset.tr.split('|'); S.data.i18n = S.data.i18n || {}; S.data.i18n[l] = S.data.i18n[l] || {};
      if (el.value.trim()) S.data.i18n[l][p] = el.value; else delete S.data.i18n[l][p];
      delete S.autoTr[l + '|' + p];
      el.closest('.tr-item').classList.toggle('missing', !el.value.trim());
      S.previewLang = l; changed({ focus: /^events/.test(p) ? 'timeline' : /^venue|^reception/.test(p) ? 'venue' : /welcome/.test(p) ? 'welcome' : /^couple/.test(p) ? 'hero' : null });
    }));
    $$('details[data-trwrap]', body).forEach(d => d.addEventListener('toggle', () => { if (d.open) S.openTr = d.dataset.trwrap; }));
    $$('[data-prevlang]', body).forEach(b => b.onclick = () => { S.previewLang = b.dataset.prevlang; refreshPvLang(); postPreview('hero'); if (matchMedia('(max-width:900px)').matches) guestPreview(); });
    $$('[data-autotr]', body).forEach(b => b.onclick = async () => {
      const l = b.dataset.autotr, from = S.data.lang.base;
      const tr = (S.data.i18n && S.data.i18n[l]) || {};
      const texts = {};
      for (const [p] of C.translatableFields(S.data)) if (!/^couple\./.test(p) && !tr[p]) texts[p] = C.getPath(S.data, p);
      if (!Object.keys(texts).length) return toast('Everything is already translated.');
      b.disabled = true; b.textContent = 'Translating…';
      try {
        const r = await fetch('/api/shaadi-paigaam/translate', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ from, to: l, texts }) });
        const j = await r.json();
        if (!r.ok) throw 0;
        willChange(); S.data.i18n = S.data.i18n || {}; S.data.i18n[l] = S.data.i18n[l] || {};
        let n = 0; for (const [p, v] of Object.entries(j.texts || {})) if (v) { S.data.i18n[l][p] = v; S.autoTr[l + '|' + p] = true; n++; }
        S.openTr = l; S.previewLang = l; changed({ noUndo: true }); renderStep(true); refreshPvLang();
        toast(n ? `Translated ${n} item${n === 1 ? '' : 's'}. Please read them through: machine translation can make mistakes.` : 'Translation is busy right now. Please try again later or type it yourself.', null, null, 7000);
      } catch { toast('Translation is not available right now. You can type the text yourself.'); b.disabled = false; b.textContent = '✨ Auto-translate the rest'; }
    });
  }
  function refreshPvLang() {
    const s = $('#pvLang'); if (!s) return;
    s.innerHTML = S.data.lang.enabled.map(l => `<option value="${l}" ${(S.previewLang || S.data.lang.default) === l ? 'selected' : ''}>${esc(I.LANGS[l].native)}</option>`).join('');
  }

  /* ---------------------------------------------------------- review & publish */
  function bindReview(body) {
    $$('[data-go]', body).forEach(b => b.onclick = () => go(Number(b.dataset.go), true));
    $$('[data-fix]', body).forEach(b => b.onclick = () => {
      const path = b.dataset.fix; go(Number(b.dataset.step), true);
      if (path.startsWith('events.')) { S.openEv = path.split('.')[1]; renderStep(); }
      if (path.startsWith('i18n.')) { S.openTr = path.split('.')[1]; renderStep(); }
      setTimeout(() => { const f = document.querySelector(`.f[data-p="${CSS.escape(path)}"]`) || document.getElementById('tr-' + path.split('.')[1]); if (f) { f.scrollIntoView({ behavior: 'smooth', block: 'center' }); const i = $('.in, input', f); if (i) i.focus({ preventScroll: true }); S.touched.add(path); paintErrors(); } }, 60);
    });
    const cf = $('#confirmed', body); if (cf) cf.onchange = () => { S.confirmed = cf.checked; paintErrors(); };
    const pb = $('#publishBtn', body); if (pb) pb.onclick = publish;
    const g2 = $('#guestBtn2', body); if (g2) g2.onclick = guestPreview;
    const si = $('#slugIn', body);
    if (si) {
      const check = debounce(async () => {
        const v = si.value; const st = $('#slugSt'), sug = $('#slugSug');
        if (!C.SLUG_RE.test(v)) { S.slugState = { available: false }; st.className = 'slug-st no'; st.textContent = v.length < 3 ? 'At least 3 characters.' : 'Use lowercase letters, numbers and single hyphens (no hyphen at the start or end).'; sug.innerHTML = ''; paintErrors(); return; }
        st.className = 'slug-st'; st.textContent = 'Checking…';
        try {
          const j = await (await fetch(`/api/shaadi-paigaam/slug?s=${encodeURIComponent(v)}&id=${encodeURIComponent(S.id || '')}`)).json();
          if (si.value !== v) return;
          S.slugState = j;
          st.className = 'slug-st ' + (j.available ? 'ok' : 'no');
          st.textContent = j.available ? `✓ paigaam.cc/${v} is available` : j.reason === 'reserved' ? 'That word is reserved. Try one of these:' : j.reason === 'taken' ? 'Someone already has that link. Try one of these:' : 'That link is not allowed.';
          sug.innerHTML = (j.suggestions || []).map(s => `<button type="button" class="chip" data-slug="${esc(s)}">${esc(s)}</button>`).join('');
          $$('[data-slug]', sug).forEach(c => c.onclick = () => { si.value = c.dataset.slug; si.dispatchEvent(new Event('input')); });
        } catch { st.className = 'slug-st no'; st.textContent = 'Could not check right now. Please try again.'; S.slugState = null; }
        paintErrors();
      }, 380);
      si.addEventListener('input', () => { const c = si.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-').slice(0, 40); if (c !== si.value) si.value = c; S.slugInput = c; S.slugState = null; paintErrors(); check(); });
      check();
    }
  }
  async function publish() {
    validateNow();
    if (S.v.errors.length) { go(6, true); return toast('Please fix the red items in the checklist first.'); }
    const pb = $('#publishBtn') || $('#updateLive'); const label = pb ? pb.textContent : '';
    if (pb) { pb.disabled = true; pb.textContent = S.live ? 'Updating…' : 'Publishing…'; }
    S.dirty = true; await saveServer();
    try {
      const r = await fetch('/api/shaadi-paigaam/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ id: S.id, slug: S.slugInput, confirmed: S.live ? true : !!S.confirmed }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (j.error === 'incomplete') { toast('A few details still need attention.'); S.tried.add(6); go(6); }
        else if (/^slug_/.test(j.error)) { toast('That link was just taken. Please pick another.'); S.slugState = null; renderStep(true); }
        else if (j.error === 'payments_offline') toast('Payments are paused for a moment. Your invitation is saved. Please try again soon.', null, null, 8000);
        else if (j.error === 'storage_unavailable') toast('Publishing is paused for maintenance. Your invitation is saved.', null, null, 8000);
        else toast('Something went wrong. Your invitation is saved. Please try again.');
        if (pb) { pb.disabled = false; pb.textContent = label; }
        return;
      }
      let url = j.url;
      if (j.razorpay) {
        if (!window.PaigaamPay) throw new Error('pay');
        try { const p = await window.PaigaamPay.open({ order: j, prefillName: j.prefillName }); url = p.url; }
        catch (e) { if (pb) { pb.disabled = false; pb.textContent = label; } return toast(e && e.code === 'dismissed' ? 'Payment cancelled. Your invitation is saved, so you can publish whenever you are ready.' : 'The payment could not be completed. You have not been charged twice. Please try again.', null, null, 8000); }
      }
      S.slug = j.slug || (url || '').split('/').pop(); S.live = true; S.status = 'published'; S.synced = true; S.dirty = false;
      S.tab = 'share'; saveLocal(); renderStep();
      toast(j.updated ? 'Your live invitation is updated.' : 'Published! Share your link with family and friends.', null, null, 6000);
    } catch { toast('Something went wrong. Your invitation is saved. Please try again.'); if (pb) { pb.disabled = false; pb.textContent = label; } }
  }

  /* ---------------------------------------------------------- start */
  async function start() {
    let local = null;
    try { local = JSON.parse(localStorage.getItem(LS(boot.open ? boot.open.id : null)) || 'null'); } catch {}
    if (boot.open) {
      S.id = boot.open.id; S.data = boot.open.data; S.live = boot.open.live; S.status = boot.open.status; S.slug = boot.open.slug || '';
      if (local && !local.synced && local.data && local.at > Date.now() - 14 * 864e5) { S.data = C.validate(local.data).data; S.synced = false; S.dirty = true; setTimeout(() => toast('We restored changes you had not saved yet.', 'Discard', () => { S.data = boot.open.data; changed({ noUndo: true }); renderStep(); }, 8000), 400); }
      try { S.manageUrl = localStorage.getItem('sp-ed:manage:' + S.id) || ''; } catch {}
      if (S.live && new URLSearchParams(location.search).get('tab') === 'dashboard') S.tab = 'guests';
    } else {
      const lastId = (() => { try { return localStorage.getItem('sp-ed:last'); } catch { return null; } })();
      if (local && local.data) { S.data = C.validate(local.data).data; S.synced = false; S.dirty = true; setTimeout(() => toast('Welcome back! We restored your draft.', 'Start over', async () => { if (await confirmBox('Start over?', 'This clears your draft on this device.', 'Start over', true)) { localStorage.removeItem(LS(null)); location.reload(); } }, 8000), 400); }
      else if (lastId) {
        try { const r = await fetch('/api/shaadi-paigaam/me?id=' + encodeURIComponent(lastId), { credentials: 'same-origin' }); if (r.ok) { const j = await r.json(); location.replace('/create/shaadi-paigaam?id=' + encodeURIComponent(j.id)); return; } } catch {}
      }
      if (!S.data && boot.resume) {
        try { const r = await fetch('/api/shaadi-paigaam/me?id=' + encodeURIComponent(boot.resume.id), { credentials: 'same-origin' }); if (r.ok) { location.replace('/create/shaadi-paigaam?id=' + encodeURIComponent(boot.resume.id)); return; } } catch {}
      }
      if (!S.data) S.data = C.validate(clone(C.SAMPLE)).data;
    }
    try { const st = Number(localStorage.getItem('sp-ed:step:' + (S.id || 'new'))); if (st >= 0 && st < STEPS.length) S.step = st; } catch {}
    validateNow();
    render();
    if (!S.synced) { paintSave('busy', 'Saving…'); scheduleSave(); }
    else paintSave(S.id ? 'ok' : '', S.id ? (S.live ? 'Live' : 'Saved') : 'Not saved yet');
  }
  start();
})();
