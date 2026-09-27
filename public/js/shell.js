/* Paigaam builder shell — progress dots + back-arrow + final-panel polish.
   Purely additive: wizard engines remain the source of truth for steps. */
(function () {
  'use strict';

  /* ---- progress dots mirror the wizard's #progress list / #stepCounter ---- */
  var dotsHost = document.getElementById('shellDots');
  var counter = document.getElementById('stepCounter');
  var progressItems = document.querySelectorAll('#progress li');
  var dotCount = progressItems.length || 0;

  function stepIndex() {
    if (counter) {
      var m = counter.textContent.match(/(\d+)\s*(?:\/|of)\s*(\d+)/i) ||
              counter.textContent.match(/Step\s*(\d+)\s*of\s*(\d+)/i);
      if (m) return { i: parseInt(m[1], 10) - 1, total: parseInt(m[2], 10) };
    }
    var visible = document.querySelector('.step:not([hidden])');
    if (visible) {
      var idx = Number(visible.getAttribute('data-step'));
      return { i: isNaN(idx) ? 0 : idx, total: document.querySelectorAll('.step').length };
    }
    return null;
  }

  function renderDots() {
    var s = stepIndex();
    if (!dotsHost || !s || !s.total) return;
    if (dotsHost.childElementCount !== s.total) {
      dotsHost.innerHTML = '';
      for (var i = 0; i < s.total; i++) {
        var d = document.createElement('span');
        d.className = 'dot';
        dotsHost.appendChild(d);
      }
    }
    Array.prototype.forEach.call(dotsHost.children, function (d, i) {
      d.className = 'dot' + (i < s.i ? ' done' : i === s.i ? ' on' : '');
    });
  }

  if (dotsHost && !dotCount) {
    // generic builder (one .bstep per field) — dots = number of steps
    var bsteps = document.querySelectorAll('.bstep').length;
    if (bsteps) {
      dotCount = bsteps;
      dotsHost.innerHTML = '';
      for (var i = 0; i < bsteps; i++) {
        var d = document.createElement('span');
        d.className = 'dot';
        dotsHost.appendChild(d);
      }
      var form = document.querySelector('#createForm');
      if (form) {
        var current = 0;
        var obs = new MutationObserver(renderDots);
        obs.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });
        form.addEventListener('click', function () { setTimeout(renderDots, 60); });
      }
    }
  }
  if (progressItems.length) {
    var mo = new MutationObserver(renderDots);
    mo.observe(document.getElementById('progress'), { subtree: true, attributes: true, attributeFilter: ['class'] });
  }
  setInterval(renderDots, 800); // cheap sync — the counter text is the truth
  renderDots();

  /* ---- final panel: celebratory class on the body when it shows ---- */
  var result = document.getElementById('publishedResult');
  if (result) {
    new MutationObserver(function () {
      document.body.classList.toggle('shell-done', !result.hidden);
      if (!result.hidden) renderDots();
    }).observe(result, { attributes: true, attributeFilter: ['hidden'] });
  }

  /* ---- auto-advance on pickers (data-autoadvance selects/radios) ---- */
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t && t.hasAttribute && t.hasAttribute('data-autoadvance')) {
      var next = document.getElementById('next');
      if (next && !next.hidden) next.click();
    }
  });

  /* ---- whole-paigaam preview: scale-to-fit the ENTIRE page in the frame ---- */
  var liveFrame = document.getElementById('liveFrame');
  var fitPending = false;

  function fitPreview() {
    if (fitPending || !liveFrame) return;
    fitPending = true;
    requestAnimationFrame(function () {
      fitPending = false;
      if (!liveFrame) return;
      var doc;
      try { doc = liveFrame.contentDocument; } catch (e) { return; }
      if (!doc || !doc.body) return;
      var naturalH = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight, 1);
      var naturalW = liveFrame.contentWindow ? liveFrame.contentWindow.innerWidth : 390;
      if (naturalW < 100) naturalW = 390;
      var box = liveFrame.parentElement; // .livepane__frame
      if (!box) return;
      var fitW = box.clientWidth || 300;
      if (!fitW || fitW > 340) fitW = Math.min(fitW, 320); // phone-width design
      var fitH = window.innerHeight * (window.innerWidth <= 720 ? 0.42 : 0.66);
      fitH = Math.min(fitH, window.innerWidth <= 720 ? 340 : 640);
      // width-first: fill the frame width; only shrink further if too tall
      var scale = fitW / naturalW;
      if (naturalH * scale > fitH) scale = fitH / naturalH;
      if (!isFinite(scale) || scale <= 0) scale = 1;
      liveFrame.style.width = naturalW + 'px';
      liveFrame.style.height = naturalH + 'px';
      liveFrame.style.transformOrigin = '0 0';
      liveFrame.style.transform = 'scale(' + scale + ')';
      // the box keeps the FIT size; the iframe's layout size is scaled away
      box.style.width = Math.round(naturalW * scale) + 'px';
      box.style.height = Math.round(naturalH * scale) + 'px';
      box.style.maxWidth = 'none';
      liveFrame.dataset.fitScale = String(scale);
    });
  }

  if (liveFrame) {
    liveFrame.addEventListener('load', function () { fitPreview(); setTimeout(fitPreview, 350); });
    window.addEventListener('resize', fitPreview);
    // wizard engines swap srcdoc/src asynchronously — watch for it
    new MutationObserver(fitPreview).observe(liveFrame, { attributes: true, attributeFilter: ['src', 'srcdoc'] });
    setTimeout(fitPreview, 800);
  }

  /* ---- highlight the section being edited inside the preview ---- */
  var highlightStyle = null;
  function highlightForStep() {
    if (!liveFrame) return;
    var doc;
    try { doc = liveFrame.contentDocument; } catch (e) { return; }
    if (!doc || !doc.body) return;
    if (!highlightStyle) {
      highlightStyle = doc.createElement('style');
      highlightStyle.textContent = '.pa-shell-hl{outline:3px solid rgba(201,162,94,.9);outline-offset:-3px;border-radius:6px;transition:outline-color .8s ease 1.2s}';
      doc.head.appendChild(highlightStyle);
    }
    // which field is the visible step editing?
    var step = document.querySelector('.step:not([hidden]), .bstep:not([hidden])');
    if (!step) return;
    var input = step.querySelector('[data-field]');
    var fid = input ? (input.getAttribute('data-field') || input.id || '').replace(/^f-/, '') : '';
    if (!fid) return;
    // find the anchor: renderer marks data-field-anchor, else probe for the current value text
    var target = doc.querySelector('[data-field-anchor="' + fid + '"]');
    if (!target) {
      var val = (input.value || '').trim();
      if (val.length > 1) {
        var all = doc.querySelectorAll('h1,h2,h3,p,span,div,td,li');
        for (var i = 0; i < all.length; i++) {
          if (all[i].children.length === 0 && all[i].textContent && all[i].textContent.indexOf(val) !== -1) { target = all[i]; break; }
        }
      }
    }
    if (!target) return;
    var prev = doc.querySelector('.pa-shell-hl');
    if (prev) prev.classList.remove('pa-shell-hl');
    target.classList.add('pa-shell-hl');
    setTimeout(function () { target.classList.remove('pa-shell-hl'); }, 2200);
  }

  // watch step changes: the wizards toggle hidden on .step sections
  var stepObserver = new MutationObserver(function () {
    fitPreview();
    setTimeout(highlightForStep, 250);
  });
  stepObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('click', function (e) {
    if (e.target && (e.target.id === 'next' || e.target.id === 'back' || (e.target.closest && e.target.closest('#next, #back, #progress')))) {
      setTimeout(function () { fitPreview(); highlightForStep(); }, 350);
    }
  });
})();
