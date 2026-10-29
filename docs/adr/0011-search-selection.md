# ADR-0011：服务端搜索选 ID，复用传输管线

- 状态：已采用；搜索恢复时集合是否固定待确认。
- 历史时间：2026-07-28；重建时间：2026-10-29。
- 原候选：12。

## 前后方案

原来只遍历连续 ID 范围。后来新增 search：先调用 Telegram 搜索收集命中 ID，过滤范围、去重并排序，再交给现有转发／复制流程。

## 历史证据（A）

[cc8bcea](https://github.com/svlic/tgmf/commit/cc8bcea)、[c0b7f02](https://github.com/svlic/tgmf/commit/c0b7f02)、[24529ee](https://github.com/svlic/tgmf/commit/24529ee)、[9b0ec8d](https://github.com/svlic/tgmf/commit/9b0ec8d) 添加字段、持久化、执行和界面。
同日 [168cfb1](https://github.com/svlic/tgmf/commit/168cfb1)、[9ac5655](https://github.com/svlic/tgmf/commit/9ac5655)、[6f7bf3d](https://github.com/svlic/tgmf/commit/6f7bf3d)、[4be9cb8](https://github.com/svlic/tgmf/commit/4be9cb8) 放宽为可选上下界。
未设界限以 0 存在非空整数列中；对 Telegram 的排他 minId/maxId 做边界扩展，再本地校验闭区间。
当前：[搜索 ID 收集](../../src/lib/telegram/search-message-ids.ts)、[接入传输](../../src/lib/telegram/service.ts)、[校验](../../src/lib/validation/forms.ts)。

## 分析与待确认

- **B**：复用发送、过滤和记账逻辑，不另写一套搜索发送器；无需为未设上下界重建旧表字段。
- **A**：保存查询、总数和 next ID，但不保存完整命中列表；每次 processJob 都重新搜索。
- **C**：这是动态查询还是固定任务快照，用户尚未回答。不能因已实现重搜就认定业务接受结果变化。

例如暂停后源消息编辑、不再匹配搜索，恢复可能不再处理它；新增命中可能加入。固定选集则应第一次完整搜索后持久化 ID。两者都可成立，但必须选择并测试。
长搜索阶段的心跳、暂停、取消和内存问题，与选集语义分开登记于 TD-06、TD-12。
