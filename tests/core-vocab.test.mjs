import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const coreVocab = JSON.parse(
  readFileSync(
    new URL("../app/data/cantonese-core-vocab.json", import.meta.url),
    "utf8",
  ),
);
const conversionRuleData = JSON.parse(
  readFileSync(
    new URL("../app/data/cantonese-conversion-rules.json", import.meta.url),
    "utf8",
  ),
);

const columnIndex = Object.fromEntries(
  coreVocab.columns.map((column, index) => [column, index]),
);
const phraseRuleMap = new Map(conversionRuleData.phraseRules);

function get(entry, column) {
  return entry[columnIndex[column]];
}

test("core Cantonese vocab v0.1 has the expected draft shape", () => {
  assert.ok(coreVocab.entries.length >= 280);
  assert.ok(coreVocab.entries.length <= 380);

  for (const column of [
    "mandarin",
    "cantonese",
    "jyutping",
    "category",
    "pos",
    "type",
    "priority",
    "confidence",
    "sources",
    "note",
  ]) {
    assert.ok(column in columnIndex, `missing column: ${column}`);
  }

  for (const [index, entry] of coreVocab.entries.entries()) {
    assert.equal(
      entry.length,
      coreVocab.columns.length,
      `entry ${index + 1} should match column count`,
    );
    assert.ok(get(entry, "mandarin"), `entry ${index + 1} has mandarin`);
    assert.ok(get(entry, "cantonese"), `entry ${index + 1} has cantonese`);
    assert.ok(get(entry, "jyutping"), `entry ${index + 1} has jyutping`);
    assert.match(
      get(entry, "type"),
      /^(exact|contextual|pattern)$/,
      `entry ${index + 1} has a known type`,
    );
    assert.ok(
      Number.isInteger(get(entry, "priority")),
      `entry ${index + 1} has integer priority`,
    );
    assert.ok(
      get(entry, "confidence") >= 0 && get(entry, "confidence") <= 1,
      `entry ${index + 1} has normalized confidence`,
    );
  }
});

test("core Cantonese vocab does not duplicate Mandarin keys", () => {
  const seen = new Set();
  const duplicates = [];

  for (const entry of coreVocab.entries) {
    const mandarin = get(entry, "mandarin");
    if (seen.has(mandarin)) {
      duplicates.push(mandarin);
    }
    seen.add(mandarin);
  }

  assert.deepEqual(duplicates, []);
});

test("exact vocab entries are exported to phrase rules while contextual entries are not", () => {
  const missingExactRules = [];
  const leakedContextualRules = [];

  for (const entry of coreVocab.entries) {
    const mandarin = get(entry, "mandarin");
    const cantonese = get(entry, "cantonese");
    const type = get(entry, "type");

    if (type === "exact" && mandarin !== cantonese) {
      if (phraseRuleMap.get(mandarin) !== cantonese) {
        missingExactRules.push(`${mandarin}->${cantonese}`);
      }
    }

    if (type !== "exact" && phraseRuleMap.has(mandarin)) {
      leakedContextualRules.push(mandarin);
    }
  }

  assert.deepEqual(missingExactRules, []);
  assert.deepEqual(leakedContextualRules, []);
});
