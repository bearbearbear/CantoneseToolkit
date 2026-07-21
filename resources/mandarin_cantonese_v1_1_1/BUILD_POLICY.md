# 简繁同词条过滤规范（v1.1.1）

以后扩充数据时，不得保留只发生简繁体或地区字形变化、没有粤语词汇/语法变化的条目。

## 强制判定

任一条件成立即删除：

1. `t2s(source) == t2s(target)`；
2. `s2t(source) == target`；
3. `s2hk(source) == target`；
4. `s2tw(source) == target`；
5. `flags == passthrough_same_lexeme`；
6. `condition` 包含 `same-lexeme`。

该规则适用于 Phrases、Lexicon、Templates、Rules 和 Tests。发布前任何命中都必须使构建失败。

## 本次修正

上一版仅用 `s2t(source) == target`，会漏掉「説明」「衞生」「鋭利」等香港/异体字形。
v1.1.1 改为双向归一化并读取显式同词标记。
