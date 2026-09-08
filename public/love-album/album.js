'use strict';
/**
 * Love Album — stage transitions + the draggable 3D deck.
 *
 * Ported 1:1 from ziddi-shop/love-you (vanilla-JS rewrite): the deck data
 * comes from the server-rendered #laPayload block; the interactions are
 * drag-to-tilt, tilt-past-90°-flips, first-touch sparkles, 70% reveal
 * threshold, and the letter modal. The intro spawns falling hearts; the
 * gallery bubbles and sparkles.
 */
(function () {
  var body = document.body;
  if (!body || !body.classList.contains('la')) return;

  var payloadNode = document.getElementById('laPayload');
  var CFG = { deck: [], letterTitle: 'To My Dearest', letterBody: '', sender: '', revealAt: 0.7 };
  try { var parsed = JSON.parse(payloadNode ? payloadNode.textContent : '{}'); if (parsed && typeof parsed === 'object') CFG.deck = parsed.deck || []; CFG.letterTitle = parsed.letterTitle || CFG.letterTitle; CFG.letterBody = parsed.letterBody || ''; CFG.sender = parsed.sender || ''; CFG.revealAt = typeof parsed.revealAt === 'number' ? parsed.revealAt : 0.7; } catch (e) { /* defaults hold */ }

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var inFrame = window !== window.parent; // collection thumbnails autoplay quietly

  var intro = document.getElementById('laIntro');
  var gallery = document.getElementById('laGallery');
  var deckHost = document.getElementById('laDeck');
  var finalBox = document.getElementById('laFinal');
  var finalBtn = document.getElementById('laFinalBtn');
  var letter = document.getElementById('laLetter');
  var letterTitle = document.getElementById('laLetterTitle');
  var letterBodyEl = letter ? letter.querySelector('p') : null;

  if (letterTitle && CFG.letterTitle) letterTitle.textContent = CFG.letterTitle;
  if (letterBodyEl && CFG.letterBody) letterBodyEl.textContent = CFG.letterBody;

  /* ------------------------------------------------------------- helpers */

  function heartSVG(size, hue, sat, light, opacity) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 100 100" style="opacity:' + opacity + '"><path fill="hsl(' + hue + ',' + sat + '%,' + light + '%)" d="M50,88.9C29.9,73.2,16.2,59.1,9.3,47C2.5,35.1,3.5,26.6,12.4,20.8c8-5.2,15.2-4.4,21.6,2.4c3.5,3.7,6.3,8.7,8.4,15c0.6,1.9,1.1,3.2,1.5,3.9c0.4,0.6,0.9,0.9,1.4,0.9c0.5,0,1-0.3,1.3-0.9c0.4-0.6,0.9-1.9,1.5-3.9c2.1-6.3,4.9-11.3,8.4-15c6.4-6.8,13.6-7.6,21.6-2.4c8.9,5.8,10,14.3,3.2,26.3C74.4,59.1,60.7,73.2,50,88.9z"></path></svg>';
  }

  function spawnParticle(x, y, type) {
    var el = document.createElement(type === 'heart' ? 'span' : 'div');
    el.className = 'la-particle' + (type === 'heart' ? ' la-particle--heart' : '');
    var size = 5 + Math.random() * 10;
    if (type === 'heart') {
      el.textContent = '❤️';
      el.style.fontSize = (15 + Math.random() * 20) + 'px';
    } else {
      var colors = ['#f8c1d8', '#d5a6e6', '#9e7bb5', '#674a7a', '#ffb6de'];
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      el.style.borderRadius = type === 'sparkle' ? '50%' : '2px';
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
    }
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    requestAnimationFrame(function () {
      var angle = type === 'heart' ? Math.random() * Math.PI - Math.PI / 2 : Math.random() * Math.PI * 2;
      var distance = 60 + Math.random() * 120;
      var duration = (type === 'heart' ? 1.5 + Math.random() * 2 : 1 + Math.random() * 1.5).toFixed(2);
      el.style.transition = 'transform ' + duration + 's ease-out, opacity ' + duration + 's ease-out';
      el.style.transform = 'translate(' + (Math.cos(angle) * distance).toFixed(0) + 'px,' + (Math.sin(angle) * distance).toFixed(0) + 'px) scale(0.5)';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, parseFloat(duration) * 1000 + 60);
    });
    setTimeout(function () { el.style.opacity = '1'; }, 10);
  }

  /* --------------------------------------------------------- intro stage */

  var heartsHost = document.getElementById('laIntroHearts');
  if (heartsHost && !reduced) {
    var heartTimer = setInterval(function () {
      var heart = document.createElement('div');
      heart.className = 'la-heartfall';
      heart.style.left = (Math.random() * 100) + 'vw';
      heart.style.animationDuration = (3 + Math.random() * 3) + 's';
      heart.innerHTML = heartSVG(10 + Math.random() * 30, 330 + Math.floor(Math.random() * 30), 70 + Math.floor(Math.random() * 30), 70 + Math.floor(Math.random() * 20), (0.3 + Math.random() * 0.5).toFixed(2));
      heartsHost.appendChild(heart);
      setTimeout(function () { heart.remove(); }, 6500);
    }, 300);
  }

  var continueBtn = document.getElementById('laContinue');
  function enterGallery() {
    if (heartsHost) clearInterval(heartTimer);
    body.dataset.stage = 'gallery';
    gallery.hidden = false;
    buildDeck();
    setTimeout(function () { if (intro) intro.remove(); }, 900);
  }
  if (continueBtn) continueBtn.addEventListener('click', enterGallery);

  /* ------------------------------------------------------- gallery stage */

  var interacted = [];
  var deckBuilt = false;

  function decorateStage() {
    if (reduced) return;
    for (var i = 0; i < 15; i++) {
      var b = document.createElement('div');
      b.className = 'la-bubble';
      var size = 20 + Math.random() * 60;
      b.style.width = size + 'px';
      b.style.height = size + 'px';
      b.style.left = (Math.random() * 100) + '%';
      b.style.animationDelay = (Math.random() * 15).toFixed(2) + 's';
      b.style.animationDuration = (15 + Math.random() * 15).toFixed(2) + 's';
      gallery.appendChild(b);
    }
    for (var j = 0; j < 30; j++) {
      var s = document.createElement('div');
      s.className = 'la-sparkle';
      s.style.left = (Math.random() * 100) + '%';
      s.style.top = (Math.random() * 100) + '%';
      s.style.animationDelay = (Math.random() * 3).toFixed(2) + 's';
      gallery.appendChild(s);
    }
  }

  function checkProgress() {
    if (!interacted.length || !finalBox) return;
    var read = interacted.filter(Boolean).length;
    if (read / interacted.length >= CFG.revealAt) finalBox.classList.add('is-visible');
  }

  function buildDeck() {
    if (deckBuilt || !deckHost) return;
    deckBuilt = true;
    interacted = new Array(CFG.deck.length).fill(false);
    decorateStage();

    CFG.deck.forEach(function (cardData, index) {
      var card = document.createElement('div');
      card.className = 'la-card';
      card.dataset.index = index;
      if (cardData.type !== 'photo') card.classList.add('is-note');

      var front = document.createElement('div');
      front.className = 'la-card__front';
      var img = document.createElement('img');
      img.src = cardData.type === 'photo' ? cardData.url : '';
      img.alt = cardData.alt || 'A shared memory';
      img.draggable = false;
      front.appendChild(img);
      if (cardData.type === 'message') {
        img.removeAttribute('src');
        front.style.background = 'linear-gradient(135deg, #f8c1d8, #d5a6e6)';
        var q = document.createElement('div');
        q.style.cssText = 'padding:20px;font-family:\'Dancing Script\',cursive;font-size:1.4rem;color:#674a7a;text-align:center';
        q.textContent = '💌 a hidden note';
        front.appendChild(q);
      }

      var back = document.createElement('div');
      back.className = 'la-card__back';
      var backText = document.createElement('p');
      backText.textContent = cardData.type === 'message' ? cardData.message : (CFG.sender ? 'Swipe back when you are done smiling. — ' + CFG.sender : 'Swipe back when you are done smiling.');
      back.appendChild(backText);
      if (cardData.type !== 'message') {
        var hint = document.createElement('span');
        hint.className = 'la-card__hint';
        hint.textContent = 'double-tap to flip back';
        back.appendChild(hint);
      }

      card.appendChild(front);
      card.appendChild(back);

      // Scatter: same spirit as the original (±100px around the centre).
      card.style.left = 'calc(50% - ' + Math.min(window.innerWidth * 0.33, 150) + 'px + ' + (Math.random() * 200 - 100).toFixed(0) + 'px)';
      card.style.top = 'calc(50% - ' + Math.min(window.innerHeight * 0.44, 200) + 'px + ' + (Math.random() * 200 - 100).toFixed(0) + 'px)';
      card.style.zIndex = 10 + index;
      card.style.transform = 'rotateX(' + ((Math.random() - 0.5) * 10).toFixed(1) + 'deg) rotateY(' + ((Math.random() - 0.5) * 10).toFixed(1) + 'deg)';

      deckHost.appendChild(card);
      makeDraggable(card, index);
    });
  }

  function makeDraggable(card, index) {
    var dragging = false;
    var flipped = false;
    var firstTouch = true;
    var startX = 0, startY = 0, cardX = 0, cardY = 0;

    function markRead(x, y) {
      if (!firstTouch) return;
      firstTouch = false;
      card.classList.add('is-read');
      interacted[index] = true;
      if (!reduced) {
        for (var i = 0; i < 8; i++) spawnParticle(x, y, i % 3 === 0 ? 'heart' : 'sparkle');
      }
      checkProgress();
    }

    function onMove(e) {
      if (!dragging) return;
      e.preventDefault();
      var cx = e.touches ? e.touches[0].clientX : e.clientX;
      var cy = e.touches ? e.touches[0].clientY : e.clientY;
      var dx = cx - startX, dy = cy - startY;
      card.style.left = cardX + dx + 'px';
      card.style.top = cardY + dy + 'px';
      var rx = dy * 0.15, ry = -dx * 0.15;
      if (Math.abs(ry) > 90 && !flipped) {
        flipped = true;
        card.classList.add('is-flipped');
        card.style.transform = 'rotateY(180deg)';
      } else if (Math.abs(ry) <= 90 && flipped) {
        flipped = false;
        card.classList.remove('is-flipped');
        card.style.transform = 'rotateX(' + rx.toFixed(1) + 'deg) rotateY(' + ry.toFixed(1) + 'deg)';
      } else {
        card.style.transform = 'rotateX(' + rx.toFixed(1) + 'deg) rotateY(' + ry.toFixed(1) + 'deg)';
      }
      if (!reduced && Math.random() < 0.2) spawnParticle(cx, cy, Math.random() < 0.7 ? 'sparkle' : 'heart');
    }

    function onEnd() {
      if (!dragging) return;
      dragging = false;
      card.classList.remove('is-dragging');
      if (!flipped) {
        card.style.transition = 'transform 0.5s cubic-bezier(0.175,0.885,0.32,1.275)';
        card.style.transform = '';
        setTimeout(function () {
          card.style.transition = 'transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275), box-shadow 0.3s ease';
        }, 500);
      }
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchend', onEnd);
    }

    function onStart(e) {
      if (dragging) return;
      var point = e.touches ? e.touches[0] : e;
      markRead(point.clientX, point.clientY);
      dragging = true;
      card.classList.add('is-dragging');
      var maxZ = 10;
      Array.prototype.forEach.call(deckHost.children, function (c) {
        maxZ = Math.max(maxZ, parseInt(c.style.zIndex, 10) || 0);
      });
      card.style.zIndex = maxZ + 1;
      startX = point.clientX;
      startY = point.clientY;
      var rect = card.getBoundingClientRect();
      cardX = rect.left;
      cardY = rect.top;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchend', onEnd);
    }

    card.addEventListener('mousedown', onStart);
    card.addEventListener('touchstart', onStart, { passive: true });
    card.addEventListener('dblclick', function (e) {
      flipped = !flipped;
      card.style.transition = 'transform 0.7s cubic-bezier(0.175,0.885,0.32,1.275)';
      card.style.transform = flipped ? 'rotateY(180deg)' : '';
      card.classList.toggle('is-flipped', flipped);
      if (!reduced) {
        var rect = card.getBoundingClientRect();
        for (var i = 0; i < 10; i++) spawnParticle(rect.left + rect.width / 2, rect.top + rect.height / 2, 'heart');
      }
      markRead(e.clientX || 0, e.clientY || 0);
    });
  }

  /* ------------------------------------------------- final button + letter */

  if (finalBtn) {
    finalBtn.addEventListener('click', function () {
      if (!reduced) {
        var rect = finalBtn.getBoundingClientRect();
        for (var i = 0; i < 6; i++) {
          (function (delay) {
            setTimeout(function () {
              for (var j = 0; j < 6; j++) spawnParticle(rect.left + rect.width / 2, rect.top + rect.height / 2, Math.random() < 0.7 ? 'heart' : 'sparkle');
            }, delay);
          })(i * 100);
        }
      }
      setTimeout(function () {
        if (letter && typeof letter.showModal === 'function') letter.showModal();
      }, 700);
    });
  }
  var closeBtn = document.getElementById('laLetterClose');
  if (closeBtn && letter) closeBtn.addEventListener('click', function () { letter.close(); });

  /* ------------------------------------------------- collection thumbnails */

  if (inFrame) {
    setTimeout(function () {
      if (continueBtn) continueBtn.click();
      setTimeout(function () {
        var cards = deckHost ? Array.prototype.slice.call(deckHost.children) : [];
        cards.forEach(function (c, i) { if (i % 2 === 0) c.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true })); });
        checkProgress();
      }, 1400);
    }, 900);
  }
})();
