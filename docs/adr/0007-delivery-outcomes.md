# ADR-0007：区分源消息不存在与发送结果未确认

- 状态：当前实现已采用；未映射结果的业务取舍待补充。
- 历史时间：2026-05-28～07-29；重建时间：2026-10-29。
- 原候选：8。

## 两个不同问题

| 情况 | 当前处理 | 证据边界 |
| --- | --- | --- |
| 范围中的源 ID 没有消息 | skipped，继续 | **U**：可以接受有些 ID 没有消息 |
| 已发起发送，没有映射到目标消息 ID | warn，不计确认成功，且不自动重发 | **A**：代码事实；用户未明确确认此取舍 |

不能用第一行的用户回答替第二行背书。

## 演进与证据（A）

- [49be5dc](https://github.com/svlic/tgmf/commit/49be5dc)：由响应数量不符抛错改为部分处理／跳过。
- [6cc0855](https://github.com/svlic/tgmf/commit/6cc0855)：允许目标 ID 为 null，曾进入发送成功计数。
- [725d9ed](https://github.com/svlic/tgmf/commit/725d9ed)：无目标 ID 计失败，不再冒充成功。
- [9a7e400](https://github.com/svlic/tgmf/commit/9a7e400)：改 skipped；[1420aab](https://github.com/svlic/tgmf/commit/1420aab)、[3ef87f9](https://github.com/svlic/tgmf/commit/3ef87f9)、[fe93657](https://github.com/svlic/tgmf/commit/fe93657)：改独立 warn、迁移旧数据、纳入终态。
- [ffa7a4b](https://github.com/svlic/tgmf/commit/ffa7a4b)：展开 GramJS 嵌套响应，正文明确防止成功发送被误记为未映射。
- 当前：[结果分类](../../src/lib/telegram/transfer-outcome.ts)、[发送与记录](../../src/lib/telegram/service.ts)。sent／warn／skipped 终态，failed 和未完成可再次尝试。

## 分析与未决事项

- **B**：无目标 ID 不证明没发出去；自动重发可能重复。warn 是在不冒充成功的同时避免盲目重发的折中，不是“允许源 ID 为空”的另一种说法。
- **C**：宁可漏还是宁可重复、警告如何对账，尚未确认。当前按响应位置映射依赖 GramJS 返回契约；不承诺端到端 exactly-once。
- 警告记录目前纳入 skipped 总计，不等于纯本地过滤；展示和恢复应明确区分。发送与本地记账之间的崩溃窗口见 TD-04。
