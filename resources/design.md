# 离线网页普通话—粤语文本翻译引擎技术方案

> **关于本文档**：本文由原 `resources/design.pdf` 转换为 Markdown（更易打开、检索、diff 与版本管理），
> 并结合 `mandarin_cantonese_v1_2_0` 数据包与 `app/engine/` 引擎的最新实现做了 review 与更新。
> 正文保留原设计方案；凡与当前实现有差异或已落地之处，以 `> 实现现状 (v1.2.0)` 引用块标注。
> 文末新增三个附录：数据模型现状、规则遮蔽问题与修复、数据工具链与验证流程。
>
> 最近一次更新对应变动：规则遮蔽修复、简繁归一字表扩充、Lexicon 扩充（Phase 0–2）、tests.csv 审计、数据工具链落地。

---

## 1. 推荐部署形态

建议将应用制作成一个可安装的 **PWA 离线网页应用**：

1. 用户首次通过 HTTPS 打开网页；
2. 浏览器下载网页、翻译引擎和词库；
3. Service Worker 将全部必要资源缓存到设备；
4. 用户之后断网仍可打开和使用；
5. 有网络时可选择更新词库和程序。

Service Worker 可以拦截网页资源请求，并在离线时从本地缓存返回资源；PWA 还可以通过 Web App Manifest 安装到桌面或手机主屏幕。Service Worker 必须运行在 HTTPS 安全环境中，本地开发时可使用 `localhost`。因此，不建议把正式版本设计成双击 `file://index.html` 运行。

### 两种交付模式

**模式 A：首次联网安装，之后离线**（最适合普通用户）

```
HTTPS 网站 → 首次访问 → 安装 PWA 并缓存资源 → 永久离线使用
```

**模式 B：从未联网的封闭环境**

如果设备从一开始就不能联网，可以把同一套网页文件部署到：局域网静态服务器、设备内置的轻量 HTTP 服务器、企业终端的本地 Web 服务器、WebView 或桌面壳程序。

浏览器访问 `http://localhost:端口`，而不是直接打开 `file:///应用目录/index.html`。翻译引擎代码本身保持不变。

---

## 2. 整体架构

```
┌───────────────────────────────────────┐
│                网页界面                 │
│   输入框、场景选择、翻译结果、历史记录   │
└──────────────────┬────────────────────┘
                   │ postMessage
                   ▼
┌───────────────────────────────────────┐
│          Translation Web Worker        │
│   文本规范化 / 分词与槽位保护 / 短语匹配 │
│   句型模板匹配 / 语法改写 / 候选生成评分 │
└───────────────────┬───────────────────┘
                    ▼
┌───────────────────────────────────────┐
│               本地翻译资源              │
│   phrase / lexicon / templates / rules │
│   language-model                        │
└───────────────────────────────────────┘

┌───────────────────────────────────────┐
│              Service Worker            │
│   缓存 HTML、JS、WASM、词库和版本清单    │
└───────────────────────────────────────┘
```

翻译运算放入 Web Worker，避免大词库初始化、候选搜索和规则执行阻塞界面。Web Worker 运行在独立后台线程，并通过消息与主页面通信。

---

## 3. MVP 技术选型

| 模块 | 实现 |
|------|------|
| 前端界面 | TypeScript ＋ 轻量前端框架或原生 DOM |
| 离线能力 | Service Worker ＋ Cache Storage |
| 翻译线程 | Dedicated Web Worker |
| 翻译引擎 | TypeScript |
| 固定词库 | 压缩二进制文件 |
| 运行时索引 | Trie ＋ 哈希表 ＋ 有限状态规则 |
| 用户数据 | IndexedDB |
| 更新机制 | 版本清单 ＋ 增量数据包 |
| 构建工具 | Vite 或等价静态构建工具 |
| 部署 | HTTPS 静态网站／localhost 服务器 |

第一版不必立即使用 SQLite 或 WebAssembly。对于约 10,000 个翻译单元，经过编译的词库完全可以启动时装入内存，直接使用 Trie 和哈希索引查询。

> **实现现状 (v1.2.0)**：引擎为 TypeScript（`app/engine/`），运行时索引为内存 Trie（`phrase-matcher.ts`）＋有限状态改写规则（`rewrite-engine.ts`）。固定词库当前不是 `.bin`，而是**人工编辑源（CSV/JSONL）＋编译后的紧凑 JSON**（`runtime-core-v1.2.0.json`）启动时装入内存。详见附录 A 与第 6 节。

