'use strict';
/**
 * Lavender Bloom Surprise — stage choreography.
 *
 * The copy and artwork are already in the document; this script only:
 *   1. runs the stage state machine (envelope → game → gift → bloom)
 *   2. plays the rigged tic-tac-toe game
 *   3. simulates the confetti on a canvas
 *   4. handles the three interactions: opening the envelope, playing the game,
 *      tapping the gift
 *
 * THE RIG: the visitor is always X and always wins through the first column
 * (cells 0, 3, 6). The bot answers in a random open cell, but never in the
 * first column, and never completes a line of its own. If the visitor somehow
 * avoids the column entirely, their fourth move is treated as the winning one —
 * nobody is ever told they lost a game that was made for them.
 */
(function () {
  var doc = document;
  var body = doc.body;
  if (!body || !body.classList.contains('lb')) return;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var inFrame = window !== window.parent; // collection thumbnails autoplay quietly

  var ORDER = ['envelope', 'game', 'gift', 'bloom'];
  var EXIT_MS = { envelope: 800, game: 1000, gift: 900, bloom: 900 };

  var stages = {};
  ORDER.forEach(function (name) {
    stages[name] = doc.querySelector('.lb-stage[data-stage="' + name + '"]');
  });

  var current = 'envelope';
  var timers = [];

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function rand(min, max) { return Math.random() * (max - min) + min; }

  /* ------------------------------------------------------------- machine */

  function enter(name) {
    var stage = stages[name];
    if (!stage) return;
    current = name;
    stage.classList.add('is-active');
    beats(name);
  }

  /** Exit the current stage, then enter the next. */
  function goTo(next) {
    if (next === current || !stages[next]) return;
    var leaving = stages[current];
    var wait = reduced ? 300 : (EXIT_MS[current] || 800);
    if (leaving) leaving.classList.add('is-leaving');
    clearTimers();
    later(function () {
      if (leaving) leaving.classList.remove('is-active', 'is-leaving');
      enter(next);
    }, wait);
  }

  /** Timed beats inside a stage. */
  function beats(name) {
    var stage = stages[name];
    if (name === 'bloom') {
      var flower = doc.getElementById('lbFlower');
      later(function () { if (flower) flower.classList.add('is-grown'); }, 300);
      later(function () {
        if (flower) flower.classList.add('is-bloomed');
        buildSparkles();
      }, reduced ? 700 : 2400);
      later(function () { stage.classList.add('is-copy'); }, reduced ? 1000 : 3300);
    }
  }

  /* -------------------------------------------------- stage 1 · the envelope */

  var envelopeStage = stages.envelope;
  var envelope = doc.getElementById('lbEnvelope');
  var opening = false;

  function openEnvelope() {
    if (opening || current !== 'envelope') return;
    opening = true;
    if (envelopeStage) envelopeStage.classList.add('is-opening');
    later(function () { goTo('game'); }, reduced ? 500 : 1900);
  }

  if (envelope) {
    envelope.addEventListener('click', openEnvelope);
    envelope.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        openEnvelope();
      }
    });
  }

  /* ------------------------------------------------------ stage 2 · the game */

  var board = doc.querySelector('.lb-board');
  var cells = [];
  if (board) {
    Array.prototype.slice.call(board.querySelectorAll('.lb-cell')).forEach(function (cell) {
      cells.push(cell);
    });
  }
  var winLine = doc.getElementById('lbWinLine');
  var gameStatus = doc.getElementById('lbGameStatus');

  var marks = new Array(9).fill('');
  var gameOver = false;
  var botThinking = false;
  var moves = 0;

  var FIRST_COLUMN = [0, 3, 6];

  function say(message) { if (gameStatus) gameStatus.textContent = message; }

  function openCells() {
    var out = [];
    for (var i = 0; i < 9; i++) if (!marks[i]) out.push(i);
    return out;
  }

  /** Would placing mark at idx complete any line? */
  function completesLine(idx, mark) {
    var row = Math.floor(idx / 3) * 3, col = idx % 3, i;
    var ok = true;
    for (i = 0; i < 3; i++) { var a = row + i; if (a !== idx && marks[a] !== mark) { ok = false; break; } }
    if (ok) return true;
    ok = true;
    for (i = 0; i < 3; i++) { var b = i * 3 + col; if (b !== idx && marks[b] !== mark) { ok = false; break; } }
    if (ok) return true;
    if (col === row) {
      ok = true;
      for (i = 0; i < 3; i++) { var c = i * 4; if (c !== idx && marks[c] !== mark) { ok = false; break; } }
      if (ok) return true;
    }
    if (col + row === 2) {
      ok = true;
      for (i = 0; i < 3; i++) { var d = (i + 1) * 2; if (d !== idx && marks[d] !== mark) { ok = false; break; } }
      if (ok) return true;
    }
    return false;
  }

  function placeMark(idx, mark) {
    marks[idx] = mark;
    if (cells[idx]) cells[idx].classList.add(mark === 'X' ? 'is-x' : 'is-o');
    moves++;
  }

  /** The bot plays a random open cell — never the first column, never a winning cell. */
  function botCell() {
    var open = openCells();
    var safe = open.filter(function (i) {
      return FIRST_COLUMN.indexOf(i) === -1 && !completesLine(i, 'O');
    });
    var pool = safe.length ? safe : open.filter(function (i) { return FIRST_COLUMN.indexOf(i) === -1; });
    if (!pool.length) return -1;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** Did the visitor just complete the first column? */
  function playerWon() {
    return marks[0] === 'X' && marks[3] === 'X' && marks[6] === 'X';
  }

  /** Celebrate the win on the first column, whatever the marks array says. */
  function celebrateFirstColumn() {
    [0, 3, 6].forEach(function (i) {
      marks[i] = 'X';
      if (cells[i]) { cells[i].classList.remove('is-o'); cells[i].classList.add('is-x'); }
    });
  }

  function drawWinLine() {
    if (!board || !winLine) return;
    // A straight line down the middle of column one. The board is a square
    // with equal padding, so column one's centre is (pad + cell/2).
    var size = board.clientWidth || 300;
    var pad = size * 0.045;
    var cell = (size - pad * 2 - (size * 0.032) * 2) / 3;
    var x = pad + cell / 2;
    winLine.setAttribute('x1', x.toFixed(1));
    winLine.setAttribute('y1', (pad + 6).toFixed(1));
    winLine.setAttribute('x2', x.toFixed(1));
    winLine.setAttribute('y2', (size - pad - 6).toFixed(1));
    board.classList.add('is-over');
  }

  function finishGame() {
    gameOver = true;
    say('You won! ✨');
    drawWinLine();
    later(function () { goTo('gift'); }, reduced ? 500 : 800 + 500);
  }

  function botTurn() {
    if (gameOver) return;
    var cell = botCell();
    if (cell === -1) { celebrateFirstColumn(); finishGame(); return; } // no legal move left: the visitor wins by default
    placeMark(cell, 'O');
    botThinking = false;
    say('Your turn — you’re ✕.');
  }

  function playAt(idx) {
    if (gameOver || botThinking || current !== 'game') return;
    if (marks[idx]) return;
    placeMark(idx, 'X');

    // The gentle nudge: after their second move, if they've abandoned the
    // column entirely, remind them where the flowers are hiding.
    if (moves >= 3 && !playerWon() && !(marks[0] === 'X' || marks[3] === 'X' || marks[6] === 'X')) {
      say('Psst — try the left column. 🌷');
    }

    if (playerWon()) { finishGame(); return; }

    // The absolute guarantee: the game was made for them, so it always ends in
    // their win — by the column, by their fourth X, or by the board running out
    // of moves the bot is willing to play.
    var xCount = marks.filter(function (m) { return m === 'X'; }).length;
    if (xCount >= 4) {
      celebrateFirstColumn();
      finishGame();
      return;
    }

    // A full board, or a bot with no legal answer, also means the visitor wins.
    if (openCells().length === 0 || botCell() === -1) {
      celebrateFirstColumn();
      finishGame();
      return;
    }

    // The gentle ceiling: if they've placed three X's and still not found the
    // column, the game gifts it to them rather than let the evening stall.
    if (xCount >= 3 && !(marks[0] === 'X' || marks[3] === 'X' || marks[6] === 'X')) {
      celebrateFirstColumn();
      finishGame();
      return;
    }

    botThinking = true;
    say('Hmm…');
    later(botTurn, reduced ? 250 : 650);
  }

  cells.forEach(function (cell, idx) {
    cell.addEventListener('click', function () { playAt(idx); });
  });

  /* ------------------------------------------------------ stage 3 · the gift */

  var gift = doc.getElementById('lbGift');
  var giftStage = stages.gift;
  var giftOpened = false;

  function openGift() {
    if (giftOpened || current !== 'gift') return;
    giftOpened = true;
    if (gift) gift.classList.add('is-open');
    if (giftStage) giftStage.classList.add('is-open');
    burstGift();
    startConfetti();
    later(function () { goTo('bloom'); }, reduced ? 700 : 1600);
  }

  if (gift) {
    gift.addEventListener('click', openGift);
    gift.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        openGift();
      }
    });
  }

  /** A ring of colour thrown outward from the gift. */
  var CONFETTI_COLORS = ['#E6C3FF', '#B57EDC', '#A9CCF3', '#FFC1D6', '#FFE8A3'];

  function burstGift() {
    var host = doc.getElementById('lbGiftBurst');
    if (!host) return;
    var html = '';
    var total = 18;
    for (var i = 0; i < total; i++) {
      var angle = (i / total) * Math.PI * 2;
      var dist = 70 + Math.random() * 70;
      var dx = Math.cos(angle) * dist;
      var dy = Math.sin(angle) * dist - 24;
      var size = 7 + Math.random() * 8;
      var rot = 120 + Math.random() * 320;
      var dur = 1.1 + Math.random() * 0.7;
      var color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      html += '<i style="--dx:' + dx.toFixed(1) + 'px;--dy:' + dy.toFixed(1) + 'px;--size:' +
        size.toFixed(1) + 'px;--rot:' + rot.toFixed(0) + 'deg;--dur:' + dur.toFixed(2) + 's;background:' + color + '"></i>';
    }
    host.innerHTML = html;
  }

  /* ---------------------------------------------------- confetti · canvas */

  var canvas = doc.getElementById('lbConfetti');
  var confettiRunning = false;
  var rafId = 0;

  function startConfetti() {
    if (!canvas || confettiRunning || reduced) return;
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    confettiRunning = true;

    var width = 0, height = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
    function resize() {
      var rect = canvas.getBoundingClientRect();
      width = rect.width; height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    if (window.addEventListener) window.addEventListener('resize', resize);

    var pieces = [];
    var COUNT = 140;
    for (var i = 0; i < COUNT; i++) {
      pieces.push({
        x: Math.random() * width,
        y: -20 - Math.random() * height * 0.7,
        w: 5 + Math.random() * 6,
        h: 8 + Math.random() * 9,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        vy: 1.4 + Math.random() * 2.1,
        vx: -0.6 + Math.random() * 1.2,
        rot: Math.random() * Math.PI * 2,
        vr: -0.08 + Math.random() * 0.16,
        sway: 0.6 + Math.random() * 1.6,
        phase: Math.random() * Math.PI * 2,
      });
    }

    var started = Date.now();
    function frame() {
      if (!confettiRunning) return;
      ctx.clearRect(0, 0, width, height);
      var t = (Date.now() - started) / 1000;
      for (var i = 0; i < pieces.length; i++) {
        var p = pieces[i];
        p.y += p.vy;
        p.x += p.vx + Math.sin(t * p.sway + p.phase) * 0.6;
        p.rot += p.vr;
        if (p.y > height + 24) { p.y = -24; p.x = Math.random() * width; }
        if (p.x < -24) p.x = width + 12;
        if (p.x > width + 24) p.x = -12;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      rafId = window.requestAnimationFrame(frame);
    }
    if (window.requestAnimationFrame) rafId = window.requestAnimationFrame(frame);
    // The celebration settles after twelve seconds; the bloom keeps the stage.
    later(function () { confettiRunning = false; if (window.cancelAnimationFrame) window.cancelAnimationFrame(rafId); }, 12000);
  }

  /* ------------------------------------------------------ stage 4 · sparkles */

  var SPARKLE_PATH = 'M12 0 L13.5 10.5 L24 12 L13.5 13.5 L12 24 L10.5 13.5 L0 12 L10.5 10.5 Z';

  function buildSparkles() {
    var host = doc.getElementById('lbSparkles');
    if (!host || reduced) return;
    var html = '';
    for (var i = 0; i < 14; i++) {
      var size = rand(7, 15);
      // Ring the bloom: a loose ellipse around the upper-middle of the stage.
      var angle = Math.random() * Math.PI * 2;
      var x = 50 + Math.cos(angle) * rand(14, 30);
      var y = 34 + Math.sin(angle) * rand(8, 20);
      var color = Math.random() < 0.5 ? '#B57EDC' : (Math.random() < 0.5 ? '#FFE8A3' : '#C8A2FF');
      html += '<i style="--x:' + x.toFixed(1) + '%;--y:' + y.toFixed(1) + '%;--size:' + size.toFixed(1) +
        'px;--dur:' + rand(1.8, 3.2).toFixed(2) + 's;--delay:' + rand(0, 2.4).toFixed(2) + 's">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + SPARKLE_PATH + '" fill="' + color + '"></path></svg></i>';
    }
    host.innerHTML = html;
  }

  /* ------------------------------------------------- collection thumbnails */

  // When the card is a thumbnail (same-origin iframe on the collection page),
  // play the whole surprise quietly, end to end.
  if (inFrame) {
    later(function () { openEnvelope(); }, 900);
  }
})();
