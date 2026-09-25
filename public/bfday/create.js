'use strict';
/**
 * Boyfriend Day family generator behaviour — shared by every member.
 *
 * Reads the template's field spec from <script id="bfSpec"> (emitted by
 * pages/bfdayCreate.js from templates/<slug>/config.js) and drives:
 *   · step navigation + per-step required checks
 *   · list fields (add / remove / reorder rows; defaults pre-filled)
 *   · photo fields (client re-encode → upload to the draft → live preview)
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
    validation: 'Something in there is a little too long or not quite right — check it and try again.',
    limit: 'That is a lot for one day. Try again a bit later.',
    storage_unavailable: 'Publishing is paused right now. Your draft is safe — try again shortly.',
    forbidden: 'This Paigaam can’t be edited any more.',
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

  function changed() {
    scheduleLivePreview();
    if (publishBtn && !publishBtn.disabled) {
      publishBtn.disabled = true;
      if (previewState) previewState.textContent = 'You changed something — save a preview again before sending.';
    }
  }

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

  /** Client-side re-encode: long edge ≤1600px, JPEG q0.82, canvas-flattened. */
  function prepareImage(file) {
    if (!file || ['image/jpeg', 'image/png', 'image/webp'].indexOf(file.type) < 0) return Promise.reject({ code: 'invalid_image' });
    if (file.size > 15 * 1024 * 1024) return Promise.reject({ code: 'too_large' });
    var source = URL.createObjectURL(file);
    var image = new Image();
    return new Promise(function (resolve, reject) {
      image.onload = function () {
        try {
          if (!image.naturalWidth || !image.naturalHeight) throw { code: 'invalid_image' };
          var canvas = document.createElement('canvas');
          var scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          var ctx = canvas.getContext('2d');
          if (!ctx) throw { code: 'invalid_image' };
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(function (blob) {
            canvas.width = canvas.height = 1;
            if (!blob) return reject({ code: 'invalid_image' });
            if (blob.size > 2 * 1024 * 1024) return reject({ code: 'too_large' });
            resolve(blob);
          }, 'image/jpeg', 0.82);
        } catch (err) { reject(err && err.code ? err : { code: 'invalid_image' }); }
      };
      image.onerror = function () { reject({ code: 'invalid_image' }); };
      image.src = source;
    }).then(function (blob) { URL.revokeObjectURL(source); return blob; },
      function (err) { URL.revokeObjectURL(source); throw err; });
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
  function photoControl(host, f, labelText) {
    var value = '';
    host.textContent = '';
    host.classList.add('bf-photo');
    var thumb = make('div', 'bf-photo__thumb');
    var img = make('img');
    img.alt = '';
    var empty = make('span', 'bf-photo__empty', 'No photo yet — the design’s own illustration plays.');
    thumb.appendChild(img); thumb.appendChild(empty);
    var tools = make('div', 'bf-photo__tools');
    var choose = make('button', 'button secondary', 'Choose a photo');
    choose.type = 'button';
    var remove = make('button', 'button text-button', 'Remove');
    remove.type = 'button';
    var file = make('input');
    file.type = 'file';
    file.accept = 'image/jpeg,image/png,image/webp';
    file.hidden = true;
    file.setAttribute('aria-label', labelText || f.label);
    var note = make('p', 'hint bf-photo__note');
    note.setAttribute('aria-live', 'polite');
    tools.appendChild(choose); tools.appendChild(remove); tools.appendChild(file);
    host.appendChild(thumb); host.appendChild(tools); host.appendChild(note);

    function paint(src) {
      img.hidden = !src; empty.hidden = !!src;
      if (src) img.src = src; else img.removeAttribute('src');
      choose.textContent = value || src ? 'Replace photo' : 'Choose a photo';
      remove.hidden = !value;
    }
    paint('');

    choose.addEventListener('click', function () { file.click(); });
    remove.addEventListener('click', function () { value = ''; paint(''); note.textContent = ''; changed(); });
    file.addEventListener('change', function () {
      var picked = file.files && file.files[0];
      file.value = '';
      if (!picked) return;
      setError('');
      choose.disabled = true;
      note.textContent = 'Preparing your photo…';
      var local = null;
      prepareImage(picked).then(function (blob) {
        local = URL.createObjectURL(blob);
        paint(local);
        note.textContent = 'Uploading…';
        return uploadBlob(blob);
      }).then(function (url) {
        value = url;
        paint(url);
        note.textContent = 'Added.';
        changed();
      }).catch(function (err) {
        paint(value);
        note.textContent = '';
        setError(MESSAGES[err && err.code] || 'That photo didn’t upload. Check your connection and try again.');
      }).then(function () {
        choose.disabled = false;
        if (local) setTimeout(function () { URL.revokeObjectURL(local); }, 4000);
      });
    });

    return {
      get: function () { return value; },
      set: function (v) { value = typeof v === 'string' ? v : ''; paint(value); },
      focus: function () { choose.focus(); },
    };
  }

  /* ----------------------------------------------------- scalar controls */

  /** A client-built scalar control (inside list rows). */
  function scalarControl(f, initial, labelText) {
    var wrap = make('div', 'field field--sub');
    var id = 'f-' + Math.random().toString(36).slice(2, 10);
    if (f.type === 'image') {
      var cap = make('span', 'label', labelText);
      var host = make('div');
      wrap.appendChild(cap); wrap.appendChild(host);
      var photo = photoControl(host, f, labelText);
      if (initial) photo.set(initial);
      return { el: wrap, get: photo.get, focus: photo.focus };
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
      input.type = f.type === 'number' ? 'number' : (f.type === 'url' ? 'url' : 'text');
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
          var c = scalarControl(sub, initial, sub.label + (sub.required ? ' *' : ''));
          row.parts[sub.id] = c;
          node.appendChild(c.el);
        });
      }
      up.addEventListener('click', function () { move(row, -1); });
      down.addEventListener('click', function () { move(row, 1); });
      remove.addEventListener('click', function () {
        var i = rows.indexOf(row);
        if (i < 0 || rows.length <= Math.max(1, f.minItems)) return;
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
      var i = rows.indexOf(row), j = i + delta;
      if (i < 0 || j < 0 || j >= rows.length) return;
      rows.splice(i, 1); rows.splice(j, 0, row);
      rows.forEach(function (r) { host.appendChild(r.node); });
      renumber(); changed();
      (delta < 0 ? row.up : row.down).focus();
    }

    (f.default && f.default.length ? f.default : [null]).forEach(function (v) { addRow(v, false); });
    while (rows.length < f.minItems) addRow(null, false);
    if (addBtn) addBtn.addEventListener('click', function () { addRow(null, true); changed(); });

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
    var note = form.querySelector('[data-count-for="f-' + f.id + '"]');
    if (note && f.maxLength) {
      var update = function () { var n = input.value.length; note.textContent = n > f.maxLength * 0.75 ? n + ' / ' + f.maxLength : ''; };
      input.addEventListener('input', update); update();
    }
    controls[f.id] = {
      get: function () { return f.type === 'select' ? input.value : input.value.trim(); },
      focus: function () { input.focus(); },
    };
  });

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
    if (!validateStep(step)) return;
    show(step + 1);
  });
  backBtn.addEventListener('click', function () { show(step - 1); });
  progress.forEach(function (item, i) {
    item.addEventListener('click', function () {
      if (i > LAST_STEP) return;
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
        var items = (v || []).filter(function (x) {
          if (typeof x === 'string') return !!x;
          return x && Object.keys(x).some(function (k) { return !!x[k]; });
        });
        var n = items.length || (f.default || []).length;
        var first = items[0] != null ? items[0] : (f.default || [])[0];
        if (first && typeof first === 'object') {
          var sub = f.shape.filter(function (s) { return s.type === 'text' || s.type === 'textarea'; })[0];
          first = sub ? first[sub.id] : '';
        }
        first = typeof first === 'string' ? first : '';
        var summary = n + ' × ' + f.itemLabel.toLowerCase() + (first ? ' — “' + (first.length > 70 ? first.slice(0, 70) + '…' : first) + '”' : '');
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
      say('Saving…');
      return request('/api/' + SLUG + '/draft', { id: draftId, customer_data: collect() }).then(function (body) {
        draftId = body.id;
        previewUrl = body.previewUrl;
        say('Saved.');
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
      if (!validateAll()) return;
      previewBtn.disabled = true;
      saveDraft().then(function () {
        if (previewState) previewState.textContent = 'Saved. It’s ready to send.';
        if (publishBtn) publishBtn.disabled = false;
        openPreview();
      }).catch(function () { /* message already shown */ })
        .then(function () { previewBtn.disabled = false; });
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
      if (!draftId) { setError('Save a preview first.'); return; }
      publishBtn.disabled = true;
      say('Publishing…');
      request('/api/' + SLUG + '/publish', { id: draftId })
        .then(function (body) { showResult(body.url); })
        .catch(function (err) {
          publishBtn.disabled = false;
          say('');
          setError(MESSAGES[err.code] || 'Publishing didn’t work. Try again in a moment.');
        });
    });
  }

  function showResult(url) {
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
})();
