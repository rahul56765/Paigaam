'use strict';
/**
 * Khulta — the doors. Everything is server-rendered (templates/khulta/
 * render.js); this script recomputes the lock state on the device clock and
 * drives the doors.
 *
 *   · unlock: client-side from the start date, in the sender's timezone
 *     (Asia/Kolkata by default). Door n opens on start + (n − 1) days.
 *     Locked doors say "opens {weekday}" — never a midnight countdown.
 *   · open: a 120ms doorframe shadow lift, then a 700ms rotateY on the left
 *     hinge; then the surprise slides up. Opened doors stay open and can be
 *     revisited; each fills the little heart on its lintel.
 *   · opened doors are remembered in localStorage, keyed per link.
 *   · all seven open → the big heart fills and the reveal button appears.
 *   · previews unlock everything, remember nothing, and offer "preview as
 *     day n" so the sender can see each day.
 * Reduced motion: no lift, no swing — doors are simply open.
 */
(function () {
  var doc = document;
  function $(id) { return doc.getElementById(id); }
  function each(list, fn) { Array.prototype.forEach.call(list || [], fn); }

  var cells = doc.querySelectorAll('.kh-cell');
  var sheet = $('khSheet'), card = $('khCard'), closeBtn = $('khClose');
  if (!cells.length || !sheet || !card) return;

  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var LIFT_MS = 120, SWING_MS = 700;
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var data = {};
  try { data = JSON.parse(($('khData') || {}).textContent || '{}') || {}; } catch (e) { data = {}; }
  var preview = !!data.preview;
  var sim = 0;                                   // preview: 0 = all open, n = "as on day n"

  /* ------------------------------------------------------------ memory */
  var KEY = data.key ? 'paigaam:khulta:' + data.key + ':opened' : '';
  var opened = {};
  var store = null;
  try { store = window.localStorage; } catch (e) { store = null; }
  if (KEY && store) {
    try { (JSON.parse(store.getItem(KEY) || '[]') || []).forEach(function (n) { if (n >= 1 && n <= 7) opened[n] = true; }); } catch (e) { /* fresh start */ }
  }
  function save() {
    if (!KEY || !store) return;
    try { store.setItem(KEY, JSON.stringify(Object.keys(opened).map(Number).sort())); } catch (e) { /* private mode */ }
  }

  /* ------------------------------------------------------------- dates */
  function dayNumber(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : null;
  }
  function today() {
    try {
      var iso = new Intl.DateTimeFormat('en-CA', { timeZone: data.tz || 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      var n = dayNumber(iso);
      if (n != null) return n;
    } catch (e) { /* no Intl timezone support */ }
    var t = new Date(Date.now() + 330 * 60000);
    return Math.round(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) / 86400000);
  }
  /** Countdown day: 1 on the start date, ≤0 before, >7 after. */
  function countdownDay() {
    if (preview) return sim || 8;
    var start = dayNumber(data.start);
    return start == null ? 8 : today() - start + 1;
  }
  function opensLabel(index, now) {
    var start = dayNumber(data.start);
    if (start == null) return 'opens soon';
    if (preview && sim) { start = now - (sim - 1); }
    var day = start + index;
    var date = new Date(day * 86400000);
    if (day - now <= 6) return 'opens ' + WEEKDAYS[date.getUTCDay()];
    return 'opens ' + date.getUTCDate() + ' ' + MONTHS[date.getUTCMonth()];
  }

  /* ------------------------------------------------------------- paint */
  var heartEl = $('khHeart'), status = $('khStatus'), full = $('khFull');
  var state = { day: 8, unlocked: 7 };

  function paint() {
    var now = today();
    state.day = countdownDay();
    state.unlocked = Math.max(0, Math.min(7, state.day));
    var count = 0;
    each(cells, function (cell) {
      var n = +cell.getAttribute('data-n');
      var st = n <= state.unlocked ? (n === state.day ? 'today' : 'open') : 'locked';
      var isOpen = st !== 'locked' && !!opened[n];
      if (isOpen) count++;
      cell.setAttribute('data-state', st);
      cell.classList.toggle('is-open', isOpen);
      var when = cell.querySelector('.kh-when');
      var btn = cell.querySelector('.kh-door');
      var label = st === 'locked' ? opensLabel(n - 1, now) : (isOpen ? 'opened' : (st === 'today' ? 'today' : 'open me'));
      if (when) when.textContent = label;
      if (btn) {
        if (st === 'locked') btn.setAttribute('aria-disabled', 'true'); else btn.removeAttribute('aria-disabled');
        btn.setAttribute('aria-label', 'Door ' + n + (st === 'locked' ? ', locked — ' + label : (isOpen ? ', opened' : (st === 'today' ? ', today’s door' : ''))));
      }
    });
    if (heartEl) {
      heartEl.style.setProperty('--fill', (count / 7).toFixed(3));
      heartEl.classList.toggle('is-full', count === 7);
    }
    if (full) full.hidden = count < 7;
    if (status) {
      var next = state.day >= 1 && state.day < 7 ? opensLabel(state.day, now) : '';
      if (state.day <= 0) status.textContent = 'The first door ' + opensLabel(0, now) + '. See you then.';
      else if (count === 7) status.textContent = 'All seven doors are open.';
      else if (state.day > 7) status.textContent = 'Every door is unlocked.';
      else if (opened[state.day]) status.textContent = 'Door ' + (state.day + 1) + ' ' + next + '. Come back then.';
      else status.textContent = 'Door ' + state.day + ' is open today.';
    }
  }

  /* ------------------------------------------------------------- sheet */
  var lastDoor = null, sheetTimer = 0;
  function showSurprise(n, from) {
    lastDoor = from || null;
    each(card.querySelectorAll('.kh-surprise'), function (s) { s.hidden = +s.getAttribute('data-door') !== n; });
    sheet.hidden = false;
    doc.body.classList.add('kh-noscroll');
    card.scrollTop = 0;
    // next frame so the fade/slide transitions run
    (window.requestAnimationFrame || setTimeout)(function () { sheet.classList.add('is-shown'); });
    try { card.focus({ preventScroll: true }); } catch (e) { card.focus(); }
  }
  function hideSurprise() {
    if (sheet.hidden) return;
    sheet.classList.remove('is-shown');
    doc.body.classList.remove('kh-noscroll');
    clearTimeout(sheetTimer);
    sheetTimer = setTimeout(function () { sheet.hidden = true; }, reduced ? 0 : 300);
    if (lastDoor) { try { lastDoor.focus({ preventScroll: true }); } catch (e) { lastDoor.focus(); } }
  }
  if (closeBtn) closeBtn.addEventListener('click', hideSurprise);
  sheet.addEventListener('click', function (e) { if (e.target === sheet) hideSurprise(); });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideSurprise(); });

  /* ------------------------------------------------------------- doors */
  var busy = false;
  each(cells, function (cell) {
    var n = +cell.getAttribute('data-n');
    var btn = cell.querySelector('.kh-door');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (busy) return;
      var st = cell.getAttribute('data-state');
      if (st === 'locked') {
        cell.classList.remove('is-nope');
        void cell.offsetWidth;
        cell.classList.add('is-nope');
        if (status) status.textContent = 'Door ' + n + ' ' + opensLabel(n - 1, today()) + '. No peeking!';
        return;
      }
      if (cell.classList.contains('is-open')) { showSurprise(n, btn); return; }
      opened[n] = true;
      save();
      if (reduced) { paint(); showSurprise(n, btn); return; }
      busy = true;
      cell.classList.add('is-lifting');                      // 1 · 120ms shadow lift
      setTimeout(function () {
        cell.classList.add('is-open');                       // 2 · 700ms swing on the left hinge
        setTimeout(function () {
          cell.classList.remove('is-lifting');
          busy = false;
          paint();
          showSurprise(n, btn);
        }, SWING_MS);
      }, LIFT_MS);
    });
  });

  var reveal = $('khReveal');
  if (reveal && reveal.hasAttribute('data-open')) {
    reveal.addEventListener('click', function () { showSurprise(7, reveal); });
  }

  /* ----------------------------------------------------- preview strip */
  each(doc.querySelectorAll('.kh-sim button'), function (b) {
    b.addEventListener('click', function () {
      sim = +b.getAttribute('data-sim') || 0;
      each(doc.querySelectorAll('.kh-sim button'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      opened = {};                                           // each preview day starts with closed doors
      paint();
    });
  });

  paint();
  // Midnight comes while the page is open: re-check once a minute.
  setInterval(paint, 60000);
})();
