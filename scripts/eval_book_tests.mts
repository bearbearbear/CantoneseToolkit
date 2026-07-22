// Validate and evaluate the 《粤语初级教程》 test CSVs under
// resources/粤语初级教程_tests/ against the translation engine.
//
//   node_modules/.bin/tsx scripts/eval_book_tests.mts            # validate + eval summary
//   node_modules/.bin/tsx scripts/eval_book_tests.mts --fails    # + list exact mismatches
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { translate } from "../app/engine/translator.ts";

const dir = fileURLToPath(
  new URL("../resources/粤语初级教程_tests/", import.meta.url),
);
const s2hk: Record<string, string> = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../app/engine/data/simplified-to-hongkong.json", import.meta.url)),
    "utf8",
  ),
);

const EXPECTED_HEADER = [
  "id", "source", "expected_target", "scene", "test_type", "intent",
  "required_features", "forbidden_features", "notes", "status",
];

function parseCsv(text: string): { header: string[]; rows: Record<string, string>[] } {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const table: string[][] = [];
  let field = "", row: string[] = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") { row.push(field); table.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); table.push(row); }
  const header = table.shift() ?? [];
  const rows = table
    .filter((r) => r.length > 1 && r.some((c) => c.trim()))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
  return { header, rows };
}

const files = readdirSync(dir).filter((f) => f.endsWith(".csv")).sort();
const splitList = (v: string) => (v || "").split(/[|,，]/).map((s) => s.trim()).filter(Boolean);
const hasHan = (s: string) => /[\u3400-\u9fff]/.test(s);

// ---------- 1. Validation ----------
type Issue = { file: string; id: string; kind: string; detail: string };
const issues: Issue[] = [];
const seenIds = new Map<string, string>(); // id -> file
const allRows: Array<Record<string, string> & { __file: string }> = [];
const statusCount = new Map<string, number>();
const typeCount = new Map<string, number>();

for (const file of files) {
  const { header, rows } = parseCsv(readFileSync(dir + file, "utf8"));
  if (header.join(",") !== EXPECTED_HEADER.join(",")) {
    issues.push({ file, id: "-", kind: "schema", detail: `header mismatch: ${header.join(",")}` });
  }
  for (const r of rows) {
    const id = r.id || "";
    allRows.push({ ...r, __file: file });
    statusCount.set(r.status || "(empty)", (statusCount.get(r.status || "(empty)") || 0) + 1);
    typeCount.set(r.test_type || "(empty)", (typeCount.get(r.test_type || "(empty)") || 0) + 1);

    if (!id) issues.push({ file, id: "-", kind: "missing_id", detail: JSON.stringify(r.source) });
    else if (seenIds.has(id)) issues.push({ file, id, kind: "dup_id", detail: `also in ${seenIds.get(id)}` });
    else seenIds.set(id, file);

    if (!r.source?.trim()) issues.push({ file, id, kind: "empty_source", detail: "" });
    else if (!hasHan(r.source)) issues.push({ file, id, kind: "source_no_han", detail: r.source });
    if (!r.expected_target?.trim()) issues.push({ file, id, kind: "empty_expected", detail: "" });

    // feature self-consistency
    for (const f of splitList(r.required_features))
      if (r.expected_target && !r.expected_target.includes(f))
        issues.push({ file, id, kind: "required_not_in_expected", detail: `${f} ∉ ${r.expected_target}` });
    for (const f of splitList(r.forbidden_features))
      if (r.expected_target && r.expected_target.includes(f))
        issues.push({ file, id, kind: "forbidden_in_expected", detail: `${f} ∈ ${r.expected_target}` });

    // simplified residue in expected_target (should be HK traditional)
    const residue = Array.from(r.expected_target || "").filter((ch) => ch in s2hk);
    if (residue.length)
      issues.push({ file, id, kind: "simplified_residue", detail: `${[...new Set(residue)].join("")} in ${r.expected_target}` });
  }
}

console.log(`FILES: ${files.length} · ROWS: ${allRows.length}`);
console.log("status:", [...statusCount.entries()].map(([k, v]) => `${k}=${v}`).join(" · "));
console.log("test_type:", [...typeCount.entries()].map(([k, v]) => `${k}=${v}`).join(" · "));

console.log(`\n=== VALIDATION: ${issues.length} issue(s) ===`);
const byKind = new Map<string, Issue[]>();
for (const it of issues) (byKind.get(it.kind) ?? byKind.set(it.kind, []).get(it.kind)!).push(it);
for (const [kind, list] of [...byKind.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${kind}: ${list.length}`);
  for (const it of list.slice(0, 12)) console.log(`    - ${it.id} [${it.file}] ${it.detail}`);
  if (list.length > 12) console.log(`    … +${list.length - 12} more`);
}

// ---------- 2. Run tests ----------
// Evaluate every extracted row (active + draft); track active separately.
let exact = 0, feat = 0, exactActive = 0, activeTotal = 0;
const failures: string[] = [];
const byFile = new Map<string, { total: number; exact: number }>();

for (const t of allRows) {
  const scene = (t.scene || "general") as any;
  let got = "";
  try { got = translate(t.source, { scene }).target; }
  catch (e) { got = `<ERROR: ${(e as Error).message}>`; }
  const exp = t.expected_target;
  const req = splitList(t.required_features);
  const forb = splitList(t.forbidden_features);
  const exactOk = got === exp;
  const featOk = req.every((f) => got.includes(f)) && forb.every((f) => !got.includes(f));
  if (exactOk) exact++;
  if (featOk) feat++;
  if ((t.status || "active") === "active") { activeTotal++; if (exactOk) exactActive++; }
  const chapter = t.__file.replace(/^粤语初级教程_|_tests\.csv$/g, "");
  const st = byFile.get(chapter) ?? { total: 0, exact: 0 };
  st.total++; if (exactOk) st.exact++;
  byFile.set(chapter, st);
  if (!exactOk) failures.push(`${t.id} [${chapter}] "${t.source}" => got:"${got}" exp:"${exp}"`);
}

console.log(`\n=== ENGINE EVAL ===`);
console.log(`exact-match (all ${allRows.length}):    ${exact}/${allRows.length} (${(exact / allRows.length * 100).toFixed(1)}%)`);
console.log(`exact-match (active ${activeTotal}):  ${exactActive}/${activeTotal} (${(exactActive / activeTotal * 100).toFixed(1)}%)`);
console.log(`feature-assert (all):    ${feat}/${allRows.length} (${(feat / allRows.length * 100).toFixed(1)}%)  [most rows define no features → not meaningful]`);
console.log("by chapter (exact/total):");
for (const [k, v] of [...byFile.entries()].sort())
  console.log(`  ${k}: ${v.exact}/${v.total}`);

if (process.argv.includes("--fails")) {
  console.log(`\n=== EXACT MISMATCHES (${failures.length}) ===`);
  for (const f of failures) console.log("  " + f);
}