---

## 4. 浏览器内各组件的职责

### 4.1 Service Worker

Service Worker 只负责应用离线和资源更新，不参与翻译逻辑。缓存内容包括 `index.html`、`app.js`、`app.css`、`translator-worker.js`、`phrase.bin`、`lexicon.bin`、`templates.bin`、`rules.bin`、`scoring.bin`、`version.json`。

建议采用两类缓存：`app-shell-v12` 与 `translation-data-v37`。这样更新界面时不必重复更新词库，更新词库时也不必重新下载全部网页代码。Cache Storage 适合保存网页资源和不可变数据包，缓存内容的版本切换和删除策略需要由应用自己管理。

### 4.2 主页面线程

主线程只执行轻量任务：接收用户输入、场景选择、向 Worker 发送翻译请求、展示翻译结果、显示命中的表达和置信度、管理复制/收藏/历史记录。主线程不直接加载和遍历完整词库。

### 4.3 Translation Worker

Worker 启动时完成：加载翻译数据包 → 解压数据 → 构建或恢复内存索引 → 初始化规则执行器 → 返回 `ready` 状态。

翻译时执行：

```
normalize() → protectSlots() → segment() → matchPhrases() → matchTemplates()
→ applyGrammarRules() → generateCandidates() → scoreCandidates()
→ restoreSlots() → postProcess()
```

> **实现现状 (v1.2.0)**：主流程在 `translator.ts` 的 `translateWithRuntime()`：`normalizeInput` → 整句精确短语短路 → 模板匹配 → 规则与词典候选（`ruleAndLexiconCandidate`）→ 候选生成 → 评分 → `postProcess`。其中「规则与词典候选」的阶段顺序经规则遮蔽修复调整，见附录 B。

---

## 5. 翻译引擎内部结构

### 5.1 输入规范化

处理：简繁统一、标点统一、数字和时间统一、连续空格清理、常见口语缩写、人名/地点/金额/网址/英文保护。

例如：

```
输入：   我明天下午3点去广州南站，你帮我叫辆车
规范化： 我 明天 下午 [TIME:3点] 去 [PLACE:广州南站]，你 帮 我 叫 一辆 车
```

槽位信息不参与普通词汇转换。

> **实现现状 (v1.2.0)**：见 `normalizer.ts`。简繁→港式繁体由 `data/simplified-to-hongkong.json` 驱动，**共 3845 字**（OpenCC `STCharacters` + `HKVariants` + 人工校订）。为避免过度转换，粤语常用字如 `晒 / 吓 / 床 / 着 / 游` 被显式排除（保留 `谂→諗` 等真替换）。标点统一与槽位保护（`restoreSlots`）已实现。

### 5.2 多粒度切分

不要依赖传统通用中文分词结果，而要使用**翻译词库驱动**的切分。优先级：

```
完整句 > 长固定短语 > 句型组成部分 > 普通词语 > 单字
```

例如 `我 / 今天 / 来不及 / 吃饭`，不能切成 `我 / 今天 / 来 / 不及 / 吃饭`。

实现方式：Trie 最长匹配；动态规划选择全句最优切分；对「还没有、来不及、看一下、为什么」等高风险结构提高权重。

> **实现现状 (v1.2.0)**：`phrase-matcher.ts` 的 `tokenizeByTrie` 使用 **Trie 贪心最长匹配**（同长按 priority），尚未做全句 DP。相同优先级下短语（`PHR-`，priority+20）高于词典（`LEX-`）。整句级固定表达由 `findExactPhraseMatch` 在最前**短路**，authoritative，不被词级候选盖过。

### 5.3 短语匹配器

使用 Trie 保存普通话源短语（如 `为什么`、`还没有`、`来不及`、`能不能`、`麻烦你`、`帮我看一下`）。每个短语节点保存：

```ts
interface PhraseEntry {
  id: number;
  source: string;
  target: string;
  scene: number;
  priority: number;
  leftCondition?: number;
  rightCondition?: number;
  flags: number;
}
```

短语匹配输出的不是立即替换后的字符串，而是**中间表示**：

