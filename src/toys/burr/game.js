/*
 * 解物 · 卷四 鲁班锁
 *
 * 真 3D：Canvas 2D 自写正交投影、面法线着色、画家算法与屏幕面片拾取。
 * 木条只沿 x / y / z 三轴平移，不旋转；拆下后进入右下零件盘。
 *
 * 数据在 data/burr.js，纯几何在 toys/burr/geometry.js；
 * 本文件只做渲染、拖动、键盘、存档、弹层与演示。
 */
(function (global) {
  'use strict';

  var JW = global.JW || (global.JW = {});
  JW.toys = JW.toys || {};
  var NS = JW.toys.burr = JW.toys.burr || {};
  var GEO = NS.geometry;
  var DATA = JW.data.burr;

  var app = document.getElementById('appBurr');
  if (!app || !GEO || !DATA) return;

  var STORE = JW.core.store;

  var DIS = 'dis';
  var ASM = 'asm';
  var THRESHOLD = DATA.threshold || 5;
  var D2R = Math.PI / 180;
  var R2D = 180 / Math.PI;

  var canvas = document.getElementById('burrBoard');
  var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;

  var elCoach = document.getElementById('burrCoach');
  var elCoachMsg = document.getElementById('burrCoachMsg');
  var elToast = document.getElementById('burrToast');
  var elSr = document.getElementById('burrSr');
  var elChapter = document.getElementById('burrChapter');
  var elName = document.getElementById('burrName');
  var elSub = document.getElementById('burrSub');
  var elDoneLabel = document.getElementById('burrDoneLabel');
  var elDone = document.getElementById('burrDone');
  var elMoves = document.getElementById('burrMoves');
  var elTime = document.getElementById('burrTime');
  var elBest = document.getElementById('burrBest');
  var elGoal = document.getElementById('burrGoal');
  var elLevelGrid = document.getElementById('burrLevelGrid');
  var elBtnDemo = document.getElementById('burrBtnDemo');
  var elBtnHold = document.getElementById('burrBtnHold');
  var elModeBadge = document.getElementById('burrModeBadge');
  var elTray = document.getElementById('burrTray');
  var elTrayTitle = document.getElementById('burrTrayTitle');
  var elTrayCount = document.getElementById('burrTrayCount');
  var elTrayList = document.getElementById('burrTrayList');
  var elWinChapter = document.getElementById('burrWinChapter');
  var elWinTitle = document.getElementById('burrWinTitle');
  var elWinMoves = document.getElementById('burrWinMoves');
  var elWinTime = document.getElementById('burrWinTime');
  var elWinSub = document.getElementById('burrWinSub');
  var elWinNote = document.getElementById('burrWinNote');
  var elWinNext = document.getElementById('burrWinNext');

  var levelIndex = 0;
  var mode = DIS;
  var offsets = {};
  var removed = {};
  var locked = {};
  var moves = 0;
  var elapsed = 0;
  var clockStart = 0;
  var clockPaused = true;
  var clockTimer = null;
  var finished = false;
  var selected = null;
  var held = null;
  var hoverId = null;
  var history = [];
  var winTimer = null;
  var demoMode = false;
  var demoPlayed = false;
  var demoTimer = null;
  var demoSnapshot = null;
  var demoIndex = 0;
  var demoPath = null;
  var hintId = null;
  var hintTimer = null;
  var toastTimer = null;
  var coachTimer = null;
  var drag = null;
  var lastBlockAt = 0;

  var yaw = -45 * D2R;
  var pitch = 36 * D2R;
  var viewTween = null;
  var reduceMotion = false;
  var viewW = 1;
  var viewH = 1;
  var dpr = 1;
  var lastFaces = [];
  var currentView = null;
  var paintRaf = 0;

  var FACE_DEFS = [
    { n: [1, 0, 0], v: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
    { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
    { n: [0, 1, 0], v: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
    { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
    { n: [0, 0, -1], v: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] }
  ];

  var DIR_NAMES = ['+x', '-x', '+y', '-y', '+z', '-z'];
  var DIR_MAP = {
    '+x': [1, 0, 0], '-x': [-1, 0, 0],
    '+y': [0, 1, 0], '-y': [0, -1, 0],
    '+z': [0, 0, 1], '-z': [0, 0, -1]
  };

  var LIGHT = (function () {
    var v = [-0.42, -0.58, 0.86];
    var len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return [v[0] / len, v[1] / len, v[2] / len];
  })();

  var colorCache = {};
  Object.keys(DATA.pieceById).forEach(function (id) {
    colorCache[id] = DATA.pieceById[id].color || '#a97a45';
  });

  function $(id) { return document.getElementById(id); }

  function level() { return DATA.levels[levelIndex]; }

  function pieceById(id) { return DATA.pieceById[id]; }

  function levelPieces() {
    var L = level();
    if (!L) return [];
    var out = [];
    L.pieces.forEach(function (id) {
      var p = DATA.pieceById[id];
      if (p) out.push(p);
    });
    return out;
  }

  function pieceName(id) {
    var p = pieceById(id);
    return p ? p.name : id;
  }

  function stateObj() {
    return { offsets: offsets, removed: removed, locked: locked };
  }

  function now() {
    return (global.performance && global.performance.now) ? global.performance.now() : Date.now();
  }

  function fmtTime(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(s / 60);
    s = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function currentElapsed() {
    return elapsed + (clockPaused ? 0 : now() - clockStart);
  }

  function paintTime() {
    if (elTime) elTime.textContent = fmtTime(currentElapsed());
  }

  function startClock() {
    if (!clockPaused || finished || demoMode) return;
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
    }, 1900);
  }

  function showCoach(text, sticky) {
    if (!elCoach || !elCoachMsg) return;
    elCoachMsg.textContent = text;
    elCoach.hidden = false;
    clearTimeout(coachTimer);
    coachTimer = setTimeout(function () {
      if (elCoach) elCoach.hidden = true;
    }, sticky ? 14000 : 5600);
  }

  function hideCoach() {
    if (elCoach) elCoach.hidden = true;
    clearTimeout(coachTimer);
  }

  function volume() {
    return STORE.volume('burr');
  }

  function progressOf(id) {
    var vol = volume();
    return vol && vol.progress ? vol.progress[id] : null;
  }

  function modeRecord(id, m) {
    var rec = progressOf(id);
    if (!rec || !rec.modes) return null;
    return rec.modes[m] || null;
  }

  function bestText(id, m) {
    var rec = modeRecord(id, m);
    if (!rec || rec.bestMoves == null) return '—';
    return rec.bestMoves + ' 步';
  }

  function countDone() {
    var n = 0;
    level().pieces.forEach(function (id) {
      if (mode === DIS ? removed[id] : locked[id]) n += 1;
    });
    return n;
  }

  function allRemoved() {
    var L = level();
    for (var i = 0; i < L.pieces.length; i++) {
      if (!removed[L.pieces[i]]) return false;
    }
    return true;
  }

  function allLocked() {
    var L = level();
    for (var i = 0; i < L.pieces.length; i++) {
      if (!locked[L.pieces[i]]) return false;
    }
    return true;
  }

  function checkWin() {
    return mode === DIS ? allRemoved() : allLocked();
  }

  function firstRemaining() {
    var L = level();
    for (var i = 0; i < L.pieces.length; i++) {
      var id = L.pieces[i];
      if (mode === DIS ? !removed[id] : !locked[id]) return id;
    }
    return null;
  }

  function firstSelectable() {
    return firstRemaining() || (level() && level().pieces[0]) || null;
  }

  function isInteractive(el) {
    return !!(el && el.closest && el.closest('button, a, input, select, textarea, summary'));
  }

  /* ───────── 存档 ───────── */

  function saveSession() {
    if (demoMode) return;
    var vol = volume();
    if (!vol) return;
    if (finished || (moves === 0 && currentElapsed() < 1000 && mode === DIS)) {
      vol.session = null;
    } else {
      vol.session = {
        levelIndex: levelIndex,
        mode: mode,
        offsets: GEO.cloneOffsets(offsets),
        removed: GEO.cloneFlags(removed),
        locked: GEO.cloneFlags(locked),
        moves: moves,
        elapsed: Math.round(currentElapsed()),
        at: new Date().toISOString()
      };
    }
    STORE.save();
  }

  function validSession(s) {
    if (!s || typeof s !== 'object') return false;
    if (!DATA.levels[s.levelIndex]) return false;
    if (s.mode !== DIS && s.mode !== ASM) return false;
    var L = DATA.levels[s.levelIndex];
    if (!GEO.validateOffsets(L, s.offsets)) return false;
    return true;
  }

  function restoreSession(s) {
    var L = DATA.levels[s.levelIndex];
    levelIndex = s.levelIndex;
    mode = s.mode;
    offsets = GEO.cloneOffsets(s.offsets);
    removed = {};
    locked = {};
    L.pieces.forEach(function (id) {
      if (mode === DIS) {
        removed[id] = !!(s.removed && s.removed[id]);
        locked[id] = false;
      } else {
        locked[id] = !!(s.locked && s.locked[id]);
        removed[id] = false;
        if (locked[id] && !GEO.sameOffset(offsets[id], [0, 0, 0])) locked[id] = false;
      }
    });
    moves = Math.max(0, Number(s.moves) || 0);
    elapsed = Math.max(0, Number(s.elapsed) || 0);
    finished = false;
    demoMode = false;
    demoPlayed = false;
    demoSnapshot = null;
    history = [];
    held = null;
    hintId = null;
    selected = firstSelectable();
    clockPaused = true;
    paintAll();
    paintTime();
  }

  function boot() {
    var s = volume() && volume().session;
    if (validSession(s)) {
      restoreSession(s);
      return;
    }
    loadLevel(0, { mode: DIS, silent: true, noSave: true });
  }

  /* ───────── 关卡 ───────── */

  function resetBoard() {
    var L = level();
    offsets = {};
    removed = {};
    locked = {};
    L.pieces.forEach(function (id) {
      if (mode === ASM) {
        var st = L.stage && L.stage[id] ? L.stage[id] : [0, 0, 0];
        offsets[id] = [st[0], st[1], st[2]];
      } else {
        offsets[id] = [0, 0, 0];
      }
      removed[id] = false;
      locked[id] = false;
    });
  }

  function clearWinTimer() {
    if (winTimer) {
      clearTimeout(winTimer);
      winTimer = null;
    }
  }

  function loadLevel(index, opts) {
    opts = opts || {};
    if (!DATA.levels[index]) return;
    if (demoMode) stopDemo({ restore: false });
    closeAllVeils();
    pauseClock();
    clearWinTimer();
    levelIndex = index;
    if (opts.mode === DIS || opts.mode === ASM) mode = opts.mode;
    resetBoard();
    moves = 0;
    elapsed = 0;
    finished = false;
    demoPlayed = false;
    history = [];
    held = null;
    hintId = null;
    drag = null;
    selected = firstSelectable();
    clockPaused = true;
    paintAll();
    if (!opts.noSave) saveSession();
    if (!opts.silent) {
      var L = level();
      announce('已载入「' + L.name + '」，' + (mode === DIS ? '拆' : '装') + '模式。' + L.sub + '。');
      showCoach('「' + L.name + '」：' + L.note, true);
      if (opts.focus !== false) focusCanvas();
    }
  }

  function resetLevel() {
    loadLevel(levelIndex, { mode: mode });
  }

  function setMode(next, opts) {
    opts = opts || {};
    if (next !== DIS && next !== ASM) return;
    if (next === mode && !opts.force) return;
    if (demoMode) stopDemo({ restore: false });
    mode = next;
    loadLevel(levelIndex, { mode: next, silent: !!opts.silent });
    if (!opts.silent) {
      showToast(mode === DIS ? '拆：把木条逐根抽出，进入零件盘。' : '装：把散开的木条逐根推回中心。');
      announce(mode === DIS ? '已切到拆模式。' : '已切到装模式。');
    }
  }

  function toggleMode() {
    setMode(mode === DIS ? ASM : DIS);
  }

  /* ───────── 步进与撤销 ───────── */

  function snapshot() {
    return {
      offsets: GEO.cloneOffsets(offsets),
      removed: GEO.cloneFlags(removed),
      locked: GEO.cloneFlags(locked),
      moves: moves
    };
  }

  function pushHistory(snap) {
    history.push(snap);
    if (history.length > 200) history.shift();
  }

  function dirNameOf(dir) {
    for (var i = 0; i < DIR_NAMES.length; i++) {
      var d = DIR_MAP[DIR_NAMES[i]];
      if (d[0] === dir[0] && d[1] === dir[1] && d[2] === dir[2]) return DIR_NAMES[i];
    }
    return '?';
  }

  function blockedMessage(id, res, dirName) {
    var n = pieceName(id);
    if (res.reason === 'removed') return '「' + n + '」已在零件盘。';
    if (res.reason === 'locked') return '「' + n + '」已归位锁定。';
    if (res.reason === 'edge') return '「' + n + '」已到棋盘边缘，不能沿 ' + dirName + ' 再走。';
    if (res.reason === 'blocked') {
      return '「' + n + '」被「' + pieceName(res.by) + '」挡住，不能沿 ' + dirName + ' 移动。';
    }
    return '「' + n + '」不能沿 ' + dirName + ' 移动。';
  }

  function sayBlocked(id, res, dirName, opts) {
    var msg = blockedMessage(id, res, dirName);
    if (opts && opts.quiet) return;
    var t = now();
    if (t - lastBlockAt < 420) return;
    lastBlockAt = t;
    showToast(msg);
    announce(msg);
  }

  function maybeWin() {
    if (finished || !checkWin()) return;
    if (winTimer) return;
    winTimer = setTimeout(function () {
      winTimer = null;
      if (!finished && checkWin()) win();
    }, 260);
  }

  function autoRemoveLast() {
    if (mode !== DIS) return false;
    var L = level();
    var left = [];
    L.pieces.forEach(function (id) {
      if (!removed[id]) left.push(id);
    });
    if (left.length !== 1) return false;
    var id = left[0];
    removed[id] = true;
    announce('「' + pieceName(id) + '」已失去支撑，自动拆下。');
    return true;
  }

  function tryStep(id, dir, opts) {
    opts = opts || {};
    if (!level() || finished) return false;
    var delta = Array.isArray(dir) ? dir : DIR_MAP[dir];
    if (!delta) return false;
    var res = GEO.canStep(levelPieces(), stateObj(), id, delta, { bound: 12 });
    if (!res.ok) {
      sayBlocked(id, res, dirNameOf(delta), opts);
      return false;
    }
    if (!opts.demo) pushHistory(snapshot());
    offsets[id] = res.off;
    moves += 1;

    var removedNow = false;
    var lockedNow = false;
    if (mode === DIS) {
      if (GEO.isOut(res.off, THRESHOLD)) {
        removed[id] = true;
        removedNow = true;
      }
    } else if (GEO.sameOffset(res.off, [0, 0, 0])) {
      locked[id] = true;
      lockedNow = true;
    }

    if (!opts.demo) {
      demoPlayed = false;
      clearHint();
      if (removedNow) {
        announce('「' + pieceName(id) + '」已拆下，进入零件盘。');
        autoRemoveLast();
      } else if (lockedNow) {
        announce('「' + pieceName(id) + '」已归位锁定。');
      } else if (!opts.quiet) {
        announce('「' + pieceName(id) + '」沿 ' + dirNameOf(delta) + ' 移动一格，第 ' + moves + ' 步。');
      }
      if (removedNow || lockedNow) {
        selected = firstRemaining() || id;
      } else {
        selected = id;
      }
      if (clockPaused) startClock();
      paintAll();
      saveSession();
      maybeWin();
    } else {
      if (removedNow || lockedNow) {
        selected = firstRemaining() || id;
      } else {
        selected = id;
      }
      paintAll();
    }
    return true;
  }

  function stepSelected(dir) {
    if (demoMode) stopDemo();
    if (!selected) {
      showToast('先用 Tab 选一根木条');
      announce('先用 Tab 选一根木条。');
      return;
    }
    if (finished) return;
    tryStep(selected, dir, { quiet: false });
  }

  function undo() {
    if (demoMode) stopDemo();
    if (!history.length) {
      showToast('没有可撤销的走法');
      announce('没有可撤销的走法。');
      return;
    }
    clearWinTimer();
    var snap = history.pop();
    offsets = GEO.cloneOffsets(snap.offsets);
    removed = GEO.cloneFlags(snap.removed);
    locked = GEO.cloneFlags(snap.locked);
    moves = snap.moves;
    finished = false;
    held = null;
    hintId = null;
    closeAllVeils();
    selected = firstSelectable();
    paintAll();
    saveSession();
    announce('已撤销一步。');
  }

  /* ───────── 提示 ───────── */

  function clearHint() {
    hintId = null;
    if (hintTimer) {
      clearTimeout(hintTimer);
      hintTimer = null;
    }
  }

  function showHintFor(id, text) {
    hintId = id;
    selected = id;
    paintAll();
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(function () {
      hintId = null;
      hintTimer = null;
      paint();
    }, 4200);
    showCoach(text, true);
    announce(text);
  }

  function hint() {
    if (demoMode) stopDemo();
    if (finished) {
      showToast('本关已完成，先重置或换一关');
      return;
    }
    clearHint();
    var L = level();
    if (mode === DIS) {
      var pick = null;
      for (var i = 0; i < L.pullOrder.length; i++) {
        if (!removed[L.pullOrder[i]]) { pick = L.pullOrder[i]; break; }
      }
      if (!pick) pick = firstRemaining();
      if (!pick) {
        showToast('已经全部拆下');
        announce('已经全部拆下。');
        return;
      }
      var p = pieceById(pick);
      var dir = (p && p.pull) || [0, 0, 1];
      var res = GEO.canStep(levelPieces(), stateObj(), pick, dir, { bound: 12 });
      if (!res.ok) {
        showToast('「' + pieceName(pick) + '」暂时被挡住，先看看别的木条');
        announce('「' + pieceName(pick) + '」暂时被挡住。');
        return;
      }
      showHintFor(pick, '提示：选中「' + pieceName(pick) + '」，沿 ' + dirNameOf(dir) +
        ' 拉出；偏移达到 ' + THRESHOLD + ' 格就进入零件盘。');
      return;
    }

    var order = L.assembleOrder || L.pieces;
    var id = null;
    for (var k = 0; k < order.length; k++) {
      if (!locked[order[k]]) { id = order[k]; break; }
    }
    if (!id) {
      showToast('所有木条都已归位');
      announce('所有木条都已归位。');
      return;
    }
    var path = GEO.pathToTarget(levelPieces(), stateObj(), id, [0, 0, 0], { pad: 2 });
    var text = '提示：把「' + pieceName(id) + '」推回中心';
    if (path && path.length) {
      var cur = offsets[id] || [0, 0, 0];
      var next = path[0];
      var step = [next[0] - cur[0], next[1] - cur[1], next[2] - cur[2]];
      text += '，下一步沿 ' + dirNameOf(step) + ' 移动一格';
    }
    text += '；归到 (0,0,0) 即锁定。';
    showHintFor(id, text);
  }

  /* ───────── 演示 ───────── */

  function demoStartState() {
    resetBoard();
    moves = 0;
    elapsed = 0;
    clockPaused = true;
    demoIndex = 0;
    demoPath = null;
    history = [];
    held = null;
    hintId = null;
    selected = firstSelectable();
    paintAll();
  }

  function startDemo() {
    if (finished) {
      showToast('本关已完成，先重置或换一关');
      return;
    }
    if (demoMode) {
      stopDemo();
      return;
    }
    var before = {
      offsets: GEO.cloneOffsets(offsets),
      removed: GEO.cloneFlags(removed),
      locked: GEO.cloneFlags(locked),
      moves: moves,
      elapsed: currentElapsed(),
      selected: selected,
      held: held,
      history: history.slice()
    };
    pauseClock();
    closeAllVeils();
    clearHint();
    demoSnapshot = before;
    demoMode = true;
    demoPlayed = true;
    demoStartState();
    if (elBtnDemo) elBtnDemo.textContent = '停止';
    showCoach(mode === DIS ? '演示：从装配态开始，按标准拆序逐根抽出。' : '演示：从散开位开始，按逆序逐根归位。', true);
    announce('开始演示，' + (mode === DIS ? '拆解' : '装配') + '。');
    if (mode === DIS) demoTickDis();
    else demoTickAsm();
  }

  function demoTickDis() {
    demoTimer = null;
    if (!demoMode) return;
    if (allRemoved()) { finishDemo(); return; }
    var L = level();
    var plan = L.pullOrder || L.pieces.slice();
    while (demoIndex < plan.length && removed[plan[demoIndex]]) demoIndex++;
    var id = demoIndex < plan.length ? plan[demoIndex] : firstRemaining();
    if (!id) { finishDemo(); return; }
    var p = pieceById(id);
    var dir = (p && p.pull) || [0, 0, 1];
    var ok = tryStep(id, dir, { demo: true, quiet: true });
    if (!ok) {
      var any = GEO.anyMove(levelPieces(), stateObj(), { bound: 12 });
      if (!any) { finishDemo(); return; }
      id = any.id;
      ok = tryStep(id, any.dir, { demo: true, quiet: true });
      if (!ok) { finishDemo(); return; }
    }
    if (removed[id]) demoIndex++;
    if (allRemoved()) { finishDemo(); return; }
    demoTimer = setTimeout(demoTickDis, 105);
  }

  function demoTickAsm() {
    demoTimer = null;
    if (!demoMode) return;
    if (allLocked()) { finishDemo(); return; }
    var L = level();
    var plan = L.assembleOrder || L.pieces.slice();
    while (demoIndex < plan.length && locked[plan[demoIndex]]) demoIndex++;
    var id = demoIndex < plan.length ? plan[demoIndex] : firstRemaining();
    if (!id) { finishDemo(); return; }
    if (!demoPath || !demoPath.steps || demoPath.steps.length === 0 || demoPath.id !== id) {
      var path = GEO.pathToTarget(levelPieces(), stateObj(), id, [0, 0, 0], { pad: 2 });
      demoPath = null;
      if (!path || !path.length) {
        if (GEO.sameOffset(offsets[id], [0, 0, 0])) {
          locked[id] = true;
          demoIndex++;
          paintAll();
          demoTimer = setTimeout(demoTickAsm, 80);
          return;
        }
        demoIndex++;
        demoTimer = setTimeout(demoTickAsm, 40);
        return;
      }
      demoPath = { id: id, steps: path.slice() };
    }
    var cur = offsets[id] || [0, 0, 0];
    var next = demoPath.steps.shift();
    var step = [next[0] - cur[0], next[1] - cur[1], next[2] - cur[2]];
    tryStep(id, step, { demo: true, quiet: true });
    if (locked[id]) {
      demoIndex++;
      demoPath = null;
    }
    if (allLocked()) { finishDemo(); return; }
    demoTimer = setTimeout(demoTickAsm, 105);
  }

  function finishDemo() {
    if (demoTimer) {
      clearTimeout(demoTimer);
      demoTimer = null;
    }
    demoMode = false;
    demoSnapshot = null;
    demoPath = null;
    if (elBtnDemo) elBtnDemo.textContent = '演示';
    paintAll();
    if (checkWin()) {
      maybeWin();
    } else {
      showToast('演示结束');
      announce('演示结束。');
    }
  }

  function stopDemo(opts) {
    opts = opts || {};
    if (!demoMode) return;
    if (demoTimer) {
      clearTimeout(demoTimer);
      demoTimer = null;
    }
    demoMode = false;
    demoPath = null;
    if (elBtnDemo) elBtnDemo.textContent = '演示';
    if (opts.restore === false) {
      demoSnapshot = null;
      paintAll();
      return;
    }
    var snap = demoSnapshot;
    demoSnapshot = null;
    demoPlayed = false;
    if (snap) {
      offsets = GEO.cloneOffsets(snap.offsets);
      removed = GEO.cloneFlags(snap.removed);
      locked = GEO.cloneFlags(snap.locked);
      moves = snap.moves;
      elapsed = snap.elapsed || 0;
      selected = snap.selected;
      held = snap.held;
      history = snap.history || [];
      finished = false;
      clockPaused = true;
      paintAll();
      saveSession();
      showToast('演示已停止，已恢复演示前的局面');
      announce('演示已停止，已恢复演示前的局面。');
    } else {
      paintAll();
    }
  }

  /* ───────── 胜利 ───────── */

  function recordWin(L, total) {
    var vol = volume();
    vol.progress = vol.progress || {};
    var rec = vol.progress[L.id] || { modes: {} };
    rec.modes = rec.modes || {};
    var mr = rec.modes[mode] || { wins: 0, bestMoves: null, bestTime: null };
    mr.wins = (mr.wins || 0) + 1;
    if (mr.bestMoves == null || moves < mr.bestMoves) mr.bestMoves = moves;
    if (mr.bestTime == null || total < mr.bestTime) mr.bestTime = total;
    mr.at = new Date().toISOString();
    rec.modes[mode] = mr;
    rec.wins = (rec.wins || 0) + 1;
    rec.at = new Date().toISOString();
    vol.progress[L.id] = rec;
    vol.session = null;
    STORE.save();
  }

  function fillWin(L, wasDemo, total) {
    if (elWinChapter) elWinChapter.textContent = L.chapter + ' · ' + (mode === DIS ? '拆' : '装');
    if (elWinTitle) elWinTitle.textContent = mode === DIS ? '锁已解' : '锁已合';
    if (elWinMoves) elWinMoves.textContent = String(moves);
    if (elWinTime) elWinTime.textContent = fmtTime(total);
    if (elWinSub) {
      elWinSub.textContent = mode === DIS
        ? '木条各归零件盘，一座锁散成了 ' + L.pieces.length + ' 根。'
        : '每根木条都回到榫口，锁又合成一体。';
    }
    if (elWinNote) {
      elWinNote.textContent = wasDemo
        ? '演示完成，不计入最佳成绩。关掉弹层，自己再走一遍。'
        : '已记入档案。拆与装互为逆序，换一种模式再试。';
    }
    if (elWinNext) elWinNext.hidden = levelIndex >= DATA.levels.length - 1;
  }

  function win() {
    if (finished || !checkWin()) return;
    finished = true;
    clearWinTimer();
    pauseClock();
    var wasDemo = demoPlayed;
    demoPlayed = false;
    if (demoMode) stopDemo({ restore: false });
    var L = level();
    var total = Math.round(currentElapsed());
    if (!wasDemo) {
      recordWin(L, total);
    } else {
      var vol = volume();
      vol.session = null;
      STORE.save();
    }
    paintAll();
    fillWin(L, wasDemo, total);
    announce((mode === DIS ? '锁已解。' : '锁已合。') + '用了 ' + moves + ' 步，' + fmtTime(total) + '。');
    setTimeout(function () {
      if (finished) openVeil('burrVeilWin');
    }, 260);
  }

  /* ───────── HUD / 零件盘 ───────── */

  function paintHud() {
    var L = level();
    if (!L) return;
    if (elChapter) elChapter.textContent = L.chapter || '';
    if (elName) elName.textContent = L.name || '';
    if (elSub) elSub.textContent = L.sub || '';
    if (elMoves) elMoves.textContent = String(moves);
    if (elBest) elBest.textContent = bestText(L.id, mode);
    var done = countDone();
    if (elDoneLabel) elDoneLabel.textContent = mode === DIS ? '已拆' : '已归位';
    if (elDone) elDone.textContent = done + ' / ' + L.pieces.length;
    if (elGoal) {
      elGoal.innerHTML = mode === DIS
        ? '点选木条，沿轴拖出；<em>← →</em> 走 x 轴，<em>↑ ↓</em> 走 z 轴，<em>Shift + ↑ ↓</em> 走 y 轴。'
        : '把散开的木条逐根推回中心；偏移归零即锁定，全部归位即胜。';
    }
    if (elBtnDemo) elBtnDemo.textContent = demoMode ? '停止' : '演示';
    if (elBtnHold) elBtnHold.textContent = (held && held === selected) ? '放下' : '拿起';
    if (elModeBadge) elModeBadge.textContent = mode === DIS ? '拆' : '装';
    Array.prototype.forEach.call(app.querySelectorAll('[data-burr-act="mode"]'), function (btn) {
      var on = btn.getAttribute('data-mode') === mode;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    app.setAttribute('data-mode', mode);
    paintTime();
  }

  function chipState(id) {
    if (mode === DIS) {
      if (removed[id]) return '已拆';
      var off = offsets[id] || [0, 0, 0];
      return GEO.maxAbs(off) > 0 ? '拉出 ' + GEO.maxAbs(off) + ' 格' : '在锁';
    }
    if (locked[id]) return '已归位';
    var o = offsets[id] || [0, 0, 0];
    return GEO.sameOffset(o, [0, 0, 0]) ? '待锁定' : '归位中';
  }

  function paintTray() {
    if (!elTrayList) return;
    var L = level();
    if (!L) return;
    var done = countDone();
    if (elTrayTitle) elTrayTitle.textContent = mode === DIS ? '零件盘' : '归位架';
    if (elTrayCount) elTrayCount.textContent = done + ' / ' + L.pieces.length;
    var html = L.pieces.map(function (id) {
      var p = pieceById(id);
      var on = mode === DIS ? removed[id] : locked[id];
      return '<button type="button" class="burr-chip' + (on ? ' on' : '') + '" data-burr-pick="' + id + '"' +
        ' aria-label="' + p.name + '，' + chipState(id) + '">' +
        '<i style="background:' + (p.color || '#a97a45') + '"></i>' +
        '<span>' + p.name + '</span>' +
        '<em>' + chipState(id) + '</em>' +
        '</button>';
    }).join('');
    elTrayList.innerHTML = html;
  }

  function paintAll() {
    paintHud();
    paintTray();
    paint();
  }

  /* ───────── 几何 / 投影 ───────── */

  function basis() {
    var cp = Math.cos(pitch);
    var sp = Math.sin(pitch);
    var cy = Math.cos(yaw);
    var sy = Math.sin(yaw);
    return {
      eye: [cp * cy, cp * sy, sp],
      right: [-sy, cy, 0],
      up: [-sp * cy, -sp * sy, cp]
    };
  }

  function addCellsToBounds(cells, off, min, max) {
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      var x = c[0] + off[0];
      var y = c[1] + off[1];
      var z = c[2] + off[2];
      if (x < min[0]) min[0] = x;
      if (y < min[1]) min[1] = y;
      if (z < min[2]) min[2] = z;
      if (x + 1 > max[0]) max[0] = x + 1;
      if (y + 1 > max[1]) max[1] = y + 1;
      if (z + 1 > max[2]) max[2] = z + 1;
    }
  }

  function sceneBounds() {
    var min = [Infinity, Infinity, Infinity];
    var max = [-Infinity, -Infinity, -Infinity];
    levelPieces().forEach(function (p) {
      addCellsToBounds(p.cells, [0, 0, 0], min, max);
      addCellsToBounds(p.cells, offsets[p.id] || [0, 0, 0], min, max);
    });
    if (!isFinite(min[0])) {
      min = [0, 0, 0];
      max = [6, 6, 6];
    }
    var pad = 0.55;
    min[0] -= pad; min[1] -= pad; min[2] -= pad;
    max[0] += pad; max[1] += pad; max[2] += pad;
    return { min: min, max: max };
  }

  function buildView() {
    var cam = basis();
    var b = sceneBounds();
    var center = [
      (b.min[0] + b.max[0]) / 2,
      (b.min[1] + b.max[1]) / 2,
      (b.min[2] + b.max[2]) / 2
    ];
    var hx = Math.max(0.6, (b.max[0] - b.min[0]) / 2);
    var hy = Math.max(0.6, (b.max[1] - b.min[1]) / 2);
    var hz = Math.max(0.6, (b.max[2] - b.min[2]) / 2);
    var sx = hx * Math.abs(cam.right[0]) + hy * Math.abs(cam.right[1]) + hz * Math.abs(cam.right[2]);
    var sy = hx * Math.abs(cam.up[0]) + hy * Math.abs(cam.up[1]) + hz * Math.abs(cam.up[2]);
    var availW = Math.max(40, viewW * 0.9);
    var availH = Math.max(40, viewH * 0.86);
    var scale = Math.min(availW / (2 * Math.max(0.001, sx)), availH / (2 * Math.max(0.001, sy)));
    if (!isFinite(scale) || scale <= 0) scale = 42;
    scale = Math.min(scale, 150);
    return {
      cam: cam,
      center: center,
      scale: scale,
      cx: viewW / 2,
      cy: viewH / 2 + viewH * 0.015
    };
  }

  function projectPoint(p, view) {
    var dx = p[0] - view.center[0];
    var dy = p[1] - view.center[1];
    var dz = p[2] - view.center[2];
    var rx = view.cam.right[0] * dx + view.cam.right[1] * dy + view.cam.right[2] * dz;
    var uy = view.cam.up[0] * dx + view.cam.up[1] * dy + view.cam.up[2] * dz;
    return [view.cx + rx * view.scale, view.cy - uy * view.scale];
  }

  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  function shade(hex, k) {
    var n = parseInt(String(hex || '#a97a45').replace('#', ''), 16);
    if (!isFinite(n)) n = 0xa97a45;
    var r = (n >> 16) & 255;
    var g = (n >> 8) & 255;
    var b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r * k + 10)));
    g = Math.max(0, Math.min(255, Math.round(g * k + 7)));
    b = Math.max(0, Math.min(255, Math.round(b * k + 4)));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function pointInPoly(px, py, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1];
      var xj = poly[j][0], yj = poly[j][1];
      var hit = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / ((yj - yi) || 1e-9) + xi);
      if (hit) inside = !inside;
    }
    return inside;
  }

  function faceAt(px, py) {
    for (var i = lastFaces.length - 1; i >= 0; i--) {
      if (pointInPoly(px, py, lastFaces[i].poly)) return lastFaces[i];
    }
    return null;
  }

  function resizeCanvas() {
    if (!canvas) return false;
    var rect;
    try { rect = canvas.getBoundingClientRect(); } catch (e) { rect = null; }
    var w = rect ? rect.width : (canvas.clientWidth || 0);
    var h = rect ? rect.height : (canvas.clientHeight || 0);
    if (!w || w < 2 || !h || h < 2) {
      viewW = Math.max(1, w || 1);
      viewH = Math.max(1, h || 1);
      return false;
    }
    dpr = Math.min(global.devicePixelRatio || 1, 2.5);
    var pw = Math.max(1, Math.round(w * dpr));
    var ph = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    viewW = w;
    viewH = h;
    return true;
  }

  /* ───────── 渲染 ───────── */

  function paintBackground() {
    var g = ctx.createRadialGradient(viewW * 0.5, viewH * 0.42, 8, viewW * 0.5, viewH * 0.5, Math.max(viewW, viewH) * 0.72);
    g.addColorStop(0, 'rgba(200,160,90,.065)');
    g.addColorStop(0.55, 'rgba(200,160,90,.018)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, viewW, viewH);
  }

  function paintFaces(view) {
    var occ = GEO.occupancy(levelPieces(), stateObj(), true);
    var faces = [];
    var cam = view.cam;
    levelPieces().forEach(function (p) {
      if (removed[p.id]) return;
      var off = offsets[p.id] || [0, 0, 0];
      var isSel = p.id === selected;
      var isHint = p.id === hintId;
      var isHover = p.id === hoverId;
      for (var i = 0; i < p.cells.length; i++) {
        var c = p.cells[i];
        for (var f = 0; f < FACE_DEFS.length; f++) {
          var fd = FACE_DEFS[f];
          var nx = c[0] + fd.n[0];
          var ny = c[1] + fd.n[1];
          var nz = c[2] + fd.n[2];
          if (occ.cells[GEO.key(nx, ny, nz)]) continue;
          if (dot(fd.n, cam.eye) <= 0.0015) continue;
          var corners = fd.v;
          var poly = [];
          var cxw = 0, cyw = 0, czw = 0;
          for (var k = 0; k < 4; k++) {
            var wx = c[0] + off[0] + corners[k][0];
            var wy = c[1] + off[1] + corners[k][1];
            var wz = c[2] + off[2] + corners[k][2];
            cxw += wx; cyw += wy; czw += wz;
            poly.push(projectPoint([wx, wy, wz], view));
          }
          cxw = cxw / 4;
          cyw = cyw / 4;
          czw = czw / 4;
          var depth = dot([cxw - view.center[0], cyw - view.center[1], czw - view.center[2]], cam.eye);
          var shadeK = 0.56 + 0.52 * Math.max(0, dot(fd.n, LIGHT));
          if (isSel) shadeK += 0.1;
          if (isHint) shadeK += 0.14;
          if (isHover) shadeK += 0.045;
          faces.push({
            owner: p.id,
            poly: poly,
            depth: depth,
            fill: shade(colorCache[p.id], shadeK),
            sel: isSel || isHint,
            hint: isHint,
            hover: isHover
          });
        }
      }
    });
    faces.sort(function (a, b) { return a.depth - b.depth; });
    lastFaces = faces;
    for (var n = 0; n < faces.length; n++) {
      var face = faces[n];
      var poly = face.poly;
      ctx.beginPath();
      ctx.moveTo(poly[0][0], poly[0][1]);
      for (var q = 1; q < poly.length; q++) ctx.lineTo(poly[q][0], poly[q][1]);
      ctx.closePath();
      ctx.fillStyle = face.fill;
      ctx.fill();
      if (face.sel) {
        ctx.lineWidth = face.hint ? 1.8 : 1.25;
        ctx.strokeStyle = face.hint ? 'rgba(250,226,166,.95)' : 'rgba(244,218,158,.78)';
      } else if (face.hover) {
        ctx.lineWidth = 0.9;
        ctx.strokeStyle = 'rgba(250,236,196,.55)';
      } else {
        ctx.lineWidth = 0.7;
        ctx.strokeStyle = 'rgba(8,7,4,.55)';
      }
      ctx.stroke();
    }
  }

  function pieceCenter(id) {
    var p = pieceById(id);
    if (!p) return [0, 0, 0];
    var off = offsets[id] || [0, 0, 0];
    var x = 0, y = 0, z = 0;
    for (var i = 0; i < p.cells.length; i++) {
      x += p.cells[i][0] + off[0] + 0.5;
      y += p.cells[i][1] + off[1] + 0.5;
      z += p.cells[i][2] + off[2] + 0.5;
    }
    var n = p.cells.length || 1;
    return [x / n, y / n, z / n];
  }

  function drawArrow(view, from, to, color) {
    var a = projectPoint(from, view);
    var b = projectPoint(to, view);
    var dx = b[0] - a[0];
    var dy = b[1] - a[1];
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 5) return;
    var ux = dx / len;
    var uy = dy / len;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineWidth = 1.35;
    ctx.strokeStyle = color;
    ctx.stroke();
    var head = Math.min(8, len * 0.35);
    var px = -uy;
    var py = ux;
    ctx.beginPath();
    ctx.moveTo(b[0], b[1]);
    ctx.lineTo(b[0] - ux * head + px * head * 0.55, b[1] - uy * head + py * head * 0.55);
    ctx.lineTo(b[0] - ux * head - px * head * 0.55, b[1] - uy * head - py * head * 0.55);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function paintMoves(view) {
    if (!selected || removed[selected] || locked[selected]) return;
    var c = pieceCenter(selected);
    var p = pieceById(selected);
    var alpha = (held && held === selected) ? 0.92 : 0.62;
    for (var i = 0; i < GEO.DIRS.length; i++) {
      var d = GEO.DIRS[i];
      var res = GEO.canStep(levelPieces(), stateObj(), selected, d, { bound: 12 });
      if (!res.ok) continue;
      var to = [c[0] + d[0] * 1.45, c[1] + d[1] * 1.45, c[2] + d[2] * 1.45];
      drawArrow(view, c, to, 'rgba(243,218,160,' + alpha + ')');
      var label = projectPoint(to, view);
      ctx.font = '10px "KaiTi","STKaiti",serif';
      ctx.fillStyle = 'rgba(248,232,192,' + alpha + ')';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(DIR_NAMES[i], label[0], label[1] - 8);
    }
    if (p && p.pull) {
      /* 标准拆轴用稍亮的颜色再描一遍 */
      var res2 = GEO.canStep(levelPieces(), stateObj(), selected, p.pull, { bound: 12 });
      if (res2.ok) {
        var to2 = [c[0] + p.pull[0] * 1.8, c[1] + p.pull[1] * 1.8, c[2] + p.pull[2] * 1.8];
        drawArrow(view, c, to2, 'rgba(255,236,176,.95)');
      }
    }
  }

  function paintGizmo(view) {
    var ox = 44;
    var oy = viewH - 40;
    var base = [view.center[0], view.center[1], view.center[2]];
    var axes = [
      { v: [1, 0, 0], c: 'rgba(196,91,68,.85)', t: 'x' },
      { v: [0, 1, 0], c: 'rgba(118,158,112,.85)', t: 'y' },
      { v: [0, 0, 1], c: 'rgba(210,174,104,.9)', t: 'z' }
    ];
    ctx.save();
    ctx.font = '10px "KaiTi","STKaiti",serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < axes.length; i++) {
      var a = axes[i];
      var rx = dot(a.v, view.cam.right);
      var uy = dot(a.v, view.cam.up);
      var len = Math.sqrt(rx * rx + uy * uy);
      if (len < 0.05) continue;
      var ex = ox + (rx / len) * 22;
      var ey = oy - (uy / len) * 22;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ex, ey);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = a.c;
      ctx.stroke();
      ctx.fillStyle = a.c;
      ctx.fillText(a.t, ox + (rx / len) * 32, oy - (uy / len) * 32);
    }
    ctx.restore();
  }

  function paint() {
    if (!ctx) return;
    if (paintRaf) {
      cancelAnimationFrame(paintRaf);
      paintRaf = 0;
    }
    if (!resizeCanvas()) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewW, viewH);
    paintBackground();
    var view = buildView();
    currentView = view;
    paintFaces(view);
    paintMoves(view);
    paintGizmo(view);
  }

  function schedulePaint() {
    if (paintRaf) return;
    var raf = global.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
    paintRaf = raf(function () {
      paintRaf = 0;
      paint();
    });
  }

  /* ───────── 视角 ───────── */

  function clampPitch() {
    var lo = 6 * D2R;
    var hi = 78 * D2R;
    if (pitch < lo) pitch = lo;
    if (pitch > hi) pitch = hi;
  }

  function cancelViewTween() {
    if (!viewTween) return;
    if (viewTween.raf) {
      try { cancelAnimationFrame(viewTween.raf); } catch (e) {}
    }
    if (viewTween.timer) clearTimeout(viewTween.timer);
    viewTween = null;
  }

  function tweenYaw(target) {
    cancelViewTween();
    if (reduceMotion || (typeof document !== 'undefined' && document.hidden)) {
      /* 减少动态效果或页面不可见时不做补间，直接落到目标档位。 */
      yaw = target;
      paint();
      return;
    }
    var from = yaw;
    var t0 = now();
    var dur = 190;
    var settled = false;
    var raf = global.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };

    function settle() {
      if (settled) return;
      settled = true;
      if (viewTween && viewTween.raf) {
        try { cancelAnimationFrame(viewTween.raf); } catch (e) {}
      }
      if (viewTween && viewTween.timer) clearTimeout(viewTween.timer);
      viewTween = null;
      yaw = target;
      paint();
    }

    function frame() {
      if (settled) return;
      var k = Math.min(1, (now() - t0) / dur);
      if (k >= 1) { settle(); return; }
      var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      yaw = from + (target - from) * e;
      paint();
      viewTween = { raf: raf(frame), timer: timer };
    }

    var timer = setTimeout(settle, dur + 60);
    viewTween = { raf: raf(frame), timer: timer };
  }

  function snapYaw() {
    var target = Math.round((yaw + Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) - Math.PI / 4;
    tweenYaw(target);
  }

  function rotateView(deltaDeg) {
    cancelViewTween();
    tweenYaw(yaw + deltaDeg * D2R);
    announce(deltaDeg > 0 ? '视角右转 ' + Math.abs(deltaDeg) + ' 度。' : '视角左转 ' + Math.abs(deltaDeg) + ' 度。');
  }

  /* ───────── 指针 ───────── */

  function canvasPoint(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function focusCanvas() {
    if (!canvas) return;
    try { canvas.focus({ preventScroll: true }); } catch (e) { try { canvas.focus(); } catch (e2) {} }
  }

  function axisScreen(view, axis) {
    var rx = dot(axis, view.cam.right) * view.scale;
    var uy = -dot(axis, view.cam.up) * view.scale;
    var len = Math.sqrt(rx * rx + uy * uy);
    if (len < 1) return null;
    return { x: rx / len, y: uy / len, len: len };
  }

  function beginPointer(e) {
    if (!canvas || !currentView) return;
    if (topVeil()) return;
    if (demoMode) stopDemo();
    var pt = canvasPoint(e);
    var hit = faceAt(pt.x, pt.y);
    focusCanvas();
    if (hit) {
      var id = hit.owner;
      selectPiece(id, { focus: false });
      drag = {
        kind: 'piece',
        id: id,
        pid: e.pointerId,
        startX: pt.x,
        startY: pt.y,
        axis: -1,
        axisDir: null,
        axisLen: 0,
        applied: 0,
        moved: false
      };
      canvas.style.cursor = 'grabbing';
    } else {
      cancelViewTween();
      drag = {
        kind: 'orbit',
        pid: e.pointerId,
        startX: pt.x,
        startY: pt.y,
        lastX: pt.x,
        lastY: pt.y,
        moved: false
      };
      canvas.style.cursor = 'grabbing';
    }
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  }

  function applyDragAxis(dragState, dx, dy) {
    if (dragState.axis < 0) {
      var best = -1;
      var bestScore = 0;
      var bestInfo = null;
      for (var i = 0; i < 3; i++) {
        var axis = [0, 0, 0];
        axis[i] = 1;
        var info = axisScreen(currentView, axis);
        if (!info) continue;
        var score = Math.abs(dx * info.x + dy * info.y);
        if (score > bestScore) {
          bestScore = score;
          best = i;
          bestInfo = info;
        }
      }
      if (best < 0 || bestScore < 6) return;
      var chosen = [0, 0, 0];
      chosen[best] = 1;
      dragState.axis = best;
      dragState.axisDir = chosen;
      dragState.axisInfo = bestInfo;
    }
    var info2 = dragState.axisInfo;
    if (!info2) return;
    var along = dx * info2.x + dy * info2.y;
    var desired = Math.round(along / Math.max(6, info2.len));
    if (desired > 24) desired = 24;
    if (desired < -24) desired = -24;
    if (desired === dragState.applied) return;
    var sign = desired > dragState.applied ? 1 : -1;
    var guard = 0;
    while (dragState.applied !== desired && guard++ < 40) {
      var dir = [dragState.axisDir[0] * sign, dragState.axisDir[1] * sign, dragState.axisDir[2] * sign];
      var ok = tryStep(dragState.id, dir, { quiet: true });
      if (!ok) {
        dragState.blocked = true;
        return;
      }
      dragState.applied += sign;
      dragState.moved = true;
      if (removed[dragState.id] || locked[dragState.id]) return;
    }
  }

  function movePointer(e) {
    if (!drag) {
      if (!canvas || demoMode || !JW.hub || JW.hub.active() !== 'burr' || JW.hub.isOpen()) return;
      var p = canvasPoint(e);
      var hit = faceAt(p.x, p.y);
      var id = hit ? hit.owner : null;
      if (id !== hoverId) {
        hoverId = id;
        canvas.style.cursor = id ? 'pointer' : 'default';
        paint();
      }
      return;
    }
    if (e.pointerId !== undefined && drag.pid !== undefined && e.pointerId !== drag.pid) return;
    var pt = canvasPoint(e);
    var dx = pt.x - drag.startX;
    var dy = pt.y - drag.startY;
    if (drag.kind === 'piece') {
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      applyDragAxis(drag, dx, dy);
    } else if (drag.kind === 'orbit') {
      var mx = pt.x - drag.lastX;
      var my = pt.y - drag.lastY;
      drag.lastX = pt.x;
      drag.lastY = pt.y;
      if (!drag.moved && Math.abs(pt.x - drag.startX) + Math.abs(pt.y - drag.startY) > 4) drag.moved = true;
      if (drag.moved) {
        yaw += mx * 0.008;
        pitch -= my * 0.006;
        clampPitch();
        paint();
      }
    }
    if (e.preventDefault) e.preventDefault();
  }

  function endPointer(e) {
    if (!drag) return;
    if (e.pointerId !== undefined && drag.pid !== undefined && e.pointerId !== drag.pid) return;
    var d = drag;
    drag = null;
    if (canvas) {
      canvas.style.cursor = d.kind === 'piece' ? 'pointer' : 'default';
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    if (d.kind === 'orbit') {
      if (d.moved) {
        snapYaw();
      } else {
        selected = null;
        held = null;
        paint();
        announce('未选中木条。');
      }
    } else {
      if (!d.moved) {
        announce(describePiece(d.id));
      } else if (!removed[d.id] && !locked[d.id]) {
        announce('「' + pieceName(d.id) + '」移动结束，第 ' + moves + ' 步。');
      }
    }
  }

  function cancelPointer() {
    if (!drag) return;
    var d = drag;
    drag = null;
    if (canvas) canvas.style.cursor = 'default';
    if (d.kind === 'orbit') snapYaw();
  }

  /* ───────── 选中 / 键盘 ───────── */

  function availableDirs(id) {
    var out = [];
    for (var i = 0; i < GEO.DIRS.length; i++) {
      if (GEO.canStep(levelPieces(), stateObj(), id, GEO.DIRS[i], { bound: 12 }).ok) {
        out.push(DIR_NAMES[i]);
      }
    }
    return out;
  }

  function describePiece(id) {
    if (!id) return '未选中木条。';
    if (removed[id]) return '「' + pieceName(id) + '」已拆下，在零件盘。';
    if (locked[id]) return '「' + pieceName(id) + '」已归位锁定。';
    var off = offsets[id] || [0, 0, 0];
    var extra = GEO.maxAbs(off) > 0 ? '，已偏移 ' + GEO.maxAbs(off) + ' 格' : '';
    var dirs = availableDirs(id);
    if (!dirs.length) return '选中「' + pieceName(id) + '」' + extra + '。当前没有可移动方向，先移开挡路的木条。';
    return '选中「' + pieceName(id) + '」' + extra + '。可沿 ' + dirs.join('、') + ' 移动。';
  }

  function selectPiece(id, opts) {
    if (!id || !pieceById(id)) return;
    selected = id;
    if (held && held !== id) held = null;
    hintId = null;
    paintAll();
    if (opts && opts.focus) focusCanvas();
    announce(describePiece(id));
  }

  function selectNext(step) {
    var L = level();
    if (!L) return;
    var list = L.pieces.filter(function (id) {
      return mode === DIS ? !removed[id] : !locked[id];
    });
    if (!list.length) {
      showToast(mode === DIS ? '木条都拆完了' : '木条都已归位');
      return;
    }
    var idx = list.indexOf(selected);
    if (idx < 0) idx = step > 0 ? -1 : 0;
    var next = (idx + step + list.length) % list.length;
    selectPiece(list[next], { focus: true });
  }

  function toggleHeld() {
    if (!selected) {
      showToast('先用 Tab 选一根木条');
      announce('先用 Tab 选一根木条。');
      return;
    }
    if (removed[selected] || locked[selected]) {
      announce(describePiece(selected));
      return;
    }
    held = held === selected ? null : selected;
    paintAll();
    announce(held ? '拿起「' + pieceName(selected) + '」，可用方向键沿轴移动。' : '放下「' + pieceName(selected) + '」。');
  }

  function globalKey(e) {
    if (!JW.hub || JW.hub.active() !== 'burr' || JW.hub.isOpen()) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var top = topVeil();
    if (top) {
      if (e.key === 'Tab') {
        trapTab(e, top);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeVeil(top);
      }
      return;
    }
    var target = e.target;
    var interactive = isInteractive(target);
    if (e.key === 'Tab') {
      if (!interactive || target === canvas || target === document.body || target === app) {
        e.preventDefault();
        selectNext(e.shiftKey ? -1 : 1);
      }
      return;
    }
    if (interactive) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault(); stepSelected([-1, 0, 0]);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault(); stepSelected([1, 0, 0]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); stepSelected(e.shiftKey ? [0, 1, 0] : [0, 0, 1]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault(); stepSelected(e.shiftKey ? [0, -1, 0] : [0, 0, -1]);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); toggleHeld();
    } else if (e.key === 'z' || e.key === 'Z') {
      e.preventDefault(); undo();
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault(); resetLevel();
    } else if (e.key === 'h' || e.key === 'H') {
      e.preventDefault(); hint();
    } else if (e.key === 'a' || e.key === 'A') {
      e.preventDefault(); startDemo();
    } else if (e.key === 'l' || e.key === 'L') {
      e.preventDefault(); openLevels();
    } else if (e.key === 'c' || e.key === 'C') {
      e.preventDefault(); toggleContrast();
    } else if (e.key === 'v' || e.key === 'V') {
      e.preventDefault(); toggleMode();
    } else if (e.key === 'q' || e.key === 'Q') {
      e.preventDefault(); rotateView(-90);
    } else if (e.key === 'e' || e.key === 'E') {
      e.preventDefault(); rotateView(90);
    } else if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
      e.preventDefault(); openVeil('burrVeilHelp');
    } else if (e.key === 'Escape') {
      if (held) {
        held = null;
        paintAll();
        announce('已放回。');
      } else if (JW.hub) {
        JW.hub.open({ fromGame: true });
      }
    }
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

  function trapTab(e, id) {
    var v = document.getElementById(id);
    if (!v) return;
    var list = focusablesIn(v);
    if (!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  function openVeil(id) {
    var v = document.getElementById(id);
    if (!v || v.classList.contains('show')) return;
    if (demoMode) stopDemo();
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

  function refreshLevelGrid() {
    if (!elLevelGrid) return;
    elLevelGrid.innerHTML = DATA.levels.map(function (L, i) {
      var d = modeRecord(L.id, DIS);
      var a = modeRecord(L.id, ASM);
      var bits = [];
      bits.push(d && d.bestMoves != null ? '拆 ' + d.bestMoves + ' 步' : '拆 未解');
      bits.push(a && a.bestMoves != null ? '装 ' + a.bestMoves + ' 步' : '装 未解');
      return '<button class="lv lv-burr' + (i === levelIndex ? ' active' : '') + '" type="button" data-burr-level="' + i + '">' +
        '<span class="n">' + (i + 1) + ' · ' + L.name + '</span>' +
        '<span class="m">' + L.sub + '</span>' +
        '<span class="m">' + bits.join(' · ') + '</span>' +
        '<span class="st">' + (i === levelIndex ? (mode === DIS ? '拆' : '装') : '') + '</span>' +
        '</button>';
    }).join('');
  }

  function openLevels() {
    if (demoMode) stopDemo();
    refreshLevelGrid();
    openVeil('burrVeilLevels');
  }

  function toggleContrast() {
    var on = document.documentElement.classList.toggle('hc');
    STORE.settings().contrast = on;
    STORE.save();
    showToast(on ? '高对比已开' : '高对比已关');
    announce(on ? '高对比已开。' : '高对比已关。');
  }

  function loadSettings() {
    var s = STORE.settings();
    if (s.contrast) document.documentElement.classList.add('hc');
    var mq = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (mq) {
      reduceMotion = !!mq.matches;
      var onChange = function (ev) { reduceMotion = !!ev.matches; };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }

  /* ───────── 对外接口 ───────── */

  function enterFromHub() {
    if (!level()) boot();
    if (!finished && moves > 0 && clockPaused) startClock();
    if (topVeil()) return;
    schedulePaint();
    setTimeout(function () {
      paintAll();
      schedulePaint();
    }, 0);
    focusCanvas();
    if (moves === 0 && !finished) {
      showCoach(level().note, true);
    }
  }

  function pauseForHub() {
    if (demoMode) stopDemo();
    closeAllVeils();
    pauseClock();
    saveSession();
  }

  /* ───────── 事件 ───────── */

  document.addEventListener('click', function (e) {
    if (!JW.hub || JW.hub.active() !== 'burr') return;
    var pick = e.target.closest ? e.target.closest('[data-burr-pick]') : null;
    if (pick) {
      var pid = pick.getAttribute('data-burr-pick');
      selectPiece(pid, { focus: true });
      return;
    }
    var levelBtn = e.target.closest ? e.target.closest('[data-burr-level]') : null;
    if (levelBtn) {
      loadLevel(Number(levelBtn.getAttribute('data-burr-level')), { mode: mode });
      return;
    }
    var btn = e.target.closest ? e.target.closest('[data-burr-act]') : null;
    if (!btn) return;
    var act = btn.getAttribute('data-burr-act');
    if (act === 'undo') undo();
    else if (act === 'reset') resetLevel();
    else if (act === 'hint') hint();
    else if (act === 'demo') startDemo();
    else if (act === 'levels') openLevels();
    else if (act === 'help') openVeil('burrVeilHelp');
    else if (act === 'contrast') toggleContrast();
    else if (act === 'hold') toggleHeld();
    else if (act === 'mode') {
      var m = btn.getAttribute('data-mode');
      if (m === DIS || m === ASM) setMode(m);
      else toggleMode();
    } else if (act === 'rotateL') rotateView(-90);
    else if (act === 'rotateR') rotateView(90);
    else if (act === 'closeVeil') closeVeil(btn.getAttribute('data-veil'));
    else if (act === 'closeWin') closeVeil('burrVeilWin');
    else if (act === 'replay') { closeVeil('burrVeilWin'); loadLevel(levelIndex, { mode: mode }); }
    else if (act === 'next') { closeVeil('burrVeilWin'); loadLevel(levelIndex + 1, { mode: mode }); }
  });

  document.addEventListener('keydown', globalKey);

  if (canvas) {
    canvas.addEventListener('pointerdown', beginPointer);
    global.addEventListener('pointermove', movePointer, { passive: false });
    global.addEventListener('pointerup', endPointer);
    global.addEventListener('pointercancel', cancelPointer);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  global.addEventListener('resize', schedulePaint);
  if (global.ResizeObserver && canvas && canvas.parentNode) {
    try {
      new global.ResizeObserver(schedulePaint).observe(canvas.parentNode);
    } catch (e) {}
  }

  document.addEventListener('visibilitychange', function () {
    if (!JW.hub || JW.hub.active() !== 'burr') return;
    if (document.hidden) {
      if (demoMode) stopDemo();
      pauseClock();
      saveSession();
    } else if (!finished && !JW.hub.isOpen() && moves > 0) {
      startClock();
    }
  });

  /* 弹层移到 body 下：.app 打开弹层时整体 inert，弹层不能被一起冻住。 */
  ['burrVeilLevels', 'burrVeilHelp', 'burrVeilWin'].forEach(function (id) {
    var veil = document.getElementById(id);
    if (veil) {
      veil.classList.add('burr-veil');
      document.body.appendChild(veil);
    }
  });

  loadSettings();
  boot();
  paintHud();
  if (canvas) {
    canvas.setAttribute('aria-label',
      '鲁班锁三维视图。按 Tab 选木条，方向键沿轴移动，Shift 加方向键走另一横轴，Q E 转视角，Enter 拿起或放下。');
  }

  NS.id = 'burr';
  NS.title = '鲁班锁';
  NS.subtitle = '结构';
  NS.status = 'ready';
  NS.storage = 'jiewu.v2 / volumes.burr';
  NS.levels = DATA.levels;
  NS.levelCount = DATA.levels.length;
  NS.levelName = function (i) { return DATA.levels[i] ? DATA.levels[i].name : ''; };
  NS.enter = enterFromHub;
  NS.pause = pauseForHub;
  NS.toggleContrast = toggleContrast;

  window.__burr = {
    get levelIndex() { return levelIndex; },
    get level() { return level(); },
    get mode() { return mode; },
    get offsets() { return GEO.cloneOffsets(offsets); },
    get removed() { return GEO.cloneFlags(removed); },
    get locked() { return GEO.cloneFlags(locked); },
    get moves() { return moves; },
    get elapsed() { return Math.round(currentElapsed()); },
    get finished() { return finished; },
    get demoing() { return demoMode; },
    get selected() { return selected; },
    get held() { return held; },
    get historyLength() { return history.length; },
    get threshold() { return THRESHOLD; },
    get view() { return { yaw: yaw * R2D, pitch: pitch * R2D }; },
    get remaining() {
      var n = 0;
      level().pieces.forEach(function (id) {
        if (mode === DIS ? !removed[id] : !locked[id]) n++;
      });
      return n;
    },
    pieces: function () {
      return level().pieces.map(function (id) {
        var p = pieceById(id);
        return { id: id, name: p.name, color: p.color, pull: p.pull };
      });
    },
    cellsOf: function (id) {
      var p = pieceById(id);
      return p ? GEO.shiftedCells(p, offsets[id] || [0, 0, 0]) : [];
    },
    centerOf: function (id) {
      if (!currentView || !pieceById(id)) return null;
      return projectPoint(pieceCenter(id), currentView);
    },
    pickAt: function (x, y) {
      var f = faceAt(x, y);
      return f ? f.owner : null;
    },
    axisScreen: function (axis) {
      if (!currentView) return null;
      var v = typeof axis === 'string' ? DIR_MAP[axis] : axis;
      if (!v) return null;
      var info = axisScreen(currentView, v);
      return info ? { x: info.x, y: info.y, len: info.len } : null;
    },
    canvasRect: function () {
      if (!canvas) return null;
      var r = canvas.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    },
    describe: function (id) { return describePiece(id || selected); },
    available: function (id) { return availableDirs(id || selected); },
    canStep: function (id, dir) {
      return GEO.canStep(levelPieces(), stateObj(), id, DIR_MAP[dir] || dir, { bound: 12 });
    },
    step: function (id, dir) { return tryStep(id, DIR_MAP[dir] || dir, { quiet: false }); },
    select: function (id) { selectPiece(id, { focus: false }); },
    cycle: selectNext,
    hold: toggleHeld,
    rotate: rotateView,
    hint: hint,
    demo: startDemo,
    stopDemo: function () { stopDemo(); },
    undo: undo,
    reset: resetLevel,
    loadLevel: loadLevel,
    setMode: setMode,
    checkWin: checkWin,
    countDone: countDone,
    pathTo: function (id) {
      return GEO.pathToTarget(levelPieces(), stateObj(), id, [0, 0, 0], { pad: 2 });
    },
    allRemoved: allRemoved,
    allLocked: allLocked,
    enter: enterFromHub,
    pause: pauseForHub,
    state: function () {
      return {
        levelIndex: levelIndex,
        mode: mode,
        offsets: GEO.cloneOffsets(offsets),
        removed: GEO.cloneFlags(removed),
        locked: GEO.cloneFlags(locked),
        moves: moves,
        elapsed: Math.round(currentElapsed()),
        finished: finished,
        demoMode: demoMode,
        selected: selected,
        held: held,
        history: history.length
      };
    }
  };

  document.dispatchEvent(new CustomEvent('jiewu:burr-ready'));
})(window);
