#!/usr/bin/env python3
"""Resync manifest.json file hashes/sizes and SHA256SUMS.txt to bytes on disk.

Recomputes sha256 + byte size for every file tracked in manifest.files (from the
actual file contents) and rewrites matching lines in SHA256SUMS.txt. Use after
editing any tracked data file to keep the integrity manifest consistent.
"""
from __future__ import annotations

import hashlib
import json
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.join(os.path.dirname(_HERE), "resources", "mandarin_cantonese_v1_2_0")


def p(name):
    return os.path.join(PKG, name)


def main() -> int:
    manifest = json.load(open(p("manifest.json"), encoding="utf-8"))
    disk = {}
    for fe in manifest["files"]:
        b = open(p(fe["name"]), "rb").read()
        h = hashlib.sha256(b).hexdigest()
        disk[fe["name"]] = (len(b), h)
        fe["bytes"], fe["sha256"] = len(b), h
    with open(p("manifest.json"), "wb") as f:
        f.write((json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))

    lines = open(p("SHA256SUMS.txt"), encoding="utf-8").read().splitlines()
    out = []
    for line in lines:
        if not line.strip():
            out.append(line)
            continue
        _h, name = line.split("  ", 1)
        out.append(f"{disk[name][1]}  {name}" if name in disk else line)
    with open(p("SHA256SUMS.txt"), "wb") as f:
        f.write(("\n".join(out) + "\n").encode("utf-8"))

    print(f"resynced {len(disk)} tracked files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
