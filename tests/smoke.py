#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
解物 · 单文件烟雾测试（零依赖）

用无头 Edge 打开构建产物，验证：
1. 源码/构建产物能正常启动，JW 命名空间与九连环模块就位；
2. 旧 jielianhuan.* 存档首次启动迁移到 jiewu.v2，旧键保留；
3. 第二次启动不重复迁移，进度、会话、设置、手记都能恢复；
4. 一次真实点击能改变局面，并按节流写入会话。

用法：
    python tests/smoke.py
    python tests/smoke.py --browser "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
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

SEED = r"""
<script>
(function () {
  var q = location.search || '';
  if (q.indexOf('seed=1') < 0) return;
  try {
    localStorage.clear();
    var prog = {};
    ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9'].forEach(function (id) {
      prog[id] = { moves: 10, stars: 3, time: 1000 };
    });
    localStorage.setItem('jielianhuan.prototype.v1', JSON.stringify(prog));
    localStorage.setItem('jielianhuan.settings.v2', JSON.stringify({
      muted: true, legal: true, freeMode: false, tutorialDone: true,
      contrast: true, chaptersSeen: { jade: true }, cards: { c1: true },
      cardCursor: {}, skin: 'jade'
    }));
    localStorage.setItem('jielianhuan.stats.v1', JSON.stringify({
      moves: 42, undo: 2, hint: 1, auto: 0, wins: 3, time: 9999
    }));
    localStorage.setItem('jielianhuan.session.v1', JSON.stringify({
      levelIndex: 1, state: 15, moves: 1, elapsed: 1000,
      history: [15], tutorial: null
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
    pre.id = 'jw-test';
    pre.textContent = JSON.stringify(out);
    document.body.appendChild(pre);
  }
  function collect(firstRun) {
    var out = {};
    try {
      var store = window.JW && JW.core && JW.core.store;
      var puzzle = window.__puzzle;
      out.ok = !!(store && puzzle);
      out.firstRun = firstRun;
      out.version = window.JW ? JW.VERSION : null;
      out.volumes = window.JW && JW.data ? JW.data.volumes.map(function (v) { return v.id; }) : null;
      out.storeKey = store ? store.KEY : null;
      out.inspect = store ? store.inspect() : null;
      out.ringsTitle = window.JW && JW.toys.rings ? JW.toys.rings.title : null;
      out.domRings = document.querySelectorAll('#rings g.ring').length;
      out.level = puzzle ? puzzle.level.name : null;
      out.levelN = puzzle ? puzzle.level.n : null;
      out.levelIndex = puzzle ? puzzle.levelIndex : null;
      out.state = puzzle ? puzzle.state : null;
      out.moves = puzzle ? puzzle.moves : null;
      out.settings = puzzle ? {
        skin: puzzle.settings.skin,
        contrast: puzzle.settings.contrast,
        tutorialDone: puzzle.settings.tutorialDone,
        muted: puzzle.settings.muted
      } : null;
      out.stats = puzzle ? {
        moves: puzzle.stats.moves,
        wins: puzzle.stats.wins,
        undo: puzzle.stats.undo
      } : null;
      out.legacyKept = !!localStorage.getItem('jielianhuan.prototype.v1');
      out.seedError = window.__seedError || null;

      var el = document.querySelector('#rings g.ring[data-i="1"]');
      if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      out.afterClickState = puzzle ? puzzle.state : null;
      out.afterClickMoves = puzzle ? puzzle.moves : null;

      setTimeout(function () {
        try {
          var doc = JSON.parse(localStorage.getItem('jiewu.v2'));
          out.docVersion = doc.version;
          out.progressStars = doc.volumes.rings.progress.L1 ? doc.volumes.rings.progress.L1.stars : null;
          out.session = doc.volumes.rings.session;
        } catch (e) {
          out.docError = String(e);
        }
        report(out);
      }, 900);
    } catch (e) {
      report({ ok: false, error: String(e) });
    }
  }
  function start() {
    var firstRun = (location.search || '').indexOf('seed=1') >= 0;
    setTimeout(function () { collect(firstRun); }, 350);
  }
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();
</script>
"""


