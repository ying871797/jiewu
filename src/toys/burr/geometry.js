/*
 * 解物 · 卷四 鲁班锁几何内核
 *
 * 只做纯体素几何：占用、碰撞、单格平移、拆出判定、单件寻路。
 * 不碰 DOM，也不读存档；渲染与关卡流程都在 toys/burr/game.js。
 *
 * 状态：
 *   state.offsets[id] = [dx, dy, dz]   整数格偏移
 *   state.removed[id] = true           已拆下（拆模式）
 *   state.locked[id]  = true           已归位锁定（装模式）
 */
(function (global) {
  'use strict';

  var JW = global.JW || (global.JW = {});
  JW.toys = JW.toys || {};
  var NS = JW.toys.burr = JW.toys.burr || {};

  var DIRS = [
    [1, 0, 0], [-1, 0, 0],
    [0, 1, 0], [0, -1, 0],
    [0, 0, 1], [0, 0, -1]
  ];

  function key(x, y, z) {
    return x + ',' + y + ',' + z;
  }

  function cellKey(c) {
    return key(c[0], c[1], c[2]);
  }

  function zero() {
    return [0, 0, 0];
  }

  function cloneOffsets(src) {
    var out = {};
    Object.keys(src || {}).forEach(function (id) {
      var v = src[id];
      out[id] = [Number(v[0]) || 0, Number(v[1]) || 0, Number(v[2]) || 0];
    });
    return out;
  }

  function cloneFlags(src) {
    var out = {};
    Object.keys(src || {}).forEach(function (id) { out[id] = !!src[id]; });
    return out;
  }

  function sameOffset(a, b) {
    return !!a && !!b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  }

  function add(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  }

  function subtract(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }

  function maxAbs(v) {
    return Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2]));
  }

  function isOut(off, threshold) {
    var t = threshold == null ? 5 : threshold;
    return maxAbs(off) >= t;
  }

  function pieceById(pieces, id) {
    for (var i = 0; i < pieces.length; i++) {
      if (pieces[i].id === id) return pieces[i];
    }
    return null;
  }

  function shiftedCells(piece, off) {
    var out = [];
    var cells = piece.cells || [];
    for (var i = 0; i < cells.length; i++) {
      out.push([cells[i][0] + off[0], cells[i][1] + off[1], cells[i][2] + off[2]]);
    }
    return out;
  }

  /* 当前可见木条占用的格点。skipRemoved=true 时，已拆下的件不再占位。 */
  function occupancy(pieces, state, skipRemoved) {
    var cells = {};
    var owner = {};
    pieces.forEach(function (p) {
      if (skipRemoved && state.removed && state.removed[p.id]) return;
      var off = (state.offsets && state.offsets[p.id]) || zero();
      var list = shiftedCells(p, off);
      for (var i = 0; i < list.length; i++) {
        var k = cellKey(list[i]);
        cells[k] = true;
        owner[k] = p.id;
      }
    });
    return { cells: cells, owner: owner };
  }

  /* 返回挡住 pid 的件 id；没有碰撞返回 null。 */
  function collision(pieces, state, pid, nextOff) {
    var piece = pieceById(pieces, pid);
    if (!piece) return pid;
    var mine = {};
    shiftedCells(piece, nextOff).forEach(function (c) { mine[cellKey(c)] = true; });
    for (var i = 0; i < pieces.length; i++) {
      var other = pieces[i];
      if (other.id === pid) continue;
      if (state.removed && state.removed[other.id]) continue;
      var off = (state.offsets && state.offsets[other.id]) || zero();
      var list = shiftedCells(other, off);
      for (var k = 0; k < list.length; k++) {
        if (mine[cellKey(list[k])]) return other.id;
      }
    }
    return null;
  }

  /*
   * 判断 pid 能否沿 dir 平移一格。
   * 返回 { ok, off?, reason?, by? }
   * reason: 'removed' | 'locked' | 'edge' | 'blocked'
   */
  function canStep(pieces, state, pid, dir, opts) {
    opts = opts || {};
    if (state.removed && state.removed[pid]) return { ok: false, reason: 'removed' };
    if (state.locked && state.locked[pid]) return { ok: false, reason: 'locked' };
    var cur = (state.offsets && state.offsets[pid]) || zero();
    var next = add(cur, dir);
    var bound = opts.bound == null ? 10 : opts.bound;
    if (maxAbs(next) > bound) return { ok: false, reason: 'edge', off: next };
    var by = collision(pieces, state, pid, next);
    if (by) return { ok: false, reason: 'blocked', by: by, off: next };
    return { ok: true, off: next };
  }

  /*
   * 从当前位置沿 dir 连续拉到拆出阈值。
   * 不修改传入 state；返回 { steps, off, removed, blockedBy }
   */
  function pullToOut(pieces, state, pid, dir, threshold, maxSteps) {
    var limit = maxSteps == null ? 12 : maxSteps;
    var temp = {
      offsets: cloneOffsets(state.offsets),
      removed: cloneFlags(state.removed),
      locked: cloneFlags(state.locked)
    };
    var steps = 0;
    while (steps < limit) {
      var cur = temp.offsets[pid] || zero();
      if (isOut(cur, threshold)) {
        return { steps: steps, off: cur.slice(), removed: true, blockedBy: null };
      }
      var res = canStep(pieces, temp, pid, dir, { bound: 99 });
      if (!res.ok) {
        return { steps: steps, off: cur.slice(), removed: false, blockedBy: res.by || null, reason: res.reason };
      }
      temp.offsets[pid] = res.off;
      steps += 1;
    }
    return {
      steps: steps,
      off: (temp.offsets[pid] || zero()).slice(),
      removed: isOut(temp.offsets[pid], threshold),
      blockedBy: null
    };
  }

  /*
   * 单件 BFS：在其它木条固定的情况下，把 pid 从当前位置走到 target。
   * 返回偏移数组（不含起点，含终点），无路返回 null。
   */
  function pathToTarget(pieces, state, pid, target, opts) {
    opts = opts || {};
    if (state.locked && state.locked[pid]) return null;
    var piece = pieceById(pieces, pid);
    if (!piece) return null;

    var blocked = {};
    pieces.forEach(function (other) {
      if (other.id === pid) return;
      if (state.removed && state.removed[other.id]) return;
      var off = (state.offsets && state.offsets[other.id]) || zero();
      shiftedCells(other, off).forEach(function (c) { blocked[cellKey(c)] = true; });
    });

    var start = ((state.offsets && state.offsets[pid]) || zero()).slice();
    var startKey = key(start[0], start[1], start[2]);
    var targetKey = key(target[0], target[1], target[2]);
    if (startKey === targetKey) return [];

    var pad = opts.pad == null ? 1 : opts.pad;
    var lo = [
      Math.min(0, start[0], target[0]) - pad,
      Math.min(0, start[1], target[1]) - pad,
      Math.min(0, start[2], target[2]) - pad
    ];
    var hi = [
      Math.max(5, start[0], target[0]) + pad,
      Math.max(5, start[1], target[1]) + pad,
      Math.max(5, start[2], target[2]) + pad
    ];
    if (opts.lo) {
      lo[0] = Math.max(lo[0], opts.lo[0]);
      lo[1] = Math.max(lo[1], opts.lo[1]);
      lo[2] = Math.max(lo[2], opts.lo[2]);
    }
    if (opts.hi) {
      hi[0] = Math.min(hi[0], opts.hi[0]);
      hi[1] = Math.min(hi[1], opts.hi[1]);
      hi[2] = Math.min(hi[2], opts.hi[2]);
    }

    function inside(v) {
      return v[0] >= lo[0] && v[0] <= hi[0] &&
             v[1] >= lo[1] && v[1] <= hi[1] &&
             v[2] >= lo[2] && v[2] <= hi[2];
    }

    function cellsFree(off) {
      var list = shiftedCells(piece, off);
      for (var i = 0; i < list.length; i++) {
        if (blocked[cellKey(list[i])]) return false;
      }
      return true;
    }

    var queue = [start];
    var head = 0;
    var seen = {};
    var parent = {};
    var point = {};
    seen[startKey] = true;
    point[startKey] = start;

    while (head < queue.length) {
      var cur = queue[head++];
      var curKey = key(cur[0], cur[1], cur[2]);
      for (var d = 0; d < DIRS.length; d++) {
        var next = add(cur, DIRS[d]);
        if (!inside(next)) continue;
        var nk = key(next[0], next[1], next[2]);
        if (seen[nk]) continue;
        if (!cellsFree(next)) continue;
        seen[nk] = true;
        parent[nk] = curKey;
        point[nk] = next;
        if (nk === targetKey) {
          var path = [];
          var k = targetKey;
          while (k !== startKey) {
            path.push(point[k]);
            k = parent[k];
          }
          path.reverse();
          return path;
        }
        queue.push(next);
      }
    }
    return null;
  }

  /* 找出当前局面下任意一件的任意一步合法移动；返回 { id, dir, off } 或 null。 */
  function anyMove(pieces, state, opts) {
    opts = opts || {};
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      if (state.removed && state.removed[p.id]) continue;
      if (state.locked && state.locked[p.id]) continue;
      for (var d = 0; d < DIRS.length; d++) {
        var res = canStep(pieces, state, p.id, DIRS[d], opts);
        if (res.ok) return { id: p.id, dir: DIRS[d].slice(), off: res.off };
      }
    }
    return null;
  }

  function countProgress(level, state) {
    var done = 0;
    (level.pieces || []).forEach(function (id) {
      if (state.removed && state.removed[id]) done += 1;
      if (state.locked && state.locked[id]) done += 1;
    });
    return { done: done, total: (level.pieces || []).length };
  }

  function validateOffsets(level, raw) {
    if (!raw || typeof raw !== 'object') return false;
    for (var i = 0; i < level.pieces.length; i++) {
      var id = level.pieces[i];
      var v = raw[id];
      if (!v || !isFinite(v[0]) || !isFinite(v[1]) || !isFinite(v[2])) return false;
      if (Math.abs(v[0]) > 12 || Math.abs(v[1]) > 12 || Math.abs(v[2]) > 12) return false;
    }
    return true;
  }

  NS.geometry = {
    DIRS: DIRS,
    key: key,
    cellKey: cellKey,
    zero: zero,
    cloneOffsets: cloneOffsets,
    cloneFlags: cloneFlags,
    sameOffset: sameOffset,
    add: add,
    subtract: subtract,
    maxAbs: maxAbs,
    isOut: isOut,
    pieceById: pieceById,
    shiftedCells: shiftedCells,
    occupancy: occupancy,
    collision: collision,
    canStep: canStep,
    pullToOut: pullToOut,
    pathToTarget: pathToTarget,
    anyMove: anyMove,
    countProgress: countProgress,
    validateOffsets: validateOffsets
  };
})(window);
