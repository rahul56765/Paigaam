'use strict';
/**
 * Maafi generator behaviour: step navigation, LIVE preview (debounced,
 * stateless — updates as the sender types, no saving needed), draft saving,
 * preview-in-dialog and publish. Field ids here mirror
 * templates/maafi/schema.js exactly.
 */
(function () {
  var FIELDS = ['recipientName', 'senderName', 'headline', 'yesLabel', 'noLabel', 'celebration'];
  var LAST_STEP = 3;

  var form = document.getElementById('maafiForm');
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
  var liveFrame = document.getElementById('liveFrame');

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
      ['The opening plea', data.headline || 'I’m really sorry ❤️'],
      ['The yes button', data.yesLabel || 'Okay baby, I forgive you 💖'],
      ['The no button', data.noLabel || 'No, I’m still angry 😠'],
      ['The celebration', data.celebration || 'Yay! You forgave me! 😍💖🥳'],
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
    limit: 'That is a lot of apologies for one day. Try again a bit later.',
    storage_unavailable: 'Publishing is paused right now. Your draft is safe — try again shortly.',
    forbidden: 'This apology can’t be edited any more.',
    not_found: 'This apology has wandered off. Reload and start again.',
  };

  /* ------------------------------------------------ the live preview pane */

  var liveTimer = 0;
  var livePending = null;

  function refreshLivePreview() {
    if (!liveFrame) return;
    liveFrame.src = '/maafi/preview-frame?t=' + Date.now() +
      '&d=' + encodeURIComponent(JSON.stringify(collect()));
  }

  function scheduleLivePreview() {
    if (!liveFrame) return;
    // At most one render in flight; the newest input always wins.
    clearTimeout(liveTimer);
    liveTimer = setTimeout(refreshLivePreview, 350);
  }

  FIELDS.forEach(function (name) {
    var node = el(name);
    if (!node) return;
    node.addEventListener('input', function () {
      scheduleLivePreview();
      if (publishBtn && !publishBtn.disabled) {
        publishBtn.disabled = true;
        if (previewState) previewState.textContent = 'You changed something — save a preview again before sending.';
      }
    });
  });

  function saveDraft() {
    if (saving) return Promise.reject(new Error('busy'));
    saving = true;
    say('Saving…');
    return request('/api/maafi/draft', { id: draftId, customer_data: collect() })
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

  if (previewBtn) {
    previewBtn.addEventListener('click', function () {
      if (!validateStepOne()) return;
      previewBtn.disabled = true;
      saveDraft().then(function () {
        if (previewState) previewState.textContent = 'Saved. Your apology is ready to send.';
        if (publishBtn) publishBtn.disabled = false;
        openPreview();
      }).catch(function () { /* message already shown */ })
        .then(function () { previewBtn.disabled = false; });
    });
  }

  function validateStepOne() {
    if (!value('recipientName')) {
      setError('Their name is still missing — step 02.');
      show(1);
      return false;
    }
    return true;
  }

  function openPreview() {
    if (!previewUrl || !frameHost) return;
    frameHost.innerHTML = '';
    var frame = document.createElement('iframe');
    frame.src = previewUrl;
    frame.title = 'Your apology';
    frame.setAttribute('loading', 'lazy');
    frameHost.appendChild(frame);
    if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
    else window.open(previewUrl, '_blank', 'noopener');
  }

  var closeBtn = document.getElementById('closePreview');
  if (closeBtn && dialog) {
    closeBtn.addEventListener('click', function () {
      dialog.close();
      if (frameHost) frameHost.innerHTML = '';
    });
  }
  var fullscreenBtn = document.getElementById('fullscreen');
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', function () {
      if (previewUrl) window.open(previewUrl, '_blank', 'noopener');
    });
  }

  if (publishBtn) {
    publishBtn.addEventListener('click', function () {
      if (!draftId) { setError('Save a preview first.'); return; }
      publishBtn.disabled = true;
      say('Publishing…');
      request('/api/maafi/publish', { id: draftId })
        .then(function (body) { showResult(body.url); })
        .catch(function (err) {
          publishBtn.disabled = false;
          say('');
          setError(MESSAGES[err.code] || 'Publishing didn’t work. Try again in a moment.');
        });
    });
  }

  function showResult(url) {
    var wizard = document.getElementById('wizard');
    var result = document.getElementById('publishedResult');
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
  }

  var copyBtn = document.getElementById('copyLink');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var input = el('publishedUrl');
      var shareStatus = document.getElementById('shareStatus');
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
