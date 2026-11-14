/*
 * 解物 · 卷二 华容道
 *
 * 4×5 棋盘、10 块木棋；目标是把曹操移到底部中央出口。
 * 玩家同时看到三种计步：直线步 / 古法指步 / 单格步。
 * 求解、提示、演示都调用 solver.js 的单局 BFS，不依赖网络。
 */
(function (global) {
  'use strict';

  var JW = global.JW || (global.JW = {});
  JW.toys = JW.toys || {};
  var NS = JW.toys.huarong = JW.toys.huarong || {};
  var solver = NS.solver;
  var DATA = JW.data.huarong;
  var modeRef = NS.mode || (NS.mode = { current: 'wood' });

  var app = document.getElementById('appHuarong');
  if (!app || !solver || !DATA) return;

  var STORE = JW.core.store;
  var SVGNS = 'http://www.w3.org/2000/svg';

  var CELL = 80;
  var INSET = 4;
  var PADX = 40;
  var PADY = 30;

  var board = document.getElementById('hrBoard');
  var piecesLayer = document.getElementById('hrPieces');
  var hintLayer = document.getElementById('hrHintLayer');
  var elCoach = document.getElementById('hrCoach');
  var elCoachMsg = document.getElementById('hrCoachMsg');
  var elChapter = document.getElementById('hrChapter');
  var elName = document.getElementById('hrName');
  var elSub = document.getElementById('hrSub');
  var elMetrics = document.getElementById('hrMetrics');
  var elTime = document.getElementById('hrTime');
  var elToast = document.getElementById('hrToast');
  var elSr = document.getElementById('hrSr');
  var elLevelGrid = document.getElementById('hrLevelGrid');
  var elWinChapter = document.getElementById('hrWinChapter');
  var elWinTitle = document.getElementById('hrWinTitle');
  var elWinStars = document.getElementById('hrWinStars');
  var elWinLines = document.getElementById('hrWinLines');
  var elWinNote = document.getElementById('hrWinNote');
  var elWinNext = document.getElementById('hrWinNext');
  var elBtnDemo = document.getElementById('hrBtnDemo');

  var levelIndex = 0;
  var model = null;
  var state = [];
  var metrics = { straight: 0, finger: 0, unit: 0 };
  var last = null;
  var selected = 0;
  var history = [];
  var finished = false;
  var metric = 'straight';
  var nodes = [];
  var drag = null;
  var busy = false;
  var demoMode = false;
  var demoPlayed = false;
  var demoQueue = [];
  var demoTimer = null;
  var coachTimer = null;
  var hintTimer = null;
  var toastTimer = null;
  var elapsed = 0;
  var clockStart = 0;
  var clockPaused = true;
  var clockTimer = null;
  var mode = 'wood';

  function now() {
    return (global.performance && global.performance.now) ? global.performance.now() : Date.now();
  }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function positionOf(row, col) { return row * DATA.cols + col; }
  function rowOf(pos) { return (pos / DATA.cols) | 0; }
  function colOf(pos) { return pos % DATA.cols; }

  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVGNS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    }
    return el;
  }

  function cloneMetrics() {
    return { straight: metrics.straight, finger: metrics.finger, unit: metrics.unit };
  }

  function totalMoves() {
    return metrics.straight + metrics.finger + metrics.unit;
  }

  function currentElapsed() {
    return elapsed + (clockPaused ? 0 : now() - clockStart);
  }

  function fmtTime(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    s = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
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

  function paintTime() {
    if (elTime) elTime.textContent = fmtTime(currentElapsed());
  }

  function volume() {
    return STORE.volume('huarong');
  }

  function level() {
    return DATA.levels[levelIndex];
  }

  function metricDef(id) {
    for (var i = 0; i < DATA.metrics.length; i++) {
      if (DATA.metrics[i].id === id) return DATA.metrics[i];
    }
    return DATA.metrics[0];
  }

  function announce(text) {
    if (elSr) elSr.textContent = text;
  }

  function showToast(text) {
    if (!elToast) return;
    elToast.textContent = text;
    elToast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
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

  /* ───────── 棋盘渲染 ───────── */

  function xy(pos) {
    return {
      x: PADX + colOf(pos) * CELL,
      y: PADY + rowOf(pos) * CELL
    };
  }

  function buildPieces() {
    piecesLayer.innerHTML = '';
    hintLayer.innerHTML = '';
    nodes = [];
    for (var i = 0; i < model.pieces.length; i++) {
      var p = model.pieces[i];
      var g = svgEl('g', {
        'class': 'hr-piece tone-' + p.tone,
        'data-i': String(i),
        tabindex: '0',
        role: 'button'
      });
      var rect = svgEl('rect', {
        'class': 'hr-body',
        x: INSET,
        y: INSET,
        width: p.w * CELL - INSET * 2,
        height: p.h * CELL - INSET * 2,
        rx: 7,
        ry: 7
      });
      var text = svgEl('text', {
        'class': 'hr-label',
        x: p.w * CELL / 2,
        y: p.h * CELL / 2,
        'text-anchor': 'middle',
        'dominant-baseline': 'central'
      });
      text.textContent = p.label;
      if (p.label.length > 1) text.setAttribute('font-size', '26');
      g.appendChild(rect);
      g.appendChild(text);
      piecesLayer.appendChild(g);
      nodes.push(g);
    }
  }

  function pieceIndexAt(groupId, pos) {
    var group = model.groups[groupId];
    for (var i = 0; i < group.length; i++) {
      if (state[group[i]] === pos) return group[i];
    }
    return -1;
  }

  function paintPieces() {
    for (var i = 0; i < state.length; i++) {
      var node = nodes[i];
      if (!node) continue;
      var p = xy(state[i]);
      node.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px)';
      node.classList.toggle('selected', i === selected);
      var piece = model.pieces[i];
      node.setAttribute('aria-label', piece.label + '，第 ' + (rowOf(state[i]) + 1) + ' 行第 ' + (colOf(state[i]) + 1) + ' 列');
    }
  }

  function selectPiece(i, opts) {
    if (i < 0 || i >= state.length) return;
    selected = i;
    paintPieces();
    if (opts && opts.focus && nodes[i]) {
      try { nodes[i].focus({ preventScroll: true }); } catch (e) { try { nodes[i].focus(); } catch (e2) {} }
    }
  }

  function buildMetrics() {
    if (!elMetrics) return;
    elMetrics.innerHTML = DATA.metrics.map(function (m) {
      return '<button class="hr-metric" type="button" data-hr-metric="' + m.id + '" aria-pressed="false">' +
        '<span class="hr-metric-name">' + m.name + '</span>' +
        '<b data-hr-count="' + m.id + '">0</b>' +
        '<span class="hr-metric-opt">最优 <i data-hr-opt="' + m.id + '">—</i></span>' +
        '</button>';
    }).join('');
  }

  function paintHud() {
    if (!model) return;
    var L = level();
    if (elName) elName.textContent = L.name;
    if (elSub) elSub.textContent = L.sub;
    if (elChapter) elChapter.textContent = L.chapter;

    DATA.metrics.forEach(function (m) {
      var count = elMetrics && elMetrics.querySelector('[data-hr-count="' + m.id + '"]');
      var opt = elMetrics && elMetrics.querySelector('[data-hr-opt="' + m.id + '"]');
      var btn = elMetrics && elMetrics.querySelector('[data-hr-metric="' + m.id + '"]');
      if (count) count.textContent = metrics[m.id];
      if (opt) opt.textContent = L.optimal[m.id];
      if (btn) btn.setAttribute('aria-pressed', m.id === metric ? 'true' : 'false');
    });

    if (elBtnDemo) elBtnDemo.textContent = demoMode ? '停止' : '演示';
    paintTime();
  }

  /* ───────── 会话 ───────── */

  function saveSession() {
    if (!model) return;
    var vol = volume();
    if (!vol) return;
    var total = currentElapsed();
    if (finished || (totalMoves() === 0 && total < 1000)) {
      vol.session = null;
    } else {
      vol.session = {
        levelIndex: levelIndex,
        state: state.slice(),
        metrics: cloneMetrics(),
        moves: metrics.straight,
        elapsed: Math.round(total),
        at: new Date().toISOString()
      };
    }
    STORE.save();
  }

  function boot() {
    var s = volume() && volume().session;
    if (s && typeof s.levelIndex === 'number' && DATA.levels[s.levelIndex]) {
      levelIndex = s.levelIndex;
      model = solver.compile(level());
      if (solver.valid(model, s.state)) {
        state = solver.canon(s.state, model.groups);
        metrics = {
          straight: Math.max(0, Number(s.metrics && s.metrics.straight) || 0),
          finger: Math.max(0, Number(s.metrics && s.metrics.finger) || 0),
          unit: Math.max(0, Number(s.metrics && s.metrics.unit) || 0)
        };
        last = null;
        elapsed = Math.max(0, Number(s.elapsed) || 0);
        selected = 0;
        history = [];
        finished = false;
        buildPieces();
        paintPieces();
        paintHud();
        clockPaused = true;
        return;
      }
    }

    levelIndex = 0;
    model = solver.compile(level());
    state = model.start.slice();
    metrics = { straight: 0, finger: 0, unit: 0 };
    last = null;
    selected = 0;
    history = [];
    finished = false;
    elapsed = 0;
    buildPieces();
    paintPieces();
    paintHud();
    clockPaused = true;
    paintTime();
    saveSession();
  }

  function loadLevel(index) {
    if (!DATA.levels[index]) return;
    stopDemo();
    closeAllVeils();
    pauseClock();
    levelIndex = index;
    model = solver.compile(level());
    state = model.start.slice();
    metrics = { straight: 0, finger: 0, unit: 0 };
    last = null;
    selected = 0;
    history = [];
    finished = false;
    demoPlayed = false;
    elapsed = 0;
    clockPaused = true;
    buildPieces();
    paintPieces();
    paintHud();
    hideCoach();
    paintTime();
    saveSession();
    announce('已载入「' + level().name + '」。目标：把曹操移到底部出口。');
    showCoach('「' + level().name + '」：' + level().note, true);
    if (nodes[selected]) {
      try { nodes[selected].focus({ preventScroll: true }); } catch (e) {}
    }
  }

  /* ───────── 走子与计步 ───────── */

  function routeDirs(move) {
    var route = move.route || [move.to];
    var prev = move.from;
    var dirs = [];
    for (var i = 0; i < route.length; i++) {
      var dr = rowOf(route[i]) - rowOf(prev);
      var dc = colOf(route[i]) - colOf(prev);
      var dir = dr < 0 ? 'up' : dr > 0 ? 'down' : dc < 0 ? 'left' : 'right';
      if (!dirs.length || dirs[dirs.length - 1] !== dir) dirs.push(dir);
      prev = route[i];
    }
    return dirs;
  }

  // 直线步：每次落手按方向段计数；换方向就是新的一步。
  // 古法指步：同一块棋连续滑动（可转弯）并成一步，直到换一块棋。
  function metricAdds(move) {
    var dirs = routeDirs(move);
    metrics.straight += dirs.length;
    metrics.finger += (last && last.g === move.g) ? 0 : 1;
    last = { g: move.g, dir: dirs.length ? dirs[dirs.length - 1] : move.dir };
  }

  function applyMove(move, opts) {
    opts = opts || {};
    if (!model || finished) return false;
    var ns = solver.applyMove(model, state, move);
    if (!ns) return false;

    history.push({
      state: state.slice(),
      metrics: cloneMetrics(),
      last: last ? { g: last.g, dir: last.dir } : null,
      selected: selected
    });
    if (history.length > 160) history.shift();

    metrics.unit += move.cells;
    metricAdds(move);
    state = ns;

    var moved = pieceIndexAt(move.g, move.to);
    selected = moved >= 0 ? moved : selected;

    paintPieces();
    paintHud();

    if (!opts.demo) {
      demoPlayed = false;
      stopDemo();
      if (clockPaused) startClock();
      saveSession();
      var desc = solver.describe(model, move);
      announce(desc.text + '。');
      if (totalMoves() > 0) hideCoach();
      if (solver.isGoal(model, state)) setTimeout(win, 240);
    } else if (solver.isGoal(model, state)) {
      setTimeout(win, 260);
    }
    return true;
  }

  function slideFor(index, dir) {
    return solver.slide(model, state, index, dir.dr, dir.dc);
  }

  function movePiece(index, dirId, max) {
    if (!model || finished || busy || !nodes[index]) return false;
    var dir = null;
    for (var i = 0; i < solver.DIRS.length; i++) {
      if (solver.DIRS[i].id === dirId) { dir = solver.DIRS[i]; break; }
    }
    if (!dir) return false;
    var route = slideFor(index, dir);
    if (!route.length) {
      showToast('「' + model.pieces[index].label + '」向' + dir.name + '动不了');
      announce('动不了：' + model.pieces[index].label + '向' + dir.name + '没有空位。');
      return false;
    }
    var use = max ? route : [route[0]];
    return applyMove({
      g: model.groupOf[index],
      from: state[index],
      to: use[use.length - 1],
      cells: use.length,
      dir: dir.id,
      route: use.slice()
    });
  }

  function undo() {
    if (!history.length) {
      showToast('没有可撤销的走子');
      announce('没有可撤销的走子。');
      return;
    }
    stopDemo();
    var snap = history.pop();
    state = snap.state;
    metrics = snap.metrics;
    last = snap.last;
    selected = snap.selected;
    finished = false;
    closeAllVeils();
    if (totalMoves() === 0) {
      pauseClock();
      elapsed = 0;
    }
    paintPieces();
    paintHud();
    saveSession();
    announce('已撤销一步。');
  }

  function resetLevel() {
    loadLevel(levelIndex);
  }

  /* ───────── 提示与演示 ───────── */

  function clearHint() {
    if (hintLayer) hintLayer.innerHTML = '';
    clearTimeout(hintTimer);
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('hint');
  }

  function showHintTarget(move) {
    clearHint();
    var idx = pieceIndexAt(move.g, move.from);
    if (idx < 0) return;
    var sh = model.shapes[idx];
    var p = xy(move.to);
    var rect = svgEl('rect', {
      'class': 'hr-hint-rect',
      x: p.x + INSET,
      y: p.y + INSET,
      width: sh.w * CELL - INSET * 2,
      height: sh.h * CELL - INSET * 2,
      rx: 7,
      ry: 7
    });
    hintLayer.appendChild(rect);
    nodes[idx].classList.add('hint');
    hintTimer = setTimeout(clearHint, 2600);
  }

  function computeSolution(done) {
    busy = true;
    app.setAttribute('aria-busy', 'true');
    showCoach('正在计算最优解…');
    setTimeout(function () {
      var res;
      try {
        res = solver.solve(model, state, metric);
      } catch (e) {
        res = { distance: Infinity, moves: [] };
      }
      busy = false;
      app.removeAttribute('aria-busy');
      done(res);
    }, 40);
  }

  function hint() {
    if (!model || finished || busy) return;
    stopDemo();
    computeSolution(function (res) {
      if (!isFinite(res.distance)) {
        showCoach('这个局面在「' + metricDef(metric).name + '」下没有找到出口路径。');
        return;
      }
      if (res.distance === 0) { win(); return; }
      var move = res.moves[0];
      var desc = solver.describe(model, move);
      showHintTarget(move);
      showCoach('提示（' + metricDef(metric).name + '）：' + desc.text + '。还剩 ' + res.distance + ' 步。', true);
      announce('提示：' + desc.text + '。按' + metricDef(metric).name + '还剩 ' + res.distance + ' 步。');
    });
  }

  function stopDemo() {
    if (demoTimer) {
      clearTimeout(demoTimer);
      demoTimer = null;
    }
    demoMode = false;
    demoQueue = [];
    if (elBtnDemo) elBtnDemo.textContent = '演示';
    paintPieces();
  }

  function playRoute(move, done) {
    var idx = pieceIndexAt(move.g, move.from);
    if (idx < 0 || !nodes[idx]) {
      applyMove(move, { demo: true });
      done();
      return;
    }
    var node = nodes[idx];
    var route = move.route || [move.to];
    var k = 0;
    (function step() {
      if (!demoMode) return;
      if (k >= route.length) {
        applyMove(move, { demo: true });
        done();
        return;
      }
      var p = xy(route[k]);
      k++;
      node.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px)';
      demoTimer = setTimeout(step, 38);
    })();
  }

  function playDemoNext() {
    if (!demoMode) return;
    if (!demoQueue.length) {
      demoMode = false;
      if (elBtnDemo) elBtnDemo.textContent = '演示';
      return;
    }
    var move = demoQueue.shift();
    playRoute(move, function () {
      demoTimer = setTimeout(playDemoNext, 26);
    });
  }

  function demo() {
    if (!model || finished || busy) return;
    if (demoMode) {
      stopDemo();
      showToast('演示已停止');
      return;
    }
    computeSolution(function (res) {
      if (!isFinite(res.distance) || !res.moves.length) {
        showToast('没有找到可演示的路径');
        return;
      }
      demoMode = true;
      demoPlayed = true;
      demoQueue = res.moves.slice();
      if (elBtnDemo) elBtnDemo.textContent = '停止';
      showCoach('演示中 · ' + metricDef(metric).name + ' ' + res.distance + ' 步。再点「停止」可中断。', true);
      announce('开始演示，' + metricDef(metric).name + '共 ' + res.distance + ' 步。');
      playDemoNext();
    });
  }

  /* ───────── 胜利 ───────── */

  function starsFor(L) {
    if (metrics.straight <= L.optimal.straight) return 3;
    if (metrics.straight <= L.stars.two) return 2;
    return 1;
  }

  function fillWin(L, wasDemo) {
    var stars = starsFor(L);
    if (elWinChapter) elWinChapter.textContent = L.chapter;
    if (elWinTitle) elWinTitle.textContent = '曹操已到出口';
    if (elWinStars) {
      elWinStars.innerHTML = [0, 1, 2].map(function (i) {
        return '<span class="' + (i < stars ? 'on' : '') + '">★</span>';
      }).join('');
    }
    if (elWinLines) {
      elWinLines.innerHTML = DATA.metrics.map(function (m) {
        return '<div class="hr-win-line"><span>' + m.name + '</span>' +
          '<b>' + metrics[m.id] + '</b>' +
          '<i>最优 ' + L.optimal[m.id] + '</i></div>';
      }).join('');
    }
    if (elWinNote) {
      var note = wasDemo
        ? '演示完成，不计入最佳成绩。换一种口径，答案会不同。'
        : '已记入档案。换一种口径再解一次，看看三个答案。';
      elWinNote.textContent = note;
    }
    if (elWinNext) elWinNext.hidden = levelIndex >= DATA.levels.length - 1;
  }

  function win() {
    if (finished || !model || !solver.isGoal(model, state)) return;
    finished = true;
    pauseClock();
    var wasDemo = demoPlayed;
    demoPlayed = false;
    stopDemo();
    var L = level();
    if (!wasDemo) {
      var vol = volume();
      vol.progress = vol.progress || {};
      var rec = vol.progress[L.id] || { wins: 0, best: {} };
      rec.wins = (rec.wins || 0) + 1;
      rec.best = rec.best || {};
      DATA.metrics.forEach(function (m) {
        var v = metrics[m.id];
        if (rec.best[m.id] === undefined || v < rec.best[m.id]) rec.best[m.id] = v;
      });
      rec.at = new Date().toISOString();
      vol.progress[L.id] = rec;
      vol.session = null;
      STORE.save();
    } else {
      var v2 = volume();
      v2.session = null;
      STORE.save();
    }
    paintHud();
    fillWin(L, wasDemo);
    announce('曹操已到出口。直线 ' + metrics.straight + ' 步，古法 ' + metrics.finger + ' 步，单格 ' + metrics.unit + ' 步。');
    setTimeout(function () {
      if (finished) openVeil('hrVeilWin');
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
    if (demoMode) stopDemo();
    refreshLevelGrid();
    openVeil('hrVeilLevels');
  }

  function refreshLevelGrid() {
    if (!elLevelGrid) return;
    var progress = volume().progress || {};
    elLevelGrid.innerHTML = DATA.levels.map(function (L, i) {
      var rec = progress[L.id];
      var best = rec && rec.best && rec.best.straight !== undefined ? '最佳 ' + rec.best.straight + ' 步' : '尚未解开';
      return '<button class="hr-level' + (i === levelIndex ? ' current' : '') + '" type="button" data-hr-act="selectLevel" data-index="' + i + '">' +
        '<span class="hr-level-no">' + (i + 1) + '</span>' +
        '<span class="hr-level-name">' + L.name + '</span>' +
        '<span class="hr-level-sub">' + L.sub + '</span>' +
        '<span class="hr-level-best">' + best + '</span>' +
        '</button>';
    }).join('');
  }

  /* ───────── 指针拖动 ───────── */

  function boardPoint(e) {
    var pt = board.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    var ctm = board.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    return pt.matrixTransform(ctm.inverse());
  }

  function beginDrag(e) {
    if (finished || busy || demoMode) {
      if (demoMode) stopDemo();
      return;
    }
    var g = e.target.closest ? e.target.closest('.hr-piece') : null;
    if (!g) return;
    var i = Number(g.dataset.i);
    if (!nodes[i]) return;
    stopDemo();
    selectPiece(i, { focus: true });
    var p = boardPoint(e);
    drag = {
      i: i,
      node: g,
      x: p.x,
      y: p.y,
      pid: e.pointerId,
      horiz: true,
      steps: 0,
      limits: {
        up: slideFor(i, solver.DIRS[0]).length,
        down: slideFor(i, solver.DIRS[1]).length,
        left: slideFor(i, solver.DIRS[2]).length,
        right: slideFor(i, solver.DIRS[3]).length
      }
    };
    g.classList.add('dragging');
    try { g.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  }

  function moveDrag(e) {
    if (!drag || (e.pointerId !== undefined && e.pointerId !== drag.pid)) return;
    var p = boardPoint(e);
    var dx = p.x - drag.x;
    var dy = p.y - drag.y;
    var horiz = Math.abs(dx) >= Math.abs(dy);
    var raw = horiz ? dx : dy;
    var steps = Math.round(raw / CELL);
    var maxPos = horiz ? drag.limits.right : drag.limits.down;
    var maxNeg = horiz ? drag.limits.left : drag.limits.up;
    steps = clamp(steps, -maxNeg, maxPos);
    drag.steps = steps;
    drag.horiz = horiz;
    var base = xy(state[drag.i]);
    var ox = horiz ? steps * CELL : 0;
    var oy = horiz ? 0 : steps * CELL;
    drag.node.style.transform = 'translate(' + (base.x + ox) + 'px,' + (base.y + oy) + 'px)';
    e.preventDefault();
  }

  function endDrag(e) {
    if (!drag) return;
    if (e.pointerId !== undefined && e.pointerId !== drag.pid) return;
    var d = drag;
    drag = null;
    d.node.classList.remove('dragging');
    if (d.steps !== 0) {
      var dirId = d.horiz ? (d.steps > 0 ? 'right' : 'left') : (d.steps > 0 ? 'down' : 'up');
      var dir = null;
      for (var k = 0; k < solver.DIRS.length; k++) {
        if (solver.DIRS[k].id === dirId) { dir = solver.DIRS[k]; break; }
      }
      var route = dir ? slideFor(d.i, dir) : [];
      var n = Math.min(Math.abs(d.steps), route.length);
      if (n > 0) {
        applyMove({
          g: model.groupOf[d.i],
          from: state[d.i],
          to: route[n - 1],
          cells: n,
          dir: dir.id,
          route: route.slice(0, n)
        });
        return;
      }
    }
    paintPieces();
  }

  /* ───────── 键盘 ───────── */

  var KEY_DIR = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right'
  };

  function onPieceKey(e) {
    var g = e.target.closest ? e.target.closest('.hr-piece') : null;
    if (!g) return;
    var i = Number(g.dataset.i);
    if (KEY_DIR[e.key]) {
      e.preventDefault();
      e.stopPropagation();
      movePiece(i, KEY_DIR[e.key], e.shiftKey);
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      selectPiece(i, { focus: false });
    }
  }

  function globalKey(e) {
    if (!JW.hub || JW.hub.active() !== 'huarong' || JW.hub.isOpen()) return;
    if (modeRef.current === 'digital') return;
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
    else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); resetLevel(); }
    else if (e.key === 'h' || e.key === 'H') { e.preventDefault(); hint(); }
    else if (e.key === 'a' || e.key === 'A') { e.preventDefault(); demo(); }
    else if (e.key === 'l' || e.key === 'L') { e.preventDefault(); openLevels(); }
    else if (e.key === 'c' || e.key === 'C') { e.preventDefault(); toggleContrast(); }
    else if (e.key === '?' || (e.key === '/' && e.shiftKey)) { e.preventDefault(); openVeil('hrVeilHelp'); }
  }

  function toggleContrast() {
    var on = document.documentElement.classList.toggle('hc');
    STORE.settings().contrast = on;
    STORE.save();
    showToast(on ? '高对比已开' : '高对比已关');
    announce(on ? '高对比已开。' : '高对比已关。');
  }

  function setMetric(id) {
    if (!metricDef(id) || metricDef(id).id !== id) return;
    metric = id;
    STORE.settings().huarongMetric = id;
    STORE.save();
    paintHud();
    showToast('提示与演示按「' + metricDef(id).name + '」计算');
    announce('当前口径：' + metricDef(id).name + '。');
  }

  /* ───────── 木局 / 数局 ───────── */

  function modeFromUrl() {
    try {
      var params = new URLSearchParams(global.location.search || '');
      var q = params.get('mode');
      if (q === 'digital' || q === 'wood') return q;
    } catch (e) {}
    var s = STORE.settings().huarongMode;
    return s === 'digital' ? 'digital' : 'wood';
  }

  function paintModeButtons() {
    var list = app.querySelectorAll('[data-hr-mode]');
    for (var i = 0; i < list.length; i++) {
      list[i].setAttribute('aria-pressed', list[i].getAttribute('data-hr-mode') === mode ? 'true' : 'false');
    }
  }

  function setMode(next, opts) {
    next = next === 'digital' ? 'digital' : 'wood';
    if (next === mode) {
      paintModeButtons();
      return;
    }
    if (mode === 'wood') {
      stopDemo();
      closeAllVeils();
      pauseClock();
      saveSession();
    } else if (NS.digital && NS.digital.pause) {
      NS.digital.pause();
    }

    mode = next;
    modeRef.current = next;
    app.setAttribute('data-mode', next);
    paintModeButtons();
    STORE.settings().huarongMode = next;
    STORE.save();
    hideCoach();

    if (next === 'digital') {
      closeAllVeils();
      if (NS.digital && NS.digital.activate) NS.digital.activate();
      announce('已切换到数局。');
    } else {
      closeAllVeils();
      enterFromHub();
      announce('已切换到木局。');
    }
  }

  /* ───────── 事件 ───────── */

  // 弹层会被移到 body 下，点击统一在 document 上委托，只处理卷二自己的属性。
  document.addEventListener('click', function (e) {
    if (!JW.hub || JW.hub.active() !== 'huarong' || JW.hub.isOpen()) return;
    var modeBtn = e.target.closest ? e.target.closest('[data-hr-mode]') : null;
    if (modeBtn) {
      setMode(modeBtn.getAttribute('data-hr-mode'));
      return;
    }
    var metricBtn = e.target.closest ? e.target.closest('[data-hr-metric]') : null;
    if (metricBtn) {
      if (mode === 'digital') return;
      setMetric(metricBtn.getAttribute('data-hr-metric'));
      return;
    }
    var levelBtn = e.target.closest ? e.target.closest('[data-hr-act="selectLevel"]') : null;
    if (levelBtn) {
      if (mode === 'digital') return;
      loadLevel(Number(levelBtn.dataset.index));
      return;
    }
    var btn = e.target.closest ? e.target.closest('[data-hr-act]') : null;
    if (!btn) return;
    var act = btn.getAttribute('data-hr-act');
    if (mode === 'digital' && NS.digital && NS.digital.handleAction && NS.digital.handleAction(act)) return;
    if (act === 'undo') undo();
    else if (act === 'reset') resetLevel();
    else if (act === 'hint') hint();
    else if (act === 'demo') demo();
    else if (act === 'levels') openLevels();
    else if (act === 'help') openVeil('hrVeilHelp');
    else if (act === 'closeVeil') closeVeil(btn.getAttribute('data-veil'));
    else if (act === 'closeWin') closeVeil('hrVeilWin');
    else if (act === 'winAgain') { closeVeil('hrVeilWin'); loadLevel(levelIndex); }
    else if (act === 'winNext') { closeVeil('hrVeilWin'); loadLevel(levelIndex + 1); }
    else if (act === 'contrast') toggleContrast();
  });

  app.addEventListener('keydown', function (e) {
    if (mode === 'digital') return;
    if (e.target.closest && e.target.closest('.hr-piece')) onPieceKey(e);
  });

  document.addEventListener('keydown', globalKey);

  if (board) {
    board.addEventListener('pointerdown', beginDrag);
    window.addEventListener('pointermove', moveDrag, { passive: false });
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    board.addEventListener('focusin', function (e) {
      var g = e.target.closest ? e.target.closest('.hr-piece') : null;
      if (g) selectPiece(Number(g.dataset.i), { focus: false });
    });
  }

  document.addEventListener('visibilitychange', function () {
    if (JW.hub && JW.hub.active() !== 'huarong') return;
    if (mode === 'digital') return;
    if (document.hidden) {
      stopDemo();
      pauseClock();
      saveSession();
    } else if (!finished && !JW.hub.isOpen()) {
      if (totalMoves() > 0) startClock();
    }
  });

  /* ───────── 对外接口 ───────── */

  function enterFromHub() {
    if (modeRef.current === 'digital' && NS.digital && NS.digital.activate) {
      NS.digital.activate();
      return;
    }
    if (!model) boot();
    if (!finished && totalMoves() > 0) startClock();
    if (topVeil()) return;
    if (nodes[selected]) {
      try { nodes[selected].focus({ preventScroll: true }); } catch (e) {}
    }
    if (totalMoves() === 0) {
      showCoach('拖动木块，或聚焦后按方向键。把曹操移到底部中央的出口。', true);
    }
  }

  function pauseForHub() {
    stopDemo();
    closeAllVeils();
    pauseClock();
    saveSession();
    if (modeRef.current === 'digital' && NS.digital && NS.digital.pause) NS.digital.pause();
  }

  function loadSettings() {
    var s = STORE.settings();
    if (s.huarongMetric && metricDef(s.huarongMetric).id === s.huarongMetric) metric = s.huarongMetric;
    if (s.contrast) document.documentElement.classList.add('hc');
  }

  // 弹层移到 body 下：.app 在弹层打开时整体 inert，弹层本身不能被一起冻住。
  ['hrVeilLevels', 'hrVeilHelp', 'hrVeilWin'].forEach(function (id) {
    var veil = document.getElementById(id);
    if (veil) {
      veil.classList.add('hr-veil');
      document.body.appendChild(veil);
    }
  });

  buildMetrics();
  loadSettings();
  mode = modeFromUrl();
  modeRef.current = mode;
  app.setAttribute('data-mode', mode);
  paintModeButtons();
  STORE.settings().huarongMode = mode;
  STORE.save();
  boot();
  paintHud();

  NS.id = 'huarong';
  NS.title = '华容道';
  NS.subtitle = '搜索';
  NS.status = 'ready';
  NS.storage = 'jiewu.v2 / volumes.huarong';
  NS.levels = DATA.levels;
  NS.levelCount = DATA.levels.length;
  NS.levelName = function (i) { return DATA.levels[i] ? DATA.levels[i].name : ''; };
  NS.enter = enterFromHub;
  NS.pause = pauseForHub;
  NS.setMode = setMode;
  NS.modeName = function () { return mode; };
  NS.toggleContrast = toggleContrast;

  window.__huarong = {
    get levelIndex() { return levelIndex; },
    get level() { return level(); },
    get state() { return state.slice(); },
    get metrics() { return cloneMetrics(); },
    get optimal() { return level().optimal; },
    get historyLength() { return history.length; },
    get busy() { return busy; },
    get demoing() { return demoMode; },
    get finished() { return finished; },
    get mode() { return mode; },
    model: function () { return model; },
    loadLevel: loadLevel,
    reset: resetLevel,
    undo: undo,
    movePiece: movePiece,
    apply: applyMove,
    solve: function (m) { return solver.solve(model, state, m || metric); },
    hint: hint,
    demo: demo,
    setMode: setMode,
    enter: enterFromHub,
    pause: pauseForHub
  };

  document.dispatchEvent(new CustomEvent('jiewu:huarong-ready'));
})(window);
