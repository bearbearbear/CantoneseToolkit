"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import conversionRuleData from "./data/cantonese-conversion-rules.json";
import pronunciationData from "./data/cantonese-pronunciation-table.json";

type ConversionEngine = "rule" | "natural";
type StyleMode = "standard" | "casual" | "polite";
type RomanizationScheme = "jyutping" | "textbook" | "yale" | "education";
type OfflineStatus = "checking" | "ready" | "unsupported";

type SchemeDetail = {
  initials: string;
  finals: string;
  tones: string;
  examples: string[];
};

type TextRule = [string, string];

type NaturalPolishRuleData = {
  pattern: string;
  flags: string;
  replacement: string;
};

type ConversionRuleData = {
  phraseRules: TextRule[];
  politeRules: TextRule[];
  naturalPolishRules: NaturalPolishRuleData[];
  hongKongPhraseNormalizations: TextRule[];
  hongKongCharacterMap: Record<string, string>;
};

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

const schemeDetails: Record<RomanizationScheme, SchemeDetail> = {
  jyutping: {
    initials: "以 b/p/m/f、d/t/n/l、g/k/ng/h、gw/kw/w、z/c/s、j 表示粤语声母，零声母直接写韵母。",
    finals: "保留 aa、eoi、oe、yu、ng、m 等粤语核心韵母，长短元音区分清楚。",
    tones: "使用 1-6 数字声调：1 阴平、2 阴上、3 阴去、4 阳平、5 阳上、6 阳去；入声并入 1/3/6。",
    examples: ["香港 hoeng1 gong2", "广东话 gwong2 dung1 waa2"],
  },
  textbook: {
    initials: "按教材写法使用 j/q/x 对应 Jyutping 的 z/c/s，gu/ku 对应 gw/kw，y 对应 j 或零声母。",
    finals: "常把 aa 写作 a，oe/eo 写作 ê，eoi 写作 êu，yu 写作 ü，入声尾 -p/-t/-k 写作 -b/-d/-g。",
    tones: "用上标 ¹²³⁴⁵⁶ 标在音节后，声调类别与 1-6 调相同。",
    examples: ["香港 hêng¹ gong²", "广东话 guong² dung¹ wa²"],
  },
  yale: {
    initials: "使用 j/ch/s、gw/kw、ng 等英文学习者较熟悉的拼法，jyu 类音节可写 jy 或 yu。",
    finals: "用 aai、eung、eui、eu、yu 等韵母拼写，与 Jyutping 便于逐项对照。",
    tones: "这里采用数字式 Yale，音节后标 1-6，方便和 Jyutping 同屏比较。",
    examples: ["香港 heung1 gong2", "广东话 gwong2 dung1 wa2"],
  },
  education: {
    initials: "教院拼音常用 dz/ts 对应 Jyutping 的 z/c，并保留 gw/kw、j、ng 等声母。",
    finals: "把 eoi 写作 oey，yu 写作 y，oe 保留为 oe；其他韵母多与 Jyutping 接近。",
    tones: "舒声多用 ¹²³⁴⁵⁶；入声按韵尾另标 ⁷⁸⁹，对应高、中、低入声。",
    examples: ["香港 hoeng¹ gong²", "广东话 gwong² dung¹ waa²"],
  },
};

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
const offlineCacheName = "cantonese-tool-offline-v3";

const samples = [
  "我今天不想上班，能不能明天再说？",
  "你们现在在哪里？我想去吃点东西。",
  "这个东西很好看，但是有点贵。",
  "请问去地铁站怎么走？",
];

const conversionRulesData = conversionRuleData as ConversionRuleData;
const phraseRules = conversionRulesData.phraseRules;
const politeRules = conversionRulesData.politeRules;
const hongKongPhraseNormalizations =
  conversionRulesData.hongKongPhraseNormalizations;
const hongKongCharacterMap = conversionRulesData.hongKongCharacterMap;

const casualEndings = ["啦", "喇", "啫", "呀"];

const engineLabels: Record<ConversionEngine, string> = {
  rule: "规则版",
  natural: "自然版",
};

const engineNotes: Record<ConversionEngine, string> = {
  rule: "规则版使用固定词表和替换规则，结果更稳定，适合对照学习。",
  natural: "自然版会在规则结果上做一层本地口语润色，后续可继续接入大模型增强。",
};

