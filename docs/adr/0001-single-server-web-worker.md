# ADR-0001：单服务器 Web／Worker 共享 SQLite

- 状态：已采用；部署范围由用户追溯确认。
- 历史时间：2026-05-19；重建时间：2026-10-29。
- 原候选：1。

## 决策

网页负责配置账号、创建和管理任务；独立 Worker 负责持续执行；两者在同一服务器共享 SQLite。Telegram 访问采用 GramJS 用户会话，而不是 Bot API。

## 演进与证据（A）

- [bee5721](https://github.com/svlic/tgmf/commit/bee5721)：Create Next App 骨架已使用 Next 16、React 19、TypeScript。
- [46ed2a0](https://github.com/svlic/tgmf/commit/46ed2a0)、[77006f0](https://github.com/svlic/tgmf/commit/77006f0)、[9b6f099](https://github.com/svlic/tgmf/commit/9b6f099)：加入领域类型、SQLite 仓储、GramJS 和独立 Worker。
- [e4f53e9](https://github.com/svlic/tgmf/commit/e4f53e9)：初版 README 明确单机、单 Worker；Compose 两服务挂载同一数据目录。
- [b5adb67](https://github.com/svlic/tgmf/commit/b5adb67)：开放任务界面的账号选择，并非引入账号池、自动轮换或多 Worker。
- 当前：[Worker](../../worker/index.ts)、[数据库 schema](../../src/lib/db/schema.ts)、[Compose](../../docker-compose.yml)。SQLite 使用 WAL 与外键。

## 原因与分析

- **U**：自用、单服务器；没有多 Worker 计划。
- **B**：长任务不依附一个浏览器请求；共享文件数据库省去额外数据库和消息队列的运维成本。此规模下没有证据需要分布式基础设施。
- **C**：未找到框架、数据库或 Telegram 库的选型比较，不能声称已经比较并否决 PostgreSQL、Redis 等技术。

## 后果与边界

Web 与 Worker 的部署必须共享同一数据库及密钥位置。跨进程写入、重启恢复仍需正确处理；“只有一个 Worker”不等于“没有并发”，Web 也会修改任务。
不承诺多机共享 SQLite、多 Worker 全局节流或 Telegram 发送 exactly-once。
只有实际出现多服务器、并发执行或容量需求时才重审该边界，不把单机本身列为债务。
