/*
 * 解物 · 卷三 七巧板
 *
 * 七块板：大三角 ×2、中三角 ×1、小三角 ×2、正方形 ×1、平行四边形 ×1。
 * 玩家把木片拖进上方的剪影；剪影不画分割线，只给一个影子。
 * 胜利用几何判定：所有板都在剪影内，且两两不重叠（面积守恒即铺满）。
 *
 * 几何在 toys/tangram/geometry.js，关卡在 data/tangram.js；
 * 本文件只做渲染、拖动、旋转、键盘、存档与弹层。
 */
(function (global) {
  'use strict';

  var JW = global.JW || (global.JW = {});
  JW.toys = JW.toys || {};
  var NS = JW.toys.tangram = JW.toys.tangram || {};
  var GEO = NS.geometry;
  var DATA = JW.data.tangram;

  var app = document.getElementById('appTangram');
  if (!app || !GEO || !DATA) return;

  var STORE = JW.core.store;
  var SVGNS = 'http://www.w3.org/2000/svg';

  var UNIT = DATA.board.unit || 80;
  var BW = DATA.board.w;
  var BH = DATA.board.h;

  var board = document.getElementById('tgBoard');
  var targetLayer = document.getElementById('tgTargetLayer');
  var piecesLayer = document.getElementById('tgPieces');
  var hintLayer = document.getElementById('tgHintLayer');
  var elCoach = document.getElementById('tgCoach');
  var elCoachMsg = document.getElementById('tgCoachMsg');
  var elToast = document.getElementById('tgToast');
  var elSr = document.getElementById('tgSr');
  var elChapter = document.getElementById('tgChapter');
  var elName = document.getElementById('tgName');
  var elSub = document.getElementById('tgSub');
  var elMoves = document.getElementById('tgMoves');
  var elTime = document.getElementById('tgTime');
  var elBest = document.getElementById('tgBest');
  var elGoal = document.getElementById('tgGoal');
  var elLevelGrid = document.getElementById('tgLevelGrid');
  var elBtnDemo = document.getElementById('tgBtnDemo');
  var elWinChapter = document.getElementById('tgWinChapter');
  var elWinTitle = document.getElementById('tgWinTitle');
  var elWinMoves = document.getElementById('tgWinMoves');
  var elWinTime = document.getElementById('tgWinTime');
  var elWinSub = document.getElementById('tgWinSub');
  var elWinNote = document.getElementById('tgWinNote');
  var elWinNext = document.getElementById('tgWinNext');

  var levelIndex = 0;
  var poses = {};
  var nodes = {};
  var history = [];
  var selected = null;
  var moves = 0;
  var elapsed = 0;
  var clockStart = 0;
  var clockPaused = true;
  var clockTimer = null;
  var finished = false;
  var demoMode = false;
  var demoTimer = null;
  var demoPlayed = false;
  var hintTimer = null;
  var toastTimer = null;
  var coachTimer = null;
  var drag = null;
  var busy = false;

  function now() {
    return (global.performance && global.performance.now) ? global.performance.now() : Date.now();
  }

  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVGNS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    }
    return el;
  }

  function clonePoses(src) {
    var out = {};
    Object.keys(src || {}).forEach(function (id) {
      var p = src[id];
      out[id] = { x: p.x, y: p.y, rot: p.rot, flip: !!p.flip };
    });
    return out;
  }

  function level() {
    return DATA.levels[levelIndex];
  }

  function levelPieceIds() {
    return level().pieces.slice();
  }

  function pieceById(id) {
    return DATA.pieceById[id];
  }

  function shapeOf(id) {
    var p = pieceById(id);
    return p ? DATA.shapes[p.type] : null;
  }

  function typeOf(id) {
    var p = pieceById(id);
    return p ? p.type : null;
  }

  function placed(id, pose) {
    return GEO.place(shapeOf(id), pose || poses[id]);
  }

  function cents(id, pose) {
    return GEO.centroid(placed(id, pose));
  }

  function targetFor(id) {
    var list = level().targets || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function targetPolygons() {
    return (level().targets || []).map(function (t) {
      var type = t.type || typeOf(t.id);
      return GEO.place(DATA.shapes[type], t);
    });
  }

  function fmtTime(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    s = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function currentElapsed() {
    return elapsed + (clockPaused ? 0 : now() - clockStart);
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

  function volume() {
    return STORE.volume('tangram');
  }

  function progressOf(id) {
    var vol = volume();
    return vol && vol.progress ? vol.progress[id] : null;
  }

  /* ───────── 位姿与吸附 ───────── */

  function clampPose(id, pose) {
    var p = GEO.normalizePose(pose);
    var shape = shapeOf(id);
    for (var k = 0; k < 3; k++) {
      var box = GEO.bbox(GEO.place(shape, p));
      var dx = 0, dy = 0;
      if (box.minX < 0) dx = -box.minX;
      if (box.maxX > BW) dx = BW - box.maxX;
      if (box.minY < 0) dy = -box.minY;
      if (box.maxY > BH) dy = BH - box.maxY;
      if (!dx && !dy) break;
      p.x += dx;
      p.y += dy;
      p = GEO.normalizePose(p);
    }
    return p;
  }

  function snapToTarget(id, pose) {
    var t = targetFor(id);
    if (!t) return pose;
    var tgt = { type: typeOf(id), x: t.x, y: t.y, rot: GEO.normRot(t.rot), flip: !!t.flip };
    return GEO.snapToTargets({ type: typeOf(id), x: pose.x, y: pose.y, rot: pose.rot, flip: pose.flip },
      [tgt], 0.62);
  }

  function settlePose(id, pose) {
    var next = clampPose(id, pose);
    next = snapToTarget(id, next);
    return clampPose(id, next);
  }

  function poseDiffers(a, b) {
    if (!a || !b) return true;
    if (!!a.flip !== !!b.flip) return true;
    if (GEO.normRot(a.rot) !== GEO.normRot(b.rot)) return true;
    return Math.abs(a.x - b.x) > 1e-6 || Math.abs(a.y - b.y) > 1e-6;
  }

  function rotateAboutCenter(id, delta, flip) {
    var cur = poses[id];
    if (!cur) return;
    var before = { x: cur.x, y: cur.y, rot: cur.rot, flip: !!cur.flip };
    var c0 = cents(id, before);
    var next = {
      x: before.x,
      y: before.y,
      rot: GEO.snapRot(before.rot + delta),
      flip: flip == null ? before.flip : !!flip
    };
    var c1 = cents(id, next);
    next.x += c0[0] - c1[0];
    next.y += c0[1] - c1[1];
    commitPose(id, settlePose(id, next));
  }

  function atAuthoredTarget(id) {
    var t = targetFor(id);
    if (!t) return false;
    var p = poses[id];
    if (!p) return false;
    return GEO.samePose(
      { x: p.x, y: p.y, rot: p.rot, flip: p.flip },
      { x: t.x, y: t.y, rot: t.rot, flip: !!t.flip },
      0.02
    );
  }

  function matchesAnyTarget(id) {
    var p = poses[id];
    if (!p) return false;
    var type = typeOf(id);
    var list = level().targets || [];
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      if ((t.type || typeOf(t.id)) !== type) continue;
      if (GEO.samePose(
        { x: p.x, y: p.y, rot: p.rot, flip: p.flip },
        { x: t.x, y: t.y, rot: t.rot, flip: !!t.flip },
        0.02
      )) return true;
    }
    return false;
  }

  /* ───────── 渲染 ───────── */

  function pathFrom(polys) {
    return polys.map(function (poly) {
      return 'M' + poly.map(function (p) {
        return (p[0] * UNIT).toFixed(2) + ' ' + (p[1] * UNIT).toFixed(2);
      }).join('L') + 'Z';
    }).join(' ');
  }

  function buildTarget() {
    if (!targetLayer) return;
    targetLayer.innerHTML = '';
    var path = svgEl('path', {
      id: 'tgTargetPath',
      class: 'tg-target-path',
      d: pathFrom(targetPolygons())
    });
    targetLayer.appendChild(path);
  }

  function paintPiece(id) {
    var node = nodes[id];
    var p = poses[id];
    if (!node || !p) return;
    var poly = placed(id, p);
    var d = pathFrom([poly]);
    var path = node.querySelector('.tg-body');
    if (path) path.setAttribute('d', d);
    node.classList.toggle('selected', id === selected);
    var piece = pieceById(id);
    var rot = GEO.normRot(p.rot);
    node.setAttribute('aria-label',
      piece.name + '，位于第 ' + Math.round(p.x * 2) / 2 + ' 列第 ' + Math.round(p.y * 2) / 2 + ' 行，旋转 ' + rot + ' 度' +
      (p.flip ? '，已翻面' : ''));
  }

  function paintPieces() {
    levelPieceIds().forEach(paintPiece);
  }

  function buildPieces() {
    if (!piecesLayer) return;
    piecesLayer.innerHTML = '';
    nodes = {};
    var order = levelPieceIds();
    order.forEach(function (id) {
      var piece = pieceById(id);
      if (!piece) return;
      var g = svgEl('g', {
        class: 'tg-piece tg-tone-' + piece.type,
        'data-id': id,
        tabindex: '0',
        role: 'button'
      });
      var path = svgEl('path', { class: 'tg-body' });
      g.appendChild(path);
      piecesLayer.appendChild(g);
      nodes[id] = g;
    });
    paintPieces();
  }

  function bestText(id) {
    var rec = progressOf(id);
    if (!rec || rec.bestMoves == null) return '—';
    return rec.bestMoves + ' 步';
  }

  function paintHud() {
    var L = level();
    if (!L) return;
    if (elChapter) elChapter.textContent = L.chapter || '';
    if (elName) elName.textContent = L.name || '';
    if (elSub) elSub.textContent = L.sub || '';
    if (elMoves) elMoves.textContent = String(moves);
    if (elBest) elBest.textContent = bestText(L.id);
    if (elGoal) elGoal.innerHTML = '选中一块，拖动平移；<em>↺ ↻</em> 每次转 45°，平行四边形可翻面。';
    if (elBtnDemo) elBtnDemo.textContent = demoMode ? '停止' : '演示';
    paintTime();
  }

  /* ───────── 会话 ───────── */

  function saveSession() {
    var vol = volume();
    if (!vol) return;
    if (finished || (moves === 0 && currentElapsed() < 1000)) {
      vol.session = null;
    } else {
      vol.session = {
        levelIndex: levelIndex,
        poses: clonePoses(poses),
        moves: moves,
        elapsed: Math.round(currentElapsed()),
        at: new Date().toISOString()
      };
    }
    STORE.save();
  }

  function posesValidFor(levelObj, saved) {
    if (!saved || typeof saved !== 'object') return false;
    var ids = levelObj.pieces;
    for (var i = 0; i < ids.length; i++) {
      var p = saved[ids[i]];
      if (!p || !isFinite(p.x) || !isFinite(p.y) || !isFinite(p.rot)) return false;
    }
    return true;
  }

  function boot() {
    var s = volume() && volume().session;
    if (s && typeof s.levelIndex === 'number' && DATA.levels[s.levelIndex] &&
        posesValidFor(DATA.levels[s.levelIndex], s.poses)) {
      levelIndex = s.levelIndex;
      poses = {};
      levelPieceIds().forEach(function (id) {
        var p = s.poses[id];
        poses[id] = clampPose(id, { x: p.x, y: p.y, rot: p.rot, flip: !!p.flip });
      });
      moves = Math.max(0, Number(s.moves) || 0);
      elapsed = Math.max(0, Number(s.elapsed) || 0);
      finished = false;
      selected = levelPieceIds()[0] || null;
      history = [];
      buildTarget();
      buildPieces();
      paintHud();
      clockPaused = true;
      paintTime();
      return;
    }
    loadLevel(0, { silent: true, noSave: true });
  }

  function loadLevel(index, opts) {
    opts = opts || {};
    if (!DATA.levels[index]) return;
    stopDemo();
    closeAllVeils();
    pauseClock();
    levelIndex = index;
    var L = level();
    poses = {};
    L.pieces.forEach(function (id) {
      var base = DATA.tray[id] || { x: 0, y: 4, rot: 0 };
      poses[id] = clampPose(id, { x: base.x, y: base.y, rot: base.rot || 0, flip: !!base.flip });
    });
    moves = 0;
    elapsed = 0;
    finished = false;
    demoPlayed = false;
    history = [];
    selected = L.pieces[0] || null;
    buildTarget();
    buildPieces();
    paintHud();
    hideCoach();
    clearHint();
    clockPaused = true;
    paintTime();
    if (!opts.noSave) saveSession();
    announce('已载入「' + L.name + '」。' + L.sub + '。');
    if (!opts.silent) {
      showCoach('「' + L.name + '」：' + L.note, true);
      focusSelected();
    }
  }

  function focusSelected() {
    if (selected && nodes[selected]) {
      try { nodes[selected].focus({ preventScroll: true }); } catch (e) {}
    }
  }

  /* ───────── 修改与撤销 ───────── */

  function pushHistory(snapshot, moveCount) {
    history.push({ poses: snapshot, moves: moveCount });
    if (history.length > 120) history.shift();
  }

  function commitPose(id, next, opts) {
    opts = opts || {};
    if (!poses[id] || finished) return false;
    var before = clonePoses(poses);
    var beforeMoves = moves;
    if (!poseDiffers(poses[id], next)) {
      poses[id] = next;
      paintPiece(id);
      return false;
    }
    poses[id] = next;
    moves += 1;
    pushHistory(before, beforeMoves);
    stopDemo();
    demoPlayed = false;
    paintPiece(id);
    paintHud();
    if (!clockPaused) paintTime();
    else startClock();
    if (!opts.demo) saveSession();
    announce(pieceById(id).name + '：第 ' + moves + ' 步。');
    if (checkWin()) setTimeout(win, 260);
    return true;
  }

  function undo() {
    if (!history.length) {
      showToast('没有可撤销的走法');
      announce('没有可撤销的走法。');
      return;
    }
    stopDemo();
    var snap = history.pop();
    poses = clonePoses(snap.poses);
    moves = snap.moves;
    finished = false;
    closeAllVeils();
    paintPieces();
    paintHud();
    saveSession();
    announce('已撤销一步。');
  }

  function resetLevel() {
    loadLevel(levelIndex);
  }

  function checkWin() {
    if (!level()) return false;
    var ids = levelPieceIds();
    var polys = ids.map(function (id) { return placed(id); });
    return GEO.coversTarget(polys, targetPolygons());
  }

  /* ───────── 提示与演示 ───────── */

  function clearHint() {
    if (hintLayer) hintLayer.innerHTML = '';
    clearTimeout(hintTimer);
    Object.keys(nodes).forEach(function (id) { nodes[id].classList.remove('hint'); });
  }

  function hint() {
    if (finished || busy) return;
    stopDemo();
    var ids = levelPieceIds();
    var pick = null;
    for (var i = 0; i < ids.length; i++) {
      if (!matchesAnyTarget(ids[i])) { pick = ids[i]; break; }
    }
    if (!pick) {
      showToast('已经铺满，只差最后一步');
      return;
    }
    var t = targetFor(pick);
    if (!t) return;
    clearHint();
    var poly = GEO.place(shapeOf(pick), t);
    if (hintLayer) {
      hintLayer.appendChild(svgEl('path', {
        class: 'tg-hint-path',
        d: pathFrom([poly])
      }));
    }
    if (nodes[pick]) nodes[pick].classList.add('hint');
    selected = pick;
    paintPieces();
    hintTimer = setTimeout(clearHint, 3600);
    showCoach('提示：把「' + pieceById(pick).name + '」移到高亮处，旋转 ' +
      GEO.normRot(t.rot) + ' 度' + (t.flip ? '，并翻面' : '') + '。', true);
    announce('提示：' + pieceById(pick).name + '，旋转 ' + GEO.normRot(t.rot) + ' 度。');
  }

  function stopDemo() {
    if (demoTimer) {
      clearTimeout(demoTimer);
      demoTimer = null;
    }
    demoMode = false;
    if (elBtnDemo) elBtnDemo.textContent = '演示';
    paintPieces();
  }

  function animateTo(id, target, dur, done) {
    var from = clonePoses(poses)[id];
    var to = { x: target.x, y: target.y, rot: GEO.normRot(target.rot), flip: !!target.flip };
    var dRot = to.rot - from.rot;
    while (dRot > 180) dRot -= 360;
    while (dRot < -180) dRot += 360;
    var t0 = now();
    function frame() {
      if (!demoMode) return;
      var k = Math.min(1, (now() - t0) / dur);
      var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      poses[id] = {
        x: from.x + (to.x - from.x) * e,
        y: from.y + (to.y - from.y) * e,
        rot: GEO.normRot(from.rot + dRot * e),
        flip: e < 0.5 ? from.flip : to.flip
      };
      paintPiece(id);
      if (k < 1) {
        demoTimer = setTimeout(frame, 16);
      } else {
        poses[id] = to;
        paintPiece(id);
        done();
      }
    }
    frame();
  }

  function demo() {
    if (finished || busy) return;
    if (demoMode) {
      stopDemo();
      showToast('演示已停止');
      return;
    }
    var queue = levelPieceIds().filter(function (id) { return !atAuthoredTarget(id); });
    if (!queue.length) {
      showToast('已经铺满，只差最后一步');
      return;
    }
    demoMode = true;
    demoPlayed = true;
    if (elBtnDemo) elBtnDemo.textContent = '停止';
    showCoach('演示中 · ' + queue.length + ' 块归位。再点「停止」可中断。', true);
    announce('开始演示，共 ' + queue.length + ' 块需要归位。');
    var i = 0;
    (function step() {
      if (!demoMode) return;
      if (i >= queue.length) {
        demoMode = false;
        if (elBtnDemo) elBtnDemo.textContent = '演示';
        paintHud();
        if (checkWin()) setTimeout(win, 260);
        return;
      }
      var id = queue[i++];
      var t = targetFor(id);
      if (!t) { step(); return; }
      animateTo(id, t, 340, function () {
        demoTimer = setTimeout(step, 90);
      });
    })();
  }

  /* ───────── 胜利 ───────── */

  function win() {
    if (finished || !checkWin()) return;
    finished = true;
    pauseClock();
    var wasDemo = demoPlayed;
    demoPlayed = false;
    stopDemo();
    var L = level();
    var total = Math.round(currentElapsed());
    if (!wasDemo) {
      var vol = volume();
      vol.progress = vol.progress || {};
      var rec = vol.progress[L.id] || { wins: 0, bestMoves: null, bestTime: null };
      rec.wins = (rec.wins || 0) + 1;
      if (rec.bestMoves == null || moves < rec.bestMoves) rec.bestMoves = moves;
      if (rec.bestTime == null || total < rec.bestTime) rec.bestTime = total;
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
    fillWin(L, wasDemo, total);
    announce('影已合。用了 ' + moves + ' 步，' + fmtTime(total) + '。');
    setTimeout(function () {
      if (finished) openVeil('tgVeilWin');
    }, 260);
  }

  function fillWin(L, wasDemo, total) {
    if (elWinChapter) elWinChapter.textContent = L.chapter;
    if (elWinTitle) elWinTitle.textContent = '影已合';
    if (elWinMoves) elWinMoves.textContent = String(moves);
    if (elWinTime) elWinTime.textContent = fmtTime(total);
    if (elWinSub) {
      elWinSub.textContent = L.pieces.length === 7
        ? '七块板各归其位，一方复原。'
        : '两块板沿斜边相接，影子成了。';
    }
    if (elWinNote) {
      elWinNote.textContent = wasDemo
        ? '演示完成，不计入最佳成绩。关掉弹层，自己再走一遍。'
        : '已记入档案。换一种摆法，往往也能铺满同一个影子。';
    }
    if (elWinNext) elWinNext.hidden = levelIndex >= DATA.levels.length - 1;
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

  function refreshLevelGrid() {
    if (!elLevelGrid) return;
    elLevelGrid.innerHTML = DATA.levels.map(function (L, i) {
      var rec = progressOf(L.id);
      var best = rec && rec.bestMoves != null ? '最佳 ' + rec.bestMoves + ' 步' : '尚未拼成';
      return '<button class="tg-level' + (i === levelIndex ? ' current' : '') + '" type="button" data-tg-act="selectLevel" data-index="' + i + '">' +
        '<span class="tg-level-no">' + (i + 1) + '</span>' +
        '<span class="tg-level-name">' + L.name + '</span>' +
        '<span class="tg-level-sub">' + L.sub + '</span>' +
        '<span class="tg-level-best">' + best + '</span>' +
        '</button>';
    }).join('');
  }

  function openLevels() {
    if (demoMode) stopDemo();
    refreshLevelGrid();
    openVeil('tgVeilLevels');
  }

  function toggleContrast() {
    var on = document.documentElement.classList.toggle('hc');
    STORE.settings().contrast = on;
    STORE.save();
    showToast(on ? '高对比已开' : '高对比已关');
    announce(on ? '高对比已开。' : '高对比已关。');
  }

  /* ───────── 指针拖动 ───────── */

  function boardPoint(e) {
    var pt = board.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    var ctm = board.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    var p = pt.matrixTransform(ctm.inverse());
    return { x: p.x / UNIT, y: p.y / UNIT };
  }

  function selectPiece(id, opts) {
    if (!id || !nodes[id]) return;
    selected = id;
    paintPieces();
    if (opts && opts.focus) {
      try { nodes[id].focus({ preventScroll: true }); } catch (e) {}
    }
    announce('选中 ' + pieceById(id).name + '。');
  }

  function beginDrag(e) {
    if (finished || busy) return;
    var g = e.target.closest ? e.target.closest('.tg-piece') : null;
    if (!g || !board) return;
    var id = g.getAttribute('data-id');
    if (!id || !poses[id]) return;
    if (demoMode) stopDemo();
    selectPiece(id);
    var p = boardPoint(e);
    drag = {
      id: id,
      node: g,
      pid: e.pointerId,
      start: { x: poses[id].x, y: poses[id].y, rot: poses[id].rot, flip: !!poses[id].flip },
      offsetX: p.x - poses[id].x,
      offsetY: p.y - poses[id].y,
      moved: false,
      before: clonePoses(poses),
      beforeMoves: moves
    };
    g.classList.add('dragging');
    try { g.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  }

  function moveDrag(e) {
    if (!drag) return;
    if (e.pointerId !== undefined && e.pointerId !== drag.pid) return;
    var p = boardPoint(e);
    var next = clampPose(drag.id, {
      x: p.x - drag.offsetX,
      y: p.y - drag.offsetY,
      rot: poses[drag.id].rot,
      flip: poses[drag.id].flip
    });
    if (poseDiffers(next, poses[drag.id])) drag.moved = true;
    poses[drag.id] = next;
    paintPiece(drag.id);
    e.preventDefault();
  }

  function endDrag(e) {
    if (!drag) return;
    if (e.pointerId !== undefined && e.pointerId !== drag.pid) return;
    var d = drag;
    drag = null;
    d.node.classList.remove('dragging');
    var settled = settlePose(d.id, poses[d.id]);
    if (!d.moved && !poseDiffers(settled, d.start)) {
      poses[d.id] = d.start;
      paintPiece(d.id);
      return;
    }
    if (!poseDiffers(settled, d.start)) {
      poses[d.id] = d.start;
      paintPiece(d.id);
      return;
    }
    poses[d.id] = settled;
    moves += 1;
    pushHistory(d.before, d.beforeMoves);
    demoPlayed = false;
    paintPiece(d.id);
    paintHud();
    if (clockPaused) startClock();
    saveSession();
    announce(pieceById(d.id).name + ' 已移动。第 ' + moves + ' 步。');
    if (checkWin()) setTimeout(win, 260);
  }

  /* ───────── 键盘 ───────── */

  function onPieceKey(e) {
    if (!selected) return;
    var step = e.shiftKey ? 1 : 0.25;
    if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); nudge(selected, -step, 0); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); nudge(selected, step, 0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); nudge(selected, 0, -step); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); nudge(selected, 0, step); }
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      selectPiece(selected, { focus: false });
    }
  }

  function nudge(id, dx, dy) {
    if (!poses[id] || finished) return;
    var p = poses[id];
    commitPose(id, settlePose(id, { x: p.x + dx, y: p.y + dy, rot: p.rot, flip: p.flip }));
  }

  function rotateSelected(delta) {
    if (!selected || finished) return;
    rotateAboutCenter(selected, delta);
  }

  function flipSelected() {
    if (!selected || finished) return;
    if (typeOf(selected) !== 'para') {
      showToast('只有平行四边形需要翻面');
      announce('只有平行四边形需要翻面。');
      return;
    }
    rotateAboutCenter(selected, 0, !poses[selected].flip);
  }

  function globalKey(e) {
    if (!JW.hub || JW.hub.active() !== 'tangram' || JW.hub.isOpen()) return;
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
    else if (e.key === '[' || e.key === 'q' || e.key === 'Q') { e.preventDefault(); rotateSelected(-45); }
    else if (e.key === ']' || e.key === 'e' || e.key === 'E') { e.preventDefault(); rotateSelected(45); }
    else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); flipSelected(); }
    else if (e.key === '?' || (e.key === '/' && e.shiftKey)) { e.preventDefault(); openVeil('tgVeilHelp'); }
  }

  /* ───────── 对外接口 ───────── */

  function enterFromHub() {
    if (!level()) boot();
    if (!finished && moves > 0) startClock();
    if (topVeil()) return;
    focusSelected();
    if (moves === 0) {
      showCoach('拖动木片，或聚焦后按方向键；[ ] 旋转 45°，平行四边形按 F 翻面。把木片全部移进上方的影子。', true);
    }
  }

  function pauseForHub() {
    stopDemo();
    closeAllVeils();
    pauseClock();
    saveSession();
  }

  function loadSettings() {
    var s = STORE.settings();
    if (s.contrast) document.documentElement.classList.add('hc');
  }

  /* ───────── 事件 ───────── */

  document.addEventListener('click', function (e) {
    if (!JW.hub || JW.hub.active() !== 'tangram' || JW.hub.isOpen()) return;
    var levelBtn = e.target.closest ? e.target.closest('[data-tg-act="selectLevel"]') : null;
    if (levelBtn) {
      loadLevel(Number(levelBtn.dataset.index));
      return;
    }
    var btn = e.target.closest ? e.target.closest('[data-tg-act]') : null;
    if (!btn) return;
    var act = btn.getAttribute('data-tg-act');
    if (act === 'undo') undo();
    else if (act === 'reset') resetLevel();
    else if (act === 'hint') hint();
    else if (act === 'demo') demo();
    else if (act === 'levels') openLevels();
    else if (act === 'help') openVeil('tgVeilHelp');
    else if (act === 'contrast') toggleContrast();
    else if (act === 'rotL') rotateSelected(-45);
    else if (act === 'rotR') rotateSelected(45);
    else if (act === 'flip') flipSelected();
    else if (act === 'closeVeil') closeVeil(btn.getAttribute('data-veil'));
    else if (act === 'closeWin') closeVeil('tgVeilWin');
    else if (act === 'replay') { closeVeil('tgVeilWin'); loadLevel(levelIndex); }
    else if (act === 'next') { closeVeil('tgVeilWin'); loadLevel(levelIndex + 1); }
  });

  app.addEventListener('keydown', function (e) {
    if (e.target.closest && e.target.closest('.tg-piece')) onPieceKey(e);
  });

  document.addEventListener('keydown', globalKey);

  if (board) {
    board.addEventListener('pointerdown', beginDrag);
    global.addEventListener('pointermove', moveDrag, { passive: false });
    global.addEventListener('pointerup', endDrag);
    global.addEventListener('pointercancel', endDrag);
    board.addEventListener('focusin', function (e) {
      var g = e.target.closest ? e.target.closest('.tg-piece') : null;
      if (g) selectPiece(g.getAttribute('data-id'));
    });
  }

  document.addEventListener('visibilitychange', function () {
    if (JW.hub && JW.hub.active() !== 'tangram') return;
    if (document.hidden) {
      stopDemo();
      pauseClock();
      saveSession();
    } else if (!finished && !JW.hub.isOpen() && moves > 0) {
      startClock();
    }
  });

  /* 弹层移到 body 下：.app 打开弹层时整体 inert，弹层不能被一起冻住。 */
  ['tgVeilLevels', 'tgVeilHelp', 'tgVeilWin'].forEach(function (id) {
    var veil = document.getElementById(id);
    if (veil) {
      veil.classList.add('tg-veil');
      document.body.appendChild(veil);
    }
  });

  loadSettings();
  boot();
  paintHud();

  NS.id = 'tangram';
  NS.title = '七巧板';
  NS.subtitle = '变换';
  NS.status = 'ready';
  NS.storage = 'jiewu.v2 / volumes.tangram';
  NS.levels = DATA.levels;
  NS.levelCount = DATA.levels.length;
  NS.levelName = function (i) { return DATA.levels[i] ? DATA.levels[i].name : ''; };
  NS.enter = enterFromHub;
  NS.pause = pauseForHub;
  NS.toggleContrast = toggleContrast;

  window.__tangram = {
    get levelIndex() { return levelIndex; },
    get level() { return level(); },
    get poses() { return clonePoses(poses); },
    get moves() { return moves; },
    get finished() { return finished; },
    get demoing() { return demoMode; },
    get selected() { return selected; },
    get historyLength() { return history.length; },
    targets: function () { return (level().targets || []).map(function (t) { return { id: t.id, type: t.type, x: t.x, y: t.y, rot: t.rot, flip: !!t.flip }; }); },
    place: function (id, pose) {
      if (!poses[id]) return false;
      return commitPose(id, settlePose(id, { x: pose.x, y: pose.y, rot: pose.rot || 0, flip: !!pose.flip }));
    },
    applyTargets: function () {
      if (finished) return false;
      var L = level();
      L.targets.forEach(function (t) {
        if (poses[t.id]) poses[t.id] = { x: t.x, y: t.y, rot: GEO.normRot(t.rot), flip: !!t.flip };
      });
      paintPieces();
      paintHud();
      saveSession();
      if (checkWin()) setTimeout(win, 120);
      return true;
    },
    covered: checkWin,
    loadLevel: loadLevel,
    reset: resetLevel,
    undo: undo,
    hint: hint,
    demo: demo,
    rotate: rotateSelected,
    flip: flipSelected,
    nudge: nudge,
    select: selectPiece,
    enter: enterFromHub,
    pause: pauseForHub
  };

  document.dispatchEvent(new CustomEvent('jiewu:tangram-ready'));
})(window);
