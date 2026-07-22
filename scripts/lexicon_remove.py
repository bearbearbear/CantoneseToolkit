#!/usr/bin/env python3
"""Remove lexicon entries by id from every synchronized artifact.

Drops the row(s) from lexicon.csv / lexicon.jsonl / runtime-core, decrements the
lexicon + translation_units counts in metadata/validation_report/manifest, and
resyncs file hashes (manifest + SHA256SUMS) and the hardcoded count in
tests/runtime-data-package.test.mjs. IDs are NOT renumbered.

Usage: python3 scripts/lexicon_remove.py LEX-0489 [--apply]
"""
from __future__ import annotations

import json
import sys

import lexicon_merge as lm


def remove_ids(ids: set[str], apply: bool = False) -> dict:
    rows = lm._read_csv(lm.p("lexicon.csv"))
    keep = [r for r in rows if r["id"] not in ids]
    removed = [r["id"] for r in rows if r["id"] in ids]
    n = len(removed)

    manifest = json.load(open(lm.p("manifest.json"), encoding="utf-8"))
    old_tu = manifest["counts"]["translation_units"]
    new_tu = old_tu - n
    new_lex = len(keep)
    summary = {"removed": removed, "lexicon": new_lex, "translation_units": new_tu}
    if not apply or n == 0:
        return summary

    lm._write(lm.p("lexicon.csv"), lm._render_csv(keep))
    lm._write(lm.p("lexicon.jsonl"), lm._render_jsonl(keep))

    core = json.load(open(lm.p("runtime-core-v1.2.0.json"), encoding="utf-8"))
    core["lexicon"] = [e for e in core["lexicon"] if e.get("id") not in ids]
    lm._write(lm.p("runtime-core-v1.2.0.json"),
              json.dumps(core, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))

    md = json.load(open(lm.p("metadata.json"), encoding="utf-8"))
    md["counts"]["lexicon"] = new_lex
    md["counts"]["translation_units"] = new_tu
    lm._write(lm.p("metadata.json"), lm._dump_json(md, trailing_nl=False))

    vr = json.load(open(lm.p("validation_report.json"), encoding="utf-8"))
    vr["counts"]["lexicon"] = new_lex
    vr["counts"]["translation_units"] = new_tu
    for c in vr["checks"]:
        if isinstance(c.get("detail"), str) and c["detail"].endswith("lexicon rows"):
            c["detail"] = f"{new_lex} lexicon rows"
    lm._write(lm.p("validation_report.json"), lm._dump_json(vr, trailing_nl=False))

    manifest["counts"]["lexicon"] = new_lex
    manifest["counts"]["translation_units"] = new_tu
    disk = {}
    for fe in manifest["files"]:
        b = open(lm.p(fe["name"]), "rb").read()
        disk[fe["name"]] = lm._sha(b)
        fe["bytes"], fe["sha256"] = len(b), disk[fe["name"]]
    lm._write(lm.p("manifest.json"), lm._dump_json(manifest, trailing_nl=True))

    lines = open(lm.p("SHA256SUMS.txt"), encoding="utf-8").read().splitlines()
    out = []
    for line in lines:
        if not line.strip():
            out.append(line); continue
        _h, name = line.split("  ", 1)
        out.append(f"{disk[name]}  {name}" if name in disk else line)
    lm._write(lm.p("SHA256SUMS.txt"), ("\n".join(out) + "\n").encode("utf-8"))

    tmjs = open(lm.TEST_MJS, encoding="utf-8").read()
    lm._write(lm.TEST_MJS, tmjs.replace(
        f"manifest.counts.translation_units, {old_tu}",
        f"manifest.counts.translation_units, {new_tu}").encode("utf-8"))
    summary["resynced_files"] = len(disk)
    return summary


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--apply"]
    apply = "--apply" in sys.argv
    if not args:
        print("usage: lexicon_remove.py LEX-XXXX [...] [--apply]")
        sys.exit(1)
    print(json.dumps(remove_ids(set(args), apply=apply), ensure_ascii=False, indent=2))
