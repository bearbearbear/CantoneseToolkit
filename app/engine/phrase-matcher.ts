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

    const entry = node.entries.find((item) => sceneMatches(item.scene, scene));
    if (entry) {
      best = { end: cursor + 1, entry };
    }
  }

  return best;
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
