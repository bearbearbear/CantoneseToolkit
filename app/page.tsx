"use client";

import { useMemo, useState } from "react";
import pronunciationData from "./data/cantonese-pronunciation-table.json";

type ConversionEngine = "rule" | "natural";
type StyleMode = "standard" | "casual" | "polite";
type RomanizationScheme = "jyutping" | "textbook" | "yale" | "education";

type JyutpingUnit = {
  text: string;
  readings: Partial<Record<RomanizationScheme, string[]>> | null;
};

const schemes = pronunciationData.schemes as Record<
  RomanizationScheme,
  { label: string; description: string }
>;

const schemeNames = Object.fromEntries(
  Object.entries(schemes).map(([key, value]) => [key, value.label]),
) as Record<RomanizationScheme, string>;

const schemeNotes = Object.fromEntries(
  Object.entries(schemes).map(([key, value]) => [key, value.description]),
) as Record<RomanizationScheme, string>;

const characterReadings = pronunciationData.characters as Record<
  string,
  Partial<Record<RomanizationScheme, string[]>>
>;
const phraseReadings = pronunciationData.phrases as Record<
  string,
  Partial<Record<RomanizationScheme, string[]>>
>;
const pronunciationPhraseKeys = Object.keys(phraseReadings).sort(
  (a, b) => b.length - a.length,
);

const samples = [
  "我今天不想上班，能不能明天再说？",
  "你们现在在哪里？我想去吃点东西。",
  "这个东西很好看，但是有点贵。",
  "请问去地铁站怎么走？",
];

const phraseRules: Array<[string, string]> = [
  ["为什么", "点解"],
  ["怎么样", "点样"],
  ["怎么办", "点算"],
  ["怎么走", "点行"],
  ["怎么", "点"],
  ["什么", "咩"],
  ["什么时候", "几时"],
  ["吃点东西", "食啲嘢"],
  ["多少钱", "几多钱"],
  ["在哪里", "喺边度"],
  ["去哪儿", "去边"],
  ["去哪里", "去边"],
  ["有没有", "有冇"],
  ["能不能", "可唔可以"],
  ["可以吗", "得唔得"],
  ["不是", "唔係"],
  ["没有", "冇"],
  ["不会", "唔会"],
  ["不要", "唔好"],
  ["不知道", "唔知"],
  ["不想", "唔想"],
  ["不用", "唔使"],
  ["今天", "今日"],
  ["明天", "听日"],
  ["昨天", "寻日"],
  ["现在", "而家"],
  ["刚才", "头先"],
  ["等一下", "等阵"],
  ["一会儿", "阵间"],
  ["这里", "呢度"],
  ["那里", "嗰度"],
  ["这个", "呢个"],
  ["那个", "嗰个"],
  ["这条", "呢条"],
  ["这", "呢"],
  ["这些", "呢啲"],
  ["那些", "嗰啲"],
  ["我们", "我哋"],
  ["你们", "你哋"],
  ["他们", "佢哋"],
  ["她们", "佢哋"],
  ["它们", "佢哋"],
  ["我的", "我嘅"],
  ["你的", "你嘅"],
  ["他的", "佢嘅"],
  ["她的", "佢嘅"],
  ["很", "好"],
  ["非常", "好"],
  ["有点", "有啲"],
  ["东西", "嘢"],
  ["很好看", "好靓"],
  ["但是", "不过"],
  ["也", "都"],
  ["请问", "唔该"],
  ["地铁站", "港铁站"],
  ["上班", "返工"],
  ["一点", "少少"],
  ["真的", "真係"],
  ["觉得", "觉得"],
  ["想要", "想"],
  ["喜欢", "钟意"],
  ["知道", "知"],
  ["说", "讲"],
  ["看", "睇"],
  ["吃", "食"],
  ["喝", "饮"],
  ["买", "买"],
  ["给", "畀"],
  ["找", "搵"],
  ["走", "行"],
  ["去", "去"],
  ["来", "嚟"],
  ["在", "喺"],
  ["是", "係"],
  ["了", "咗"],
  ["吗", "啊"],
  ["呢", "呢"],
  ["普通话", "普通话"],
  ["广东话", "广东话"],
];

