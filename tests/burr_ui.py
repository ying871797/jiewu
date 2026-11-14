#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
解物 · 卷四 鲁班锁 UI 回归测试（零依赖）

用无头 Edge 打开 dist/index.html?play=burr，验证：
1. 深链直接进入卷四，三维视图真实出像素；
2. 键盘选件、轴向移动、阻挡提示、撤销、提示；
3. 八关都能按标准序列拆下并胜利（含四象、八方、十全、十二楼别式）；
4. 装模式从散开位逐根归位，全部锁定即胜，散开位互不重叠；
5. 演示从关卡起点播放、不计成绩；
6. 选关 / 说明 / 对比 / 拆装切换 / 馆入口往返；
7. 会话独立落在 volumes.burr，重开能续玩；
8. 全程无脚本异常、无横向溢出。

用法：
    python tests/burr_ui.py
    python tests/burr_ui.py --browser "C:/Program Files/Google/Chrome/Application/chrome.exe"
"""

from __future__ import annotations

import argparse
import html
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_BROWSER = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

PROBE = r"""
<script>
window.__errs = [];
window.addEventListener('error', function (e) { window.__errs.push(String(e.message || e)); });
(function () {
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function report(out) {
    var pre = document.createElement('pre');
    pre.id = 'burr-test';
    pre.textContent = JSON.stringify(out);
    document.body.appendChild(pre);
  }
  function show(id) {
    var el = document.getElementById(id);
    return !!(el && el.classList.contains('show'));
  }
  function key(el, k, shift) {
    el.dispatchEvent(new KeyboardEvent('keydown', {
      key: k, shiftKey: !!shift, bubbles: true, cancelable: true
    }));
  }
  function snapDoc() {
    try { return JSON.parse(localStorage.getItem('jiewu.v2')); } catch (e) { return null; }
  }
  function toast() { return (document.getElementById('burrToast') || {}).textContent || ''; }
  function canvasPixels() {
    var c = document.getElementById('burrBoard');
    if (!c || !c.width || !c.height) return 0;
    try {
      var g = c.getContext('2d');
      var d = g.getImageData(0, 0, c.width, c.height).data;
      var n = 0;
      for (var i = 3; i < d.length; i += 4) if (d[i] > 20) n++;
      return n;
    } catch (e) { return -1; }
  }
  function piecePull(b, id) {
    var list = b.pieces();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].pull;
    return null;
  }
  function stepTo(b, id, target) {
    var cur = b.offsets[id];
    return b.step(id, [target[0] - cur[0], target[1] - cur[1], target[2] - cur[2]]);
  }
  async function solveDis(b) {
    var L = b.level;
    var order = L.pullOrder || L.pieces.slice();
    for (var i = 0; i < order.length; i++) {
      var id = order[i];
      if (b.removed[id]) continue;
      var dir = piecePull(b, id) || [0, 0, 1];
      var guard = 0;
      while (!b.removed[id] && guard++ < 10) {
        if (!b.step(id, dir)) break;
      }
    }
    await wait(950);
    return { finished: b.finished, all: b.allRemoved(), moves: b.moves };
  }
  async function solveAsm(b) {
    var L = b.level;
    var order = L.assembleOrder || L.pieces.slice();
    for (var i = 0; i < order.length; i++) {
      var id = order[i];
      var guard = 0;
      while (!b.locked[id] && guard++ < 50) {
        var path = b.pathTo(id);
        if (!path || !path.length) break;
        if (!stepTo(b, id, path[0])) break;
      }
    }
    await wait(950);
    return { finished: b.finished, all: b.allLocked(), moves: b.moves };
  }
  function stageOverlap(b) {
    var seen = {};
    var overlap = null;
    var list = b.pieces();
    for (var i = 0; i < list.length; i++) {
      var cells = b.cellsOf(list[i].id);
      for (var k = 0; k < cells.length; k++) {
        var key = cells[k].join(',');
        if (seen[key] && overlap == null) overlap = [seen[key], list[i].id, key];
        seen[key] = list[i].id;
      }
    }
    return overlap;
  }

  async function collect() {
    var out = {};
    try {
      await wait(650);
      var b = window.__burr;
      var JW = window.JW;
      var phase = (location.search || '').indexOf('phase=2') >= 0 ? 2 : 1;

      out.ok = !!(b && JW && JW.toys.burr && JW.data.burr);
      out.phase = phase;
      out.hubHidden = document.getElementById('hub').hidden;
      out.appHidden = document.getElementById('appBurr').hidden;
      out.version = JW ? JW.VERSION : null;
      out.levels = JW && JW.data.burr ? JW.data.burr.levels.length : null;
      out.errs = window.__errs || [];
      out.overflow = { sw: document.documentElement.scrollWidth, iw: innerWidth };

      if (phase === 2) {
        out.levelIndex = b ? b.levelIndex : null;
        out.level = b && b.level ? b.level.name : null;
        out.mode = b ? b.mode : null;
        out.moves = b ? b.moves : null;
        out.offsets = b ? b.offsets : null;
        out.selected = b ? b.selected : null;
        out.finished = b ? b.finished : null;
        out.winShown = show('burrVeilWin');
        out.canvas = (function () {
          var c = document.getElementById('burrBoard');
          return c ? { w: c.width, h: c.height } : null;
        })();
        out.errs = window.__errs || [];
        report(out);
        return;
      }

      out.levelIndex = b.levelIndex;
      out.level = b.level.name;
      out.mode = b.mode;
      out.pieces = b.pieces().length;
      out.trayChips = document.querySelectorAll('#burrTrayList .burr-chip').length;
      out.offsets0 = b.offsets;
      out.remaining = b.remaining;
      out.threshold = b.threshold;
      out.view = b.view;
      out.canvas = (function () {
        var c = document.getElementById('burrBoard');
        return c ? { w: c.width, h: c.height } : null;
      })();
      out.pixels = canvasPixels();

      /* 1. Tab 选件 + 方向键 + 撤销 + 阻挡 */
      var canvas = document.getElementById('burrBoard');
      var beforeTab = b.selected;
      canvas.focus();
      key(canvas, 'Tab');
      out.tabChanged = b.selected !== beforeTab;
      out.tabSelected = b.selected;

      b.select('A');
      key(canvas, 'ArrowDown');
      out.kbMove = b.moves;
      out.kbZ = (b.offsets.A || [])[2];
      b.undo();
      out.undoMoves = b.moves;
      out.undoZ = (b.offsets.A || [])[2];

      b.select('A');
      var beforeBlock = b.moves;
      key(canvas, 'ArrowUp');
      out.blockedMoves = b.moves - beforeBlock;
      out.blockedToast = toast();

      /* 2. 提示 */
      document.querySelector('.dock [data-burr-act="hint"]').click();
      out.hintCoach = document.getElementById('burrCoach').hidden ? '' : document.getElementById('burrCoachMsg').textContent;
      out.hintSelected = b.selected;
      b.reset();
      out.resetOffsets = b.offsets;
      await wait(80);

      /* 2.5 拖动空白旋转视角并吸附到 90° 档位 */
      var crect = canvas.getBoundingClientRect();
      var ox = crect.left + 8;
      var oy = crect.top + 8;
      canvas.dispatchEvent(new PointerEvent('pointerdown', {
        pointerId: 7, clientX: ox, clientY: oy, bubbles: true, cancelable: true,
        pointerType: 'mouse', buttons: 1
      }));
      globalThis.dispatchEvent(new PointerEvent('pointermove', {
        pointerId: 7, clientX: ox + 170, clientY: oy, bubbles: true, cancelable: true
      }));
      globalThis.dispatchEvent(new PointerEvent('pointerup', {
        pointerId: 7, clientX: ox + 170, clientY: oy, bubbles: true, cancelable: true
      }));
      await wait(500);
      out.orbitYaw = Math.round(b.view.yaw);

      /* 2.6 指针点击选中 + 沿轴拖动拆出 */
      b.reset();
      await wait(140);
      function findPick(id) {
        var r = b.canvasRect();
        for (var gy = 8; gy < r.height - 4; gy += 5) {
          for (var gx = 8; gx < r.width - 4; gx += 5) {
            if (b.pickAt(gx, gy) === id) return { x: r.left + gx, y: r.top + gy };
          }
        }
        return null;
      }
      var pa = findPick('A');
      out.pointerFoundA = !!pa;
      var movesBeforeDrag = b.moves;
      if (pa) {
        canvas.dispatchEvent(new PointerEvent('pointerdown', {
          pointerId: 11, clientX: pa.x, clientY: pa.y, bubbles: true, cancelable: true,
          pointerType: 'mouse', buttons: 1
        }));
        out.pointerSelected = b.selected;
        var zAxis = b.axisScreen('+z');
        var dragLen = Math.max(6, (zAxis || {}).len || 6) * 5.4;
        globalThis.dispatchEvent(new PointerEvent('pointermove', {
          pointerId: 11,
          clientX: pa.x - zAxis.x * dragLen,
          clientY: pa.y - zAxis.y * dragLen,
          bubbles: true, cancelable: true
        }));
        globalThis.dispatchEvent(new PointerEvent('pointerup', {
          pointerId: 11,
          clientX: pa.x - zAxis.x * dragLen,
          clientY: pa.y - zAxis.y * dragLen,
          bubbles: true, cancelable: true
        }));
      }
      out.pointerRemovedA = !!b.removed.A;
      out.pointerZ = (b.offsets.A || [])[2];
      out.pointerMoves = b.moves - movesBeforeDrag;
      b.reset();
      await wait(80);

      /* 3. 三通 · 拆 */
      var dis0 = await solveDis(b);
      out.dis0 = dis0;
      out.dis0Win = show('burrVeilWin');
      out.dis0Title = document.getElementById('burrWinTitle').textContent;
      out.dis0Note = document.getElementById('burrWinNote').textContent;
      out.dis0Progress = (snapDoc().volumes.burr.progress['burr-three'] || {}).modes || null;
      out.dis0Session = snapDoc().volumes.burr.session;
      b.cycle(1);
      out.dis0CycleToast = toast();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await wait(80);

      /* 4. 三通 · 装 */
      b.setMode('asm');
      await wait(80);
      out.asm0Offsets = b.offsets;
      var asm0 = await solveAsm(b);
      out.asm0 = asm0;
      out.asm0Win = show('burrVeilWin');
      out.asm0Title = document.getElementById('burrWinTitle').textContent;
      out.asm0Progress = (snapDoc().volumes.burr.progress['burr-three'] || {}).modes || null;
      b.cycle(1);
      out.asm0CycleToast = toast();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await wait(80);

      /* 5. 六子连芳 · 拆 */
      b.loadLevel(1, { mode: 'dis' });
      await wait(100);
      out.sixPieces = b.pieces().length;
      out.sixRemaining = b.remaining;
      var dis1 = await solveDis(b);
      out.dis1 = dis1;
      out.dis1Win = show('burrVeilWin');
      out.dis1Title = document.getElementById('burrWinTitle').textContent;
      out.dis1Progress = (snapDoc().volumes.burr.progress['burr-six'] || {}).modes || null;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await wait(80);

      /* 6. 六子连芳 · 装：先验散开位互不重叠 */
      b.setMode('asm');
      await wait(100);
      out.sixAsmOffsets = b.offsets;
      out.sixStageOverlap = stageOverlap(b);
      var asm1 = await solveAsm(b);
      out.asm1 = asm1;
      out.asm1Win = show('burrVeilWin');
      out.asm1Title = document.getElementById('burrWinTitle').textContent;
      out.asm1Progress = (snapDoc().volumes.burr.progress['burr-six'] || {}).modes || null;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await wait(80);

      /* 6.5 六合 · 拆：装配态先验无重叠 */
      b.loadLevel(2, { mode: 'dis' });
      await wait(120);
      out.platePieces = b.pieces().length;
      out.plateRemaining = b.remaining;
      out.plateAssembledOverlap = stageOverlap(b);
      var dis2 = await solveDis(b);
      out.dis2 = dis2;
      out.dis2Win = show('burrVeilWin');
      out.dis2Title = document.getElementById('burrWinTitle').textContent;
      out.dis2Progress = (snapDoc().volumes.burr.progress['burr-sixplate'] || {}).modes || null;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await wait(80);

      /* 6.6 六合 · 装：散开位互不重叠 */
      b.setMode('asm');
      await wait(120);
      out.plateAsmOffsets = b.offsets;
      out.plateStageOverlap = stageOverlap(b);
      var asm2 = await solveAsm(b);
      out.asm2 = asm2;
      out.asm2Win = show('burrVeilWin');
      out.asm2Title = document.getElementById('burrWinTitle').textContent;
      out.asm2Progress = (snapDoc().volumes.burr.progress['burr-sixplate'] || {}).modes || null;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await wait(80);

      /* 6.7 九重 · 拆：装配态先验无重叠 */
      b.loadLevel(3, { mode: 'dis' });
      await wait(150);
      out.ninePieces = b.pieces().length;
      out.nineAssembledOverlap = stageOverlap(b);
      var dis3 = await solveDis(b);
      out.dis3 = dis3;
      out.dis3Win = show('burrVeilWin');
      out.dis3Title = document.getElementById('burrWinTitle').textContent;
      out.dis3Progress = (snapDoc().volumes.burr.progress['burr-nine'] || {}).modes || null;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await wait(80);

      /* 6.8 九重 · 装：散开位互不重叠 */
      b.setMode('asm');
      await wait(150);
      out.nineAsmOffsets = b.offsets;
      out.nineStageOverlap = stageOverlap(b);
      var asm3 = await solveAsm(b);
      out.asm3 = asm3;
      out.asm3Win = show('burrVeilWin');
      out.asm3Title = document.getElementById('burrWinTitle').textContent;
      out.asm3Progress = (snapDoc().volumes.burr.progress['burr-nine'] || {}).modes || null;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await wait(80);

      /* 6.9 别式四关：四象 / 八方 / 十全 / 十二楼 */
      var extraLevels = [
        { index: 4, key: 'four' },
        { index: 5, key: 'eight' },
        { index: 6, key: 'ten' },
        { index: 7, key: 'twelve' }
      ];
      for (var ei = 0; ei < extraLevels.length; ei++) {
        var cfg = extraLevels[ei];
        var k = cfg.key;
        b.loadLevel(cfg.index, { mode: 'dis' });
        await wait(150);
        out[k + 'Id'] = b.level.id;
        out[k + 'Pieces'] = b.pieces().length;
        out[k + 'AssembledOverlap'] = stageOverlap(b);
        out[k + 'Dis'] = await solveDis(b);
        out[k + 'DisWin'] = show('burrVeilWin');
        out[k + 'DisTitle'] = document.getElementById('burrWinTitle').textContent;
        out[k + 'DisProgress'] = (snapDoc().volumes.burr.progress[b.level.id] || {}).modes || null;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await wait(80);

        b.setMode('asm');
        await wait(150);
        out[k + 'AsmOffsets'] = b.offsets;
        out[k + 'StageOverlap'] = stageOverlap(b);
        out[k + 'Asm'] = await solveAsm(b);
        out[k + 'AsmWin'] = show('burrVeilWin');
        out[k + 'AsmTitle'] = document.getElementById('burrWinTitle').textContent;
        out[k + 'AsmProgress'] = (snapDoc().volumes.burr.progress[b.level.id] || {}).modes || null;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await wait(80);
      }

      /* 7. 演示：三通拆，不计成绩 */
      b.loadLevel(0, { mode: 'dis' });
      await wait(100);
      var progressBeforeDemo = JSON.stringify(snapDoc().volumes.burr.progress || {});
      document.querySelector('.dock [data-burr-act="demo"]').click();
      out.demoStarted = b.demoing;
      await wait(3200);
      out.demoFinished = b.finished;
      out.demoWin = show('burrVeilWin');
      out.demoNote = document.getElementById('burrWinNote').textContent;
      out.demoProgressSame = progressBeforeDemo === JSON.stringify(snapDoc().volumes.burr.progress || {});
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await wait(80);

      /* 7.5 六合演示：从装配态按标准序列拆完，不计成绩 */
      b.loadLevel(2, { mode: 'dis' });
      await wait(120);
      var plateProgressBefore = JSON.stringify(snapDoc().volumes.burr.progress || {});
      document.querySelector('.dock [data-burr-act="demo"]').click();
      out.plateDemoStarted = b.demoing;
      await wait(4800);
      out.plateDemoFinished = b.finished;
      out.plateDemoWin = show('burrVeilWin');
      out.plateDemoProgressSame = plateProgressBefore === JSON.stringify(snapDoc().volumes.burr.progress || {});
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await wait(80);

      /* 7.7 九重演示：九件长链从装配态拆完，不计成绩 */
      b.loadLevel(3, { mode: 'dis' });
      await wait(150);
      var nineProgressBefore = JSON.stringify(snapDoc().volumes.burr.progress || {});
      document.querySelector('.dock [data-burr-act="demo"]').click();
      out.nineDemoStarted = b.demoing;
      await wait(7000);
      out.nineDemoFinished = b.finished;
      out.nineDemoWin = show('burrVeilWin');
      out.nineDemoProgressSame = nineProgressBefore === JSON.stringify(snapDoc().volumes.burr.progress || {});
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await wait(80);

      /* 7.9 十二楼演示：十二件长链从装配态拆完，不计成绩 */
      b.loadLevel(7, { mode: 'dis' });
      await wait(150);
      var twelveProgressBefore = JSON.stringify(snapDoc().volumes.burr.progress || {});
      document.querySelector('.dock [data-burr-act="demo"]').click();
      out.twelveDemoStarted = b.demoing;
      await wait(11000);
      out.twelveDemoFinished = b.finished;
      out.twelveDemoWin = show('burrVeilWin');
      out.twelveDemoProgressSame = twelveProgressBefore === JSON.stringify(snapDoc().volumes.burr.progress || {});
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await wait(80);

      /* 8. 选关 / 说明 / 对比 / 拆装按钮 */
      document.querySelector('.rail-right [data-burr-act="levels"]').click();
      out.levelsShown = show('burrVeilLevels');
      out.levelButtons = document.querySelectorAll('#burrLevelGrid .lv').length;
      out.levelNames = Array.prototype.map.call(
        document.querySelectorAll('#burrLevelGrid .lv .n'),
        function (el) { return el.textContent; });
      document.querySelector('#burrLevelGrid [data-burr-level="1"]').click();
      out.levelSwitch = b.level.name;
      out.levelSwitchClosed = !show('burrVeilLevels');
      out.levelSwitchPieces = b.pieces().length;

      document.querySelector('.dock [data-burr-act="help"]').click();
      out.helpShown = show('burrVeilHelp');
      document.querySelector('#burrVeilHelp [data-burr-act="closeVeil"]').click();
      out.helpClosed = !show('burrVeilHelp');

      var hcBefore = document.documentElement.classList.contains('hc');
      document.querySelector('.rail-right [data-burr-act="contrast"]').click();
      out.hcToggled = document.documentElement.classList.contains('hc') !== hcBefore;
      document.querySelector('.rail-right [data-burr-act="contrast"]').click();

      document.querySelector('.rail-right [data-burr-act="mode"][data-mode="dis"]').click();
      out.modeDis = b.mode;
      document.querySelector('.rail-right [data-burr-act="mode"][data-mode="asm"]').click();
      out.modeAsm = b.mode;
      document.querySelector('.rail-right [data-burr-act="mode"][data-mode="dis"]').click();
      out.modeBack = b.mode;

      /* 9. 馆入口往返 */
      out.hubBtn = !!document.getElementById('btnHub');
      out.hubOpenBefore = JW.hub.isOpen();
      out.appInertBefore = document.getElementById('appBurr').hasAttribute('inert');
      document.getElementById('btnHub').click();
      out.hubOpen = !document.getElementById('hub').hidden;
      out.hubIsOpen = JW.hub.isOpen();
      out.hubInert = document.getElementById('appBurr').hasAttribute('inert');
      JW.hub.select('burr');
      out.hubCard = (document.querySelector('#hub .hub-item[data-hub-id="burr"]') || {}).getAttribute
        ? document.querySelector('#hub .hub-item[data-hub-id="burr"]').getAttribute('data-status') : null;
      out.hubDetail = (document.querySelector('#hub .hub-label') || {}).textContent || '';
      out.hubSessionLine = (document.querySelector('#hub .hub-session') || {}).textContent || '';
      JW.hub.close();
      out.hubClosed = document.getElementById('hub').hidden;
      out.appBack = !document.getElementById('appBurr').hidden;
      out.inertBack = document.getElementById('appBurr').hasAttribute('inert');

      /* 10. 留一个未完成会话 */
      b.loadLevel(1, { mode: 'dis' });
      await wait(80);
      b.select('1');
      b.step('1', '+x');
      var doc2 = snapDoc();
      out.sessionSaved = doc2.volumes.burr.session;
      out.finalMoves = b.moves;
      out.finalLevel = b.levelIndex;
      out.finalX = b.offsets['1'][0];
      out.errs = window.__errs || [];
      out.overflow = { sw: document.documentElement.scrollWidth, iw: innerWidth };
      report(out);
    } catch (e) {
      report({ ok: false, where: 'collect', error: String(e), stack: e && e.stack, errs: window.__errs });
    }
  }

  if (document.readyState === 'complete') collect();
  else window.addEventListener('load', collect);
})();
</script>
"""


VIEWPORT_COLLECTOR = """<script>
window.__vpErrs = [];
window.addEventListener('error', function (e) { window.__vpErrs.push(String(e.message || e)); });
</script>
"""

VIEWPORT_PAGE = r"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<style>
html,body{margin:0;background:#0b0d09}
body{display:flex;align-items:flex-start;gap:8px}
iframe{border:0;display:block;flex:0 0 auto}
#vp-out{position:absolute;left:-9999px;top:-9999px}
</style></head><body>
<iframe id="vp0" src="__SRC0__" width="390" height="844"></iframe>
<iframe id="vp1" src="__SRC1__" width="676" height="544"></iframe>
<iframe id="vp2" src="__SRC2__" width="1440" height="900"></iframe>
<pre id="vp-out"></pre>
<script>
var SIZES = [[390, 844], [676, 544], [1440, 900]];
function vpGo() {
  setTimeout(function () {
    var out = [];
    for (var i = 0; i < SIZES.length; i++) {
      try {
        var f = document.getElementById('vp' + i);
        var d = f.contentDocument;
        var w = f.contentWindow;
        var c = d.getElementById('burrBoard');
        var r = c.getBoundingClientRect();
        var tray = d.getElementById('burrTray').getBoundingClientRect();
        var dock = d.querySelector('.dock').getBoundingClientRect();
        var pixels = 0;
        try {
          var g = c.getContext('2d');
          var img = g.getImageData(0, 0, c.width, c.height).data;
          for (var k = 3; k < img.length; k += 4) if (img[k] > 20) pixels++;
        } catch (e) { pixels = -1; }
        out.push({
          size: SIZES[i],
          iw: w.innerWidth, ih: w.innerHeight,
          sw: d.documentElement.scrollWidth,
          bw: d.body.scrollWidth,
          canvas: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
          canvasPixels: pixels,
          tray: [Math.round(tray.left), Math.round(tray.top), Math.round(tray.width), Math.round(tray.height)],
          dockBottom: Math.round(dock.bottom),
          level: (w.__burr && w.__burr.level && w.__burr.level.name) || null,
          errs: (w.__vpErrs || [])
        });
      } catch (e) {
        out.push({ size: SIZES[i], error: String(e) });
      }
    }
    document.getElementById('vp-out').textContent = JSON.stringify(out);
  }, 1400);
}
if (document.readyState === 'complete') vpGo();
else window.addEventListener('load', vpGo);
</script>
</body></html>
"""


