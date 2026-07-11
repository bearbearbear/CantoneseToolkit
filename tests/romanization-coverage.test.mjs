import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const cases = JSON.parse(
  readFileSync(new URL("./romanization-cases.json", import.meta.url), "utf8"),
);
const pronunciationData = JSON.parse(
  readFileSync(
    new URL("../app/data/cantonese-pronunciation-table.json", import.meta.url),
    "utf8",
  ),
);

function extractLiteral(name) {
  const pattern = new RegExp(`const ${name}[^=]*= ([\\s\\S]*?);\\n\\n`);
  const match = pageSource.match(pattern);
  assert.ok(match, `Could not find ${name}`);
  return Function(`"use strict"; return (${match[1]});`)();
}

const phraseRules = extractLiteral("phraseRules");
const phraseReadings = pronunciationData.phrases;
const characterReadings = pronunciationData.characters;
const phraseKeys = Object.keys(phraseReadings).sort((a, b) => b.length - a.length);

function applyRules(text, rules) {
  return [...rules]
    .sort(([left], [right]) => right.length - left.length)
    .reduce((next, [from, to]) => next.split(from).join(to), text);
}

function tidyCantonese(text) {
  let result = text.trim();
  result = result.replace(/[；;]/g, "，").replace(/\s+/g, "");
  result = applyRules(result, phraseRules);
  result = result
    .replace(/的/g, "嘅")
    .replace(/不(?!过)/g, "唔")
    .replace(/没/g, "冇");
  result = result.replace(/([？?])$/g, "？");
  result = result.replace(/([。!！])$/g, "。");
  return result;
}

function splitPronunciation(text) {
  const units = [];
  let index = 0;

  while (index < text.length) {
    const matched = phraseKeys.find((key) => text.startsWith(key, index));
    if (matched) {
      units.push({ text: matched, readings: phraseReadings[matched] });
      index += matched.length;
      continue;
    }

    const char = text[index];
    if (!/[\s，。！？,.!?]/.test(char)) {
      units.push({ text: char, readings: characterReadings[char] || null });
    }
    index += 1;
  }

  return units;
}

test("internet-derived pronunciation table is broad and multi-scheme", () => {
  assert.ok(pronunciationData.metadata.characterCount > 25000);
  assert.deepEqual(Object.keys(pronunciationData.schemes), [
    "jyutping",
    "textbook",
    "yale",
    "education",
  ]);

  for (const character of ["香", "港", "广", "廣", "话", "話", "粵", "语", "語"]) {
    const readings = characterReadings[character];
    assert.ok(readings, `${character} should exist in the table`);
    for (const scheme of Object.keys(pronunciationData.schemes)) {
      assert.ok(readings[scheme]?.[0], `${character} should have ${scheme}`);
    }
  }
});

test("coverage dataset has no missing Cantonese romanization", () => {
  const failures = [];

  for (const item of cases) {
    const cantonese = tidyCantonese(item.input);
    const missing = splitPronunciation(cantonese)
      .filter((unit) => !unit.readings?.jyutping?.[0])
      .map((unit) => unit.text);

    if (missing.length) {
      failures.push(`${item.input} -> ${cantonese}: ${missing.join(", ")}`);
    }
  }

  assert.deepEqual(failures, []);
});

test("reported sentence includes romanization for 香港人讲广东话", () => {
  const cantonese = tidyCantonese("香港人讲广东话");
  const units = splitPronunciation(cantonese);

  assert.equal(cantonese, "香港人讲广东话");
  assert.ok(
    units.some(
      (unit) =>
        unit.text === "香港人" &&
        unit.readings.jyutping[0] === "hoeng1 gong2 jan4",
    ),
  );
  assert.ok(
    units.some(
      (unit) =>
        unit.text === "广东话" &&
        unit.readings.jyutping[0] === "gwong2 dung1 waa2",
    ),
  );
  assert.equal(units.some((unit) => !unit.readings?.jyutping?.[0]), false);
});
