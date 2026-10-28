'use strict';
// Anniversary Blue only: template-scoped wizard, nested photo controls and crop/upload lifecycle.
/**
 * Anniversary Blue generator behaviour, based on the proven Love Letter wizard.
 *
 * Reads the template's field spec from <script id="bfSpec"> (emitted by
 * pages/bfdayCreate.js from templates/<slug>/config.js) and drives:
 *   · step navigation + per-step required checks
 *   · list fields (add / remove / reorder rows; defaults pre-filled)
 *   · nested photo fields (crop → upload to the owned draft → live preview)
 *   · the LIVE preview pane (debounced POST to /<slug>/preview-frame → srcdoc)
 *   · draft save, preview dialog, publish, the share result
 * Nothing sender-typed is ever written with innerHTML.
 */
(function () {
  var specNode = document.getElementById('bfSpec');
  var form = document.getElementById('bfForm');
  if (!specNode || !form) return;
  var spec;
  try { spec = JSON.parse(specNode.textContent); } catch (e) { return; }

  var SLUG = spec.slug;
  var LAST_STEP = spec.lastStep;
  var FIELDS = spec.fields;

  var steps = Array.prototype.slice.call(form.querySelectorAll('.step'));
  var progress = Array.prototype.slice.call(document.querySelectorAll('#progress li'));
  var counter = document.getElementById('stepCounter');
  var errorBox = document.getElementById('formError');
  var status = document.getElementById('status');
  var backBtn = document.getElementById('back');
  var nextBtn = document.getElementById('next');
  var review = document.getElementById('review');
  var previewBtn = document.getElementById('savePreview');
  var previewState = document.getElementById('previewState');
  var publishBtn = document.getElementById('publish');
  var dialog = document.getElementById('previewDialog');
  var frameHost = document.getElementById('frameHost');
  var liveFrame = document.getElementById('liveFrame');

  var step = 0;
  var draftId = null;
  var previewUrl = null;

  window.wizardAdoptDraft = function (id, purl) { draftId = id; if (purl) previewUrl = purl; };
  window.wizardDiscardDraft = function (id) { /* stale draft simply expires */ };

  // resume.js hook: apply a saved value to a full control (lists, photos).
  window.wizardApplyField = function (id, v) {
    var c = controls[id];
    if (c && typeof c.set === 'function') { c.set(v); changed(); return false; }
    return true; // plain inputs: let resume.js set .value directly
  };
  var controls = {};      // field id -> { get(), focus(), rows? }

  function el(id) { return document.getElementById(id); }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function make(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  var MESSAGES = {
    anniversary_spotify_url: 'Use a Spotify song, album or playlist link from open.spotify.com, or leave it empty and use your uploaded audio.',
    anniversary_audio_url: 'Upload an MP3/WAV or use an HTTPS direct audio-file link, not a YouTube, SoundCloud or Apple Music page. Put Spotify links in the separate Spotify field.',
    invalid_audio: 'Choose a valid MP3 or WAV file.',
    validation: 'Something in there is a little too long or not quite right — check it and try again.',
    limit: 'That is a lot for one day. Try again a bit later.',
    storage_unavailable: 'Publishing is paused right now. Your draft is safe — try again shortly.',
    payments_offline: 'Payments are being switched on — check back shortly. Your draft is safe.',
    forbidden: 'This Paigaam is no longer editable here.',
    not_found: 'This draft has wandered off. Reload and start again.',
    too_large: 'That photo is too large — try a smaller one.',
    invalid_image: 'That file is not a photo we can use (JPG, PNG or WebP).',
  };

  function setError(message) {
    if (!errorBox) return;
    if (message) { errorBox.textContent = message; errorBox.hidden = false; }
    else { errorBox.textContent = ''; errorBox.hidden = true; }
  }
  function say(message) { if (status) status.textContent = message || ''; }

  /* ---------------------------------------------------- change tracking */

  var liveTimer = 0, liveBusy = false, liveAgain = false;
  var anniversaryPage = 'opening';
  if (liveFrame) liveFrame.addEventListener('load', function () { liveFrame.contentWindow.postMessage({type:'anniversary-restore',page:anniversaryPage},location.origin); });
  window.addEventListener('message', function (event) {
    if (event.origin !== location.origin || !liveFrame || event.source !== liveFrame.contentWindow) return;
    if (event.data && event.data.type === 'anniversary-page') { if (typeof event.data.page === 'string' || typeof event.data.page === 'number' && Number.isFinite(event.data.page)) anniversaryPage = event.data.page; return; }
    if (!event.data || event.data.type !== 'anniversary-photo') return;
    var id = event.data.field;
    if (typeof id !== 'string') return;
    var parts = id.split(':'), top = parts[0], field = fieldById(top), control;
    if (!field) return;
    if (parts.length === 1 && field.type === 'image') control = controls[top];
    else if (parts.length === 3 && field.type === 'list' && /^(0|[1-9]\d*)$/.test(parts[1])) {
      var list = controls[top], row = list && list.rows[Number(parts[1])];
      if (row && field.shape && field.shape.some(function (sub) { return sub.id === parts[2] && sub.type === 'image'; })) control = row.parts[parts[2]];
    }
    if (!control || !control.pick || !canMutate()) return;
    var at = spec.stepFields.findIndex(function(ids){return ids.indexOf(top) >= 0;});
    if (at >= 0) show(at);
    control.pick();
  });

  var autoTimer = 0, pendingMedia = 0, sending = false, previewSaving = false, editVersion = 0;
  function persistSoon() { clearTimeout(autoTimer); say('Unsaved changes…'); autoTimer=setTimeout(function(){ if (pendingMedia) { persistSoon(); return; } if (!sending) saveDraft().catch(function(){}); },1500); }
  function changed() { editVersion++; scheduleLivePreview(); persistSoon(); }
  var sendLocks=[];
  function lockForSend(locked) {
    if (locked) { sendLocks=[].map.call(form.querySelectorAll('input,textarea,select,button'),function(el){var state={el:el,disabled:el.disabled};el.disabled=true;return state;}); }
    else { sendLocks.forEach(function(state){state.el.disabled=state.disabled;});sendLocks=[]; }
  }
  function canMutate(){if(sending || previewSaving)return false;if(pendingMedia){setError('Please finish the current photo or song upload first.');return false;}return true;}
  function mediaBusy() { if (!pendingMedia) return false; setError('Please finish cropping or wait for the upload before previewing or sending.'); return true; }


  function counterFor(input, max) {
    var note = make('p', 'count');
    note.setAttribute('aria-hidden', 'true');
    function update() {
      var n = input.value.length;
      note.textContent = n > max * 0.75 ? n + ' / ' + max : '';
    }
    input.addEventListener('input', update);
    update();
    return note;
  }

  /* ------------------------------------------------------------- photos */

  var draftPending = null;

  function ensureDraft() {
    if (draftId) return Promise.resolve(draftId);
    if (!draftPending) {
      draftPending = saveDraft().then(function () { return draftId; }, function (err) { draftPending = null; throw err; });
    }
    return draftPending;
  }

  function uploadBlob(blob) {
    return ensureDraft().then(function (id) {
      return fetch('/api/' + SLUG + '/upload?id=' + encodeURIComponent(id), {
        method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob, credentials: 'same-origin',
      });
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok || !body.url) { var err = new Error('upload'); err.code = (body && body.error) || 'request_failed'; throw err; }
        return body.url;
      });
    });
  }

  /** A photo picker: thumbnail, choose/replace, remove. Value = upload URL or ''. */
  function photoControl(host, f, labelText, fieldIdentifier) {
    var value = '', original = null, alive = true, revision = 0;
    function identifier() { return typeof fieldIdentifier === 'function' ? fieldIdentifier() : f.id; }
    host.textContent = '';
    host.classList.add('bf-photo');
    var thumb = make('div', 'bf-photo__thumb'), img = make('img');
    img.alt = labelText || f.label || 'Your photo';
    var empty = make('span', 'bf-photo__empty', 'No photo yet — the designed placeholder will show.');
    thumb.appendChild(img); thumb.appendChild(empty);
    var tools = make('div', 'bf-photo__tools');
    var choose = make('button', 'button secondary', 'Choose a photo'); choose.type = 'button';
    var recrop = make('button', 'button secondary', 'Adjust crop'); recrop.type = 'button';
    var remove = make('button', 'button text-button', 'Remove'); remove.type = 'button';
    [choose, recrop, remove].forEach(function (button) { button.setAttribute('aria-label', button.textContent + ': ' + (labelText || f.label || 'photo')); tools.appendChild(button); });
    var file = make('input'); file.type = 'file'; file.accept = 'image/jpeg,image/png,image/webp'; file.hidden = true;
    file.setAttribute('aria-label', labelText || f.label || 'Choose photo'); tools.appendChild(file);
    var note = make('p', 'hint bf-photo__note'); note.setAttribute('role', 'status');
    host.appendChild(thumb); host.appendChild(tools); host.appendChild(note);
    function paint(src) {
      img.hidden = !src; empty.hidden = !!src;
      if (src) img.src = src; else img.removeAttribute('src');
      choose.textContent = value || src ? 'Replace photo' : 'Choose a photo';
      choose.setAttribute('aria-label', choose.textContent + ': ' + (labelText || f.label || 'photo'));
      remove.hidden = recrop.hidden = !value;
    }
    function pick() { if (alive && canMutate()) file.click(); }
    function crop(source, replacing) {
      if (!alive || !canMutate()) return;
      var token = revision;
      pendingMedia++; choose.disabled = recrop.disabled = remove.disabled = true;
      setError(''); note.textContent = 'Preparing your photo…';
      Promise.resolve().then(function () {
        if (typeof window.anniversaryCrop !== 'function') throw { code: 'invalid_image' };
        return window.anniversaryCrop(source, identifier());
      }).then(function (blob) {
        if (!blob || !alive || token !== revision) return null;
        note.textContent = 'Uploading…'; return uploadBlob(blob);
      }).then(function (url) {
        if (!url || !alive || token !== revision) return;
        value = url;
        if (replacing) original = source; // Retain the uncropped File for all subsequent crops, until reload/reset.
        paint(value); note.textContent = 'Added.'; changed();
        return saveDraft();
      }).catch(function (err) {
        if (!alive || token !== revision) return;
        setError(MESSAGES[err && err.code] || 'That photo did not upload. Check your connection and try again.');
      }).finally(function () {
        pendingMedia--; choose.disabled = recrop.disabled = remove.disabled = false;
        if (alive && token === revision) { paint(value); note.textContent = ''; }
      });
    }
    choose.addEventListener('click', pick);
    recrop.addEventListener('click', function () { if (value) crop(original || value, false); });
    remove.addEventListener('click', function () { if (!canMutate()) return; revision++; value = ''; original = null; paint(''); note.textContent = ''; changed(); });
    file.addEventListener('change', function () { var picked = file.files && file.files[0]; file.value = ''; if (picked) crop(picked, true); });
    paint('');
    return {
      get: function () { return value; },
      set: function (v) { revision++; original = null; value = typeof v === 'string' ? v : ''; paint(value); },
      focus: function () { choose.focus(); },
      pick: pick,
      dispose: function () { alive = false; revision++; original = null; },
    };
  }

  /* ----------------------------------------------------- scalar controls */

  /** A client-built scalar control (inside list rows). */
  function scalarControl(f, initial, labelText, fieldIdentifier) {
    var wrap = make('div', 'field field--sub');
    var id = 'f-' + Math.random().toString(36).slice(2, 10);
    if (f.type === 'image') {
      var cap = make('span', 'label', labelText);
      var host = make('div');
      wrap.appendChild(cap); wrap.appendChild(host);
      var photo = photoControl(host, f, labelText, fieldIdentifier);
      if (initial) photo.set(initial);
      return { el: wrap, get: photo.get, set: photo.set, focus: photo.focus, pick: photo.pick, dispose: photo.dispose };
    }
    var label = make('label', '', labelText);
    label.setAttribute('for', id);
    var input;
    if (f.type === 'textarea') { input = make('textarea'); input.rows = f.rows || 4; }
    else if (f.type === 'select') {
      input = make('select');
      if (f.default === undefined) { var none = make('option', '', 'Choose…'); none.value = ''; input.appendChild(none); }
      f.options.forEach(function (o) { var opt = make('option', '', o.label); opt.value = o.value; input.appendChild(opt); });
    } else {
      input = make('input');
      input.type = f.type === 'number' ? 'number' : (f.type === 'url' ? 'url' : (f.type === 'date' ? 'date' : 'text'));
      input.autocomplete = 'off';
      if (f.type === 'number') { input.min = f.min; input.max = f.max; input.step = 1; }
    }
    input.id = id;
    if (f.maxLength && f.type !== 'number' && f.type !== 'select') input.maxLength = f.maxLength;
    if (f.placeholder && f.type !== 'select') input.placeholder = f.placeholder;
    if (initial != null && initial !== '') input.value = String(initial);
    else if (f.type === 'select' && f.default !== undefined) input.value = f.default;
    input.addEventListener('input', changed);
    input.addEventListener('change', changed);
    wrap.appendChild(label);
    wrap.appendChild(input);
    if (f.maxLength && (f.type === 'text' || f.type === 'textarea')) wrap.appendChild(counterFor(input, f.maxLength));
    return {
      el: wrap,
      get: function () { return f.type === 'select' ? input.value : input.value.trim(); },
      focus: function () { input.focus(); },
    };
  }

  /* --------------------------------------------------------------- lists */

  function listControl(f) {
    var host = form.querySelector('[data-list="' + f.id + '"]');
    var addBtn = form.querySelector('[data-add="' + f.id + '"]');
    var rows = [];

    function renumber() {
      rows.forEach(function (row, i) {
        row.num.textContent = f.itemLabel + ' ' + (i + 1);
        row.up.disabled = i === 0;
        row.down.disabled = i === rows.length - 1;
        row.remove.disabled = rows.length <= Math.max(1, f.minItems);
      });
      if (addBtn) addBtn.disabled = rows.length >= f.maxItems;
    }

    function addRow(value, focus) {
      if (rows.length >= f.maxItems) return;
      var node = make('div', 'bf-row');
      var head = make('div', 'bf-row__head');
      var num = make('span', 'bf-row__num');
      var tools = make('div', 'bf-row__tools');
      function tool(text, label) { var b = make('button', 'bf-tool', text); b.type = 'button'; b.setAttribute('aria-label', label); tools.appendChild(b); return b; }
      var up = tool('↑', 'Move up'), down = tool('↓', 'Move down'), remove = tool('✕', 'Remove');
      head.appendChild(num); head.appendChild(tools);
      node.appendChild(head);
      var row = { node: node, num: num, up: up, down: down, remove: remove, parts: {} };
      if (f.item) {
        var c = scalarControl(f.item, value, f.itemLabel);
        c.el.classList.add('bf-row__solo');
        row.parts.value = c;
        node.appendChild(c.el);
      } else {
        f.shape.forEach(function (sub) {
          var initial = value && typeof value === 'object' ? value[sub.id] : '';
          var c = scalarControl(sub, initial, sub.label + (sub.required ? ' *' : ''), function () { return f.id + ':' + rows.indexOf(row) + ':' + sub.id; });
          row.parts[sub.id] = c;
          node.appendChild(c.el);
        });
      }
      up.addEventListener('click', function () { move(row, -1); });
      down.addEventListener('click', function () { move(row, 1); });
      remove.addEventListener('click', function () {
        if (!canMutate()) return;
        var i = rows.indexOf(row);
        if (i < 0 || rows.length <= Math.max(1, f.minItems)) return;
        Object.keys(row.parts).forEach(function (key) { if (row.parts[key].dispose) row.parts[key].dispose(); });
        rows.splice(i, 1); host.removeChild(node); renumber(); changed();
        var next = rows[Math.min(i, rows.length - 1)];
        if (next) next.remove.focus(); else if (addBtn) addBtn.focus();
      });
      rows.push(row);
      host.appendChild(node);
      renumber();
      if (focus) { var first = row.parts[Object.keys(row.parts)[0]]; if (first) first.focus(); }
    }

    function move(row, delta) {
      if (!canMutate()) return;
      var i = rows.indexOf(row), j = i + delta;
      if (i < 0 || j < 0 || j >= rows.length) return;
      rows.splice(i, 1); rows.splice(j, 0, row);
      rows.forEach(function (r) { host.appendChild(r.node); });
      renumber(); changed();
      (delta < 0 ? row.up : row.down).focus();
    }

    (f.default && f.default.length ? f.default : [null]).forEach(function (v) { addRow(v, false); });
    while (rows.length < f.minItems) addRow(null, false);
    if (addBtn) addBtn.addEventListener('click', function () { if (!canMutate()) return; addRow(null, true); changed(); });

    return {
      rows: rows,
      get: function () {
        return rows.map(function (row) {
          if (f.item) return row.parts.value.get();
          var out = {};
          f.shape.forEach(function (sub) { out[sub.id] = row.parts[sub.id].get(); });
          return out;
        });
      },
      set: function (v) {
        if (!Array.isArray(v)) return;
        // Reset directly: clicking Remove cannot clear the minimum rows, and emits
        // intermediate autosaves. Dispose invalidates any in-flight photo result.
        rows.forEach(function (row) {
          Object.keys(row.parts).forEach(function (key) { if (row.parts[key].dispose) row.parts[key].dispose(); });
          row.node.remove();
        });
        rows.length = 0;
        v.slice(0, f.maxItems).forEach(function (item) { addRow(item, false); });
        while (rows.length < f.minItems) addRow(null, false);
        renumber(); changed();
      },
      focus: function () { if (addBtn) addBtn.focus(); },
    };
  }

  /* ------------------------------------------------------------ wire up */

  FIELDS.forEach(function (f) {
    if (f.type === 'list') { controls[f.id] = listControl(f); return; }
    if (f.type === 'image') {
      var host = form.querySelector('[data-image="' + f.id + '"]');
      if (host) controls[f.id] = photoControl(host, f, f.label);
      return;
    }
    var input = el('f-' + f.id);
    if (!input) return;
    input.addEventListener('input', changed);
    input.addEventListener('change', changed);
    if (f.id === 'bgmSong') {
      // The shared background-song field: the "no song" checkbox wins over
      // whatever is typed, and unchecking restores the input.
      var none = el('f-bgmSong-none');
      var saved = '';
      if (none) none.addEventListener('change', function () {
        if (none.checked) { saved = input.value; input.value = ''; input.disabled = true; }
        else { input.disabled = false; input.value = saved; }
        changed();
      });
      controls[f.id] = {
        get: function () { return (none && none.checked) ? 'none' : input.value.trim(); },
        set: function (v) { if (none) none.checked = (v === 'none'); input.value = (v === 'none') ? '' : String(v || ''); input.disabled = !!(none && none.checked); },
        focus: function () { (none && none.checked ? none : input).focus(); },
      };
      return;
    }
    var note = form.querySelector('[data-count-for="f-' + f.id + '"]');
    if (note && f.maxLength) {
      var update = function () { var n = input.value.length; note.textContent = n > f.maxLength * 0.75 ? n + ' / ' + f.maxLength : ''; };
      input.addEventListener('input', update); update();
    }
    controls[f.id] = {
      get: function () { return f.type === 'select' ? input.value : input.value.trim(); },
      set: function (v) { input.value = String(v == null ? '' : v); },
      focus: function () { input.focus(); },
    };
  });

  var songInput = el('f-songUrl');
  if (songInput) {
    var songRevision = 0, songSet = controls.songUrl && controls.songUrl.set;
    if (songSet) controls.songUrl.set = function (value) { songRevision++; songSet(value); };
    var uploadSong = make('button','button secondary','Upload a song (MP3 / WAV)'); uploadSong.type='button';
    var songFile=make('input');songFile.type='file';songFile.accept='audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav';songFile.hidden=true;songFile.setAttribute('aria-label','Upload MP3 or WAV song');
    var songNote=make('p','hint');songNote.setAttribute('role','status');
    songInput.parentNode.appendChild(uploadSong);songInput.parentNode.appendChild(songFile);songInput.parentNode.appendChild(songNote);
    uploadSong.addEventListener('click',function(){if(canMutate())songFile.click();});
    songFile.addEventListener('change',function(){var f=songFile.files[0];songFile.value='';if(!f||!canMutate())return;if(!/\.(mp3|wav)$/i.test(f.name)||f.size>12*1024*1024){songNote.textContent='Please choose an MP3 or WAV under 12 MB.';return;}var songToken=songRevision;pendingMedia++;uploadSong.disabled=true;songInput.disabled=true;songNote.textContent='Uploading your song…';
      ensureDraft().then(function(id){return fetch('/api/anniversary-blue/audio?id='+encodeURIComponent(id),{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:f,credentials:'same-origin'});}).then(function(r){return r.json().then(function(b){if(!r.ok||typeof b.url!=='string'||!b.url)throw new Error(b.error||'invalid_audio');return b;});}).then(function(b){if(songToken!==songRevision)return;songInput.value=b.url;changed();songNote.textContent='Song uploaded. Press play in the live preview to listen.';return saveDraft();}).catch(function(){songNote.textContent='Could not upload. Choose a valid MP3/WAV under 12 MB and try again.';}).finally(function(){pendingMedia--;uploadSong.disabled=false;songInput.disabled=false;});
    });
  }

  function collect() {
    var data = {};
    FIELDS.forEach(function (f) { if (controls[f.id]) data[f.id] = controls[f.id].get(); });
    return data;
  }

  /* ---------------------------------------------------------- validation */

  function fieldById(id) { for (var i = 0; i < FIELDS.length; i++) if (FIELDS[i].id === id) return FIELDS[i]; return null; }

  /** First problem in the given step's fields, as { message, focus } — or null. */
  function problemIn(index) {
    var ids = spec.stepFields[index] || [];
    for (var i = 0; i < ids.length; i++) {
      var f = fieldById(ids[i]), c = controls[ids[i]];
      if (!f || !c) continue;
      if (f.type !== 'list') {
        if (f.required && !c.get()) return { message: f.label + ' — this one is needed.', focus: c.focus };
        if (f.type === 'url' && c.get() && !/^https?:\/\/\S+$/i.test(c.get())) return { message: f.label + ' — that link should start with https://', focus: c.focus };
        continue;
      }
      if (!f.shape) continue;
      for (var r = 0; r < c.rows.length; r++) {
        var row = c.rows[r], filled = false, missing = null;
        for (var s = 0; s < f.shape.length; s++) {
          var sub = f.shape[s], v = row.parts[sub.id].get();
          if (v) filled = true; else if (sub.required && !missing) missing = sub;
        }
        if (filled && missing) return { message: f.itemLabel + ' ' + (r + 1) + ' needs “' + missing.label + '” (or remove it).', focus: row.parts[missing.id].focus };
      }
    }
    return null;
  }

  function validateStep(index) {
    var problem = problemIn(index);
    if (!problem) return true;
    setError(problem.message);
    if (problem.focus) problem.focus();
    return false;
  }

  function validateAll() {
    for (var i = 1; i < LAST_STEP; i++) {
      var problem = problemIn(i);
      if (problem) { show(i); setError(problem.message); if (problem.focus) problem.focus(); return false; }
    }
    return true;
  }

  /* ---------------------------------------------------------- navigation */

  function show(index) {
    step = Math.max(0, Math.min(LAST_STEP, index));
    steps.forEach(function (section) { section.hidden = Number(section.getAttribute('data-step')) !== step; });
    progress.forEach(function (item, i) {
      item.classList.toggle('is-current', i === step);
      item.classList.toggle('is-done', i < step);
    });
    if (counter) counter.textContent = 'Step ' + pad(step + 1) + ' of ' + pad(LAST_STEP + 1);
    backBtn.hidden = step === 0;
    nextBtn.hidden = step === LAST_STEP;
    setError('');
    var heading = steps[step] && steps[step].querySelector('h2');
    if (heading && typeof heading.focus === 'function') heading.focus();
    if (step === LAST_STEP) renderReview();
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (sending || !validateStep(step)) return;
    show(step + 1);
  });
  backBtn.addEventListener('click', function () { show(step - 1); });
  progress.forEach(function (item, i) {
    item.addEventListener('click', function () {
      if (sending || i > LAST_STEP) return;
      if (i <= step) { show(i); return; }
      for (var s = step; s < i; s++) if (!validateStep(s)) { if (s !== step) show(s); validateStep(s); return; }
      show(i);
    });
  });

  /* -------------------------------------------------------------- review */

  function shown(f, v) {
    if (f.type === 'select') {
      var key = v || f.default || '';
      for (var i = 0; i < f.options.length; i++) if (f.options[i].value === key) return f.options[i].label;
      return '';
    }
    if (f.type === 'number') return v !== '' && v != null ? String(v) : (f.default != null ? String(f.default) : '');
    return v || (typeof f.default === 'string' ? f.default : '');
  }

  function renderReview() {
    if (!review) return;
    var data = collect();
    var rows = [];
    FIELDS.forEach(function (f) {
      var v = data[f.id];
      if (f.type === 'image') { rows.push([f.label, v ? 'Your photo ✓' : 'The designed illustration']); return; }
      if (f.type === 'list') {
        var items = v || [];
        var n = items.length;
        var photoPart = f.shape && f.shape.filter(function (sub) { return sub.type === 'image'; })[0];
        var photoCount = photoPart ? items.filter(function (item) { return item && item[photoPart.id]; }).length : null;
        var first = items[0] != null ? items[0] : (f.default || [])[0];
        if (first && typeof first === 'object') {
          var sub = f.shape.filter(function (s) { return s.type === 'text' || s.type === 'textarea'; })[0];
          first = sub ? first[sub.id] : '';
        }
        first = typeof first === 'string' ? first : '';
        var summary = n + ' × ' + f.itemLabel.toLowerCase() + (photoCount !== null ? ' (' + photoCount + ' photos added)' : '') + (first ? ' — “' + (first.length > 70 ? first.slice(0, 70) + '…' : first) + '”' : '');
        rows.push([f.label, summary]);
        return;
      }
      var text = shown(f, v);
      if (text) rows.push([f.label, text]);
    });
    review.textContent = '';
    // Text is assigned, never interpolated — the review must not render markup.
    rows.forEach(function (r) {
      var row = make('div', 'review-row');
      row.appendChild(make('span', 'lbl', r[0]));
      row.appendChild(make('span', 'val', r[1]));
      review.appendChild(row);
    });
  }

  /* ------------------------------------------------------------ requests */

  function request(url, payload) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'same-origin',
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) {
          var err = new Error((body && body.error) || 'request_failed');
          err.code = (body && body.error) || 'request_failed';
          throw err;
        }
        return body;
      });
    });
  }

  var saveChain = Promise.resolve();
  function saveDraft() {
    var run = saveChain.then(function () {
      say('Saving…'); var savingVersion = editVersion;
      return request('/api/' + SLUG + '/draft', { id: draftId, customer_data: collect() }).then(function (body) {
        draftId = body.id;
        previewUrl = body.previewUrl;
        if (savingVersion === editVersion) { clearTimeout(autoTimer); autoTimer = 0; say('Saved.'); } else persistSoon();
        return body;
      });
    });
    saveChain = run.catch(function () { /* keep the chain alive */ });
    return run.catch(function (err) {
      say('');
      setError(MESSAGES[err.code] || 'That didn’t save. Check your connection and try again.');
      throw err;
    });
  }

  /* -------------------------------------------------- the live preview */

  function refreshLivePreview() {
    if (!liveFrame) return;
    if (liveBusy) { liveAgain = true; return; }
    liveBusy = true;
    fetch('/' + SLUG + '/preview-frame', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_data: collect() }), credentials: 'same-origin',
    }).then(function (response) {
      if (!response.ok) return null;          // rate-limited or offline: keep the last good frame
      return response.text();
    }).then(function (markup) {
      if (markup) liveFrame.srcdoc = markup;
    }).catch(function () { /* keep the last good frame */ })
      .then(function () {
        liveBusy = false;
        if (liveAgain) { liveAgain = false; scheduleLivePreview(); }
      });
  }

  function scheduleLivePreview() {
    if (!liveFrame) return;
    clearTimeout(liveTimer);
    liveTimer = setTimeout(refreshLivePreview, 450);
  }

  /* ------------------------------------------------ preview + publish */

  if (previewBtn) {
    previewBtn.addEventListener('click', function () {
      if (sending || previewSaving || mediaBusy() || !validateAll()) return;
      previewSaving = true; lockForSend(true); previewBtn.disabled = true;
      saveDraft().then(function () {
        if (previewState) previewState.textContent = 'Saved. It’s ready to send.';
        if (publishBtn) publishBtn.disabled = false;
        openPreview();
      }).catch(function () { /* message already shown */ })
        .then(function () { previewSaving = false; lockForSend(false); previewBtn.disabled = false; });
    });
  }

  function openPreview() {
    if (!previewUrl || !frameHost) return;
    frameHost.textContent = '';
    var frame = document.createElement('iframe');
    frame.src = previewUrl;
    frame.title = 'Your Paigaam';
    frameHost.appendChild(frame);
    if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
    else window.open(previewUrl, '_blank', 'noopener');
  }

  var closeBtn = el('closePreview');
  if (closeBtn && dialog) {
    closeBtn.addEventListener('click', function () { dialog.close(); if (frameHost) frameHost.textContent = ''; });
  }
  var fullscreenBtn = el('fullscreen');
  if (fullscreenBtn) fullscreenBtn.addEventListener('click', function () { if (previewUrl) window.open(previewUrl, '_blank', 'noopener'); });

  if (publishBtn) {
    publishBtn.addEventListener('click', function () {
      if (sending || previewSaving || mediaBusy() || !validateAll()) return; clearTimeout(autoTimer); autoTimer=0; sending = true; lockForSend(true);
      publishBtn.disabled = true;
      say('Publishing…');
      saveDraft() // one tap: the latest typing goes with it
        .then(function () { return request('/api/' + SLUG + '/publish', { id: draftId }); })
        .then(function (body) {
          // Paid template → the server hands us off to the Razorpay checkout.
          if (body && body.razorpay) { return window.PaigaamPay.open({ order: body }).then(function (pay) { showResult(pay.url); }); }
          showResult(body.url);
        })
        .catch(function (err) {
          sending = false; lockForSend(false); publishBtn.disabled = false;
          say('');
          setError((window.PaigaamCouponError && window.PaigaamCouponError(err)) || MESSAGES[err.code] || 'Publishing didn’t work. Try again in a moment.');
        });
    });
  }

  function showResult(url) {
    if (typeof arguments[0] !== 'string' || !/^(https?:\/\/|\/)/.test(arguments[0])) { console.error('bad publish result'); return; } // GUARD
    var wizard = el('wizard');
    var result = el('publishedResult');
    if (wizard) wizard.hidden = true;
    if (!result) return;
    result.hidden = false;
    var input = el('publishedUrl');
    if (input) input.value = url;
    var open = el('openPublished');
    if (open) open.href = url;
    var wa = el('whatsapp');
    if (wa) wa.href = 'https://wa.me/?text=' + encodeURIComponent('I made you something. ' + url);
    var qr = el('qrImage');
    if (qr) qr.src = '/api/qr?url=' + encodeURIComponent(url);
    var title = el('resultTitle');
    if (title) title.focus();
    if (window.scrollTo) window.scrollTo(0, 0);
  }

  var copyBtn = el('copyLink');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var input = el('publishedUrl');
      var shareStatus = el('shareStatus');
      if (!input) return;
      var done = function (ok) { if (shareStatus) shareStatus.textContent = ok ? 'Link copied.' : 'Couldn’t copy — select the link and copy it by hand.'; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(input.value).then(function () { done(true); }, function () { done(false); });
      } else {
        input.select();
        done(document.execCommand && document.execCommand('copy'));
      }
    });
  }

  show(0);
  refreshLivePreview();

  window.addEventListener('beforeunload', function(event) { if (pendingMedia || autoTimer && !sending) { event.preventDefault(); event.returnValue = ''; } });
})();
