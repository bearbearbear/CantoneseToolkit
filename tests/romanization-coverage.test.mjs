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
const hongKongPhraseNormalizations = extractLiteral("hongKongPhraseNormalizations");
const hongKongCharacterMap = extractLiteral("hongKongCharacterMap");
const phraseReadings = pronunciationData.phrases;
const characterReadings = pronunciationData.characters;
const phraseKeys = Object.keys(phraseReadings).sort((a, b) => b.length - a.length);

function applyRules(text, rules) {
  return [...rules]
    .sort(([left], [right]) => right.length - left.length)
    .reduce((next, [from, to]) => next.split(from).join(to), text);
}

function cleanInputText(text) {
  return text.trim().replace(/[；;]/g, "，").replace(/\s+/g, "");
}

function normalizeHongKongText(text) {
  const phraseNormalized = applyRules(text, hongKongPhraseNormalizations);
  return Array.from(phraseNormalized)
    .map((character) => hongKongCharacterMap[character] || character)
    .join("");
}

function compileRules(rules) {
  const normalizedRules = rules.map(([from, to]) => [
    normalizeHongKongText(from),
    normalizeHongKongText(to),
  ]);
  return [...rules, ...normalizedRules];
}

const conversionRules = compileRules(phraseRules);

function tidyCantonese(text) {
  let result = normalizeHongKongText(cleanInputText(text));
  result = applyRules(result, conversionRules);
  result = result
    .replace(/的/g, "嘅")
    .replace(/不(?![过過])/g, "唔")
    .replace(/[没沒]/g, "冇");
  result = result.replace(/([？?])$/g, "？");
  result = result.replace(/([。!！])$/g, "。");
  return normalizeHongKongText(result);
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

test("simplified and variant input is normalized to Hong Kong forms before conversion", () => {
  assert.equal(
    normalizeHongKongText("你们现在在哪里说广东话？"),
    "你們現在在哪裏說廣東話？",
  );
  assert.equal(tidyCantonese("你们现在在哪里说广东话？"), "你哋而家喺邊度講廣東話？");

  const missing = splitPronunciation(tidyCantonese("你们现在在哪里说广东话？"))
    .filter((unit) => !unit.readings?.jyutping?.[0])
    .map((unit) => unit.text);
  assert.deepEqual(missing, []);
});

test("reported sentence includes romanization for 香港人讲广东话", () => {
  const cantonese = tidyCantonese("香港人讲广东话");
  const units = splitPronunciation(cantonese);

  assert.equal(cantonese, "香港人講廣東話");
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
        unit.text === "廣東話" &&
        unit.readings.jyutping[0] === "gwong2 dung1 waa2",
    ),
  );
  assert.equal(units.some((unit) => !unit.readings?.jyutping?.[0]), false);
});