def run_browser(browser: str, url: str, profile: Path, timeout: int = 180,
                window_size: str = "1200,900", budget: int = 60000) -> str:
    args = [
        browser, "--headless=new", "--disable-gpu", "--no-first-run",
        "--no-default-browser-check", "--mute-audio",
        "--allow-file-access-from-files",
        f"--user-data-dir={profile}", f"--window-size={window_size}",
        f"--virtual-time-budget={budget}", "--dump-dom", url,
    ]
    p = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    return p.stdout.decode("utf-8", errors="replace")


def run_viewports(browser: str, pages: list[Path], tmp: Path) -> list[dict]:
    vp = tmp / "viewports.html"
    html_text = VIEWPORT_PAGE
    for i, p in enumerate(pages):
        html_text = html_text.replace(f"__SRC{i}__", p.as_uri() + "?play=burr")
    vp.write_text(html_text, encoding="utf-8")
    profile = tmp / "profile-vp"
    profile.mkdir()
    dom = run_browser(browser, vp.as_uri(), profile, window_size="2800,1000", budget=20000)
    m = re.search(r'<pre id="vp-out">(.*?)</pre>', dom, re.S)
    if not m:
        raise SystemExit("窄屏视口页面没有输出结果：可能启动失败或脚本报错")
    return json.loads(html.unescape(m.group(1)))


