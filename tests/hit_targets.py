#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
解物 · 环命中区回归测试（零依赖）

用无头 Edge 分别以桌面与 390×844 窗口打开 dist/index.html，验证：
1. 九连环的透明命中区足够高，触屏/窄屏下不缩成小点；
2. 相邻两环的命中区不重叠，不会点错环；
3. 环体外侧、旧圆形热区之外仍可点中，且能真实走子；
4. 键盘 roving 焦点不受影响，页面无横向溢出。

用法：
    python tests/hit_targets.py
    python tests/hit_targets.py --browser "C:/Program Files/Google/Chrome/Application/chrome.exe"
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
MARKER = "<script>\n/* ==== core/namespace.js ==== */"

SEED = r"""
<script>
(function () {
  try {
    function vol() { return { progress: {}, session: null }; }
    localStorage.setItem('jiewu.v2', JSON.stringify({
      version: 2,
      volumes: { rings: vol(), huarong: vol(), tangram: vol(), burr: vol() },
      settings: {
        muted: true, legal: false, freeMode: true, tutorialDone: true, contrast: false,
        chaptersSeen: { jade: 1, danqian: 1, honglou: 1, miaoxu: 1, gewu: 1 },
        cards: {}, cardCursor: {}, skin: 'brass'
      },
      stats: {}
    }));
  } catch (e) {
    window.__seedError = String(e);
  }
})();
</script>
"""

PROBE = r"""
<script>
(function () {
  function report(out) {
    var pre = document.createElement('pre');
    pre.id = 'hit-test';
    pre.textContent = JSON.stringify(out);
    document.body.appendChild(pre);
  }
  function measure() {
    try {
      var puzzle = window.__puzzle;
      if (!puzzle) { setTimeout(measure, 100); return; }
      puzzle.loadLevel(6); // 第九环：九连环全上，环 1 可动
      setTimeout(function () {
        try {
          var out = { ok: true, error: null, viewport: { w: innerWidth, h: innerHeight }, rings: [] };
          var board = document.getElementById('board').getBoundingClientRect();
          out.scale = Math.min(board.width / 1000, board.height / 560);

          for (var i = 1; i <= 9; i++) {
            var el = document.querySelector('.ring[data-i="' + i + '"] .ring-hit');
            if (!el) continue;
            var r = el.getBoundingClientRect();
            out.rings.push({
              i: i, left: r.left, right: r.right, top: r.top, bottom: r.bottom,
              w: r.width, h: r.height, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2
            });
          }
          if (out.rings.length !== 9) {
            out.ok = false;
            out.error = '命中区数量应为 9，实际 ' + out.rings.length;
            report(out);
            return;
          }

          var r1 = out.rings[0], r2 = out.rings[1];
          var oldR = (31.41 + 8.48 * 0.9) * out.scale;
          var y = r1.cy - oldR - 3;
          out.topProbe = { y: y, within: y >= r1.top && y <= r1.bottom };

          var hit = document.elementFromPoint(r1.cx, y);
          out.hitClass = hit ? (hit.getAttribute('class') || hit.tagName) : null;

          var before = puzzle.moves;
          if (hit) hit.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          out.beforeMoves = before;
          out.afterMoves = puzzle.moves;

          var ring1 = document.querySelector('.ring[data-i="1"]');
          try { ring1.focus(); } catch (e) {}
          ring1.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
          var active = document.activeElement;
          out.focusAfterArrow = active && active.getAttribute ? active.getAttribute('data-i') : null;

          out.overflow = { sw: document.documentElement.scrollWidth, iw: innerWidth };
          out.seedError = window.__seedError || null;
          report(out);
        } catch (e) {
          report({ ok: false, error: String(e) });
        }
      }, 500);
    } catch (e) {
      report({ ok: false, error: String(e) });
    }
  }
  if (document.readyState === 'complete') setTimeout(measure, 250);
  else window.addEventListener('load', function () { setTimeout(measure, 250); });
})();
</script>
"""


