#!/usr/bin/env python3
"""Phase 1 — Harvest genuine lexical pairs from slot_values into the lexicon.

Selects slot_value source/target pairs that are real word-level Mandarin->
Cantonese lexical differences (not pure simp->HK char conversions, not already
in the lexicon), runs them through the Phase 0 validator, and — with --apply —
merges the survivors into every synchronized artifact:

  lexicon.csv, lexicon.jsonl, runtime-core-v1.2.0.json,
  manifest.json (counts + file hashes), metadata.json, validation_report.json,
  SHA256SUMS.txt, and the hardcoded count in tests/runtime-data-package.test.mjs

Dry-run by default. Use --apply to write.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lexicon_validate as lv  # noqa: E402

PKG = lv.PACKAGE
REPO = lv._REPO
TEST_MJS = os.path.join(REPO, "tests", "runtime-data-package.test.mjs")

LEX_FIELDS = ["id", "source", "target", "pos", "scene", "priority",
              "condition", "flags", "notes", "review_status", "provenance"]
PROVENANCE = "slot_value_harvest_v1"
REVIEW_STATUS = "generated_candidate"
DEFAULT_SCENE = "general"      # inclusive: matches every query scene
DEFAULT_PRIORITY = "95"        # just under curated core (100)


def p(name):
    return os.path.join(PKG, name)


def read_csv(path):
    with open(path, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def pos_for(semantic_class: str) -> str:
    if semantic_class == "action":
        return "verb"
    if semantic_class == "attribute":
        return "adj"
    return "noun"


def build_candidates(s2hk, existing_sources):
    """Return (candidates, deferred). Single-char sources are deferred to manual
    Phase 2 review: they over-fire inside compounds (e.g. 腿->腳 would turn
    雞腿 into 雞腳 'chicken feet' instead of 雞髀) and can collide with surnames
    (姜). They need per-sense conditions, not a blanket word-level mapping."""
    sv = read_csv(p("slot_values.csv"))
    seen = set()
    cands = []
    deferred = []
    for r in sv:
        s = (r.get("source") or "").strip()
        t = (r.get("target") or "").strip()
        if not s or not t or s == t:
            continue
        if lv.normalize_hk(s, s2hk) == t:      # pure char-form -> normalizer's job
            continue
        if s in existing_sources or s in seen:
            continue
        seen.add(s)
        if len(s) == 1:
            deferred.append((s, t))
            continue
        cands.append({
            "source": s,
            "target": t,
            "pos": pos_for(r.get("semantic_class", "")),
            "scene": DEFAULT_SCENE,
            "priority": DEFAULT_PRIORITY,
            "condition": "",
            "flags": "",
            "notes": f"from_slot:{r.get('slot_type','')}",
            "review_status": REVIEW_STATUS,
            "provenance": PROVENANCE,
        })
    return cands, deferred


def sha_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def write_file(path, data: bytes):
    with open(path, "wb") as f:
        f.write(data)


def render_lexicon_csv(rows) -> bytes:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=LEX_FIELDS, lineterminator="\r\n",
                       quoting=csv.QUOTE_MINIMAL)
    w.writeheader()
    for r in rows:
        w.writerow({k: r.get(k, "") for k in LEX_FIELDS})
    return b"\xef\xbb\xbf" + buf.getvalue().encode("utf-8")


def render_lexicon_jsonl(rows) -> bytes:
    lines = []
    for r in rows:
        obj = {k: str(r.get(k, "")) for k in LEX_FIELDS}
        lines.append(json.dumps(obj, ensure_ascii=False))
    return ("\n".join(lines) + "\n").encode("utf-8")


def dump_json(obj, indent=2, trailing_nl=True) -> bytes:
    s = json.dumps(obj, ensure_ascii=False, indent=indent)
    if trailing_nl:
        s += "\n"
    return s.encode("utf-8")


def main(argv):
    apply = "--apply" in argv
    s2hk = lv.load_s2hk()
    existing_rows = read_csv(p("lexicon.csv"))
    existing_sources = {r["source"] for r in existing_rows}

    # idempotency guard
    if any(r.get("provenance") == PROVENANCE for r in existing_rows):
        print(f"ABORT: lexicon already contains provenance={PROVENANCE}; harvest looks applied.")
        return 1

    rule_index = lv.load_rule_index()
    cands, deferred = build_candidates(s2hk, existing_sources)
    if deferred:
        print(f"[deferred] {len(deferred)} single-char sources -> manual Phase 2 "
              f"(need per-sense conditions): "
              + ", ".join(f"{s}->{t}" for s, t in deferred))

    # Skip sources a rule already covers with the SAME target (redundant + the
    # rule can shadow the lexicon entry inside longer words).
    redundant = [c for c in cands if rule_index.get(c["source"]) == c["target"]]
    if redundant:
        print(f"[skip:rule-redundant] {len(redundant)} already covered by a rule: "
              + ", ".join(f"{c['source']}->{c['target']}" for c in redundant))
    cands = [c for c in cands if rule_index.get(c["source"]) != c["target"]]

    res = lv.validate_batch(cands, s2hk, existing_sources, rule_index=rule_index)
    print(f"[harvest] candidates={len(cands)} ok={len(res['ok'])} "
          f"errors={len(res['errors'])} warnings={len(res['warnings'])}")
    for row, errs in res["errors"]:
        print(f"  ERROR {row['source']}->{row['target']}: {'; '.join(errs)}")
    for row, warns in res["warnings"]:
        print(f"  warn  {row['source']}->{row['target']}: {'; '.join(warns)}")

    if res["errors"]:
        print("ABORT: hard errors present; fix before applying.")
        return 1

    accepted = res["ok"]
    maxid = max(int(r["id"].split("-")[1]) for r in existing_rows)
    for i, r in enumerate(accepted, start=1):
        r["id"] = f"LEX-{maxid + i:04d}"

    n = len(accepted)
    new_lex_count = len(existing_rows) + n
    manifest = json.load(open(p("manifest.json"), encoding="utf-8"))
    old_tu = manifest["counts"]["translation_units"]
    new_tu = old_tu + n
    print(f"[plan] +{n} entries  lexicon {len(existing_rows)}->{new_lex_count}  "
          f"translation_units {old_tu}->{new_tu}  ids LEX-{maxid+1:04d}..LEX-{maxid+n:04d}")

    if not apply:
        print("\nSample of accepted entries:")
        for r in accepted[:8] + accepted[-3:]:
            print(f"  {r['id']} {r['source']}->{r['target']} [{r['pos']}/{r['scene']}] {r['notes']}")
        print("\nDRY-RUN. Re-run with --apply to write.")
        return 0

    # ---- write data files ----
    all_rows = existing_rows + accepted
    csv_bytes = render_lexicon_csv(all_rows)
    write_file(p("lexicon.csv"), csv_bytes)

    jsonl_bytes = open(p("lexicon.jsonl"), "rb").read()
    jsonl_bytes = jsonl_bytes + render_lexicon_jsonl(accepted)
    write_file(p("lexicon.jsonl"), jsonl_bytes)

    core = json.load(open(p("runtime-core-v1.2.0.json"), encoding="utf-8"))
    for r in accepted:
        core["lexicon"].append({k: str(r.get(k, "")) for k in LEX_FIELDS})
    core_bytes = json.dumps(core, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    write_file(p("runtime-core-v1.2.0.json"), core_bytes)

    # ---- metadata.json (byte-length may be unchanged, so hash must resync) ----
    md = json.load(open(p("metadata.json"), encoding="utf-8"))
    md["counts"]["lexicon"] = new_lex_count
    md["counts"]["translation_units"] = new_tu
    write_file(p("metadata.json"), dump_json(md, trailing_nl=False))

    # ---- validation_report.json ----
    vr = json.load(open(p("validation_report.json"), encoding="utf-8"))
    vr["counts"]["lexicon"] = new_lex_count
    vr["counts"]["translation_units"] = new_tu
    for c in vr["checks"]:
        if isinstance(c.get("detail"), str) and c["detail"].endswith("lexicon rows"):
            c["detail"] = f"{new_lex_count} lexicon rows"
    write_file(p("validation_report.json"), dump_json(vr, trailing_nl=False))

    # ---- manifest.json: counts, then resync hashes for EVERY tracked file ----
    manifest["counts"]["lexicon"] = new_lex_count
    manifest["counts"]["translation_units"] = new_tu
    disk = {}
    for fe in manifest["files"]:
        b = open(p(fe["name"]), "rb").read()
        h = sha_bytes(b)
        disk[fe["name"]] = h
        fe["bytes"], fe["sha256"] = len(b), h
    write_file(p("manifest.json"), dump_json(manifest, trailing_nl=True))

    # ---- SHA256SUMS.txt ----
    sum_lines = open(p("SHA256SUMS.txt"), encoding="utf-8").read().splitlines()
    out = []
    for line in sum_lines:
        if not line.strip():
            out.append(line)
            continue
        h, name = line.split("  ", 1)
        out.append(f"{disk[name]}  {name}" if name in disk else line)
    write_file(p("SHA256SUMS.txt"), ("\n".join(out) + "\n").encode("utf-8"))

    # ---- tests/runtime-data-package.test.mjs ----
    tmjs = open(TEST_MJS, encoding="utf-8").read()
    tmjs = tmjs.replace(f"manifest.counts.translation_units, {old_tu}",
                        f"manifest.counts.translation_units, {new_tu}")
    write_file(TEST_MJS, tmjs.encode("utf-8"))

    print(f"[applied] lexicon={new_lex_count} translation_units={new_tu}")
    print(f"[applied] resynced hashes for {len(disk)} tracked files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
