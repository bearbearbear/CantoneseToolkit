import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const ocrPath = resolve(root, "resources/粤语初级教程_全文_OCR.md");
const s2hkPath = resolve(root, "app/engine/data/simplified-to-hongkong.json");
const outputDir = resolve(root, "resources/粤语初级教程_tests");
const ocr = readFileSync(ocrPath, "utf8");
const s2hk = JSON.parse(readFileSync(s2hkPath, "utf8"));
const hk2s = new Map();

for (const [simplified, traditional] of Object.entries(s2hk)) {
  if (!hk2s.has(traditional)) hk2s.set(traditional, simplified);
}

const chapters = [
  { key: "C02", label: "第一部分第2章 问候", start: 15, end: 27, scene: "social", file: "粤语初级教程_第二章_tests.csv", reviewed: true },
  { key: "C03", label: "第一部分第3章 打电话", start: 28, end: 40, scene: "social", file: "粤语初级教程_第三章_tests.csv", reviewed: true },
  { key: "C04", label: "第一部分第4章 约会", start: 41, end: 55, scene: "social", file: "粤语初级教程_第四章_tests.csv" },
  { key: "C05", label: "第一部分第5章 问路", start: 56, end: 68, scene: "transport", file: "粤语初级教程_第五章_tests.csv" },
  { key: "C06", label: "第一部分第6章 购物", start: 69, end: 81, scene: "shopping", file: "粤语初级教程_第六章_tests.csv" },
  { key: "C07", label: "第一部分第7章 交通", start: 82, end: 93, scene: "transport", file: "粤语初级教程_第七章_tests.csv" },
  { key: "C08", label: "第一部分第8章 天气", start: 94, end: 104, scene: "general", file: "粤语初级教程_第八章_tests.csv" },
  { key: "C09", label: "第一部分第9章 饮食", start: 105, end: 115, scene: "dining", file: "粤语初级教程_第九章_tests.csv" },
  { key: "P2C01", label: "第二部分第1章 农历新年", start: 116, end: 127, scene: "social", file: "粤语初级教程_第二部分_第一章_tests.csv" },
  { key: "P2C02", label: "第二部分第2章 喜庆祝贺", start: 128, end: 137, scene: "social", file: "粤语初级教程_第二部分_第二章_tests.csv" },
  { key: "P2C03", label: "第二部分第3章 茶餐厅", start: 138, end: 147, scene: "dining", file: "粤语初级教程_第二部分_第三章_tests.csv" },
  { key: "P2C04", label: "第二部分第4章 香港购物", start: 148, end: 157, scene: "shopping", file: "粤语初级教程_第二部分_第四章_tests.csv" },
  { key: "P2C05", label: "第二部分第5章 香港街区", start: 158, end: 167, scene: "general", file: "粤语初级教程_第二部分_第五章_tests.csv" },
  { key: "P2C06", label: "第二部分第6章 麦兜", start: 168, end: 177, scene: "general", file: "粤语初级教程_第二部分_第六章_tests.csv" },
  { key: "P2C07", label: "第二部分第7章 主题乐园", start: 178, end: 187, scene: "general", file: "粤语初级教程_第二部分_第七章_tests.csv" },
  { key: "P2C08", label: "第二部分第8章 郊游与海滩", start: 188, end: 195, scene: "general", file: "粤语初级教程_第二部分_第八章_tests.csv" },
];

