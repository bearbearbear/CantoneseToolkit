#!/usr/bin/env python3
"""Phase 0 — Lexicon candidate quality gate.

Reusable validator for proposed Mandarin->Cantonese lexicon entries. Enforces
the rules agreed for the mandarin_cantonese_v1_2_0 lexicon:

  * source / target non-empty; source contains Han characters
  * target is genuine lexical change: target != simp->HK char normalization of
    source (pure char-form conversions belong to the normalizer, not lexicon)
  * target has no leftover *simplified* residue (any char still a key in the
    s2hk map means it was not normalized to HK form)
  * target has no obvious Mandarin function-word residue (的/很/这/那/吗/什么/怎…)
  * pos / scene / priority present
  * source not duplicated against existing lexicon (unless condition+sense_split)
  * source not duplicated within the candidate batch

Latin letters are allowed (code-switch, e.g. send / Wi-Fi / SIM卡).

Usage:
    python scripts/lexicon_validate.py path/to/candidates.csv
    (candidates.csv: same columns as lexicon.csv)

Importable:
    from lexicon_validate import load_s2hk, load_lexicon_sources, validate_entry
"""
from __future__ import annotations

import csv
import json
import os
import re
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO = os.path.dirname(_HERE)
S2HK_PATH = os.path.join(_REPO, "app", "engine", "data", "simplified-to-hongkong.json")
PACKAGE = os.path.join(_REPO, "resources", "mandarin_cantonese_v1_2_0")
LEXICON_CSV = os.path.join(PACKAGE, "lexicon.csv")
RULES_CSV = os.path.join(PACKAGE, "rules.csv")

_HAN = re.compile(r"[\u4e00-\u9fff]")

# Mandarin function words / forms that should not survive into a Cantonese target.
# (的士 taxi is a legit Cantonese word, so 的 is only flagged when not before 士.)
_MANDARIN_PATTERNS = [
    (re.compile(r"的(?!士)"), "的"),
    (re.compile(r"很"), "很"),
    (re.compile(r"这"), "这"),
    (re.compile(r"那(?!邊)"), "那"),
    (re.compile(r"什么|甚麼"), "什么"),
    (re.compile(r"怎么|怎樣|怎麼"), "怎"),
    (re.compile(r"吗"), "吗"),
    (re.compile(r"了[。！？]?$"), "了(句末)"),
]


def load_s2hk(path: str = S2HK_PATH) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def normalize_hk(text: str, s2hk: dict) -> str:
    return "".join(s2hk.get(ch, ch) for ch in text)


def load_lexicon_sources(path: str = LEXICON_CSV) -> set:
    with open(path, encoding="utf-8-sig") as f:
        return {row["source"] for row in csv.DictReader(f)}


def load_rule_index(path: str = RULES_CSV) -> dict:
    """Map rule source_pattern -> target_pattern (first occurrence wins)."""
    index: dict[str, str] = {}
    with open(path, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            s = (row.get("source_pattern") or "").strip()
            if s:
                index.setdefault(s, (row.get("target_pattern") or "").strip())
    return index


def simplified_residue(target: str, s2hk: dict) -> list:
    return [ch for ch in target if ch in s2hk]


def mandarin_residue(target: str) -> list:
    return [label for pat, label in _MANDARIN_PATTERNS if pat.search(target)]


def validate_entry(entry: dict, s2hk: dict, existing_sources: set,
                   batch_sources: set | None = None,
                   rule_index: dict | None = None) -> tuple[list, list]:
    """Return (errors, warnings) for one candidate entry."""
    errors: list[str] = []
    warnings: list[str] = []

    src = (entry.get("source") or "").strip()
    tgt = (entry.get("target") or "").strip()

    if not src:
        errors.append("empty source")
    elif not _HAN.search(src):
        errors.append("source has no Han character")
    if not tgt:
        errors.append("empty target")

    if src and tgt:
        if normalize_hk(src, s2hk) == tgt:
            errors.append("target == simp->HK normalization of source (char-only; belongs to normalizer)")
        if src == tgt:
            errors.append("source == target (no change)")

    if tgt:
        sr = simplified_residue(tgt, s2hk)
        if sr:
            errors.append(f"simplified residue in target: {''.join(sr)}")
        mr = mandarin_residue(tgt)
        if mr:
            errors.append(f"Mandarin residue in target: {','.join(mr)}")

    for field in ("pos", "scene", "priority"):
        if not (entry.get(field) or "").strip():
            errors.append(f"missing {field}")

    cond = (entry.get("condition") or "").strip()
    notes = (entry.get("notes") or "")
    if src in existing_sources and not (cond and "sense_split" in notes):
        errors.append("source already in lexicon (needs condition+sense_split to coexist)")

    if rule_index is not None and src in rule_index:
        if rule_index[src] == tgt:
            errors.append(f"redundant with rule (same source->target already covered by a rule)")
        else:
            warnings.append(f"source is also a rule source_pattern with different target "
                            f"(rule: {rule_index[src]}); rule may shadow this entry")

    if batch_sources is not None and src:
        # duplicate within batch is caller's concern; flag if seen more than once
        pass

    if src and len(src) == 1 and not cond:
        warnings.append("single-char source without condition (ambiguity risk)")

    return errors, warnings


def validate_batch(rows: list[dict], s2hk: dict, existing_sources: set,
                   rule_index: dict | None = None) -> dict:
    seen: dict[str, int] = {}
    results = {"ok": [], "errors": [], "warnings": []}
    for row in rows:
        src = (row.get("source") or "").strip()
        seen[src] = seen.get(src, 0) + 1
    for row in rows:
        errs, warns = validate_entry(row, s2hk, existing_sources, rule_index=rule_index)
        src = (row.get("source") or "").strip()
        if seen.get(src, 0) > 1:
            errs = errs + [f"duplicate source within batch (x{seen[src]})"]
        if errs:
            results["errors"].append((row, errs))
        elif warns:
            results["warnings"].append((row, warns))
            results["ok"].append(row)
        else:
            results["ok"].append(row)
    return results


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 2
    s2hk = load_s2hk()
    existing = load_lexicon_sources()
    rule_index = load_rule_index()
    with open(argv[1], encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    res = validate_batch(rows, s2hk, existing, rule_index=rule_index)
    print(f"candidates: {len(rows)}  ok: {len(res['ok'])}  "
          f"with-errors: {len(res['errors'])}  with-warnings: {len(res['warnings'])}")
    for row, errs in res["errors"][:50]:
        print(f"  ERROR {row.get('source')}->{row.get('target')}: {'; '.join(errs)}")
    for row, warns in res["warnings"][:50]:
        print(f"  warn  {row.get('source')}->{row.get('target')}: {'; '.join(warns)}")
    return 1 if res["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
