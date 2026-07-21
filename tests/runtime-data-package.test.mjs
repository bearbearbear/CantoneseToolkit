import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageRoot = new URL(
  "../resources/mandarin_cantonese_v1_1_1/",
  import.meta.url,
);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", packageRoot), "utf8"));
const runtimeCore = JSON.parse(
  readFileSync(new URL("runtime-core-v1.1.1.json", packageRoot), "utf8"),
);
const validationReport = JSON.parse(
  readFileSync(new URL("validation_report.json", packageRoot), "utf8"),
);

test("latest runtime data package passes manifest and validation checks", () => {
  assert.equal(manifest.version, "1.1.1");
  assert.equal(runtimeCore.version, manifest.version);
  assert.equal(validationReport.passed, true);
  assert.equal(manifest.counts.translation_units, 8042);

  assert.equal(runtimeCore.phrases.length, manifest.counts.phrases);
  assert.equal(runtimeCore.lexicon.length, manifest.counts.lexicon);
  assert.equal(runtimeCore.templates.length, manifest.counts.templates);
  assert.equal(runtimeCore.rules.length, manifest.counts.rules);

  assert.equal(
    validationReport.checks.every((check) => check.passed),
    true,
  );
});

test("latest package file hashes match manifest", () => {
  for (const file of manifest.files) {
    const bytes = readFileSync(new URL(file.name, packageRoot));
    const sha256 = createHash("sha256").update(bytes).digest("hex");

    assert.equal(bytes.byteLength, file.bytes, `${file.name} byte size`);
    assert.equal(sha256, file.sha256, `${file.name} sha256`);
  }
});
