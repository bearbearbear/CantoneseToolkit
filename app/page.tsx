"use client";

import { useMemo, useState } from "react";

type StyleMode = "natural" | "casual" | "polite";
type RomanizationScheme = "jyutping" | "textbook" | "yale";

type JyutpingUnit = {
  text: string;
  jyutping: string;
};

const schemeNames: Record<RomanizationScheme, string> = {
  jyutping: "Jyutping",
  textbook: "教材：广州话拼音",
  yale: "Yale 数字式",
};

const schemeNotes: Record<RomanizationScheme, string> = {
  jyutping: "香港语言学学会粤语拼音方案，使用 1-6 数字声调。",
  textbook:
    "《粤语初级教程》采用的广州话拼音方案，页面按教材示例使用 j/q/x、gu/ku 和上标声调。",
  yale: "常见英语学习者熟悉的 Yale 写法，这里保留数字声调方便对照。",
};

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
];

const politeRules: Array<[string, string]> = [
  ["可唔可以", "可唔可以麻烦你"],
  ["唔该", "唔该晒"],
  ["点行", "点样行"],
];

const casualEndings = ["啦", "喇", "啫", "呀"];

const phraseJyutping: Record<string, string> = {
  "点解": "dim2 gaai2",
  "点样": "dim2 joeng6",
  "点算": "dim2 syun3",
  "点行": "dim2 haang4",
  "点": "dim2",
  "咩": "me1",
  "几时": "gei2 si4",
  "几多钱": "gei2 do1 cin2",
  "喺边度": "hai2 bin1 dou6",
  "食啲嘢": "sik6 di1 je5",
  "去边": "heoi3 bin1",
  "有冇": "jau5 mou5",
  "可唔可以": "ho2 m4 ho2 ji5",
  "可唔可以麻烦你": "ho2 m4 ho2 ji5 maa4 faan4 nei5",
  "得唔得": "dak1 m4 dak1",
  "唔係": "m4 hai6",
  "冇": "mou5",
  "唔会": "m4 wui5",
  "唔好": "m4 hou2",
  "唔知": "m4 zi1",
  "唔想": "m4 soeng2",
  "唔使": "m4 sai2",
  "今日": "gam1 jat6",
  "听日": "ting1 jat6",
  "寻日": "cam4 jat6",
  "而家": "ji4 gaa1",
  "头先": "tau4 sin1",
  "等阵": "dang2 zan6",
  "阵间": "zan6 gaan1",
  "呢度": "ni1 dou6",
  "嗰度": "go2 dou6",
  "呢个": "ni1 go3",
  "嗰个": "go2 go3",
  "呢啲": "ni1 di1",
  "嗰啲": "go2 di1",
  "我哋": "ngo5 dei6",
  "你哋": "nei5 dei6",
  "佢哋": "keoi5 dei6",
  "我嘅": "ngo5 ge3",
  "你嘅": "nei5 ge3",
  "佢嘅": "keoi5 ge3",
  "好": "hou2",
  "有啲": "jau5 di1",
  "少少": "siu2 siu2",
  "真係": "zan1 hai6",
  "觉得": "gok3 dak1",
  "钟意": "zung1 ji3",
  "知": "zi1",
  "讲": "gong2",
  "睇": "tai2",
  "食": "sik6",
  "饮": "jam2",
  "买": "maai5",
  "畀": "bei2",
  "搵": "wan2",
  "行": "haang4",
  "去": "heoi3",
  "嚟": "lai4",
  "喺": "hai2",
  "係": "hai6",
  "咗": "zo2",
  "唔该晒": "m4 goi1 saai3",
  "唔该": "m4 goi1",
  "港铁站": "gong2 tit3 zaam6",
  "返工": "faan1 gung1",
  "不过": "bat1 gwo3",
  "好靓": "hou2 leng3",
  "嘢": "je5",
};

