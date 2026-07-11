import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const sourceZip = new URL("../work/data-source/Unihan.zip", import.meta.url);
const outputPath = new URL("../app/data/cantonese-pronunciation-table.json", import.meta.url);

const schemes = {
  jyutping: {
    label: "Jyutping",
    description: "香港语言学学会粤语拼音方案，使用 1-6 数字声调。",
  },
  textbook: {
    label: "教材：广州话拼音",
    description:
      "《粤语初级教程》采用的广州话拼音方案，按教材示例使用 j/q/x、gu/ku 和上标声调。",
  },
  yale: {
    label: "Yale 数字式",
    description: "Yale 粤语拼音的数字声调写法，便于与 Jyutping 对照。",
  },
  education: {
    label: "教院拼音",
    description:
      "教育学院拼音方案对照写法，使用 dz/ts、oey、y 等拼写，并以 7/8/9 表示入声调。",
  },
};

const phraseJyutping = {
  "点解": "dim2 gaai2",
  "点样": "dim2 joeng6",
  "点算": "dim2 syun3",
  "点行": "dim2 haang4",
  "点": "dim2",
  "咩": "me1",
  "几时": "gei2 si4",
  "几多钱": "gei2 do1 cin2",
  "喺边度": "hai2 bin1 dou6",
  "香港人": "hoeng1 gong2 jan4",
  "香港": "hoeng1 gong2",
  "广东话": "gwong2 dung1 waa2",
  "廣東話": "gwong2 dung1 waa2",
  "普通话": "pou2 tung1 waa2",
  "普通話": "pou2 tung1 waa2",
  "食啲嘢": "sik6 di1 je5",
  "去边": "heoi3 bin1",
  "有冇": "jau5 mou5",
  "可唔可以": "ho2 m4 ho2 ji5",
  "可唔可以麻烦你": "ho2 m4 ho2 ji5 maa4 faan4 nei5",
  "得唔得": "dak1 m4 dak1",
  "唔係": "m4 hai6",
  "唔会": "m4 wui5",
  "唔好": "m4 hou2",
  "唔知": "m4 zi1",
  "唔想": "m4 soeng2",
  "唔使": "m4 sai2",
  "今日": "gam1 jat6",
  "听日": "ting1 jat6",
  "聽日": "ting1 jat6",
  "寻日": "cam4 jat6",
  "尋日": "cam4 jat6",
  "而家": "ji4 gaa1",
  "头先": "tau4 sin1",
  "頭先": "tau4 sin1",
  "等阵": "dang2 zan6",
  "等陣": "dang2 zan6",
  "阵间": "zan6 gaan1",
  "陣間": "zan6 gaan1",
  "呢度": "ni1 dou6",
  "嗰度": "go2 dou6",
  "呢个": "ni1 go3",
  "呢個": "ni1 go3",
  "嗰个": "go2 go3",
  "嗰個": "go2 go3",
  "呢条": "ni1 tiu4",
  "呢條": "ni1 tiu4",
  "呢啲": "ni1 di1",
  "嗰啲": "go2 di1",
  "我哋": "ngo5 dei6",
  "你哋": "nei5 dei6",
  "佢哋": "keoi5 dei6",
  "我嘅": "ngo5 ge3",
  "你嘅": "nei5 ge3",
  "佢嘅": "keoi5 ge3",
  "有啲": "jau5 di1",
  "少少": "siu2 siu2",
  "真係": "zan1 hai6",
  "钟意": "zung1 ji3",
  "鐘意": "zung1 ji3",
  "唔该晒": "m4 goi1 saai3",
  "唔該晒": "m4 goi1 saai3",
  "唔该": "m4 goi1",
  "唔該": "m4 goi1",
  "港铁站": "gong2 tit3 zaam6",
  "港鐵站": "gong2 tit3 zaam6",
  "返工": "faan1 gung1",
  "不过": "bat1 gwo3",
  "不過": "bat1 gwo3",
  "好靓": "hou2 leng3",
  "好靚": "hou2 leng3",
  "多谢": "do1 ze6",
  "多謝": "do1 ze6",
  "早晨": "zou2 san4",
  "拜拜": "baai1 baai3",
  "问题": "man6 tai4",
  "問題": "man6 tai4",
  "朋友": "pang4 jau5",
  "电话": "din6 waa2",
  "電話": "din6 waa2",
  "时间": "si4 gaan3",
  "時間": "si4 gaan3",
  "地方": "dei6 fong1",
  "学校": "hok6 haau6",
  "學校": "hok6 haau6",
  "老师": "lou5 si1",
  "老師": "lou5 si1",
  "学生": "hok6 saang1",
  "學生": "hok6 saang1",
};

