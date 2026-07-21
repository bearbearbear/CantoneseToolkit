import type {
  MatchedFeature,
  TemplateEntry,
  TranslationOptions,
} from "./schema";
import { sceneMatches } from "./phrase-matcher";

type CompiledTemplate = {
  entry: TemplateEntry;
  regex: RegExp;
  slotNames: string[];
};

export function compileTemplates(templates: TemplateEntry[]) {
  return templates
    .map((entry) => {
      const slotNames: string[] = [];
      const pattern = entry.source_pattern.replace(
        /\{([a-zA-Z0-9_]+)(?::[A-Z]+)?\}/g,
        (_match, name: string) => {
          slotNames.push(name);
          return "(.+?)";
        },
      );

      return {
        entry,
        regex: new RegExp(`^${escapeRegexExceptSlots(pattern)}$`),
        slotNames,
      };
    })
    .sort((left, right) => right.entry.priority - left.entry.priority);
}

export function matchTemplate(
  text: string,
  templates: CompiledTemplate[],
  scene: string,
  translateSlot: (slotText: string, options: TranslationOptions) => string,
  options: TranslationOptions,
) {
  for (const template of templates) {
    if (!sceneMatches(template.entry.scene, scene)) {
      continue;
    }

    const match = template.regex.exec(text);
    if (!match) {
      continue;
    }

    const slotValues = new Map<string, string>();
    template.slotNames.forEach((slotName, index) => {
      const sourceSlot = match[index + 1] || "";
      slotValues.set(slotName, translateSlot(sourceSlot, options));
    });

    const target = template.entry.target_pattern.replace(
      /\{([a-zA-Z0-9_]+)\}/g,
      (_match, name: string) => slotValues.get(name) || "",
    );
    const feature: MatchedFeature = {
      id: template.entry.id,
      kind: "template",
      source: template.entry.source_pattern,
      target: template.entry.target_pattern,
    };

    return { target, feature };
  }

  return null;
}

function escapeRegexExceptSlots(pattern: string) {
  return pattern
    .replace(/[|\\{}()[\]^$+*?.]/g, "\\$&")
    .replace(/\\\(\\.\\\+\\\?\\\)/g, "(.+?)");
}
