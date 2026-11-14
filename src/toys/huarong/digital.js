/*
 * 解物 · 卷二 数局
 *
 * 华容道卷内的第二种玩法：n×n 数字滑块。
 * 与木局共用壳、馆入口、存档与无障碍约定，但盘面、计步与求解器各自独立。
 *
 * 操作：点空格旁边的数字，或聚焦数字后按方向键。
 * 目标：1…n²−1 依次排好，空格留在右下。
 */
(function (global) {
  'use strict';

  var JW = global.JW || (global.JW = {});
  JW.toys = JW.toys || {};
  var NS = JW.toys.huarong = JW.toys.huarong || {};
  var modeRef = NS.mode || (NS.mode = { current: 'wood' });

  var SL = NS.sliding;
  var DATA = JW.data.digital;
  var app = document.getElementById('appHuarong');
  if (!app || !SL || !DATA) return;

  var STORE = JW.core.store;
  var LEVELS = DATA.levels;

  var elWrap = document.getElementById('dgWrap');
  var elBoard = document.getElementById('dgBoard');
  var elCoach = document.getElementById('dgCoach');
  var elCoachMsg = document.getElementById('dgCoachMsg');
  var elToast = document.getElementById('dgToast');
  var elSr = document.getElementById('dgSr');
  var elChapter = document.getElementById('dgChapter');
  var elName = document.getElementById('dgName');
  var elSub = document.getElementById('dgSub');
  var elMoves = document.getElementById('dgMoves');
  var elTime = document.getElementById('dgTime');
  var elBest = document.getElementById('dgBest');
  var elLevelGrid = document.getElementById('dgLevelGrid');
  var elWinChapter = document.getElementById('dgWinChapter');
  var elWinTitle = document.getElementById('dgWinTitle');
  var elWinLines = document.getElementById('dgWinLines');
  var elWinNote = document.getElementById('dgWinNote');
  var elWinNext = document.getElementById('dgWinNext');

  var levelIndex = DATA.defaultIndex;
  var level = LEVELS[levelIndex];
  var n = level.n;
  var tiles = [];
  var moves = 0;
  var history = [];
  var finished = false;
  var busy = false;
  var demoMode = false;
  var demoPlayed = false;
  var demoQueue = [];
  var demoTimer = null;
  var coachTimer = null;
  var hintTimer = null;
  var toastTimer = null;
  var selectedValue = 0;
  var elapsed = 0;
  var clockStart = 0;
  var clockPaused = true;
  var clockTimer = null;
  var booted = false;
  var tileNodes = {};
  var holeNode = null;
  var hintNode = null;

  function now() {
    return (global.performance && global.performance.now) ? global.performance.now() : Date.now();
  }

  function volume() { return STORE.volume('huarong'); }

  function currentElapsed() {
    return elapsed + (clockPaused ? 0 : now() - clockStart);
  }

  function fmtTime(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    s = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function announce(text) {
    if (elSr) elSr.textContent = text;
  }

  function showToast(text) {
    if (!elToast) return;
    elToast.textContent = text;
    elToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      elToast.classList.remove('show');
      toastTimer = null;
    }, 1800);
  }

  function showCoach(text, sticky) {
    if (!elCoach || !elCoachMsg) return;
    elCoachMsg.textContent = text;
    elCoach.hidden = false;
    clearTimeout(coachTimer);
    coachTimer = setTimeout(function () {
      if (elCoach) elCoach.hidden = true;
    }, sticky ? 12000 : 5200);
  }

  function hideCoach() {
    if (elCoach) elCoach.hidden = true;
    clearTimeout(coachTimer);
  }

  function setDemoButton(text) {
    var btn = document.getElementById('hrBtnDemo');
    if (btn) btn.textContent = text;
  }

  /* ───────── 时钟 ───────── */

  function paintTime() {
    if (elTime) elTime.textContent = fmtTime(currentElapsed());
  }

  function startClock() {
    if (!clockPaused || finished) return;
    clockPaused = false;
    clockStart = now();
    if (!clockTimer) clockTimer = setInterval(paintTime, 500);
    paintTime();
  }

  function pauseClock() {
    if (!clockPaused) {
      elapsed += now() - clockStart;
      clockPaused = true;
    }
    if (clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
    paintTime();
  }

  /* ───────── 盘面 ───────── */

  function buildBoard() {
    if (!elBoard) return;
    elBoard.innerHTML = '';
    elBoard.style.setProperty('--n', n);
    elBoard.setAttribute('aria-label', n + ' × ' + n + ' 数字盘，空格在右下时归位');
    tileNodes = {};
    holeNode = document.createElement('div');
    holeNode.className = 'dg-hole';
    holeNode.setAttribute('aria-hidden', 'true');
    elBoard.appendChild(holeNode);

    var max = n * n - 1;
    var digits = max >= 100 ? 2.9 : max >= 10 ? 3.3 : 4;
    for (var v = 1; v <= max; v++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dg-tile';
      b.setAttribute('data-v', String(v));
      b.style.fontSize = 'calc(var(--bs, 400px) / ' + n + ' * ' + digits / 10 + ')';
      var face = document.createElement('span');
      face.className = 'dg-face';
      face.textContent = String(v);
      b.appendChild(face);
      elBoard.appendChild(b);
      tileNodes[v] = b;
    }

    hintNode = document.createElement('div');
    hintNode.className = 'dg-hint-cell';
    hintNode.setAttribute('aria-hidden', 'true');
    elBoard.appendChild(hintNode);

    fitBoard();
  }

  function fitBoard() {
    if (!elWrap || !elBoard) return;
    var rect = elWrap.getBoundingClientRect();
    var size = Math.min(rect.width - 10, rect.height - 10, 560);
    if (!isFinite(size) || size < 140) size = 140;
    elBoard.style.width = size + 'px';
    elBoard.style.height = size + 'px';
    elBoard.style.setProperty('--bs', size + 'px');
  }

  function posOf(value) { return tiles.indexOf(value); }

  function place(node, pos) {
    var r = (pos / n) | 0;
    var c = pos % n;
    node.style.transform = 'translate(' + (c * 100) + '%,' + (r * 100) + '%)';
  }

  function paint() {
    if (!elBoard) return;
    var blank = tiles.indexOf(0);
    for (var v = 1; v < n * n; v++) {
      var node = tileNodes[v];
      if (!node) continue;
      var p = tiles.indexOf(v);
      place(node, p);
      node.classList.toggle('ok', p === v - 1);
      node.classList.toggle('selected', v === selectedValue);
      var r = (p / n) | 0;
      var c = p % n;
      node.setAttribute('aria-label', String(v) + '，第 ' + (r + 1) + ' 行第 ' + (c + 1) + ' 列' + (p === v - 1 ? '，已归位' : ''));
    }
    if (holeNode) place(holeNode, blank);
    if (elMoves) elMoves.textContent = String(moves);
    if (elBest) {
      var rec = (volume().progress || {})[level.id];
      elBest.textContent = rec && typeof rec.bestMoves === 'number' ? rec.bestMoves + ' 步' : '—';
    }
    paintTime();
  }

  function paintHud() {
    if (elChapter) elChapter.textContent = level.chapter;
    if (elName) elName.textContent = level.name;
    if (elSub) elSub.textContent = level.sub;
    paint();
  }

  function setSelected(v, opts) {
    selectedValue = v;
    paint();
    if (opts && opts.focus && tileNodes[v]) {
      try { tileNodes[v].focus({ preventScroll: true }); } catch (e) { try { tileNodes[v].focus(); } catch (e2) {} }
    }
  }

  /* ───────── 存档 ───────── */

  function saveSession() {
    var vol = volume();
    if (!vol) return;
    var total = currentElapsed();
    if (finished || (moves === 0 && total < 1000)) {
      vol.sessionDigital = null;
    } else {
      vol.sessionDigital = {
        mode: 'digital',
        levelIndex: levelIndex,
        size: n,
        state: tiles.slice(),
        moves: moves,
        elapsed: Math.round(total),
        at: new Date().toISOString()
      };
    }
    STORE.save();
  }

  function loadLevel(index, opts) {
    opts = opts || {};
    if (!LEVELS[index]) return;
    stopDemo();
    closeAllVeils();
    pauseClock();
    hideCoach();
    clearHint();

    levelIndex = index;
    level = LEVELS[index];
    n = level.n;
    tiles = SL.generate(n, level.seed, level.depth);
    moves = 0;
    history = [];
    finished = false;
    demoPlayed = false;
    elapsed = 0;
    clockPaused = true;
    selectedValue = tiles[0] || 1;

    buildBoard();
    paintHud();
    hideCoach();
    paintTime();
    saveSession();

    STORE.settings().digitalSize = n;
    STORE.save();

    if (!opts.quiet) {
      announce('已载入「' + level.name + '」。把 1 到 ' + (n * n - 1) + ' 按行排好，空格留在右下。');
      showCoach('「' + level.name + '」：' + level.note, true);
      if (tileNodes[selectedValue]) {
        try { tileNodes[selectedValue].focus({ preventScroll: true }); } catch (e) {}
      }
    }
  }

  function boot() {
    booted = true;
    var s = volume().sessionDigital;
    if (s && typeof s.levelIndex === 'number' && LEVELS[s.levelIndex] && s.size === LEVELS[s.levelIndex].n &&
        SL.valid(s.state, s.size) && SL.isSolvable(s.state, s.size)) {
      levelIndex = s.levelIndex;
      level = LEVELS[levelIndex];
      n = level.n;
      tiles = s.state.slice();
      moves = Math.max(0, Number(s.moves) || 0);
      elapsed = Math.max(0, Number(s.elapsed) || 0);
      history = [];
      finished = false;
      selectedValue = tiles[0] || 1;
      buildBoard();
      paintHud();
      clockPaused = true;
      paintTime();
      return;
    }

    var preferred = Number(STORE.settings().digitalSize) || 0;
    var pick = DATA.defaultIndex;
    for (var i = 0; i < LEVELS.length; i++) {
      if (LEVELS[i].n === preferred) { pick = i; break; }
    }
    loadLevel(pick, { quiet: true });
  }

  /* ───────── 走子 ───────── */

  function adjacent(a, b) {
    if (a < 0 || b < 0) return false;
    var ar = (a / n) | 0, ac = a % n;
    var br = (b / n) | 0, bc = b % n;
    return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
  }

  function dirOf(from, to) {
    var fr = (from / n) | 0, fc = from % n;
    var tr = (to / n) | 0, tc = to % n;
    if (tr < fr) return 'up';
    if (tr > fr) return 'down';
    if (tc < fc) return 'left';
    return 'right';
  }

  function applyValue(value, opts) {
    opts = opts || {};
    if (finished || !SL.valid(tiles, n)) return false;
    var from = tiles.indexOf(value);
    var blank = tiles.indexOf(0);
    if (from < 0 || !adjacent(from, blank)) return false;

    history.push({
      tiles: tiles.slice(),
      moves: moves,
      selected: selectedValue
    });
    if (history.length > 200) history.shift();

    tiles[blank] = value;
    tiles[from] = 0;
    moves++;
    selectedValue = value;

    paint();

    if (!opts.demo) {
      hideCoach();
      demoPlayed = false;
      stopDemo();
      if (clockPaused) startClock();
      saveSession();
      var dir = dirOf(from, blank);
      var desc = SL.describe({ value: value, dir: dir });
      announce(desc.text + '。第 ' + moves + ' 步。');
      if (SL.isSolved(tiles, n)) setTimeout(win, 240);
    } else if (SL.isSolved(tiles, n)) {
      setTimeout(win, 260);
    }
    return true;
  }

  function tryValue(value) {
    if (finished) return false;
    var from = tiles.indexOf(value);
    var blank = tiles.indexOf(0);
    if (!adjacent(from, blank)) {
      showToast('「' + value + '」不在空格旁边');
      announce(value + ' 不在空格旁边，动不了。');
      return false;
    }
    return applyValue(value);
  }

  function undo() {
    if (!history.length) {
      showToast('没有可撤销的走子');
      announce('没有可撤销的走子。');
      return;
    }
    stopDemo();
    clearHint();
    var snap = history.pop();
    tiles = snap.tiles;
    moves = snap.moves;
    selectedValue = snap.selected;
    finished = false;
    closeAllVeils();
    if (moves === 0) {
      pauseClock();
      elapsed = 0;
    }
    paint();
    saveSession();
    announce('已撤销一步。');
  }

  function reset() {
    loadLevel(levelIndex);
  }

  /* ───────── 提示与演示 ───────── */

  function clearHint() {
    clearTimeout(hintTimer);
    if (hintNode) hintNode.classList.remove('show');
    for (var v in tileNodes) {
      if (Object.prototype.hasOwnProperty.call(tileNodes, v)) tileNodes[v].classList.remove('hint');
    }
  }

  function showHint(move) {
    clearHint();
    var tile = tileNodes[move.value];
    if (tile) tile.classList.add('hint');
    if (hintNode) {
      place(hintNode, move.to);
      hintNode.classList.add('show');
    }
    hintTimer = setTimeout(clearHint, 2800);
  }

  function computeSolution(done) {
    busy = true;
    app.setAttribute('aria-busy', 'true');
    showCoach('正在找一条可行解…', true);
    setTimeout(function () {
      var res;
      try {
        res = SL.solve(tiles, n, { weight: 3 });
      } catch (e) {
        res = { distance: Infinity, moves: [], limitHit: true, nodes: 0 };
      }
      busy = false;
      app.removeAttribute('aria-busy');
      if (modeRef.current !== 'digital') return;
      done(res);
    }, 40);
  }

  function hint() {
    if (finished || busy) return;
    stopDemo();
    computeSolution(function (res) {
      if (!res.moves.length) {
        showCoach(res.limitHit
          ? '这盘走得较远，暂时算不出参考解。可以先撤销几步，或重置本盘。'
          : '已经归位了。', true);
        return;
      }
      var move = res.moves[0];
      var desc = SL.describe(move);
      showHint(move);
      showCoach('提示：' + desc.text + '。参考解还剩 ' + res.distance + ' 步。', true);
      announce('提示：' + desc.text + '。参考解还剩 ' + res.distance + ' 步。');
    });
  }

  function stopDemo() {
    if (demoTimer) {
      clearTimeout(demoTimer);
      demoTimer = null;
    }
    demoMode = false;
    demoQueue = [];
    setDemoButton('演示');
  }

  function playDemoNext() {
    if (!demoMode) return;
    if (!demoQueue.length) {
      demoMode = false;
      setDemoButton('演示');
      return;
    }
    var move = demoQueue.shift();
    applyValue(move.value, { demo: true });
    demoTimer = setTimeout(playDemoNext, 110);
  }

  function demo() {
    if (finished || busy) return;
    if (demoMode) {
      stopDemo();
      showToast('演示已停止');
      return;
    }
    computeSolution(function (res) {
      if (!res.moves.length) {
        showToast('没有找到可演示的路径');
        return;
      }
      demoMode = true;
      demoPlayed = true;
      demoQueue = res.moves.slice();
      setDemoButton('停止');
      showCoach('演示中 · 参考解 ' + res.distance + ' 步。再点「停止」可中断。', true);
      announce('开始演示，参考解共 ' + res.distance + ' 步。');
      playDemoNext();
    });
  }

  /* ───────── 胜利 ───────── */

  function fillWin(wasDemo) {
    if (elWinChapter) elWinChapter.textContent = level.chapter;
    if (elWinTitle) elWinTitle.textContent = '数阵已归位';
    var rec = (volume().progress || {})[level.id] || {};
    var bestMoves = typeof rec.bestMoves === 'number' ? rec.bestMoves + ' 步' : '—';
    if (elWinLines) {
      elWinLines.innerHTML =
        '<div class="hr-win-line"><span>盘面</span><b>' + n + '×' + n + '</b></div>' +
        '<div class="hr-win-line"><span>步数</span><b>' + moves + '</b></div>' +
        '<div class="hr-win-line"><span>用时</span><b>' + fmtTime(currentElapsed()) + '</b></div>' +
        '<div class="hr-win-line"><span>最佳</span><b>' + bestMoves + '</b></div>';
    }
    if (elWinNote) {
      elWinNote.textContent = wasDemo
        ? '演示完成，不计入最佳成绩。换一种盘面，再走一次。'
        : '已记入档案。数字滑块没有唯一的路，只有更短的路。';
    }
    if (elWinNext) elWinNext.hidden = levelIndex >= LEVELS.length - 1;
  }

  function win() {
    if (finished || !SL.isSolved(tiles, n)) return;
    finished = true;
    pauseClock();
    var wasDemo = demoPlayed;
    demoPlayed = false;
    stopDemo();
    clearHint();

    var vol = volume();
    if (!wasDemo) {
      vol.progress = vol.progress || {};
      var rec = vol.progress[level.id] || { wins: 0, bestMoves: null, bestMs: null };
      rec.wins = (rec.wins || 0) + 1;
      var ms = Math.round(currentElapsed());
      if (typeof rec.bestMoves !== 'number' || moves < rec.bestMoves) rec.bestMoves = moves;
      if (typeof rec.bestMs !== 'number' || ms < rec.bestMs) rec.bestMs = ms;
      rec.at = new Date().toISOString();
      vol.progress[level.id] = rec;
    }
    vol.sessionDigital = null;
    STORE.save();

    paintHud();
    fillWin(wasDemo);
    announce('数阵已归位。' + n + '×' + n + '，' + moves + ' 步，用时 ' + fmtTime(currentElapsed()) + '。');
    setTimeout(function () {
      if (finished && modeRef.current === 'digital') openVeil('dgVeilWin');
    }, 260);
  }

  /* ───────── 弹层 ───────── */

  var veilStack = [];
  var returnFocus = {};

  function focusablesIn(rootEl) {
    var list = rootEl.querySelectorAll('button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])');
    return Array.prototype.filter.call(list, function (el) {
      return !el.disabled && el.getClientRects().length > 0;
    });
  }

  function topVeil() {
    return veilStack.length ? veilStack[veilStack.length - 1] : null;
  }

  function openVeil(id) {
    var v = document.getElementById(id);
    if (!v || v.classList.contains('show')) return;
    returnFocus[id] = document.activeElement;
    v.classList.add('show');
    if (veilStack.indexOf(id) < 0) veilStack.push(id);
    app.setAttribute('inert', '');
    var list = focusablesIn(v);
    var target = list.length ? list[0] : v.querySelector('.slab');
    if (target) {
      if (!target.hasAttribute('tabindex') && target.tagName !== 'BUTTON') target.setAttribute('tabindex', '-1');
      try { target.focus({ preventScroll: true }); } catch (e) { try { target.focus(); } catch (e2) {} }
    }
  }

  function closeVeil(id) {
    var v = document.getElementById(id);
    if (!v) return;
    v.classList.remove('show');
    var idx = veilStack.lastIndexOf(id);
    if (idx >= 0) veilStack.splice(idx, 1);
    if (!veilStack.length) app.removeAttribute('inert');
    var back = returnFocus[id];
    if (back && back.focus) {
      try { back.focus({ preventScroll: true }); } catch (e) {}
    }
    returnFocus[id] = null;
  }

  function closeAllVeils() {
    veilStack.slice().forEach(closeVeil);
  }

  function openLevels() {
    refreshLevelGrid();
    openVeil('dgVeilLevels');
  }

  function refreshLevelGrid() {
    if (!elLevelGrid) return;
    var progress = volume().progress || {};
    elLevelGrid.innerHTML = LEVELS.map(function (L, i) {
      var rec = progress[L.id];
      var best = rec && typeof rec.bestMoves === 'number' ? '最佳 ' + rec.bestMoves + ' 步' : '尚未归位';
      return '<button class="hr-level' + (i === levelIndex ? ' current' : '') + '" type="button" data-dg-size="' + i + '">' +
        '<span class="hr-level-no">' + L.n + '²</span>' +
        '<span class="hr-level-name">' + L.name + '</span>' +
        '<span class="hr-level-sub">' + L.sub + '</span>' +
        '<span class="hr-level-best">' + best + '</span>' +
        '</button>';
    }).join('');
  }

  /* ───────── 键盘 ───────── */

  var ARROWS = {
    ArrowUp: { dr: -1, dc: 0 },
    ArrowDown: { dr: 1, dc: 0 },
    ArrowLeft: { dr: 0, dc: -1 },
    ArrowRight: { dr: 0, dc: 1 }
  };

  function onTileKey(e) {
    if (modeRef.current !== 'digital') return;
    var b = e.target.closest ? e.target.closest('.dg-tile') : null;
    if (!b) return;
    var v = Number(b.getAttribute('data-v'));
    var delta = ARROWS[e.key];

    if (!delta) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        tryValue(v);
      }
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    var from = tiles.indexOf(v);
    var r = (from / n) | 0;
    var c = from % n;
    var tr = r + delta.dr;
    var tc = c + delta.dc;
    if (tr < 0 || tc < 0 || tr >= n || tc >= n) return;
    var target = tr * n + tc;
    if (target === tiles.indexOf(0)) {
      applyValue(v);
    } else {
      var other = tiles[target];
      if (other && tileNodes[other]) tileNodes[other].focus();
    }
  }

  function globalKey(e) {
    if (modeRef.current !== 'digital') return;
    if (!JW.hub || JW.hub.active() !== 'huarong' || JW.hub.isOpen()) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var top = topVeil();
    if (e.key === 'Tab' && top) {
      var v = document.getElementById(top);
      var list = focusablesIn(v);
      if (!list.length) return;
      var first = list[0], lastEl = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
      return;
    }
    if (e.key === 'Escape') {
      if (top) { e.preventDefault(); closeVeil(top); }
      return;
    }
    if (top) return;
    if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); undo(); }
    else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); reset(); }
    else if (e.key === 'h' || e.key === 'H') { e.preventDefault(); hint(); }
    else if (e.key === 'a' || e.key === 'A') { e.preventDefault(); demo(); }
    else if (e.key === 'l' || e.key === 'L') { e.preventDefault(); openLevels(); }
    else if (e.key === 'c' || e.key === 'C') { e.preventDefault(); if (NS.toggleContrast) NS.toggleContrast(); }
    else if (e.key === '?' || (e.key === '/' && e.shiftKey)) { e.preventDefault(); openVeil('dgVeilHelp'); }
  }

  /* ───────── 事件 ───────── */

  if (elBoard) {
    elBoard.addEventListener('click', function (e) {
      if (modeRef.current !== 'digital') return;
      var b = e.target.closest ? e.target.closest('.dg-tile') : null;
      if (!b) return;
      tryValue(Number(b.getAttribute('data-v')));
    });

    elBoard.addEventListener('keydown', onTileKey);

    elBoard.addEventListener('focusin', function (e) {
      if (modeRef.current !== 'digital') return;
      var b = e.target.closest ? e.target.closest('.dg-tile') : null;
      if (!b) return;
      var v = Number(b.getAttribute('data-v'));
      if (v !== selectedValue) setSelected(v);
    });
  }

  document.addEventListener('click', function (e) {
    if (modeRef.current !== 'digital') return;
    if (!JW.hub || JW.hub.active() !== 'huarong' || JW.hub.isOpen()) return;

    var sizeBtn = e.target.closest ? e.target.closest('[data-dg-size]') : null;
    if (sizeBtn) {
      loadLevel(Number(sizeBtn.getAttribute('data-dg-size')));
      return;
    }

    var btn = e.target.closest ? e.target.closest('[data-dg-act]') : null;
    if (!btn) return;
    var act = btn.getAttribute('data-dg-act');
    if (act === 'undo') undo();
    else if (act === 'reset') reset();
    else if (act === 'hint') hint();
    else if (act === 'demo') demo();
    else if (act === 'levels') openLevels();
    else if (act === 'help') openVeil('dgVeilHelp');
    else if (act === 'contrast') { if (NS.toggleContrast) NS.toggleContrast(); }
    else if (act === 'closeVeil') closeVeil(btn.getAttribute('data-veil'));
    else if (act === 'closeWin') closeVeil('dgVeilWin');
    else if (act === 'winAgain') { closeVeil('dgVeilWin'); loadLevel(levelIndex); }
    else if (act === 'winNext') { closeVeil('dgVeilWin'); loadLevel(levelIndex + 1); }
  });

  document.addEventListener('keydown', globalKey);

  document.addEventListener('visibilitychange', function () {
    if (modeRef.current !== 'digital') return;
    if (document.hidden) {
      stopDemo();
      pauseClock();
      saveSession();
    } else if (!finished && JW.hub && !JW.hub.isOpen() && moves > 0) {
      startClock();
    }
  });

  if (global.addEventListener) {
    global.addEventListener('resize', function () {
      if (modeRef.current === 'digital') fitBoard();
    });
  }

  /* ───────── 模式接管 ───────── */

  function activate() {
    if (!booted) boot();
    else {
      fitBoard();
      paintHud();
    }
    if (!finished && moves > 0) startClock();
    if (topVeil()) return;
    if (moves === 0) {
      showCoach('点空格旁边的数字，让它滑进空位。把 1 到 ' + (n * n - 1) + ' 按行排好，空格留在右下。', true);
    }
    var target = tileNodes[selectedValue] || tileNodes[tiles[0]];
    if (target) {
      try { target.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  function pause() {
    stopDemo();
    closeAllVeils();
    pauseClock();
    saveSession();
  }

  function handleAction(act) {
    if (act === 'undo') { undo(); return true; }
    if (act === 'reset') { reset(); return true; }
    if (act === 'hint') { hint(); return true; }
    if (act === 'demo') { demo(); return true; }
    if (act === 'levels') { openLevels(); return true; }
    if (act === 'help') { openVeil('dgVeilHelp'); return true; }
    if (act === 'contrast') { if (NS.toggleContrast) NS.toggleContrast(); return true; }
    return false;
  }

  /* ───────── 初始化 ───────── */

  ['dgVeilLevels', 'dgVeilHelp', 'dgVeilWin'].forEach(function (id) {
    var veil = document.getElementById(id);
    if (veil) {
      veil.classList.add('hr-veil');
      document.body.appendChild(veil);
    }
  });

  NS.digital = {
    id: 'digital',
    title: '数局',
    activate: activate,
    deactivate: pause,
    enter: activate,
    pause: pause,
    handleAction: handleAction,
    openLevels: openLevels,
    hint: hint,
    demo: demo,
    undo: undo,
    reset: reset,
    loadLevel: loadLevel,
    levelIndex: function () { return levelIndex; },
    level: function () { return level; },
    n: function () { return n; },
    state: function () { return tiles.slice(); },
    moves: function () { return moves; },
    solve: function (opts) { return SL.solve(tiles, n, opts); }
  };

  window.__digital = {
    get levelIndex() { return levelIndex; },
    get level() { return level; },
    get n() { return n; },
    get state() { return tiles.slice(); },
    get moves() { return moves; },
    get historyLength() { return history.length; },
    get busy() { return busy; },
    get demoing() { return demoMode; },
    get finished() { return finished; },
    get selected() { return selectedValue; },
    loadLevel: loadLevel,
    reset: reset,
    undo: undo,
    move: function (v) { return tryValue(v); },
    apply: function (v, opts) { return applyValue(v, opts); },
    solve: function (opts) { return SL.solve(tiles, n, opts); },
    hint: hint,
    demo: demo,
    activate: activate,
    pause: pause,
    levelCount: LEVELS.length,
    solved: function () { return SL.isSolved(tiles, n); },
    solvable: function () { return SL.isSolvable(tiles, n); },
    generate: function (i) {
      var L = LEVELS[i] || level;
      return SL.generate(L.n, L.seed, L.depth);
    }
  };
})(window);
