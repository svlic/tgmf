# ADR-0015：CI 构建镜像，服务器只拉取运行

- 状态：已采用；节省服务器资源由用户追溯确认。
- 历史时间：2026-05-19～10-23；重建时间：2026-10-29。
- 原候选：18。

## 前后方案与证据（A）

[e4f53e9](https://github.com/svlic/tgmf/commit/e4f53e9) 引入多阶段 Docker 构建，Compose 的 Web／Worker 从源码构建并共享数据目录。
[4d504b7](https://github.com/svlic/tgmf/commit/4d504b7) 改用公共 tsx CLI；[a32e177](https://github.com/svlic/tgmf/commit/a32e177) 收紧 worker tsconfig 并删除 Web 对 Worker 的启动依赖，没有取消数据共享。
[8ddae88](https://github.com/svlic/tgmf/commit/8ddae88) 改为 Actions 通过 QEMU／Buildx 发布 AMD64、ARM64 GHCR 镜像，Compose 只引用镜像。
当前：[工作流](../../.github/workflows/docker-publish.yml)、[Dockerfile](../../Dockerfile)、[Compose](../../docker-compose.yml)、[部署说明](../../README.md)。

## 决策和理由

- **U**：主要为了节省服务器构建所消耗的资源。
- **A**：main 自动发布 latest 和完整提交 SHA 标签；Web／Worker 使用同一标签。运行配置不作为构建秘密；服务器手动 pull 后 up，不是自动部署。
- **B**：部署不再依赖服务器 Node/npm/编译工具，镜像一致性是附带收益；构建成本转移至 CI 而非消失。
- **C**：没有取得双架构线上运行证据、Actions 用量或节省资源指标，不宣称已量化验证。

## 后果与重审

依赖 GHCR 和 CI 可用性；latest 可变，需要固定时使用提交标签。旧镜像不保证兼容升级后的数据库，应保留配套数据／密钥备份。
工作流目前没有显式 lint／typecheck／test 发布门禁，这不是“用户不关心测试方法 ADR”所批准的风险，见 TD-19。不把自动发布授权扩大为自动更新服务器。
