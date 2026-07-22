import type { MatchedFeature, TranslationOptions } from "./schema";
import { normalizeHongKongText } from "./normalizer";

const casualEndings = ["啦", "喇", "啫", "呀"];

export function postProcess(
  text: string,
  options: TranslationOptions,
): { text: string; features: MatchedFeature[] } {
  const features: MatchedFeature[] = [];
  let next = normalizeHongKongText(text)
    .replace(/係喺/g, "係")
    .replace(/喺邊度/g, "喺邊度")
    .replace(/點行/g, "點行")
    .replace(/東西/g, "嘢")
    .replace(/但是/g, "但係")
    // Possessive/attributive 的 -> 嘅, but keep 的士 (taxi) intact.
    .replace(/的(?!士)/g, "嘅")
    // 嘅啲 is unnatural after possessive absorption (的人们→嘅啲人).
    .replace(/嘅啲/g, "啲")
    .replace(/([？?])$/g, "？")
    .replace(/([。!！])$/g, (mark) => (mark === "！" || mark === "!" ? "！" : "。"))
    .replace(/呀呀/g, "呀")
    .replace(/喇喇/g, "喇")
    .replace(/啦啦/g, "啦")
    .replace(/唔唔/g, "唔")
    .replace(/？？+/g, "？")
    .replace(/。。+/g, "。")
    .replace(/！！+/g, "！");

  if (/[？]$/.test(next) && !/(呀|咩|㗎|呢)？$/.test(next)) {
    next = next.replace(/？$/, "呀？");
    features.push({
      id: "RUL-0074",
      kind: "postprocess",
      source: "question punctuation",
      target: "呀？",
    });
  }

  if (options.style === "casual" && next && !/[？。！啦喇呀啫]$/.test(next)) {
    next += casualEndings[next.length % casualEndings.length];
  }

  if (options.style === "polite" && next && !/^唔該/.test(next)) {
    if (/[？]$/.test(next)) {
      next = `唔該，${next}`;
    } else if (/^(攞|畀|幫|睇|等|講|話)/.test(next)) {
      next = `唔該${next}`;
    }
  }

  return { text: next, features };
}