const modeLabels: Record<StyleMode, string> = {
  standard: "标准",
  casual: "口语",
  polite: "礼貌",
};

const naturalPolishRules = conversionRulesData.naturalPolishRules.map(
  ({ pattern, flags, replacement }) =>
    [new RegExp(pattern, flags), replacement] as const,
);

function applyRules(text: string, rules: TextRule[]) {
  return [...rules]
    .sort(([left], [right]) => right.length - left.length)
    .reduce((next, [from, to]) => next.split(from).join(to), text);
}

function cleanInputText(text: string) {
  return text.trim().replace(/[；;]/g, "，").replace(/\s+/g, "");
}

function normalizeHongKongText(text: string) {
  const phraseNormalized = applyRules(text, hongKongPhraseNormalizations);
  return Array.from(phraseNormalized)
    .map((character) => hongKongCharacterMap[character] || character)
    .join("");
}

function compileRules(rules: TextRule[]) {
  const normalizedRules = rules.map(([from, to]) => [
    normalizeHongKongText(from),
    normalizeHongKongText(to),
  ]) as TextRule[];
  return [...rules, ...normalizedRules];
}

const conversionRules = compileRules(phraseRules);
const politenessRules = compileRules(politeRules);

function applyNaturalPolish(text: string) {
  return naturalPolishRules.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    text,
  );
}

