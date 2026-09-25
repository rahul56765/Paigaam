'use strict';
/**
 * Meri Duniya — the motion layer. Everything he reads is server-rendered
 * (templates/meri-duniya/render.js); this script only animates it.
 *
 *   · opening: one heartbeat (CSS, ≤1.2s), "Hey {Name}…" at 1.2s, "tap to
 *     enter" by 2.8s. Tap → the plum screen fades and the site scrolls.
 *   · letter: tap the envelope → a 600ms clip-path tear (ease-out), once.
 *     Published pages remember it per instance in localStorage, so a reload
 *     lands on the letter. Then the letter types itself at ~28ms/char; a tap
 *     (or "Tap to skip") finishes it at once.
 *   · story: tap a milestone to expand its caption.
 *   · reasons: tap a sticky note to flip it.
 *   · numbers: count up over 1.4s with cubic-bezier(0.22,1,0.36,1) when
 *     scrolled into view; "days together" is recomputed in Asia/Kolkata.
 *   · gallery: arrows + counter over a scroll-snap track.
 *   · question: the button reveals the promise.
 *   · a thin progress bar and a heart that fills as he scrolls.
 * Reduced motion: no tear, no typing, no count-up — everything is simply there.
 */
(function () {
  var doc = document;
  var body = doc.body;
  if (!body) return;
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var TYPE_MS = 28, TEAR_MS = 600, COUNT_MS = 1400;

  function $(id) { return doc.getElementById(id); }
  function each(list, fn) { Array.prototype.forEach.call(list || [], fn); }

  var data = {};
  try { data = JSON.parse(($('mdData') || {}).textContent || '{}') || {}; } catch (e) { data = {}; }
  var store = null;
  try { store = window.localStorage; } catch (e) { store = null; }
  function remember(name) { if (!data.key || !store) return; try { store.setItem('paigaam:meri-duniya:' + data.key + ':' + name, '1'); } catch (e) { /* private mode */ } }
  function remembered(name) { if (!data.key || !store) return false; try { return store.getItem('paigaam:meri-duniya:' + data.key + ':' + name) === '1'; } catch (e) { return false; } }

  /* -------------------------------------------------------- opening */
  var open = $('mdOpen'), enter = $('mdEnter');
  function enterSite() {
    if (!open || open.classList.contains('is-gone')) return;
    open.classList.add('is-gone');
    body.classList.remove('md-locked');
    body.classList.add('md-in');
    onScroll();
  }
  if (open && enter) {
    enter.addEventListener('click', enterSite);
    open.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enterSite(); } });
    try { enter.focus({ preventScroll: true }); } catch (e) { /* old browsers */ }
  } else {
    body.classList.remove('md-locked');
    body.classList.add('md-in');
  }

  /* ------------------------------------------------ progress + heart */
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    (window.requestAnimationFrame || setTimeout)(function () {
      ticking = false;
      var max = Math.max(1, doc.documentElement.scrollHeight - window.innerHeight);
      var p = Math.min(1, Math.max(0, (window.pageYOffset || doc.documentElement.scrollTop || 0) / max));
      doc.documentElement.style.setProperty('--p', p.toFixed(4));
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  /* ------------------------------------------------------ the letter */
  var env = $('mdEnv'), envBtn = $('mdEnvBtn'), letterBody = $('mdLetterBody'), skip = $('mdSkip');
  var typing = null;

  function finishTyping() {
    if (!typing) return;
    clearInterval(typing.timer);
    typing.nodes.forEach(function (n) { n.el.textContent = ''; n.el.appendChild(n.frag); });
    if (typing.caret && typing.caret.parentNode) typing.caret.parentNode.removeChild(typing.caret);
    letterBody.classList.remove('is-typing');
    if (skip) skip.hidden = true;
    typing = null;
  }

  /**
   * Type every paragraph out, character by character, keeping the <br>s.
   * The paragraphs are emptied at once (so the tear never flashes the whole
   * letter) and the typing itself starts after `delay`.
   */
  function startTyping(delay) {
    if (!letterBody || reduced) return;
    var paras = letterBody.querySelectorAll('.md-type');
    var nodes = [];
    each(paras, function (p) {
      var frag = doc.createDocumentFragment();
      var parts = [];
      each(p.childNodes, function (c) { parts.push(c.nodeType === 3 ? { text: c.nodeValue } : { br: true }); });
      each(Array.prototype.slice.call(p.childNodes), function (c) { frag.appendChild(c); });
      nodes.push({ el: p, frag: frag, parts: parts });
    });
    if (!nodes.length) return;
    var caret = doc.createElement('span');
    caret.className = 'md-caret';
    var pi = 0, part = 0, ch = 0, text = null;
    typing = { nodes: nodes, caret: caret, timer: 0 };
    letterBody.classList.add('is-typing');
    if (skip) skip.hidden = false;
    nodes[0].el.appendChild(caret);
    var run = function () { if (typing) typing.timer = setInterval(tick, TYPE_MS); };
    if (delay) setTimeout(run, delay); else run();
    function tick() {
      var n = nodes[pi];
      if (!n) { finishTyping(); return; }
      var cur = n.parts[part];
      if (!cur) { pi++; part = 0; ch = 0; text = null; if (nodes[pi]) nodes[pi].el.appendChild(caret); return; }
      if (cur.br) { n.el.insertBefore(doc.createElement('br'), caret); part++; return; }
      if (!text) { text = doc.createTextNode(''); n.el.insertBefore(text, caret); }
      text.nodeValue += cur.text.charAt(ch++);
      if (ch >= cur.text.length) { part++; ch = 0; text = null; }
    }
  }

  function showLetter(animated) {
    if (!env) return;
    if (animated) startTyping(reduced ? 0 : TEAR_MS);
    env.classList.add('is-torn');
    var done = function () { env.classList.add('is-open'); };
    if (animated && !reduced) setTimeout(done, TEAR_MS); else done();
  }

  if (env && envBtn) {
    if (remembered('opened')) {
      showLetter(false);                 // a reload skips straight to the letter
    } else {
      envBtn.addEventListener('click', function () {
        if (env.classList.contains('is-torn')) return;   // one-time only
        remember('opened');
        showLetter(true);
      });
    }
  }
  if (letterBody) letterBody.addEventListener('click', finishTyping);
  if (skip) skip.addEventListener('click', finishTyping);

  /* ----------------------------------------------------- the story */
  each(doc.querySelectorAll('.md-tl__card[data-expandable]'), function (card) {
    var cap = card.querySelector('.md-tl__cap');
    // Short captions need no "tap to read".
    if (cap && cap.scrollHeight <= cap.clientHeight + 2) card.classList.add('is-short');
    function toggle() { card.setAttribute('aria-expanded', card.getAttribute('aria-expanded') === 'true' ? 'false' : 'true'); }
    card.addEventListener('click', toggle);
    card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });

  /* ---------------------------------------------------- the reasons */
  each(doc.querySelectorAll('.md-note'), function (note) {
    note.addEventListener('click', function () {
      note.setAttribute('aria-pressed', note.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    });
  });

  /* ---------------------------------------------------- the numbers */
  function daysSince(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return null;
    var start = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    var t = new Date(Date.now() + 330 * 60000);               // Asia/Kolkata
    var today = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
    var d = Math.round((today - start) / 86400000);
    return d >= 0 ? d : null;
  }

  /** cubic-bezier(x1,y1,x2,y2) → f(t), solved for x by Newton + bisection. */
  function bezier(x1, y1, x2, y2) {
    function a(p1, p2) { return 1 - 3 * p2 + 3 * p1; }
    function b(p1, p2) { return 3 * p2 - 6 * p1; }
    function c(p1) { return 3 * p1; }
    function at(t, p1, p2) { return ((a(p1, p2) * t + b(p1, p2)) * t + c(p1)) * t; }
    function slope(t, p1, p2) { return 3 * a(p1, p2) * t * t + 2 * b(p1, p2) * t + c(p1); }
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var t = x;
      for (var i = 0; i < 6; i++) {
        var s = slope(t, x1, x2);
        if (Math.abs(s) < 1e-6) break;
        t -= (at(t, x1, x2) - x) / s;
      }
      if (t < 0 || t > 1 || Math.abs(at(t, x1, x2) - x) > 1e-4) {
        var lo = 0, hi = 1; t = x;
        for (var j = 0; j < 30; j++) { var v = at(t, x1, x2); if (Math.abs(v - x) < 1e-5) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
      }
      return at(t, y1, y2);
    };
  }
  var ease = bezier(0.22, 1, 0.36, 1);

  /** "48,210" → { pre, n, post, fmt } ; non-numbers → null (shown as typed). */
  function parseCount(s) {
    var m = /^(\D*?)(\d[\d,]*)(\.\d+)?(\D*)$/.exec(String(s || '').trim());
    if (!m || m[3]) return null;
    var digits = m[2].replace(/,/g, '');
    if (digits.length > 12) return null;
    var fmt = m[2].indexOf(',') < 0 ? 'plain' : (/^\d{1,2}(,\d{2})*,\d{3}$/.test(m[2]) && !/^\d{1,3}(,\d{3})+$/.test(m[2]) ? 'en-IN' : 'en-US');
    return { pre: m[1], n: parseInt(digits, 10), post: m[4], fmt: fmt };
  }
  function show(c, n) { return c.pre + (c.fmt === 'plain' ? String(n) : n.toLocaleString(c.fmt)) + c.post; }

  var counters = [];
  each(doc.querySelectorAll('.md-stat__val[data-count]'), function (el) {
    var since = el.getAttribute('data-since');
    if (since) {
      var d = daysSince(since);
      if (d != null) el.setAttribute('data-count', d.toLocaleString('en-IN'));
    }
    var c = parseCount(el.getAttribute('data-count'));
    if (!c) return;
    el.textContent = show(c, c.n);
    counters.push({ el: el, c: c, done: false });
  });

  function countUp(item) {
    if (item.done) return;
    item.done = true;
    if (reduced || item.c.n === 0) { item.el.textContent = show(item.c, item.c.n); return; }
    var t0 = null;
    item.el.textContent = show(item.c, 0);
    function frame(ts) {
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / COUNT_MS);
      item.el.textContent = show(item.c, Math.round(item.c.n * ease(k)));
      if (k < 1) window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  /* ------------------------------------------- reveal + count on view */
  var reveals = doc.querySelectorAll('.md-reveal');
  if (reduced || !('IntersectionObserver' in window)) {
    each(reveals, function (el) { el.classList.add('is-in'); });
    counters.forEach(function (item) { item.done = true; item.el.textContent = show(item.c, item.c.n); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    each(reveals, function (el) { io.observe(el); });
    // Counters start from zero only once they are actually on screen.
    counters.forEach(function (item) { item.el.textContent = show(item.c, 0); });
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        counters.forEach(function (item) { if (item.el === e.target) countUp(item); });
        co.unobserve(e.target);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (item) { co.observe(item.el); });
  }

  /* ---------------------------------------------------- the gallery */
  var track = $('mdGalTrack'), prev = $('mdGalPrev'), next = $('mdGalNext'), count = $('mdGalCount');
  if (track) {
    var slides = track.querySelectorAll('.md-slide');
    var current = 0;
    function nearest() {
      var mid = track.scrollLeft + track.clientWidth / 2, best = 0, dist = Infinity;
      each(slides, function (s, i) {
        var c = s.offsetLeft + s.offsetWidth / 2;
        if (Math.abs(c - mid) < dist) { dist = Math.abs(c - mid); best = i; }
      });
      return best;
    }
    function paint() {
      if (count) count.textContent = (current + 1) + ' / ' + slides.length;
      if (prev) prev.disabled = current === 0;
      if (next) next.disabled = current === slides.length - 1;
    }
    function go(i) {
      i = Math.max(0, Math.min(slides.length - 1, i));
      var s = slides[i];
      if (!s) return;
      var left = s.offsetLeft - (track.clientWidth - s.offsetWidth) / 2;
      if (track.scrollTo) track.scrollTo({ left: left, behavior: reduced ? 'auto' : 'smooth' }); else track.scrollLeft = left;
      current = i; paint();
    }
    var st = 0;
    track.addEventListener('scroll', function () { clearTimeout(st); st = setTimeout(function () { current = nearest(); paint(); }, 90); }, { passive: true });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1); }
    });
    if (prev) prev.addEventListener('click', function () { go(current - 1); });
    if (next) next.addEventListener('click', function () { go(current + 1); });
    paint();
  }

  /* --------------------------------------------------- the question */
  var yes = $('mdYes'), promise = $('mdPromise');
  if (yes && promise) {
    yes.addEventListener('click', function () {
      yes.classList.add('is-said');
      yes.setAttribute('aria-hidden', 'true');
      yes.tabIndex = -1;
      promise.classList.add('is-open');
      promise.setAttribute('tabindex', '-1');
      setTimeout(function () { try { promise.focus({ preventScroll: true }); } catch (e) { promise.focus(); } }, reduced ? 0 : 300);
    });
  }

  onScroll();
})();