const cantoneseMarkers = [
  "佢", "哋", "嘅", "喺", "唔", "冇", "啲", "嗰", "呢", "咗", "畀", "俾", "嚟", "嘢", "噉", "㗎", "喇", "囉", "噃", "吓", "攞", "揾", "搵", "睇", "啱", "嘞", "咩", "咁", "咪", "啩", "𠻹", "屋企", "而家", "乜嘢", "邊度", "幾時", "點樣", "細路", "返工", "埋單", "得閒", "好耐", "中意", "鍾意", "唔該", "梗係", "點解",
  "边个", "边度", "几时", "几多", "点样", "乜嘢",
];
const metaPattern = /^(?:#|[一二三四五六七八九十]+\s*(?:課文|生詞|詞彙|補充|重點|講解|練習|粵字|短文)|課文|生詞|微型會話|鬼馬詞語|香港話|普通話|説明|說明|注意|例：|釋|粵語|聲母|韻母|聲調|字例|對比|發音練習)/;
const explanatoryPattern = /(?:普通話對|普通话对|跟動詞連用|跟动词连用|用法|例子|結構|结构|表示|相當於|相当于|說法|说法|試用普通話|试用普通话|修飾語|修饰语|韻母|韵母|聲母|声母)/;
const suspiciousSourcePattern = /[\u3400-\u4dbf◎〇•]|(?:^|\s)[普粵粤]\s*/u;
const pages = new Map();
let currentPage = 0;

mkdirSync(outputDir, { recursive: true });

for (const rawLine of ocr.split(/\r?\n/)) {
  const pageMatch = rawLine.match(/^## PDF 第 (\d+) 页$/);
  if (pageMatch) {
    currentPage = Number(pageMatch[1]);
    pages.set(currentPage, []);
    continue;
  }
  if (currentPage) pages.get(currentPage).push(rawLine);
}

function chineseCount(value) {
  return (value.match(/[\p{Script=Han}]/gu) ?? []).length;
}

function latinCount(value) {
  return (value.match(/[A-Za-z]/g) ?? []).length;
}

function cantoneseScore(value) {
  return cantoneseMarkers.reduce((score, marker) => score + (value.includes(marker) ? 1 : 0), 0);
}

function cleanLine(raw) {
  let value = raw.trim().replace(/\s+/g, " ");
  value = value.replace(/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]\s*/, "");
  value = value.replace(/^（\d+）\s*/, "");
  value = value.replace(/^[甲乙丙丁]：\s*/, "");
  value = value.replace(/^(?:粵|粤|普)\s+(?=[\p{Script=Han}])/u, "");
  value = value.replace(/（[A-Za-z0-9'’^?+\-\s]+）/g, "");
  value = value.replace(/（(?:一|稍微|替)）/g, "");
  value = value.replace(/^[•Q嗯鼻台]\s*/, "");
  return value.replace(/\s+/g, "").trim();
}

function isTextLine(value) {
  if (!value || metaPattern.test(value) || explanatoryPattern.test(value)) return false;
  const han = chineseCount(value);
  if (han < 4 || value.length > 100) return false;
  if (latinCount(value) > han) return false;
  return true;
}

function simplify(value) {
  return [...value]
    .map((char) => hk2s.get(char) ?? char)
    .join("")
    .replaceAll("哪裹", "哪里")
    .replaceAll("説", "说")
    .replaceAll("遊", "游")
    .replaceAll("洩", "泄");
}

function sharedHanCount(left, right) {
  const rightChars = new Set(right.match(/[\p{Script=Han}]/gu) ?? []);
  return new Set(left.match(/[\p{Script=Han}]/gu) ?? []).intersection(rightChars).size;
}

function csv(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function extractChapter(chapter) {
  const candidates = [];
  for (let page = chapter.start; page <= chapter.end; page += 1) {
    const lines = (pages.get(page) ?? []).map(cleanLine).filter(isTextLine);
    for (let index = 0; index < lines.length - 1; index += 1) {
      const target = lines[index];
      const sourceTraditional = lines[index + 1];
      if (cantoneseScore(target) === 0 || cantoneseScore(sourceTraditional) !== 0) continue;
      const source = simplify(sourceTraditional);
      if (cantoneseScore(source) !== 0) continue;
      if (suspiciousSourcePattern.test(source) || explanatoryPattern.test(source)) continue;
      if (/\d/.test(source) || /\d/.test(target) || /^的/.test(source) || /^嘅/.test(target)) continue;
      const targetHan = chineseCount(target);
      const sourceHan = chineseCount(source);
      const ratio = targetHan / sourceHan;
      if (ratio < 0.65 || ratio > 1.6) continue;
      const sourceComplete = /[。！？?!；：吧了]$/.test(source);
      const targetComplete = /[。！？?!；：呀吖啦喇嘞囉噃㗎]$/.test(target);
      if (!sourceComplete || !targetComplete) continue;
      const shared = sharedHanCount(source, simplify(target));
      if (shared < 1 || (Math.min(sourceHan, targetHan) > 8 && shared < 2)) continue;
      if (target === sourceTraditional || simplify(target) === source) continue;
      candidates.push({ source, target, page });
    }
  }

  const seen = new Set();
  return candidates.filter(({ source, target }) => {
    const key = `${source}\u0000${target}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

for (const chapter of chapters) {
  const pairs = extractChapter(chapter);
  const rows = ["id,source,expected_target,scene,test_type,intent,required_features,forbidden_features,notes,status"];
  pairs.forEach((pair, index) => {
    const id = `BOOK-${chapter.key}-${String(index + 1).padStart(3, "0")}`;
    const note = `《粤语初级教程》${chapter.label}，PDF第${pair.page}页；OCR相邻对译抽取${chapter.reviewed ? "并复核" : ""}`;
    rows.push([id, pair.source, pair.target, chapter.scene, "exact_phrase", "textbook_bilingual_pair", "", "", note, chapter.reviewed ? "active" : "draft"].map(csv).join(","));
  });
  writeFileSync(resolve(outputDir, chapter.file), `${rows.join("\n")}\n`, "utf8");
  console.log(`${chapter.file}: ${pairs.length}`);
}
