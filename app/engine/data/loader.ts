import runtimeCoreData from "../../../resources/mandarin_cantonese_v1_1_1/runtime-core-v1.1.1.json";
import type { RuntimeCore } from "../schema";

let runtimeCore: RuntimeCore | null = null;

export function loadRuntimeCore() {
  if (!runtimeCore) {
    runtimeCore = normalizeRuntimeCore(runtimeCoreData as RuntimeCore);
  }

  return runtimeCore;
}

function normalizeRuntimeCore(core: RuntimeCore): RuntimeCore {
  return {
    ...core,
    phrases: core.phrases.map((entry) => ({
      ...entry,
      priority: Number(entry.priority),
    })),
    lexicon: core.lexicon.map((entry) => ({
      ...entry,
      priority: Number(entry.priority),
    })),
    templates: core.templates.map((entry) => ({
      ...entry,
      priority: Number(entry.priority),
    })),
    rules: core.rules.map((entry) => ({
      ...entry,
      stage: Number(entry.stage),
      priority: Number(entry.priority),
    })),
  };
}
