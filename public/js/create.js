/* Paigaam — personalization flow: multi-step form + live preview + draft autosave. */
(function () {
  'use strict';
  var boot = window.PAIGAAM_BOOT || {};
  var form = document.getElementById('createForm');
  if (!form) return;

  var total = parseInt(form.dataset.total, 10) || 1;
  var step = 0;
  var draftId = boot.draftId || null;
  var saveTimer = null;

  var steps = Array.prototype.slice.call(form.querySelectorAll('.create__step'));
  var bars = Array.prototype.slice.call(document.querySelectorAll('[data-stepbar]'));
  var btnBack = document.getElementById('btnBack');
  var btnNext = document.getElementById('btnNext');
  var errEl = document.getElementById('formError');

  /* ---- prefill from existing draft ---- */
  var initial = boot.initial || {};
  Object.keys(initial).forEach(function (k) {
    var el = form.querySelector('[data-field="' + k + '"]');
    if (el && el.type !== 'file') el.value = initial[k];
  });

  function showStep(n) {
    step = Math.max(0, Math.min(total - 1, n));
    steps.forEach(function (s, i) { s.hidden = i !== step; });
    bars.forEach(function (b, i) {
      b.classList.toggle('active', i === step);
      b.classList.toggle('done', i < step);
    });
    btnBack.textContent = step === 0 ? 'Back to template' : 'Back';
    btnNext.textContent = step === total - 1 ? 'See my Paigaam' : 'Continue';
    errEl.hidden = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function collectData(cb) {
    var data = {};
    var fields = form.querySelectorAll('[data-field]');
    var pending = 0;
    fields.forEach(function (el) {
      var key = el.dataset.field;
      if (el.dataset.kind === 'image') {
        var file = el.files && el.files[0];
        if (file) {
          pending++;
          var reader = new FileReader();
          reader.onload = function () { data[key] = reader.result; if (--pending === 0) cb(data); };
          reader.readAsDataURL(file);
        } else if (initial[key]) {
          data[key] = initial[key];
        }
      } else if (el.value) {
        data[key] = el.value;
      }
    });
    if (pending === 0) cb(data);
  }

  function validateStep() {
    var current = steps[step];
    var ok = true;
    current.querySelectorAll('[required]').forEach(function (el) {
      if (!el.value || !el.value.trim()) { ok = false; el.style.borderBottomColor = 'var(--accent)'; }
      else { el.style.borderBottomColor = ''; }
    });
    errEl.hidden = ok;
    return ok;
  }

  function saveDraft(cb) {
    collectData(function (data) {
      fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draftId, template: form.dataset.template, customer_data: data })
      }).then(function (r) { return r.json(); }).then(function (res) {
        if (res && res.id) { draftId = res.id; form.dataset.draft = res.id; }
        initial = data;
        if (cb) cb(res);
      }).catch(function () { if (cb) cb(null); });
    });
  }

  /* ---- live preview ---- */
  var frame = document.getElementById('liveFrame');
  function refreshPreview() {
    collectData(function (data) {
      fetch('/api/render-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: form.dataset.template, customer_data: data })
      }).then(function (r) { return r.text(); }).then(function (html) {
        if (frame) frame.srcdoc = html;
      }).catch(function () {});
    });
  }

  var debounce;
  form.addEventListener('input', function () {
    clearTimeout(debounce);
    debounce = setTimeout(function () {
      refreshPreview();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () { saveDraft(); }, 1200);
    }, 350);
  });
  form.addEventListener('change', function () { refreshPreview(); saveDraft(); });

  btnBack.addEventListener('click', function () {
    if (step === 0) { window.location.href = '/templates/' + form.dataset.template; return; }
    showStep(step - 1);
  });
  btnNext.addEventListener('click', function () {
    if (!validateStep()) return;
    if (step < total - 1) { showStep(step + 1); return; }
    btnNext.disabled = true; btnNext.textContent = 'Preparing…';
    saveDraft(function (res) {
      if (res && res.id) window.location.href = '/preview/' + res.id;
      else { btnNext.disabled = false; btnNext.textContent = 'See my Paigaam'; alert('Something went quiet. Please try again.'); }
    });
  });

  var toggle = document.getElementById('previewToggle');
  if (toggle) toggle.addEventListener('click', function () {
    var col = document.getElementById('previewCol');
    col.classList.toggle('force-show');
    toggle.textContent = col.classList.contains('force-show') ? 'Back to details' : 'Preview my Paigaam';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  showStep(0);
  refreshPreview();
})();