def parse_probe(dom: str) -> dict:
    m = re.search(r'<pre id="burr-test">(.*?)</pre>', dom, re.S)
    if not m:
        raise SystemExit("鲁班锁 UI 页面没有输出测试结果：可能启动失败或脚本报错")
    return json.loads(html.unescape(m.group(1)))


def check(cond: bool, label: str, failures: list[str]) -> None:
    print(("  ok    " if cond else "  FAIL  ") + label)
    if not cond:
        failures.append(label)


def main() -> int:
    parser = argparse.ArgumentParser(description="鲁班锁 UI 回归测试")
    parser.add_argument("--browser", default=DEFAULT_BROWSER)
    parser.add_argument("--keep", action="store_true", help="保留临时目录")
    args = parser.parse_args()

    browser = Path(args.browser)
    if not browser.is_file():
        raise SystemExit(f"找不到浏览器：{browser}\n可用 --browser 指定 Edge/Chrome 路径")

    dist = ROOT / "dist" / "index.html"
    if not dist.is_file():
        raise SystemExit("缺少 dist/index.html，请先运行：python src/build.py")

    tmp = Path(tempfile.mkdtemp(prefix="jiewu-burr-ui-"))
    dist_text = dist.read_text(encoding="utf-8")
    page = tmp / "ui.html"
    page.write_text(
        dist_text.replace("</body>", PROBE + "</body>", 1),
        encoding="utf-8",
    )
    vp_pages: list[Path] = []
    for i in range(3):
        vp_page = tmp / f"vp{i}.html"
        vp_page.write_text(
            dist_text.replace("<body>", "<body>\n" + VIEWPORT_COLLECTOR, 1),
            encoding="utf-8",
        )
        vp_pages.append(vp_page)
    profile = tmp / "profile"
    profile.mkdir()

    data = parse_probe(run_browser(str(browser), page.as_uri() + "?play=burr", profile))

    if not data.get("ok"):
        print(json.dumps(data, ensure_ascii=False, indent=2))
        if args.keep:
            print(f"临时目录：{tmp}")
        return 1

    failures: list[str] = []
    print("[鲁班锁 UI] 深链 / 键盘 / 阻挡 / 提示 / 拆装 / 演示 / 馆")
    check(data.get("ok") is True, "卷四与调试接口就位", failures)
    check(data.get("version") == "0.8.0-dev", "版本号为 0.8.0-dev", failures)
    check(data.get("levels") == 8, "本卷八关", failures)
    check(data.get("hubHidden") is True and data.get("appHidden") is False, "深链收起馆入口并显示卷四", failures)
    check(data.get("levelIndex") == 0 and data.get("level") == "三通", "首关为「三通」", failures)
    check(data.get("mode") == "dis" and data.get("pieces") == 3 and data.get("remaining") == 3,
          "首关默认拆模式、三根木条", failures)
    check(data.get("trayChips") == 3, "零件盘列出三根木条", failures)
    check((data.get("threshold") or 0) == 5, "拆出阈值为 5 格", failures)
    check(bool(data.get("view")) and abs((data.get("view") or {}).get("yaw", 0) + 45) < 1e-6,
          "初始视角为 -45° 档位", failures)
    check((data.get("canvas") or {}).get("w", 0) > 100 and (data.get("canvas") or {}).get("h", 0) > 100,
          "三维画布尺寸有效", failures)
    check((data.get("pixels") or 0) > 1000, "三维视图真实出像素", failures)

    check(data.get("tabChanged") is True, "Tab 循环选件", failures)
    check(data.get("kbMove") == 1 and abs((data.get("kbZ") or 0) + 1) < 1e-6,
          "方向键沿 z 轴移动一格并计步", failures)
    check(data.get("undoMoves") == 0 and abs((data.get("undoZ") or 0)) < 1e-6,
          "撤销回退轴向移动", failures)
    check(data.get("blockedMoves") == 0 and "挡住" in (data.get("blockedToast") or ""),
          "被挡住的轴向移动给出原因", failures)
    check("提示" in (data.get("hintCoach") or "") and data.get("hintSelected") == "A",
          "提示选中木条并给出轴向", failures)
    check((data.get("resetOffsets") or {}).get("A") == [0, 0, 0], "重置回到装配态", failures)
    check(abs((data.get("orbitYaw") or 0) - 45) <= 1, "拖动空白旋转视角并吸附 90° 档位", failures)
    if abs((data.get("orbitYaw") or 0) - 45) > 1:
        print("    debug orbit:", json.dumps({k: data.get(k) for k in ("view", "orbitYaw", "selected")}, ensure_ascii=False))

    check(data.get("pointerFoundA") is True and data.get("pointerSelected") == "A",
          "指针点击命中木条并选中", failures)
    check(data.get("pointerRemovedA") is True and (data.get("pointerZ") or 0) <= -5,
          "沿轴指针拖动把木条拆出", failures)
    check((data.get("pointerMoves") or 0) >= 5, "指针拖动按格计步", failures)
    if not data.get("pointerRemovedA"):
        print("    debug pointer:", json.dumps({k: data.get(k) for k in
              ("pointerFoundA", "pointerSelected", "pointerRemovedA", "pointerZ", "pointerMoves")}, ensure_ascii=False))

    check((data.get("dis0") or {}).get("finished") is True and (data.get("dis0") or {}).get("all") is True,
          "三通按标准序列全部拆下", failures)
    check(data.get("dis0Win") is True and data.get("dis0Title") == "锁已解", "三通拆完弹出胜利层", failures)
    check("已记入档案" in (data.get("dis0Note") or ""), "手拆胜利记档", failures)
    check(((data.get("dis0Progress") or {}).get("dis") or {}).get("bestMoves", 0) > 0,
          "拆模式最佳步数落盘", failures)
    check(data.get("dis0Session") is None, "胜利后清空会话", failures)

    check((data.get("asm0Offsets") or {}).get("A") == [0, 0, -5] and
          (data.get("asm0Offsets") or {}).get("B") == [5, 0, 0] and
          (data.get("asm0Offsets") or {}).get("C") == [5, 0, 5],
          "装模式从三通散开位开始", failures)
    check((data.get("asm0") or {}).get("finished") is True and (data.get("asm0") or {}).get("all") is True,
          "三通按逆序全部归位", failures)
    check(data.get("asm0Win") is True and data.get("asm0Title") == "锁已合", "三通装完弹出胜利层", failures)
    check(((data.get("asm0Progress") or {}).get("asm") or {}).get("bestMoves", 0) > 0,
          "装模式最佳步数落盘", failures)
    check("拆完" in (data.get("dis0CycleToast") or ""), "拆完后 Tab 循环提示木条已拆完", failures)
    check("归位" in (data.get("asm0CycleToast") or ""), "装完后 Tab 循环跳过已锁定木条", failures)

    check(data.get("sixPieces") == 6 and data.get("sixRemaining") == 6, "六子连芳渲染六根木条", failures)
    check((data.get("dis1") or {}).get("finished") is True and (data.get("dis1") or {}).get("all") is True,
          "六子连芳按标准序列全部拆下", failures)
    check(data.get("dis1Win") is True and data.get("dis1Title") == "锁已解", "六根拆完弹出胜利层", failures)
    check(((data.get("dis1Progress") or {}).get("dis") or {}).get("bestMoves", 0) > 0,
          "六根拆模式最佳步数落盘", failures)

    check(len(data.get("sixAsmOffsets") or {}) == 6, "六根装模式六根都有散开位", failures)
    check(data.get("sixStageOverlap") is None, "六根散开位互不重叠", failures)
    check((data.get("asm1") or {}).get("finished") is True and (data.get("asm1") or {}).get("all") is True,
          "六子连芳按逆序全部归位", failures)
    check(data.get("asm1Win") is True and data.get("asm1Title") == "锁已合", "六根装完弹出胜利层", failures)
    check(((data.get("asm1Progress") or {}).get("asm") or {}).get("bestMoves", 0) > 0,
          "六根装模式最佳步数落盘", failures)

    check(data.get("platePieces") == 6 and data.get("plateRemaining") == 6 and
          data.get("plateAssembledOverlap") is None,
          "六合装配态六片无重叠", failures)
    check((data.get("dis2") or {}).get("finished") is True and (data.get("dis2") or {}).get("all") is True,
          "六合按标准序列全部拆下", failures)
    check(data.get("dis2Win") is True and data.get("dis2Title") == "锁已解", "六合拆完弹出胜利层", failures)
    check(((data.get("dis2Progress") or {}).get("dis") or {}).get("bestMoves", 0) > 0,
          "六合拆模式最佳步数落盘", failures)
    check(len(data.get("plateAsmOffsets") or {}) == 6 and data.get("plateStageOverlap") is None,
          "六合散开位六片互不重叠", failures)
    check((data.get("asm2") or {}).get("finished") is True and (data.get("asm2") or {}).get("all") is True,
          "六合按逆序全部归位", failures)
    check(data.get("asm2Win") is True and data.get("asm2Title") == "锁已合", "六合装完弹出胜利层", failures)
    check(((data.get("asm2Progress") or {}).get("asm") or {}).get("bestMoves", 0) > 0,
          "六合装模式最佳步数落盘", failures)

    check(data.get("ninePieces") == 9 and data.get("nineAssembledOverlap") is None,
          "九重装配态九片无重叠", failures)
    check((data.get("dis3") or {}).get("finished") is True and (data.get("dis3") or {}).get("all") is True,
          "九重按标准序列全部拆下", failures)
    check(data.get("dis3Win") is True and data.get("dis3Title") == "锁已解", "九重拆完弹出胜利层", failures)
    check(((data.get("dis3Progress") or {}).get("dis") or {}).get("bestMoves", 0) > 0,
          "九重拆模式最佳步数落盘", failures)
    check(len(data.get("nineAsmOffsets") or {}) == 9 and data.get("nineStageOverlap") is None,
          "九重散开位九片互不重叠", failures)
    check((data.get("asm3") or {}).get("finished") is True and (data.get("asm3") or {}).get("all") is True,
          "九重按逆序全部归位", failures)
    check(data.get("asm3Win") is True and data.get("asm3Title") == "锁已合", "九重装完弹出胜利层", failures)
    check(((data.get("asm3Progress") or {}).get("asm") or {}).get("bestMoves", 0) > 0,
          "九重装模式最佳步数落盘", failures)

    extra_cases = [
        ("four", "四象", 4, "burr-four"),
        ("eight", "八方", 8, "burr-eight"),
        ("ten", "十全", 10, "burr-ten"),
        ("twelve", "十二楼", 12, "burr-twelve"),
    ]
    for key, label, count, lid in extra_cases:
        check(data.get(key + "Id") == lid and data.get(key + "Pieces") == count and
              data.get(key + "AssembledOverlap") is None,
              "%s 装配态 %d 片无重叠" % (label, count), failures)
        check((data.get(key + "Dis") or {}).get("finished") is True and
              (data.get(key + "Dis") or {}).get("all") is True,
              "%s 按标准序列全部拆下" % label, failures)
        check(data.get(key + "DisWin") is True and data.get(key + "DisTitle") == "锁已解",
              "%s 拆完弹出胜利层" % label, failures)
        check(((data.get(key + "DisProgress") or {}).get("dis") or {}).get("bestMoves", 0) > 0,
              "%s 拆模式最佳步数落盘" % label, failures)
        check(len(data.get(key + "AsmOffsets") or {}) == count and data.get(key + "StageOverlap") is None,
              "%s 散开位 %d 片互不重叠" % (label, count), failures)
        check((data.get(key + "Asm") or {}).get("finished") is True and
              (data.get(key + "Asm") or {}).get("all") is True,
              "%s 按逆序全部归位" % label, failures)
        check(data.get(key + "AsmWin") is True and data.get(key + "AsmTitle") == "锁已合",
              "%s 装完弹出胜利层" % label, failures)
        check(((data.get(key + "AsmProgress") or {}).get("asm") or {}).get("bestMoves", 0) > 0,
              "%s 装模式最佳步数落盘" % label, failures)

    check(data.get("demoStarted") is True and data.get("demoFinished") is True and data.get("demoWin") is True,
          "演示从起点播放并完成", failures)
    check("演示完成" in (data.get("demoNote") or ""), "演示胜利注明不计成绩", failures)
    check(data.get("demoProgressSame") is True, "演示不写进度", failures)
    check(data.get("plateDemoStarted") is True and data.get("plateDemoFinished") is True and
          data.get("plateDemoWin") is True, "六合演示从起点播放并完成", failures)
    check(data.get("plateDemoProgressSame") is True, "六合演示不写进度", failures)
    check(data.get("nineDemoStarted") is True and data.get("nineDemoFinished") is True and
          data.get("nineDemoWin") is True, "九重演示从起点播放并完成", failures)
    check(data.get("nineDemoProgressSame") is True, "九重演示不写进度", failures)
    check(data.get("twelveDemoStarted") is True and data.get("twelveDemoFinished") is True and
          data.get("twelveDemoWin") is True, "十二楼演示从起点播放并完成", failures)
    check(data.get("twelveDemoProgressSame") is True, "十二楼演示不写进度", failures)

    check(data.get("levelsShown") is True and data.get("levelButtons") == 8 and data.get("levelSwitchClosed") is True,
          "选关弹层八关且可切换", failures)
    check(len(data.get("levelNames") or []) == 8 and "六合" in ((data.get("levelNames") or [""] * 8)[2] or ""),
          "选关列出「六合」", failures)
    check("九重" in ((data.get("levelNames") or [""] * 8)[3] or ""),
          "选关列出「九重」", failures)
    check("四象" in ((data.get("levelNames") or [""] * 8)[4] or ""),
          "选关列出「四象」", failures)
    check("八方" in ((data.get("levelNames") or [""] * 8)[5] or ""),
          "选关列出「八方」", failures)
    check("十全" in ((data.get("levelNames") or [""] * 8)[6] or ""),
          "选关列出「十全」", failures)
    check("十二楼" in ((data.get("levelNames") or [""] * 8)[7] or ""),
          "选关列出「十二楼」", failures)
    check(data.get("levelSwitch") == "六子连芳" and data.get("levelSwitchPieces") == 6,
          "切到六子连芳并渲染六根", failures)
    check(data.get("helpShown") is True and data.get("helpClosed") is True, "说明弹层开关", failures)
    check(data.get("hcToggled") is True, "高对比开关生效", failures)
    check(data.get("modeDis") == "dis" and data.get("modeAsm") == "asm" and data.get("modeBack") == "dis",
          "拆装模式按钮切换", failures)

    check(data.get("hubOpen") is True and data.get("hubInert") is True, "馆入口打开并冻结卷四", failures)
    if not (data.get("hubOpen") is True and data.get("hubInert") is True):
        print("    debug:", json.dumps({k: data.get(k) for k in
              ("hubBtn", "hubOpenBefore", "appInertBefore", "hubOpen", "hubIsOpen", "hubInert")},
              ensure_ascii=False))
    check(data.get("hubCard") == "ready" and "鲁班锁" in (data.get("hubDetail") or ""),
          "馆内展签显示卷四已上线", failures)
    check(data.get("hubClosed") is True and data.get("appBack") is True and data.get("inertBack") is False,
          "关闭馆入口回到卷四", failures)

    check((data.get("sessionSaved") or {}).get("levelIndex") == 1 and
          (data.get("sessionSaved") or {}).get("mode") == "dis" and
          (data.get("sessionSaved") or {}).get("moves") == 1,
          "未完成会话落盘", failures)
    check(data.get("finalLevel") == 1 and data.get("finalMoves") == 1 and data.get("finalX") == 1,
          "最后一手为六根钥匙 +x", failures)
    check(data.get("errs") == [], "无脚本异常", failures)
    check((data.get("overflow") or {}).get("sw", 0) <= (data.get("overflow") or {}).get("iw", 0) + 1,
          "无横向溢出", failures)

    print("[鲁班锁 UI] 重开续玩")
    again = parse_probe(run_browser(str(browser), page.as_uri() + "?play=burr&phase=2", profile))
    check(again.get("hubHidden") is True and again.get("appHidden") is False, "重开仍直接进入卷四", failures)
    check(again.get("levelIndex") == 1 and again.get("level") == "六子连芳", "续玩恢复六子连芳", failures)
    check(again.get("mode") == "dis" and again.get("moves") == 1, "续玩恢复拆模式与步数", failures)
    check(((again.get("offsets") or {}).get("1") or [None])[0] == 1, "续玩恢复木条偏移", failures)
    check((again.get("canvas") or {}).get("w", 0) > 100 and again.get("winShown") is False,
          "续玩渲染三维视图且不误弹胜利", failures)
    check(again.get("errs") == [], "重开无脚本异常", failures)

    print("[鲁班锁 UI] 窄屏与桌面视口")
    vps = run_viewports(str(browser), vp_pages, tmp)
    by_size = {tuple(v.get("size") or []): v for v in vps}
    for w, h in [(390, 844), (676, 544), (1440, 900)]:
        v = by_size.get((w, h)) or {}
        tag = f"{w}×{h}"
        check("error" not in v, f"{tag} 无脚本异常", failures)
        check(v.get("iw") == w and (v.get("sw") or 0) <= w + 1,
              f"{tag} 无横向溢出", failures)
        check((v.get("canvas") or [0, 0, 0, 0])[2] > 100 and
              (v.get("canvas") or [0, 0, 0, 0])[3] > 100 and
              (v.get("canvasPixels") or 0) > 1000,
              f"{tag} 三维画布正常出像素", failures)
        check((v.get("tray") or [0, 0, 0, 0])[2] > 0 and
              (v.get("dockBottom") or 0) <= (v.get("ih") or 0) + 1,
              f"{tag} 零件盘与操作栏在视口内", failures)
        check(v.get("level") == "三通", f"{tag} 卷四正常启动", failures)
        check(v.get("errs") == [], f"{tag} 无运行期脚本错误", failures)
        if "error" in v or v.get("errs"):
            print("    debug viewport:", json.dumps(v, ensure_ascii=False))

    if args.keep:
        print(f"临时目录：{tmp}")
    else:
        import shutil
        shutil.rmtree(tmp, ignore_errors=True)

    if failures:
        print(f"\n[burr-ui] FAIL {len(failures)} 项")
        return 1
    print("\n[burr-ui] OK 全部断言通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
