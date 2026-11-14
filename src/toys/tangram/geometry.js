/*
 * 解物 · 卷三 七巧板几何内核
 *
 * 只做纯几何：位姿变换、面积、包含、重叠、吸附。
 * 不碰 DOM，也不读存档；关卡与渲染都在别处。
 *
 * 坐标：以「七巧方」边长 4 为 1 个基准单位。
 * 七块板都是凸多边形；平行四边形允许翻面。
 */
(function (global) {
  'use strict';

  var JW = global.JW || (global.JW = {});
  JW.toys = JW.toys || {};
  var NS = JW.toys.tangram = JW.toys.tangram || {};

  var EPS = 1e-7;
  var SAMPLE_STEP = 0.125;

  function rad(deg) {
    return deg * Math.PI / 180;
  }

  function normRot(deg) {
    var r = Number(deg) || 0;
    r = r % 360;
    if (r < 0) r += 360;
    if (Math.abs(r - 360) < EPS) r = 0;
    return r;
  }

  function snapRot(deg) {
    return normRot(Math.round((Number(deg) || 0) / 45) * 45);
  }

  function snapGrid(v, step) {
    var s = step || 0.25;
    return Math.round((Number(v) || 0) / s) * s;
  }

  function bbox(poly) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    poly.forEach(function (p) {
      if (p[0] < minX) minX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] > maxY) maxY = p[1];
    });
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY, w: maxX - minX, h: maxY - minY };
  }

  function area(poly) {
    var s = 0;
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      s += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(s) / 2;
  }

  function centroid(poly) {
    var s = 0, cx = 0, cy = 0;
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      var cross = a[0] * b[1] - b[0] * a[1];
      s += cross;
      cx += (a[0] + b[0]) * cross;
      cy += (a[1] + b[1]) * cross;
    }
    if (Math.abs(s) < EPS) return [0, 0];
    return [cx / (3 * s), cy / (3 * s)];
  }

  /*
   * 位姿：{ x, y, rot, flip }。
   * 原点取 shape[0]（锚点），先翻面，再旋转，最后平移到 (x, y)。
   */
  function place(shape, pose) {
    var ax = shape[0][0], ay = shape[0][1];
    var t = rad(pose.rot || 0);
    var cos = Math.cos(t), sin = Math.sin(t);
    var flip = pose.flip ? -1 : 1;
    return shape.map(function (p) {
      var rx = (p[0] - ax) * flip;
      var ry = (p[1] - ay);
      return [
        (Number(pose.x) || 0) + rx * cos - ry * sin,
        (Number(pose.y) || 0) + rx * sin + ry * cos
      ];
    });
  }

  function normalizePose(pose) {
    return {
      x: snapGrid(pose.x, 0.25),
      y: snapGrid(pose.y, 0.25),
      rot: snapRot(pose.rot),
      flip: !!pose.flip
    };
  }

  function samePose(a, b, tol) {
    var t = tol == null ? 0.08 : tol;
    if (!a || !b) return false;
    if (!!a.flip !== !!b.flip) return false;
    if (Math.abs(normRot(a.rot) - normRot(b.rot)) > 0.5 &&
        Math.abs(normRot(a.rot) - normRot(b.rot)) < 359.5) return false;
    return Math.abs(a.x - b.x) <= t && Math.abs(a.y - b.y) <= t;
  }

  function pointOnSegment(p, a, b) {
    var cross = (p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0]);
    if (Math.abs(cross) > 1e-6) return false;
    var dot = (p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1]);
    if (dot < -1e-6) return false;
    var len = (b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]);
    return dot <= len + 1e-6;
  }

  function pointInPolygon(p, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[j], b = poly[i];
      if (pointOnSegment(p, a, b)) return true;
      if (((a[1] > p[1]) !== (b[1] > p[1])) &&
          (p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0])) {
        inside = !inside;
      }
    }
    return inside;
  }

  function pointInUnion(p, polys) {
    for (var i = 0; i < polys.length; i++) {
      if (pointInPolygon(p, polys[i])) return true;
    }
    return false;
  }

  function project(poly, axis) {
    var min = Infinity, max = -Infinity;
    poly.forEach(function (p) {
      var v = p[0] * axis[0] + p[1] * axis[1];
      if (v < min) min = v;
      if (v > max) max = v;
    });
    return { min: min, max: max };
  }

  // SAT：共享边 / 只碰一个角不算重叠。
  function overlap(a, b) {
    var polys = [a, b];
    for (var k = 0; k < 2; k++) {
      var poly = polys[k];
      for (var i = 0; i < poly.length; i++) {
        var p = poly[i], q = poly[(i + 1) % poly.length];
        var nx = -(q[1] - p[1]);
        var ny = q[0] - p[0];
        var len = Math.sqrt(nx * nx + ny * ny);
        if (len < EPS) continue;
        nx /= len; ny /= len;
        var ia = project(a, [nx, ny]);
        var ib = project(b, [nx, ny]);
        if (ia.max <= ib.min + 1e-6 || ib.max <= ia.min + 1e-6) return false;
      }
    }
    return true;
  }

  function overlapAny(poly, polys, skip) {
    for (var i = 0; i < polys.length; i++) {
      if (skip && skip[i]) continue;
      if (overlap(poly, polys[i])) return i;
    }
    return -1;
  }

  function samplePoints(poly) {
    var box = bbox(poly);
    var pts = poly.slice();
    var c = centroid(poly);
    pts.push(c);
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      pts.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
      pts.push([a[0] * 0.75 + c[0] * 0.25, a[1] * 0.75 + c[1] * 0.25]);
      pts.push([a[0] * 0.25 + c[0] * 0.75, a[1] * 0.25 + c[1] * 0.75]);
    }
    var x, y;
    for (y = box.minY + SAMPLE_STEP / 2; y < box.maxY; y += SAMPLE_STEP) {
      for (x = box.minX + SAMPLE_STEP / 2; x < box.maxX; x += SAMPLE_STEP) {
        if (pointInPolygon([x, y], poly)) pts.push([x, y]);
      }
    }
    return pts;
  }

  // 整块都在剪影里（剪影是若干参考板片的并集）。
  function insideUnion(poly, targets) {
    var pts = samplePoints(poly);
    for (var i = 0; i < pts.length; i++) {
      if (!pointInUnion(pts[i], targets)) return false;
    }
    return true;
  }

  // 全体板片恰好铺满：都在剪影内，且两两不重叠。
  function coversTarget(polys, targets) {
    var i;
    for (i = 0; i < polys.length; i++) {
      if (!insideUnion(polys[i], targets)) return false;
    }
    for (i = 0; i < polys.length; i++) {
      for (var j = i + 1; j < polys.length; j++) {
        if (overlap(polys[i], polys[j])) return false;
      }
    }
    return true;
  }

  // 在同类目标位姿附近时磁吸到精确位姿；否则只吸到 0.25 格与 45°。
  function snapToTargets(pose, targets, tol) {
    var p = normalizePose(pose);
    var best = null;
    var bestD = Infinity;
    (targets || []).forEach(function (t) {
      if (t.type && pose.type && t.type !== pose.type) return;
      if (!!t.flip !== !!p.flip) return;
      if (normRot(t.rot) !== p.rot) return;
      var d = Math.abs(t.x - p.x) + Math.abs(t.y - p.y);
      if (d <= (tol == null ? 0.75 : tol) && d < bestD) {
        best = { x: t.x, y: t.y, rot: normRot(t.rot), flip: !!t.flip };
        bestD = d;
      }
    });
    return best || p;
  }

  NS.geometry = {
    EPS: EPS,
    rad: rad,
    normRot: normRot,
    snapRot: snapRot,
    snapGrid: snapGrid,
    bbox: bbox,
    area: area,
    centroid: centroid,
    place: place,
    normalizePose: normalizePose,
    samePose: samePose,
    pointInPolygon: pointInPolygon,
    pointInUnion: pointInUnion,
    overlap: overlap,
    overlapAny: overlapAny,
    samplePoints: samplePoints,
    insideUnion: insideUnion,
    coversTarget: coversTarget,
    snapToTargets: snapToTargets
  };
})(window);