const charJyutping: Record<string, string> = {
  "我": "ngo5",
  "你": "nei5",
  "佢": "keoi5",
  "哋": "dei6",
  "嘅": "ge3",
  "今": "gam1",
  "日": "jat6",
  "听": "ting1",
  "寻": "cam4",
  "而": "ji4",
  "家": "gaa1",
  "喺": "hai2",
  "边": "bin1",
  "度": "dou6",
  "呢": "ni1",
  "嗰": "go2",
  "个": "go3",
  "啲": "di1",
  "好": "hou2",
  "冇": "mou5",
  "係": "hai6",
  "咗": "zo2",
  "啦": "laa1",
  "喇": "laa3",
  "呀": "aa3",
  "啊": "aa3",
  "啫": "ze1",
  "咩": "me1",
  "点": "dim2",
  "解": "gaai2",
  "样": "joeng6",
  "算": "syun3",
  "几": "gei2",
  "时": "si4",
  "多": "do1",
  "钱": "cin2",
  "可": "ho2",
  "以": "ji5",
  "麻": "maa4",
  "烦": "faan4",
  "得": "dak1",
  "会": "wui5",
  "使": "sai2",
  "想": "soeng2",
  "知": "zi1",
  "睇": "tai2",
  "讲": "gong2",
  "食": "sik6",
  "饮": "jam2",
  "买": "maai5",
  "畀": "bei2",
  "搵": "wan2",
  "行": "haang4",
  "去": "heoi3",
  "嚟": "lai4",
  "真": "zan1",
  "有": "jau5",
  "少": "siu2",
  "钟": "zung1",
  "意": "ji3",
  "贵": "gwai3",
  "平": "peng4",
  "靓": "leng3",
  "请": "cing2",
  "问": "man6",
  "唔": "m4",
  "该": "goi1",
  "晒": "saai3",
  "地": "dei6",
  "铁": "tit3",
  "站": "zaam6",
  "上": "soeng5",
  "班": "baan1",
  "再": "zoi3",
  "做": "zou6",
  "工": "gung1",
  "东": "dung1",
  "西": "sai1",
  "路": "lou6",
  "人": "jan4",
  "先": "sin1",
  "阵": "zan6",
  "间": "gaan1",
  "头": "tau4",
};

function applyRules(text: string, rules: Array<[string, string]>) {
  return rules.reduce((next, [from, to]) => next.split(from).join(to), text);
}

