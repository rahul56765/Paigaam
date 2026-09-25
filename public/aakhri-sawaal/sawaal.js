'use strict';
/**
 * Aakhri Sawaal — the cards, the question and his reply. All copy is
 * server-rendered (templates/aakhri-sawaal/render.js); this script only
 * moves between the cards and builds the reply.
 *
 *   · steps: the build-up cards (≤2) → a heartbeat → the question → his
 *     answer → sent. At most three taps before the question. Each change is
 *     a 350ms transition, and each step is a history entry, so the browser's
 *     back button / back swipe goes back a card.
 *   · reply: WhatsApp first — a wa.me link with the message prefilled, to the
 *     sender's number when there is one, otherwise the generic share. The
 *     message is also copied, in case WhatsApp doesn't open.
 *   · "your answer, framed": his photo is downscaled on the device to 1600px
 *     at most, then framed with his answer on a canvas. It is never uploaded;
 *     he shares or saves the card himself.
 * Reduced motion: no transitions; the heartbeat still advances on its own.
 */
(function () {
  var doc = document;
  function $(id) { return doc.getElementById(id); }
  var stage = $('asStage');
  if (!stage) return;
  var cards = Array.prototype.slice.call(stage.querySelectorAll('.as-card'));
  if (!cards.length) return;

  var data = {};
  try { data = JSON.parse(($('asData') || {}).textContent || '{}') || {}; } catch (e) { data = {}; }
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var T = reduced ? 0 : 350;
  var HEART = +data.cards || 0;        // index of the heartbeat card
  var QUESTION = HEART + 1, REPLY = HEART + 2, SENT = HEART + 3;
  var MAX_EDGE = 1600;

  var current = 0, moving = false, heartTimer = 0;

  function card(i) { return cards[i] || null; }

  /* --------------------------------------------------------- stepping */
  function show(i, back) {
    i = Math.max(0, Math.min(cards.length - 1, i));
    if (i === current && !card(i).hidden) return;
    var from = card(current), to = card(i);
    clearTimeout(heartTimer);
    moving = true;
    to.hidden = false;
    to.classList.add(back ? 'is-back-enter' : 'is-enter');
    if (from && from !== to) from.classList.add(back ? 'is-back-leave' : 'is-leave');
    // one frame later the enter class comes off and the transition runs
    (window.requestAnimationFrame || setTimeout)(function () {
      (window.requestAnimationFrame || setTimeout)(function () { to.classList.remove('is-enter', 'is-back-enter'); });
    });
    setTimeout(function () {
      if (from && from !== to) { from.hidden = true; from.classList.remove('is-leave', 'is-back-leave'); }
      moving = false;
    }, T);
    current = i;
    doc.body.classList.toggle('as-scroll', i >= QUESTION);
    if (i >= QUESTION && window.scrollTo) window.scrollTo(0, 0);
    if (i === HEART) heartTimer = setTimeout(function () { forward(); }, 1500);
    var focusTarget = i === REPLY ? $('asText') : (to.querySelector('h1, h2') || to);
    if (focusTarget && i !== REPLY) { if (!focusTarget.hasAttribute('tabindex')) focusTarget.setAttribute('tabindex', '-1'); }
    setTimeout(function () { try { focusTarget && focusTarget.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, T);
  }

  function push(i) {
    try { window.history.pushState({ as: i }, ''); } catch (e) { /* sandboxed preview: no history */ }
  }
  function forward() {
    if (moving) return;
    var next = current + 1;
    if (next > QUESTION && current < QUESTION) next = QUESTION;
    if (next > SENT) return;
    push(next);
    show(next, false);
  }
  function go(i) { if (moving) return; push(i); show(i, false); }

  try { window.history.replaceState({ as: 0 }, ''); } catch (e) { /* ignore */ }
  window.addEventListener('popstate', function (e) {
    var i = e.state && typeof e.state.as === 'number' ? e.state.as : 0;
    moving = false;
    show(i, i < current);
  });

  // Build-up + heartbeat: a tap (or Enter / Space / →) anywhere moves on.
  cards.forEach(function (c, i) {
    if (i > HEART) return;
    c.setAttribute('tabindex', '0');
    c.setAttribute('role', 'button');
    c.setAttribute('aria-label', (c.textContent || '').replace(/\s+/g, ' ').replace(/\btap\b\s*$/, '').trim() + ' — tap to continue');
    c.addEventListener('click', forward);
    c.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); forward(); }
    });
  });
  try { card(0).focus({ preventScroll: true }); } catch (e) { /* ignore */ }

  var answerBtn = $('asAnswer');
  if (answerBtn) answerBtn.addEventListener('click', function () { go(REPLY); });

  /* ------------------------------------------------------------ reply */
  var text = $('asText'), form = $('asForm'), error = $('asError');
  function setError(msg) { if (!error) return; error.textContent = msg || ''; error.hidden = !msg; }

  Array.prototype.forEach.call(doc.querySelectorAll('[data-quick]'), function (b) {
    b.addEventListener('click', function () {
      if (!text) return;
      var q = b.getAttribute('data-quick');
      text.value = text.value.trim() ? text.value.trim() + ' ' + q : q;
      setError('');
      text.focus();
      scheduleFrame();
    });
  });

  function message() {
    var answer = (text && text.value || '').trim();
    var who = data.sender ? data.sender + '’s' : 'your';
    var lines = ['Reply to ' + who + ' question: “' + String(data.question || '').replace(/\s+/g, ' ').trim() + '”', '', answer];
    if (data.him) lines.push('', '— ' + data.him);
    if (framedBlob) lines.push('', '(I framed a photo with it — sending it next.)');
    return lines.join('\n');
  }

  function copy(value) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(value).catch(function () {}); return; }
    } catch (e) { /* fall through */ }
    try {
      var ta = doc.createElement('textarea');
      ta.value = value; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      doc.body.appendChild(ta); ta.select(); doc.execCommand && doc.execCommand('copy'); doc.body.removeChild(ta);
    } catch (e) { /* nothing more to do */ }
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!text || !text.value.trim()) { setError('Write a word or two first — even “haan” counts.'); if (text) text.focus(); return; }
      setError('');
      var msg = message();
      copy(msg);
      var url = 'https://wa.me/' + (data.number || '') + '?text=' + encodeURIComponent(msg);
      // No 'noopener' feature string: with it, window.open always returns null
      // and we could not tell a blocked popup from an opened one.
      var win = null;
      try { win = window.open(url, '_blank'); } catch (err) { win = null; }
      if (win) { try { win.opener = null; } catch (err) { /* cross-origin already */ } }
      else { try { window.location.href = url; } catch (err) { /* ignore */ } }
      setTimeout(function () { go(SENT); }, 400);
    });
  }
  var again = $('asAgain');
  if (again) again.addEventListener('click', function () { go(REPLY); });

  /* ------------------------------------------- "your answer, framed" */
  var file = $('asFile'), pick = $('asPick'), frame = $('asFrame'), framed = $('asFramed');
  var remove = $('asRemove'), note = $('asPhotoNote'), shareBtn = $('asShareCard');
  var photo = null, framedBlob = null, framedUrl = '', frameTimer = 0;

  /** Load the picked file and downscale it to ≤1600px on the long edge. */
  function downscale(f) {
    return new Promise(function (resolve, reject) {
      if (!f || !/^image\//.test(f.type)) { reject(new Error('type')); return; }
      var src = URL.createObjectURL(f);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) { URL.revokeObjectURL(src); reject(new Error('empty')); return; }
        var k = Math.min(1, MAX_EDGE / Math.max(w, h));
        var c = doc.createElement('canvas');
        c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(src);
        resolve(c);
      };
      img.onerror = function () { URL.revokeObjectURL(src); reject(new Error('decode')); };
      img.src = src;
    });
  }

  function wrap(ctx, words, maxWidth, maxLines) {
    var lines = [], line = '';
    words.split(/\s+/).forEach(function (w) {
      var test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
    });
    if (line) lines.push(line);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…'; }
    return lines;
  }

  /** The framed card: 1080×1350, navy, a gold frame, his photo, his answer. */
  function compose() {
    if (!photo) return Promise.resolve(null);
    var W = 1080, H = 1350;
    var c = doc.createElement('canvas');
    c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    var fontsReady = doc.fonts && doc.fonts.load
      ? Promise.all([doc.fonts.load('italic 300 50px Fraunces'), doc.fonts.load('600 22px Inter')]).catch(function () {})
      : Promise.resolve();
    return fontsReady.then(function () {
      var g = ctx.createRadialGradient(W / 2, H * 0.4, 60, W / 2, H * 0.4, H * 0.8);
      g.addColorStop(0, '#1B2837'); g.addColorStop(1, '#101820');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#F2D16B'; ctx.textAlign = 'center';
      ctx.font = '600 22px Inter, sans-serif';
      ctx.fillText('A A K H R I   S A W A A L', W / 2, 92);
      // the frame
      var fx = 110, fy = 140, fw = W - 220, fh = 800;
      ctx.fillStyle = '#F2D16B'; ctx.fillRect(fx - 18, fy - 18, fw + 36, fh + 36);
      ctx.fillStyle = '#0B1118'; ctx.fillRect(fx - 4, fy - 4, fw + 8, fh + 8);
      // the photo, cover-cropped
      var s = Math.max(fw / photo.width, fh / photo.height);
      var sw = fw / s, sh = fh / s, sx = (photo.width - sw) / 2, sy = (photo.height - sh) / 2;
      ctx.drawImage(photo, sx, sy, sw, sh, fx, fy, fw, fh);
      // his answer
      var answer = (text && text.value || '').trim() || '…';
      ctx.fillStyle = '#F7EFE0';
      ctx.font = 'italic 300 50px Fraunces, Georgia, serif';
      var lines = wrap(ctx, '“' + answer + '”', W - 200, 3);
      var y = fy + fh + 100;
      lines.forEach(function (l) { ctx.fillText(l, W / 2, y); y += 62; });
      if (data.him || data.sender) {
        ctx.fillStyle = '#F2D16B';
        ctx.font = 'italic 300 34px Fraunces, Georgia, serif';
        ctx.fillText(data.him && data.sender ? '— ' + data.him + ', to ' + data.sender : '— ' + (data.him || 'for ' + data.sender), W / 2, Math.min(H - 60, y + 14));
      }
      return new Promise(function (resolve) { c.toBlob(function (b) { resolve(b); }, 'image/jpeg', 0.9); });
    });
  }

  function refreshFrame() {
    return compose().then(function (blob) {
      if (!blob) return;
      framedBlob = blob;
      if (framedUrl) URL.revokeObjectURL(framedUrl);
      framedUrl = URL.createObjectURL(blob);
      if (framed) framed.src = framedUrl;
      if (frame) frame.hidden = false;
      if (shareBtn) shareBtn.hidden = false;
    });
  }
  function scheduleFrame() {
    if (!photo) return;
    clearTimeout(frameTimer);
    frameTimer = setTimeout(refreshFrame, 350);
  }
  if (text) text.addEventListener('input', function () { setError(''); scheduleFrame(); });

  if (pick && file) {
    pick.addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      file.value = '';
      if (!f) return;
      if (note) note.textContent = 'Framing your photo…';
      downscale(f).then(function (canvas) {
        photo = canvas;
        return refreshFrame();
      }).then(function () {
        if (note) note.textContent = 'Framed. It stays on your phone until you share it.';
        if (pick) pick.textContent = 'Choose a different photo';
      }).catch(function () {
        if (note) note.textContent = 'That photo didn’t open — try another one.';
      });
    });
  }
  if (remove) {
    remove.addEventListener('click', function () {
      photo = null; framedBlob = null;
      if (framedUrl) { URL.revokeObjectURL(framedUrl); framedUrl = ''; }
      if (frame) frame.hidden = true;
      if (shareBtn) shareBtn.hidden = true;
      if (note) note.textContent = '';
      if (pick) pick.textContent = 'Add a photo — your answer, framed';
    });
  }
  if (shareBtn) {
    shareBtn.addEventListener('click', function () {
      refreshFrame().then(function () {
        if (!framedBlob) return;
        var f = null;
        try { f = new File([framedBlob], 'my-answer.jpg', { type: 'image/jpeg' }); } catch (e) { f = null; }
        if (f && navigator.canShare && navigator.canShare({ files: [f] }) && navigator.share) {
          navigator.share({ files: [f], text: message() }).catch(function () { /* he cancelled */ });
          return;
        }
        var a = doc.createElement('a');
        a.href = framedUrl; a.download = 'my-answer.jpg';
        doc.body.appendChild(a); a.click(); doc.body.removeChild(a);
        if (note) note.textContent = 'Saved. Send it to ' + (data.sender || 'them') + ' right after your message.';
      });
    });
  }
})();
