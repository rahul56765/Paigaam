(function () {
  'use strict';
  var dataNode = document.getElementById('wpGameData');
  var data = {};
  try { data = JSON.parse(dataNode && dataNode.textContent || '{}'); } catch (_) {}

  function cleanWord(value) {
    return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
  }
  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = list[i]; list[i] = list[j]; list[j] = t; }
    return list;
  }
  function wordBoard(source) {
    var words = Array.from(new Set((source || []).map(cleanWord).filter(function (w) { return w.length >= 2 && w.length <= 20; })));
    var display = Array.from(new Set((source || []).map(function (w) { return String(w || '').trim(); }).filter(Boolean)));
    if (!words.length) words = ['WEDDING', 'LOVE', 'CAKE', 'CHEERS'];
    var totalLetters = words.reduce(function (sum, word) { return sum + word.length; }, 0);
    var longest = Math.max.apply(null, words.map(function (w) { return w.length; }));
    var size = Math.min(20, Math.max(12, longest, Math.ceil(Math.sqrt(totalLetters * 1.35))));
    var dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
    var sorted = words.slice().sort(function (a, b) { return b.length - a.length; });
    var grid = null;
    function attempt() {
      grid = Array.from({ length: size }, function () { return Array(size).fill(''); });
      var placements = {};
      var ok = true;
      sorted.forEach(function (word) {
        if (!ok) return;
        var options = [];
        for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) dirs.forEach(function (d) {
          var er = r + d[0] * (word.length - 1), ec = c + d[1] * (word.length - 1);
          if (er < 0 || er >= size || ec < 0 || ec >= size) return;
          var can = true;
          for (var k = 0; k < word.length; k++) { var v = grid[r + d[0] * k][c + d[1] * k]; if (v && v !== word[k]) { can = false; break; } }
          if (can) options.push({ r: r, c: c, dr: d[0], dc: d[1] });
        });
        shuffle(options);
        if (!options.length) { ok = false; return; }
        var p = options[0], cells = [];
        for (var x = 0; x < word.length; x++) { var rr = p.r + p.dr * x, cc = p.c + p.dc * x; grid[rr][cc] = word[x]; cells.push(rr * size + cc); }
        placements[word] = cells;
      });
      return ok ? placements : null;
    }
    var placements = null;
    for (var tries = 0; tries < 24 && !placements; tries++) placements = attempt();
    if (!placements) {
      size = Math.max(12, longest, sorted.length);
      grid = Array.from({ length: size }, function () { return Array(size).fill(''); });
      placements = {};
      sorted.forEach(function (word, row) {
        var reverse = row % 2 === 1, letters = reverse ? word.split('').reverse() : word.split('');
        var start = reverse ? size - word.length : 0, cells = [];
        letters.forEach(function (letter, index) { var col = start + index; grid[row][col] = letter; cells.push(row * size + col); });
        placements[word] = cells;
      });
    }
    for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) if (!grid[r][c]) grid[r][c] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return { words: words, display: display, grid: grid, placements: placements, size: size };
  }

  function setupWordSearch() {
    var gridEl = document.getElementById('wpWordGrid'), listEl = document.getElementById('wpWordList');
    if (!gridEl || !listEl) return;
    var board = wordBoard(data.words || []), found = new Set(), selecting = [];
    gridEl.style.setProperty('--grid-size', board.size);
    board.grid.forEach(function (row, r) { row.forEach(function (letter, c) {
      var cell = document.createElement('button'); cell.type = 'button'; cell.className = 'wp-letter'; cell.textContent = letter;
      cell.setAttribute('role', 'gridcell'); cell.setAttribute('aria-label', letter + ', row ' + (r + 1) + ', column ' + (c + 1)); cell.dataset.index = String(r * board.size + c); gridEl.appendChild(cell);
    }); });
    var uniqueDisplay = Array.from(new Set((data.words || []).map(function (w) { return String(w || '').trim(); }).filter(Boolean)));
    listEl.innerHTML = uniqueDisplay.map(function (w, i) { return '<span class="wp-word" data-word="' + i + '">' + w.replace(/[&<>"']/g, function (ch) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]; }) + '</span>'; }).join(' <span aria-hidden="true">•</span> ');
    function cellAt(x, y) { var e = document.elementFromPoint(x, y); return e && e.closest ? e.closest('.wp-letter') : null; }
    function paintSelection() {
      gridEl.querySelectorAll('.wp-letter.is-selecting').forEach(function (e) { e.classList.remove('is-selecting'); });
      selecting.forEach(function (i) { var e = gridEl.querySelector('[data-index="' + i + '"]'); if (e && !e.classList.contains('is-found')) e.classList.add('is-selecting'); });
    }
    function dragPath(a, b) {
      var ar = Math.floor(a / board.size), ac = a % board.size, br = Math.floor(b / board.size), bc = b % board.size;
      var dr = br - ar, dc = bc - ac;
      if (!dr && !dc) return [a];
      if (dr && dc && Math.abs(dr) !== Math.abs(dc)) return [a, b];
      var steps = Math.max(Math.abs(dr), Math.abs(dc)), sr = Math.sign(dr), sc = Math.sign(dc), path = [];
      for (var i = 0; i <= steps; i++) path.push((ar + sr * i) * board.size + ac + sc * i);
      return path;
    }
    function chooseCell(i) {
      if (selecting.length < 2) return;
      var letters = selecting.map(function (idx) { return board.grid[Math.floor(idx / board.size)][idx % board.size]; }).join('');
      var rev = letters.split('').reverse().join('');
      var word = board.words.find(function (w) { return !found.has(w) && (w === letters || w === rev); });
      if (!word) return;
      found.add(word);
      var activeCells = letters === word ? selecting.slice() : selecting.slice().reverse();
      activeCells.forEach(function (idx) { var node = gridEl.querySelector('[data-index="' + idx + '"]'); if (node) { node.classList.add('is-found'); node.classList.remove('is-selecting'); } });
      var pos = board.words.indexOf(word), rawWord = uniqueDisplay.find(function (w) { return cleanWord(w) === word; });
      var labels = Array.from(listEl.querySelectorAll('.wp-word'));
      var labelIndex = uniqueDisplay.indexOf(rawWord);
      if (labels[labelIndex]) { labels[labelIndex].classList.add('found'); labels[labelIndex].setAttribute('aria-label', rawWord + ', found'); }
      var hint = document.getElementById('wpWordHint'); if (hint) hint.textContent = 'Found: ' + (rawWord || word) + ' · ' + found.size + ' of ' + board.words.length;
      if (found.size >= board.words.length) { var party = document.getElementById('wpWordCelebrate'); if (party) party.hidden = false; }
    }
    gridEl.addEventListener('pointerdown', function (ev) {
      var cell = cellAt(ev.clientX, ev.clientY); if (!cell) return;
      ev.preventDefault(); gridEl.setPointerCapture(ev.pointerId); selecting = [Number(cell.dataset.index)]; paintSelection();
    });
    gridEl.addEventListener('pointermove', function (ev) {
      if (!gridEl.hasPointerCapture(ev.pointerId) || !selecting.length) return;
      var cell = cellAt(ev.clientX, ev.clientY); if (!cell) return;
      selecting = dragPath(selecting[0], Number(cell.dataset.index)); paintSelection();
    });
    function release(ev) { if (!selecting.length) return; chooseCell(); if (gridEl.hasPointerCapture(ev.pointerId)) gridEl.releasePointerCapture(ev.pointerId); selecting = []; paintSelection(); }
    gridEl.addEventListener('pointerup', release); gridEl.addEventListener('pointercancel', release);
    gridEl.addEventListener('click', function (ev) {
      var cell = ev.target.closest('.wp-letter'); if (!cell) return;
      var idx = Number(cell.dataset.index);
      if (!gridEl.dataset.tapStart) { gridEl.dataset.tapStart = String(idx); selecting = [idx]; paintSelection(); return; }
      selecting = dragPath(Number(gridEl.dataset.tapStart), idx); delete gridEl.dataset.tapStart; chooseCell(); selecting = []; paintSelection();
    });
  }

  function makeMaze(rows, cols) {
    var cells = Array.from({ length: rows * cols }, function () { return { n: true, e: true, s: true, w: true, seen: false }; });
    function walk(r, c) {
      var i = r * cols + c; cells[i].seen = true;
      var next = shuffle([{ dr: -1, dc: 0, a: 'n', b: 's' }, { dr: 0, dc: 1, a: 'e', b: 'w' }, { dr: 1, dc: 0, a: 's', b: 'n' }, { dr: 0, dc: -1, a: 'w', b: 'e' }]);
      next.forEach(function (d) { var nr = r + d.dr, nc = c + d.dc; if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) return; var j = nr * cols + nc; if (cells[j].seen) return; cells[i][d.a] = false; cells[j][d.b] = false; walk(nr, nc); });
    }
    walk(0, 0); return cells;
  }
  function setupMaze() {
    var boardEl = document.getElementById('wpMaze'); if (!boardEl) return;
    var rows = 10, cols = 10, cells = makeMaze(rows, cols), current = { r: 0, c: 0 }, won = false;
    cells.forEach(function (cell, i) {
      var el = document.createElement('div'); el.className = 'wp-maze-cell' + (i === 0 ? ' is-start' : '') + (i === cells.length - 1 ? ' is-end' : '');
      el.style.setProperty('--wall-top', cell.n ? '#252422' : 'transparent'); el.style.setProperty('--wall-right', cell.e ? '#252422' : 'transparent'); el.style.setProperty('--wall-bottom', cell.s ? '#252422' : 'transparent'); el.style.setProperty('--wall-left', cell.w ? '#252422' : 'transparent');
      el.dataset.cell = String(i); boardEl.appendChild(el);
    });
    var player = document.createElement('div'); player.className = 'wp-maze-player'; player.setAttribute('aria-label', 'Groom');
    player.innerHTML = '<svg viewBox="0 0 24 30" aria-hidden="true"><path d="M5 8c0-4 3-7 7-7s7 3 7 7v3H5zM6 9v5c0 4 2 6 6 6s6-2 6-6V9M3 21l9-2 9 2 2 8H1zM8 21l4 5 4-5" fill="#f5f0e8" stroke="#242321" stroke-width="1.5" stroke-linejoin="round"/><circle cx="9" cy="13" r=".7"/><circle cx="15" cy="13" r=".7"/></svg>';
    boardEl.appendChild(player);
    function position() { player.style.left = (current.c * 10 + 1) + '%'; player.style.top = (current.r * 10 + 1) + '%'; }
    position();
    function move(dir) {
      if (won) return;
      var cell = cells[current.r * cols + current.c], nr = current.r, nc = current.c;
      if (dir === 'up' && !cell.n) nr--; else if (dir === 'right' && !cell.e) nc++; else if (dir === 'down' && !cell.s) nr++; else if (dir === 'left' && !cell.w) nc--; else return;
      current = { r: nr, c: nc }; position();
      if (nr === rows - 1 && nc === cols - 1) { won = true; var win = document.getElementById('wpMazeWin'); if (win) win.hidden = false; }
    }
    document.querySelectorAll('[data-move]').forEach(function (button) { button.addEventListener('click', function () { move(button.dataset.move); }); });
    document.addEventListener('keydown', function (ev) { if (!document.querySelector('.wp-page[data-page="4"].is-active')) return; var keys = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left' }; if (keys[ev.key] && !/input|textarea|select/i.test(ev.target.tagName)) { ev.preventDefault(); move(keys[ev.key]); } });
    var start = null;
    boardEl.addEventListener('pointerdown', function (ev) { start = { x: ev.clientX, y: ev.clientY }; boardEl.setPointerCapture(ev.pointerId); ev.preventDefault(); });
    boardEl.addEventListener('pointermove', function (ev) {
      if (!start || !boardEl.hasPointerCapture(ev.pointerId)) return;
      var dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < Math.min(boardEl.clientWidth, boardEl.clientHeight) / 10) return;
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left'); else move(dy > 0 ? 'down' : 'up');
      start = { x: ev.clientX, y: ev.clientY };
    });
    function clearDrag(ev) { start = null; if (boardEl.hasPointerCapture(ev.pointerId)) boardEl.releasePointerCapture(ev.pointerId); }
    boardEl.addEventListener('pointerup', clearDrag); boardEl.addEventListener('pointercancel', clearDrag);
  }
  setupWordSearch(); setupMaze();
})();