const politeRules: Array<[string, string]> = [
  ["可唔可以", "可唔可以麻烦你"],
  ["唔该", "唔该晒"],
  ["点行", "点样行"],
];

const casualEndings = ["啦", "喇", "啫", "呀"];

const engineLabels: Record<ConversionEngine, string> = {
  rule: "规则版",
  natural: "自然版",
};

const engineNotes: Record<ConversionEngine, string> = {
  rule: "规则版使用固定词表和替换规则，结果更稳定，适合对照学习。",
  natural: "自然版会在规则结果上做一层本地口语润色，后续可继续接入大模型增强。",
};

const naturalPolishRules: Array<[RegExp, string]> = [
  [/好靓，不过有啲贵/g, "几靓，不过有少少贵"],
  [/喺边度？/g, "喺边度呀？"],
  [/点行？/g, "点行呀？"],
  [/得唔得？/g, "得唔得呀？"],
  [/可唔可以([^，。！？]*)？/g, "可唔可以$1呀？"],
];

function applyRules(text: string, rules: Array<[string, string]>) {
  return [...rules]
    .sort(([left], [right]) => right.length - left.length)
    .reduce((next, [from, to]) => next.split(from).join(to), text);
}

function applyNaturalPolish(text: string) {
  return naturalPolishRules.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    text,
  );
}

function tidyCantonese(text: string, engine: ConversionEngine, mode: StyleMode) {
  let result = text.trim();
  result = result.replace(/[；;]/g, "，").replace(/\s+/g, "");
  result = applyRules(result, phraseRules);
  result = result
    .replace(/的/g, "嘅")
    .replace(/不(?!过)/g, "唔")
    .replace(/没/g, "冇");
  result = result.replace(/([？?])$/g, "？");
  result = result.replace(/([。!！])$/g, "。");

  if (engine === "natural") {
    result = applyNaturalPolish(result);
  }

  if (mode === "casual" && result && !/[？?。！!啦喇呀啫]$/.test(result)) {
    result += casualEndings[result.length % casualEndings.length];
  }

  if (mode === "polite") {
    result = applyRules(result, politeRules);
    if (!result.startsWith("唔该") && /[？?]$/.test(result)) {
      result = `唔该，${result}`;
    }
  }

  return result || "喺左边输入中文，我会帮你转成粤语。";
}

function splitPronunciation(text: string): JyutpingUnit[] {
  const units: JyutpingUnit[] = [];
  let index = 0;

  while (index < text.length) {
    const matched = pronunciationPhraseKeys.find((key) =>
      text.startsWith(key, index),
    );
    if (matched) {
      units.push({ text: matched, readings: phraseReadings[matched] });
      index += matched.length;
      continue;
    }

    const char = text[index];
    if (/[\s，。！？,.!?]/.test(char)) {
      units.push({ text: char, readings: null });
    } else {
      units.push({ text: char, readings: characterReadings[char] || null });
    }
    index += 1;
  }

  return units;
}

function getReading(
  readings: Partial<Record<RomanizationScheme, string[]>> | null,
  scheme: RomanizationScheme,
) {
  return readings?.[scheme]?.[0] || readings?.jyutping?.[0] || "?";
}

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  utterance.voice =
    voices.find((voice) => voice.lang.toLowerCase().includes("yue")) ||
    voices.find((voice) => voice.lang.toLowerCase() === "zh-hk") ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith("zh"));
  utterance.lang = utterance.voice?.lang || "zh-HK";
  utterance.rate = 0.86;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

