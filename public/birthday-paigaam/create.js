'use strict';
/**
 * Birthday Paigaam wizard: steps, drafts, uploads (photo / voice / song),
 * in-browser recording, the photo manager, palette & screens, the live
 * preview pane (follows the current step) and publish.
 * Field ids mirror templates/birthday-paigaam/schema.js.
 */
(function () {
  var form = document.getElementById('bpwForm');
  if (!form) return;
  var CFG = {};
  try { CFG = JSON.parse(document.getElementById('bpwConfig').textContent); } catch (e) {}

  var TEXT = ['recipientName', 'senderName', 'age', 'birthdayDate', 'passcode', 'passcodeHint', 'question', 'yesLabel', 'noLabel', 'tryAgainLabel',
    'letterGreeting', 'letter', 'signoff', 'voiceTitle', 'songTitle', 'songArtist', 'memoriesTitle', 'loveTitle', 'reasonsTitle',
    'finaleTitle', 'finaleLine', 'whatsapp', 'thankYouText', 'candles'];
  var LISTS = ['noMessages', 'loveNotes', 'reasons'];
  var COLORS = ['blush', 'cream', 'peach', 'lavender', 'accent'];
  var steps = Array.prototype.slice.call(form.querySelectorAll('.step'));
  var LAST = steps.length - 1;
  var progress = Array.prototype.slice.call(document.querySelectorAll('#progress li'));

  var state = { mainPhoto: '', photoFocus: { x: 50, y: 50 }, voiceUrl: '', songUrl: '', photos: [], font: 'dreamy', screens: {}, showBrand: true };
  var step = 0, draftId = null, previewUrl = null, saving = null, dirty = false, published = false;

  function el(id) { return document.getElementById(id); }
  function val(id) { var n = el(id); return n ? String(n.value || '').trim() : ''; }
  function setError(m) { var b = el('formError'); if (!b) return; b.textContent = m || ''; b.hidden = !m; }
  function say(m) { var s = el('status'); if (s) s.textContent = m || ''; }

  window.wizardAdoptDraft = function (id, purl) { draftId = id; previewUrl = purl || ('/birthday-paigaam/preview/' + id); refreshLive(); };
  window.wizardDiscardDraft = function () {};

  /* ---------------------------------------------------------- collect */
  function lines(id) { return val(id).split('\n').map(function (s) { return s.trim(); }).filter(Boolean); }
  function collect() {
    var d = {};
    TEXT.forEach(function (k) { d[k] = val(k); });
    d.candles = Number(val('candles') || 5);
    LISTS.forEach(function (k) { d[k] = lines(k); });
    d.mainPhoto = state.mainPhoto; d.photoFocus = { x: Math.round(state.photoFocus.x), y: Math.round(state.photoFocus.y) }; d.voiceUrl = state.voiceUrl; d.songUrl = state.songUrl;
    d.photos = state.photos.map(function (p) { return { url: p.url, caption: p.caption || '', back: p.back || '' }; });
    d.palette = {}; COLORS.forEach(function (k) { d.palette[k] = el('pal-' + k).value; });
    var f = form.querySelector('input[name="font"]:checked'); d.font = f ? f.value : 'dreamy';
    d.screens = {}; Array.prototype.forEach.call(form.querySelectorAll('[data-screen-toggle]'), function (c) { d.screens[c.getAttribute('data-screen-toggle')] = c.checked; });
    d.showBrand = el('showBrand').checked;
    return d;
  }

  /* ----------------------------------------------------------- network */
  function request(url, payload, raw) {
    var init = { method: 'POST', credentials: 'same-origin' };
    if (raw) { init.body = raw.body; init.headers = { 'Content-Type': raw.type }; }
    else { init.body = JSON.stringify(payload); init.headers = { 'Content-Type': 'application/json' }; }
    return fetch(url, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) {
        if (!r.ok) { var e = new Error(b.error || 'request_failed'); e.code = b.error || 'request_failed'; throw e; }
        return b;
      });
    });
  }
  var MESSAGES = {
    validation: 'Something in there is too long or not quite right — have a look and try again.',
    name_required: 'Their name is still missing — step 01.',
    bad_passcode: 'The passcode needs exactly 4 digits.',
    bad_whatsapp: 'That WhatsApp number doesn’t look right — digits with country code, please.',
    limit: 'That’s a lot for one day — try again a little later.',
    too_large: 'That file is too big.',
    invalid_image: 'That photo couldn’t be read — try a JPG or PNG.',
    invalid_audio: 'That audio file couldn’t be read — try MP3 or M4A.',
    storage_full: 'Uploads are full right now — please try again later.',
    storage_unavailable: 'Publishing is paused right now. Your draft is safe — try again shortly.',
    forbidden: 'This surprise can’t be edited any more.',
    payments_offline: 'Payments are being switched on — check back shortly. Your draft is safe.',
    not_found: 'This draft has wandered off. Reload and start again.',
  };
  function msg(err) { return MESSAGES[err && err.code] || 'That didn’t work — check your connection and try again.'; }

  function saveDraft() {
    if (saving) return saving;
    say('Saving…');
    saving = request('/api/birthday-paigaam/draft', { id: draftId, customer_data: collect() })
      .then(function (b) { draftId = b.id; previewUrl = b.previewUrl; dirty = false; say('Saved.'); return b; })
      .catch(function (e) { say(''); setError(msg(e)); throw e; })
      .then(function (b) { saving = null; return b; }, function (e) { saving = null; throw e; });
    return saving;
  }
  function ensureDraft() { return draftId ? Promise.resolve({ id: draftId }) : saveDraft(); }

  /* ------------------------------------------------------------ uploads */
  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 1600, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('encode')); }, 'image/jpeg', 0.84);
      };
      img.onerror = function () { URL.revokeObjectURL(url); var e = new Error('invalid_image'); e.code = 'invalid_image'; reject(e); };
      img.src = url;
    });
  }
  function upload(kind, blob, type) {
    return ensureDraft().then(function () {
      return request('/api/birthday-paigaam/upload?id=' + encodeURIComponent(draftId) + '&kind=' + kind, null, { body: blob, type: type || blob.type || 'application/octet-stream' });
    });
  }
  function normType(t) {
    t = (t || '').toLowerCase();
    if (t === 'audio/mp3' || t === 'audio/x-mp3' || t === 'audio/mpeg3') return 'audio/mpeg';
    if (t === 'audio/x-m4a' || t === 'audio/m4a') return 'audio/mp4';
    if (t === 'audio/x-wav' || t === 'audio/wave') return 'audio/wav';
    return t || 'audio/mpeg';
  }

  /* main photo */
  function paintMain() {
    var img = el('mainPhotoImg');
    img.hidden = !state.mainPhoto; if (state.mainPhoto) img.src = state.mainPhoto;
    img.style.objectPosition = state.photoFocus.x + '% ' + state.photoFocus.y + '%';
    img.classList.toggle('bpw-focus', !!state.mainPhoto);
    el('mainPhotoRemove').hidden = !state.mainPhoto;
  }
  el('mainPhotoFile').addEventListener('change', function (e) {
    var f = e.target.files[0]; e.target.value = ''; if (!f) return;
    setError(''); say('Uploading photo…');
    resizeImage(f).then(function (b) { return upload('photo', b, 'image/jpeg'); })
      .then(function (r) { state.mainPhoto = r.url; state.photoFocus = { x: 50, y: 50 }; paintMain(); say('Photo added — drag it to centre their face.'); changed(); })
      .catch(function (err) { say(''); setError(msg(err)); });
  });
  el('mainPhotoRemove').addEventListener('click', function () { state.mainPhoto = ''; paintMain(); changed(); });
  /* drag the photo inside its circle to choose what stays centred (object-position) */
  (function () {
    var img = el('mainPhotoImg'), drag = null;
    img.addEventListener('pointerdown', function (e) {
      if (!state.mainPhoto) return;
      drag = { x: e.clientX, y: e.clientY, fx: state.photoFocus.x, fy: state.photoFocus.y };
      img.setPointerCapture(e.pointerId); e.preventDefault();
    });
    img.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var k = 100 / Math.max(60, img.clientWidth);
      state.photoFocus.x = Math.max(0, Math.min(100, drag.fx - (e.clientX - drag.x) * k));
      state.photoFocus.y = Math.max(0, Math.min(100, drag.fy - (e.clientY - drag.y) * k));
      img.style.objectPosition = state.photoFocus.x + '% ' + state.photoFocus.y + '%';
    });
    function end() { if (drag) { drag = null; changed(); } }
    img.addEventListener('pointerup', end); img.addEventListener('pointercancel', end);
  })();

  /* audio (voice + song) */
  function paintAudio(kind) {
    var url = kind === 'voice' ? state.voiceUrl : state.songUrl, prev = el(kind + 'Preview');
    prev.hidden = !url; if (url && prev.getAttribute('src') !== url) prev.src = url;
    if (!url) prev.removeAttribute('src');
    el(kind + 'Remove').hidden = !url;
  }
  function uploadAudio(kind, blob, type) {
    var limit = kind === 'voice' ? 10 : 15;
    if (blob.size > limit * 1024 * 1024) { setError('That file is over ' + limit + ' MB — try a shorter or smaller one.'); return Promise.resolve(); }
    setError(''); say('Uploading ' + (kind === 'voice' ? 'voice note' : 'song') + '…');
    return upload(kind, blob, normType(type))
      .then(function (r) { if (kind === 'voice') state.voiceUrl = r.url; else state.songUrl = r.url; paintAudio(kind); say('Added.'); changed(); })
      .catch(function (err) { say(''); setError(msg(err)); });
  }
  ['voice', 'song'].forEach(function (kind) {
    el(kind + 'File').addEventListener('change', function (e) {
      var f = e.target.files[0]; e.target.value = ''; if (!f) return;
      uploadAudio(kind, f, f.type);
      if (kind === 'song' && !val('songTitle')) el('songTitle').value = f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').slice(0, 80);
    });
    el(kind + 'Remove').addEventListener('click', function () { if (kind === 'voice') state.voiceUrl = ''; else state.songUrl = ''; paintAudio(kind); changed(); });
  });

  /* recording */
  var rec = null, recChunks = [], recTimer = 0, recStart = 0;
  var recBtn = el('recBtn');
  if (!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) recBtn.hidden = true;
  function recType() {
    var c = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    for (var i = 0; i < c.length; i++) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c[i])) return c[i];
    return '';
  }
  function stopRec() { if (rec && rec.state !== 'inactive') rec.stop(); }
  recBtn.addEventListener('click', function () {
    if (rec && rec.state === 'recording') { stopRec(); return; }
    setError('');
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(function (stream) {
      var type = recType();
      rec = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
      recChunks = [];
      rec.ondataavailable = function (e) { if (e.data && e.data.size) recChunks.push(e.data); };
      rec.onstop = function () {
        clearInterval(recTimer); stream.getTracks().forEach(function (t) { t.stop(); });
        recBtn.classList.remove('is-rec'); recBtn.querySelector('.lbl').textContent = 'Record again';
        el('recTime').textContent = '';
        var mime = (rec.mimeType || type || 'audio/webm').split(';')[0];
        var blob = new Blob(recChunks, { type: mime });
        if (blob.size < 2000) { setError('That recording was too short — try again.'); return; }
        uploadAudio('voice', blob, mime);
      };
      rec.start(250); recStart = Date.now();
      recBtn.classList.add('is-rec'); recBtn.querySelector('.lbl').textContent = 'Stop';
      recTimer = setInterval(function () {
        var s = Math.floor((Date.now() - recStart) / 1000);
        el('recTime').textContent = '● ' + Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2) + ' / 3:00';
        if (s >= 180) stopRec();
      }, 250);
    }).catch(function () { setError('We couldn’t reach your microphone — allow it in the browser, or upload a recording instead.'); });
  });

  /* scrapbook photos */
  var list = el('photoList');
  function paintPhotos() {
    list.innerHTML = '';
    state.photos.forEach(function (p, i) {
      var li = document.createElement('li'); li.className = 'bpw-ph'; li.draggable = true; li.dataset.i = i;
      li.innerHTML = '<img alt=""><div class="bpw-ph__fields"><input class="cap" maxlength="60" placeholder="caption under the photo"><input class="back" maxlength="200" placeholder="secret message on the back ♡"></div>'
        + '<div class="bpw-ph__tools"><button type="button" class="up" aria-label="Move up">↑</button><button type="button" class="down" aria-label="Move down">↓</button><button type="button" class="rm" aria-label="Remove photo">✕</button></div>';
      li.querySelector('img').src = p.url;
      var cap = li.querySelector('.cap'), back = li.querySelector('.back');
      cap.value = p.caption || ''; back.value = p.back || '';
      cap.addEventListener('input', function () { p.caption = cap.value; changed(true); });
      back.addEventListener('input', function () { p.back = back.value; changed(true); });
      li.querySelector('.up').addEventListener('click', function () { move(i, i - 1); });
      li.querySelector('.down').addEventListener('click', function () { move(i, i + 1); });
      li.querySelector('.rm').addEventListener('click', function () { state.photos.splice(i, 1); paintPhotos(); changed(); });
      li.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', String(i)); li.classList.add('is-drag'); });
      li.addEventListener('dragend', function () { li.classList.remove('is-drag'); });
      li.addEventListener('dragover', function (e) { e.preventDefault(); });
      li.addEventListener('drop', function (e) { e.preventDefault(); var from = Number(e.dataTransfer.getData('text/plain')); if (!isNaN(from)) move(from, i); });
      list.appendChild(li);
    });
    el('photoStatus').textContent = state.photos.length + ' of 40 photos';
  }
  function move(a, b) {
    if (b < 0 || b >= state.photos.length || a === b) return;
    var it = state.photos.splice(a, 1)[0]; state.photos.splice(b, 0, it); paintPhotos(); changed();
  }
  el('photoFiles').addEventListener('change', function (e) {
    var files = Array.prototype.slice.call(e.target.files || []); e.target.value = '';
    var room = 40 - state.photos.length; files = files.slice(0, Math.max(0, room));
    if (!files.length) return;
    setError('');
    var done = 0;
    var next = function () {
      if (!files.length) { say(''); el('photoStatus').textContent = state.photos.length + ' of 40 photos'; changed(); return; }
      var f = files.shift();
      el('photoStatus').textContent = 'Uploading ' + (++done) + '…';
      resizeImage(f).then(function (b) { return upload('photo', b, 'image/jpeg'); })
        .then(function (r) { state.photos.push({ url: r.url, caption: '', back: '' }); paintPhotos(); })
        .catch(function (err) { setError(msg(err)); })
        .then(next);
    };
    next();
  });

  /* look & feel */
  Array.prototype.forEach.call(document.querySelectorAll('.bpw-preset'), function (b) {
    b.addEventListener('click', function () {
      var p = (CFG.palettes || {})[b.getAttribute('data-preset')]; if (!p) return;
      COLORS.forEach(function (k) { el('pal-' + k).value = p[k]; });
      changed();
    });
  });

  /* ------------------------------------------------------ live preview */
  var live = el('liveFrame'), liveTimer = 0;
  function refreshLive() {
    if (!live) return;
    var screen = (CFG.steps || [])[step] || 'unlock';
    if (screen === 'voice' && !state.voiceUrl) screen = 'song';
    fetch('/birthday-paigaam/preview-frame', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: draftId, screen: screen, customer_data: collect() }),
    }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (h) { if (h) live.srcdoc = h; }).catch(function () {});
  }
  function changed(soft) {
    if (published) return;
    dirty = true;
    clearTimeout(liveTimer); liveTimer = setTimeout(refreshLive, soft ? 700 : 350);
    clearTimeout(autoTimer); autoTimer = setTimeout(function () { if (draftId || val('recipientName')) saveDraft().catch(function () {}); }, 3500);
  }
  var autoTimer = 0;
  form.addEventListener('input', function () { changed(true); });
  form.addEventListener('change', function () { changed(); });

  /* ------------------------------------------------------------- steps */
  function show(i) {
    step = Math.max(0, Math.min(LAST, i));
    steps.forEach(function (s) { s.hidden = Number(s.getAttribute('data-step')) !== step; });
    progress.forEach(function (li, k) { li.classList.toggle('is-current', k === step); li.classList.toggle('is-done', k < step); });
    el('stepCounter').textContent = 'Step 0' + (step + 1) + ' of 0' + (LAST + 1);
    el('back').hidden = step === 0; el('next').hidden = step === LAST;
    setError('');
    var h = steps[step] && steps[step].querySelector('h2'); if (h) h.focus();
    if (step === LAST) review();
    refreshLive();
  }
  function validStep() {
    if (step === 0 && !val('recipientName')) { setError('Their name, at least — the rest can wait.'); el('recipientName').focus(); return false; }
    if (step === 1 && val('passcode') && !/^\d{4}$/.test(val('passcode'))) { setError('The passcode needs exactly 4 digits.'); el('passcode').focus(); return false; }
    if (step === 6 && val('whatsapp') && !/^\d{8,15}$/.test(val('whatsapp').replace(/[\s()+-]/g, ''))) { setError(MESSAGES.bad_whatsapp); el('whatsapp').focus(); return false; }
    return true;
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validStep()) return;
    if (val('recipientName')) saveDraft().catch(function () {});
    show(step + 1);
  });
  el('back').addEventListener('click', function () { show(step - 1); });
  progress.forEach(function (li, k) { li.addEventListener('click', function () { if (k <= step || val('recipientName')) show(k); }); });

  function review() {
    var d = collect(), box = el('review');
    var rows = [
      ['For', d.recipientName], ['From', d.senderName], ['Passcode', d.passcode || '1234'],
      ['Photos', (d.mainPhoto ? 'main photo + ' : '') + d.photos.length + ' in the scrapbook'],
      ['Voice note', d.voiceUrl ? 'added ♡' : 'none (screen skipped)'], ['Song', d.songUrl ? (d.songTitle || 'added') : 'music box'],
    ];
    box.innerHTML = rows.map(function () { return '<div class="review-row"><span class="lbl"></span><span class="val"></span></div>'; }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('.review-row'), function (n, i) { n.querySelector('.lbl').textContent = rows[i][0]; n.querySelector('.val').textContent = rows[i][1] || '—'; });
  }

  /* preview dialog */
  var dialog = el('previewDialog'), host = el('frameHost');
  el('savePreview').addEventListener('click', function () {
    if (!val('recipientName')) { setError(MESSAGES.name_required); show(0); return; }
    saveDraft().then(function () {
      host.innerHTML = '';
      var f = document.createElement('iframe'); f.src = previewUrl; f.title = 'Your surprise'; f.setAttribute('allow', 'autoplay');
      host.appendChild(f);
      if (dialog.showModal) dialog.showModal(); else window.open(previewUrl, '_blank', 'noopener');
    }).catch(function () {});
  });
  el('closePreview').addEventListener('click', function () { dialog.close(); host.innerHTML = ''; });
  el('fullscreen').addEventListener('click', function () { if (previewUrl) window.open(previewUrl, '_blank', 'noopener'); });

  /* publish */
  var pub = el('publish');
  pub.addEventListener('click', function () {
    if (!val('recipientName')) { setError(MESSAGES.name_required); show(0); return; }
    pub.disabled = true; say('Publishing…');
    saveDraft()
      .then(function () { return request('/api/birthday-paigaam/publish', { id: draftId }); })
      .then(function (b) {
        if (b && b.razorpay) return window.PaigaamPay.open({ order: b }).then(function (p) { result(p.url); });
        result(b.url);
      })
      .catch(function (e) { pub.disabled = false; say(''); setError(msg(e)); });
  });
  function result(url) {
    if (typeof url !== 'string' || !/^(https?:\/\/|\/)/.test(url)) return;
    published = true; clearTimeout(autoTimer);
    el('wizard').hidden = true;
    var r = el('publishedResult'); r.hidden = false;
    el('resultCode').textContent = val('passcode') || '1234';
    el('publishedUrl').value = url; el('openPublished').href = url;
    el('whatsapp').href = 'https://wa.me/?text=' + encodeURIComponent('I made you a little birthday surprise 🎂 ' + url);
    el('qrImage').src = '/api/qr?url=' + encodeURIComponent(url);
    el('resultTitle').focus();
  }
  el('copyLink').addEventListener('click', function () {
    var input = el('publishedUrl'), st = el('shareStatus');
    var done = function (ok) { st.textContent = ok ? 'Link copied.' : 'Couldn’t copy — select the link and copy it by hand.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(input.value).then(function () { done(true); }, function () { done(false); });
    else { input.select(); done(document.execCommand && document.execCommand('copy')); }
  });

  /* -------------------------------------------- resume a saved draft */
  window.wizardApplyField = function (id, v) {
    if (LISTS.indexOf(id) >= 0) { el(id).value = Array.isArray(v) ? v.join('\n') : String(v || ''); return false; }
    if (id === 'photos') { state.photos = Array.isArray(v) ? v.map(function (p) { return { url: p.url, caption: p.caption || '', back: p.back || '' }; }) : []; paintPhotos(); return false; }
    if (id === 'mainPhoto') { state.mainPhoto = v || ''; paintMain(); return false; }
    if (id === 'photoFocus') { if (v && typeof v === 'object') state.photoFocus = { x: Number(v.x) || 50, y: Number(v.y) || 50 }; paintMain(); return false; }
    if (id === 'voiceUrl' || id === 'songUrl') { state[id] = v || ''; paintAudio(id === 'voiceUrl' ? 'voice' : 'song'); return false; }
    if (id === 'palette' && v && typeof v === 'object') { COLORS.forEach(function (k) { if (v[k]) el('pal-' + k).value = v[k]; }); return false; }
    if (id === 'font') { var r = form.querySelector('input[name="font"][value="' + v + '"]'); if (r) r.checked = true; return false; }
    if (id === 'screens' && v && typeof v === 'object') { Object.keys(v).forEach(function (k) { var c = form.querySelector('[data-screen-toggle="' + k + '"]'); if (c) c.checked = v[k] !== false; }); return false; }
    if (id === 'showBrand') { el('showBrand').checked = v !== false; return false; }
    if (id === 'candles') { el('candles').value = String(v); return false; }
    if (id === 'templateVersion') return false;
    return true;
  };

  paintPhotos(); paintMain(); paintAudio('voice'); paintAudio('song');
  show(0);
})();
