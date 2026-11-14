/*
 * 解物 · 卷二 华容道 · 求解器
 *
 * 状态 = 每块棋子左上角的格号（row * 4 + col），同形棋子按组排序规范化。
 * 三种「一步」：unit（单格）/ straight（直线）/ finger（指步，可转弯）。
 * 只做单局 BFS：从当前局面搜到「曹操到达出口」，按需计算，不预载 25,955 状态表。
 */
(function (global) {
  'use strict';

  var JW = global.JW || (global.JW = {});
  JW.toys = JW.toys || {};
  var NS = JW.toys.huarong = JW.toys.huarong || {};

  var ROWS = 5;
  var COLS = 4;
  var CELLS = ROWS * COLS;
  var DIRS = [
    { id: 'up',    dr: -1, dc: 0, name: '上' },
    { id: 'down',  dr: 1,  dc: 0, name: '下' },
    { id: 'left',  dr: 0,  dc: -1, name: '左' },
    { id: 'right', dr: 0,  dc: 1,  name: '右' }
  ];

  function rowOf(pos) { return (pos / COLS) | 0; }
  function colOf(pos) { return pos % COLS; }

  function maskAt(model, w, h, pos) {
    var key = w + 'x' + h;
    var table = model.masks[key];
    if (!table) {
      table = model.masks[key] = new Array(CELLS);
    }
    if (table[pos] !== undefined) return table[pos];
    var r = rowOf(pos);
    var c = colOf(pos);
    if (r < 0 || c < 0 || r + h > ROWS || c + w > COLS) {
      table[pos] = 0;
      return 0;
    }
    var m = 0;
    for (var dr = 0; dr < h; dr++) {
      for (var dc = 0; dc < w; dc++) {
        m |= 1 << ((r + dr) * COLS + (c + dc));
      }
    }
    table[pos] = m;
    return m;
  }

  function canon(state, groups) {
    var out = state.slice();
    for (var g = 0; g < groups.length; g++) {
      var group = groups[g];
      if (group.length < 2) continue;
      var vals = [];
      for (var j = 0; j < group.length; j++) vals.push(out[group[j]]);
      vals.sort(function (a, b) { return a - b; });
      for (var k = 0; k < group.length; k++) out[group[k]] = vals[k];
    }
    return out;
  }

  function stateKey(state) { return state.join(','); }

  function compile(level) {
    var pieces = level.pieces.map(function (p) {
      var t = JW.data.huarong.types[p.type];
      return {
        type: p.type,
        label: t.label,
        tone: t.tone,
        w: t.w,
        h: t.h,
        at: p.at.slice()
      };
    });
    var groups = [];
    var groupOf = [];
    var shapeIndex = {};
    var shapes = pieces.map(function (p, i) {
      var sk = p.w + 'x' + p.h;
      if (shapeIndex[sk] === undefined) {
        shapeIndex[sk] = groups.length;
        groups.push([]);
      }
      groupOf[i] = shapeIndex[sk];
      groups[shapeIndex[sk]].push(i);
      return { w: p.w, h: p.h, key: sk };
    });

    var cao = -1;
    for (var i = 0; i < pieces.length; i++) {
      if (pieces[i].type === 'cao') { cao = i; break; }
    }
    if (cao < 0) throw new Error('华容道关卡缺少曹操');

    var start = pieces.map(function (p) { return p.at[0] * COLS + p.at[1]; });
    var model = {
      level: level,
      pieces: pieces,
      shapes: shapes,
      groups: groups,
      groupOf: groupOf,
      cao: cao,
      exit: JW.data.huarong.exit[0] * COLS + JW.data.huarong.exit[1],
      masks: {},
      cache: Object.create(null)
    };
    model.start = canon(start, groups);
    return model;
  }

  function occupancy(model, state) {
    var masks = new Array(state.length);
    var occ = 0;
    for (var i = 0; i < state.length; i++) {
      var m = maskAt(model, model.shapes[i].w, model.shapes[i].h, state[i]);
      masks[i] = m;
      occ |= m;
    }
    return { masks: masks, occ: occ };
  }

  function valid(model, state) {
    if (!Array.isArray(state) || state.length !== model.pieces.length) return false;
    var occ = 0;
    for (var i = 0; i < state.length; i++) {
      var pos = state[i];
      if (typeof pos !== 'number' || pos % 1 !== 0 || pos < 0 || pos >= CELLS) return false;
      var m = maskAt(model, model.shapes[i].w, model.shapes[i].h, pos);
      if (!m || (m & occ)) return false;
      occ |= m;
    }
    return true;
  }

  function isGoal(model, state) {
    return state[model.cao] === model.exit;
  }

  function applyMove(model, state, move) {
    var ns = state.slice();
    var group = model.groups[move.g];
    for (var j = 0; j < group.length; j++) {
      var idx = group[j];
      if (ns[idx] === move.from) {
        ns[idx] = move.to;
        return canon(ns, model.groups);
      }
    }
    return null;
  }

  function slide(model, state, index, dr, dc) {
    var occ = occupancy(model, state);
    var other = occ.occ ^ occ.masks[index];
    var sh = model.shapes[index];
    var r = rowOf(state[index]);
    var c = colOf(state[index]);
    var route = [];
    while (true) {
      var nr = r + dr;
      var nc = c + dc;
      if (nr < 0 || nc < 0 || nr + sh.h > ROWS || nc + sh.w > COLS) break;
      var np = nr * COLS + nc;
      if (maskAt(model, sh.w, sh.h, np) & other) break;
      route.push(np);
      r = nr;
      c = nc;
    }
    return route;
  }

  function fingerRoutes(model, state, index) {
    var occ = occupancy(model, state);
    var other = occ.occ ^ occ.masks[index];
    var sh = model.shapes[index];
    var start = state[index];
    var seen = new Array(CELLS);
    var parent = new Array(CELLS);
    for (var i = 0; i < CELLS; i++) { seen[i] = false; parent[i] = -1; }
    var queue = [start];
    var head = 0;
    seen[start] = true;
    while (head < queue.length) {
      var p = queue[head++];
      var r = rowOf(p);
      var c = colOf(p);
      for (var d = 0; d < DIRS.length; d++) {
        var nr = r + DIRS[d].dr;
        var nc = c + DIRS[d].dc;
        if (nr < 0 || nc < 0 || nr + sh.h > ROWS || nc + sh.w > COLS) continue;
        var np = nr * COLS + nc;
        if (seen[np]) continue;
        if (maskAt(model, sh.w, sh.h, np) & other) continue;
        seen[np] = true;
        parent[np] = p;
        queue.push(np);
      }
    }
    var out = [];
    for (var q = 0; q < CELLS; q++) {
      if (!seen[q] || q === start) continue;
      var route = [];
      var cur = q;
      while (cur !== start && cur !== -1) {
        route.push(cur);
        cur = parent[cur];
      }
      route.reverse();
      out.push(route);
    }
    return out;
  }

  function neighbors(model, state, metric) {
    var occ = occupancy(model, state);
    var out = [];
    for (var i = 0; i < state.length; i++) {
      var sh = model.shapes[i];
      var other = occ.occ ^ occ.masks[i];
      var g = model.groupOf[i];
      var from = state[i];

      if (metric === 'finger') {
        var routes = fingerRoutes(model, state, i);
        for (var rr = 0; rr < routes.length; rr++) {
          var route = routes[rr];
          var nsF = state.slice();
          nsF[i] = route[route.length - 1];
          out.push({
            state: canon(nsF, model.groups),
            move: { g: g, from: from, to: route[route.length - 1], cells: route.length, dir: null, route: route }
          });
        }
        continue;
      }

      for (var d = 0; d < DIRS.length; d++) {
        var dir = DIRS[d];
        var r = rowOf(from);
        var c = colOf(from);
        var stepRoute = [];
        while (true) {
          var nr = r + dir.dr;
          var nc = c + dir.dc;
          if (nr < 0 || nc < 0 || nr + sh.h > ROWS || nc + sh.w > COLS) break;
          var np = nr * COLS + nc;
          if (maskAt(model, sh.w, sh.h, np) & other) break;
          stepRoute.push(np);
          r = nr;
          c = nc;
          // 直线步允许停在途中任意空位；每个落点都是一条一步边。
          var nsS = state.slice();
          nsS[i] = np;
          out.push({
            state: canon(nsS, model.groups),
            move: {
              g: g, from: from, to: np,
              cells: stepRoute.length, dir: dir.id, route: stepRoute.slice()
            }
          });
          if (metric === 'unit') break;
        }
      }
    }
    return out;
  }

  function solve(model, state, metric) {
    metric = metric || 'straight';
    var start = canon(state, model.groups);
    var startKey = stateKey(start);
    var cacheKey = metric + '|' + startKey;
    if (model.cache[cacheKey]) return model.cache[cacheKey];

    if (isGoal(model, start)) {
      var zero = { distance: 0, moves: [] };
      model.cache[cacheKey] = zero;
      return zero;
    }

    var prev = Object.create(null);
    var queue = [start];
    var head = 0;
    prev[startKey] = null;
    var goalState = null;
    var goalKey = null;

    while (head < queue.length) {
      var cur = queue[head++];
      var curKey = stateKey(cur);
      var list = neighbors(model, cur, metric);
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        var k = stateKey(item.state);
        if (prev[k] !== undefined) continue;
        prev[k] = { from: curKey, state: cur, move: item.move };
        if (isGoal(model, item.state)) {
          goalState = item.state;
          goalKey = k;
          break;
        }
        queue.push(item.state);
      }
      if (goalState) break;
    }

    var result;
    if (!goalState) {
      result = { distance: Infinity, moves: [] };
    } else {
      var moves = [];
      var walk = goalKey;
      while (prev[walk]) {
        moves.push(prev[walk].move);
        walk = prev[walk].from;
      }
      moves.reverse();
      result = { distance: moves.length, moves: moves };
    }

    var keys = Object.keys(model.cache);
    if (keys.length > 48) {
      keys.forEach(function (k) { delete model.cache[k]; });
    }
    model.cache[cacheKey] = result;
    return result;
  }

  function describe(model, move) {
    var group = model.groups[move.g];
    var label = model.pieces[group[0]].label;
    var route = move.route || [move.to];
    var first = route[0];
    var dr = rowOf(first) - rowOf(move.from);
    var dc = colOf(first) - colOf(move.from);
    var dir = '移动';
    if (dr < 0) dir = '上';
    else if (dr > 0) dir = '下';
    else if (dc < 0) dir = '左';
    else if (dc > 0) dir = '右';
    var turns = false;
    for (var i = 1; i < route.length; i++) {
      var pdr = rowOf(route[i]) - rowOf(route[i - 1]);
      var pdc = colOf(route[i]) - colOf(route[i - 1]);
      if ((pdr && pdr !== dr) || (pdc && pdc !== dc)) { turns = true; break; }
    }
    var cells = route.length;
    var text;
    if (turns) {
      text = '把「' + label + '」沿空位绕行 ' + cells + ' 格';
    } else if (cells > 1) {
      text = '把「' + label + '」向' + dir + '推 ' + cells + ' 格';
    } else {
      text = '把「' + label + '」向' + dir + '推 1 格';
    }
    return { label: label, dir: dir, cells: cells, turns: turns, text: text };
  }

  NS.solver = {
    ROWS: ROWS,
    COLS: COLS,
    CELLS: CELLS,
    DIRS: DIRS,
    rowOf: rowOf,
    colOf: colOf,
    compile: compile,
    canon: canon,
    key: stateKey,
    valid: valid,
    isGoal: isGoal,
    applyMove: applyMove,
    slide: slide,
    neighbors: neighbors,
    solve: solve,
    describe: describe
  };
})(window);