```
[PRONOUN:我] [TIME:今天] [PHRASE:来不及 → 赶唔切] [VERB:吃 → 食] [NOUN:饭 → 饭]
```

这样可以避免前面的替换破坏后续规则。

> **实现现状 (v1.2.0)**：「避免前面替换破坏后续规则」这一设计目标在引擎中通过**哨兵遮罩**实现：先在普通话原文上用 Trie 定位可信词典项（`LEX-`、≥2 字、条件可判定），用哨兵占位保护，再跑改写规则，最后复跑 Trie 并还原。这正是规则遮蔽修复的核心，详见附录 B。

### 5.4 句型模板引擎

模板编译为有限状态结构，而不是运行时使用大量正则表达式。

```
源模板：  你为什么{VP}
目标模板：你点解{VP}
```

编译后：

```json
{
  "tokens":  [{"literal": "你"}, {"literal": "为什么"}, {"slot": "VP"}],
  "output":  [{"literal": "你"}, {"literal": "点解"},   {"slot": "VP"}]
}
```

第一版槽位只保留：`NP`（名词短语）、`VP`（动词短语）、`PERSON`、`PLACE`、`TIME`、`NUMBER`、`ITEM`、`ADJ`。模板不允许任意递归嵌套，以保持离线执行速度和规则可解释性。

> **实现现状 (v1.2.0)**：`template-matcher.ts` 已实现模板编译与匹配，并支持 `transform_pipeline`（如 `aspect_after_head` 将体貌标记后置：`我正在吃饭 → 我食緊飯`）。

### 5.5 语法改写器

语法规则操作中间表示，不直接反复修改字符串。例如：

```
[还没有] [完成任务]  →  [仲未] [完成任务]
[正在] [开会]        →  [开] [紧] [会]
[比] [昨天] [贵]     →  [贵] [过] [寻日]
```

规则结构：

```ts
interface RewriteRule {
  id: number;
  stage: number;
  priority: number;
  pattern: PatternToken[];
  replacement: OutputToken[];
  conditions?: RuleCondition[];
}
```

按固定阶段执行：`10 否定` → `20 疑问` → `30 完成与进行体` → `40 比较和程度` → `50 代词及指示词` → `60 词汇转换` → `70 语序调整` → `80 量词和搭配` → `90 句末语气`。同一阶段中按优先级从高到低执行。

> **实现现状 (v1.2.0)**：`rewrite-engine.ts` 实现内置 `customRules` ＋ 数据直连规则（`isDirectPattern` 过滤后按源串长度降序）。规则与词典之间遵循**真正的最长匹配**：`getPlainRuleSources` + `translator.ts` 的 `coveredByStrongerRule` 保证当更长规则覆盖某跨度时优先于较短词典项（如 `是不是→係咪` 不被 `不是→唔係` 抢先）。见附录 B。

### 5.6 候选生成

不要只生成一个中间结果。对于有歧义的结构，保留少量候选。例如 `我下班以后去找你`：

```
我放工之后去搵你 / 我收工之后去搵你 / 我放工以后去搵你
```

建议 Beam Search 宽度控制在 4—8 个候选，日常短句不需要很大的搜索空间。

### 5.7 候选评分

评分全部在浏览器内完成：

```
score = phraseCoverage + templateCoverage + lexicalNaturalness + collocationScore
      + sceneScore + sentenceEndingScore
      - untranslatedRisk - ruleConflict - unnaturalSequence
```

第一版使用人工权重：

```ts
const weights = {
  exactSentence: 100,
  phraseCoverage: 30,
  templateMatch: 25,
  commonCollocation: 12,
  sceneMatch: 8,
  standardCantoneseWord: 6,
  riskyMandarinResidue: -25,
  ruleConflict: -30,
  duplicateParticle: -20,
};
```

后续可增加一个小型 N-gram 语言模型，判断如「放工之后」是否比「放工以后」更符合目标粤语口语。该模型可保存为量化后的二进制频率表，不需要神经网络。

> **实现现状 (v1.2.0)**：`scorer.ts` 已实现人工权重评分；整句精确短语命中会短路并赋予高置信度（`confidence ≥ 0.95`）。N-gram 模型尚未引入。

---

## 6. 翻译词库的浏览器格式

