// Quick engine eval over active tests.csv cases (exact + feature assertions).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { translate } from "../app/engine/translator.ts";

const csvPath = fileURLToPath(
  new URL("../resources/mandarin_cantonese_v1_2_0/tests.csv", import.meta.url),
);

function parseCsv(text: string): Record<string, string>[] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift()!;
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

const all = parseCsv(readFileSync(csvPath, "utf8"));
const active = all.filter((r) => r.status === "active");

type Stat = { total: number; exact: number; feat: number };
const byType = new Map<string, Stat>();
let exactPass = 0, featPass = 0;
const failures: string[] = [];

for (const t of active) {
  const scene = (t.scene || "general") as any;
  const got = translate(t.source, { scene }).target;
  const exp = t.expected_target;
  const req = (t.required_features || "").split(/[|,]/).map((s) => s.trim()).filter(Boolean);
  const forb = (t.forbidden_features || "").split(/[|,]/).map((s) => s.trim()).filter(Boolean);
  const exactOk = got === exp;
  const featOk = req.every((f) => got.includes(f)) && forb.every((f) => !got.includes(f));
  if (exactOk) exactPass++;
  if (featOk) featPass++;
  const st = byType.get(t.test_type) || { total: 0, exact: 0, feat: 0 };
  st.total++; if (exactOk) st.exact++; if (featOk) st.feat++;
  byType.set(t.test_type, st);
  if (!exactOk) failures.push(`${t.id} [${t.test_type}] "${t.source}" => got:"${got}" exp:"${exp}"`);
}

console.log(`ACTIVE tests: ${active.length}`);
console.log(`exact-match pass: ${exactPass}/${active.length} (${(exactPass / active.length * 100).toFixed(1)}%)`);
console.log(`feature-assert pass: ${featPass}/${active.length} (${(featPass / active.length * 100).toFixed(1)}%)`);
console.log("by test_type (exact/total | feat/total):");
for (const [k, v] of [...byType.entries()].sort()) console.log(`  ${k}: ${v.exact}/${v.total} | ${v.feat}/${v.total}`);
if (process.argv.includes("--fails")) { console.log("\nexact-mismatches:"); for (const f of failures) console.log("  " + f); }
