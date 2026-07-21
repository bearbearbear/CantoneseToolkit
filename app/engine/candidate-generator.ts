import type { TranslationCandidate } from "./schema";
import { scoreCandidate } from "./scorer";

export function generateCandidates(
  candidates: Array<Omit<TranslationCandidate, "score" | "confidence">>,
  beamWidth = 6,
) {
  const unique = new Map<string, TranslationCandidate>();

  for (const candidate of candidates) {
    const scored = scoreCandidate(candidate);
    const existing = unique.get(scored.target);
    if (!existing || scored.score > existing.score) {
      unique.set(scored.target, scored);
    }
  }

  return [...unique.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, beamWidth);
}
