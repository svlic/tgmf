# ADR-0012：JSON 快照轮询和有界详情

- 状态：已采用；有限历史展示符合用户需求。
- 历史时间：2026-05-27～09-20，主要转换为 06-29；重建时间：2026-10-29。
- 原候选：13。

## 前后方案与证据（A）

- [2eaa07e](https://github.com/svlic/tgmf/commit/2eaa07e)：活动任务每两秒 router.refresh。
- [6c26c63](https://github.com/svlic/tgmf/commit/6c26c63)、[3273f49](https://github.com/svlic/tgmf/commit/3273f49)、[e88e353](https://github.com/svlic/tgmf/commit/e88e353)、[c9558af](https://github.com/svlic/tgmf/commit/c9558af)：服务端首屏快照＋JSON API＋客户端局部更新，替代路由刷新。
- [838ffaa](https://github.com/svlic/tgmf/commit/838ffaa)：详情从全量记录改为总数＋最多 100 条，UI 明确目的为保持 live refresh 响应。
- [8247003](https://github.com/svlic/tgmf/commit/8247003)、[373aee9](https://github.com/svlic/tgmf/commit/373aee9)：简化 hook 状态和整合 mutation 通知，保留 accounts／jobs 两种事件。
- 当前：[快照](../../src/lib/jobs-dashboard.ts)、[轮询](../../src/hooks/use-poll-json.ts)。隐藏页面跳过请求、同 hook 合并在途请求、no-store；needs_polling 决定是否继续定时刷新。

## 原因与后果

- **U**：几乎不看旧记录，不需要默认加载完整历史。
- **B**：有界响应适合监控最近活动，不需要为个人使用优先开发完整档案检索；两秒轮询实现比推送简单，但没有性能对照证明。
- **C**：未记录为何选择 polling 而非 SSE／WebSocket；跨标签页一致性要求未确认。

限制 100 条不等于正确选中了“最新”：当前先按最大源 ID 选取，降序任务会偏离最近处理时间。停止轮询后的恢复、动作补刷也有缺口。见 TD-16～TD-18。
该决策不承诺历史数据自动清理、查询成本恒定或账务级一致快照。
