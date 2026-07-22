#!/usr/bin/env python3
"""Shared lexicon merge helper.

Given a list of already-validated candidate entries (dicts with the lexicon
fields except `id`), assign IDs and write them into every synchronized
artifact: lexicon.csv, lexicon.jsonl, runtime-core-v1.2.0.json, and then resync
counts + file hashes across manifest.json / metadata.json /
validation_report.json / SHA256SUMS.txt and the hardcoded count in
tests/runtime-data-package.test.mjs.

Used by the Phase 1 slot-value harvester and the Phase 2 curated batches.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(_HERE)
PKG = os.path.join(REPO, "resources", "mandarin_cantonese_v1_2_0")
TEST_MJS = os.path.join(REPO, "tests", "runtime-data-package.test.mjs")

LEX_FIELDS = ["id", "source", "target", "pos", "scene", "priority",
              "condition", "flags", "notes", "review_status", "provenance"]


def p(name):
    return os.path.join(PKG, name)


def _read_csv(path):
    with open(path, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def _sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def _write(path, data: bytes):
    with open(path, "wb") as f:
        f.write(data)


def _render_csv(rows) -> bytes:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=LEX_FIELDS, lineterminator="\r\n",
                       quoting=csv.QUOTE_MINIMAL)
    w.writeheader()
    for r in rows:
        w.writerow({k: r.get(k, "") for k in LEX_FIELDS})
    return b"\xef\xbb\xbf" + buf.getvalue().encode("utf-8")


def _render_jsonl(rows) -> bytes:
    lines = [json.dumps({k: str(r.get(k, "")) for k in LEX_FIELDS}, ensure_ascii=False)
             for r in rows]
    return ("\n".join(lines) + "\n").encode("utf-8")


def _dump_json(obj, trailing_nl):
    s = json.dumps(obj, ensure_ascii=False, indent=2) + ("\n" if trailing_nl else "")
    return s.encode("utf-8")


def merge_entries(accepted: list[dict], apply: bool = False) -> dict:
    """Merge accepted entries. Returns a summary dict. Writes only if apply."""
    existing = _read_csv(p("lexicon.csv"))
    maxid = max(int(r["id"].split("-")[1]) for r in existing)
    for i, r in enumerate(accepted, start=1):
        r["id"] = f"LEX-{maxid + i:04d}"

    n = len(accepted)
    new_lex = len(existing) + n
    manifest = json.load(open(p("manifest.json"), encoding="utf-8"))
    old_tu = manifest["counts"]["translation_units"]
    new_tu = old_tu + n
    summary = {
        "added": n, "lexicon": new_lex, "translation_units": new_tu,
        "id_from": f"LEX-{maxid+1:04d}", "id_to": f"LEX-{maxid+n:04d}" if n else "-",
    }
    if not apply or n == 0:
        return summary

    all_rows = existing + accepted
    _write(p("lexicon.csv"), _render_csv(all_rows))
    _write(p("lexicon.jsonl"),
           open(p("lexicon.jsonl"), "rb").read() + _render_jsonl(accepted))

    core = json.load(open(p("runtime-core-v1.2.0.json"), encoding="utf-8"))
    for r in accepted:
        core["lexicon"].append({k: str(r.get(k, "")) for k in LEX_FIELDS})
    _write(p("runtime-core-v1.2.0.json"),
           json.dumps(core, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))

    md = json.load(open(p("metadata.json"), encoding="utf-8"))
    md["counts"]["lexicon"] = new_lex
    md["counts"]["translation_units"] = new_tu
    _write(p("metadata.json"), _dump_json(md, trailing_nl=False))

    vr = json.load(open(p("validation_report.json"), encoding="utf-8"))
    vr["counts"]["lexicon"] = new_lex
    vr["counts"]["translation_units"] = new_tu
    for c in vr["checks"]:
        if isinstance(c.get("detail"), str) and c["detail"].endswith("lexicon rows"):
            c["detail"] = f"{new_lex} lexicon rows"
    _write(p("validation_report.json"), _dump_json(vr, trailing_nl=False))

    manifest["counts"]["lexicon"] = new_lex
    manifest["counts"]["translation_units"] = new_tu
    disk = {}
    for fe in manifest["files"]:
        b = open(p(fe["name"]), "rb").read()
        disk[fe["name"]] = _sha(b)
        fe["bytes"], fe["sha256"] = len(b), disk[fe["name"]]
    _write(p("manifest.json"), _dump_json(manifest, trailing_nl=True))

    lines = open(p("SHA256SUMS.txt"), encoding="utf-8").read().splitlines()
    out = []
    for line in lines:
        if not line.strip():
            out.append(line); continue
        _h, name = line.split("  ", 1)
        out.append(f"{disk[name]}  {name}" if name in disk else line)
    _write(p("SHA256SUMS.txt"), ("\n".join(out) + "\n").encode("utf-8"))

    tmjs = open(TEST_MJS, encoding="utf-8").read()
    _write(TEST_MJS, tmjs.replace(f"manifest.counts.translation_units, {old_tu}",
                                  f"manifest.counts.translation_units, {new_tu}").encode("utf-8"))
    summary["resynced_files"] = len(disk)
    return summary
