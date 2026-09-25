'use strict';
/**
 * Raaz — The Password Letter (Boyfriend Day family). The gate and the
 * ceremony. Everything here is triggered by him: nothing moves on its own.
 *
 * Flow:
 *   ① lock     he types; wrong → 400ms shake + the next hint crossfades in
 *              (hints are base64 in the payload, decoded only on the FIRST
 *              wrong guess); right → the ceremony.
 *   ② unlock   captcha card fades in, the tick draws (~500ms), holds ~700ms,
 *              then the notification chip slides down (300ms). ~2.5s total,
 *              timed, not skippable.
 *   ③ envelope tap → seal cracks/rotates off (200ms), flap opens (400ms),
 *              the beat slides down-fade away.
 *   ④ gift     the box scales in from 0.6 (back easing, 500ms); tap →
 *              closed → shake (3 toggles, ~600ms) → open burst + confetti
 *              ring over the box + "GIFT FOR YOU!" staggers up letter by
 *              letter (40ms each).
 *   ⑤ letter   fades in on paper grain. Static from there.
 *
 * The password check: salted SHA-256 in the page (salt = link slug or
 * "raaz:demo"), compared case-insensitively after trimming. The answer
 * itself is never in the page. Gesture gate by design.
 *
 * Reduced motion: CSS collapses every animation; the JS below also shortens
 * every timed beat to ~50ms so the flow still works end to end.
 */
