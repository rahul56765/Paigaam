'use strict';
/**
 * Maafi — the mechanic.
 *
 * Ported 1:1 from ThisWasAryan/interactive-apology-page: the No button runs
 * from the cursor (desktop) or the tap (mobile), teleporting to a random
 * non-overlapping spot and shrinking by 0.1 per attempt down to 0.3; the Yes
 * button grows by 0.05 per attempt once the resistance passes three; the pity
 * ladder climbs through fifteen messages; the attempt counter pleads through
 * three tiers; Yes bursts the screen in heart rain and bouncing emoji.
 *
 * The copy comes from the server-rendered #mmPayload JSON block (personalised
 * per Paigaam). The sender's headline is set with textContent — never markup.
 */
(function () {
  var body = document.body;
  if (!body || !body.classList.contains('mm')) return;

  var payloadNode = document.getElementById('mmPayload');
  var DEFAULTS = { headline: 'I’m really sorry ❤️', ladder: [], yesLabel: 'Okay baby, I forgive you 💖', noLabel: 'No, I’m still angry 😠', celebration: 'Yay! You forgave me! 😍💖🥳' };
  var CFG = DEFAULTS;
  try {
    var parsed = JSON.parse(payloadNode ? payloadNode.textContent : '{}');
    if (parsed && typeof parsed === 'object') {
      CFG = Object.assign({}, DEFAULTS, parsed); // partial payloads keep the defaults
    }
  } catch (e) { /* defaults hold */ }

  var mainText = document.getElementById('mmText');
  var yesButton = document.getElementById('mmYes');
  var noButton = document.getElementById('mmNo');
  var buttons = document.getElementById('mmButtons');
  var emojiBox = document.getElementById('mmEmoji');
  var counter = document.getElementById('mmCount');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var inFrame = window !== window.parent; // collection thumbnails autoplay quietly

  var messageIndex = 0;
  var noAttempts = 0;
  var HEARTS = ['❤️', '💖', '💕', '💗', '💝', '🥰', '😍'];
  var YES_CELEBRATION_EMOJI = '😊❤️💃🎉✨🥰💕🌟🎊💖🌹😘';
  var said = false;

  /** The pity ladder: [0] is the sender's own line; the rest are the design's. */
  function ladderAt(i) {
    if (i === 0) return CFG.headline;
    var ladder = CFG.ladder || [];
    return ladder[(i - 1) % ladder.length] || CFG.headline;
  }

  function tierMessage() {
    if (noAttempts <= 5) return 'Come on... just click YES! 🥺 (Attempts: ' + noAttempts + ')';
    if (noAttempts <= 10) return 'Please baby! I\'m begging you! 😭 (Attempts: ' + noAttempts + ')';
    return 'I can do this all day! 💪❤️ (Attempts: ' + noAttempts + ')';
  }

  /* ------------------------------------------------------------ the run away */

  function sparkle(x, y) {
    for (var i = 0; i < 5; i++) {
      var dot = document.createElement('div');
      dot.className = 'mm-sparkle';
      dot.style.left = x + (Math.random() - 0.5) * 50 + 'px';
      dot.style.top = y + (Math.random() - 0.5) * 50 + 'px';
      document.body.appendChild(dot);
      setTimeout(function (node) { return function () { node.remove(); }; }(dot), 1000);
    }
  }

  function heartRain() {
    var heart = document.createElement('div');
    heart.className = 'mm-heart';
    heart.textContent = HEARTS[Math.floor(Math.random() * HEARTS.length)];
    heart.style.left = Math.random() * window.innerWidth + 'px';
    heart.style.top = window.innerHeight + 'px';
    document.body.appendChild(heart);
    setTimeout(function () { heart.remove(); }, 4000);
  }

  function rectOf(node) {
    // The stub DOM (tests) supplies its own rect; real buttons use the box.
    if (node && node.__rect) return node.__rect;
    return node && node.getBoundingClientRect ? node.getBoundingClientRect() : { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }

  function moveNoButton() {
    if (!buttons || !noButton) return;
    var rect = rectOf(buttons);
    var btnRect = rectOf(noButton);
    var yesRect = rectOf(yesButton);
    var maxX = rect.width - btnRect.width - 20;
    var maxY = rect.height - btnRect.height - 20;
    if (maxX < 10) maxX = 10;
    if (maxY < 10) maxY = 10;

    var newX, newY, attempts = 0;
    var maxAttempts = 50;

    // Keep trying until we find a position that doesn't overlap with Yes.
    do {
      newX = Math.random() * maxX + 10;
      newY = Math.random() * maxY + 10;
      attempts++;

      var noLeft = rect.left + newX;
      var noRight = noLeft + btnRect.width;
      var noTop = rect.top + newY;
      var noBottom = noTop + btnRect.height;

      var padding = 30;
      var overlaps = !(
        noRight + padding < yesRect.left ||
        noLeft - padding > yesRect.right ||
        noBottom + padding < yesRect.top ||
        noTop - padding > yesRect.bottom
      );

      if (!overlaps || attempts >= maxAttempts) break;
    } while (true);

    noButton.style.left = newX + 'px';
    noButton.style.top = newY + 'px';

    sparkle(btnRect.left + btnRect.width / 2, btnRect.top + btnRect.height / 2);

    // Shrink the button each time it moves — 1:1 with the original.
    noAttempts++;
    var newScale = Math.max(0.3, 1 - (noAttempts * 0.1));
    noButton.style.transform = 'scale(' + newScale + ')';
  }

  function initNoButton() {
    if (!noButton) return;
    var isMobileView = window.innerWidth <= 768;
    noButton.style.left = isMobileView ? '50%' : '70%';
    noButton.style.top = isMobileView ? '70%' : '50%';
    noButton.style.transform = 'translate(-50%, -50%) scale(1)';
    noAttempts = 0;
  }

  /* -------------------------------------------------------- the plea ladder */

  function advanceMessage() {
    messageIndex++;
    if (mainText) {
      if (messageIndex === 0) {
        mainText.textContent = ladderAt(messageIndex);
      } else {
        // The design's ladder lines carry emoji as plain text; the original
        // set innerHTML, and so do we — the strings come from the template,
        // never from the sender.
        mainText.innerHTML = ladderAt(messageIndex);
      }
      mainText.classList.add('mm-shake');
      setTimeout(function () { mainText.classList.remove('mm-shake'); }, 500);
    }
    if (counter) counter.innerHTML = tierMessage();
  }

  initNoButton();
  window.addEventListener('resize', initNoButton);

  // Desktop only: move on hover.
  var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (!isMobile) {
    noButton && noButton.addEventListener('mouseenter', function () {
      if (said) return;
      moveNoButton();
      advanceMessage();
      heartRain();
    });
  }

  // Mobile (and every keyboard/touch activation): move on click.
  noButton && noButton.addEventListener('click', function (e) {
    e.preventDefault();
    if (said) return;
    moveNoButton();
    advanceMessage();
    heartRain();
  });

  /* --------------------------------------------------------- the celebration */

  yesButton && yesButton.addEventListener('click', function () {
    if (said) return;
    said = true;
    if (mainText) mainText.textContent = CFG.celebration;
    if (emojiBox) { emojiBox.textContent = YES_CELEBRATION_EMOJI; emojiBox.classList.remove('hidden'); }
    if (counter) counter.innerHTML = 'I LOVE YOU SO MUCH! ❤️❤️❤️';
    if (buttons) buttons.style.display = 'none';
    if (!reduced) {
      for (var i = 0; i < 30; i++) {
        setTimeout(heartRain, i * 150);
      }
      body.style.background = 'linear-gradient(-45deg, #ff69b4, #ff1493, #ff69b4, #ffc0cb, #ff69b4, #ff1493)';
    }
  });

  // Yes grows bigger as the No attempts pile up — 1:1 with the original.
  setInterval(function () {
    if (noAttempts > 3 && buttons && buttons.style.display !== 'none' && !said) {
      yesButton.style.transform = 'translateY(-8px) scale(' + (1.1 + (noAttempts * 0.05)) + ')';
    }
  }, 100);
})();
