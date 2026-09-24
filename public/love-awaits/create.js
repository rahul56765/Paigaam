'use strict';
/**
 * Love Awaits generator behaviour: step navigation, draft saving, preview and
 * publish. Field ids here mirror templates/love-awaits/schema.js exactly.
 */
(function () {
  var FIELDS = ['recipientName', 'senderName', 'introTitle', 'question', 'questionNote', 'yesLabel', 'noLabel', 'finaleTitle', 'finaleLine'];
  var LAST_STEP = 3;

  var form = document.getElementById('awaitsForm');
  if (!form) return;

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

  var step = 0;
  var draftId = null;
  var previewUrl = null;
  var saving = false;

  function el(id) { return document.getElementById(id); }
  function value(id) { var node = el(id); return node ? node.value.trim() : ''; }

  function collect() {
    var data = {};
    FIELDS.forEach(function (name) { data[name] = value(name); });
    return data;
  }

  function setError(message) {
    if (!errorBox) return;
    if (message) { errorBox.textContent = message; errorBox.hidden = false; }
    else { errorBox.textContent = ''; errorBox.hidden = true; }
  }

  function say(message) { if (status) status.textContent = message || ''; }

  function show(index) {
    step = Math.max(0, Math.min(LAST_STEP, index));
    steps.forEach(function (section) {
      section.hidden = Number(section.getAttribute('data-step')) !== step;
    });
    progress.forEach(function (item, i) {
      item.classList.toggle('is-current', i === step);
      item.classList.toggle('is-done', i < step);
    });
    if (counter) counter.textContent = 'Step 0' + (step + 1) + ' of 0' + (LAST_STEP + 1);
    backBtn.hidden = step === 0;
    nextBtn.hidden = step === LAST_STEP;
    setError('');
    var heading = steps[step] && steps[step].querySelector('h2');
    if (heading) heading.focus();
    if (step === LAST_STEP) renderReview();
  }

  /** The recipient's name is the only thing we insist on. */
  function validateStep() {
    if (step === 1 && !value('recipientName')) {
      setError('Their name, at least — the rest can stay as it is.');
      var node = el('recipientName');
      if (node) node.focus();
      return false;
    }
    return true;
  }

  function renderReview() {
    if (!review) return;
    var data = collect();
    var rows = [
      ['For', data.recipientName],
      ['The question', data.question || 'Will You Be My Forever?'],
      ['The yes button', data.yesLabel || 'Yes, Forever'],
      ['The no button', data.noLabel || 'No'],
      ['The celebration', data.finaleTitle || 'Forever & Always'],
      ['Signed', data.senderName],
    ].filter(function (row) { return row[1]; });
    review.innerHTML = rows.map(function () {
      return '<div class="review-row"><span class="lbl"></span><span class="val"></span></div>';
    }).join('');
    // Text is assigned, never interpolated — the review must not render markup.
    Array.prototype.slice.call(review.querySelectorAll('.review-row')).forEach(function (node, i) {
      node.querySelector('.lbl').textContent = rows[i][0];
      node.querySelector('.val').textContent = rows[i][1];
    });
  }

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

  var MESSAGES = {
    validation: 'Something in there is a little too long — shorten it and try again.',
    limit: 'That is a lot of proposals for one day. Try again a bit later.',
    storage_unavailable: 'Publishing is paused right now. Your draft is safe — try again shortly.',
    forbidden: 'This proposal can’t be edited any more.',
    not_found: 'This proposal has wandered off. Reload and start again.',
  };

  function saveDraft() {
    if (saving) return Promise.reject(new Error('busy'));
    saving = true;
    say('Saving…');
    return request('/api/love-awaits/draft', { id: draftId, customer_data: collect() })
      .then(function (body) {
        draftId = body.id;
        previewUrl = body.previewUrl;
        saving = false;
        say('Saved.');
        return body;
      })
      .catch(function (err) {
        saving = false;
        say('');
        setError(MESSAGES[err.code] || 'That didn’t save. Check your connection and try again.');
        throw err;
      });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!validateStep()) return;
    show(step + 1);
  });

  backBtn.addEventListener('click', function () { show(step - 1); });

  progress.forEach(function (item, i) {
    item.addEventListener('click', function () {
      if (i <= step || value('recipientName')) show(i);
    });
  });

  function validateStepOne() {
    if (!value('recipientName')) {
      setError('Their name is still missing — step 02.');
      show(1);
      var node = el('recipientName');
      if (node) node.focus();
      return false;
    }
    return true;
  }

  if (previewBtn) {
    previewBtn.addEventListener('click', function () {
      if (!validateStepOne()) return;
      previewBtn.disabled = true;
      saveDraft().then(function () {
        if (previewState) previewState.textContent = 'Saved. Your proposal is ready to send.';
        if (publishBtn) publishBtn.disabled = false;
        openPreview();
      }).catch(function () { /* message already shown */ })
        .then(function () { previewBtn.disabled = false; });
    });
  }

  function openPreview() {
    if (!dialog || !frameHost || !previewUrl) return;
    var frame = document.createElement('iframe');
    frame.src = previewUrl;
    frame.title = 'Love Awaits preview';
    frame.setAttribute('allow', 'autoplay');
    frameHost.innerHTML = '';
    frameHost.appendChild(frame);
    if (typeof dialog.showModal === 'function') dialog.showModal();
  }

  if (dialog) {
    dialog.addEventListener('close', function () { if (frameHost) frameHost.innerHTML = ''; });
    var closeBtn = el('closePreview');
    if (closeBtn) closeBtn.addEventListener('click', function () { dialog.close(); });
    var fullBtn = el('fullscreen');
    if (fullBtn) fullBtn.addEventListener('click', function () { if (previewUrl) window.open(previewUrl, '_blank', 'noopener'); });
  }

  if (publishBtn) {
    publishBtn.addEventListener('click', function () {
      if (!draftId) { if (!validateStepOne()) return; }
      publishBtn.disabled = true;
      say('Publishing…');
      saveDraft()
        .catch(function () { return null; })
        .then(function () {
          return request('/api/love-awaits/publish', { id: draftId });
        })
        .then(function (body) {
          if (!body || !body.url) throw new Error('request_failed');
          if (status) status.textContent = '';
          return showResult(body.url);
        })
        .catch(function (err) {
          say('');
          setError(MESSAGES[err.code] || 'That didn’t publish. Check your connection and try again.');
          publishBtn.disabled = false;
        });
    });
  }

  function showResult(url) {
    var wizard = document.getElementById('wizard');
    var result = document.getElementById('publishedResult');
    if (wizard) wizard.hidden = true;
    if (!result) { window.location.href = url; return; }
    result.hidden = false;
    var input = el('publishedUrl');
    if (input) input.value = url;
    var open = el('openPublished');
    if (open) open.href = url;
    var wa = el('whatsapp');
    if (wa) wa.href = 'https://wa.me/?text=' + encodeURIComponent('A question for you ❤️ ' + url);
    var qr = el('qrImage');
    if (qr) qr.src = '/api/qr?url=' + encodeURIComponent(url);
    if (result.scrollIntoView) result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var copyBtn = el('copyLink');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        function done() { var s = el('shareStatus'); if (s) s.textContent = 'Copied. Send it to them.'; }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, done);
        else if (input) { input.select(); try { document.execCommand('copy'); } catch (e) {} done(); }
      });
    }
  }
})();
