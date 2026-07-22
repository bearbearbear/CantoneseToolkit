import { loadRuntimeCore } from "./data/loader";
import {
  cleanInputText,
  normalizeInput,
  restoreSlots,
} from "./normalizer";
import {
  createTrie,
  findExactPhraseMatch,
  makePhraseLikeEntries,
  segmentFeatures,
  segmentsToText,
  tokenizeByTrie,
} from "./phrase-matcher";
import { postProcess } from "./postprocessor";
import type {
  MatchedFeature,
  RuntimeCore,
  TranslationCandidate,
  TranslationOptions,
  TranslationResult,
} from "./schema";
import { compileTemplates, matchTemplate } from "./template-matcher";
import { applyRewriteRules, getPlainRuleSources } from "./rewrite-engine";
import { generateCandidates } from "./candidate-generator";
import { scoreCandidate } from "./scorer";

type TranslatorRuntime = ReturnType<typeof buildTranslatorRuntime>;

let defaultRuntime: TranslatorRuntime | null = null;

export function createTranslator(core: RuntimeCore = loadRuntimeCore()) {
  const runtime = buildTranslatorRuntime(core);

  return {
    dataVersion: core.version,
    translate(text: string, options: TranslationOptions = {}) {
      return translateWithRuntime(runtime, text, options);
    },
  };
}

export function translate(text: string, options: TranslationOptions = {}) {
  if (!defaultRuntime) {
    defaultRuntime = buildTranslatorRuntime(loadRuntimeCore());
  }

  return translateWithRuntime(defaultRuntime, text, options);
}

function buildTranslatorRuntime(core: RuntimeCore) {
  const entries = makePhraseLikeEntries(core.phrases, core.lexicon);
  return {
    core,
    trie: createTrie(entries),
    templates: compileTemplates(core.templates),
    plainRuleSources: getPlainRuleSources(core.rules),
    ambiguousLexiconSources: getAmbiguousLexiconSources(core.lexicon),
  };
}

// Sources that map to more than one lexicon entry (sense-split senses, e.g.
// 不要→唔好 / 不要→唔要). We cannot tell which sense applies without the
// unimplemented conditions, so these are NOT sentinel-protected: they fall
// through to the rewrite rules, which resolve them into the default sense.
function getAmbiguousLexiconSources(
  lexicon: RuntimeCore["lexicon"],
): Set<string> {
  const counts = new Map<string, number>();
  for (const entry of lexicon) {
    counts.set(entry.source, (counts.get(entry.source) ?? 0) + 1);
  }
  const ambiguous = new Set<string>();
  for (const [source, count] of counts) {
    if (count > 1) {
      ambiguous.add(source);
    }
  }
  return ambiguous;
}