不建议直接把 10,000 条数据放入一个大型 JSON 文件。JSON 字段名重复多，解析时还会产生较多临时对象。推荐构建阶段将编辑数据编译为：`phrase.bin`、`lexicon.bin`、`template.bin`、`rules.bin`、`ngram.bin`、`strings.bin`、`metadata.json`。其中：`strings.bin` 保存所有去重字符串；其他文件通过整数 ID 引用字符串；数值字段使用定长或变长整数；文件可用 Brotli/gzip 压缩；浏览器加载后转换为 `ArrayBuffer` 和 TypedArray；Trie 节点尽量使用连续数组存储。

建议数据流：

```
人工编辑 JSONL／CSV → 构建脚本校验 → 消除重复与编译规则 → 生成浏览器二进制包 → 随 PWA 发布
```

**人工编辑格式和浏览器运行格式应分离。**

> **实现现状 (v1.2.0)**：已遵循「编辑格式与运行格式分离」原则，但运行格式当前是**紧凑 JSON**而非 `.bin`：
> - 人工编辑源：`lexicon.csv/jsonl`、`phrases.csv/jsonl`、`rules.csv/jsonl`、`templates.csv/jsonl`、`slot_types.*`、`slot_values.*`、`tests.*`。
> - 运行时包：`runtime-core-v1.2.0.json`（`app/engine/data/loader.ts` 加载）。
> - 完整性：`manifest.json`（逐文件 `bytes` + `sha256` + `counts`）、`SHA256SUMS.txt`、`metadata.json`、`validation_report.json`。
> - `.bin`/字符串去重/N-gram 属未来优化（词库规模增大后再做）。数据流与校验/同步工具见附录 C。

---

## 7. 本地数据存储

**固定翻译数据**：核心词库是只读数据，优先直接作为静态资源缓存（Cache Storage），不需要每次启动把整个词库写入数据库。

**用户数据**：使用 IndexedDB 保存翻译历史、收藏、用户自定义词语、场景偏好、更新版本状态、已下载的增量补丁。

**不建议使用 localStorage** 保存词库或翻译历史；它只适合保存很少的配置（如 `theme=dark`、`showJyutping=true`、`defaultScene=daily`）。

---

## 8. 是否使用 SQLite WASM

**第一版：不使用。** 10,000 个翻译单元规模较小，翻译时需要频繁进行最长短语匹配、Trie 遍历、规则匹配、候选组合、N-gram 评分，这些操作在内存数据结构中比不断执行 SQL 更自然。

**第二版可选使用**：当词库扩展到几十万条、用户安装多个地区词库包、支持复杂反向查词、允许大规模自定义词库、需要数据表级增量更新、或浏览器内提供词条编辑后台时，再引入 SQLite WASM（可用 OPFS 保存数据库）。

推荐结构：翻译热路径用「内存 Trie ＋规则」，词条管理和更新用「SQLite WASM ＋ OPFS」，而不是所有翻译步骤都直接查询 SQLite。

---

## 9. OPFS 和兼容降级

OPFS 是网页所属来源的私有文件系统，适合保存 SQLite 数据库、大型数据包或用户词库；它针对文件原地读写优化，可在 Web Worker 中使用，要求安全上下文。

建议三级降级：`OPFS` → 不支持时 `IndexedDB` → 只读最低兼容模式 `Service Worker Cache`。第一版核心翻译功能不应依赖 OPFS，否则会不必要地增加浏览器兼容复杂度。

---

## 10. Worker 通信协议

主线程和翻译 Worker 之间只传递简单对象。

```js
// 初始化
worker.postMessage({ type: "INIT", dataVersion: "2026.07.1", scene: "general" });

// 翻译请求
worker.postMessage({
  type: "TRANSLATE",
  requestId: "req-1024",
  text: "你为什么还没有给我看这个文件？",
  options: { scene: "work", variant: "hong-kong", includeJyutping: false },
});
```

```json
// 翻译结果
{
  "type": "RESULT",
  "requestId": "req-1024",
  "source": "你为什么还没有给我看这个文件？",
  "target": "你点解仲未畀我睇呢份文件呀？",
  "confidence": 0.94,
  "matchedTemplate": "WHY_NOT_YET",
  "warnings": []
}
```

```json
// 低置信度结果
{
  "type": "RESULT",
  "requestId": "req-1025",
  "target": "……",
  "confidence": 0.48,
  "warnings": ["包含未覆盖表达", "建议缩短句子"]
}
```

