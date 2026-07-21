import simplifiedToHongKong from "./data/simplified-to-hongkong.json";

const punctuationMap: Record<string, string> = {
  ",": "，",
  ";": "，",
  "；": "，",
  "?": "？",
  "!": "！",
  ".": "。",
};

// Full single-character simplified -> Hong Kong traditional table derived from
// OpenCC's STCharacters + HKVariants, with curated overrides for domain senses
// (e.g. 钟->鐘 clock, 说->說 HK form). See app/engine/data/simplified-to-hongkong.json.
const hongKongCharacterMap = simplifiedToHongKong as Record<string, string>;

export type ProtectedSlot = {
  token: string;
  value: string;
};

export type NormalizedInput = {
  source: string;
  text: string;
  displayText: string;
  slots: ProtectedSlot[];
};

export function cleanInputText(text: string) {
  return text
    .trim()
    .replace(/[，,；;]/g, (value) => punctuationMap[value] || value)
    .replace(/[?!\.]/g, (value) => punctuationMap[value] || value)
    .replace(/\s+/g, "");
}

export function normalizeHongKongText(text: string) {
  return Array.from(text)
    .map((character) => hongKongCharacterMap[character] || character)
    .join("");
}

export function normalizeInput(text: string): NormalizedInput {
  const cleaned = cleanInputText(text);
  const slots: ProtectedSlot[] = [];
  let next = cleaned.replace(
    /https?:\/\/[^\s，。！？]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\d{1,2}[:：]\d{2}|\d+(?:\.\d+)?(?:元|块|分鐘|分钟|點|点)?/g,
    (value) => {
      const token = `[SLOT_${slots.length}]`;
      slots.push({ token, value });
      return token;
    },
  );

  next = next.replace(/([，。！？])\1+/g, "$1");

  return {
    source: text,
    text: next,
    displayText: normalizeHongKongText(next),
    slots,
  };
}

export function restoreSlots(text: string, slots: ProtectedSlot[]) {
  return slots.reduce(
    (next, slot) => next.split(slot.token).join(slot.value),
    text,
  );
}
