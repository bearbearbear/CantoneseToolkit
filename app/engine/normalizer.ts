const punctuationMap: Record<string, string> = {
  ",": "，",
  ";": "，",
  "；": "，",
  "?": "？",
  "!": "！",
  ".": "。",
};

const hongKongCharacterMap: Record<string, string> = {
  们: "們",
  为: "為",
  么: "麼",
  什: "甚",
  样: "樣",
  办: "辦",
  钱: "錢",
  现: "現",
  哪: "哪",
  里: "裏",
  儿: "兒",
  没: "沒",
  会: "會",
  听: "聽",
  刚: "剛",
  阵: "陣",
  这: "這",
  个: "個",
  条: "條",
  东: "東",
  请: "請",
  问: "問",
  铁: "鐵",
  点: "點",
  觉: "覺",
  欢: "歡",
  钟: "鐘",
  说: "說",
  説: "說",
  讲: "講",
  饮: "飲",
  买: "買",
  给: "給",
  来: "來",
  吗: "嗎",
  话: "話",
  广: "廣",
  国: "國",
  语: "語",
  电: "電",
  车: "車",
  靓: "靚",
  贵: "貴",
  边: "邊",
  门: "門",
  网: "網",
  联: "聯",
  后: "後",
  着: "著",
  与: "與",
  对: "對",
  发: "發",
  头: "頭",
  间: "間",
  学: "學",
  师: "師",
  谢: "謝",
  题: "題",
  时: "時",
};

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