---

## 11. 翻译核心是否使用 WebAssembly

**MVP：TypeScript。** 开发和调试快、规则错误容易定位、10,000 翻译单元无需 WASM 也能快速运行、数据结构和 Worker 已能避免界面卡顿。

**V2：Rust 编译为 WASM。** 当词库超过 10 万条、复杂规则明显增加、候选搜索速度不足、需与移动原生应用共享同一套引擎、希望核心逻辑不易被直接修改、或需要更严格的内存布局时再迁移。

推荐保持统一接口，使 TypeScript 版本和 WASM 版本可无缝替换：

```ts
interface TranslatorEngine {
  init(data: ArrayBuffer[]): Promise<void>;
  translate(text: string, options: TranslateOptions): TranslateResult;
}
```

---

## 12. 离线缓存策略

**安装阶段**：Service Worker 首次安装缓存最小必要资源（HTML、CSS、主程序、Worker、核心数据）。安装完成后即可进入基础离线模式。

**扩展数据包**：其余场景词库可作为独立包（`pack-basic.bin`、`pack-shopping.bin`、`pack-transport.bin`、`pack-work.bin`、`pack-medical.bin`），可首次全部缓存、用户按需下载、有网络时自动下载或企业部署时全部预装。

**缓存优先策略**：应用代码用 Cache First；版本信息用 Network First（失败时用缓存）；翻译数据用 Cache First ＋版本哈希校验。

---

## 13. 词库更新机制

服务器只承担「发布更新包」的作用，翻译过程不访问服务器。

```json
{
  "engineVersion": "1.3.0",
  "dataVersion": "2026.07.15",
  "packages": [
    { "name": "core", "version": "37", "url": "/data/core-v37.bin", "sha256": "...", "size": 4821032 }
  ]
}
```

更新流程：检测 `version.json` → 比较本地版本 → 下载新数据包 → 校验文件哈希 → 完整加载并执行自检 → 原子切换到新版本 → 删除旧缓存。**不要边下载边覆盖现有词库**，只有新包全部校验成功后才切换。Service Worker 更新时新版本通常先进入等待状态，应用应显示「有新版本可用」，由用户刷新后完成切换。

---

## 14. 目录结构

```
/
├── index.html
├── manifest.webmanifest
├── service-worker.js
├── assets/  (app.js, app.css, icons/)
├── worker/  (translator-worker.js, engine.wasm)
├── data/    (version.json, strings.bin, phrase.bin, lexicon.bin, templates.bin, rules.bin, ngram.bin)
└── licenses/ (third-party-notices.txt, data-sources.json)
```

`engine.wasm` 在 TypeScript MVP 中可以不存在。

---

## 15. 推荐代码模块

```
src/
├── ui/     (editor.ts, result-view.ts, settings.ts)
├── worker/ (worker-entry.ts, protocol.ts)
├── engine/ (normalizer.ts, tokenizer.ts, phrase-matcher.ts, template-matcher.ts,
│            rewrite-engine.ts, candidate-generator.ts, scorer.ts, postprocessor.ts)
├── data/   (loader.ts, binary-reader.ts, schema.ts)
└── storage/(indexed-db.ts, updates.ts)
```

每个模块必须可以独立单元测试。

> **实现现状 (v1.2.0)**：`app/engine/` 实际模块与设计高度一致：`normalizer.ts`、`phrase-matcher.ts`（含分词）、`template-matcher.ts`、`rewrite-engine.ts`、`candidate-generator.ts`、`scorer.ts`、`postprocessor.ts`、`translator.ts`（编排）、`schema.ts`、`data/loader.ts`（加载 `runtime-core` JSON）。

---

## 16. 工程性能目标

对于约 10,000 个翻译单元：

| 指标 | 目标 |
|------|------|
| 首次完整下载 | 5—20 MB |
| 缓存后启动 | 1 秒内 |
| Worker 初始化 | 300 毫秒内 |
| 普通短句翻译 | 50 毫秒内 |
| 最长输入 | 50 个汉字 |
| 候选数量 | 不超过 8 个 |
| 运行内存 | 50 MB 以内 |
| 离线可用率 | 100% 核心功能 |
| 翻译网络请求 | 0 |

