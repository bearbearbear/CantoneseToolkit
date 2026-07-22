---
name: verify-data-package
description: >-
  Verify the mandarin_cantonese_v1_2_0 translation data package after any
  change: keep synchronized artifacts consistent (runtime-core, manifest hashes,
  counts, SHA256SUMS), run the engine eval and rule-shadowing audit, and run the
  package integrity tests. Use after editing any file under
  resources/mandarin_cantonese_v1_2_0/ (lexicon, rules, templates, phrases,
  slot_values, tests, runtime-core) or the translation engine in app/engine/.
---

# Verify Data Package

Run this workflow whenever the `mandarin_cantonese_v1_2_0` data package or the
`app/engine/` translation engine changes. Its purpose is to keep the many
synchronized artifacts consistent and to catch regressions before commit.

## Why this exists

The data package is stored redundantly. A single logical change (e.g. adding one
lexicon row) must be reflected in **all** of these or the integrity test fails:

- `lexicon.csv` (BOM + CRLF) and `lexicon.jsonl` (LF)
- `runtime-core-v1.2.0.json` (compact JSON the engine actually loads)
- `manifest.json` (per-file `bytes` + `sha256`, plus `counts`)
- `metadata.json` and `validation_report.json` (`counts`)
- `SHA256SUMS.txt`
- the hardcoded `translation_units` count in `tests/runtime-data-package.test.mjs`

Prefer the tooling below over hand-editing all artifacts.

## Checklist

```
- [ ] 1. Apply the data change through tooling (or edit + resync)
- [ ] 2. Resync counts + hashes so all artifacts agree
- [ ] 3. Run the engine eval; compare pass rates to before (no regressions)
- [ ] 4. Run the rule-shadowing audit (if lexicon/rules/engine changed)
- [ ] 5. Run integrity + full test suite (all pass)
- [ ] 6. Optional: spot-check on the preview page
```

## 1. Apply the change through tooling

All scripts are dry-run by default; pass `--apply` to write. Run from `scripts/`
or with `python3 scripts/<name>`.

- **Validate proposed lexicon rows** (quality gate — char-form dedupe, simplified/
  Mandarin residue, dupe vs existing lexicon + rules):
  `python3 scripts/lexicon_validate.py candidates.csv`
- **Add lexicon rows**: `harvest_lexicon_from_slot_values.py` or
  `curate_lexicon_phase2.py` (both validate then merge via `lexicon_merge.py`),
  add `--apply`. These update every artifact automatically.
- **Remove a lexicon row**: `python3 scripts/lexicon_remove.py LEX-XXXX --apply`
  (updates every artifact automatically; does not renumber IDs).

If you edit `rules/templates/phrases/slot_values/tests` or `runtime-core`
**by hand**, the automatic sync does not run — go to step 2.

## 2. Resync counts + hashes

After any hand edit to a tracked data file, recompute manifest hashes/sizes and
`SHA256SUMS.txt`:

```bash
python3 scripts/resync_hashes.py
```

`resync_hashes.py` only fixes hashes/sizes. If you changed the number of lexicon
rows by hand, also update `counts.lexicon` / `counts.translation_units` in
`manifest.json`, `metadata.json`, `validation_report.json`, and the
`translation_units` literal in `tests/runtime-data-package.test.mjs`. Using the
add/remove scripts in step 1 avoids this bookkeeping.

Also confirm the change reached `runtime-core-v1.2.0.json` (the engine loads it,
not the CSV). The add/remove scripts update it; hand edits must too.

## 3. Engine eval (regression gate)

```bash
node_modules/.bin/tsx scripts/_engine_eval.mts          # summary
node_modules/.bin/tsx scripts/_engine_eval.mts --fails  # list exact mismatches
```

Reports exact-match and feature-assert pass rates over active `tests.csv` cases,
broken down by `test_type`. Compare against the pre-change numbers; investigate
any drop.

**Before/after regression diff** (isolate what a code change churned):

```bash
node_modules/.bin/tsx scripts/_engine_eval.mts --fails | grep -oE 'TST-[0-9]+' | sort -u > /tmp/fa.txt
git stash push -- app/engine/<changed-file>.ts
node_modules/.bin/tsx scripts/_engine_eval.mts --fails | grep -oE 'TST-[0-9]+' | sort -u > /tmp/fb.txt
git stash pop
comm -23 /tmp/fa.txt /tmp/fb.txt   # NEW regressions
comm -13 /tmp/fa.txt /tmp/fb.txt   # NEW fixes
```

## 4. Rule-shadowing audit

Run when lexicon, rules, or the engine changed. Flags multi-char lexicon entries
whose target is missing from the output (a shorter rule or postprocess overrode
it):

```bash
node_modules/.bin/tsx scripts/audit_rule_shadowing.mts        # count
node_modules/.bin/tsx scripts/audit_rule_shadowing.mts --all  # list all
```

Remaining shadows are acceptable only when intentional (sense_split entries whose
`condition` is unimplemented, so a rule correctly yields the default sense).

## 5. Integrity + full test suite

```bash
node --test tests/runtime-data-package.test.mjs   # manifest + hash integrity
node --test tests/*.test.mjs                       # full suite
```

All tests must pass. A hash/count mismatch here means step 2 was incomplete.

## 6. Optional: preview page

If the dev server is running (`http://localhost:3003`), sample a few changed
cases in the input box and confirm the output. HMR picks up engine edits;
`runtime-core` JSON changes may need a server restart.

## Notes

- `tsx` scripts read files broadly; if a run fails with a sandbox `EPERM`, rerun
  it with full local permissions.
- `scripts/_engine_eval.mts` and `scripts/audit_rule_shadowing.mts` are durable
  diagnostics — keep them; they are the regression signal for this package.
