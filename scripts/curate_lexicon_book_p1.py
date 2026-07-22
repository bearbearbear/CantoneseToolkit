#!/usr/bin/env python3
"""P1 curated lexicon from 《粤语初级教程》 high-frequency gaps.

Avoid changing existing package gold targets (刚才→頭先, 晚上→夜晚, bare 号码).
Dry-run by default; pass --apply to write via lexicon_merge.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lexicon_merge as lm
import lexicon_validate as lv

CANDIDATES = [
    {"source": "手机号码", "target": "手機冧巴", "pos": "noun", "scene": "social",
     "priority": "100", "condition": "", "flags": "", "notes": "textbook_p1",
     "review_status": "draft_curated", "provenance": "book_gap_p1"},
    {"source": "名片", "target": "咭片", "pos": "noun", "scene": "social",
     "priority": "100", "condition": "", "flags": "", "notes": "textbook_p1",
     "review_status": "draft_curated", "provenance": "book_gap_p1"},
    {"source": "小孩儿", "target": "細路", "pos": "noun", "scene": "social",
     "priority": "100", "condition": "", "flags": "", "notes": "textbook_p1",
     "review_status": "draft_curated", "provenance": "book_gap_p1"},
    {"source": "人们", "target": "啲人", "pos": "noun", "scene": "general",
     "priority": "95", "condition": "", "flags": "", "notes": "textbook_p1",
     "review_status": "draft_curated", "provenance": "book_gap_p1"},
    {"source": "习惯", "target": "慣", "pos": "verb", "scene": "general",
     "priority": "100", "condition": "", "flags": "", "notes": "textbook_p1",
     "review_status": "draft_curated", "provenance": "book_gap_p1"},
    {"source": "名字", "target": "名", "pos": "noun", "scene": "social",
     "priority": "95", "condition": "", "flags": "", "notes": "textbook_p1 ask-name",
     "review_status": "draft_curated", "provenance": "book_gap_p1"},
    {"source": "块钱", "target": "文", "pos": "noun", "scene": "shopping",
     "priority": "95", "condition": "", "flags": "", "notes": "textbook_p1",
     "review_status": "draft_curated", "provenance": "book_gap_p1"},
    {"source": "糟了", "target": "𡃇", "pos": "interjection", "scene": "general",
     "priority": "100", "condition": "", "flags": "", "notes": "textbook_p1",
     "review_status": "draft_curated", "provenance": "book_gap_p1"},
    {"source": "不在", "target": "唔喺度", "pos": "verb", "scene": "general",
     "priority": "100", "condition": "", "flags": "", "notes": "textbook_p1",
     "review_status": "draft_curated", "provenance": "book_gap_p1"},
    {"source": "吸烟", "target": "食煙", "pos": "verb", "scene": "general",
     "priority": "100", "condition": "", "flags": "", "notes": "textbook_p1",
     "review_status": "draft_curated", "provenance": "book_gap_p1"},
    {"source": "怎样", "target": "點樣", "pos": "adv", "scene": "general",
     "priority": "100", "condition": "", "flags": "", "notes": "textbook_p1",
     "review_status": "draft_curated", "provenance": "book_gap_p1"},
    {"source": "快没电", "target": "就嚟冇電", "pos": "verb", "scene": "general",
     "priority": "100", "condition": "", "flags": "", "notes": "textbook_p1",
     "review_status": "draft_curated", "provenance": "book_gap_p1"},
    {"source": "没电", "target": "冇電", "pos": "verb", "scene": "general",
     "priority": "100", "condition": "", "flags": "", "notes": "textbook_p1",
     "review_status": "draft_curated", "provenance": "book_gap_p1"},
    {"source": "这是", "target": "呢個係", "pos": "phrase", "scene": "general",
     "priority": "100", "condition": "", "flags": "", "notes": "textbook_p1 这是谁",
     "review_status": "draft_curated", "provenance": "book_gap_p1"},
]


def main() -> int:
    apply = "--apply" in sys.argv
    s2hk = lv.load_s2hk()
    existing = lv.load_lexicon_sources()
    rule_index = lv.load_rule_index()
    res = lv.validate_batch(CANDIDATES, s2hk, existing, rule_index=rule_index)
    print(f"candidates: {len(CANDIDATES)} ok={len(res['ok'])} "
          f"errors={len(res['errors'])} warnings={len(res['warnings'])}")
    for row, errs in res["errors"]:
        print(f"  DROP {row['source']}→{row['target']}: {'; '.join(errs)}")
    for row, warns in res["warnings"]:
        print(f"  warn {row['source']}→{row['target']}: {'; '.join(warns)}")
    accepted = res["ok"]
    summary = lm.merge_entries(accepted, apply=apply)
    print(f"[plan] +{summary['added']} lexicon->{summary['lexicon']} "
          f"tu->{summary['translation_units']}")
    if not apply:
        for r in accepted:
            print(f"  {r['source']}→{r['target']}")
        print("DRY-RUN. Re-run with --apply to write.")
    else:
        print(f"[applied] resynced {summary.get('resynced_files')} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