const superscriptTone = {
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

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

function splitSyllable(syllable) {
  const match = syllable.match(/^([a-z]+)([1-6])$/i);
  if (!match) {
    return { body: syllable, initial: "", final: syllable, tone: "" };
  }

  const body = match[1].toLowerCase();
  const initial = initials.find((item) => body.startsWith(item)) || "";
  return {
    body,
    initial,
    final: body.slice(initial.length),
    tone: match[2],
  };
}

function isChecked(final) {
  return /[ptk]$/.test(final);
}

function convertInitial(initial, scheme) {
  if (scheme === "textbook") {
    return (
      {
        z: "j",
        c: "q",
        s: "x",
        j: "y",
        gw: "gu",
        kw: "ku",
      }[initial] || initial
    );
  }

  if (scheme === "yale") {
    return (
      {
        z: "j",
        c: "ch",
        j: "y",
      }[initial] || initial
    );
  }

  if (scheme === "education") {
    return (
      {
        z: "dz",
        c: "ts",
      }[initial] || initial
    );
  }

  return initial;
}

function convertFinal(final, scheme) {
  if (scheme === "textbook") {
    return (
      {
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
      }[final] || final
    );
  }

  if (scheme === "yale") {
    return (
      {
        aa: "a",
        oeng: "eung",
        oek: "euk",
        eoi: "eui",
        eon: "eun",
        eot: "eut",
        oe: "eu",
      }[final] || final
    );
  }

  if (scheme === "education") {
    return (
      {
        eoi: "oey",
        eon: "oen",
        eot: "oet",
        eo: "oe",
        yu: "y",
        yun: "yn",
        yut: "yt",
      }[final] || final
    );
  }

  return final;
}

function convertTone(tone, final, scheme) {
  if (!tone || scheme === "jyutping" || scheme === "yale") {
    return tone;
  }

  let nextTone = tone;
  if (scheme === "education" && isChecked(final)) {
    nextTone = { "1": "7", "3": "8", "6": "9" }[tone] || tone;
  }

  return superscriptTone[nextTone] || nextTone;
}

function convertSyllable(syllable, scheme) {
  if (scheme === "jyutping") {
    return syllable;
  }

  const { initial, final, tone } = splitSyllable(syllable);
  const nextInitial =
    scheme === "yale" && initial === "j" && final.startsWith("yu")
      ? ""
      : convertInitial(initial, scheme);
  const converted = `${nextInitial}${convertFinal(final, scheme)}`;
  return `${converted}${convertTone(tone, final, scheme)}`;
}

function convertPronunciation(jyutping, scheme) {
  return jyutping
    .split(" ")
    .map((syllable) => convertSyllable(syllable, scheme))
    .join(" ");
}

function buildEntry(jyutpingReadings) {
  const uniqueReadings = [...new Set(jyutpingReadings)];
  return Object.fromEntries(
    Object.keys(schemes).map((scheme) => [
      scheme,
      uniqueReadings.map((reading) => convertPronunciation(reading, scheme)),
    ]),
  );
}

function readUnihanReadings() {
  return execFileSync("unzip", ["-p", sourceZip.pathname, "Unihan_Readings.txt"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

const characters = {};

for (const line of readUnihanReadings().split("\n")) {
  if (!line || line.startsWith("#") || !line.includes("\tkCantonese\t")) {
    continue;
  }

  const [codepoint, , value] = line.split("\t");
  const character = String.fromCodePoint(Number.parseInt(codepoint.slice(2), 16));
  characters[character] = buildEntry(value.trim().split(/\s+/));
}

const phrases = Object.fromEntries(
  Object.entries(phraseJyutping).map(([phrase, reading]) => [
    phrase,
    buildEntry([reading]),
  ]),
);

const data = {
  metadata: {
    generatedAt: new Date().toISOString(),
    sourceName: "Unicode Unihan kCantonese",
    sourceUrl: "https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip",
    referenceUrl: "https://www.unicode.org/reports/tr38/",
    sourceProperty: "kCantonese",
    characterCount: Object.keys(characters).length,
    phraseOverrideCount: Object.keys(phrases).length,
  },
  schemes,
  characters: Object.fromEntries(
    Object.entries(characters).sort(([a], [b]) => a.codePointAt(0) - b.codePointAt(0)),
  ),
  phrases: Object.fromEntries(
    Object.entries(phrases).sort(([a], [b]) => b.length - a.length || a.localeCompare(b)),
  ),
};

mkdirSync(new URL("../app/data/", import.meta.url), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(data)}\n`);

console.log(
  `Wrote ${outputPath.pathname}: ${data.metadata.characterCount} characters, ${data.metadata.phraseOverrideCount} phrases.`,
);