function translateWithRuntime(
  runtime: TranslatorRuntime,
  text: string,
  options: TranslationOptions,
): TranslationResult {
  const scene = options.scene || "general";
  const normalized = normalizeInput(text);
  const sourceText = normalized.text;

  if (!sourceText) {
    return makeEmptyResult(text, runtime.core.version);
  }

  const exactPhrase = findExactPhraseMatch(sourceText, runtime.core.phrases, scene);

  // A curated exact-phrase hit is authoritative: it must not be outscored by
  // token-level lexicon/rule candidates, so short-circuit here.
  if (exactPhrase) {
    const postProcessed = postProcess(
      restoreSlots(exactPhrase.target, normalized.slots),
      options,
    );
    const scored = scoreCandidate({
      target: postProcessed.text,
      matchedFeatures: [
        {
          id: exactPhrase.id,
          kind: "phrase",
          source: exactPhrase.source,
          target: exactPhrase.target,
        },
        ...postProcessed.features,
      ],
      warnings: [],
    });
    const candidate: TranslationCandidate = {
      ...scored,
      confidence: Math.max(scored.confidence, 0.95),
    };

    return {
      source: text,
      normalizedSource: normalized.displayText,
      target: candidate.target,
      confidence: candidate.confidence,
      matchedTemplate: null,
      matchedFeatures: candidate.matchedFeatures,
      candidates: [candidate],
      warnings: [],
      dataVersion: runtime.core.version,
    };
  }

  const rawCandidates: Array<{
    target: string;
    matchedFeatures: MatchedFeature[];
    warnings: string[];
  }> = [];

  const template = matchTemplate(
    sourceText,
    runtime.templates,
    scene,
    (slotText, slotOptions) =>
      translateSlot(runtime, slotText, { ...slotOptions, scene }),
    options,
  );

  if (template) {
    rawCandidates.push({
      target: template.target,
      matchedFeatures: [template.feature],
      warnings: [],
    });
  }

  rawCandidates.push(ruleAndLexiconCandidate(runtime, sourceText, scene));

  const candidates = generateCandidates(
    rawCandidates.map((candidate) => {
      const postProcessed = postProcess(
        restoreSlots(candidate.target, normalized.slots),
        options,
      );

      return {
        target: postProcessed.text,
        matchedFeatures: [...candidate.matchedFeatures, ...postProcessed.features],
        warnings: candidate.warnings,
      };
    }),
    options.beamWidth || 6,
  );

  const best = candidates[0];
  const warnings =
    best.warnings.length > 0
      ? best.warnings
      : best.confidence < 0.55
        ? ["包含未覆盖表达，建议缩短句子或换一种说法。"]
        : [];

  return {
    source: text,
    normalizedSource: normalized.displayText,
    target: best.target,
    confidence: best.confidence,
    matchedTemplate:
      best.matchedFeatures.find((feature) => feature.kind === "template")?.id ||
      null,
    matchedFeatures: best.matchedFeatures,
    candidates,
    warnings,
    dataVersion: runtime.core.version,
  };
}

function translateSlot(
  runtime: TranslatorRuntime,
  text: string,
  options: TranslationOptions,
) {
  return postProcess(ruleAndLexiconCandidate(runtime, text, options.scene || "general").target, {
    ...options,
    style: "standard",
  }).text.replace(/[。！？]$/, "");
}

const PROTECT_OPEN = "\uE000";
const PROTECT_CLOSE = "\uE001";
const PROTECT_PATTERN = /\uE000(\d+)\uE001/g;

// Lexicon `condition` values the engine can actually evaluate. Entries carrying
// any other (declared-but-unimplemented) condition are sense-split senses that
// must NOT win unconditionally, so they are left for the rewrite rules to
// resolve into the default sense.
const IMPLEMENTED_CONDITIONS = new Set(["learned_skill"]);

// A lexicon match is "confident" — and therefore protected from rewrite rules
// breaking it apart — when it is a multi-character LEXICON entry (phrases are
// excluded: they carry sentence-final particles and full-sentence phrases are
// already handled by the exact-match short-circuit) whose condition, if any,
// the engine can evaluate, and whose source is not sense-ambiguous. Single-char
// / unimplemented-condition / ambiguous matches fall through to the rules.
function isConfidentMatch(
  segment: {
    source: string;
    entry: { id: string; condition?: string } | null;
  },
  ambiguousSources: Set<string>,
): boolean {
  if (!segment.entry) {
    return false;
  }
  if (!segment.entry.id.startsWith("LEX-")) {
    return false;
  }
  if (Array.from(segment.source).length < 2) {
    return false;
  }
  const condition = segment.entry.condition;
  // Trie already evaluated implemented conditions; protect those hits.
  if (condition) {
    return IMPLEMENTED_CONDITIONS.has(condition);
  }
  // Unconditional but sense-ambiguous sources fall through to rules.
  if (ambiguousSources.has(segment.source)) {
    return false;
  }
  return true;
}

