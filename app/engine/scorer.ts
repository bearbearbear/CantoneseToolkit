import type { TranslationCandidate } from "./schema";

export function scoreCandidate(candidate: Omit<TranslationCandidate, "score" | "confidence">) {
  const matchedScore = candidate.matchedFeatures.reduce((score, feature) => {
    if (feature.kind === "phrase") return score + 30;
    if (feature.kind === "template") return score + 25;
    if (feature.kind === "lexicon") return score + 12;
    if (feature.kind === "rule") return score + 10;
    return score + 4;
  }, 0);
  const residuePenalty = estimateMandarinResidue(candidate.target) * 18;
  const duplicatePenalty = /(呀呀|喇喇|啦啦|唔唔)/.test(candidate.target) ? 20 : 0;
  const score = Math.max(0, 50 + matchedScore - residuePenalty - duplicatePenalty);
  const confidence = Math.max(0.32, Math.min(0.98, score / 160));

  return {
    ...candidate,
    score,
    confidence,
  };
}

export function estimateMandarinResidue(text: string) {
  const residues = text.match(/[们为么样办钱现这请问铁觉欢钟说买给来吗话广国语电车贵边门网联后与对发头间学师谢题时]/g);
  return residues?.length || 0;
}
