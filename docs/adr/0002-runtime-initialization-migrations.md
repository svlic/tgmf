# ADR-0002：运行时初始化及内置兼容迁移

- 状态：已采用；迁移安全和恢复策略仍有债务。
- 历史时间：2026-05-20～07-29；重建时间：2026-10-29。
- 原候选：2。

## 前后方案

原来 import 配置／数据库模块时就校验环境、建目录、打开数据库。后来改成首次运行时访问才初始化和缓存；数据库建表后执行兼容迁移。

## 演进与证据（A）

- [da82263](https://github.com/svlic/tgmf/commit/da82263)：补充 Docker 构建工具和上下文排除规则。
- [da6313b](https://github.com/svlic/tgmf/commit/da6313b)：提交明确要求把秘密和数据库初始化延迟到 runtime，加入 `getDb()` 与环境 getter。
- [c7c1ed1](https://github.com/svlic/tgmf/commit/c7c1ed1)：实际补复制根 `tsconfig.json`，不是首次引入 worker tsconfig。
- [f533919](https://github.com/svlic/tgmf/commit/f533919)：通过列检查和 ALTER 兼容旧库。
- [3ef87f9](https://github.com/svlic/tgmf/commit/3ef87f9)：除加列，还修正特定旧记录为 warn。
- [8cfadf9](https://github.com/svlic/tgmf/commit/8cfadf9)：移除单纯转接 `getDb()` 的包装，不是更换数据库架构。
- 当前：[初始化和迁移](../../src/lib/db/client.ts)。

## 原因与分析

- **A**：延迟初始化目标由提交正文支持。
- **B**：构建镜像只应打包程序，不应要求真实运行密钥、生产数据库或持久化目录。
- **C**：缺少当时失败日志；未确认“启动时补字段”是否曾作为长期迁移策略讨论。

## 后果与边界

运行配置不必作为镜像构建凭据。兼容迁移随首次访问执行，不需要另装迁移服务。
目前没有版本化迁移账本和自动 down migration；首次打开数据库并不等于迁移原子成功。Web／Worker 可能同时初始化旧库。
这些是当前实现限制，不能因惰性初始化这一决策合理就视为已解决，见技术债务 TD-14、TD-15。
