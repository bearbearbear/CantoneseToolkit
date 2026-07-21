import type { LexiconEntry, MatchedFeature, PhraseEntry } from "./schema";

type TrieNode<T> = {
  children: Map<string, TrieNode<T>>;
  entries: T[];
};

export type PhraseLikeEntry = {
  id: string;
  source: string;
  target: string;
  scene: string;
  priority: number;
  condition?: string;
};

export type TokenizedSegment = {
  source: string;
  target: string;
  entry: PhraseLikeEntry | null;
};

export function createTrie<T extends PhraseLikeEntry>(entries: T[]) {
  const root: TrieNode<T> = { children: new Map(), entries: [] };

  for (const entry of entries) {
    let node = root;
    for (const character of Array.from(entry.source)) {
      let child = node.children.get(character);
      if (!child) {
        child = { children: new Map(), entries: [] };
        node.children.set(character, child);
      }
      node = child;
    }
    node.entries.push(entry);
    node.entries.sort((left, right) => right.priority - left.priority);
  }

  return root;
}

export function findExactPhraseMatch(
  text: string,
  phrases: PhraseEntry[],
  scene: string,
) {
  const normalizedText = text.replace(/[。！？]$/, "");
  return [...phrases]
    .filter((entry) => sceneMatches(entry.scene, scene))
    .sort((left, right) => right.priority - left.priority)
    .find((entry) => {
      const normalizedSource = entry.source.replace(/[。！？]$/, "");
      return entry.source === text || normalizedSource === normalizedText;
    });
}

export function longestMatch(
  text: string,
  trie: TrieNode<PhraseLikeEntry>,
  index: number,
  scene: string,
) {
  let node = trie;
  let best: { end: number; entry: PhraseLikeEntry } | null = null;
  const characters = Array.from(text);

  for (let cursor = index; cursor < characters.length; cursor += 1) {
    const next = node.children.get(characters[cursor]);
    if (!next) {
      break;
    }
    node = next;

    const entry = node.entries.find(
      (item) =>
        sceneMatches(item.scene, scene) &&
        conditionSatisfied(item, characters, index, cursor + 1),
    );
    if (entry) {
      best = { end: cursor + 1, entry };
    }
  }

  return best;
}

const ABILITY_NOUN_BEFORE = new Set(
  Array.from("开開一兩两几幾這这那嗰待晚宴機机都工約约茶舞大盛協协商聚"),
);
const ABILITY_NOUN_AFTER = new Set(
  Array.from("議议員员場场所費费長长館馆展期"),
);
const ABILITY_SKILL_AFTER = new Set(
  Array.from("游講讲說说寫写唱跳揸煮彈弹畫画踢拼砌織织"),
);

// Only treat 会 / 不会 as the "know how to" sense when the surrounding context
// looks like an ability (a skill verb follows and it is not part of a 会-noun
// such as 开会 / 会议 / 机会). Otherwise fall through so it normalizes to 會.
function isLearnedSkillContext(
  characters: string[],
  start: number,
  end: number,
): boolean {
  const before = start > 0 ? characters[start - 1] : "";
  const after = end < characters.length ? characters[end] : "";

  if (before && ABILITY_NOUN_BEFORE.has(before)) {
    return false;
  }
  if (after && ABILITY_NOUN_AFTER.has(after)) {
    return false;
  }

  return after ? ABILITY_SKILL_AFTER.has(after) : false;
}

// Gate context-dependent lexicon senses (see the `condition` column). Unknown
// conditions default to applying so existing coverage is preserved.
export function conditionSatisfied(
  entry: PhraseLikeEntry,
  characters: string[],
  start: number,
  end: number,
): boolean {
  if (!entry.condition) {
    return true;
  }

  switch (entry.condition) {
    case "learned_skill":
      return isLearnedSkillContext(characters, start, end);
    default:
      return true;
  }
}

export function tokenizeByTrie(
  text: string,
  trie: TrieNode<PhraseLikeEntry>,
  scene: string,
) {
  const characters = Array.from(text);
  const segments: TokenizedSegment[] = [];
  let index = 0;

  while (index < characters.length) {
    const matched = longestMatch(text, trie, index, scene);

    if (matched) {
      const source = characters.slice(index, matched.end).join("");
      segments.push({
        source,
        target: matched.entry.target,
        entry: matched.entry,
      });
      index = matched.end;
      continue;
    }

    segments.push({
      source: characters[index],
      target: characters[index],
      entry: null,
    });
    index += 1;
  }

  return segments;
}

export function makePhraseLikeEntries(
  phrases: PhraseEntry[],
  lexicon: LexiconEntry[],
) {
  const phraseEntries = phrases
    .filter((entry) => entry.source.length > 1 && entry.source !== entry.target)
    .map((entry) => ({
      id: entry.id,
      source: entry.source.replace(/[。！？]$/, ""),
      target: entry.target.replace(/[。！？]$/, ""),
      scene: entry.scene,
      priority: entry.priority + 20,
    }));
  const lexiconEntries = lexicon
    .filter(
      (entry) =>
        entry.source &&
        entry.source !== entry.target &&
        !entry.flags.split("|").includes("passthrough_same_lexeme"),
    )
    .map((entry) => ({
      id: entry.id,
      source: entry.source,
      target: entry.target,
      scene: entry.scene,
      priority: entry.priority,
      condition: entry.condition,
    }));

  return [...phraseEntries, ...lexiconEntries].sort((left, right) => {
    const lengthDelta = right.source.length - left.source.length;
    return lengthDelta || right.priority - left.priority;
  });
}

export function segmentsToText(segments: TokenizedSegment[]) {
  return segments.map((segment) => segment.target).join("");
}

export function segmentFeatures(segments: TokenizedSegment[]): MatchedFeature[] {
  return segments
    .filter((segment) => segment.entry)
    .map((segment) => ({
      id: segment.entry!.id,
      kind: segment.entry!.id.startsWith("PHR-") ? "phrase" : "lexicon",
      source: segment.source,
      target: segment.target,
    }));
}

export function sceneMatches(entryScene: string, activeScene: string) {
  const entryScenes = entryScene.split("|");

  return (
    !activeScene ||
    activeScene === "general" ||
    entryScenes.includes("general") ||
    entryScenes.includes(activeScene)
  );
}
