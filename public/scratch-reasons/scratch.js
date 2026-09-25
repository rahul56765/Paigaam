(function () {
  'use strict';
  /**
   * Kashf — Reasons I Love You (Scratch Edition). The foil-scratch mechanic,
   * ported 1:1 from the original design (t3-scratch.html):
   *
   *   · Card text is server-rendered by render.js; this script adds a <canvas>
   *     overlay (the gold foil) to each .card, then attaches pointer events.
   *   · Drag / scratch to erase foil with destination-out compositing; at 55 %
   *     transparent pixels the canvas fades out with opacity + pointer-events:none.
   *   · Progress is sampled every 10th pointermove event and on every pointerup.
   *   · A "pop" animation and sparkle particles burst on each reveal.
   *   · The counter in the header ticks up with each reveal (bounce animation).
   *   · "Reveal all" fades in after the 2nd reveal; it sequentially clears
   *     remaining cards at 300 ms stagger.
   *   · All cards cleared → the finale section scrolls into view.
   *   · "Scratch them again" repaints foil in-place (no page reload).
   *   · Reduced motion: animations collapse to instant cuts; sparkles hidden.
   *   · Missing markup: if any required element is absent the script returns
   *     silently — the server-rendered text remains accessible.
   *
   * No globals. No dependencies. No build step. Sender text is never written
   * via innerHTML — it is server-rendered. The SVG spark particle is
   * template-authored (not sender data) and may use innerHTML.
   */

  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var CLEAR_THRESHOLD = 0.55; // fraction of transparent pixels to auto-clear
  var SAMPLE_EVERY    = 10;   // check pixel % every Nth pointermove
  var BRUSH_RADIUS    = 14;   // half the scratch brush width in CSS px
  var SEQ_DELAY       = 300;  // reveal-all sequence stagger in ms

  var revealedCount = 0;
  var revealedAll   = false;
  var cards         = [];

  var counterEl    = document.getElementById('counter');
  var cardsEl      = document.getElementById('cards');
  var revealAllBtn = document.getElementById('revealAllBtn');
  var finaleEl     = document.getElementById('finale');
  var replayBtn    = document.getElementById('replayBtn');

  if (!counterEl || !cardsEl || !revealAllBtn || !finaleEl || !replayBtn) return;

  /* ---------- tiny SVG helpers (template-authored, static — not sender data) */

  function sparkSVG() {
    return '<svg width="10" height="10" viewBox="0 0 22 22" fill="none" aria-hidden="true">' +
      '<path d="M11 1 L12.8 8.2 L20 10 L12.8 11.8 L11 19 L9.2 11.8 L2 10 L9.2 8.2 Z" fill="#C9A86A"/>' +
      '</svg>';
  }

  /* ---------- initialise: query server-rendered cards and add canvas overlays */

  function initCards() {
    var cardEls = cardsEl.querySelectorAll('.card');
    cards = [];
    for (var i = 0; i < cardEls.length; i++) {
      var card   = cardEls[i];
      var canvas = document.createElement('canvas');
      canvas.className = 'foil';
      canvas.setAttribute('aria-label', 'Scratch to reveal reason ' + (i + 1));
      card.appendChild(canvas);
      cards.push({
        index:   i,
        card:    card,
        canvas:  canvas,
        ctx:     canvas.getContext('2d', { willReadFrequently: true }),
        drawing: false,
        moved:   0,
        cleared: false,
        last:    null,
      });
    }
  }

  /* ---------- gold foil painting (drawn once per init or replay) */

  function paintFoil(state) {
    var canvas = state.canvas;
    var card   = state.card;
    var dpr    = Math.min(window.devicePixelRatio || 1, 2);

    var rect = card.getBoundingClientRect();
    var w    = Math.max(1, Math.round(rect.width));
    var h    = Math.max(1, Math.round(rect.height));

    canvas.width  = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    var ctx = state.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);

    /* base: diagonal metallic gradient */
    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0.00, '#B8955A');
    grad.addColorStop(0.14, '#E7CE9A');
    grad.addColorStop(0.28, '#C9A86A');
    grad.addColorStop(0.42, '#F2E3BE');
    grad.addColorStop(0.55, '#B8955A');
    grad.addColorStop(0.70, '#DDC08A');
    grad.addColorStop(0.84, '#C9A86A');
    grad.addColorStop(1.00, '#A8854E');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    /* diagonal streak highlights for a brushed-metal feel */
    ctx.save();
    ctx.globalAlpha  = 0.18;
    ctx.strokeStyle  = '#FFF6DC';
    ctx.lineWidth    = 1.5;
    for (var x = -h; x < w + h; x += 11) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h * 0.55, h);
      ctx.stroke();
    }
    ctx.restore();

    /* subtle wide sheen band */
    ctx.save();
    ctx.globalAlpha = 0.14;
    var sheen = ctx.createLinearGradient(0, h * 0.25, w, h * 0.6);
    sheen.addColorStop(0,   'rgba(255,250,230,0)');
    sheen.addColorStop(0.5, 'rgba(255,250,230,1)');
    sheen.addColorStop(1,   'rgba(255,250,230,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    /* noise: random darker / lighter dots, drawn once */
    var dots = Math.round((w * h) / 90);
    for (var j = 0; j < dots; j++) {
      var nx   = Math.random() * w;
      var ny   = Math.random() * h;
      var dark = Math.random() < 0.5;
      ctx.fillStyle = dark
        ? 'rgba(90, 62, 24, '  + (0.05 + Math.random() * 0.16).toFixed(3) + ')'
        : 'rgba(255, 248, 224,' + (0.05 + Math.random() * 0.18).toFixed(3) + ')';
      var r = Math.random() < 0.85 ? 0.7 : 1.4;
      ctx.beginPath();
      ctx.arc(nx, ny, r, 0, Math.PI * 2);
      ctx.fill();
    }

    /* faint border sheen */
    ctx.strokeStyle = 'rgba(255, 246, 220, 0.35)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    state.moved = 0;
  }

  /* ---------- scratch mechanics */

  function getPos(e, card) {
    var rect = card.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function scratchLine(state, from, to) {
    var ctx                      = state.ctx;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth                = BRUSH_RADIUS * 2;
    ctx.lineCap                  = 'round';
    ctx.lineJoin                 = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  function checkProgress(state) {
    if (state.cleared) return;
    var ctx = state.ctx;
    var w   = state.canvas.width;
    var h   = state.canvas.height;
    var data;
    try {
      data = ctx.getImageData(0, 0, w, h).data;
    } catch (err) {
      return;
    }
    var total       = w * h;
    var transparent = 0;
    /* sample the alpha channel only (every 4th byte) for speed */
    for (var i = 3; i < data.length; i += 4) {
      if (data[i] === 0) transparent++;
    }
    if (transparent / total >= CLEAR_THRESHOLD) {
      revealCard(state, true);
    }
  }

  function attachPointer(state) {
    var canvas = state.canvas;
    var card   = state.card;

    canvas.addEventListener('pointerdown', function (e) {
      if (state.cleared) return;
      state.drawing = true;
      state.last    = getPos(e, card);
      scratchLine(state, state.last, { x: state.last.x + 0.01, y: state.last.y + 0.01 });
      state.moved = 0;
      if (e.pointerId !== undefined && canvas.setPointerCapture) {
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      }
      e.preventDefault();
    });

    canvas.addEventListener('pointermove', function (e) {
      if (!state.drawing || state.cleared) return;
      var p = getPos(e, card);
      scratchLine(state, state.last, p);
      state.last = p;
      state.moved++;
      e.preventDefault();
      if (state.moved % SAMPLE_EVERY === 0) checkProgress(state);
    });

    function end(e) {
      if (!state.drawing) return;
      state.drawing = false;
      if (!state.cleared) checkProgress(state); /* final check on pointer lift */
      if (e && e.pointerId !== undefined && canvas.releasePointerCapture) {
        try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
      }
    }

    canvas.addEventListener('pointerup',     end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave',  function (e) {
      /* with pointer capture, leaving is rare — still close the stroke */
      if (state.drawing && e.buttons === 0) end(e);
    });
  }

  /* ---------- reveal a single card */

  function revealCard(state, fromUser) {
    if (state.cleared) return;
    state.cleared = true;
    state.drawing = false;

    state.canvas.classList.add('cleared');
    var ghost = state.card.querySelector('.ghost');
    if (ghost) ghost.style.display = 'none';

    if (!REDUCED && fromUser !== false) {
      state.card.classList.add('pop');
      sparkAt(state.card);
      /* remove pop so re-pop works on replay */
      setTimeout(function () { state.card.classList.remove('pop'); }, 700);
    }

    revealedCount++;
    updateCounter(true);

    if (revealedCount >= 2 && revealedCount < cards.length && !revealedAll) {
      revealAllBtn.classList.add('visible');
    }
    if (revealedCount >= cards.length) showFinale();
  }

  /* ---------- counter (DOM-safe — no innerHTML for sender text) */

  function updateCounter(bounce) {
    while (counterEl.firstChild) counterEl.removeChild(counterEl.firstChild);
    var b = document.createElement('b');
    b.textContent = String(revealedCount);
    counterEl.appendChild(b);
    counterEl.appendChild(document.createTextNode('/' + cards.length));
    if (bounce && !REDUCED) {
      counterEl.classList.remove('bounce');
      void counterEl.offsetWidth; /* restart animation */
      counterEl.classList.add('bounce');
    }
  }

  /* ---------- sparkle particle pop (6–8 DOM sparkles) */

  function sparkAt(card) {
    var rect = card.getBoundingClientRect();
    var n    = 6 + Math.floor(Math.random() * 3); /* 6–8 */
    for (var i = 0; i < n; i++) {
      var el    = document.createElement('div');
      el.className = 'spark';
      el.innerHTML = sparkSVG(); /* static SVG — template markup, not sender data */
      var angle = (Math.PI * 2 * i) / n + Math.random() * 0.8;
      var dist  = 34 + Math.random() * 46;
      el.style.setProperty('--dx', (Math.cos(angle) * dist).toFixed(1) + 'px');
      el.style.setProperty('--dy', (Math.sin(angle) * dist - 14).toFixed(1) + 'px');
      el.style.left = (rect.left + rect.width  / 2 - 5 + (Math.random() * 30 - 15)) + 'px';
      el.style.top  = (rect.top  + rect.height / 2 - 5 + (Math.random() * 30 - 15)) + 'px';
      document.body.appendChild(el);
      requestAnimationFrame((function (node) {
        return function () { node.classList.add('animate'); };
      }(el)));
      setTimeout((function (node) {
        return function () { node.remove(); };
      }(el)), 800);
    }
  }

  /* ---------- reveal all */

  revealAllBtn.addEventListener('click', function () {
    if (revealedAll) return;
    revealedAll = true;
    revealAllBtn.classList.add('hidden');
    revealRemaining(0);
  });

  function revealRemaining(i) {
    if (i >= cards.length) return;
    if (!cards[i].cleared) {
      revealCard(cards[i], false);
      setTimeout(function () { revealRemaining(i + 1); }, SEQ_DELAY);
    } else {
      revealRemaining(i + 1);
    }
  }

  /* ---------- finale + replay */

  function showFinale() {
    revealAllBtn.classList.add('hidden');
    finaleEl.classList.add('show');
    if (!REDUCED) {
      finaleEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      finaleEl.scrollIntoView({ block: 'center' });
    }
  }

  replayBtn.addEventListener('click', function () {
    revealedCount = 0;
    revealedAll   = false;
    updateCounter(false);
    finaleEl.classList.remove('show');
    revealAllBtn.classList.remove('visible');
    revealAllBtn.classList.remove('hidden');
    cards.forEach(function (state) {
      state.cleared = false;
      state.drawing = false;
      state.moved   = 0;
      state.last    = null;
      state.canvas.classList.remove('cleared');
      paintFoil(state);
      var ghost = state.card.querySelector('.ghost');
      if (ghost) ghost.style.display = 'flex';
    });
    window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
  });

  /* ---------- init */

  function init() {
    initCards();
    /* wait one frame so layout gives real card dimensions */
    requestAnimationFrame(function () {
      cards.forEach(function (state) {
        paintFoil(state);
        attachPointer(state);
      });
    });
    updateCounter(false);
  }

  /* if fonts load late and resize shifts cards, repaint uncleared foils */
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      cards.forEach(function (state) {
        if (!state.cleared) paintFoil(state);
      });
    }, 180);
  });

  init();
}());
