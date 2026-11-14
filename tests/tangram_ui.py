#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
解物 · 卷三 七巧板 UI 回归测试（零依赖）

用无头 Edge 打开 dist/index.html?play=tangram，验证：
1. 深链直接进入卷三，首关剪影与木片就位；
2. 键盘、按钮旋转、翻面、拖动、撤销、重置、提示都是真实交互；
3. 四关作者位姿都能铺满自己的剪影，胜利层、进度与最佳步数落盘；
4. 演示逐块归位，不计入最佳成绩；
5. 选关 / 说明弹层、馆入口往返；
6. 会话独立落在 volumes.tangram，重开能续玩；
7. 全程无脚本异常、无横向溢出。

用法：
    python tests/tangram_ui.py
    python tests/tangram_ui.py --browser "C:/Program Files/Google/Chrome/Application/chrome.exe"
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
  function report(out) {
    var pre = document.createElement('pre');
    pre.id = 'tg-test';
    pre.textContent = JSON.stringify(out);
    document.body.appendChild(pre);
  }
  function show(id) { return document.getElementById(id).classList.contains('show'); }
  function key(el, k, shift) {
    el.dispatchEvent(new KeyboardEvent('keydown', {
      key: k, shiftKey: !!shift, bubbles: true, cancelable: true
    }));
  }
  function piece(id) { return document.querySelector('#tgPieces .tg-piece[data-id="' + id + '"]'); }
  function toast() { return document.getElementById('tgToast').textContent; }
  function point(x, y) {
    var board = document.getElementById('tgBoard');
    var pt = board.createSVGPoint();
    pt.x = x * 80; pt.y = y * 80;
    var q = pt.matrixTransform(board.getScreenCTM());
    return { x: q.x, y: q.y };
  }
  function pointer(el, type, p, id) {
    el.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: id || 1,
      clientX: p.x, clientY: p.y, pointerType: 'mouse', isPrimary: true, buttons: 1
    }));
  }
  function snapDoc() { return JSON.parse(localStorage.getItem('jiewu.v2')); }

  function collect() {
    var out = {};
    var tg = window.__tangram;
    var JW = window.JW;
    try {
      out.ok = !!(tg && JW && JW.toys.tangram);
      out.phase = (location.search || '').indexOf('phase=2') >= 0 ? 2 : 1;
      out.hubHidden = document.getElementById('hub').hidden;
      out.appHidden = document.getElementById('appTangram').hidden;
      out.levelIndex = tg ? tg.levelIndex : null;
      out.level = tg && tg.level ? tg.level.name : null;
      out.pieces = document.querySelectorAll('#tgPieces .tg-piece').length;
      out.targetD = (document.getElementById('tgTargetPath') || {}).getAttribute
        ? document.getElementById('tgTargetPath').getAttribute('d') : null;
      out.moves = tg ? tg.moves : null;
      out.covered = tg ? tg.covered() : null;
      out.errs = window.__errs || [];
      out.overflow = { sw: document.documentElement.scrollWidth, iw: innerWidth };

      if (out.phase === 2) {
        out.poses = tg ? tg.poses : null;
        out.winShown = show('tgVeilWin');
        report(out);
        return;
      }

      /* 1. 键盘平移与撤销 */
      var p1 = piece('small-1');
      out.pieceDom = !!p1;
      if (p1) {
        p1.focus();
        key(p1, 'ArrowRight');
      }
      out.kbMoves = tg.moves;
      out.kbX = tg.poses['small-1'].x;
      tg.undo();
      out.undoMoves = tg.moves;
      out.undoX = tg.poses['small-1'].x;

      /* 2. 按钮旋转；键盘旋转也走同一套 */
      tg.select('small-1');
      document.querySelector('.rail-right [data-tg-act="rotR"]').click();
      out.rot45 = tg.poses['small-1'].rot;
      document.querySelector('.rail-right [data-tg-act="rotL"]').click();
      out.rot0 = tg.poses['small-1'].rot;
      var p2 = piece('small-1');
      p2.focus();
      key(p2, '[');
      out.kbRot = tg.poses['small-1'].rot;
      key(p2, ']');
      tg.reset();
      out.resetMoves = tg.moves;
      out.resetX = tg.poses['small-1'].x;

      /* 3. 提示：高亮一块与目标位姿 */
      document.querySelector('.dock [data-tg-act="hint"]').click();
      out.hintCoachHidden = document.getElementById('tgCoach').hidden;
      out.hintCoach = document.getElementById('tgCoachMsg').textContent;
      out.hintPath = document.querySelectorAll('#tgHintLayer .tg-hint-path').length;
      out.hintPiece = document.querySelectorAll('#tgPieces .tg-piece.hint').length;
      tg.reset();

      /* 4. 拖动一块：一次按下—移动—松开算一步 */
      tg.loadLevel(3);
      tg.select('large-1');
      var beforeDrag = tg.moves;
      var start = point(1, 6);
      var end = point(2, 6);
      var g = piece('large-1');
      pointer(g, 'pointerdown', start);
      pointer(window, 'pointermove', end);
      pointer(window, 'pointerup', end);
      out.dragMoves = tg.moves - beforeDrag;
      out.dragDelta = Math.round((tg.poses['large-1'].x - 0) * 100) / 100;
      tg.undo();

      /* 5. 翻面只对平行四边形生效 */
      tg.select('para-1');
      document.querySelector('.rail-right [data-tg-act="flip"]').click();
      out.flipPara = tg.poses['para-1'].flip;
      document.querySelector('.rail-right [data-tg-act="flip"]').click();
      out.flipBack = tg.poses['para-1'].flip;
      tg.select('large-1');
      document.querySelector('.rail-right [data-tg-act="flip"]').click();
      out.flipBig = tg.poses['large-1'].flip;
      out.flipToast = toast();

      /* 6. 四关作者位姿都能铺满剪影 */
      out.levels = [];
      for (var i = 0; i < 4; i++) {
        tg.loadLevel(i);
        var t = tg.targets();
        for (var k = 0; k < t.length; k++) {
          tg.place(t[k].id, { x: t[k].x, y: t[k].y, rot: t[k].rot, flip: t[k].flip });
        }
        out.levels.push({
          i: i, name: tg.level.name, pieces: tg.level.pieces.length,
          covered: tg.covered(), moves: tg.moves
        });
      }

      /* 7. 真实胜利：回到第一关，用 place 走正常提交路径 */
      tg.loadLevel(0);
      var t0 = tg.targets();
      tg.place(t0[0].id, { x: t0[0].x, y: t0[0].y, rot: t0[0].rot, flip: t0[0].flip });
      out.coveredAfter1 = tg.covered();
      tg.place(t0[1].id, { x: t0[1].x, y: t0[1].y, rot: t0[1].rot, flip: t0[1].flip });
      out.coveredAfter2 = tg.covered();

      setTimeout(function () {
        try {
          out.winShown = show('tgVeilWin');
          out.winTitle = document.getElementById('tgWinTitle').textContent;
          out.winMoves = document.getElementById('tgWinMoves').textContent;
          out.winNote = document.getElementById('tgWinNote').textContent;
          out.winInert = document.getElementById('appTangram').hasAttribute('inert');
          var doc = snapDoc();
          out.progress = doc.volumes.tangram.progress['tangram-two-small'] || null;
          out.sessionAfterWin = doc.volumes.tangram.session;
          out.velvetName = tg.level.name;

          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
          out.closedByEsc = !show('tgVeilWin');
          out.inertAfterEsc = document.getElementById('appTangram').hasAttribute('inert');

          /* 8. 选关弹层：四关，切到七巧方 */
          document.querySelector('.rail-right [data-tg-act="levels"]').click();
          out.levelsShown = show('tgVeilLevels');
          out.levelButtons = document.querySelectorAll('#tgLevelGrid .tg-level').length;
          document.querySelector('#tgLevelGrid [data-index="3"]').click();
          out.level3 = tg.level.name;
          out.pieces3 = document.querySelectorAll('#tgPieces .tg-piece').length;
          out.levelsClosed = !show('tgVeilLevels');

          /* 9. 说明弹层 */
          document.querySelector('.dock [data-tg-act="help"]').click();
          out.helpShown = show('tgVeilHelp');
          document.querySelector('#tgVeilHelp [data-tg-act="closeVeil"]').click();
          out.helpClosed = !show('tgVeilHelp');

          /* 10. 演示：两块的「大三角」，逐块归位，不计最佳 */
          tg.loadLevel(2);
          var progressBefore = JSON.stringify((snapDoc().volumes.tangram.progress) || {});
          document.querySelector('.dock [data-tg-act="demo"]').click();
          out.demoStarted = tg.demoing;
          setTimeout(function () {
            try {
              out.demoFinished = tg.finished;
              out.demoWinShown = show('tgVeilWin');
              out.demoNote = document.getElementById('tgWinNote').textContent;
              out.demoMoves = document.getElementById('tgWinMoves').textContent;
              out.demoProgressUnchanged = progressBefore === JSON.stringify((snapDoc().volumes.tangram.progress) || {});
              if (show('tgVeilWin')) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

              /* 11. 馆入口往返 */
              document.getElementById('btnHub').click();
              out.hubOpen = !document.getElementById('hub').hidden;
              out.hubInert = document.getElementById('appTangram').hasAttribute('inert');
              JW.hub.select('tangram');
              out.hubCard = (document.querySelector('#hub .hub-item[data-hub-id="tangram"]') || {}).dataset
                ? document.querySelector('#hub .hub-item[data-hub-id="tangram"]').dataset.status : null;
              out.hubDetail = (document.querySelector('#hub .hub-label') || {}).textContent || '';
              JW.hub.close();
              out.hubClosed = document.getElementById('hub').hidden;
              out.appBack = !document.getElementById('appTangram').hidden;
              out.inertBack = document.getElementById('appTangram').hasAttribute('inert');

              /* 12. 留一个未完成的会话，重开续玩 */
              tg.loadLevel(3);
              tg.select('large-1');
              tg.nudge('large-1', 0.25, 0);
              var doc2 = snapDoc();
              out.sessionSaved = doc2.volumes.tangram.session;
              out.finalMoves = tg.moves;
              out.finalLevel = tg.levelIndex;
              out.finalX = tg.poses['large-1'].x;
              out.errs = window.__errs || [];
              out.overflow = { sw: document.documentElement.scrollWidth, iw: innerWidth };
              report(out);
            } catch (e) { report({ ok: false, where: 'demo', error: String(e), stack: e && e.stack, errs: window.__errs }); }
          }, 1900);
        } catch (e) { report({ ok: false, where: 'win', error: String(e), stack: e && e.stack, errs: window.__errs }); }
      }, 700);
    } catch (e) {
      report({ ok: false, error: String(e), stack: e && e.stack, errs: window.__errs });
    }
  }

  if (document.readyState === 'complete') setTimeout(collect, 700);
  else window.addEventListener('load', function () { setTimeout(collect, 700); });
})();
</script>
"""


def run_browser(browser: str, url: str, profile: Path, timeout: int = 120) -> str:
    args = [
        browser, "--headless=new", "--disable-gpu", "--no-first-run",
        "--no-default-browser-check", "--mute-audio",
        f"--user-data-dir={profile}", "--window-size=1200,900",
        "--virtual-time-budget=40000", "--dump-dom", url,
    ]
    p = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    return p.stdout.decode("utf-8", errors="replace")


def parse_probe(dom: str) -> dict:
    m = re.search(r'<pre id="tg-test">(.*?)</pre>', dom, re.S)
    if not m:
        raise SystemExit("七巧板 UI 页面没有输出测试结果：可能启动失败或脚本报错")
    return json.loads(html.unescape(m.group(1)))


def check(cond: bool, label: str, failures: list[str]) -> None:
    print(("  ok    " if cond else "  FAIL  ") + label)
    if not cond:
        failures.append(label)


def main() -> int:
    parser = argparse.ArgumentParser(description="七巧板 UI 回归测试")
    parser.add_argument("--browser", default=DEFAULT_BROWSER)
    parser.add_argument("--keep", action="store_true", help="保留临时目录")
    args = parser.parse_args()

    browser = Path(args.browser)
    if not browser.is_file():
        raise SystemExit(f"找不到浏览器：{browser}\n可用 --browser 指定 Edge/Chrome 路径")

    dist = ROOT / "dist" / "index.html"
    if not dist.is_file():
        raise SystemExit("缺少 dist/index.html，请先运行：python src/build.py")

    tmp = Path(tempfile.mkdtemp(prefix="jiewu-tangram-ui-"))
    page = tmp / "ui.html"
    page.write_text(
        dist.read_text(encoding="utf-8").replace("</body>", PROBE + "</body>", 1),
        encoding="utf-8",
    )
    profile = tmp / "profile"
    profile.mkdir()

    data = parse_probe(run_browser(str(browser), page.as_uri() + "?play=tangram", profile))

    if not data.get("ok"):
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return 1

    failures: list[str] = []
    print("[七巧板 UI] 深链 / 键盘 / 旋转 / 拖动 / 提示 / 胜利 / 选关 / 演示 / 馆")
    check(data.get("ok") is True, "卷三与调试接口就位", failures)
    check(data.get("hubHidden") is True and data.get("appHidden") is False, "深链收起馆入口并显示卷三", failures)
    check(data.get("levelIndex") == 0 and data.get("level") == "小方", "首关为「小方」", failures)
    check(data.get("pieces") == 2 and data.get("pieceDom") is True, "首关渲染两块木片", failures)
    check(bool(data.get("targetD")) and "M" in (data.get("targetD") or ""), "剪影生成单一路径", failures)
    check(data.get("covered") is False, "起手未铺满", failures)
    check(data.get("kbMoves") == 1 and abs((data.get("kbX") or 0) - 4.25) < 1e-6, "方向键平移 1/4 格并计步", failures)
    check(data.get("undoMoves") == 0 and abs((data.get("undoX") or 0) - 4) < 1e-6, "撤销回退平移", failures)
    check(data.get("rot45") == 45 and data.get("rot0") == 0 and data.get("kbRot") == 315,
          "按钮与键盘旋转 45°", failures)
    check(data.get("resetMoves") == 0 and abs((data.get("resetX") or 0) - 4) < 1e-6, "重置回到木片区", failures)
    check(data.get("hintCoachHidden") is False and "提示" in (data.get("hintCoach") or ""), "提示给出参考落位", failures)
    check(data.get("hintPath") == 1 and data.get("hintPiece") == 1, "提示高亮一块与虚线目标", failures)
    check(data.get("dragMoves") == 1 and abs((data.get("dragDelta") or 0) - 1) < 1e-6, "拖动一块并只计一步", failures)
    check(data.get("flipPara") is True and data.get("flipBack") is False, "平行四边形可翻面", failures)
    check(data.get("flipBig") is False and "平行四边形" in (data.get("flipToast") or ""), "其他板翻面被说明", failures)
    check(all((x.get("covered") for x in (data.get("levels") or []))) and len(data.get("levels") or []) == 4,
          "四关作者位姿都能铺满", failures)
    check((data.get("levels") or [{}])[3].get("pieces") == 7, "第四关用满七块", failures)
    check(data.get("coveredAfter1") is False and data.get("coveredAfter2") is True, "逐块放置后覆盖判定成立", failures)
    check(data.get("winShown") is True and data.get("winTitle") == "影已合", "铺满后弹出胜利层", failures)
    check(data.get("winMoves") == "2" and "已记入档案" in (data.get("winNote") or ""), "胜利层列出步数并记档", failures)
    check(data.get("winInert") is True, "胜利层打开时游戏层 inert", failures)
    check((data.get("progress") or {}).get("bestMoves") == 2, "最佳步数落盘", failures)
    check(data.get("sessionAfterWin") is None, "胜利后清空会话", failures)
    check(data.get("closedByEsc") is True and data.get("inertAfterEsc") is False, "Escape 关闭胜利层并解除 inert", failures)
    check(data.get("levelsShown") is True and data.get("levelButtons") == 4 and data.get("levelsClosed") is True,
          "选关弹层四关且可切换", failures)
    check(data.get("level3") == "七巧方" and data.get("pieces3") == 7, "切到七巧方并渲染七块", failures)
    check(data.get("helpShown") is True and data.get("helpClosed") is True, "说明弹层开关", failures)
    check(data.get("demoStarted") is True and data.get("demoFinished") is True and data.get("demoWinShown") is True,
          "演示逐块归位并弹出胜利", failures)
    check("演示完成" in (data.get("demoNote") or "") and data.get("demoMoves") == "0", "演示不计入最佳", failures)
    check(data.get("demoProgressUnchanged") is True, "演示不写进度", failures)
    check(data.get("hubOpen") is True and data.get("hubInert") is True, "馆入口打开并冻结卷三", failures)
    check(data.get("hubCard") == "ready" and "七巧板" in (data.get("hubDetail") or ""), "馆内展签显示卷三已上线", failures)
    check(data.get("hubClosed") is True and data.get("appBack") is True and data.get("inertBack") is False,
          "关闭馆入口回到卷三", failures)
    check((data.get("sessionSaved") or {}).get("levelIndex") == 3 and (data.get("sessionSaved") or {}).get("moves") == 1,
          "未完成会话落盘", failures)
    check(data.get("errs") == [], "无脚本异常", failures)
    check((data.get("overflow") or {}).get("sw", 0) <= (data.get("overflow") or {}).get("iw", 0) + 1,
          "无横向溢出", failures)

    print("[七巧板 UI] 重开续玩")
    again = parse_probe(run_browser(str(browser), page.as_uri() + "?play=tangram&phase=2", profile))
    check(again.get("hubHidden") is True and again.get("appHidden") is False, "重开仍直接进入卷三", failures)
    check(again.get("levelIndex") == 3 and again.get("level") == "七巧方", "续玩恢复七巧方", failures)
    check(again.get("moves") == 1 and abs(((again.get("poses") or {}).get("large-1") or {}).get("x", -1) - 0.25) < 1e-6,
          "续玩恢复步数与位姿", failures)
    check(again.get("pieces") == 7 and again.get("winShown") is False, "续玩渲染七块且不误弹胜利", failures)
    check(again.get("errs") == [], "重开无脚本异常", failures)

    if args.keep:
        print(f"临时目录：{tmp}")
    else:
        import shutil
        shutil.rmtree(tmp, ignore_errors=True)

    if failures:
        print(f"\n[tg-ui] FAIL {len(failures)} 项")
        return 1
    print("\n[tg-ui] OK 全部断言通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
