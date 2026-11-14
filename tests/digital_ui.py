#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
解物 · 卷二数局 UI 回归测试（零依赖）

用无头 Edge 打开 dist/index.html?play=huarong&mode=digital，验证：
1. 深链直接进入数局，4×4 盘面与可解性；
2. 点击、键盘、撤销、重置、提示都是真实交互；
3. 加权 A* 给出的路径真的能把盘面归位，并弹出胜利层、写入 jiewu.v2；
4. 3×3 / 4×4 / 5×5 切换、模式切回木局再切回数局；
5. 数局会话独立于木局会话，重开能续玩；
6. 全程无脚本异常、无横向溢出。

用法：
    python tests/digital_ui.py
    python tests/digital_ui.py --browser "C:/Program Files/Google/Chrome/Application/chrome.exe"
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
    pre.id = 'dg-test';
    pre.textContent = JSON.stringify(out);
    document.body.appendChild(pre);
  }
  function key(el, k, shift) {
    el.dispatchEvent(new KeyboardEvent('keydown', {
      key: k, shiftKey: !!shift, bubbles: true, cancelable: true
    }));
  }
  function show(id) { return document.getElementById(id).classList.contains('show'); }
  function tile(v) { return document.querySelector('#dgBoard .dg-tile[data-v="' + v + '"]'); }
  function adjacent() {
    var dg = window.__digital;
    var st = dg.state, n = dg.n, b = st.indexOf(0);
    var r = (b / n) | 0, c = b % n;
    var cands = [];
    if (r > 0) cands.push([st[b - n], 'ArrowDown']);
    if (r < n - 1) cands.push([st[b + n], 'ArrowUp']);
    if (c > 0) cands.push([st[b - 1], 'ArrowRight']);
    if (c < n - 1) cands.push([st[b + 1], 'ArrowLeft']);
    return cands[0] || [null, null];
  }
  function farTile() {
    var dg = window.__digital;
    var st = dg.state, n = dg.n, b = st.indexOf(0);
    var br = (b / n) | 0, bc = b % n;
    for (var i = 0; i < st.length; i++) {
      if (!st[i]) continue;
      var r = (i / n) | 0, c = i % n;
      if (Math.abs(r - br) + Math.abs(c - bc) > 1) return st[i];
    }
    return null;
  }

  function collect() {
    var out = {};
    var dg = window.__digital;
    var hr = window.__huarong;
    try {
      out.ok = !!(dg && hr);
      out.phase = (location.search || '').indexOf('phase=2') >= 0 ? 2 : 1;
      out.mode = hr ? hr.mode : null;
      out.modeAttr = document.getElementById('appHuarong').getAttribute('data-mode');
      out.hubHidden = document.getElementById('hub').hidden;
      out.appHidden = document.getElementById('appHuarong').hidden;
      out.n = dg ? dg.n : null;
      out.moves = dg ? dg.moves : null;
      out.state = dg ? dg.state : null;
      out.solvable = dg ? dg.solvable() : null;
      out.tileDom = document.querySelectorAll('#dgBoard .dg-tile').length;
      out.holeDom = document.querySelectorAll('#dgBoard .dg-hole').length;

      if (out.phase === 2) {
        report(out);
        return;
      }

      /* 1. 4×4 起手、可解性、确定性 */
      out.start4 = dg.state.slice();
      out.gen4 = dg.generate(1);
      out.startEqGen = JSON.stringify(out.start4) === JSON.stringify(out.gen4);
      out.holeAtEnd = out.start4[out.start4.length - 1] === 0;
      out.inversionCheck = window.JW.toys.huarong.sliding.isSolvable(
        [2, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0], 4
      );

      /* 2. 点击空格旁边的数字：走一格；点远处的数字：不动 */
      var a = adjacent();
      tile(a[0]).click();
      out.clickMoves = dg.moves;
      out.clickState = dg.state;
      out.clickHistory = dg.historyLength;
      var before = dg.moves;
      var far = farTile();
      if (far) tile(far).click();
      out.farMoves = dg.moves;
      out.farBlocked = dg.moves === before;

      /* 3. 键盘：方向键把相邻数字滑进空格 */
      var b = adjacent();
      var el = tile(b[0]);
      el.focus();
      key(el, b[1]);
      out.kbMoves = dg.moves;
      out.kbHistory = dg.historyLength;

      /* 4. 撤销 / 重置 */
      dg.undo();
      out.undoMoves = dg.moves;
      dg.reset();
      out.resetMoves = dg.moves;
      out.resetState = dg.state;
      out.resetEqStart = JSON.stringify(dg.state) === JSON.stringify(out.start4);

      /* 5. 提示：可见、给出参考余步、标出目标格 */
      document.querySelector('[data-hr-act="hint"]').click();
      setTimeout(function () {
        try {
          out.hintCoachHidden = document.getElementById('dgCoach').hidden;
          out.hintCoach = document.getElementById('dgCoachMsg').textContent;
          out.hintCell = document.querySelector('#dgBoard .dg-hint-cell.show') !== null;
          out.hintTile = document.querySelectorAll('#dgBoard .dg-tile.hint').length;

          /* 6. 解完 4×4：先把前面的走子用演示方式快进，最后一步真实走，
                让胜利层与进度落盘走正常路径。 */
          dg.loadLevel(1);
          var sol = dg.solve({ weight: 3 });
          out.sol4 = sol.distance;
          out.sol4Limit = sol.limitHit;
          for (var i = 0; i < sol.moves.length - 1; i++) dg.apply(sol.moves[i].value, { demo: true });
          dg.apply(sol.moves[sol.moves.length - 1].value);
          setTimeout(function () {
            try {
              out.winShown = show('dgVeilWin');
              out.winTitle = document.getElementById('dgWinTitle').textContent;
              out.winLines = document.getElementById('dgWinLines').textContent.replace(/\s+/g, ' ').trim();
              out.winNote = document.getElementById('dgWinNote').textContent;
              out.winNextHidden = document.getElementById('dgWinNext').hidden;
              out.winInert = document.getElementById('appHuarong').hasAttribute('inert');
              out.finished = dg.finished;

              var doc = JSON.parse(localStorage.getItem('jiewu.v2'));
              out.progress4 = doc.volumes.huarong.progress['digital-16'] || null;
              out.sessionDigital = doc.volumes.huarong.sessionDigital;
              out.woodSession = doc.volumes.huarong.session;

              document.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Escape', bubbles: true, cancelable: true
              }));
              out.winClosedByEsc = !show('dgVeilWin');
              out.inertAfterEsc = document.getElementById('appHuarong').hasAttribute('inert');

              /* 7. 选盘：3×3 / 4×4 / 5×5，切到 5×5 */
              document.querySelector('.rail-right [data-hr-act="levels"]').click();
              out.levelsShown = show('dgVeilLevels');
              out.levelButtons = document.querySelectorAll('#dgLevelGrid .hr-level').length;
              document.querySelector('#dgLevelGrid [data-dg-size="2"]').click();
              out.n5 = dg.n;
              out.tiles5 = document.querySelectorAll('#dgBoard .dg-tile').length;
              out.levelsClosed = !show('dgVeilLevels');

              var a5 = adjacent();
              tile(a5[0]).click();
              out.moves5 = dg.moves;
              out.state5 = dg.state;

              /* 8. 切木局再切回数局：数局局面与步数不丢 */
              document.querySelector('[data-hr-mode="wood"]').click();
              out.woodMode = hr.mode;
              out.woodPieces = document.querySelectorAll('#hrPieces .hr-piece').length;
              out.dgHiddenInWood = getComputedStyle(document.getElementById('dgWrap')).display === 'none';
              document.querySelector('[data-hr-mode="digital"]').click();
              out.backMode = hr.mode;
              out.backN = dg.n;
              out.backMoves = dg.moves;
              out.backState = dg.state;

              var doc2 = JSON.parse(localStorage.getItem('jiewu.v2'));
              out.saved5 = doc2.volumes.huarong.sessionDigital;
              out.settingMode = doc2.settings.huarongMode;
              out.overflow = { sw: document.documentElement.scrollWidth, iw: innerWidth };
              out.errs = window.__errs || [];
              report(out);
            } catch (e) { report({ ok: false, where: 'win', error: String(e), errs: window.__errs }); }
          }, 900);
        } catch (e) { report({ ok: false, where: 'hint', error: String(e), errs: window.__errs }); }
      }, 900);
    } catch (e) {
      report({ ok: false, error: String(e), stack: e && e.stack, errs: window.__errs });
    }
  }

  if (document.readyState === 'complete') setTimeout(collect, 800);
  else window.addEventListener('load', function () { setTimeout(collect, 800); });
})();
</script>
"""


def run_browser(browser: str, url: str, profile: Path, timeout: int = 120) -> str:
    args = [
        browser, "--headless=new", "--disable-gpu", "--no-first-run",
        "--no-default-browser-check", "--mute-audio",
        f"--user-data-dir={profile}", "--window-size=1200,900",
        "--virtual-time-budget=30000", "--dump-dom", url,
    ]
    p = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    return p.stdout.decode("utf-8", errors="replace")


def parse_probe(dom: str) -> dict:
    m = re.search(r'<pre id="dg-test">(.*?)</pre>', dom, re.S)
    if not m:
        raise SystemExit("数局 UI 页面没有输出测试结果：可能启动失败或脚本报错")
    return json.loads(html.unescape(m.group(1)))


def check(cond: bool, label: str, failures: list[str]) -> None:
    print(("  ok    " if cond else "  FAIL  ") + label)
    if not cond:
        failures.append(label)


def main() -> int:
    parser = argparse.ArgumentParser(description="数局 UI 回归测试")
    parser.add_argument("--browser", default=DEFAULT_BROWSER)
    parser.add_argument("--keep", action="store_true", help="保留临时目录")
    args = parser.parse_args()

    browser = Path(args.browser)
    if not browser.is_file():
        raise SystemExit(f"找不到浏览器：{browser}\n可用 --browser 指定 Edge/Chrome 路径")

    dist = ROOT / "dist" / "index.html"
    if not dist.is_file():
        raise SystemExit("缺少 dist/index.html，请先运行：python src/build.py")

    tmp = Path(tempfile.mkdtemp(prefix="jiewu-digital-ui-"))
    page = tmp / "ui.html"
    page.write_text(
        dist.read_text(encoding="utf-8").replace("</body>", PROBE + "</body>", 1),
        encoding="utf-8",
    )
    profile = tmp / "profile"
    profile.mkdir()

    data = parse_probe(run_browser(str(browser), page.as_uri() + "?play=huarong&mode=digital", profile))

    failures: list[str] = []
    print("[数局 UI] 点击 / 键盘 / 提示 / 胜利 / 选盘 / 切局 / 续玩")
    check(data.get("ok") is True, "数局与调试接口就位", failures)
    check(data.get("mode") == "digital" and data.get("modeAttr") == "digital", "深链进入数局", failures)
    check(data.get("hubHidden") is True and data.get("appHidden") is False, "深链收起馆入口并显示卷二", failures)
    check(data.get("n") == 4 and data.get("tileDom") == 15 and data.get("holeDom") == 1, "4×4 盘面十五块数字一个空格", failures)
    check(data.get("solvable") is True, "起手盘面可解", failures)
    check(data.get("startEqGen") is True, "固定 seed 生成同一盘", failures)
    check(data.get("holeAtEnd") is False, "起手空格不在右下（不是已解）", failures)
    check(data.get("inversionCheck") is False, "交换一对数字后判为不可解", failures)
    check(data.get("clickMoves") == 1 and data.get("clickHistory") == 1, "点击相邻数字走一格并写入历史", failures)
    check(data.get("farBlocked") is True, "点击远处数字不动", failures)
    check(data.get("kbMoves") == 2 and data.get("kbHistory") == 2, "方向键把数字滑进空格", failures)
    check(data.get("undoMoves") == 1, "撤销回退一步", failures)
    check(data.get("resetMoves") == 0 and data.get("resetEqStart") is True, "重置回到本盘起手", failures)
    check(data.get("hintCoachHidden") is False and "参考解还剩" in (data.get("hintCoach") or ""), "提示给出参考余步", failures)
    check(data.get("hintCell") is True and data.get("hintTile") == 1, "提示标出目标空格与数字", failures)
    check((data.get("sol4") or 0) > 0 and data.get("sol4Limit") is False, "4×4 求出可行解", failures)
    check(data.get("winShown") is True and data.get("winTitle") == "数阵已归位", "归位后弹出胜利层", failures)
    check("步数" in (data.get("winLines") or "") and "最佳" in (data.get("winLines") or ""), "胜利层列出步数与最佳", failures)
    check("已记入档案" in (data.get("winNote") or ""), "胜利层说明已记档", failures)
    check(data.get("winNextHidden") is False, "4×4 胜利后仍可换大盘", failures)
    check(data.get("winInert") is True, "胜利层打开时游戏层 inert", failures)
    check((data.get("progress4") or {}).get("bestMoves") == data.get("sol4"), "4×4 最佳步数落盘", failures)
    check(data.get("sessionDigital") is None, "胜利后清空数局会话", failures)
    check(data.get("winClosedByEsc") is True and data.get("inertAfterEsc") is False, "Escape 关闭胜利层并解除 inert", failures)
    check(data.get("levelsShown") is True and data.get("levelButtons") == 3, "选盘弹层三档", failures)
    check(data.get("n5") == 5 and data.get("tiles5") == 24 and data.get("levelsClosed") is True, "切到 5×5 并关闭弹层", failures)
    check(data.get("moves5") == 1, "5×5 走子计步", failures)
    check(data.get("woodMode") == "wood" and data.get("woodPieces") == 3, "切回木局", failures)
    check(data.get("dgHiddenInWood") is True, "木局时数局棋盘隐藏", failures)
    check(data.get("backMode") == "digital" and data.get("backN") == 5 and data.get("backMoves") == 1, "切回数局保留局面", failures)
    check(data.get("backState") == data.get("state5"), "切回数局仍是同一盘", failures)
    check((data.get("saved5") or {}).get("mode") == "digital" and (data.get("saved5") or {}).get("size") == 5, "数局会话独立落盘", failures)
    check(data.get("settingMode") == "digital", "记住上次模式", failures)
    check(data.get("errs") == [], "无脚本异常", failures)
    check((data.get("overflow") or {}).get("sw", 0) <= (data.get("overflow") or {}).get("iw", 0) + 1, "无横向溢出", failures)

    print("[数局 UI] 重开续玩")
    again = parse_probe(run_browser(str(browser), page.as_uri() + "?play=huarong&phase=2", profile))
    check(again.get("mode") == "digital", "重开按上次模式进入数局", failures)
    check(again.get("n") == 5 and again.get("moves") == 1, "续玩恢复盘面与步数", failures)
    check(again.get("state") == data.get("state5"), "续玩恢复同一局面", failures)

    if args.keep:
        print(f"临时目录：{tmp}")
    else:
        import shutil
        shutil.rmtree(tmp, ignore_errors=True)

    if failures:
        print(f"\n[dg-ui] FAIL {len(failures)} 项")
        return 1
    print("\n[dg-ui] OK 全部断言通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
