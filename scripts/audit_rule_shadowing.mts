// Audit: lexicon entries whose target is shadowed by rewrite rules.
// For every multi-char lexicon entry (source != target), translate the bare
// source and check whether the lexicon target survives in the output. If not,
// a rewrite rule (or other stage) overrode the entry.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { translate } from "../app/engine/translator.ts";

const csv = fileURLToPath(
  new URL("../resources/mandarin_cantonese_v1_2_0/lexicon.csv", import.meta.url),
);

function parseCsv(text: string): Record<string, string>[] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let f = "", row: string[] = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  const h = rows.shift()!;
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ""])));
}

const lex = parseCsv(readFileSync(csv, "utf8"));
const targets = lex.filter((r) => r.source && r.target && r.source !== r.target && Array.from(r.source).length > 1);

const shadowed: { id: string; source: string; target: string; got: string }[] = [];
for (const e of targets) {
  const got = translate(e.source, { scene: (e.scene || "general") as any }).target;
  if (!got.includes(e.target)) shadowed.push({ id: e.id, source: e.source, target: e.target, got });
}

console.log(`multi-char lexicon entries checked: ${targets.length}`);
console.log(`shadowed (target missing from output): ${shadowed.length} (${(shadowed.length / targets.length * 100).toFixed(1)}%)`);
const limit = process.argv.includes("--all") ? shadowed.length : 60;
for (const s of shadowed.slice(0, limit)) {
  console.log(`  ${s.id} ${s.source}->${s.target}  got:"${s.got}"`);
}