(function () {

  var dataEl = document.getElementById('rzData');
  if (!dataEl) return;

  var DATA;
  try { DATA = JSON.parse(dataEl.textContent); } catch (e) { return; }

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var T = reduceMotion
    ? { shake: 0, captchaIn: 60, tick: 60, hold: 60, chip: 60, chipHold: 60, crack: 30, flap: 60, leave: 60, rattle: 60, afterOpen: 60 }
    : { shake: 400, captchaIn: 300, tick: 500, hold: 700, chip: 300, chipHold: 900, crack: 200, flap: 400, leave: 450, rattle: 600, afterOpen: 700 };

  var stages = {
    lock: document.getElementById('rzLock'),
    unlock: document.getElementById('rzUnlock'),
    envelope: document.getElementById('rzEnvelope'),
    gift: document.getElementById('rzGift'),
    letter: document.getElementById('rzLetter'),
  };
  var form = document.getElementById('rzForm');
  var input = document.getElementById('rzInput');
  var hintEl = document.getElementById('rzHint');
  var captcha = document.getElementById('rzCaptcha');
  var chip = document.getElementById('rzChip');
  var envelopeBtn = document.getElementById('rzEnvelopeBtn');
  var seal = envelopeBtn && envelopeBtn.querySelector('.rz-seal');
  var boxBtn = document.getElementById('rzBoxBtn');
  var boxImg = document.getElementById('rzBoxImg');
  var confetti = document.getElementById('rzConfetti');
  var giftTap = document.getElementById('rzGiftTap');

  if (!form || !input || !stages.lock) return;

  var hints = null;      // decoded lazily — not before the first wrong guess
  var hintIx = -1;
  var unlocked = false;
  var opened = false;

  function showStage(name) {
    Object.keys(stages).forEach(function (k) {
      var el = stages[k];
      if (!el) return;
      var on = k === name;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    window.scrollTo(0, 0);
  }

  function decodeHints() {
    if (hints) return hints;
    hints = [];
    try {
      var arr = JSON.parse(atob(DATA.hints || ''));
      if (Array.isArray(arr)) hints = arr.filter(function (h) { return typeof h === 'string' && h; });
    } catch (e) { /* stay silent */ }
    return hints;
  }

  function nextHint() {
    var list = decodeHints();
    if (!list.length || !hintEl) return;
    hintIx = (hintIx + 1) % list.length;
    /* crossfade: fade out, swap text, fade in */
    hintEl.classList.remove('is-visible');
    var line = list[hintIx];
    setTimeout(function () {
      hintEl.textContent = line;
      hintEl.classList.add('is-visible');
    }, reduceMotion ? 0 : 160);
  }

  function wrongGuess() {
    input.classList.remove('is-wrong');
    /* restart the shake animation */
    void input.offsetWidth;
    input.classList.add('is-wrong');
    nextHint();
    input.select();
  }

  /* ---- SHA-256 (hex) of salt + ':' + lowercase trimmed guess ---- */
  function hashGuess(value) {
    var msg = DATA.s + ':' + value.trim().toLowerCase();
    if (!window.crypto || !window.crypto.subtle) return Promise.resolve(null);
    var bytes = new TextEncoder().encode(msg);
    return window.crypto.subtle.digest('SHA-256', bytes).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return ('0' + b.toString(16)).slice(-2);
      }).join('');
    });
  }

  function tryUnlock() {
    if (unlocked) return;
    var guess = input.value || '';
    if (!guess.trim()) { input.focus(); return; }
    hashGuess(guess).then(function (hex) {
      if (unlocked) return;
      if (hex && hex === DATA.h) {
        unlocked = true;
        ceremony();
      } else if (hex === null) {
        /* no WebCrypto (very old browser): fall through as a wrong guess */
        wrongGuess();
      } else {
        wrongGuess();
      }
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    tryUnlock();
  });

  /* ---- ② the unlock ceremony (timed, not skippable) ---- */
  function ceremony() {
    showStage('unlock');
    setTimeout(function () {
      if (captcha) captcha.classList.add('is-in');
      setTimeout(function () {
        if (captcha) captcha.classList.add('is-checked');
        setTimeout(function () {
          if (chip) chip.classList.add('is-down');
          setTimeout(function () { showStage('envelope'); focusIf(envelopeBtn); },
            T.chip + T.chipHold);
        }, T.tick + T.hold);
      }, T.captchaIn);
    }, 30);
  }

  function focusIf(el) { if (el && el.focus) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } } }

  /* ---- ③ envelope: seal cracks, flap opens, beat exits ---- */
  if (envelopeBtn) {
    envelopeBtn.addEventListener('click', function () {
      if (envelopeBtn.dataset.done) return;
      envelopeBtn.dataset.done = '1';
      if (seal) seal.classList.add('is-cracked');
      setTimeout(function () {
        envelopeBtn.classList.add('is-open');
        setTimeout(function () {
          stages.envelope.classList.add('is-leaving');
          setTimeout(function () {
            stages.envelope.classList.remove('is-leaving');
            showStage('gift');
            focusIf(boxBtn);
          }, T.leave);
        }, T.flap);
      }, T.crack);
    });
  }

  /* ---- ④ gift: closed → shake → open burst + headline ---- */
  if (boxBtn) {
    boxBtn.addEventListener('click', function () {
      if (opened) return;
      opened = true;
      boxBtn.classList.add('is-shaking');
      if (boxImg) boxImg.src = '/assets/raaz/box-shake.png';
      setTimeout(function () {
        boxBtn.classList.remove('is-shaking');
        boxBtn.classList.add('is-done');
        if (boxImg) boxImg.src = '/assets/raaz/box-open.png';
        if (confetti) confetti.classList.add('is-burst');
        stages.gift.classList.add('is-open');
        if (giftTap) giftTap.textContent = 'tap to read the letter';
        boxBtn.setAttribute('aria-label', 'Read the letter');
        /* the box is now the doorway to the letter */
        setTimeout(function () {
          boxBtn.addEventListener('click', toLetter);
        }, 0);
        /* auto-advance after the headline has had its moment */
        setTimeout(toLetter, reduceMotion ? 800 : 3400);
      }, T.rattle + 40);
    });
  }

  var letterShown = false;
  function toLetter() {
    if (letterShown) return;
    letterShown = true;
    showStage('letter');
  }

  /* ---- previews: show the password under the lock (server-rendered) ---- */
  /* (already in the DOM via rz-lock__peek when DATA.preview) */

  /* start on the lock */
  showStage('lock');
  if (!DATA.preview) {
    try { input.focus({ preventScroll: true }); } catch (e) { /* fine */ }
  }

})();
