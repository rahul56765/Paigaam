'use strict';
/**
 * Sau Wajah generator behaviour: step navigation, photo preparation and
 * upload, draft saving, preview and publish. Field ids here mirror
 * templates/sau-wajah/schema.js exactly. Photos are re-encoded client-side
 * via canvas (long edge ≤1600px, JPEG q0.82) before upload — the server
 * re-validates magic bytes and dimensions. Ported from the Love Album
 * generator, which this wizard's upload step shares.
 */
(function () {
  var FIELDS = ['recipientName', 'senderName', 'heroTitle', 'heroSubtitle', 'galleryHeading', 'reasonsHeading', 'reasons', 'letterTitle', 'letterBody', 'signature'];
  var MAX_PHOTOS = 9;
  var LAST_STEP = 4;

  var form = document.getElementById('sauwajahForm');
  if (!form) return;

  var steps = Array.prototype.slice.call(form.querySelectorAll('.step'));
  var progress = Array.prototype.slice.call(document.querySelectorAll('#progress li'));
  var counter = document.getElementById('stepCounter');
  var errorBox = document.getElementById('formError');
  var statusEl = document.getElementById('status');
  var backBtn = document.getElementById('back');
  var nextBtn = document.getElementById('next');
  var review = document.getElementById('review');
  var previewBtn = document.getElementById('savePreview');
  var previewState = document.getElementById('previewState');
  var publishBtn = document.getElementById('publish');
  var dialog = document.getElementById('previewDialog');
  var frameHost = document.getElementById('frameHost');
  var photoCount = document.getElementById('photoCount');
  var photoList = document.getElementById('photoList');

  var step = 0;
  var draftId = null;
  var previewUrl = null;
  var saving = false;
  var photos = []; // { blob, localUrl, url, error }
  var busy = false;

  function el(id) { return document.getElementById(id); }
  function value(id) { var node = el(id); return node ? node.value.trim() : ''; }

  function collect() {
    var data = {};
    FIELDS.forEach(function (name) { data[name] = value(name); });
    data.photos = photos.filter(function (p) { return p.url; }).map(function (p) { return { url: p.url, alt: '' }; });
    return data;
  }

  function setError(message) {
    if (!errorBox) return;
    if (message) { errorBox.textContent = message; errorBox.hidden = false; }
    else { errorBox.textContent = ''; errorBox.hidden = true; }
  }
  function say(message) { if (statusEl) statusEl.textContent = message || ''; }

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
      ['The big line', data.heroTitle || 'happy birthday my girlfriend!!'],
      ['Reasons', data.reasons ? data.reasons.split('\n').filter(function (l) { return l.trim(); }).length + ' written' : ''],
      ['Photos', data.photos.length ? data.photos.length + ' uploaded' : 'none — placeholders will play'],
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

  /* ------------------------------------------------------------- photos */

  function renderPhotos() {
    if (photoCount) photoCount.textContent = photos.length ? photos.length + ' of ' + MAX_PHOTOS + ' photos' : '';
    if (!photoList) return;
    photoList.innerHTML = '';
    photos.forEach(function (photo, index) {
      var card = document.createElement('div');
      card.className = 'photo-card';
      var image = document.createElement('img');
      image.src = photo.localUrl || photo.url || '';
      image.alt = 'Photo ' + (index + 1);
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'photo-remove';
      remove.textContent = '×';
      remove.setAttribute('aria-label', 'Remove photo ' + (index + 1));
      remove.addEventListener('click', function () {
        if (busy) return;
        if (photo.localUrl) URL.revokeObjectURL(photo.localUrl);
        photos = photos.filter(function (p) { return p !== photo; });
        renderPhotos();
        gatePublish();
      });
      card.appendChild(image);
      card.appendChild(remove);
      photoList.appendChild(card);
    });
  }

  /** Client-side re-encode: long edge ≤1600px, JPEG q0.82, canvas-flattened. */
  function prepareImage(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return Promise.reject({ code: 'invalid_image' });
    if (file.size > 8 * 1024 * 1024) return Promise.reject({ code: 'too_large' });
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
        } catch (err) { reject(err.code ? err : { code: 'invalid_image' }); }
      };
      image.onerror = function () { URL.revokeObjectURL(source); reject({ code: 'invalid_image' }); };
      image.src = source;
    }).finally(function () { URL.revokeObjectURL(source); });
  }

  function addPhotos(files) {
    if (busy) return;
    setError('');
    busy = true;
    say('Reading photos…');
    var rejected = null;
    var chain = Promise.resolve();
    Array.prototype.slice.call(files).forEach(function (file) {
      if (photos.length >= MAX_PHOTOS) return;
      chain = chain.then(function () {
        return prepareImage(file).then(function (blob) {
          photos.push({ blob: blob, localUrl: URL.createObjectURL(blob), url: null, error: null });
          renderPhotos();
        }).catch(function (err) { rejected = err.code || 'invalid_image'; });
      });
    });
    chain.then(function () {
      busy = false;
      say('');
      renderPhotos();
      gatePublish();
      if (rejected) {
        var MESSAGES = { invalid_image: 'One of those files is not an image we can use (JPG, PNG or WebP).', too_large: 'One of those photos is too large — keep each under 8MB.' };
        setError(MESSAGES[rejected] || 'Something went wrong reading those photos.');
      }
    });
  }

  var chooseBtn = el('choosePhotos');
  var fileInput = el('photoFiles');
  if (chooseBtn && fileInput) {
    chooseBtn.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      addPhotos(fileInput.files);
      fileInput.value = '';
    });
  }

  /* ----------------------------------------------------------- requests */

  function request(url, payload, rawBody, contentType) {
    return fetch(url, {
      method: 'POST',
      headers: contentType ? { 'Content-Type': contentType } : { 'Content-Type': 'application/json' },
      body: rawBody || JSON.stringify(payload),
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
    limit: 'That is a lot of Paigaams for one day — try again a bit later.',
    too_large: 'One of those photos is too large — keep each under 8MB.',
    invalid_image: 'One of those files is not an image we can use (JPG, PNG or WebP).',
    storage_unavailable: 'Publishing is paused right now. Your draft is safe — try again shortly.',
    forbidden: 'This Paigaam can’t be edited any more.',
    not_found: 'This Paigaam has wandered off. Reload and start again.',
  };

  function saveDraft() {
    if (saving) return Promise.reject(new Error('busy'));
    saving = true;
    say('Saving…');
    return request('/api/sau-wajah/draft', { id: draftId, customer_data: collect() })
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

  function gatePublish() {
    if (!publishBtn) return;
    var ready = !!draftId && photos.every(function (p) { return p.url; });
    if (publishBtn.disabled && ready && previewState) previewState.textContent = 'Ready to publish.';
    publishBtn.disabled = !ready;
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
      if (busy || saving) return;
      if (!value('recipientName')) { setError('Their name is still missing — step 02.'); show(1); return; }
      previewBtn.disabled = true;
      busy = true;
      saveDraft().then(function () {
        var pending = photos.filter(function (p) { return !p.url; });
        var uploadChain = Promise.resolve();
        pending.forEach(function (photo) {
          uploadChain = uploadChain.then(function () {
            return request('/api/sau-wajah/upload?id=' + encodeURIComponent(draftId), null, photo.blob, 'image/jpeg').then(function (result) {
              photo.url = result.url;
              renderPhotos();
              return saveDraft();
            });
          });
        });
        return uploadChain;
      }).then(function () {
        busy = false;
        if (previewState) previewState.textContent = 'Saved. Your Paigaam is ready to send.';
        gatePublish();
        openPreview();
      }).catch(function (err) {
        busy = false;
        gatePublish();
        setError(MESSAGES[err.code] || 'That didn’t save. Check your connection and try again.');
      }).then(function () { previewBtn.disabled = false; });
    });
  }

  function openPreview() {
    if (!previewUrl || !frameHost) return;
    frameHost.innerHTML = '';
    var frame = document.createElement('iframe');
    frame.src = previewUrl;
    frame.title = 'Your Paigaam';
    frame.setAttribute('loading', 'lazy');
    frame.setAttribute('allow', 'autoplay');
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
      request('/api/sau-wajah/publish', { id: draftId })
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

  // Typing invalidates the saved preview, so publishing is gated on a re-save.
  FIELDS.forEach(function (name) {
    var node = el(name);
    if (!node) return;
    node.addEventListener('input', function () {
      if (publishBtn && !publishBtn.disabled) {
        publishBtn.disabled = true;
        if (previewState) previewState.textContent = 'You changed something — save a preview again before sending.';
      }
    });
  });

  show(0);
})();