这些是工程验收目标，需在低端 Android、iPhone、Windows、Mac 浏览器上实测。

---

## 17. 浏览器兼容策略

核心功能只依赖：Service Worker、Cache Storage、Web Worker、IndexedDB、ArrayBuffer/TypedArray、可选 WebAssembly。不要让核心翻译依赖 SharedWorker、后台同步、浏览器扩展、实验性文件 API、WebGPU 或云端接口。

降级逻辑：支持 SW → 完整 PWA 离线模式；不支持 SW 但支持 Worker → 当前页面可翻译但不保证关闭后离线重开；不支持 Worker → 主线程运行简化引擎；不支持 WASM → 使用 TypeScript 引擎。

---

## 18. 安全和隐私

网页构建时应做到：不引用 CDN 脚本、不引用在线字体、不加载远程分析 SDK、不调用在线翻译 API、所有依赖在构建时打包、设置严格 CSP、用户输入默认不上传、翻译历史只保存在本地、提供「一键清除本地数据」、发布包附带数据来源和许可证清单。

最终页面在断网状态下，开发者工具的 Network 面板中不应出现任何翻译相关请求。

---

## 19. 最终推荐路线

**第一阶段**：PWA ＋ TypeScript ＋ Dedicated Web Worker ＋ Trie 短语匹配 ＋ 模板和规则引擎 ＋ 二进制只读词库 ＋ IndexedDB 用户数据。暂不采用 SQLite WASM、神经翻译模型、大型 NLP 框架、Rust/WASM 核心。

**第二阶段**：PWA ＋ Rust/WASM 翻译核心 ＋ SQLite WASM 词库管理 ＋ OPFS 持久化 ＋ 量化 N-gram 排序模型。

---

## 20. 简化后的技术结论

第一版最合适的浏览器实现：Service Worker 负责离线、Web Worker 负责计算、二进制数据包负责词库、Trie 负责短语检索、模板和有限状态规则负责语法转换、轻量评分器负责选择最终粤语结果、IndexedDB 负责用户数据。对于一万个翻译单元，这一方案比在浏览器里部署神经翻译模型更小、更快，也更容易人工控制和持续修正规则。

---

# 附录 A · 数据模型现状（v1.2.0）

数据包 `mandarin_cantonese_v1_2_0` 采用分层设计，各层职责互不越界（详见 `resources/mandarin_cantonese_v1_2_0/TRANSLATION_DATA_DESIGN.md`）：

| 层 | 职责 | 例子 | 文件 |
|----|------|------|------|
| 字形归一 (s2hk) | 简体→港式繁体**单字** | 电脑→電腦、开→開 | `app/engine/data/simplified-to-hongkong.json`（3845 字）|
| Phrases | 整句固定表达/习语/人工例外 | 早上好→早晨 | `phrases.csv/jsonl` |
| Templates | 句法结构、语序、槽位关系（可带 `transform_pipeline`）| 你为什么{VP}→你点解{VP} | `templates.csv/jsonl` |
| Slot Types / Values | 槽位语义类型与可填充值（不参与通用最长匹配）| ITEM、PLACE、手机→手機 | `slot_types.*` / `slot_values.*` |
| Rules | 否定/体貌/比较/语序/语气等语法改写 | 唔、緊、咗、贵过 | `rules.csv/jsonl` |
| Lexicon | 字形归一之外的**词级真替换** | 冰箱→雪櫃、睇、佢、而家 | `lexicon.csv/jsonl` |

**核心判据**：进入 Lexicon 的条目必须是**真正的词汇替换**，即 `target ≠ 简繁归一(source)`。纯字形差异由 normalizer 处理，不应进 Lexicon。此判据同时是扩充时的去重/防冗余过滤器。

**Lexicon 扩充（Phase 0–2）**：从 214 条扩至 **464 条**。Phase 1 从 `slot_values` 收割 +192；Phase 2 高频日常策展 +59；Phase 3 规则遮蔽修复期间删除 1 条低质词条（`LEX-0489`）。

**运行时与完整性**：编辑源（CSV/JSONL）编译为 `runtime-core-v1.2.0.json`；`manifest.json` 记录逐文件 `bytes`/`sha256` 与 `counts`；`SHA256SUMS.txt`、`metadata.json`、`validation_report.json` 与 `schema.json` 配套。

---

