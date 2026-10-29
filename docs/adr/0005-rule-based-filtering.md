# ADR-0005：明确的媒体与文本黑白名单规则

- 状态：已采用；规则需求由用户追溯确认。
- 历史时间：2026-05-28～07-10；重建时间：2026-10-29。
- 原候选：5。

## 决策

在传输前按媒体类型与本地关键词／正则黑白名单筛选；不用模型推测消息是否应该迁移。规则以 JSON 列保存。

## 可观察规则（A）

- 关键词是忽略大小写的包含匹配；正则使用 i 标记。
- 黑名单优先；设置了任一白名单后，命中任一关键词白名单或正则白名单即可通过。
- 正则匹配仅检查文本前 4096 字符，关键词匹配未采用同样截断。
- 限制列表项数和规则长度，拒绝语法错误及部分嵌套量词；运行时解析也会跳过不支持的正则。
- 非相册消息不受 captioned_only 选择策略影响，但仍受明确配置的媒体／文本过滤影响。
- 相册 full_group 的整组语义由 [ADR-0006](0006-album-integrity.md) 规定。

## 历史证据

[f533919](https://github.com/svlic/tgmf/commit/f533919)、[5d63123](https://github.com/svlic/tgmf/commit/5d63123) 加入媒体配置和执行过滤；[f14cf68](https://github.com/svlic/tgmf/commit/f14cf68)、[51c57ca](https://github.com/svlic/tgmf/commit/51c57ca)、[2d682e1](https://github.com/svlic/tgmf/commit/2d682e1) 接入文本配置、校验和过滤；[566ba96](https://github.com/svlic/tgmf/commit/566ba96)、[d2e3404](https://github.com/svlic/tgmf/commit/d2e3404)、[2447a46](https://github.com/svlic/tgmf/commit/2447a46) 抽取和简化共享逻辑。

当前：[文本过滤](../../src/lib/telegram/message-text-filter.ts)、[输入校验](../../src/lib/validation/forms.ts)、[媒体分类](../../src/lib/media-types.ts)。

## 原因与后果

- **U**：黑白名单等规则是明确要求，不是开发者自行猜测需求。
- **B**：规则结果可解释，不产生额外模型调用和费用；规则越复杂，越需要准确展示匹配语义。
- **C**：用户确认不等于正则防护算法经过安全证明，也不证明 4096 的截断值有业务依据。该防护是启发式，不是有执行时间上限的隔离环境。
已有规则保持；截断导致的漏匹配、非法旧配置的处理及执行风险见债务清单，不在此默默改成另一套匹配语义。