function tidyCantonese(text: string, mode: StyleMode) {
  let result = text.trim();
  result = result.replace(/[；;]/g, "，").replace(/\s+/g, "");
  result = applyRules(result, phraseRules);
  result = result.replace(/的/g, "嘅").replace(/不/g, "唔").replace(/没/g, "冇");
  result = result.replace(/([？?])$/g, "？");
  result = result.replace(/([。!！])$/g, "。");

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

function splitJyutping(text: string): JyutpingUnit[] {
  const keys = Object.keys(phraseJyutping).sort((a, b) => b.length - a.length);
  const units: JyutpingUnit[] = [];
  let index = 0;

  while (index < text.length) {
    const matched = keys.find((key) => text.startsWith(key, index));
    if (matched) {
      units.push({ text: matched, jyutping: phraseJyutping[matched] });
      index += matched.length;
      continue;
    }

    const char = text[index];
    if (/[\s，。！？,.!?]/.test(char)) {
      units.push({ text: char, jyutping: "" });
    } else {
      units.push({ text: char, jyutping: charJyutping[char] || "?" });
    }
    index += 1;
  }

  return units;
}

const superscriptTone: Record<string, string> = {
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
};

function splitSyllable(syllable: string) {
  const match = syllable.match(/^([a-z]+)([1-6])$/i);
  if (!match) {
    return { body: syllable, tone: "" };
  }

  return { body: match[1].toLowerCase(), tone: match[2] };
}

function convertInitial(
  body: string,
  scheme: RomanizationScheme,
): { initial: string; final: string } {
  const initials = [
    "ng",
    "gw",
    "kw",
    "b",
    "p",
    "m",
    "f",
    "d",
    "t",
    "n",
    "l",
    "g",
    "k",
    "h",
    "z",
    "c",
    "s",
    "j",
    "w",
  ];
  const initial = initials.find((item) => body.startsWith(item)) || "";
  let nextInitial = initial;

  if (scheme === "textbook") {
    const map: Record<string, string> = {
      z: "j",
      c: "q",
      s: "x",
      j: "y",
      gw: "gu",
      kw: "ku",
    };
    nextInitial = map[initial] || initial;
  }

  if (scheme === "yale") {
    const map: Record<string, string> = {
      z: "j",
      c: "ch",
      j: "y",
    };
    nextInitial = map[initial] || initial;
  }

  return { initial: nextInitial, final: body.slice(initial.length) };
}

function convertFinal(final: string, scheme: RomanizationScheme) {
  if (scheme === "textbook") {
    const map: Record<string, string> = {
      aa: "a",
      aai: "ai",
      aau: "ao",
      aam: "am",
      aan: "an",
      aang: "ang",
      aap: "ab",
      aat: "ad",
      aak: "ag",
      ai: "ei",
      au: "eo",
      am: "em",
      an: "en",
      ang: "eng",
      ap: "eb",
      at: "ed",
      ak: "eg",
      eoi: "êu",
      eon: "ên",
      eot: "êd",
      oeng: "êng",
      oek: "êg",
      oe: "ê",
      yuet: "üed",
      yun: "ün",
      yut: "üd",
      yu: "ü",
      ik: "ig",
      ek: "ég",
      et: "éd",
      ep: "éb",
      e: "é",
    };
    return map[final] || final;
  }

  if (scheme === "yale") {
    const map: Record<string, string> = {
      aa: "a",
      eoi: "eui",
      eon: "eun",
      eot: "eut",
      oe: "eu",
    };
    return map[final] || final;
  }

  return final;
}

function convertSyllable(syllable: string, scheme: RomanizationScheme) {
  if (scheme === "jyutping") {
    return syllable;
  }

  const { body, tone } = splitSyllable(syllable);
  const { initial, final } = convertInitial(body, scheme);
  const converted = `${initial}${convertFinal(final, scheme)}`;
  const toneMark = scheme === "textbook" ? superscriptTone[tone] : tone;
  return `${converted}${toneMark || ""}`;
}

function convertRomanization(value: string, scheme: RomanizationScheme) {
  return value
    .split(" ")
    .map((syllable) => convertSyllable(syllable, scheme))
    .join(" ");
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
  const [mode, setMode] = useState<StyleMode>("natural");
  const [scheme, setScheme] = useState<RomanizationScheme>("jyutping");
  const cantonese = useMemo(() => tidyCantonese(input, mode), [input, mode]);
  const jyutping = useMemo(() => splitJyutping(cantonese), [cantonese]);

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
          <div className="mode-row" aria-label="表达风格">
            <button
              type="button"
              className={mode === "natural" ? "active" : ""}
              onClick={() => setMode("natural")}
            >
              自然
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
            {jyutping.map((unit, index) => (
              <span
                className={unit.jyutping ? "jyutping-unit" : "punctuation"}
                key={`${unit.text}-${index}`}
              >
                <b>{unit.text}</b>
                {unit.jyutping && (
                  <small>{convertRomanization(unit.jyutping, scheme)}</small>
                )}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="notes" aria-label="说明">
        <div>
          <strong>当前方案：{schemeNames[scheme]}</strong>
          <span>{schemeNotes[scheme]}</span>
        </div>
        <div>
          <strong>发音取决于浏览器语音。</strong>
          <span>系统如有粤语或香港中文语音，会优先使用；否则回退到中文语音。</span>
        </div>
      </section>
    </main>
  );
}
