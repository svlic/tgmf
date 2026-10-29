# ADR-0006：full_group 以完整相册为处理单位

- 状态：已采用；相册完整性原则由用户追溯确认。
- 历史时间：2026-05-27～10-29；重建时间：2026-10-29。
- 原候选：6。

## 决策

full_group 应尽量保留相册，不因逐成员过滤而发送残缺相册。整组是否通过，与最终如何发送分开：forward 一次转发整组；copy 仍逐条复制成员。

例如三张相片只有第一张有“旅行”说明，白名单为“旅行”时，应判断相册整体，而不是只留下第一张。

## 当前规则（A）

- 按 groupedId 补取、按 ID 排序，caption 用换行合并后做文本过滤。
- 黑名单命中则整组跳过；设置白名单时需整组文本命中。
- 任一成员不符合媒体筛选，则整组跳过。
- 相册跨显式 ID 范围则不发送，只为范围内成员记跳过，不自动扩大范围。
- captioned_only 则只选首个非空 caption 成员，其余跳过；它不作用于非相册消息。

## 演进与证据

[b228432](https://github.com/svlic/tgmf/commit/b228432) 从逐条转发发展为 groupedId 补取和整组 forward；[160265b](https://github.com/svlic/tgmf/commit/160265b) 将 copy 只处理一个成员改为逐成员处理；[7f9f797](https://github.com/svlic/tgmf/commit/7f9f797)、[84b0aa1](https://github.com/svlic/tgmf/commit/84b0aa1) 补批量跳过和 copy 终态保护；[13cf9f4](https://github.com/svlic/tgmf/commit/13cf9f4)、[77fdc43](https://github.com/svlic/tgmf/commit/77fdc43) 明确整组文本、媒体和边界过滤。
当前：[相册选择](../../src/lib/telegram/album-policy.ts)、[补取和发送流程](../../src/lib/telegram/service.ts)、[使用限制](../../README.md)。

## 原因与边界

- **U**：full_group 的业务含义就是尽量保留相册。
- **B**：优先内容完整性而不是通过数量；现代码跨范围时选择不越界，而不是扩大范围。
- **C**：整组跳过边界的具体取舍来自现代码／文档，用户没有另行逐条批准所有边界算法。
附近消息窗口补取是否足以保证完整发现、部分发送后的恢复、copy 无法还原目标相册，均不因本 ADR 而视为已解决。见 TD-07、TD-08。
