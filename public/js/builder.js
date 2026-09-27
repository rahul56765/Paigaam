/* Paigaam — interactive builder: one question at a time, live preview follows.
   Replaces the old multi-field group form (public/js/create.js). Reuses the
   existing /api/drafts + /api/render-preview endpoints and /preview/:id flow. */
(function () {
  'use strict';
  var boot = window.PAIGAAM_BOOT || {};
  var form = document.getElementById('createForm');
  if (!form) return;

  var total = parseInt(form.dataset.total, 10) || 1;
  var step = 0;
  var draftId = boot.draftId || null;
  var slug = boot.slug || form.dataset.template;
  var fields = boot.fields || [];
  var initial = boot.initial || {};

  var steps = Array.prototype.slice.call(form.querySelectorAll('.bstep'));
  var btnBack = document.getElementById('btnBack');
  var btnNext = document.getElementById('btnNext');
  var frame = document.getElementById('liveFrame');
  var LS_KEY = 'paigaam.builder.' + slug;

  /* ---------- state ---------- */
  var values = {};
  var images = {}; // fieldId → dataURL (files can't live in localStorage)

  /* restore: server draft first, then localStorage (fresher wins per-field) */
  Object.keys(initial).forEach(function (k) { values[k] = initial[k]; });
  try {
    var saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (saved && saved.values) {
      Object.keys(saved.values).forEach(function (k) {
        if (saved.values[k]) values[k] = saved.values[k];
      });
      if (saved.images) images = saved.images || {};
      if (saved.step && !boot.draftId) step = Math.min(parseInt(saved.step, 10) || 0, total - 1);
    }
  } catch (e) { /* private mode etc. */ }

  /* ---------- preview ---------- */
  var previewTimer = null;
  function refreshPreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(function () {
      var data = collectData();
      fetch('/api/render-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: slug, customer_data: data })
      }).then(function (r) { return r.text(); }).then(function (html) {
        if (frame) frame.srcdoc = html;
      }).catch(function () {});
    }, 350);
  }

  function collectData() {
    var data = {};
    Object.keys(values).forEach(function (k) { if (values[k]) data[k] = values[k]; });
    Object.keys(images).forEach(function (k) { if (images[k]) data[k] = images[k]; });
    return data;
  }

  /* after the preview loads, drift it to the section matching the current field */
  function anchorPreview() {
    if (!frame || !frame.contentDocument) return;
    var fid = fields[step] && fields[step].id;
    if (!fid) return;
    var doc = frame.contentDocument;
    /* the renderer marks data-field anchors; fall back to a text probe */
    var el = doc.querySelector('[data-field-anchor="' + fid + '"]');
    if (!el) {
      var val = values[fid];
      if (val && typeof val === 'string' && val.length > 1) {
        var all = doc.querySelectorAll('h1,h2,h3,p,span,div');
        for (var i = 0; i < all.length; i++) {
          if (all[i].children.length === 0 && all[i].textContent && all[i].textContent.indexOf(val) !== -1) { el = all[i]; break; }
        }
      }
    }
    if (el && el.scrollIntoView) {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { el.scrollIntoView(); }
    }
  }
  frame && frame.addEventListener('load', function () { setTimeout(anchorPreview, 250); });

  /* ---------- autosave ---------- */
  var saveTimer = null;
  function saveLocal() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ values: values, images: images, step: step, at: Date.now() }));
    } catch (e) { /* quota (big photos) — values still go to the server draft */ }
  }
  function saveServer() {
    fetch('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: draftId, template: slug, customer_data: collectData() })
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (res && res.id) { draftId = res.id; form.dataset.draft = res.id; saveLocal(); }
    }).catch(function () {});
  }
  function saveAll() {
    saveLocal();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveServer, 1200);
  }

  /* ---------- step machine ---------- */
  function showStep(n, opts) {
    opts = opts || {};
    step = Math.max(0, Math.min(total - 1, n));
    steps.forEach(function (s, i) {
      s.hidden = i !== step;
      if (i === step) {
        s.classList.remove('bstep--in');
        void s.offsetWidth; // restart the entrance animation
        s.classList.add('bstep--in');
      }
    });
    btnBack.hidden = step === 0;
    btnBack.textContent = 'Back';
    btnNext.innerHTML = step === total - 1 ? 'Preview my Paigaam &rarr;' : 'Next &rarr;';
    var err = steps[step].querySelector('.bstep__err');
    if (err) err.hidden = true;
    var input = steps[step].querySelector('[data-field]');
    if (input && input.type !== 'file' && !opts.noFocus && window.matchMedia('(min-width: 721px)').matches) input.focus();
    if (!opts.silent) {
      window.paTrack && window.paTrack('creation_step_viewed', { template: slug, step: step + 1, field: fields[step] && fields[step].id });
    }
    saveLocal();
  }

  function fieldEl(i) { return steps[i] ? steps[i].querySelector('[data-field]') : null; }

  function setFromInput(i) {
    var el = fieldEl(i);
    if (!el) return true;
    var fid = el.dataset.field;
    if (el.type === 'file') {
      var file = el.files && el.files[0];
      if (file) {
        var reader = new FileReader();
        reader.onload = function () {
          images[fid] = reader.result;
          var nameEl = document.getElementById('uploadName');
          if (nameEl) { nameEl.hidden = false; nameEl.textContent = file.name; }
          refreshPreview(); saveAll();
        };
        reader.readAsDataURL(file);
      } else if (values[fid] && !images[fid]) { images[fid] = values[fid]; }
      return true;
    }
    values[fid] = el.value;
    return true;
  }

  /* seed restored values into the DOM */
  steps.forEach(function (s, i) {
    var el = s.querySelector('[data-field]');
    if (!el) return;
    var fid = el.dataset.field;
    var v = images[fid] || values[fid];
    if (el.type === 'file') {
      if (v) {
        images[fid] = v;
        var nameEl = document.getElementById('uploadName');
        if (nameEl) { nameEl.hidden = false; nameEl.textContent = 'Photo added ✓'; }
      }
    } else if (values[fid]) {
      el.value = values[fid];
    }
  });

  /* ---------- validation (current field only, friendly) ---------- */
  var FRIENDLY = {
    recipientName: 'Tell us their name to continue.',
    senderName: 'Add your name to continue.',
    brideName: 'Tell us the bride\u2019s name to continue.',
    groomName: 'Tell us the groom\u2019s name to continue.',
    partnerOne: 'Add your name to continue.',
    partnerTwo: 'Add their name to continue.',
    eventDate: 'Pick a date to continue.',
    venue: 'Add a venue to continue.',
  };
  function validateStep() {
    var el = fieldEl(step);
    if (!el) return true;
    var f = fields[step] || {};
    var err = steps[step].querySelector('.bstep__err');
    if (el.type === 'file') return true; // photo optional everywhere in generic builder
    var v = (el.value || '').trim();
    if (f.required && !v) {
      if (err) { err.textContent = FRIENDLY[f.id] || 'This one\u2019s needed to continue.'; err.hidden = false; }
      el.style.borderBottomColor = 'var(--accent)';
      el.focus();
      return false;
    }
    if (err) err.hidden = true;
    el.style.borderBottomColor = '';
    return true;
  }

  /* ---------- events ---------- */
  form.addEventListener('input', function (e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.field) return;
    if (el.type === 'file') return; // handled in change
    values[el.dataset.field] = el.value;
    refreshPreview();
    saveAll();
    if (!form.dataset.touched) {
      form.dataset.touched = '1';
      window.paTrack && window.paTrack('creation_started', { template: slug });
    }
  });
  form.addEventListener('change', function (e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.field) return;
    setFromInput(step);
    refreshPreview();
    saveAll();
  });

  btnBack.addEventListener('click', function () {
    if (step === 0) return;
    window.paTrack && window.paTrack('creation_back_clicked', { template: slug, step: step + 1 });
    showStep(step - 1);
  });

  btnNext.addEventListener('click', function () {
    if (!validateStep()) return;
    window.paTrack && window.paTrack('creation_step_completed', { template: slug, step: step + 1, field: fields[step] && fields[step].id });
    if (step < total - 1) {
      showStep(step + 1);
      refreshPreview();
      return;
    }
    /* final step → the existing preview/publish flow */
    btnNext.disabled = true; btnNext.textContent = 'Preparing\u2026';
    window.paTrack && window.paTrack('final_preview_opened', { template: slug });
    fetch('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: draftId, template: slug, customer_data: collectData() })
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (res && res.id) {
        try { localStorage.removeItem(LS_KEY); } catch (e) {}
        window.location.href = '/preview/' + res.id;
      } else { throw new Error('no id'); }
    }).catch(function () {
      btnNext.disabled = false; btnNext.innerHTML = 'Preview my Paigaam &rarr;';
      var err = steps[step].querySelector('.bstep__err');
      if (err) { err.textContent = 'Something went quiet — please try again.'; err.hidden = false; }
    });
  });

  /* Enter = Next (feels like a conversation, not a form submit) */
  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type === 'text') {
      e.preventDefault();
      btnNext.click();
    }
  });

  /* funnel marker for the legacy personalization_started event (dashboards) */
  if (window.paTrack) {
    var orig = window.paTrack;
    window.paTrack = function (ev, props) {
      if (ev === 'creation_started') orig('personalization_started', { template: slug });
      return orig(ev, props);
    };
  }

  showStep(step, { silent: step === 0, noFocus: true });
  refreshPreview();
})();