HUB_PROBE = r"""
<script>
(function () {
  function report(out) {
    var pre = document.createElement('pre');
    pre.id = 'jw-test';
    pre.textContent = JSON.stringify(out);
    document.body.appendChild(pre);
  }
  function text(sel) {
    var el = document.querySelector(sel);
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
  }
  function collect() {
    var out = {};
    try {
      var hub = document.getElementById('hub');
      var app = document.querySelector('.app');
      var cards = Array.prototype.slice.call(document.querySelectorAll('.hub-item'));
      out.ok = !!(window.JW && JW.hub && window.__puzzle);
      out.cardCount = cards.length;
      out.cardIds = cards.map(function (c) { return c.dataset.hubId; });
      out.selected = window.JW.hub.selected();
      out.currentId = (document.querySelector('.hub-item[aria-current="true"]') || {}).dataset
        ? document.querySelector('.hub-item[aria-current="true"]').dataset.hubId : null;
      out.hubOpen = window.JW.hub.isOpen();
      out.hubHidden = hub.hidden;
      out.appInert = app.hasAttribute('inert');
      out.enterLabel = text('.hub-enter');
      out.enterDisabled = !!document.querySelector('.hub-enter').disabled;
      out.sessionLine = text('.hub-session');
      out.cardStates = cards.map(function (c) {
        var s = c.querySelector('[data-hub-state]');
        return s ? s.textContent.trim() : null;
      });

      // 方向键在四座器台间移动，并把展签切到下一卷。
      cards[0].focus();
      cards[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      out.afterArrow = window.JW.hub.selected();

      window.JW.hub.select('rings');
      document.querySelector('.hub-enter').click();
      out.afterEnterOpen = window.JW.hub.isOpen();
      out.afterEnterHidden = hub.hidden;
      out.afterEnterVeil = !!document.querySelector('.veil.show');
      out.afterEnterInert = app.hasAttribute('inert');
      out.afterEnterLevel = window.__puzzle ? window.__puzzle.level.name : null;

      // 首入卷一先看章节过场；过场本身是模态，关掉后游戏层才解除 inert。
      var close = document.querySelector('#veilChapter [data-act="closeChapter"]');
      if (close) close.click();
      out.afterCloseVeil = !document.querySelector('.veil.show');
      out.afterCloseInert = app.hasAttribute('inert');

      document.getElementById('btnHub').click();
      out.afterBackOpen = window.JW.hub.isOpen();
      out.afterBackHidden = hub.hidden;
      out.afterBackInert = app.hasAttribute('inert');
      out.afterBackSession = text('.hub-session');
      out.afterBackEnter = text('.hub-enter');

      // 卷二：从馆入口进入华容道，再切回卷一。
      window.JW.hub.select('huarong');
      out.hrEnterLabel = text('.hub-enter');
      document.querySelector('.hub-enter').click();
      out.hrOpen = window.JW.hub.isOpen();
      out.hrHubHidden = hub.hidden;
      out.hrAppHidden = document.getElementById('appHuarong').hidden;
      out.ringsAfterHr = document.getElementById('appRings').hidden;
      out.hrLevel = window.__huarong ? window.__huarong.level.name : null;
      out.hrActive = window.JW.hub.active();

      document.getElementById('btnHub').click();
      out.hrBackOpen = window.JW.hub.isOpen();
      out.hrBackInert = document.getElementById('appHuarong').hasAttribute('inert');
      out.hrBackSession = text('.hub-session');

      window.JW.hub.select('rings');
      document.querySelector('.hub-enter').click();
      out.ringsAgainHub = hub.hidden;
      out.ringsAgainHidden = document.getElementById('appRings').hidden;
      out.hrAgainHidden = document.getElementById('appHuarong').hidden;
      out.ringsAgainActive = window.JW.hub.active();

      report(out);
    } catch (e) {
      report({ ok: false, error: String(e) });
    }
  }
  function start() { setTimeout(collect, 700); }
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();
</script>
"""


