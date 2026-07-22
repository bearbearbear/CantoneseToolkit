import type { MatchedFeature, RewriteRule } from "./schema";

type StringRule = {
  id: string;
  pattern: string | RegExp;
  replacement: string;
};

const customRules: StringRule[] = [
  { id: "RUL-0006", pattern: "还没有", replacement: "仲未" },
  { id: "RUL-0003", pattern: "不是", replacement: "唔係" },
  { id: "RUL-0035", pattern: "不太", replacement: "唔係幾" },
  { id: "RUL-0015", pattern: "能不能", replacement: "可唔可以" },
  { id: "RUL-0016", pattern: "有没有", replacement: "有冇" },
  { id: "RUL-0017", pattern: "喜欢不喜欢", replacement: "鍾唔鍾意" },
  { id: "RUL-0023", pattern: "什么时候", replacement: "幾時" },
  { id: "RUL-0022", pattern: "在哪里", replacement: "喺邊度" },
  { id: "RUL-0022", pattern: "哪里", replacement: "邊度" },
  { id: "RUL-0020", pattern: "什么", replacement: "乜嘢" },
  { id: "RUL-0021", pattern: "谁", replacement: "邊個" },
  { id: "RUL-0024", pattern: "怎么", replacement: "點" },
  { id: "RUL-0025", pattern: "多少", replacement: "幾多" },
  { id: "RUL-0034", pattern: "有点", replacement: "有啲" },
  { id: "RUL-0039", pattern: "这么", replacement: "咁" },
  { id: "RUL-0038", pattern: "这么多", replacement: "咁多" },
  { id: "RUL-0053", pattern: "看一下", replacement: "睇下" },
  { id: "RUL-0055", pattern: "回来", replacement: "返嚟" },
  { id: "RUL-0056", pattern: "回家", replacement: "返屋企" },
  { id: "RUL-0057", pattern: "上班", replacement: "返工" },
  { id: "RUL-0058", pattern: "下班", replacement: "放工" },
  { id: "RUL-0059", pattern: "吃", replacement: "食" },
  { id: "RUL-0060", pattern: "喝", replacement: "飲" },
  { id: "RUL-0061", pattern: "看", replacement: "睇" },
  { id: "RUL-0062", pattern: "找", replacement: "搵" },
  { id: "RUL-0063", pattern: "拿", replacement: "攞" },
  { id: "RUL-0064", pattern: "走路", replacement: "行路" },
  { id: "RUL-0048", pattern: "在", replacement: "喺" },
  { id: "RUL-0004", pattern: "没有", replacement: "冇" },
  { id: "RUL-0001", pattern: /不(?!過|过|太|是)/g, replacement: "唔" },
  { id: "RUL-0065", pattern: /吧([。！？]?)/g, replacement: "啦$1" },
  { id: "RUL-0067", pattern: /我先([^，。！？]+)/g, replacement: "我$1先" },
];

// Plain (literal string) rule sources of length >= 2, gathered from both the
// built-in customRules and the data-driven direct rules. Used by the translator
// to decide when a longer rewrite rule should win over a shorter lexicon entry
// (true longest-match), preventing e.g. 不是→唔係 from shadowing 是不是→係咪.
export function getPlainRuleSources(rules: RewriteRule[]): string[] {
  const sources = new Set<string>();

  for (const rule of customRules) {
    if (typeof rule.pattern === "string" && Array.from(rule.pattern).length >= 2) {
      sources.add(rule.pattern);
    }
  }
  for (const rule of rules) {
    if (
      isDirectPattern(rule.source_pattern) &&
      Array.from(rule.source_pattern).length >= 2
    ) {
      sources.add(rule.source_pattern);
    }
  }

  return [...sources];
}

export function applyRewriteRules(text: string, rules: RewriteRule[]) {
  const features: MatchedFeature[] = [];
  let next = text;

  for (const rule of makeExecutableRules(rules)) {
    const before = next;
    next = replaceAll(next, rule.pattern, rule.replacement);
    if (before !== next) {
      features.push({
        id: rule.id,
        kind: "rule",
        source: patternToString(rule.pattern),
        target: rule.replacement,
      });
    }
  }

  return { text: next, features };
}

function makeExecutableRules(rules: RewriteRule[]) {
  const directRules = rules
    .filter((rule) => isDirectPattern(rule.source_pattern))
    .map((rule) => ({
      id: rule.id,
      pattern: rule.source_pattern,
      replacement: rule.target_pattern,
    }));

  return [
    ...customRules,
    ...directRules.sort((left, right) => {
      const leftPattern = patternToString(left.pattern);
      const rightPattern = patternToString(right.pattern);
      return rightPattern.length - leftPattern.length;
    }),
  ];
}

function isDirectPattern(pattern: string) {
  return !/[+|]/.test(pattern) && !/\b[A-Z][A-Z0-9_]*\b/.test(pattern);
}

function replaceAll(text: string, pattern: string | RegExp, replacement: string) {
  if (typeof pattern === "string") {
    return text.split(pattern).join(replacement);
  }

  return text.replace(pattern, replacement);
}

function patternToString(pattern: string | RegExp) {
  return typeof pattern === "string" ? pattern : pattern.source;
}
