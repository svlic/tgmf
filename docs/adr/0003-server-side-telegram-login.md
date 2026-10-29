# ADR-0003：服务端复用并加密保存 Telegram 登录状态

- 状态：已采用；最初故障背景待补。
- 历史时间：2026-05-26～05-27；重建时间：2026-10-29。
- 原候选：3。

## 决策

发验证码、验验证码和两步验证继续同一个 Telegram 登录会话。内部 phoneCodeHash 和临时 session 留在服务端，加密保存到 SQLite，不要求浏览器持有或返回 hash。

## 演进与证据（A）

- 初版仅用进程 Map 保存部分临时状态，并由客户端提交 phoneCodeHash。
- [4c8479f](https://github.com/svlic/tgmf/commit/4c8479f)：保存手机号、同一次 session，复用到验证码／2FA，增加 15 分钟窗口。
- [78c11a0](https://github.com/svlic/tgmf/commit/78c11a0)：删除浏览器提交内部 hash 的要求。
- [f3c991b](https://github.com/svlic/tgmf/commit/f3c991b)：dialog cache 由整对象序列化改为字段白名单快照。
- [3e99982](https://github.com/svlic/tgmf/commit/3e99982) 添加登录表／仓储；[6e0f628](https://github.com/svlic/tgmf/commit/6e0f628) 才真正把 service 接到持久仓储。
- 当前：[登录流程](../../src/lib/telegram/service.ts)、[加密](../../src/lib/crypto.ts)、[仓储](../../src/lib/db/repositories.ts)。

## 原因与分析

- **B**：验证必须接着发验证码时的会话；持久化可避免仅因 Web 进程重启就丢失本地登录状态。字段白名单减少不必要的序列化数据。
- **C**：不能确认当时实际遇到的是重启、会话不一致还是其他故障；15 分钟依据未记录；未发现泄漏事故证据。

## 后果与边界

敏感内部登录材料不作为浏览器状态；验证码和 2FA 密码仍需要由用户提交到服务端，不是“不经过浏览器”。
手机号等元数据并非整库加密。临时状态过期由访问时检查，不代表存在定期清理；保密依赖密钥、服务器和备份保护。不会绕过 Telegram 权限或账号授权要求。