# 附录 B · 规则遮蔽问题与修复（v1.2.0）

## 问题

引擎原先**先对整句跑改写规则，再做词典 Trie**，导致短规则「吃掉」更长的词典项（rule shadowing）。用 `scripts/audit_rule_shadowing.mts` 量化：430 条多字词典项中有 **24 条（5.6%）被遮蔽**。三类根因：

1. **单字规则打断多字词条**：`在→喺` 拆散 `现在→而家`（得「現喺」）、`看→睇` 拆散 `看电影→睇戲`、`不→唔` 拆散 `睡不着→瞓唔着`。
2. **后处理 `的→嘅`** 把 `出租车→的士` 变「嘅士」（含 打车/叫出租车/出租车站）。
3. **声明了 `condition` 却未实现判定**：`没有→未`、`不要→唔好`、`不能→做唔到`、`正在→緊` 等 sense_split 项，规则给出的默认义反而是对的。

## 修复（三处）

- **`translator.ts`**：`ruleAndLexiconCandidate` 改为「**遮罩 → 跑规则 → 复跑 trie → 还原**」。仅遮罩可信词条（`LEX-`、≥2 字、无条件或条件已实现）用哨兵保护，其余照旧跑完整规则；复跑 Trie 保住单字词条（如 `他→佢`）。对无词典命中的句子，整句即一个「空隙」，行为与原实现一致，从而把回归风险限定在确有词典命中处。
- **`rewrite-engine.ts`**：新增 `getPlainRuleSources`，配合 `coveredByStrongerRule` 实现规则/词典**真正的最长匹配**——当更长规则覆盖某跨度时不遮罩词典项，保住 `是不是→係咪`、`喜欢不喜欢→鍾唔鍾意` 等 A-not-A 规则。
- **`postprocessor.ts`**：`的→嘅` 改为 `的(?!士)`，保留「的士」不误伤「我的→我嘅」。

## 结果

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| 被遮蔽词典项 | 24 (5.6%) | **8 (1.9%)** |
| tests.csv exact-match | 439/533 | **442/533** |
| feature-assert | 501/533 | 501/533 |
| 单元测试 | — | 全绿 |

剩余 8 条均为**符合设计**的 sense_split 条件项（规则给出正确默认义，如 `没有→冇`、`不会→唔會`）。`正在→緊` 属模板层 aspect 重排（`move_after_verb`），需在 `template-matcher` 处理体貌后置，不在遮蔽范畴。

**后续**：为 `unfinished_action`、`negative_imperative`、`ability_or_result` 等条件落地判定器（当前仅 `learned_skill` 已实现），让条件项按语境命中而非永远退让给规则默认义。

---

# 附录 C · 数据工具链与验证流程（v1.2.0）

数据包改动后必须保持所有同步制品一致并跑回归。项目技能 `skills/verify-data-package/SKILL.md` 固化了该流程，脚本位于 `scripts/`：

**改数据（优先用工具，dry-run 默认，`--apply` 才写并自动同步所有制品）**

- `lexicon_validate.py <candidates.csv>`：候选质量闸门（字形归一去重、简体/普通话残留检测、与 Lexicon + Rules 双向去重、单字歧义告警）。
- `harvest_lexicon_from_slot_values.py` / `curate_lexicon_phase2.py`：批量新增（经校验后由 `lexicon_merge.py` 合并）。
- `lexicon_remove.py LEX-XXXX --apply`：删除词条并同步所有制品（不重排 ID）。
- 手改 `rules/templates/phrases/slot_values/tests/runtime-core` 后跑 `resync_hashes.py` 重算 `manifest` 哈希/大小与 `SHA256SUMS.txt`（计数需另行更新）。

**回归与验证**

- `node_modules/.bin/tsx scripts/_engine_eval.mts [--fails]`：活跃用例 exact/feature 通过率；可用 `git stash` 做改前/改后失败集 diff。
- `node_modules/.bin/tsx scripts/audit_rule_shadowing.mts [--all]`：规则遮蔽审计。
- `node --test tests/runtime-data-package.test.mjs` 与 `node --test tests/*.test.mjs`：完整性 + 全量测试，须全绿。
- 可选：预览页 `http://localhost:3003` 抽样复核（HMR 自动加载引擎改动；`runtime-core` JSON 变更可能需重启）。
