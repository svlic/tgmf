# ADR-0009：账号冷却释放 Worker，固定与自适应节流并存

- 状态：已采用；账号隔离原则由用户确认，部分参数待验证。
- 历史时间：2026-06-22～07-13；重建时间：2026-10-29。
- 原候选：10、11。

## 决策

Flood Wait 时保存账号冷却期限，任务退回 pending 并释放唯一 Worker，让其他账号任务有机会执行。请求按账号排队，采用配置间隔与自适应间隔中的较大值。

## 演进与证据（A）

- [758fc91](https://github.com/svlic/tgmf/commit/758fc91)：循环尾 sleep 改为成功发送后延迟。
- [edc0b95](https://github.com/svlic/tgmf/commit/edc0b95)：Flood Wait 在进程内等待、维护心跳后重试。
- [3ef87f9](https://github.com/svlic/tgmf/commit/3ef87f9)、[7cbdeab](https://github.com/svlic/tgmf/commit/7cbdeab)、[fe93657](https://github.com/svlic/tgmf/commit/fe93657)：持久化冷却、失联任务回收、归属检查，取代原地等待。
- [0950db5](https://github.com/svlic/tgmf/commit/0950db5)、[25a4a2f](https://github.com/svlic/tgmf/commit/25a4a2f)、[644e740](https://github.com/svlic/tgmf/commit/644e740)、[234e9af](https://github.com/svlic/tgmf/commit/234e9af)：账户发送排队、尝试计数与显示。
- [4a3471b](https://github.com/svlic/tgmf/commit/4a3471b)、[6e6ee71](https://github.com/svlic/tgmf/commit/6e6ee71)、[d7404d0](https://github.com/svlic/tgmf/commit/d7404d0)：自适应间隔、flood 事件，读取／下载也经节流；成功发送减少自适应间隔，读取成功不减少。
- 当前：[执行](../../src/lib/telegram/service.ts)、[进程内 limiter](../../src/lib/telegram/send-limiter.ts)、[调度仓储](../../src/lib/db/repositories.ts)。

## 原因与取舍

- **U**：账号间不要相互阻塞，没有多 Worker 计划；两种方案可以并存。
- **B**：这里将“两种方案”理解为固定间隔和自适应节流；max 组合是现代码事实，不是用户逐项批准公式。释放只发生于冷却等返回点，不是所有账号任务的公平时间片调度。
- **C**：倍增、300 秒上限和恢复步长依据未记录；delay=0 的自适应起步问题见 TD-10。
- **A／当前限制**：本轮已核对安装版本与 lockfile 一致的 GramJS 2.26.22：默认对不超过 60 秒的 Flood Wait 在 SDK 内等待后重试，应用未覆盖该配置。因此数据库冷却不覆盖所有等待，见 TD-09；尚未通过真实 Telegram 验证影响频率。

进程内 limiter 适合当前约束，不作为跨 Worker 全局限流保证。并发初始化和 Web 操作竞态仍不能以单 Worker 为由忽略。