function tidyCantonese(text: string, engine: ConversionEngine, mode: StyleMode) {
  let result = normalizeHongKongText(cleanInputText(text));
  result = applyRules(result, conversionRules);
  result = result
    .replace(/的/g, "嘅")
    .replace(/不(?![过過])/g, "唔")
    .replace(/[没沒]/g, "冇");
  result = result.replace(/([？?])$/g, "？");
  result = result.replace(/([。!！])$/g, "。");

  if (engine === "natural") {
    result = applyNaturalPolish(result);
  }

  if (mode === "casual" && result && !/[？?。！!啦喇呀啫]$/.test(result)) {
    result += casualEndings[result.length % casualEndings.length];
  }

  if (mode === "polite") {
    result = applyRules(result, politenessRules);
    if (!/^唔[该該]/.test(result) && /[？?]$/.test(result)) {
      result = `唔該，${result}`;
    }
  }

  result = normalizeHongKongText(result);

  return result || "喺左邊輸入中文，我會幫你轉成粵語。";
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

function getOfflineResourceUrls() {
  if (typeof window === "undefined") {
    return [];
  }

  const appBaseUrl = new URL(".", document.baseURI);
  const appResourceUrl = (path: string) =>
    new URL(path.replace(/^\//, ""), appBaseUrl).href;
  const urls = new Set<string>([
    appBaseUrl.href,
    window.location.href,
    appResourceUrl("manifest.webmanifest"),
    appResourceUrl("favicon.svg"),
    appResourceUrl("apple-touch-icon.png"),
    appResourceUrl("icon-192.png"),
    appResourceUrl("icon-512.png"),
    appResourceUrl("sw.js"),
  ]);

  for (const entry of window.performance.getEntriesByType("resource")) {
    const resource = entry as PerformanceResourceTiming;
    try {
      const url = new URL(resource.name);
      if (
        url.origin === window.location.origin &&
        ["script", "link", "css", "fetch"].includes(resource.initiatorType)
      ) {
        urls.add(url.href);
      }
    } catch {
      // Ignore browser-generated resource names that are not URLs.
    }
  }

  return Array.from(urls);
}

async function cacheOfflineResources() {
  if (typeof window === "undefined" || !("caches" in window)) {
    return;
  }

  const cache = await window.caches.open(offlineCacheName);
  const urls = getOfflineResourceUrls();
  await Promise.allSettled(
    urls.map((url) => cache.add(new Request(url, { cache: "reload" }))),
  );
}

async function clearLocalPreviewOfflineResources() {
  if (typeof window === "undefined") {
    return;
  }

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map((registration) => registration.unregister()),
    );
  }

  if ("caches" in window) {
    const cacheKeys = await window.caches.keys();
    await Promise.all(
      cacheKeys
        .filter((key) => key.startsWith("cantonese-tool-offline-"))
        .map((key) => window.caches.delete(key)),
    );
  }
}

export default function Home() {
  const [input, setInput] = useState(samples[0]);
  const [engine, setEngine] = useState<ConversionEngine>("rule");
  const [mode, setMode] = useState<StyleMode>("standard");
  const [scheme, setScheme] = useState<RomanizationScheme>("jyutping");
  const [schemeGuide, setSchemeGuide] =
    useState<RomanizationScheme>("jyutping");
  const [offlineStatus, setOfflineStatus] = useState<OfflineStatus>("checking");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const closeSettingsButtonRef = useRef<HTMLButtonElement>(null);
  const standardizedInput = useMemo(
    () => normalizeHongKongText(cleanInputText(input)),
    [input],
  );
  const cantonese = useMemo(
    () => tidyCantonese(input, engine, mode),
    [engine, input, mode],
  );
  const pronunciation = useMemo(() => splitPronunciation(cantonese), [cantonese]);
  const activeSchemeDetail = schemeDetails[schemeGuide];

  useEffect(() => {
    let cancelled = false;

    async function prepareOfflineMode() {
      const isLocalPreview =
        typeof window !== "undefined" &&
        ["localhost", "127.0.0.1"].includes(window.location.hostname);

      if (isLocalPreview) {
        try {
          await clearLocalPreviewOfflineResources();
        } finally {
          if (!cancelled) {
            setOfflineStatus("unsupported");
          }
        }
        return;
      }

      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("caches" in window)
      ) {
        if (!cancelled) {
          setOfflineStatus("unsupported");
        }
        return;
      }

      try {
        const appBaseUrl = new URL(".", document.baseURI);
        await navigator.serviceWorker.register(new URL("sw.js", appBaseUrl), {
          scope: appBaseUrl.pathname,
        });
        await navigator.serviceWorker.ready;
        await cacheOfflineResources();
        if (!cancelled) {
          setOfflineStatus("ready");
        }
      } catch {
        if (!cancelled) {
          setOfflineStatus("unsupported");
        }
      }
    }

    prepareOfflineMode();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSettingsOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    closeSettingsButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
      previouslyFocused?.focus();
    };
  }, [settingsOpen]);

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-kicker">
            <p className="eyebrow">Mandarin to Cantonese</p>
          </div>
          <h1>中文转地道粤语</h1>
          <p className="intro">
            输入普通话中文，快速得到更像香港日常说法的粤语表达、可切换的粤语拼音标注，并可直接朗读。
          </p>
          <p className="settings-summary" aria-label="当前设置">
            <span>{engineLabels[engine]}</span>
            <span>{modeLabels[mode]}</span>
            <span>{schemeNames[scheme]}</span>
          </p>
        </div>
        <div className="hero-actions" aria-label="示例">
          {samples.map((sample) => (
            <button key={sample} type="button" onClick={() => setInput(sample)}>
              {sample.slice(0, 8)}...
            </button>
          ))}
        </div>
        <button
          type="button"
          className="settings-button"
          aria-haspopup="dialog"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen(true)}
        >
          设置
        </button>
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
          {standardizedInput && standardizedInput !== cleanInputText(input) && (
            <div className="standardization-preview" aria-live="polite">
              <span>香港字形</span>
              <b>{standardizedInput}</b>
            </div>
          )}
        </div>

        <div className="panel output-panel">
          <div className="panel-heading">
            <div>
              <p className="label">输出</p>
              <h2>粤语表达</h2>
              <span className="panel-meta">{schemeNames[scheme]}</span>
            </div>
            <button type="button" className="speak-button" onClick={() => speak(cantonese)}>
              发音
            </button>
          </div>
          <p className="cantonese-output">{cantonese}</p>
          <div className="jyutping-box" aria-label="粤拼标注">
            {pronunciation.map((unit, index) => {
              const reading = getReading(unit.readings, scheme);

              if (!unit.readings) {
                return (
                  <span className="punctuation" key={`${unit.text}-${index}`}>
                    {unit.text}
                  </span>
                );
              }

              return (
                <button
                  type="button"
                  className="jyutping-unit"
                  key={`${unit.text}-${index}`}
                  aria-label={`朗读 ${unit.text}，${reading}`}
                  title="单独发音"
                  onClick={() => speak(unit.text)}
                >
                  <b>{unit.text}</b>
                  <small>{reading}</small>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="notes" aria-label="说明">
        <div>
          <strong>{schemeNames[scheme]} · 完整读音数据</strong>
          <span>
            {schemeNotes[scheme]} 数据集含{" "}
            {pronunciationData.metadata.characterCount.toLocaleString()} 个汉字读音。
          </span>
        </div>
        <div>
          <strong>发音取决于浏览器语音。</strong>
          <span>系统如有粤语或香港中文语音，会优先使用；否则回退到中文语音。</span>
        </div>
        <div>
          <strong>离线状态</strong>
          <span>
            {offlineStatus === "ready"
              ? "已保存到本机。之后断网再打开这个地址，也可以继续转换和查看粤拼。"
              : offlineStatus === "checking"
                ? "正在保存页面和读音数据，首次打开需要联网。"
                : "当前浏览器不支持离线缓存，或需要先用 HTTPS 打开一次。"}
          </span>
        </div>
      </section>

      <div
        className={`settings-layer ${settingsOpen ? "open" : ""}`}
        hidden={!settingsOpen}
        aria-hidden={!settingsOpen}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setSettingsOpen(false);
          }
        }}
      >
        <section
          className="settings-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
        >
          <header className="settings-heading">
            <div>
              <p className="label">偏好设置</p>
              <h2 id="settings-title">转换设置</h2>
            </div>
            <button
              ref={closeSettingsButtonRef}
              type="button"
              className="close-settings-button"
              aria-label="关闭设置"
              onClick={() => setSettingsOpen(false)}
            >
              ×
            </button>
          </header>

          <div className="settings-body">
            <fieldset className="settings-group">
              <legend>转换引擎</legend>
              <p>{engineNotes[engine]}</p>
              <div className="setting-options two-columns">
                {(Object.keys(engineLabels) as ConversionEngine[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={engine === item ? "active" : ""}
                    aria-pressed={engine === item}
                    onClick={() => setEngine(item)}
                  >
                    {engineLabels[item]}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="settings-group">
              <legend>表达风格</legend>
              <p>控制转换结果的语气，输入仍会先统一为香港繁体字形。</p>
              <div className="setting-options three-columns">
                {(Object.keys(modeLabels) as StyleMode[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={mode === item ? "active" : ""}
                    aria-pressed={mode === item}
                    onClick={() => setMode(item)}
                  >
                    {modeLabels[item]}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="settings-group">
              <legend>输出拼音方案</legend>
              <p>{schemeNotes[scheme]}</p>
              <div className="setting-options scheme-options">
                {(Object.keys(schemeNames) as RomanizationScheme[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={scheme === item ? "active" : ""}
                    aria-pressed={scheme === item}
                    aria-controls="scheme-guide"
                    onFocus={() => setSchemeGuide(item)}
                    onClick={() => {
                      setScheme(item);
                      setSchemeGuide(item);
                    }}
                  >
                    {schemeNames[item]}
                  </button>
                ))}
              </div>
              <div className="scheme-guide" id="scheme-guide" aria-live="polite">
                <div className="scheme-guide-heading">
                  <span>方案解释</span>
                  <strong>{schemeNames[schemeGuide]}</strong>
                </div>
                <dl>
                  <div>
                    <dt>声母</dt>
                    <dd>{activeSchemeDetail.initials}</dd>
                  </div>
                  <div>
                    <dt>韵母</dt>
                    <dd>{activeSchemeDetail.finals}</dd>
                  </div>
                  <div>
                    <dt>声调</dt>
                    <dd>{activeSchemeDetail.tones}</dd>
                  </div>
                  <div>
                    <dt>示例</dt>
                    <dd>
                      {activeSchemeDetail.examples.map((example) => (
                        <code key={example}>{example}</code>
                      ))}
                    </dd>
                  </div>
                </dl>
              </div>
            </fieldset>
          </div>

          <footer className="settings-footer">
            <p>{engineLabels[engine]} · {modeLabels[mode]} · {schemeNames[scheme]}</p>
            <button type="button" onClick={() => setSettingsOpen(false)}>
              完成
            </button>
          </footer>
        </section>
      </div>
    </main>
  );
}