def build_page(dist: Path) -> str:
    page = dist.read_text(encoding="utf-8")
    if MARKER not in page:
        raise SystemExit("dist/index.html 里找不到命名空间脚本，请先运行 python src/build.py")
    page = page.replace(MARKER, SEED + MARKER, 1)
    page = page.replace("</body>", PROBE + "</body>", 1)
    return page


def run_browser(browser: str, url: str, profile: Path, width: int, height: int, timeout: int = 40) -> str:
    args = [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--mute-audio",
        f"--user-data-dir={profile}",
        f"--window-size={width},{height}",
        "--force-device-scale-factor=1",
        "--virtual-time-budget=6000",
        "--dump-dom",
        url,
    ]
    proc = subprocess.run([browser, *args], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    return proc.stdout.decode("utf-8", errors="replace")


def parse_probe(dom: str) -> dict:
    m = re.search(r'<pre id="hit-test">(.*?)</pre>', dom, re.S)
    if not m:
        raise SystemExit("页面没有输出命中区结果：可能启动失败或脚本报错")
    return json.loads(html.unescape(m.group(1)))


def check(cond: bool, label: str, failures: list[str]) -> None:
    print(("  ok  " if cond else "  FAIL") + "  " + label)
    if not cond:
        failures.append(label)


def main() -> int:
    parser = argparse.ArgumentParser(description="解物环命中区回归测试")
    parser.add_argument("--browser", default=DEFAULT_BROWSER)
    parser.add_argument("--keep", action="store_true", help="保留临时目录")
    args = parser.parse_args()

    browser = Path(args.browser)
    if not browser.is_file():
        raise SystemExit(f"找不到浏览器：{browser}\n可用 --browser 指定 Edge/Chrome 路径")

    dist = ROOT / "dist" / "index.html"
    if not dist.is_file():
        raise SystemExit("缺少 dist/index.html，请先运行：python src/build.py")

    tmp = Path(tempfile.mkdtemp(prefix="jiewu-hit-"))
    page = tmp / "hit.html"
    page.write_text(build_page(dist), encoding="utf-8")
    url = page.as_uri() + "#rings"

    cases = [
        ("桌面 1200×900", 1200, 900, 70, 25),
        ("触屏 390×844", 390, 844, 44, 25),
    ]
    failures: list[str] = []

    for name, width, height, min_h, min_w in cases:
        print(f"[{name}]")
        profile = tmp / f"profile-{width}"
        profile.mkdir()
        data = parse_probe(run_browser(str(browser), url, profile, width, height))

        check(data.get("ok") is True, f"{name}：九连环与命中区就位", failures)
        if not data.get("ok"):
            check(False, f"{name}：错误 {data.get('error')}", failures)
            continue

        rings = data["rings"]
        r1, r2 = rings[0], rings[1]
        check(r1["h"] >= min_h, f"{name}：热区高 {r1['h']:.1f}px ≥ {min_h}px", failures)
        check(r1["w"] >= min_w, f"{name}：热区宽 {r1['w']:.1f}px ≥ {min_w}px", failures)
        check(r1["right"] <= r2["left"] + 0.6,
              f"{name}：相邻热区不重叠（{r1['right']:.1f} ≤ {r2['left']:.1f}）", failures)
        check(data["topProbe"]["within"] is True, f"{name}：环上方扩展区存在", failures)
        check(data["hitClass"] == "ring-hit", f"{name}：环上方点击命中 ring-hit", failures)
        check(data["afterMoves"] == data["beforeMoves"] + 1,
              f"{name}：环上方点击可走子（{data['beforeMoves']} → {data['afterMoves']}）", failures)
        check(data["focusAfterArrow"] == "2", f"{name}：方向键焦点仍可移动", failures)
        check(data["overflow"]["sw"] <= data["overflow"]["iw"] + 1,
              f"{name}：无横向溢出", failures)
        check(data.get("seedError") is None, f"{name}：无启动异常", failures)

    if args.keep:
        print(f"[keep] {tmp}")
    else:
        import shutil
        shutil.rmtree(tmp, ignore_errors=True)

    if failures:
        print(f"\n[hit] FAILED {len(failures)} 项")
        for f in failures:
            print(" - " + f)
        return 1
    print("\n[hit] OK 全部断言通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
