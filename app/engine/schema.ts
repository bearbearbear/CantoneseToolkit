export type Scene =
  | "general"
  | "basic"
  | "daily"
  | "dining"
  | "restaurant"
  | "shopping"
  | "transport"
  | "hotel"
  | "social"
  | "work"
  | "medical"
  | "time"
  | "location";

export type Variant = "hong-kong" | "hong_kong";

export type TranslateVariant = "hong-kong";

export type TranslationOptions = {
  scene?: Scene | "general";
  variant?: TranslateVariant;
  includeJyutping?: boolean;
  beamWidth?: number;
  style?: "standard" | "casual" | "polite";
};

export type PhraseEntry = {
  id: string;
  source: string;
  target: string;
  scene: string;
  subtype: string;
  register: string;
  variant: string;
  priority: number;
  match_mode: string;
  notes: string;
  review_status: string;
  provenance: string;
};

export type LexiconEntry = {
  id: string;
  source: string;
  target: string;
  pos: string;
  scene: string;
  priority: number;
  condition: string;
  flags: string;
  notes: string;
  review_status: string;
  provenance: string;
};

export type TransformStep = {
  type: string;
  slot?: string;
  marker?: string;
};

export type TemplateEntry = {
  id: string;
  source_pattern: string;
  target_pattern: string;
  source_patterns: string;
  target_patterns: string;
  slot_types: string;
  scene: string;
  intent: string;
  priority: number;
  transform_pipeline: string;
  constraints: string;
  identity_structure: string;
  example_source: string;
  example_target: string;
  notes: string;
  review_status: string;
  provenance: string;
};

export type RewriteRule = {
  id: string;
  stage: number;
  rule_type: string;
  source_pattern: string;
  target_pattern: string;
  condition: string;
  priority: number;
  example_source: string;
  example_target: string;
  notes: string;
  review_status: string;
  provenance: string;
};

export type RuntimeCore = {
  version: string;
  build_date: string;
  variant: string;
  source_language: string;
  target_language: string;
  phrases: PhraseEntry[];
  lexicon: LexiconEntry[];
  templates: TemplateEntry[];
  rules: RewriteRule[];
};

export type MatchedFeature = {
  id: string;
  kind: "phrase" | "template" | "rule" | "lexicon" | "postprocess";
  source: string;
  target: string;
};

export type TranslationCandidate = {
  target: string;
  score: number;
  confidence: number;
  matchedFeatures: MatchedFeature[];
  warnings: string[];
};

export type TranslationResult = {
  source: string;
  normalizedSource: string;
  target: string;
  confidence: number;
  matchedTemplate: string | null;
  matchedFeatures: MatchedFeature[];
  candidates: TranslationCandidate[];
  warnings: string[];
  dataVersion: string;
};
