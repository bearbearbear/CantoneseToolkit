import type {
  MatchedFeature,
  TemplateEntry,
  TransformStep,
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
      const slotTypes: string[] = [];

      // Record slots as placeholders, escape literals, then insert typed slot
      // regexes (unescaped). ADJ is short; the slot immediately before ADJ is
      // greedy so e.g. 以前瘦 does not split as 以|前瘦 (TPL-0058).
      const withPlaceholders = entry.source_pattern.replace(
        /\{([a-zA-Z0-9_]+)(?::([A-Za-z0-9_]+))?\}/g,
        (_match, name: string, type: string | undefined) => {
          slotNames.push(name);
          slotTypes.push((type || "").toUpperCase());
          return `\u0000SLOT${slotNames.length - 1}\u0000`;
        },
      );

      let pattern = escapeRegexLiterals(withPlaceholders);
      for (let index = 0; index < slotNames.length; index += 1) {
        const nextType = slotTypes[index + 1] || "";
        pattern = pattern.replace(
          `\u0000SLOT${index}\u0000`,
          slotRegexForType(slotTypes[index], nextType),
        );
      }

      return {
        entry,
        regex: new RegExp(`^${pattern}$`),
        slotNames,
      };
    })
    .sort((left, right) => right.entry.priority - left.entry.priority);
}

function slotRegexForType(type: string, nextType: string) {
  if (type === "ADJ") {
    return "([\u3400-\u9fff]{1,4})";
  }
  if (nextType === "ADJ") {
    return "(.+)";
  }
  return "(.+?)";
}

function escapeRegexLiterals(pattern: string) {
  // Escape regex metacharacters but leave slot placeholders intact.
  return pattern.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
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

    const target = applyTemplatePattern(
      template.entry.target_pattern,
      slotValues,
      parseTransformPipeline(template.entry.transform_pipeline),
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

function parseTransformPipeline(raw: string | undefined): TransformStep[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TransformStep[]) : [];
  } catch {
    return [];
  }
}

// Fills the target pattern's slots, honouring aspect_after_head steps that move
// an aspect marker (緊/咗) to sit right after the verb head of a slot value.
// Two pattern conventions are supported for the marker: baked after the slot
// ("{vp}緊") and slot modifier syntax ("{vp|progressive}").
function applyTemplatePattern(
  pattern: string,
  slotValues: Map<string, string>,
  pipeline: TransformStep[],
) {
  const aspectBySlot = new Map<string, string>();
  for (const step of pipeline) {
    if (step && step.type === "aspect_after_head" && step.slot && step.marker) {
      aspectBySlot.set(step.slot, step.marker);
    }
  }

  let normalized = pattern;
  for (const [slot, marker] of aspectBySlot) {
    normalized = normalized
      .replace(new RegExp(`\\{${slot}\\|[a-zA-Z0-9_]+\\}`, "g"), `{${slot}}`)
      .replace(new RegExp(`(\\{${slot}\\})${escapeLiteral(marker)}`, "g"), "$1");
  }

  return normalized.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, name: string) => {
    const value = slotValues.get(name) ?? "";
    const marker = aspectBySlot.get(name);
    return marker ? insertAspectAfterHead(value, marker) : value;
  });
}

function insertAspectAfterHead(value: string, marker: string) {
  const characters = Array.from(value);
  if (characters.length === 0) {
    return marker;
  }
  const [head, ...rest] = characters;
  return `${head}${marker}${rest.join("")}`;
}

function escapeLiteral(value: string) {
  return value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}
