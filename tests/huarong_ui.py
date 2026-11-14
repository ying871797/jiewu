#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
解物 · 卷二华容道 UI 回归测试（零依赖）

用无头 Edge 打开 dist/index.html?play=huarong，验证的是「真实交互」而不是内部函数：
1. 聚焦木块后方向键推一格、Shift+方向键推到底；
2. 指针拖拽真的改变局面，并按拖动距离计步；
3. 提示会在棋盘上标出目标格，并给出当前口径的剩余步数；
4. 选局弹层能打开、选关、关闭；
5. 走完最短解后弹出胜利层，星级、三口径成绩与 jiewu.v2 落盘正确；
6. 弹层打开时游戏层 inert，Escape 可关闭弹层；
7. 全程无脚本异常、无横向溢出。

用法：
    python tests/huarong_ui.py
    python tests/huarong_ui.py --browser "C:/Program Files/Google/Chrome/Application/chrome.exe"
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
    pre.id = 'hr-ui-test';
    pre.textContent = JSON.stringify(out);
    document.body.appendChild(pre);
  }
  function key(el, k, shift) {
    el.dispatchEvent(new KeyboardEvent('keydown', {
      key: k, shiftKey: !!shift, bubbles: true, cancelable: true
    }));
  }
  function ptr(el, type, x, y) {
    var ev = new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse',
      clientX: x, clientY: y, buttons: type === 'pointerup' ? 0 : 1
    });
    (type === 'pointerdown' ? el : window).dispatchEvent(ev);
  }
  function piece(i) { return document.querySelector('#hrPieces .hr-piece[data-i="' + i + '"]'); }
  function show(id) { return document.getElementById(id).classList.contains('show'); }

  function collect() {
    var out = {};
    var hr = window.__huarong;
    try {
      out.ok = !!hr;
      if (!hr) { report(out); return; }

      /* 1. 键盘：卒向左一格，再 Shift+下推到底。 */
      var p1 = piece(1);
      p1.focus();
      key(p1, 'ArrowLeft');
      out.kb1Metrics = hr.metrics;
      key(p1, 'ArrowDown', true);
      out.kb2Metrics = hr.metrics;
      out.kb2State = hr.state;

      /* 2. 指针拖拽：重置后把卒从 (2,1) 拖到 (2,0)。 */
      hr.loadLevel(0);
      var p = piece(1);
      var r = p.getBoundingClientRect();
      var cx = (r.left + r.right) / 2;
      var cy = (r.top + r.bottom) / 2;
      ptr(p, 'pointerdown', cx, cy);
      ptr(p, 'pointermove', cx - r.width, cy);
      ptr(p, 'pointerup', cx - r.width, cy);
      out.dragMetrics = hr.metrics;
      out.dragState = hr.state;
      out.dragHistory = hr.historyLength;

      /* 2b. 同一块连推两次同方向：直线步应是 2，古法仍并成 1。 */
      hr.loadLevel(0);
      hr.movePiece(1, 'down', false);
      hr.movePiece(1, 'down', false);
      out.seqMetrics = hr.metrics;

      /* 3. 提示：默认直线步，应先推卒向左一格，剩余 3 步。 */
      hr.loadLevel(0);
      document.querySelector('[data-hr-act="hint"]').click();
      setTimeout(function () {
        try {
          out.hintCoachHidden = document.getElementById('hrCoach').hidden;
          out.hintCoach = document.getElementById('hrCoachMsg').textContent;
          out.hintRects = document.querySelectorAll('#hrHintLayer rect').length;

          /* 4. 选局弹层：两关，能选到横刀立马并自动关闭。 */
          document.querySelector('.rail-right [data-hr-act="levels"]').click();
          out.levelsShown = show('hrVeilLevels');
          out.levelButtons = document.querySelectorAll('#hrLevelGrid .hr-level').length;
          var levelBtns = document.querySelectorAll('#hrLevelGrid .hr-level');
          levelBtns[1].click();
          out.levelAfterPick = hr.level.name;
          out.levelsClosed = !show('hrVeilLevels');

          /* 5. 小试最短解：走完应弹胜利层，成绩落盘。 */
          hr.loadLevel(0);
          var sol = hr.solve('straight');
          out.smallSolution = sol.distance;
          for (var i = 0; i < sol.moves.length; i++) hr.apply(sol.moves[i]);
          setTimeout(function () {
            try {
              out.winShown = show('hrVeilWin');
              out.winTitle = document.getElementById('hrWinTitle').textContent;
              out.winStars = document.querySelectorAll('#hrWinStars span.on').length;
              out.winLines = document.getElementById('hrWinLines').textContent.replace(/\s+/g, ' ').trim();
              out.winNote = document.getElementById('hrWinNote').textContent;
              out.winInert = document.getElementById('appHuarong').hasAttribute('inert');
              out.winNextHiddenOnFirst = document.getElementById('hrWinNext').hidden;

              var doc = JSON.parse(localStorage.getItem('jiewu.v2'));
              out.progress = doc.volumes.huarong.progress;
              out.session = doc.volumes.huarong.session;

              /* 6. Escape 关闭胜利层，游戏层解除 inert。 */
              document.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Escape', bubbles: true, cancelable: true
              }));
              out.winClosedByEsc = !show('hrVeilWin');
              out.inertAfterEsc = document.getElementById('appHuarong').hasAttribute('inert');

              /* 7. 帮助层也能打开、关闭。 */
              document.querySelector('[data-hr-act="help"]').click();
              out.helpShown = show('hrVeilHelp');
              document.querySelector('#hrVeilHelp [data-hr-act="closeVeil"]').click();
              out.helpClosed = !show('hrVeilHelp');

              /* 8. 最后一关胜利时隐藏「下一局」。 */
              hr.loadLevel(1);
              var big = hr.solve('straight');
              for (var k = 0; k < big.moves.length; k++) hr.apply(big.moves[k]);
              setTimeout(function () {
                try {
                  out.lastWinShown = show('hrVeilWin');
                  out.winNextHiddenOnLast = document.getElementById('hrWinNext').hidden;
                  out.lastWinNote = document.getElementById('hrWinNote').textContent;

                  out.overflow = { sw: document.documentElement.scrollWidth, iw: innerWidth };
                  out.errs = window.__errs || [];
                  report(out);
                } catch (e) { report({ ok: false, where: 'lastwin', error: String(e) }); }
              }, 800);
            } catch (e) { report({ ok: false, where: 'win', error: String(e) }); }
          }, 800);
        } catch (e) { report({ ok: false, where: 'hint', error: String(e) }); }
      }, 800);
    } catch (e) {
      report({ ok: false, error: String(e), stack: e && e.stack, errs: window.__errs || [] });
    }
  }
  if (document.readyState === 'complete') setTimeout(collect, 700);
  else window.addEventListener('load', function () { setTimeout(collect, 700); });
})();
</script>
"""


def run_browser(browser: str, url: str, profile: Path, timeout: int = 60) -> str:
    args = [
        browser, "--headless=new", "--disable-gpu", "--no-first-run",
        "--no-default-browser-check", "--mute-audio",
        f"--user-data-dir={profile}", "--window-size=1200,900",
        "--virtual-time-budget=15000", "--dump-dom", url,
    ]
    p = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    return p.stdout.decode("utf-8", errors="replace")


def parse_probe(dom: str) -> dict:
    m = re.search(r'<pre id="hr-ui-test">(.*?)</pre>', dom, re.S)
    if not m:
        raise SystemExit("华容道 UI 页面没有输出测试结果：可能启动失败或脚本报错")
    return json.loads(html.unescape(m.group(1)))


def check(cond: bool, label: str, failures: list[str]) -> None:
    print(("  ok    " if cond else "  FAIL  ") + label)
    if not cond:
        failures.append(label)


def main() -> int:
    parser = argparse.ArgumentParser(description="华容道 UI 回归测试")
    parser.add_argument("--browser", default=DEFAULT_BROWSER)
    parser.add_argument("--keep", action="store_true", help="保留临时目录")
    args = parser.parse_args()

    browser = Path(args.browser)
    if not browser.is_file():
        raise SystemExit(f"找不到浏览器：{browser}\n可用 --browser 指定 Edge/Chrome 路径")

    dist = ROOT / "dist" / "index.html"
    if not dist.is_file():
        raise SystemExit("缺少 dist/index.html，请先运行：python src/build.py")

    tmp = Path(tempfile.mkdtemp(prefix="jiewu-huarong-ui-"))
    page = tmp / "ui.html"
    page.write_text(
        dist.read_text(encoding="utf-8").replace("</body>", PROBE + "</body>", 1),
        encoding="utf-8",
    )
    profile = tmp / "profile"
    profile.mkdir()

    data = parse_probe(run_browser(str(browser), page.as_uri() + "?play=huarong", profile, timeout=90))

    failures: list[str] = []
    print("[华容道 UI] 键盘 / 拖拽 / 提示 / 弹层 / 落盘")
    check(data.get("ok") is True, "华容道与调试接口就位", failures)
    check(data.get("kb1Metrics") == {"straight": 1, "finger": 1, "unit": 1}, "方向键推一格计 1 步", failures)
    check(data.get("kb2Metrics") == {"straight": 2, "finger": 1, "unit": 3}, "Shift+方向键推到底：单格 3 / 古法 1", failures)
    check(data.get("dragMetrics") == {"straight": 1, "finger": 1, "unit": 1}, "指针拖拽一格计 1 步", failures)
    check(data.get("dragState") == [1, 8, 10], "拖拽后卒落在 (2,0)", failures)
    check(data.get("dragHistory") == 1, "拖拽写入一步撤销历史", failures)
    check(data.get("seqMetrics") == {"straight": 2, "finger": 1, "unit": 2}, "同向连推两次：直线 2 / 古法 1", failures)
    check(data.get("hintCoachHidden") is False, "提示条可见", failures)
    check("向左推 1 格" in (data.get("hintCoach") or "") and "还剩 3 步" in (data.get("hintCoach") or ""), "提示给出方向与剩余步数", failures)
    check(data.get("hintRects") == 1, "提示在棋盘上标出目标格", failures)
    check(data.get("levelsShown") is True and data.get("levelButtons") == 2, "选局弹层两关", failures)
    check(data.get("levelAfterPick") == "横刀立马" and data.get("levelsClosed") is True, "选关后载入并关闭弹层", failures)
    check(data.get("smallSolution") == 3, "小试最短解 3 步", failures)
    check(data.get("winShown") is True and data.get("winTitle") == "曹操已到出口", "胜利弹层出现", failures)
    check(data.get("winStars") == 3, "最优解三星", failures)
    check("直线步3最优 3" in (data.get("winLines") or ""), "胜利层列出三口径", failures)
    check("已记入档案" in (data.get("winNote") or ""), "胜利层说明已记档", failures)
    check(data.get("winInert") is True, "胜利层打开时游戏层 inert", failures)
    check(data.get("winNextHiddenOnFirst") is False, "小试胜利后仍可下一局", failures)
    progress = (data.get("progress") or {}).get("huarong-xiaoshi") or {}
    check(progress.get("wins") == 1, "胜利写入进度", failures)
    check(progress.get("best") == {"straight": 3, "finger": 2, "unit": 5}, "三口径最佳成绩落盘", failures)
    check(data.get("session") is None, "胜利后清空会话", failures)
    check(data.get("winClosedByEsc") is True, "Escape 关闭胜利层", failures)
    check(data.get("inertAfterEsc") is False, "关闭后解除 inert", failures)
    check(data.get("helpShown") is True and data.get("helpClosed") is True, "帮助层可开可关", failures)
    check(data.get("lastWinShown") is True and data.get("winNextHiddenOnLast") is True, "最后一关隐藏下一局", failures)
    check("已记入档案" in (data.get("lastWinNote") or ""), "最后一关同样记入档案", failures)
    check(data.get("errs") == [], "无脚本异常", failures)
    check((data.get("overflow") or {}).get("sw", 0) <= (data.get("overflow") or {}).get("iw", 0) + 1, "无横向溢出", failures)

    if args.keep:
        print(f"临时目录：{tmp}")
    else:
        import shutil
        shutil.rmtree(tmp, ignore_errors=True)

    if failures:
        print(f"\n[hr-ui] FAIL {len(failures)} 项")
        return 1
    print("\n[hr-ui] OK 全部断言通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
