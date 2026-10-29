# ADR-0008：显式启动，恢复只继续未完成内容

- 状态：原则已确认；failed 恢复入口和统计一致性存在实现缺口。
- 历史时间：2026-06-24～07-13；重建时间：2026-10-29。
- 原候选：9。

## 决策与现状

- **U**：恢复的目标是“继续未完成”，不是删除记录后从头重发。
- **A**：新任务先 draft，手动 start 才 pending；暂停后可 resume；逐条终态记录用于避免重新处理；任一失败累计使任务整体 failed。
- **B**：配置与执行分开，给用户检查源、目标、模式和范围的机会；保留已完成记录才能减少重复发送。

## 历史证据（A）

- [d1c56d7](https://github.com/svlic/tgmf/commit/d1c56d7)：删除 retry-failed API／按钮及删除失败记录、重置计数的仓储路径；同时修正非 running 任务取消方式。
- [9cc406b](https://github.com/svlic/tgmf/commit/9cc406b)：扫描结束但有失败时不再一律 completed。
- [6e6ee71](https://github.com/svlic/tgmf/commit/6e6ee71) 在仓储加入 draft／start；[902f9b5](https://github.com/svlic/tgmf/commit/902f9b5) 接入启动 API／按钮。
- 当前：[仓储](../../src/lib/db/repositories.ts)、[恢复 API](../../src/app/api/jobs/[jobId]/resume/route.ts)、[操作界面](../../src/components/dashboard/forms.tsx)。

## 不应混淆的边界

“failed 记录可重试”不等于“failed 任务已经有继续入口”：当前 API 仅允许 paused resume。恢复仍重新遍历选择结果并跳过终态，不是只依赖 next_message_id 从某点开始。
“用户要求继续未完成”也不等于已确认所有状态和计数的具体行为。失败后成功是否清除累计失败、部分相册如何恢复、cancel 是请求还是确认停止，都需要兑现此原则。

## 待确认（C）

手动启动和删除独立重试入口的原始原因未记录；推荐为 failed 提供明确的继续操作，但本次只记录债务，不默默修改 API。见 TD-02～TD-05。
