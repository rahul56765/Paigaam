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
})();
