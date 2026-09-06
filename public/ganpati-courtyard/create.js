'use strict';
/* Ganpati Courtyard editor behaviour.
 *
 * The overlay is driven by window.COURTYARD_TIMELINE — the exact cue timings
 * the server burns into the exported MP4 — so the preview is the contract:
 * what you see here is what renders. Videos autoplay muted (the ambient
 * loop); the ▶ control plays the full clip with its original sound.
 */
(function () {
  var TL = window.COURTYARD_TIMELINE;
  if (!TL || !TL.cues) return;

  var video = document.getElementById('pv-video');
  var stage = document.querySelector('.stage');
  var layer = document.getElementById('pv-captions');
  var playBtn = document.getElementById('pv-play');
  var note = document.getElementById('stage-note');
  var form = document.getElementById('details');
  var ids = ['greeting', 'mainTitle', 'familyName', 'eventDate', 'eventTime', 'venueName', 'city'];
  var els = {};
  ids.forEach(function (id) { els[id] = document.getElementById(id); });

  /* scale factor from ASS script space (720x1280) to rendered frame */
  function scale() { return layer.clientHeight / TL.playH; }

  /* Build the four caption boxes once; contents update on every keystroke. */
  var boxes = TL.cues.map(function (cue) {
    var frag = document.createDocumentFragment();
    var lines = cue.lines.map(function () {
      var div = document.createElement('div');
      div.className = 'cap';
      frag.appendChild(div);
      return div;
    });
    layer.appendChild(frag);
    return { cue: cue, lines: lines };
  });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Long values shrink instead of overflowing the safe column. */
  function fit(text, base, max) {
    text = String(text || '');
    if (text.length <= max) return base;
    return Math.max(14, Math.round(base * Math.pow(max / text.length, 0.85)));
  }

  var MAX = { greeting: 24, hero: 13, family: 26, closeBig: 18, closeSmall: 38 };
  var HUES = {
    ink: '#4a2c14', maroon: '#7a2d0c', saffron: '#b45a12', cream: '#f7efe1',
  };

  function renderOverlay() {
    var k = scale();
    boxes.forEach(function (box, bi) {
      box.lines.forEach(function (div, li) {
        var line = box.cue.lines[li];
        var text = line.text;
        var size;
        if (bi === 0) size = fit(text, line.size, MAX.greeting);
        else if (bi === 1) size = fit(text, line.size, MAX.hero);
        else if (bi === 2) size = fit(text, line.size, MAX.family);
        else size = fit(text, line.size, li === 0 ? MAX.closeBig : MAX.closeSmall);
        div.textContent = text;
        div.style.fontSize = (size * k).toFixed(1) + 'px';
        div.style.top = (line.y * k).toFixed(1) + 'px';
        div.style.color = bi === 1 || (bi === 3 && li === 0) ? HUES.maroon : HUES.ink;
      });
    });
  }

  /* Cue scheduling follows video.currentTime, applied to the shared timeline. */
  function tick() {
    var t = video.currentTime;
    boxes.forEach(function (box) {
      var on = t >= box.cue.start && t < box.cue.end;
      box.lines.forEach(function (div) { div.classList.toggle('on', on); });
    });
    if (!video.paused && !video.ended) requestAnimationFrame(tick);
  }

  function play() {
    video.muted = false;
    video.loop = false;
    video.currentTime = 0;
    var p = video.play();
    if (p && p.catch) p.catch(function () { video.muted = true; video.play(); });
    playBtn.classList.add('hide');
    if (note) note.textContent = 'Playing the full 10 seconds with sound.';
    video.addEventListener('ended', function () {
      video.muted = true; video.loop = true; video.play();
      playBtn.classList.remove('hide');
      if (note) note.textContent = 'Live preview — every change appears instantly. Press ▶ for the full 10 seconds with sound.';
    }, { once: true });
    requestAnimationFrame(tick);
  }

  playBtn.addEventListener('click', play);

  /* Ambient muted loop keeps the composition visible while editing. */
  video.addEventListener('loadedmetadata', function () {
    video.play().catch(function () { /* waiting for a tap */ });
    requestAnimationFrame(tick);
  });

  /* Live editing: re-run the server's exact cue builder client-side. */
  function currentData() {
    var d = {};
    ids.forEach(function (id) { d[id] = els[id] ? els[id].value.trim() : ''; });
    return d;
  }

  function familyLine(name) {
    return 'आमच्या ' + ((name || '').trim() || 'आपले नाव') + ' परिवारातर्फे';
  }

  function rebuild() {
    var d = currentData();
    boxes[0].cue.lines[0].text = d.greeting || '॥ श्री गणेशाय नमः ॥';
    boxes[1].cue.lines[0].text = d.mainTitle || 'बाप्पा येत आहेत…';
    boxes[2].cue.lines[0].text = familyLine(d.familyName);
    var when = [d.eventDate || 'गणपती आगमन तारीख', d.eventTime || 'आगमनाची वेळ'].filter(Boolean).join('  •  ');
    var where = [d.venueName || 'ठिकाण', d.city || 'शहर'].filter(Boolean).join(', ');
    boxes[3].cue.lines[0].text = 'गणपती आगमन';
    boxes[3].cue.lines[1].text = when;
    boxes[3].cue.lines[2].text = where;
    renderOverlay();
  }

  ids.forEach(function (id) {
    if (els[id]) els[id].addEventListener('input', rebuild);
  });

  /* ---------- draft / publish / export ---------- */
  function post(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    }).then(async function (r) {
      var v = null;
      try { v = await r.json(); } catch (e) { /* non-JSON */ }
      if (!r.ok) throw new Error((v && v.error) || 'server_error');
      return v;
    });
  }

  var state = { id: null, slug: null, editUrl: null };
  try {
    var m = location.pathname.match(/^\/ganpati-courtyard\/preview\/([A-Za-z0-9_-]+)$/);
    if (m) state.id = m[1];
  } catch (e) { /* plain create page */ }

  var btnPreview = document.getElementById('btn-preview');
  var btnDownload = document.getElementById('btn-download');
  var busy = document.getElementById('busy');
  var errBox = document.getElementById('err');
  var readyNote = document.getElementById('ready-note');
  var editNote = document.getElementById('edit-note');

  function ui(busyOn) {
    busy.hidden = !busyOn;
    btnPreview.disabled = busyOn;
    btnDownload.disabled = busyOn;
    if (busyOn) { errBox.hidden = true; }
  }

  function fail(e) {
    errBox.hidden = false;
    var map = {
      validation: 'Please check your entries — something looks too long.',
      forbidden: 'This draft belongs to another device. Open your original link to edit it.',
      limit: 'Too many attempts — please wait a little and try again.',
      render_failed: 'The video could not be created right now. Please try again.',
      storage_unavailable: 'Publishing is paused until persistent storage is attached.',
      too_large: 'Your entries are too long — please shorten them.',
    };
    errBox.textContent = map[e.message] || 'Something went wrong. Please try again.';
  }

  btnPreview.addEventListener('click', function () {
    saveDraft().then(function () { play(); }).catch(fail);
  });

  function saveDraft() {
    errBox.hidden = true;
    return post('/api/ganpati-courtyard/draft', { id: state.id, customer_data: currentData() })
      .then(function (v) { state.id = v.id; return v; });
  }

  btnDownload.addEventListener('click', function () {
    ui(true);
    saveDraft()
      .then(function () {
        if (state.slug) return { slug: state.slug };   // already published — re-export
        return post('/api/ganpati-courtyard/publish', { id: state.id }).then(function (v) {
          state.slug = v.slug; state.editUrl = location.pathname;
          history.replaceState(null, '', '/ganpati-courtyard/preview/' + state.id);
          return v;
        });
      })
      .then(function () { return post('/api/ganpati-courtyard/export', { id: state.id }); })
      .then(function (v) {
        ui(false);
        readyNote.hidden = false;
        var a = document.createElement('a');
        a.href = v.url;
        a.download = 'ganpati-aagman-invitation.mp4';
        document.body.appendChild(a);
        a.click();
        a.remove();
        editNote.hidden = false;
        editNote.innerHTML = 'Saved! Share or re-download anytime: <a href="/p/' + state.slug + '">' + esc(location.origin) + '/p/' + esc(state.slug) + '</a> · <a href="' + v.url + '" download>download again</a>';
      })
      .catch(function (e) { ui(false); fail(e); });
  });

  /* Opening a saved preview restores the fields server-side (COURTYARD_SAVED);
     re-downloading never requires re-entering details. */
  if (window.COURTYARD_SAVED) {
    ids.forEach(function (id) {
      if (els[id] && window.COURTYARD_SAVED[id]) els[id].value = window.COURTYARD_SAVED[id];
    });
  }

  window.addEventListener('resize', renderOverlay);
  renderOverlay();
  rebuild();
})();
