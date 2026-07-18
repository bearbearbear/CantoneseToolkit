import { readFile, writeFile } from "node:fs/promises";

const vocabUrl = new URL("../app/data/cantonese-core-vocab.json", import.meta.url);
const rulesUrl = new URL(
  "../app/data/cantonese-conversion-rules.json",
  import.meta.url,
);

const vocab = JSON.parse(await readFile(vocabUrl, "utf8"));
const rules = JSON.parse(await readFile(rulesUrl, "utf8"));

const columnIndex = Object.fromEntries(
  vocab.columns.map((column, index) => [column, index]),
);

const requiredColumns = ["mandarin", "cantonese", "type"];
for (const column of requiredColumns) {
  if (!(column in columnIndex)) {
    throw new Error(`Missing required column: ${column}`);
  }
}

const generatedPhraseRules = vocab.entries
  .filter((entry) => entry[columnIndex.type] === "exact")
  .map((entry) => [
    entry[columnIndex.mandarin],
    entry[columnIndex.cantonese],
  ])
  .filter(([from, to]) => from && to && from !== to);

const vocabTypes = new Map(
  vocab.entries.map((entry) => [
    entry[columnIndex.mandarin],
    entry[columnIndex.type],
  ]),
);

const merged = new Map();
for (const [from, to] of generatedPhraseRules) {
  merged.set(from, to);
}
for (const [from, to] of rules.phraseRules) {
  const vocabType = vocabTypes.get(from);
  if (vocabType && vocabType !== "exact") {
    continue;
  }
  if (!merged.has(from)) {
    merged.set(from, to);
  }
}

const nextRules = {
  ...rules,
  phraseRules: [...merged.entries()].sort(
    ([left], [right]) => right.length - left.length || left.localeCompare(right),
  ),
};

await writeFile(rulesUrl, `${JSON.stringify(nextRules, null, 2)}\n`);

console.log(
  `Wrote ${nextRules.phraseRules.length} phrase rules from ${generatedPhraseRules.length} exact vocab entries.`,
);
