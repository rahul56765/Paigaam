/*
 * Birthday Paigaam — the experience.
 *
 * Server-rendered screens; this script only adds behaviour:
 *   · wavy card edges (measured SVG)          · the four background layers
 *   · the screen machine + progress           · unlock keypad (hashed code)
 *   · "wanna see it?" YES/NO ladder           · envelope → letter → typewriter
 *   · voice note + our song (ducking)         · scrapbook flip/drag/zoom/swipe
 *   · finale: balloons, confetti, cake, fireworks, countdown, replay
 * Modes (from #bpData): published · preview · demo · live (wizard pane) · thumb (gallery card).
 */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement, body = doc.body;
  root.classList.add('js');

  var DATA = {};
  try { DATA = JSON.parse(doc.getElementById('bpData').textContent); } catch (e) {}
  var MODE = DATA.mode || 'published';
  var ORDER = DATA.order || ['unlock', 'finale'];
  var THUMB = MODE === 'thumb', LIVE = MODE === 'live';
  var SND = window.BPSound || null;
  var sfx = function (name, arg) { if (SND && !THUMB && !LIVE) try { SND.sfx[name](arg); } catch (e) {} };

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function on(el, ev, fn, opt) { if (el) el.addEventListener(ev, fn, opt || false); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function later(fn, ms) { return setTimeout(fn, ms); }
  var small = Math.min(window.innerWidth, window.innerHeight) < 600;

  /* ------------------------------------------------------- motion state */
  var osReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var still = osReduce;
  try { var pref = localStorage.getItem('bp-motion'); if (pref === 'on') still = false; if (pref === 'off') still = true; } catch (e) {}
  function applyMotion() {
    body.classList.toggle('bp--still', still);
    body.classList.toggle('bp--motion', !still);
    var b = $('.bp-motion');
    if (b) { b.setAttribute('aria-pressed', String(!still)); b.setAttribute('aria-label', still ? 'Animations off' : 'Animations on'); }
  }
  applyMotion();

  /* ---------------------------------------------- colours from the palette */
  var probe = doc.createElement('span');
  probe.style.display = 'none'; body.appendChild(probe);
  function color(v) { probe.style.color = 'var(' + v + ')'; return getComputedStyle(probe).color || '#C2185B'; }
  var C = {
    accent: color('--accent'), blush: color('--blush'), blushDeep: color('--blush-deep'), lav: color('--lavender'),
    lavDeep: color('--lav-deep'), peach: color('--peach'), peachDeep: color('--peach-deep'), cream: color('--cream'), gold: '#F2C14E', white: '#ffffff',
  };
  var HEART_COLORS = [C.accent, C.blushDeep, C.lavDeep, C.peachDeep, C.blushDeep];
  var CONFETTI = [C.accent, C.blushDeep, C.lav, C.lavDeep, C.peach, C.gold, '#ffffff'];

  /* ------------------------------------------------------- wavy borders */
  function wavePath(w, h, r) {
    var s = r * 2, d = '';
    function edge(len, dx, dy) {
      var n = Math.max(2, Math.round(len / s)), step = len / n, seg = '';
      for (var i = 0; i < n; i++) seg += ' a' + (step / 2).toFixed(2) + ' ' + (step / 2).toFixed(2) + ' 0 0 1 ' + (dx * step).toFixed(2) + ' ' + (dy * step).toFixed(2);
      return seg;
    }
    d = 'M' + r + ' ' + r + edge(w - 2 * r, 1, 0) + edge(h - 2 * r, 0, 1) + edge(w - 2 * r, -1, 0) + edge(h - 2 * r, 0, -1) + 'Z';
    return d;
  }
  function wave(card) {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = doc.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'bp-wave-edge'); svg.setAttribute('aria-hidden', 'true');
    var fill = doc.createElementNS(NS, 'path'); fill.setAttribute('class', 'fill');
    var dash = doc.createElementNS(NS, 'rect'); dash.setAttribute('class', 'dash'); dash.setAttribute('rx', '16');
    svg.appendChild(fill); svg.appendChild(dash);
    card.insertBefore(svg, card.firstChild);
    card.classList.add('has-wave');
    function draw() {
      var w = card.offsetWidth, h = card.offsetHeight;
      if (!w || !h) return;
      var r = w < 340 ? 8 : 10;
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      fill.setAttribute('d', wavePath(w, h, r));
      var inset = r * 2 + 6;
      dash.setAttribute('x', inset); dash.setAttribute('y', inset);
      dash.setAttribute('width', Math.max(0, w - inset * 2)); dash.setAttribute('height', Math.max(0, h - inset * 2));
    }
    draw();
    if (window.ResizeObserver) new ResizeObserver(draw).observe(card);
    else on(window, 'resize', draw);
  }
  $$('.bp-wavy').forEach(wave);

  /* ===================================================== background layers */
  var amb = $('.bp-ambient'), fxc = $('.bp-fx');
  var actx = amb && amb.getContext ? amb.getContext('2d') : null;
  var fctx = fxc && fxc.getContext ? fxc.getContext('2d') : null;
  var W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
  var HEART_PATH = typeof Path2D === 'function' ? new Path2D('M12 21.2s-7.6-4.6-10-9.4C0.3 8.2 2.2 3.8 6.4 3.8c2.5 0 4.1 1.4 5.6 3.4 1.5-2 3.1-3.4 5.6-3.4 4.2 0 6.1 4.4 4.4 8-2.4 4.8-10 9.4-10 9.4z') : null;

  function sprite(draw, size) {
    var c = doc.createElement('canvas'); c.width = c.height = size;
    var x = c.getContext('2d'); draw(x, size); return c;
  }
  var heartSprites = {}, starSprites = {};
  function heartSprite(col) {
    if (heartSprites[col]) return heartSprites[col];
    heartSprites[col] = sprite(function (x, s) {
      if (!HEART_PATH) { x.fillStyle = col; x.beginPath(); x.arc(s / 2, s / 2, s / 3, 0, 7); x.fill(); return; }
      x.scale(s / 24, s / 24); x.fillStyle = col; x.fill(HEART_PATH);
      x.fillStyle = 'rgba(255,255,255,.45)'; x.beginPath(); x.ellipse(7.4, 8.6, 2.1, 1.3, -0.6, 0, 7); x.fill();
    }, 64);
    return heartSprites[col];
  }
  function starSprite(col) {
    if (starSprites[col]) return starSprites[col];
    starSprites[col] = sprite(function (x, s) {
      var c = s / 2; x.fillStyle = col; x.beginPath(); x.moveTo(c, 0);
      x.quadraticCurveTo(c * 1.08, c * 0.92, s, c); x.quadraticCurveTo(c * 1.08, c * 1.08, c, s);
      x.quadraticCurveTo(c * 0.92, c * 1.08, 0, c); x.quadraticCurveTo(c * 0.92, c * 0.92, c, 0); x.fill();
      var g = x.createRadialGradient(c, c, 0, c, c, c * 0.6); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(c, c, c * 0.6, 0, 7); x.fill();
    }, 48);
    return starSprites[col];
  }

  var hearts = [], stars = [], dust = [], fx = [];
  var par = { x: 0, y: 0, tx: 0, ty: 0 };
  var bgEl = $('.bp-bg');

  function counts() {
    var area = W * H, k = small ? 0.6 : 1;
    return {
      hearts: Math.round(Math.max(5, Math.min(20, area / 70000)) * k),
      stars: Math.round(Math.max(10, Math.min(44, area / 26000)) * k),
      dust: Math.round(Math.max(14, Math.min(80, area / 16000)) * k),
    };
  }
  function newHeart(initial) {
    var size = rand(10, small ? 20 : 26);
    return { x: rand(0, W), y: initial ? rand(H * 0.2, H + 40) : H + rand(20, 80), vy: rand(16, 38), amp: rand(8, 22), ph: rand(0, 6.3), size: size, col: pick(HEART_COLORS), popAt: rand(H * 0.08, H * 0.6), a: rand(0.55, 0.9), depth: rand(0.6, 1.2) };
  }
  function seed() {
    var n = counts();
    hearts = []; stars = []; dust = [];
    for (var i = 0; i < n.hearts; i++) hearts.push(newHeart(true));
    for (i = 0; i < n.stars; i++) stars.push({ x: rand(0, W), y: rand(0, H), size: rand(5, small ? 10 : 13), ph: rand(0, 6.3), sp: rand(0.8, 2.2), col: Math.random() < 0.6 ? C.gold : C.white });
    for (i = 0; i < n.dust; i++) dust.push({ x: rand(0, W), y: rand(0, H), r: rand(0.6, 1.8), vx: rand(-6, 6), vy: rand(4, 14), ph: rand(0, 6.3), col: Math.random() < 0.5 ? C.gold : C.white });
  }
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    [amb, fxc].forEach(function (c) { if (!c) return; c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); });
    if (actx) actx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (fctx) fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    seed();
    if (still) drawStill();
  }

  function pop(h) {
    for (var i = 0; i < 7; i++) {
      var a = (i / 7) * Math.PI * 2;
      fx.push({ t: 'spark', x: h.x, y: h.y, vx: Math.cos(a) * rand(30, 70), vy: Math.sin(a) * rand(30, 70), life: 0, max: rand(0.5, 0.8), size: rand(5, 9), col: Math.random() < 0.5 ? C.gold : h.col, g: 20, amb: true });
    }
    fx.push({ t: 'ring', x: h.x, y: h.y, life: 0, max: 0.45, size: h.size * 0.4, col: h.col, amb: true });
  }

  function drawAmbient(dt, t) {
    if (!actx) return;
    actx.clearRect(0, 0, W, H);
    var px = par.x, py = par.y;
    for (var i = 0; i < dust.length; i++) {
      var d = dust[i];
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.y > H + 4) { d.y = -4; d.x = rand(0, W); }
      if (d.x < -4) d.x = W + 4; if (d.x > W + 4) d.x = -4;
      actx.globalAlpha = 0.35 + 0.45 * Math.abs(Math.sin(t * 1.4 + d.ph));
      actx.fillStyle = d.col;
      actx.beginPath(); actx.arc(d.x + px * 0.3, d.y + py * 0.3, d.r, 0, 6.29); actx.fill();
    }
    for (i = 0; i < stars.length; i++) {
      var s = stars[i], tw = Math.abs(Math.sin(t * s.sp + s.ph)), sz = s.size * (0.55 + tw * 0.6);
      actx.globalAlpha = 0.25 + tw * 0.75;
      actx.drawImage(starSprite(s.col), s.x + px * 0.5 - sz / 2, s.y + py * 0.5 - sz / 2, sz, sz);
    }
    for (i = 0; i < hearts.length; i++) {
      var h = hearts[i];
      h.y -= h.vy * dt * h.depth;
      var x = h.x + Math.sin(t * 0.9 + h.ph) * h.amp + px * h.depth, y = h.y + py * h.depth;
      if (h.y < h.popAt) { pop({ x: x, y: y, col: h.col, size: h.size }); hearts[i] = newHeart(false); continue; }
      actx.globalAlpha = h.a;
      actx.drawImage(heartSprite(h.col), x - h.size / 2, y - h.size / 2, h.size, h.size);
    }
    actx.globalAlpha = 1;
  }

  function drawStill() {
    if (!actx) return;
    actx.clearRect(0, 0, W, H);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i]; actx.globalAlpha = 0.55;
      actx.drawImage(starSprite(s.col), s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
    }
    actx.globalAlpha = 1;
  }

  var rain = 0, rainAcc = 0;
  function drawFx(dt) {
    if (!fctx) return;
    if (rain > 0) {
      rainAcc += rain * dt;
      while (rainAcc > 1) { rainAcc -= 1; fx.push(confettiPiece(rand(0, W), -20, rand(-20, 20), rand(40, 110))); }
    }
    fctx.clearRect(0, 0, W, H);
    if (!fx.length) return;
    var keep = [];
    for (var i = 0; i < fx.length; i++) {
      var p = fx[i];
      p.life += dt;
      if (p.life >= p.max) continue;
      var k = p.life / p.max, ctx = p.amb ? actx : fctx;
      if (!ctx) continue;
      if (p.t === 'ring') {
        ctx.globalAlpha = (1 - k) * 0.7; ctx.strokeStyle = p.col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size + k * 16, 0, 6.29); ctx.stroke();
      } else {
        p.vy += (p.g || 0) * dt; p.vx *= (p.drag || 1); p.vy *= (p.drag || 1);
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.t === 'heart') {
          var sz = p.size * (k < 0.2 ? k / 0.2 : 1);
          ctx.globalAlpha = 1 - k * k;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0); ctx.drawImage(heartSprite(p.col), -sz / 2, -sz / 2, sz, sz); ctx.restore();
        } else if (p.t === 'spark') {
          ctx.globalAlpha = 1 - k; var s2 = p.size * (1 - k * 0.5);
          ctx.drawImage(starSprite(p.col), p.x - s2 / 2, p.y - s2 / 2, s2, s2);
        } else if (p.t === 'conf') {
          p.rot += p.vr * dt; p.flip += dt * p.fs;
          ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1;
          ctx.save(); ctx.translate(p.x + Math.sin(p.flip) * 6, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.flip));
          ctx.fillStyle = p.col;
          if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, 6.29); ctx.fill(); } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        } else if (p.t === 'fw') {
          ctx.globalAlpha = (1 - k) * (0.6 + Math.random() * 0.4); ctx.fillStyle = p.col;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - k * 0.6), 0, 6.29); ctx.fill();
        } else if (p.t === 'rocket') {
          ctx.globalAlpha = 1; ctx.fillStyle = C.gold;
          ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, 6.29); ctx.fill();
          if (p.life + dt >= p.max) explode(p.x, p.y);
        }
      }
      keep.push(p);
    }
    fx = keep;
    fctx.globalAlpha = 1; if (actx) actx.globalAlpha = 1;
  }

  function confettiPiece(x, y, vx, vy) {
    return { t: 'conf', x: x, y: y, vx: vx, vy: vy, g: 220, drag: 0.985, life: 0, max: rand(2.6, 4.2), w: rand(6, 11), h: rand(9, 15), rot: rand(0, 6.3), vr: rand(-6, 6), flip: rand(0, 6.3), fs: rand(4, 9), col: pick(CONFETTI), round: Math.random() < 0.25 };
  }
  function burstHearts(x, y, n, power) {
    n = n || 10; power = power || 1;
    if (still) { fx.push({ t: 'heart', x: x, y: y, vx: 0, vy: -10, life: 0, max: 0.8, size: 26, col: C.accent, rot: 0 }); return; }
    for (var i = 0; i < n; i++) {
      var a = rand(0, Math.PI * 2), sp = rand(60, 190) * power;
      fx.push({ t: 'heart', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40 * power, g: 120, drag: 0.97, life: 0, max: rand(0.7, 1.2), size: rand(12, 24) * (power > 1 ? 1.25 : 1), col: pick(HEART_COLORS), rot: rand(-0.5, 0.5) });
    }
    for (i = 0; i < Math.round(n * 0.6); i++) {
      var b = rand(0, Math.PI * 2), sp2 = rand(40, 150) * power;
      fx.push({ t: 'spark', x: x, y: y, vx: Math.cos(b) * sp2, vy: Math.sin(b) * sp2, g: 40, life: 0, max: rand(0.5, 0.9), size: rand(7, 13), col: Math.random() < 0.6 ? C.gold : C.white });
    }
  }
  function confetti(x, y, n) {
    if (still) return;
    for (var i = 0; i < n; i++) {
      var a = rand(-Math.PI * 0.95, -Math.PI * 0.05), sp = rand(240, 620);
      fx.push(confettiPiece(x, y, Math.cos(a) * sp, Math.sin(a) * sp));
    }
  }
  function explode(x, y) {
    var col = pick(CONFETTI.slice(0, 6)), col2 = pick(CONFETTI);
    for (var i = 0; i < 46; i++) {
      var a = (i / 46) * Math.PI * 2, sp = rand(90, 230);
      fx.push({ t: 'fw', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 70, drag: 0.975, life: 0, max: rand(1, 1.6), size: rand(2, 3.6), col: i % 3 ? col : col2 });
    }
    sfx('firework');
  }
  function firework(x, y) {
    if (still) return;
    fx.push({ t: 'rocket', x: x, y: H + 10, vx: (x - W / 2) * 0.05, vy: -(H + 10 - y) / 0.9, life: 0, max: 0.9 });
  }

  /* balloons & ribbons drifting past */
  var floaters = $('.bp-floaters'), floatTimer = 0, floatCount = 0;
  var BALLOON_TPL = '<svg class="bp-balloon" viewBox="0 0 60 132" aria-hidden="true"><path class="s-ink" fill="none" stroke-width="1.4" opacity=".55" d="M30 80 q-9 12 0 24 q9 12 0 26"/><path class="FILL s-ink" stroke-width="2.2" d="M30 4C48 4 58 20 58 37C58 57 44 73 30 77C16 73 2 57 2 37C2 20 12 4 30 4Z"/><path class="FILL s-ink" stroke-width="2" stroke-linejoin="round" d="M25 82 L30 75 L35 82Z"/><ellipse cx="19" cy="25" rx="6" ry="10" fill="#fff" opacity=".45" transform="rotate(20 19 25)"/></svg>';
  var RIBBON_TPL = '<svg class="bp-ribbon" viewBox="0 0 60 160" aria-hidden="true"><path class="STROKE" fill="none" stroke-width="5" stroke-linecap="round" d="M30 4 C6 24 54 40 30 60 S6 96 30 116 S54 140 32 156"/></svg>';
  var PEARL_TPL = '<svg class="bp-balloon bp-balloon--pearl" viewBox="0 0 60 150" aria-hidden="true"><path fill="none" stroke="#C9A24A" stroke-opacity=".7" stroke-width=".9" d="M30 82 q-6 16 0 32 q6 16 -1 34"/><path fill="url(#bpPearl)" stroke="#fff" stroke-opacity=".7" stroke-width=".8" d="M30 3C46 3 56 18 56 36C56 56 43 75 30 79C17 75 4 56 4 36C4 18 14 3 30 3Z"/><path fill="#E9D08C" d="M26.5 84 L30 78 L33.5 84Z"/><ellipse cx="20" cy="24" rx="5" ry="10" fill="#fff" opacity=".55" transform="rotate(18 20 24)"/></svg>';
  var BALLOON_FILLS = ['f-blush', 'f-lav', 'f-peach', 'f-acc', 'f-blushdeep', 'f-lavdeep'];
  function balloonSvg(cls) { return BALLOON_TPL.replace(/FILL/g, cls || pick(BALLOON_FILLS)); }
  function spawnFloater() {
    if (!floaters || still || doc.hidden || floatCount >= 3) return;
    var ribbonOne = Math.random() < 0.35;
    var el = doc.createElement('div');
    el.className = 'bp-floater' + (ribbonOne ? ' bp-floater--down' : '');
    var w = ribbonOne ? rand(26, 40) : rand(small ? 34 : 44, small ? 54 : 74);
    el.style.setProperty('--x', rand(2, 92) + '%');
    el.style.setProperty('--w', w + 'px');
    el.style.setProperty('--dur', rand(14, 22) + 's');
    el.style.setProperty('--dx', rand(-80, 80) + 'px');
    el.innerHTML = '<div>' + (ribbonOne ? RIBBON_TPL.replace('STROKE', pick(['s-acc', 's-lavdeep', 's-peachdeep'])) : balloonSvg()) + '</div>';
    floatCount++;
    on(el, 'animationend', function (e) { if (e.target === el) { el.remove(); floatCount--; } });
    floaters.appendChild(el);
  }
  function floatLoop() { spawnFloater(); floatTimer = later(floatLoop, rand(small ? 9000 : 6000, small ? 15000 : 11000)); }

  /* the render loop */
  var last = 0, raf = 0;
  function frame(ts) {
    var t = ts / 1000, dt = Math.min(0.05, last ? t - last : 0.016); last = t;
    par.x += (par.tx - par.x) * 0.06; par.y += (par.ty - par.y) * 0.06;
    if (bgEl && !small) bgEl.style.transform = 'translate3d(' + (par.x * 0.6).toFixed(1) + 'px,' + (par.y * 0.6).toFixed(1) + 'px,0)';
    if (!still) drawAmbient(dt, t);
    drawFx(dt);
    tickHooks.forEach(function (fn) { fn(dt, t); });
    raf = requestAnimationFrame(frame);
  }
  var tickHooks = [];
  function startLoop() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  on(doc, 'visibilitychange', function () { if (doc.hidden) stopLoop(); else startLoop(); });
  on(window, 'resize', function () { small = Math.min(window.innerWidth, window.innerHeight) < 600; resize(); });
  on(window, 'pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    par.tx = (e.clientX / W - 0.5) * -22; par.ty = (e.clientY / H - 0.5) * -16;
  });
  // A heart burst wherever you tap.
  on(doc, 'pointerdown', function (e) {
    if (THUMB) return;
    if (e.target.closest && e.target.closest('.bp-lightbox, .bp-previewbar')) return;
    burstHearts(e.clientX, e.clientY, small ? 7 : 9, 0.8);
    if (!(e.target.closest && e.target.closest('button, a, [role=button], input'))) sfx('pop');
  }, { passive: true });

  resize();
  startLoop();
  // Round 2: no balloons or ribbons drifting past — the hearts, stars and glitter carry the background.

  /* ========================================================= screen machine */
  var screens = {};
  $$('.bp-screen').forEach(function (s) { screens[s.getAttribute('data-screen')] = s; });
  var hooks = {};
  var current = null;
  var progress = $$('.bp-progress i');

  function setProgress(name) {
    var idx = ORDER.indexOf(name);
    progress.forEach(function (dot) {
      var i = ORDER.indexOf(dot.getAttribute('data-p'));
      dot.classList.toggle('is-done', i < idx);
      dot.classList.toggle('is-on', i === idx);
    });
    $$('.bp-previewbar [data-jump]').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-jump') === name); });
  }

  function go(name, opts) {
    opts = opts || {};
    if (!screens[name] || name === current) return;
    var prev = current ? screens[current] : null, next = screens[name];
    if (current && hooks[current] && hooks[current].leave) hooks[current].leave();
    if (prev) {
      prev.classList.remove('is-active');
      if (!opts.instant && !still) { prev.classList.add('is-leaving'); later(function () { prev.classList.remove('is-leaving'); }, 520); }
    }
    next.classList.add('is-active');
    current = name;
    body.setAttribute('data-screen', name);
    setProgress(name);
    if (!opts.keepScroll) window.scrollTo(0, 0);
    if (hooks[name] && hooks[name].enter) hooks[name].enter(opts);
    if (THUMB) thumbStep(name);
    var heading = next.querySelector('h1, h2');
    if (heading && !opts.instant && !LIVE && !THUMB) { heading.setAttribute('tabindex', '-1'); try { heading.focus({ preventScroll: true }); } catch (e) {} }
  }
  function nextScreen() { var i = ORDER.indexOf(current); if (i >= 0 && i < ORDER.length - 1) go(ORDER[i + 1]); }

  /* gallery thumbnail: the surprise plays itself, silently, on a loop.
     Unlock and question advance themselves once their auto() runs. */
  var thumbTimer = 0;
  var THUMB_HOLD = { letter: 9800, voice: 2800, song: 2800, scrapbook: 4200, finale: 7800 };
  function thumbStep(name) {
    clearTimeout(thumbTimer);
    later(function () { if (current === name && hooks[name] && hooks[name].auto) hooks[name].auto(); }, 60);
    if (THUMB_HOLD[name]) thumbTimer = later(function () {
      if (current !== name) return;
      if (name === 'finale') go('unlock'); else nextScreen();
    }, THUMB_HOLD[name]);
  }
  $$('[data-next]').forEach(function (b) { on(b, 'click', nextScreen); });
  $$('.bp-previewbar [data-jump]').forEach(function (b) { on(b, 'click', function () { go(b.getAttribute('data-jump')); }); });

  /* =============================================================== typewriter */
  function decode(html) { var t = doc.createElement('textarea'); t.innerHTML = html; return t.value; }
  function Typer(els, opts) {
    opts = opts || {};
    var items = els.map(function (el) { return { el: el, html: el.getAttribute('data-orig') || el.innerHTML }; });
    items.forEach(function (it) { it.el.setAttribute('data-orig', it.html); it.parts = it.html.split(/<br\s*\/?>/i).map(decode); });
    var total = items.reduce(function (s, it) { return s + it.parts.join('').length; }, 0) || 1;
    var cps = Math.max(opts.min || 26, Math.min(opts.max || 70, total / (opts.seconds || 9)));
    var caret = doc.createElement('span'); caret.className = 'bp-caret'; caret.setAttribute('aria-hidden', 'true');
    var timer = 0, done = false, typed = 0;
    function finish() {
      if (done) return; done = true; cancelAnimationFrame(timer);
      items.forEach(function (it) { it.el.innerHTML = it.html; it.el.style.visibility = ''; });
      caret.remove();
      if (opts.onDone) opts.onDone();
    }
    function render(n) {
      var left = n;
      items.forEach(function (it) {
        var len = it.parts.join('').length;
        if (left <= 0) { it.el.style.visibility = 'hidden'; it.el.textContent = ' '; return; }
        it.el.style.visibility = '';
        var take = Math.min(left, len); left -= len;
        it.el.textContent = '';
        var remaining = take;
        it.parts.forEach(function (part, pi) {
          if (remaining <= 0) return;
          var chunk = part.slice(0, remaining); remaining -= part.length;
          it.el.appendChild(doc.createTextNode(chunk));
          if (pi < it.parts.length - 1 && remaining > 0) it.el.appendChild(doc.createElement('br'));
        });
        if (take < len) it.el.appendChild(caret);
      });
    }
    function start() {
      if (still || opts.instant) { finish(); return; }
      var t0 = 0;
      render(0);
      var step = function (ts) {
        if (done) return;
        if (!t0) t0 = ts;
        typed = Math.floor(((ts - t0) / 1000) * cps);
        if (typed >= total) { finish(); return; }
        render(typed);
        timer = requestAnimationFrame(step);
      };
      timer = requestAnimationFrame(step);
    }
    function reset() { done = false; cancelAnimationFrame(timer); caret.remove(); items.forEach(function (it) { it.el.innerHTML = it.html; it.el.style.visibility = ''; }); }
    return { start: start, finish: finish, reset: reset, get done() { return done; } };
  }

  /* ================================================================= unlock */
  (function () {
    var s = screens.unlock; if (!s) return;
    var boxes = $$('.bp-box', s), boxesWrap = $('.bp-boxes', s), msg = $('.bp-keypad__msg', s), enter = $('.bp-enter', s), hint = $('.bp-hint', s);
    var code = '', tries = 0, busy = false;
    var WRONG = ['Hmm… that’s not it 🙈', 'Nope! Think harder, cutie 🤭', 'So close… (maybe) 👀', 'Wrong again, silly 💕'];
    function fnv(str) { var h = 0x811c9dc5; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ('0000000' + h.toString(16)).slice(-8); }
    function paint() {
      boxes.forEach(function (b, i) { b.classList.toggle('is-filled', i < code.length); });
      boxesWrap.setAttribute('aria-label', 'Passcode, ' + code.length + ' of 4 digits entered');
      enter.classList.toggle('is-ready', code.length === 4);
    }
    function press(k, btn) {
      if (busy || current !== 'unlock') return;
      if (SND) SND.wake();
      if (btn) { btn.classList.remove('is-pop'); void btn.offsetWidth; btn.classList.add('is-pop'); later(function () { btn.classList.remove('is-pop'); }, 160); }
      if (k === 'clear') { code = ''; sfx('soft'); }
      else if (k === 'back') { code = code.slice(0, -1); sfx('soft'); }
      else if (/^\d$/.test(k) && code.length < 4) { code += k; sfx('key', Number(k)); }
      msg.textContent = '';
      boxesWrap.classList.remove('is-wrong');
      paint();
    }
    function success(auto) {
      busy = true;
      boxesWrap.classList.add('is-right');
      msg.textContent = 'Yay! Unlocked 💖';
      var r = boxesWrap.getBoundingClientRect();
      burstHearts(r.left + r.width / 2, r.top + r.height / 2, 26, 1.6);
      if (!auto) sfx('unlock');
      later(function () { nextScreen(); }, 1100);
    }
    function check() {
      if (busy) return;
      if (code.length < 4) { msg.textContent = 'Four little numbers, please ✨'; sfx('soft'); return; }
      if (fnv(DATA.lock.salt + ':' + code) === DATA.lock.hash) { success(); return; }
      tries++;
      sfx('wrong');
      boxesWrap.classList.remove('is-wrong'); void boxesWrap.offsetWidth; boxesWrap.classList.add('is-wrong');
      msg.textContent = WRONG[(tries - 1) % WRONG.length];
      if (navigator.vibrate) try { navigator.vibrate([30, 40, 30]); } catch (e) {}
      if (tries >= 2 && hint) { hint.hidden = false; hint.classList.remove('is-pulse'); void hint.offsetWidth; hint.classList.add('is-pulse'); }
      later(function () { code = ''; paint(); }, 520);
    }
    $$('.bp-key', s).forEach(function (b) { on(b, 'click', function () { press(b.getAttribute('data-key'), b); }); });
    on(enter, 'click', check);
    on(doc, 'keydown', function (e) {
      if (current !== 'unlock' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) { press(e.key, $('.bp-key[data-key="' + e.key + '"]', s)); e.preventDefault(); }
      else if (e.key === 'Backspace') { press('back', $('.bp-key[data-key="back"]', s)); e.preventDefault(); }
      else if (e.key === 'Enter' && !(e.target && e.target.closest && e.target.closest('button'))) { check(); e.preventDefault(); }
    });
    hooks.unlock = {
      enter: function () { code = ''; busy = false; tries = 0; boxesWrap.classList.remove('is-right', 'is-wrong'); msg.textContent = ''; paint(); },
      auto: function () {
        var digits = 0;
        var tick = function () { if (current !== 'unlock') return; digits++; code = '0000'.slice(0, digits); paint(); if (digits < 4) later(tick, 380); else later(function () { success(true); }, 400); };
        later(tick, 900);
      },
    };
  })();

  /* =============================================================== question */
  (function () {
    var s = screens.question; if (!s) return;
    var ask = $('.bp-q__ask', s), noPanel = $('.bp-q__no', s), head = $('.bp-q__nohead', s);
    var yes = $('.bp-yes', s), no = $('.bp-no', s), again = $('.bp-again', s), nudge = $('.bp-q__nudge', s);
    var msgs = DATA.noMessages && DATA.noMessages.length ? DATA.noMessages : ['How dare you click NO!'];
    var NUDGE = ['', '(the YES button is waiting… 👀)', '(psst… the big one)', '(it’s getting bigger, you know)', '(there is only one right answer)'];
    var noCount = 0, done = false, noLabel = no ? no.innerHTML : '';
    function size() {
      var max = window.innerWidth < 480 ? 1.75 : 2.3;
      yes.style.setProperty('--grow', Math.min(1 + noCount * 0.2, max).toFixed(2));
      no.style.setProperty('--shrink', Math.max(0.62, 1 - noCount * 0.07).toFixed(2));
      nudge.textContent = NUDGE[Math.min(noCount, NUDGE.length - 1)];
      if (noCount >= msgs.length) { no.innerHTML = yes.innerHTML; no.classList.remove('bp-pill--ghost'); }
    }
    function sayYes(btn) {
      if (done) return; done = true;
      if (SND) SND.wake();
      s.classList.add('is-happy');
      sfx('yes');
      nudge.textContent = 'Yay! I knew it 💕';
      var r = (btn || yes).getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top + r.height / 2, small ? 90 : 140);
      burstHearts(r.left + r.width / 2, r.top, 14, 1.3);
      later(nextScreen, 1700);
    }
    on(yes, 'click', function () { sayYes(yes); });
    on(no, 'click', function () {
      if (done) return;
      if (noCount >= msgs.length) { sayYes(no); return; }
      noCount++;
      sfx('no');
      head.textContent = msgs[Math.min(noCount - 1, msgs.length - 1)];
      ask.hidden = true; noPanel.hidden = false;
      try { again.focus({ preventScroll: true }); } catch (e) {}
    });
    on(again, 'click', function () {
      sfx('soft');
      noPanel.hidden = true; ask.hidden = false; size();
      try { yes.focus({ preventScroll: true }); } catch (e) {}
    });
    hooks.question = {
      enter: function () { done = false; noCount = 0; s.classList.remove('is-happy'); ask.hidden = false; noPanel.hidden = true; no.innerHTML = noLabel; no.classList.add('bp-pill--ghost'); size(); },
      auto: function () { later(function () { if (current === 'question') sayYes(yes); }, 1800); },
    };
  })();

  /* ================================================================= letter */
  (function () {
    var s = screens.letter; if (!s) return;
    var env = $('.bp-env', s), reread = $('.bp-reread', s), letter = $('.bp-letter', s);
    var typer = Typer($$('[data-type]', letter), { seconds: 10, onDone: signed });
    var timers = [], running = false;
    function clear() { timers.forEach(clearTimeout); timers = []; }
    function at(ms, fn) { timers.push(later(fn, still ? Math.min(ms, 60) : ms)); }
    function signed() { s.classList.add('is-signed'); at(700, function () { s.classList.add('is-done'); }); }
    function reset() {
      clear(); running = false; typer.reset();
      env.classList.remove('is-cracked', 'is-open', 'is-rising', 'is-away');
      s.classList.remove('is-reading', 'is-signed', 'is-done');
    }
    function open(opts) {
      opts = opts || {};
      if (running) return; running = true;
      if (SND) SND.wake();
      if (opts.instant) {
        s.classList.add('is-reading', 'is-signed', 'is-done');
        typer.finish();
        return;
      }
      env.classList.add('is-cracked'); sfx('crack');
      var r = env.getBoundingClientRect();
      burstHearts(r.left + r.width / 2, r.top + r.height * 0.6, 12, 1);
      at(450, function () { env.classList.add('is-open'); sfx('paper'); });
      at(1300, function () { env.classList.add('is-rising'); });
      at(2350, function () { env.classList.add('is-away'); });
      at(3000, function () { s.classList.add('is-reading'); sfx('paper'); });
      at(3000 + 1750, function () { typer.start(); });
    }
    on(env, 'click', function () { open(); });
    on(env, 'keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    on(letter, 'click', function () { if (s.classList.contains('is-reading') && !typer.done) typer.finish(); });
    on(reread, 'click', function () { reset(); later(function () { open(); }, 350); });
    hooks.letter = {
      enter: function (o) { reset(); if (LIVE || (o && o.openInstant)) open({ instant: true }); },
      leave: function () { clear(); if (!typer.done) typer.finish(); },
      auto: function () { later(function () { if (current === 'letter') open(); }, 1200); },
    };
  })();

  /* ================================================================ players */
  function fmt(sec) { if (!isFinite(sec) || sec < 0) sec = 0; var m = Math.floor(sec / 60), s2 = Math.floor(sec % 60); return m + ':' + (s2 < 10 ? '0' : '') + s2; }
  function bindTrack(ctrl, audio) {
    var seek = $('.bp-seek', ctrl), fill = $('.bp-track__fill', ctrl), time = $('.bp-time', ctrl);
    function paint() {
      var p = audio.duration ? audio.currentTime / audio.duration : 0;
      fill.style.setProperty('--p', (p * 100).toFixed(2) + '%');
      seek.value = String(Math.round(p * 1000));
      time.textContent = fmt(audio.duration && audio.currentTime > 0 ? audio.duration - audio.currentTime : audio.duration || 0);
    }
    on(audio, 'timeupdate', paint); on(audio, 'loadedmetadata', paint); on(audio, 'durationchange', paint);
    on(seek, 'input', function () { if (audio.duration) { audio.currentTime = (Number(seek.value) / 1000) * audio.duration; paint(); } });
    return paint;
  }

  var song = { el: $('.bp-audio-song'), playing: false, started: false, file: !!DATA.songUrl };
  var voice = { el: $('.bp-audio-voice'), playing: false };
  var mini = $('.bp-mini');

  /* voice note */
  (function () {
    var s = screens.voice; if (!s || !voice.el) return;
    var card = $('.bp-voice', s), ctrl = $('.bp-ctrl', s), btn = $('.bp-play', s), bars = $$('.bp-wave i', s);
    var lv = new Array(bars.length), paint = bindTrack(ctrl, voice.el);
    function set(on2) {
      voice.playing = on2;
      card.classList.toggle('is-playing', on2);
      btn.setAttribute('aria-label', on2 ? 'Pause voice note' : 'Play voice note');
      if (SND) SND.duck(on2 && song.playing);
    }
    on(btn, 'click', function () {
      if (SND) { SND.wake(); SND.route(voice.el, 'voice'); }
      if (voice.el.paused) {
        if (song.playing && SND) SND.duck(true);
        var pr = voice.el.play();
        if (pr && pr.catch) pr.catch(function () { set(false); $('.bp-eyebrow', s).textContent = 'this voice note can’t play here 😢'; });
      } else voice.el.pause();
    });
    on(voice.el, 'play', function () { set(true); });
    on(voice.el, 'pause', function () { set(false); });
    on(voice.el, 'ended', function () { set(false); voice.el.currentTime = 0; paint(); });
    tickHooks.push(function (dt, t) {
      if (current !== 'voice') return;
      var got = voice.playing && SND && SND.levels(lv);
      bars.forEach(function (b, i) {
        var v = voice.playing ? (got ? Math.min(1, lv[i] * 1.35) : 0.25 + 0.6 * Math.abs(Math.sin(t * 6 + i * 0.7) * Math.sin(t * 2.3 + i))) : 0.06 + 0.06 * Math.abs(Math.sin(t * 1.5 + i * 0.5));
        b.style.setProperty('--h', v.toFixed(3));
      });
    });
    hooks.voice = { leave: function () { if (!voice.el.paused) voice.el.pause(); } };
  })();

  /* our song */
  (function () {
    var s = screens.song;
    var card = s ? $('.bp-song', s) : null, ctrl = s ? $('.bp-ctrl', s) : null, btn = s ? $('.bp-play', s) : null, notes = s ? $('.bp-notes-fly', s) : null;
    var paint = null;
    if (song.file && song.el && ctrl) paint = bindTrack(ctrl, song.el);
    else if (ctrl) { ctrl.classList.add('is-loop'); $('.bp-time', ctrl).textContent = '♪'; }
    function set(on2) {
      song.playing = on2;
      if (card) card.classList.toggle('is-playing', on2);
      if (btn) btn.setAttribute('aria-label', on2 ? 'Pause our song' : 'Play our song');
      body.classList.toggle('bp--mini', !!song.started);
      if (mini) { mini.hidden = !song.started; mini.classList.toggle('is-paused', !on2); mini.setAttribute('aria-label', on2 ? 'Pause our song' : 'Play our song'); }
      if (SND) SND.duck(on2 && voice.playing);
    }
    function play() {
      if (SND) SND.wake();
      song.started = true;
      if (song.file) {
        if (SND) SND.route(song.el, 'song');
        var pr = song.el.play();
        if (pr && pr.catch) pr.catch(function () { set(false); });
      } else if (SND) { SND.musicBox.start(); set(true); }
    }
    function pause() { if (song.file) song.el.pause(); else if (SND) { SND.musicBox.stop(); set(false); } }
    function toggle() { if (song.playing) pause(); else play(); }
    song.toggle = toggle;
    if (song.file && song.el) {
      on(song.el, 'play', function () { set(true); });
      on(song.el, 'pause', function () { set(false); });
    }
    on(btn, 'click', toggle);
    on(mini, 'click', toggle);
    var noteAcc = 0;
    tickHooks.push(function (dt) {
      if (!song.playing || current !== 'song' || !notes || still) return;
      if (!song.file && ctrl) $('.bp-track__fill', ctrl).style.setProperty('--p', (SND.musicBox.progress() * 100).toFixed(1) + '%');
      noteAcc += dt;
      if (noteAcc > 0.65) {
        noteAcc = 0;
        var n = doc.createElement('span');
        n.className = 'bp-notefly'; n.textContent = pick(['♪', '♫', '♬', '♩']);
        n.style.setProperty('--x', rand(15, 80) + '%'); n.style.setProperty('--dx', rand(-50, 50) + 'px');
        n.style.setProperty('--r', rand(-30, 30) + 'deg'); n.style.setProperty('--s', rand(20, 34) + 'px');
        n.style.setProperty('--c', pick([C.accent, C.lavDeep, C.blushDeep, C.peachDeep]));
        on(n, 'animationend', function () { n.remove(); });
        notes.appendChild(n);
      }
    });
    hooks.song = {};
  })();

  /* ============================================================== scrapbook */
  (function () {
    var s = screens.scrapbook; if (!s) return;
    var board = $('.bp-board', s);
    var lb = $('.bp-lightbox'), lbImg = lb ? $('img', lb) : null, lbCap = lb ? $('.bp-lightbox__cap', lb) : null, lbBack = lb ? $('.bp-lightbox__back', lb) : null, lbCount = lb ? $('.bp-lightbox__count', lb) : null;
    var lbIndex = 0, lastFocus = null, suppressClick = false;

    function polas() { return board ? $$('.bp-pola', board) : []; }

    /* flip */
    on(board, 'click', function (e) {
      var zoom = e.target.closest('.bp-pola__zoom');
      var pola = e.target.closest('.bp-pola');
      if (!pola) return;
      if (suppressClick) { suppressClick = false; e.preventDefault(); return; }
      if (zoom) { openLb(polas().indexOf(pola)); return; }
      if (e.target.closest('.bp-pola__flip')) {
        var flipped = pola.classList.toggle('is-flipped');
        $('.bp-pola__flip', pola).setAttribute('aria-pressed', String(flipped));
        sfx('paper');
      }
    });

    /* drag to rearrange: mouse drags after a small move; touch needs a short hold */
    var drag = null;
    function startDrag(pola, x, y) {
      drag.active = true;
      pola.classList.remove('is-lifting');
      pola.classList.add('is-dragging');
      pola.style.pointerEvents = 'none';
      if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) {}
      sfx('soft');
    }
    function moveDrag(x, y) {
      if (!drag || !drag.active) return;
      drag.el.style.setProperty('--dx', (x - drag.x0) + 'px');
      drag.el.style.setProperty('--dy', (y - drag.y0) + 'px');
      var under = doc.elementFromPoint(x, y);
      var target = under && under.closest ? under.closest('.bp-pola') : null;
      if (target === drag.el) target = null;
      if (drag.target !== target) {
        if (drag.target) drag.target.classList.remove('is-target');
        drag.target = target;
        if (target) target.classList.add('is-target');
      }
    }
    function endDrag() {
      if (!drag) return;
      clearTimeout(drag.hold);
      var el = drag.el;
      el.classList.remove('is-lifting');
      if (drag.active) {
        el.classList.remove('is-dragging');
        el.style.pointerEvents = ''; el.style.removeProperty('--dx'); el.style.removeProperty('--dy');
        if (drag.target) {
          var t = drag.target; t.classList.remove('is-target');
          var marker = doc.createComment('swap');
          board.replaceChild(marker, el); board.replaceChild(el, t); board.replaceChild(t, marker);
          sfx('pop');
          var r = el.getBoundingClientRect(); burstHearts(r.left + r.width / 2, r.top + r.height / 2, 8, 0.8);
        }
        suppressClick = true; later(function () { suppressClick = false; }, 350);
      }
      drag = null;
    }
    on(board, 'mousedown', function (e) {
      var pola = e.target.closest('.bp-pola'); if (!pola || e.button !== 0 || e.target.closest('.bp-pola__zoom')) return;
      drag = { el: pola, x0: e.clientX, y0: e.clientY, active: false, target: null, mouse: true };
    });
    on(window, 'mousemove', function (e) {
      if (!drag || !drag.mouse) return;
      if (!drag.active && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 7) startDrag(drag.el, e.clientX, e.clientY);
      if (drag.active) { e.preventDefault(); moveDrag(e.clientX, e.clientY); }
    });
    on(window, 'mouseup', function () { if (drag && drag.mouse) endDrag(); });
    on(board, 'touchstart', function (e) {
      if (e.touches.length !== 1) return;
      var pola = e.target.closest('.bp-pola'); if (!pola || e.target.closest('.bp-pola__zoom')) return;
      var t = e.touches[0];
      drag = { el: pola, x0: t.clientX, y0: t.clientY, active: false, target: null, mouse: false };
      pola.classList.add('is-lifting');
      drag.hold = later(function () { if (drag && drag.el === pola) startDrag(pola, t.clientX, t.clientY); }, 420);
    }, { passive: true });
    on(board, 'touchmove', function (e) {
      if (!drag || drag.mouse) return;
      var t = e.touches[0];
      if (!drag.active) {
        if (Math.hypot(t.clientX - drag.x0, t.clientY - drag.y0) > 10) { clearTimeout(drag.hold); drag.el.classList.remove('is-lifting'); drag = null; }
        return;
      }
      e.preventDefault();
      moveDrag(t.clientX, t.clientY);
    }, { passive: false });
    on(board, 'touchend', function () { if (drag && !drag.mouse) endDrag(); });
    on(board, 'touchcancel', function () { if (drag && !drag.mouse) endDrag(); });
    on(board, 'contextmenu', function (e) { if (e.target.closest('.bp-pola')) e.preventDefault(); });

    /* lightbox: zoom, then swipe through the rest */
    function showLb(i) {
      var list = polas(); if (!list.length) return;
      lbIndex = (i + list.length) % list.length;
      var p = list[lbIndex], img = $('.bp-pola__img img', p);
      lbImg.src = img.currentSrc || img.src; lbImg.alt = img.alt;
      lbCap.textContent = $('.bp-pola__cap', p).textContent;
      lbBack.textContent = $('.bp-pola__secret', p).textContent;
      lbCount.textContent = (lbIndex + 1) + ' / ' + list.length;
    }
    function openLb(i) {
      if (!lb) return;
      lastFocus = doc.activeElement;
      showLb(i); lb.hidden = false; body.style.overflow = 'hidden';
      sfx('soft');
      try { $('.bp-lightbox__close', lb).focus(); } catch (e) {}
    }
    function closeLb() { if (!lb || lb.hidden) return; lb.hidden = true; body.style.overflow = ''; if (lastFocus) try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
    if (lb) {
      on($('.bp-lightbox__close', lb), 'click', closeLb);
      on($('.bp-lightbox__prev', lb), 'click', function () { showLb(lbIndex - 1); sfx('soft'); });
      on($('.bp-lightbox__next', lb), 'click', function () { showLb(lbIndex + 1); sfx('soft'); });
      on(lb, 'click', function (e) { if (e.target === lb) closeLb(); });
      on(doc, 'keydown', function (e) {
        if (lb.hidden) return;
        if (e.key === 'Escape') closeLb();
        else if (e.key === 'ArrowLeft') showLb(lbIndex - 1);
        else if (e.key === 'ArrowRight') showLb(lbIndex + 1);
      });
      var sx = 0, sy = 0;
      on(lb, 'touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
      on(lb, 'touchend', function (e) {
        var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) showLb(lbIndex + (dx < 0 ? 1 : -1));
      });
    }

    /* sticky notes pop one by one; reasons appear in turn */
    $$('.bp-note__btn', s).forEach(function (b) {
      on(b, 'click', function () {
        b.classList.remove('is-wiggle'); void b.offsetWidth; b.classList.add('is-wiggle');
        var r = b.getBoundingClientRect(); burstHearts(r.left + r.width / 2, r.top + 20, 8, 0.8); sfx('pop');
      });
    });
    var seen = function (el, fn) {
      if (!el) return;
      if (!('IntersectionObserver' in window) || THUMB || LIVE) { fn(); return; }
      // Fires when it scrolls into view — or if a fast fling already carried it past the top.
      var io = new IntersectionObserver(function (entries) { entries.forEach(function (en) { if (en.isIntersecting || en.boundingClientRect.top < 0) { fn(); io.disconnect(); } }); }, { threshold: 0, rootMargin: '0px 0px -12% 0px' });
      io.observe(el);
    };
    hooks.scrapbook = {
      enter: function () {
        seen($('.bp-sticky', s), function () { $$('.bp-note', s).forEach(function (n) { n.classList.add('is-in'); }); });
        seen($('.bp-reasons', s), function () { var r = $('.bp-reasons', s); if (r) r.classList.add('is-in'); });
      },
      leave: closeLb,
    };
  })();

  /* ================================================================= finale */
  (function () {
    var s = screens.finale; if (!s) return;
    var typer = Typer([$('.bp-finale__title', s)], { seconds: 2.4, min: 10, max: 24 });
    var candles = $$('.bp-candle', s), done = $('.bp-cake__done', s), cd = $('.bp-countdown', s);
    var risers = null, cdTimer = 0, wished = false;

    function rise() {
      if (still) return;
      if (risers) risers.remove();
      risers = doc.createElement('div'); risers.className = 'bp-risers'; risers.setAttribute('aria-hidden', 'true');
      // A few slim pearl balloons, drifting up once — quiet, not a party pack.
      var n = small ? 3 : 4, lanes = [8, 82, 24, 66];
      for (var i = 0; i < n; i++) {
        var b = doc.createElement('div'); b.className = 'bp-riser';
        b.style.setProperty('--x', (lanes[i] + rand(-4, 4)) + '%'); b.style.setProperty('--w', rand(small ? 30 : 36, small ? 40 : 50) + 'px');
        b.style.setProperty('--d', rand(13, 17) + 's'); b.style.setProperty('--delay', (i * 1.4 + rand(0, .8)) + 's'); b.style.setProperty('--dx', rand(-30, 30) + 'px');
        b.innerHTML = PEARL_TPL;
        risers.appendChild(b);
      }
      s.insertBefore(risers, s.firstChild);
    }
    function wish() {
      wished = true;
      done.textContent = 'Yay! Your wish is on its way ✨';
      sfx('fanfare');
      var cake = $('.bp-cake', s).getBoundingClientRect();
      confetti(cake.left + cake.width / 2, cake.top + cake.height * 0.3, small ? 120 : 180);
      for (var i = 0; i < 6; i++) (function (k) { later(function () { firework(rand(W * 0.15, W * 0.85), rand(H * 0.12, H * 0.45)); }, 300 + k * 520); })(i);
      rain = small ? 10 : 16; later(function () { if (current === 'finale') rain = small ? 3 : 5; }, 5000);
    }
    function blow(c) {
      if (c.classList.contains('is-out')) return;
      if (SND) SND.wake();
      c.classList.add('is-out'); c.setAttribute('aria-label', 'Candle blown out');
      sfx('puff');
      var r = c.getBoundingClientRect(); burstHearts(r.left + r.width / 2, r.top + 10, 5, 0.6);
      if (candles.every(function (x) { return x.classList.contains('is-out'); }) && !wished) later(wish, 450);
    }
    candles.forEach(function (c) {
      on(c, 'click', function () { blow(c); });
      on(c, 'keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); blow(c); } });
    });

    function countdown() {
      if (!cd) return;
      var md = cd.getAttribute('data-md').split('-'), now = new Date();
      var month = Number(md[0]) - 1, day = Number(md[1]);
      var thisYear = new Date(now.getFullYear(), month, day);
      var isToday = now.getMonth() === month && now.getDate() === day;
      var sinceDays = (now - thisYear) / 86400000;
      var chips = $('.bp-countdown__chips', cd), label = $('.bp-countdown__label', cd), today = $('.bp-countdown__today', cd);
      if (isToday) { cd.hidden = false; chips.hidden = true; label.hidden = true; today.hidden = false; return; }
      if (sinceDays > 0 && sinceDays < 31) { cd.hidden = true; return; } // a belated surprise — no countdown to next year
      var target = sinceDays > 0 ? new Date(now.getFullYear() + 1, month, day) : thisYear;
      var diff = Math.max(0, target - now);
      cd.hidden = false; chips.hidden = false; label.hidden = false; today.hidden = true;
      var parts = { d: Math.floor(diff / 86400000), h: Math.floor(diff / 3600000) % 24, m: Math.floor(diff / 60000) % 60, s: Math.floor(diff / 1000) % 60 };
      Object.keys(parts).forEach(function (k) { var el = $('[data-u="' + k + '"]', cd); if (el) el.textContent = parts[k]; });
    }

    on($('.bp-replay', s), 'click', function () {
      sfx('soft');
      rain = 0;
      go(DATA.skipLock && ORDER.length > 1 ? ORDER[1] : 'unlock');
    });

    hooks.finale = {
      enter: function () {
        wished = false;
        candles.forEach(function (c, i) { c.classList.remove('is-out'); c.setAttribute('aria-label', 'Blow out candle ' + (i + 1)); });
        if (done) done.textContent = '';
        typer.reset();
        if (LIVE) typer.finish(); else later(function () { typer.start(); }, 350);
        rise();
        if (!LIVE) { rain = small ? 8 : 14; later(function () { if (current === 'finale' && !wished) rain = small ? 2.5 : 4; }, 3500); }
        countdown(); clearInterval(cdTimer); if (cd) cdTimer = setInterval(countdown, 1000);
        if (!LIVE) later(function () { if (current === 'finale') sfx('fanfare'); }, 600);
      },
      leave: function () { rain = 0; clearInterval(cdTimer); if (risers) { risers.remove(); risers = null; } },
      auto: function () { later(function () { candles.forEach(function (c, i) { later(function () { if (current === 'finale') blow(c); }, i * 300); }); }, 3200); },
    };
  })();

  /* =============================================================== controls */
  (function () {
    var snd = $('.bp-sound'), mot = $('.bp-motion');
    function paintSound() { if (!snd || !SND) return; var m = SND.muted; snd.setAttribute('aria-pressed', String(!m)); snd.setAttribute('aria-label', m ? 'Sound effects off' : 'Sound effects on'); }
    paintSound();
    on(snd, 'click', function () { if (!SND) return; SND.wake(); SND.setMuted(!SND.muted); paintSound(); if (!SND.muted) sfx('soft'); });
    on(mot, 'click', function () {
      still = !still;
      try { localStorage.setItem('bp-motion', still ? 'off' : 'on'); } catch (e) {}
      applyMotion();
      if (still) { fx = []; drawStill(); if (floaters) floaters.innerHTML = ''; floatCount = 0; }
      else seed();
    });
  })();

  /* ================================================================== start */
  var first = DATA.start || (DATA.skipLock && ORDER.length > 1 ? ORDER[1] : 'unlock');
  if (!screens[first]) first = 'unlock';
  $$('.bp-screen.is-active').forEach(function (el) { el.classList.remove('is-active'); });
  go(first, { instant: true, openInstant: LIVE });

})();
