#!/usr/bin/env python3
"""Phase 2 — curated high-frequency daily Mandarin->Cantonese lexicon.

A hand-curated batch of common, high-confidence lexical differences targeting
the thin areas after Phase 1 (kinship terms, interrogatives/demonstratives,
conjunctions/adverbs, everyday verbs/adjectives/nouns, food, time).

Rules of the batch:
  * multi-character sources only (single-char sources over-fire in compounds and
    are deferred to a conditioned pass, same policy as the Phase 1 harvest)
  * genuine lexical change only; pure simp->HK char forms are dropped by the
    validator (target == normalize_hk(source))
  * deduped against existing lexicon AND rules by the validator

Dry-run by default; --apply writes through scripts/lexicon_merge.py.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lexicon_validate as lv        # noqa: E402
import lexicon_merge as lm           # noqa: E402

PROVENANCE = "curated_phase2_daily_v1"
REVIEW_STATUS = "draft_curated"

# (source, target, pos). scene defaults to "general" (inclusive: matches any
# query scene); priority defaults to 100, or per-entry override via 4-tuple.
CURATED: list[tuple] = [
    # --- kinship / people (称谓) ---
    ("妈妈", "阿媽", "noun"), ("爸爸", "阿爸", "noun"), ("爷爷", "阿爺", "noun"),
    ("奶奶", "嫲嫲", "noun"), ("外婆", "婆婆", "noun"), ("外公", "公公", "noun"),
    ("姐姐", "家姐", "noun"), ("弟弟", "細佬", "noun"), ("妹妹", "細妹", "noun"),
    ("儿子", "仔", "noun", 95), ("女儿", "阿女", "noun"), ("孙子", "孫仔", "noun"),
    ("警察", "差人", "noun"), ("小孩", "細路", "noun"), ("女孩", "女仔", "noun"),
    ("男孩", "男仔", "noun"), ("服务员", "侍應", "noun"),
    # --- interrogatives / demonstratives ---
    ("为什么", "點解", "adv"), ("怎么样", "點樣", "adv"), ("怎么办", "點算", "adv"),
    ("哪里", "邊度", "pron"), ("这里", "呢度", "pron"), ("那里", "嗰度", "pron"),
    ("这样", "咁樣", "adv"), ("那样", "噉樣", "adv"), ("多少", "幾多", "pron"),
    ("什么时候", "幾時", "adv"), ("东西", "嘢", "noun", 95),
    # --- conjunctions / adverbs ---
    ("但是", "但係", "conj"), ("可是", "但係", "conj"), ("或者", "定係", "conj"),
    ("然后", "跟住", "adv"), ("现在", "而家", "adv"), ("刚才", "頭先", "adv"),
    ("马上", "即刻", "adv"), ("立刻", "即刻", "adv"), ("一起", "一齊", "adv"),
    ("到处", "周圍", "adv"), ("差不多", "差唔多", "adv"), ("也许", "可能", "adv"),
    ("幸亏", "好彩", "adv"), ("故意", "特登", "adv"), ("反正", "橫掂", "adv"),
    ("总是", "成日", "adv"), ("经常", "成日", "adv"),
    # --- everyday verbs (multi-char) ---
    ("说话", "講嘢", "verb"), ("聊天", "傾偈", "verb"), ("上班", "返工", "verb"),
    ("回家", "返屋企", "verb"), ("帮忙", "幫手", "verb"), ("挣钱", "搵錢", "verb"),
    ("花钱", "使錢", "verb"), ("存钱", "儲錢", "verb"), ("结账", "埋單", "verb"),
    ("付钱", "畀錢", "verb"), ("逛街", "行街", "verb"), ("尝试", "試下", "verb"),
    ("喜欢", "鍾意", "verb"), ("讨厌", "憎", "verb"), ("忘记", "唔記得", "verb"),
    ("认识", "識", "verb"), ("看见", "睇到", "verb"), ("结束", "完", "verb"),
    # --- adjectives / states ---
    ("聪明", "醒目", "adj"), ("厉害", "犀利", "adj"), ("漂亮", "靚", "adj"),
    ("好看", "好睇", "adj"), ("好吃", "好食", "adj"), ("难吃", "難食", "adj"),
    ("便宜", "平", "adj"), ("安静", "靜", "adj"), ("可爱", "得意", "adj"),
    ("无聊", "悶", "adj"), ("生气", "嬲", "adj"), ("害怕", "驚", "adj"),
    ("高兴", "開心", "adj"), ("难过", "唔開心", "adj"),
    # --- nouns / objects ---
    ("空调", "冷氣", "noun"), ("自行车", "單車", "noun"), ("摩托车", "電單車", "noun"),
    ("塑料袋", "膠袋", "noun"), ("零钱", "散紙", "noun"), ("钱包", "銀包", "noun"),
    ("手电筒", "電筒", "noun"), ("遥控器", "遙控", "noun"), ("钥匙", "鎖匙", "noun"),
    ("出租车", "的士", "noun"), ("公交车", "巴士", "noun"), ("地铁", "港鐵", "noun"),
    ("电影院", "戲院", "noun"), ("卫生间", "洗手間", "noun"), ("账单", "單", "noun"),
    ("塑料", "塑膠", "noun"),
    # --- food ---
    ("巧克力", "朱古力", "noun"), ("酸奶", "乳酪", "noun"), ("西红柿", "番茄", "noun"),
    ("土豆", "薯仔", "noun"), ("玉米", "粟米", "noun"), ("草莓", "士多啤梨", "noun"),
    ("猕猴桃", "奇異果", "noun"), ("卷心菜", "椰菜", "noun"), ("花菜", "椰菜花", "noun"),
    # --- time ---
    ("今天", "今日", "noun"), ("明天", "聽日", "noun"), ("昨天", "尋日", "noun"),
    ("后天", "後日", "noun"), ("前天", "前日", "noun"), ("早上", "朝早", "noun"),
    ("晚上", "夜晚", "noun"), ("中午", "晏晝", "noun"), ("下午", "下晝", "noun"),
    ("上午", "上晝", "noun"), ("一会儿", "陣間", "noun"),
]


def build_entries():
    out = []
    for row in CURATED:
        src, tgt, pos = row[0], row[1], row[2]
        pri = str(row[3]) if len(row) > 3 else "100"
        out.append({
            "source": src, "target": tgt, "pos": pos, "scene": "general",
            "priority": pri, "condition": "", "flags": "",
            "notes": "curated_daily", "review_status": REVIEW_STATUS,
            "provenance": PROVENANCE,
        })
    return out


def main(argv):
    apply = "--apply" in argv
    s2hk = lv.load_s2hk()
    existing = lv.load_lexicon_sources()
    rule_index = lv.load_rule_index()

    if PROVENANCE in {r for r in existing} and False:
        pass
    entries = build_entries()
    # in-batch duplicate source guard
    seen = {}
    for e in entries:
        seen[e["source"]] = seen.get(e["source"], 0) + 1
    dups = [s for s, c in seen.items() if c > 1]
    if dups:
        print("ABORT: duplicate source within curated batch:", dups)
        return 1

    res = lv.validate_batch(entries, s2hk, existing, rule_index=rule_index)
    print(f"[phase2] curated={len(entries)} ok={len(res['ok'])} "
          f"errors={len(res['errors'])} warnings={len(res['warnings'])}")
    for row, errs in res["errors"]:
        print(f"  DROP {row['source']}->{row['target']}: {'; '.join(errs)}")
    for row, warns in res["warnings"]:
        print(f"  warn {row['source']}->{row['target']}: {'; '.join(warns)}")

    accepted = res["ok"]
    summary = lm.merge_entries(accepted, apply=apply)
    print(f"[plan] +{summary['added']} accepted  lexicon->{summary['lexicon']}  "
          f"translation_units->{summary['translation_units']}  "
          f"ids {summary['id_from']}..{summary['id_to']}")
    if not apply:
        print("\naccepted entries:")
        for r in accepted:
            print(f"  {r['source']}->{r['target']} [{r['pos']}]")
        print("\nDRY-RUN. Re-run with --apply to write.")
    else:
        print(f"[applied] resynced {summary.get('resynced_files')} tracked files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