export default function Home() {
  const [input, setInput] = useState(samples[0]);
  const [engine, setEngine] = useState<ConversionEngine>("rule");
  const [mode, setMode] = useState<StyleMode>("standard");
  const [scheme, setScheme] = useState<RomanizationScheme>("jyutping");
  const cantonese = useMemo(
    () => tidyCantonese(input, engine, mode),
    [engine, input, mode],
  );
  const pronunciation = useMemo(() => splitPronunciation(cantonese), [cantonese]);

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Mandarin to Cantonese</p>
          <h1>中文转地道粤语</h1>
          <p className="intro">
            输入普通话中文，快速得到更像香港日常说法的粤语表达、可切换的粤语拼音标注，并可直接朗读。
          </p>
        </div>
        <div className="hero-actions" aria-label="示例">
          {samples.map((sample) => (
            <button key={sample} type="button" onClick={() => setInput(sample)}>
              {sample.slice(0, 8)}...
            </button>
          ))}
        </div>
      </section>

      <section className="tool-grid" aria-label="粤语转换工具">
        <div className="panel input-panel">
          <div className="panel-heading">
            <div>
              <p className="label">输入</p>
              <h2>普通话中文</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => setInput("")}>
              清空
            </button>
          </div>
          <textarea
            aria-label="输入要转换的中文"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="例如：你们现在在哪里？我想去吃点东西。"
          />
          <div className="control-group">
            <p className="control-label">转换引擎</p>
            <div className="engine-row" aria-label="转换引擎">
              {(Object.keys(engineLabels) as ConversionEngine[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={engine === item ? "active" : ""}
                  onClick={() => setEngine(item)}
                >
                  {engineLabels[item]}
                </button>
              ))}
            </div>
          </div>
          <div className="control-group">
            <p className="control-label">表达风格</p>
            <div className="mode-row" aria-label="表达风格">
              <button
                type="button"
                className={mode === "standard" ? "active" : ""}
                onClick={() => setMode("standard")}
              >
                标准
              </button>
              <button
                type="button"
                className={mode === "casual" ? "active" : ""}
                onClick={() => setMode("casual")}
              >
                口语
              </button>
              <button
                type="button"
                className={mode === "polite" ? "active" : ""}
                onClick={() => setMode("polite")}
              >
                礼貌
              </button>
            </div>
          </div>
        </div>

        <div className="panel output-panel">
          <div className="panel-heading">
            <div>
              <p className="label">输出</p>
              <h2>粤语表达</h2>
            </div>
            <button type="button" className="speak-button" onClick={() => speak(cantonese)}>
              发音
            </button>
          </div>
          <div className="scheme-row" aria-label="粤拼方案">
            {(Object.keys(schemeNames) as RomanizationScheme[]).map((item) => (
              <button
                key={item}
                type="button"
                className={scheme === item ? "active" : ""}
                onClick={() => setScheme(item)}
              >
                {schemeNames[item]}
              </button>
            ))}
          </div>
          <p className="cantonese-output">{cantonese}</p>
          <div className="jyutping-box" aria-label="粤拼标注">
            {pronunciation.map((unit, index) => (
              <span
                className={unit.readings ? "jyutping-unit" : "punctuation"}
                key={`${unit.text}-${index}`}
              >
                <b>{unit.text}</b>
                {unit.readings && <small>{getReading(unit.readings, scheme)}</small>}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="notes" aria-label="说明">
        <div>
          <strong>当前引擎：{engineLabels[engine]}</strong>
          <span>{engineNotes[engine]}</span>
        </div>
        <div>
          <strong>当前方案：{schemeNames[scheme]}</strong>
          <span>
            {schemeNotes[scheme]} 数据集含{" "}
            {pronunciationData.metadata.characterCount.toLocaleString()} 个汉字读音。
          </span>
        </div>
        <div>
          <strong>发音取决于浏览器语音。</strong>
          <span>系统如有粤语或香港中文语音，会优先使用；否则回退到中文语音。</span>
        </div>
      </section>
    </main>
  );
}