// True when a plain rewrite rule covers the [start, end) span with a match that
// is longer than it (so the longer rule should win — true longest-match) or is
// exactly co-extensive with it (preserving the original rules-first behavior
// when a rule and a lexicon entry share the same source). This keeps entries
// like 不是→唔係 from shadowing longer rules such as 是不是→係咪.
function coveredByStrongerRule(
  chars: string[],
  start: number,
  end: number,
  ruleSources: string[],
): boolean {
  const spanLen = end - start;

  for (const source of ruleSources) {
    const ruleChars = Array.from(source);
    const ruleLen = ruleChars.length;
    if (ruleLen < spanLen) {
      continue;
    }

    for (let pos = 0; pos + ruleLen <= chars.length; pos += 1) {
      if (pos >= end || pos + ruleLen <= start) {
        continue; // no overlap with the span
      }
      let matches = true;
      for (let offset = 0; offset < ruleLen; offset += 1) {
        if (chars[pos + offset] !== ruleChars[offset]) {
          matches = false;
          break;
        }
      }
      if (!matches) {
        continue;
      }
      if (ruleLen > spanLen) {
        return true;
      }
      if (pos === start) {
        return true; // same span, same length -> rule wins as before
      }
    }
  }

  return false;
}

function ruleAndLexiconCandidate(
  runtime: TranslatorRuntime,
  text: string,
  scene: string,
) {
  const cleaned = cleanInputText(text);

  // 1. Locate curated phrase/lexicon matches on the Mandarin text and mask the
  //    confident, multi-character ones with sentinels so the rewrite rules
  //    cannot fracture them (e.g. 在→喺 breaking 现在→而家, 的→嘅 breaking
  //    出租车→的士). Everything else keeps its Mandarin source.
  const cleanedChars = Array.from(cleaned);
  const initialSegments = tokenizeByTrie(cleaned, runtime.trie, scene);
  const protectedEntries: Array<{ target: string; feature: MatchedFeature }> = [];
  let masked = "";
  let position = 0;

  for (const segment of initialSegments) {
    const segmentLength = Array.from(segment.source).length;
    const start = position;
    const end = position + segmentLength;
    position = end;

    if (
      isConfidentMatch(segment, runtime.ambiguousLexiconSources) &&
      segment.entry &&
      !coveredByStrongerRule(cleanedChars, start, end, runtime.plainRuleSources)
    ) {
      masked += `${PROTECT_OPEN}${protectedEntries.length}${PROTECT_CLOSE}`;
      protectedEntries.push({
        target: segment.target,
        feature: {
          id: segment.entry.id,
          kind: "lexicon",
          source: segment.source,
          target: segment.target,
        },
      });
    } else {
      masked += segment.source;
    }
  }

  // 2. Apply rewrite rules over the masked text (sentinels are inert to them).
  const rewritten = applyRewriteRules(masked, runtime.core.rules);

  // 3. Re-tokenize the rewritten text so single-character and any remaining
  //    lexicon entries still apply (this mirrors the original pipeline, which
  //    ran the trie after the rules). Sentinels pass through as unmatched.
  const finalSegments = tokenizeByTrie(rewritten.text, runtime.trie, scene);
  const trieFeatures = segmentFeatures(finalSegments);

  // 4. Restore protected lexicon/phrase targets.
  const restoredFeatures: MatchedFeature[] = [];
  const target = segmentsToText(finalSegments).replace(
    PROTECT_PATTERN,
    (_match, index) => {
      const entry = protectedEntries[Number(index)];
      restoredFeatures.push(entry.feature);
      return entry.target;
    },
  );

  const features = [...rewritten.features, ...trieFeatures, ...restoredFeatures];
  const warnings = features.length === 0 ? ["未命中明确词条或规则。"] : [];

  return { target, matchedFeatures: features, warnings };
}

function makeEmptyResult(source: string, dataVersion: string): TranslationResult {
  return {
    source,
    normalizedSource: "",
    target: "喺左邊輸入中文，我會幫你轉成粵語。",
    confidence: 1,
    matchedTemplate: null,
    matchedFeatures: [],
    candidates: [],
    warnings: [],
    dataVersion,
  };
}
