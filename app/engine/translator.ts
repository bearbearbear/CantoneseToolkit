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
import { applyRewriteRules } from "./rewrite-engine";
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
  };
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

function ruleAndLexiconCandidate(
  runtime: TranslatorRuntime,
  text: string,
  scene: string,
) {
  const cleaned = cleanInputText(text);
  const rewritten = applyRewriteRules(cleaned, runtime.core.rules);
  const segments = tokenizeByTrie(rewritten.text, runtime.trie, scene);
  const target = segmentsToText(segments);
  const features = [...rewritten.features, ...segmentFeatures(segments)];
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