HR_PROBE = r"""
<script>
(function () {
  function report(out) {
    var pre = document.createElement('pre');
    pre.id = 'hr-test';
    pre.textContent = JSON.stringify(out);
    document.body.appendChild(pre);
  }
  function collect() {
    var out = {};
    try {
      var hr = window.__huarong;
      var toy = window.JW && JW.toys && JW.toys.huarong;
      out.ok = !!(hr && toy);
      out.hrTitle = toy ? toy.title : null;
      out.level = hr ? hr.level.name : null;
      out.levelIndex = hr ? hr.levelIndex : null;
      out.pieces = hr ? hr.state.length : null;
      out.hrHidden = document.getElementById('appHuarong').hidden;
      out.ringsHidden = document.getElementById('appRings').hidden;
      out.hubHidden = document.getElementById('hub').hidden;
      out.active = window.JW && JW.hub ? JW.hub.active() : null;
      out.hrName = hr ? hr.level.name : null;
      out.hrSub = document.getElementById('hrSub') ? document.getElementById('hrSub').textContent : null;
      out.overflow = { sw: document.documentElement.scrollWidth, iw: innerWidth };

      var phase2 = (location.search || '').indexOf('phase=2') >= 0;
      if (phase2) {
        out.metrics = hr.metrics;
        out.state = hr.state;
        out.unitDom = document.querySelector('[data-hr-count="unit"]').textContent;
        report(out);
        return;
      }

      out.metrics = hr.metrics;
      out.optimal = hr.optimal;
      out.pieceDom = document.querySelectorAll('#hrPieces .hr-piece').length;
      out.metricDom = Array.prototype.map.call(document.querySelectorAll('[data-hr-count]'), function (el) {
        return el.getAttribute('data-hr-count') + '=' + el.textContent;
      });
      out.optDom = Array.prototype.map.call(document.querySelectorAll('[data-hr-opt]'), function (el) {
        return el.getAttribute('data-hr-opt') + '=' + el.textContent;
      });

      // 小试：卒 (2,1) 向左一格，再向下。单格 2 / 直线 2 / 古法 1。
      out.move1 = hr.movePiece(1, 'left', false);
      out.m1 = hr.metrics;
      out.move2 = hr.movePiece(1, 'down', false);
      out.m2 = hr.metrics;

      hr.loadLevel(1);
      out.bigLevel = hr.level.name;
      out.bigPieces = hr.state.length;
      out.bigOptimal = hr.optimal;
      out.bigPieceDom = document.querySelectorAll('#hrPieces .hr-piece').length;
      out.solves = {};
      ['straight', 'finger', 'unit'].forEach(function (m) {
        hr.loadLevel(1);
        var sol = hr.solve(m);
        out.solves[m] = { distance: sol.distance, moves: sol.moves.length };
        if (m === 'straight') {
          for (var i = 0; i < sol.moves.length; i++) hr.apply(sol.moves[i], { demo: true });
          out.pathEndCao = hr.state[0];
        }
      });

      // 留下一个可续玩的会话：回到小试，走两步。
      hr.loadLevel(0);
      hr.movePiece(1, 'left', false);
      hr.movePiece(1, 'down', false);
      out.finalMetrics = hr.metrics;
      out.finalState = hr.state;
      out.errs = window.__errs || [];
      report(out);
    } catch (e) {
      report({ ok: false, error: String(e), stack: e && e.stack, errs: window.__errs || [] });
    }
  }
  window.__errs = window.__errs || [];
  window.addEventListener('error', function (e) { window.__errs.push(String(e.message || e)); });
  if (document.readyState === 'complete') setTimeout(collect, 600);
  else window.addEventListener('load', function () { setTimeout(collect, 600); });
})();
</script>
"""


def build_page(dist: Path) -> str:
    page = dist.read_text(encoding="utf-8")
    marker = "<script>\n/* ==== core/namespace.js ==== */"
    if marker not in page:
        raise SystemExit("dist/index.html 里找不到命名空间脚本，请先运行 python src/build.py")
    page = page.replace(marker, SEED + marker, 1)
    page = page.replace("</body>", PROBE + "</body>", 1)
    return page


