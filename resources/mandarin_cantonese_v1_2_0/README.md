# 普通话口语→香港粤语口语离线网页翻译数据 v1.2.0

## 架构更新

本版本将数据从“以完整短句数量为中心”重构为：

```text
Phrases + Templates + Slot Types + Slot Values + Rules + Lexicon
```

## 数据规模

- 固定短语：369
- Lexicon：214
- Templates：272
- Rules：183
- Slot Types：60
- Slot Values：1,019
- Tests：3,263
- 运行翻译单元：1,038

已迁移并删除的受控生成短句：6,477
已替换的旧批量模板：709
场景模板理论组合容量：16,515

## 关键文件

- `TRANSLATION_DATA_DESIGN.md`：新数据架构；
- `templates.csv`：人工、场景框架和压缩通用模板；
- `slot_types.csv`：槽位类型定义；
- `slot_values.csv`：槽位值和翻译策略；
- `phrase_migration.csv`：旧生成短句迁移审计；
- `frame_migration_report.csv`：每个框架的压缩情况；
- `runtime-core-v1.2.0.json`：离线网页运行包；
- `validation_report.json`：自动校验。

## 质量说明

人工固定表达保持为最高优先级覆盖。生成模板和槽位仍需要香港粤语母语者分批审校。
