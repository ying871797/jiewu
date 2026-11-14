/*
 * 解物 · 卷二 数局 · 滑块求解器
 *
 * 状态 = 长度 n² 的数组，tiles[pos] 为数字，0 表示空格。
 * 目标 = 1…n²−1 依次排好，空格在右下。
 *
 * 可解性用逆序数判奇偶：奇数阶只要求逆序数为偶；偶数阶还要加上空格
 * 从底部数的行号，二者之和为奇。
 *
 * 提示与演示用「加权 A*」找一条可行解，不冒充最优：
 * 15-puzzle 的最优解本身是 NP-hard 的搜索问题，24-puzzle 更甚。
 * 启发式是曼哈顿距离 + 线性冲突，权重 3；超过节点上限就老实返回失败。
 */
(function (global) {
  'use strict';

  var JW = global.JW || (global.JW = {});
  JW.toys = JW.toys || {};
  var NS = JW.toys.huarong = JW.toys.huarong || {};

  var DIRS = [
    { id: 'up',    dr: -1, dc: 0, name: '上' },
    { id: 'down',  dr: 1,  dc: 0, name: '下' },
    { id: 'left',  dr: 0,  dc: -1, name: '左' },
    { id: 'right', dr: 0,  dc: 1,  name: '右' }
  ];

  function solved(n) {
    var out = new Array(n * n);
    for (var i = 0; i < n * n - 1; i++) out[i] = i + 1;
    out[n * n - 1] = 0;
    return out;
  }

  function isSolved(state, n) {
    for (var i = 0; i < n * n - 1; i++) {
      if (state[i] !== i + 1) return false;
    }
    return state[n * n - 1] === 0;
  }

  function valid(state, n) {
    if (!Array.isArray(state) || state.length !== n * n) return false;
    var seen = new Array(n * n);
    for (var i = 0; i < state.length; i++) {
      var v = state[i];
      if (typeof v !== 'number' || v % 1 !== 0 || v < 0 || v >= n * n || seen[v]) return false;
      seen[v] = true;
    }
    return true;
  }

  function isSolvable(state, n) {
    if (!valid(state, n)) return false;
    var inv = 0;
    for (var i = 0; i < state.length; i++) {
      if (!state[i]) continue;
      for (var j = i + 1; j < state.length; j++) {
        if (state[j] && state[j] < state[i]) inv++;
      }
    }
    if (n % 2 === 1) return inv % 2 === 0;
    var blank = state.indexOf(0);
    var rowFromBottom = n - ((blank / n) | 0);
    return (inv + rowFromBottom) % 2 === 1;
  }

  function manhattan(state, n) {
    var h = 0;
    for (var p = 0; p < state.length; p++) {
      var v = state[p];
      if (!v) continue;
      var g = v - 1;
      h += Math.abs(((p / n) | 0) - ((g / n) | 0)) + Math.abs((p % n) - (g % n));
    }
    return h;
  }

  function linearConflict(state, n) {
    var h = manhattan(state, n);
    var r, c, i, j;

    for (r = 0; r < n; r++) {
      var row = [];
      for (c = 0; c < n; c++) {
        var v = state[r * n + c];
        if (v && ((v - 1) / n | 0) === r) row.push([(v - 1) % n, c]);
      }
      for (i = 0; i < row.length; i++) {
        for (j = i + 1; j < row.length; j++) {
          if (row[i][1] > row[j][1] && row[i][0] < row[j][0]) h += 2;
        }
      }
    }

    for (c = 0; c < n; c++) {
      var col = [];
      for (r = 0; r < n; r++) {
        var w = state[r * n + c];
        if (w && (w - 1) % n === c) col.push([((w - 1) / n) | 0, r]);
      }
      for (i = 0; i < col.length; i++) {
        for (j = i + 1; j < col.length; j++) {
          if (col[i][1] > col[j][1] && col[i][0] < col[j][0]) h += 2;
        }
      }
    }
    return h;
  }

  function heapPush(heap, node) {
    heap.push(node);
    var i = heap.length - 1;
    while (i > 0) {
      var p = (i - 1) >> 1;
      var a = heap[p];
      var b = heap[i];
      if (a.f < b.f || (a.f === b.f && a.g >= b.g)) break;
      heap[p] = b;
      heap[i] = a;
      i = p;
    }
  }

  function heapPop(heap) {
    var top = heap[0];
    var last = heap.pop();
    if (!heap.length) return top;
    heap[0] = last;
    var i = 0;
    while (true) {
      var l = i * 2 + 1;
      var r = l + 1;
      var best = i;
      if (l < heap.length && (heap[l].f < heap[best].f ||
          (heap[l].f === heap[best].f && heap[l].g > heap[best].g))) best = l;
      if (r < heap.length && (heap[r].f < heap[best].f ||
          (heap[r].f === heap[best].f && heap[r].g > heap[best].g))) best = r;
      if (best === i) break;
      var tmp = heap[i];
      heap[i] = heap[best];
      heap[best] = tmp;
      i = best;
    }
    return top;
  }

  function solve(state, n, opts) {
    opts = opts || {};
    var weight = opts.weight || 3;
    var maxNodes = opts.maxNodes || (n <= 3 ? 120000 : n === 4 ? 350000 : 320000);

    var start = state.slice();
    if (isSolved(start, n)) {
      return { distance: 0, moves: [], limitHit: false, nodes: 0 };
    }

    var startKey = start.join(',');
    var h0 = linearConflict(start, n);
    var heap = [];
    heapPush(heap, { key: startKey, state: start, g: 0, h: h0, f: weight * h0 });

    var bestG = Object.create(null);
    bestG[startKey] = 0;
    var parent = Object.create(null);
    parent[startKey] = { prev: null, move: null };
    var expanded = 0;

    while (heap.length) {
      var node = heapPop(heap);
      if (node.g !== bestG[node.key]) continue;
      if (node.h === 0) {
        var path = [];
        var walk = node.key;
        while (parent[walk] && parent[walk].prev !== null) {
          path.push(parent[walk].move);
          walk = parent[walk].prev;
        }
        path.reverse();
        return { distance: path.length, moves: path, limitHit: false, nodes: expanded };
      }
      if (++expanded > maxNodes) break;

      var blank = node.state.indexOf(0);
      var br = (blank / n) | 0;
      var bc = blank % n;

      for (var d = 0; d < DIRS.length; d++) {
        var nr = br + DIRS[d].dr;
        var nc = bc + DIRS[d].dc;
        if (nr < 0 || nc < 0 || nr >= n || nc >= n) continue;
        var np = nr * n + nc;
        var moved = node.state[np];
        var child = node.state.slice();
        child[blank] = moved;
        child[np] = 0;

        var key = child.join(',');
        var ng = node.g + 1;
        if (bestG[key] !== undefined && bestG[key] <= ng) continue;
        bestG[key] = ng;

        parent[key] = {
          prev: node.key,
          move: { value: moved, from: np, to: blank, dir: DIRS[d].id }
        };
        var h = linearConflict(child, n);
        heapPush(heap, { key: key, state: child, g: ng, h: h, f: ng + weight * h });
      }
    }

    return { distance: Infinity, moves: [], limitHit: true, nodes: expanded };
  }

  /* ───────── 生成一盘可解的乱序 ───────── */

  function seedRand(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generate(n, seed, depth) {
    var rand = seedRand(seed);
    var state = solved(n);
    var blank = n * n - 1;
    var prev = -1;

    for (var k = 0; k < depth; k++) {
      var r = (blank / n) | 0;
      var c = blank % n;
      var cands = [];
      for (var d = 0; d < DIRS.length; d++) {
        var nr = r + DIRS[d].dr;
        var nc = c + DIRS[d].dc;
        if (nr < 0 || nc < 0 || nr >= n || nc >= n) continue;
        var np = nr * n + nc;
        if (np === prev) continue;
        cands.push(np);
      }
      var pick = cands[(rand() * cands.length) | 0];
      state[blank] = state[pick];
      state[pick] = 0;
      prev = blank;
      blank = pick;
    }

    if (isSolved(state, n) || !isSolvable(state, n)) {
      return generate(n, seed + 0x9e3779b9, depth);
    }
    return state;
  }

  function describe(move) {
    var dir = '移动';
    for (var i = 0; i < DIRS.length; i++) {
      if (DIRS[i].id === move.dir) { dir = DIRS[i].name; break; }
    }
    return {
      value: move.value,
      dir: dir,
      text: '把「' + move.value + '」向' + dir + '滑一格'
    };
  }

  NS.sliding = {
    DIRS: DIRS,
    solved: solved,
    isSolved: isSolved,
    valid: valid,
    isSolvable: isSolvable,
    manhattan: manhattan,
    heuristic: linearConflict,
    solve: solve,
    generate: generate,
    describe: describe
  };
})(window);