def build_hub_page(dist: Path) -> str:
    page = dist.read_text(encoding="utf-8")
    page = page.replace("</body>", HUB_PROBE + "</body>", 1)
    return page


def build_hr_page(dist: Path) -> str:
    page = dist.read_text(encoding="utf-8")
    page = page.replace("</body>", HR_PROBE + "</body>", 1)
    return page


def run_browser(browser: str, url: str, profile: Path, timeout: int = 40) -> str:
    out = profile / "stdout.txt"
    err = profile / "stderr.txt"
    args = [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--mute-audio",
        f"--user-data-dir={profile}",
        "--virtual-time-budget=6000",
        "--dump-dom",
        url,
    ]
    proc = subprocess.run(
        [browser, *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout,
    )
    out.write_bytes(proc.stdout)
    err.write_bytes(proc.stderr)
    return proc.stdout.decode("utf-8", errors="replace")


def parse_probe(dom: str) -> dict:
    m = re.search(r'<pre id="jw-test">(.*?)</pre>', dom, re.S)
    if not m:
        raise SystemExit("页面没有输出测试结果：可能启动失败或脚本报错")
    return json.loads(html.unescape(m.group(1)))


def parse_hr_probe(dom: str) -> dict:
    m = re.search(r'<pre id="hr-test">(.*?)</pre>', dom, re.S)
    if not m:
        raise SystemExit("华容道页面没有输出测试结果：可能启动失败或脚本报错")
    return json.loads(html.unescape(m.group(1)))


def check(cond: bool, label: str, failures: list[str]) -> None:
    print(("  ok  " if cond else "  FAIL") + "  " + label)
    if not cond:
        failures.append(label)


def main() -> int:
    parser = argparse.ArgumentParser(description="解物单文件烟雾测试")
    parser.add_argument("--browser", default=DEFAULT_BROWSER)
    parser.add_argument("--keep", action="store_true", help="保留临时目录")
    args = parser.parse_args()

    browser = Path(args.browser)
    if not browser.is_file():
        raise SystemExit(f"找不到浏览器：{browser}\n可用 --browser 指定 Edge/Chrome 路径")

    dist = ROOT / "dist" / "index.html"
    if not dist.is_file():
        raise SystemExit("缺少 dist/index.html，请先运行：python src/build.py")

    tmp = Path(tempfile.mkdtemp(prefix="jiewu-smoke-"))
    page = tmp / "smoke.html"
    page.write_text(build_page(dist), encoding="utf-8")
    url = page.as_uri()
    hub_page = tmp / "hub.html"
    hub_page.write_text(build_hub_page(dist), encoding="utf-8")
    hub_url = hub_page.as_uri()
    hr_page = tmp / "huarong.html"
    hr_page.write_text(build_hr_page(dist), encoding="utf-8")
    hr_url = hr_page.as_uri()

    profile1 = tmp / "profile-1"
    profile1.mkdir()
    print("[1/4] 首次启动：迁移旧存档")
    first = parse_probe(run_browser(str(browser), url + "?play=rings&seed=1", profile1))

    failures: list[str] = []
    check(first.get("ok") is True, "JW 与九连环模块启动", failures)
    check(first.get("version") == "0.8.0-dev", "版本号 0.8.0-dev", failures)
    check(first.get("volumes") == ["rings", "huarong", "tangram", "burr"], "四卷元数据就位", failures)
    check(first.get("storeKey") == "jiewu.v2", "统一存档键 jiewu.v2", failures)
    check((first.get("inspect") or {}).get("migrated") is True, "首次启动执行迁移", failures)
    check(first.get("ringsTitle") == "九连环", "JW.toys.rings 注册", failures)
    check(first.get("domRings") == 4 and first.get("domRings") == first.get("levelN"), "四连环渲染 4 只环", failures)
    check(first.get("level") == "四连环" and first.get("state") == 15, "旧会话恢复到四连环", failures)
    check((first.get("settings") or {}).get("skin") == "jade", "旧设置 skin 迁移", failures)
    check((first.get("settings") or {}).get("contrast") is True, "旧设置 contrast 迁移", failures)
    check((first.get("stats") or {}).get("wins") == 3, "旧手记 wins 迁移", failures)
    check(first.get("progressStars") == 3, "旧进度 stars 迁移", failures)
    check(first.get("docVersion") == 2, "存档结构 version=2", failures)
    check(first.get("legacyKept") is True, "旧键保留未删除", failures)
    check(first.get("afterClickState") == 14 and first.get("afterClickMoves") == 2, "点击第 1 环走子", failures)
    check((first.get("session") or {}).get("state") == 14, "会话节流写入 jiewu.v2", failures)

    print("[2/4] 第二次启动：不重复迁移")
    second = parse_probe(run_browser(str(browser), url + "?play=rings&seed=0", profile1))
    check(second.get("ok") is True, "第二次启动正常", failures)
    check((second.get("inspect") or {}).get("migratedNow") is False, "不重复迁移", failures)
    check(second.get("state") == 14 and second.get("moves") == 2, "会话续玩恢复", failures)
    check(second.get("progressStars") == 3, "进度仍在", failures)
    check(second.get("afterClickState") == 15, "恢复后仍可走子", failures)

    print("[3/4] 馆入口：四卷、切卷与返回")
    profile2 = tmp / "profile-2"
    profile2.mkdir()
    hub = parse_probe(run_browser(str(browser), hub_url, profile2))
    check(hub.get("ok") is True, "馆入口与九连环同时就位", failures)
    check(hub.get("cardCount") == 4 and hub.get("cardIds") == ["rings", "huarong", "tangram", "burr"], "四座器台", failures)
    check((hub.get("cardStates") or [])[2] == "可入卷", "卷三七巧板已上线", failures)
    check(hub.get("currentId") == "rings" and hub.get("selected") == "rings", "默认停在卷一", failures)
    check(hub.get("hubOpen") is True and hub.get("hubHidden") is False, "首次打开落在馆入口", failures)
    check(hub.get("appInert") is True, "馆开启时游戏层 inert", failures)
    check(hub.get("sessionLine") == "尚未开始。三环引导会带你走第一步。", "空会话显示尚未开始", failures)
    check(hub.get("enterLabel") == "进入卷一" and hub.get("enterDisabled") is False, "按钮显示进入卷一", failures)
    check(hub.get("afterArrow") == "huarong", "方向键切到卷二展签", failures)
    check(hub.get("afterEnterOpen") is False and hub.get("afterEnterHidden") is True, "进入卷一后收起馆入口", failures)
    check(hub.get("afterEnterVeil") is True, "首次进入弹出章节过场", failures)
    check(hub.get("afterEnterInert") is True, "过场期间游戏层保持 inert", failures)
    check(hub.get("afterEnterLevel") == "三连环", "进入卷一落在三连环", failures)
    check(hub.get("afterCloseVeil") is True and hub.get("afterCloseInert") is False, "关过场后解除 inert", failures)
    check(hub.get("afterBackOpen") is True and hub.get("afterBackHidden") is False, "返回馆可再次打开", failures)
    check(hub.get("afterBackInert") is True, "返回馆后游戏层重新 inert", failures)
    check(hub.get("afterBackSession") == "尚未开始。三环引导会带你走第一步。", "返回后仍不误报上次进度", failures)
    check(hub.get("afterBackEnter") == "进入卷一", "返回后按钮仍为进入卷一", failures)
    check(hub.get("hrEnterLabel") == "进入卷二", "卷二展签显示进入卷二", failures)
    check(hub.get("hrOpen") is False and hub.get("hrHubHidden") is True, "进入卷二后收起馆入口", failures)
    check(hub.get("hrAppHidden") is False and hub.get("ringsAfterHr") is True, "卷二显示、卷一隐藏", failures)
    check(hub.get("hrLevel") == "小试" and hub.get("hrActive") == "huarong", "卷二落在小试", failures)
    check(hub.get("hrBackOpen") is True and hub.get("hrBackInert") is True, "卷二可返回馆且游戏层 inert", failures)
    check(hub.get("hrBackSession") == "尚未开始。先走一局「小试」，十步之内学会推块。", "卷二空会话不误报进度", failures)
    check(hub.get("ringsAgainHidden") is False and hub.get("hrAgainHidden") is True, "切回卷一后卷二隐藏", failures)
    check(hub.get("ringsAgainActive") == "rings", "切回卷一后活动卷正确", failures)

    print("[4/4] 卷二华容道：4×5、三种计步、求解与续玩")
    profile3 = tmp / "profile-3"
    profile3.mkdir()
    hr = parse_hr_probe(run_browser(str(browser), hr_url + "?play=huarong", profile3, timeout=60))
    check(hr.get("ok") is True and hr.get("hrTitle") == "华容道", "华容道模块启动", failures)
    check(hr.get("hubHidden") is True and hr.get("hrHidden") is False and hr.get("ringsHidden") is True,
          "深链 ?play=huarong 直接入局", failures)
    check(hr.get("level") == "小试" and hr.get("levelIndex") == 0 and hr.get("pieces") == 3, "首局小试三块棋", failures)
    check(hr.get("pieceDom") == 3, "小试渲染 3 块木棋", failures)
    check(hr.get("optimal") == {"straight": 3, "finger": 2, "unit": 5}, "小试三种最优步数", failures)
    check(hr.get("metricDom") == ["straight=0", "finger=0", "unit=0"], "三种计步初始为 0", failures)
    check(hr.get("optDom") == ["straight=3", "finger=2", "unit=5"], "三种最优值写在 HUD", failures)
    check(hr.get("m1") == {"straight": 1, "finger": 1, "unit": 1}, "第一步三口径同为 1", failures)
    check(hr.get("m2") == {"straight": 2, "finger": 1, "unit": 2}, "同块转向：直线 2 / 古法 1", failures)
    check(hr.get("bigLevel") == "横刀立马" and hr.get("bigPieces") == 10 and hr.get("bigPieceDom") == 10,
          "横刀立马十块棋", failures)
    check(hr.get("bigOptimal") == {"straight": 90, "finger": 81, "unit": 116}, "横刀立马 90 / 81 / 116", failures)
    check((hr.get("solves") or {}).get("straight", {}).get("distance") == 90, "浏览器 BFS 直线步 90", failures)
    check((hr.get("solves") or {}).get("finger", {}).get("distance") == 81, "浏览器 BFS 古法指步 81", failures)
    check((hr.get("solves") or {}).get("unit", {}).get("distance") == 116, "浏览器 BFS 单格步 116", failures)
    check(hr.get("pathEndCao") == 13, "90 步路径真的把曹操送到出口", failures)
    check(hr.get("errs") == [], "华容道无脚本异常", failures)
    check(hr.get("overflow", {}).get("sw", 0) <= hr.get("overflow", {}).get("iw", 0) + 1, "华容道无横向溢出", failures)
    check(hr.get("finalMetrics") == {"straight": 2, "finger": 1, "unit": 2}, "离局前存档步数正确", failures)

    again = parse_hr_probe(run_browser(str(browser), hr_url + "?play=huarong&phase=2", profile3, timeout=60))
    check(again.get("metrics") == {"straight": 2, "finger": 1, "unit": 2}, "华容道会话续玩恢复三口径", failures)
    check(again.get("state") == hr.get("finalState"), "华容道恢复同一局面", failures)
    check(again.get("unitDom") == "2", "续玩后 HUD 步数正确", failures)

    if args.keep:
        print(f"[keep] {tmp}")
    else:
        import shutil
        shutil.rmtree(tmp, ignore_errors=True)

    if failures:
        print(f"\n[smoke] FAILED {len(failures)} 项")
        for f in failures:
            print(" - " + f)
        return 1
    print("\n[smoke] OK 全部断言通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
