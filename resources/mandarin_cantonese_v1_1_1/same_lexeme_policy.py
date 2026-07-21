from __future__ import annotations
import unicodedata
from opencc import OpenCC

_CC = {name: OpenCC(name) for name in ("s2t", "s2hk", "s2tw", "t2s")}

def _norm(value: str) -> str:
    return unicodedata.normalize("NFC", value or "").strip()

def is_same_lexeme_passthrough(source: str, target: str, flags: str = "", condition: str = "") -> bool:
    source, target = _norm(source), _norm(target)
    if _norm(_CC["t2s"].convert(source)) == _norm(_CC["t2s"].convert(target)):
        return True
    if any(_norm(_CC[p].convert(source)) == target for p in ("s2t", "s2hk", "s2tw")):
        return True
    return flags == "passthrough_same_lexeme" or "same-lexeme" in (condition or "")

def assert_no_same_lexeme(rows, source_field: str, target_field: str, label: str) -> None:
    bad = [
        row.get("id", "")
        for row in rows
        if is_same_lexeme_passthrough(
            row[source_field], row[target_field],
            row.get("flags", ""), row.get("condition", "")
        )
    ]
    if bad:
        raise ValueError(f"{label}: {len(bad)} same-lexeme passthrough rows remain: {bad[:10]}")
