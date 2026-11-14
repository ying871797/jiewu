#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
解物 · 零依赖构建

把 src/ 下的脚本按固定顺序内联进 src/shell.html，输出单文件 dist/index.html。
只用 Python 标准库；不引入 npm、bundler 或任何网络依赖。

用法：
    python src/build.py            构建 dist/index.html 与 PWA 资源
    python src/build.py --dev      生成根目录 dev.html（逐文件 <script>，便于调试）
    python src/build.py --check    只检查 dist 是否与当前源码一致
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
MARKER = "<!-- JW_SCRIPTS -->"
OUT_PROD = ROOT / "dist" / "index.html"
OUT_DEV = ROOT / "dev.html"

# 顺序即依赖顺序：命名空间 → 存档 → 元数据 → 各卷。
FILES = [
    "core/namespace.js",
    "core/store.js",
    "data/volumes.js",
    "data/huarong.js",
    "data/digital.js",
    "data/tangram.js",
    "data/burr.js",
    "core/hub.js",
    "toys/rings/game.js",
    "toys/huarong/solver.js",
    "toys/huarong/sliding.js",
    "toys/huarong/digital.js",
    "toys/huarong/game.js",
    "toys/tangram/geometry.js",
    "toys/tangram/game.js",
    "toys/burr/geometry.js",
    "toys/burr/game.js",
]


def read_source(rel: str) -> str:
    path = SRC / rel
    if not path.is_file():
        raise SystemExit(f"缺少源文件：{path}")
    return path.read_text(encoding="utf-8").rstrip() + "\n"


def inline_scripts() -> str:
    chunks = []
    for rel in FILES:
        code = read_source(rel)
        if "</script" in code.lower():
            raise SystemExit(f"{rel} 含有 </script，内联后会截断页面")
        chunks.append(f"<script>\n/* ==== {rel} ==== */\n{code}</script>")
    return "\n".join(chunks)


def dev_scripts() -> str:
    return "\n".join(f'<script src="src/{rel}"></script>' for rel in FILES)


def render(dev: bool) -> str:
    shell = (SRC / "shell.html").read_text(encoding="utf-8")
    if MARKER not in shell:
        raise SystemExit(f"src/shell.html 缺少占位符 {MARKER}")
    body = dev_scripts() if dev else inline_scripts()
    return shell.replace(MARKER, body)


def digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:12]


def asset_files() -> dict[str, bytes]:
    """PWA 资源：Manifest / Service Worker / 图标，随 dist 一起发布。"""
    assets: dict[str, bytes] = {}

    manifest = (ROOT / "manifest.webmanifest").read_text(encoding="utf-8")
    assets["manifest.webmanifest"] = manifest.encode("utf-8")

    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    sw = re.sub(r"var VERSION = '[^']*';", "var VERSION = 'jiewu-v0.8.0-dev';", sw, count=1)
    assets["sw.js"] = sw.encode("utf-8")

    icons = ROOT / "icons"
    if icons.is_dir():
        for path in icons.rglob("*"):
            if path.is_file():
                assets[path.relative_to(ROOT).as_posix()] = path.read_bytes()
    return assets


def sync_assets(check: bool) -> int:
    assets = asset_files()
    stale = 0
    for rel, data in assets.items():
        target = ROOT / "dist" / rel
        if check:
            if not target.is_file() or target.read_bytes() != data:
                stale += 1
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    return stale


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="解物零依赖构建")
    parser.add_argument("--dev", action="store_true", help="生成根目录 dev.html")
    parser.add_argument("--check", action="store_true", help="只检查构建产物是否最新")
    args = parser.parse_args()

    html = render(dev=args.dev)
    out = OUT_DEV if args.dev else OUT_PROD
    size = len(html.encode("utf-8"))
    mark = digest(html)

    if args.check:
        if not out.is_file():
            print(f"[check] 尚未构建：{out}")
            return 1
        current = out.read_text(encoding="utf-8")
        if digest(current) != mark:
            print(f"[check] 产物已过期：{out} 需要重新构建")
            return 1
        if not args.dev:
            stale = sync_assets(check=True)
            if stale:
                print(f"[check] {stale} 个 PWA 资源已过期，需要重新构建")
                return 1
        print(f"[check] OK {out.relative_to(ROOT)} · {size} bytes · {mark}")
        return 0

    write(out, html)
    assets = 0
    if not args.dev:
        sync_assets(check=False)
        assets = len(asset_files())
    mode = "dev" if args.dev else "single-file"
    print(f"[build] {out.relative_to(ROOT)} · {mode} · {size} bytes · sha256:{mark}")
    if assets:
        print(f"[build] PWA assets: {assets} files → dist/")
    print(f"[build] sources: {', '.join(FILES)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
