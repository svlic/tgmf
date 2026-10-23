# Telegram 消息迁移系统

这是一个用于管理 Telegram 频道消息迁移任务的后台系统，用来在不同频道之间按消息 ID 区间执行转发或复制。项目提供一个 Web 管理后台和一个独立 Worker，并通过 Docker Compose 进行单机部署。

## 项目功能

- 无需登录密码的管理后台
- 支持管理多个 Telegram 用户账号，并保存登录会话
- 支持手机号登录、验证码校验和两步验证密码流程
- 支持刷新 Telegram 会话列表和频道列表
- 支持创建消息同步任务，在频道之间转发或复制指定范围的消息
- 记录 Worker 心跳状态与逐条消息处理结果

## 使用限制

- 本项目不会绕过 Telegram 的权限体系。
- 私有频道只有在当前登录账号本身已有访问权限时才能访问。
- 对于受保护内容或禁止转发的内容，系统不会绕过 Telegram 限制。
- 管理后台不提供身份验证；任何能够访问服务的人都可以管理账号和任务，请仅在可信网络中开放，或在反向代理层限制访问。
- `APP_ENCRYPTION_KEY`、Telegram API 凭据、登录会话、验证码和两步验证密码等敏感信息必须始终保留在服务端。

## Docker 部署

GitHub Actions 在推送到 `main` 后构建镜像并发布到 GHCR，服务器只拉取镜像，不运行 `npm ci` 或 `npm run build`。镜像同时支持 `linux/amd64` 和 `linux/arm64`，Docker 会自动选择对应架构。Web 和 Worker 共用同一个镜像：

- `web`：管理后台，容器监听 `3000`，默认映射到服务器的 `54001` 端口
- `worker`：后台任务执行进程，负责轮询并处理同步任务

### 1. 首次发布镜像（仓库维护者）

1. 将 `.github/workflows/docker-publish.yml` 提交并推送到 `main`。GitHub 会自动识别工作流，在仓库 **Actions** 页面检查构建结果。也可在该页面选择 `main` 手动运行；其他分支不会发布镜像。
2. 工作流使用 GitHub 托管 runner 和内置 `GITHUB_TOKEN`，不需要配置个人发布 Token、服务器 SSH 密钥或 Telegram 凭据。如果仓库或组织限制了 Actions，需要在 **Settings → Actions → General** 中允许该工作流使用的 Actions。
3. 首次发布成功后，在 GitHub 个人主页 **Packages → tgmf → Package settings** 中检查可见性。新包默认私有；如果希望服务器免登录拉取，可改为 Public。公开镜像中的程序文件可被任何人下载。

每次成功构建会发布 `ghcr.io/svlic/tgmf:latest` 和以完整 Git 提交 ID 为标签的版本。两个标签均支持上述两种架构。构建使用缓存；ARM64 在 AMD64 runner 上通过 QEMU 构建，首次构建可能较慢。Actions 用量与镜像存储配额以 GitHub 套餐为准。

**发布镜像不会自动更新服务器。**服务器更新需要执行下文的拉取和启动命令。

### 2. 准备服务器文件与环境变量

服务器只需安装 Docker Engine 和 Compose 插件，不需要安装 Node.js、npm 或完整克隆源码。在任意部署目录（例如 `/opt/tgmf`）放置仓库中的 `docker-compose.yml` 和 `.env.example`：

```text
/opt/tgmf/
├── docker-compose.yml
├── .env
└── data/
```

首次部署时，从模板创建配置：

```bash
cp .env.example .env
mkdir -p data
```

然后编辑部署目录中的 `.env`，至少填写这些配置。已有部署请保留原 `.env` 和 `data/`，不要用模板覆盖：

```env
DATABASE_URL=data/app.db
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
```

说明：

- `TELEGRAM_API_ID` 和 `TELEGRAM_API_HASH`：你的 Telegram API 配置
- `APP_ENCRYPTION_KEY`：可选的服务端加密密钥覆盖值，长度至少 32 个字符。未设置或留空时，首次加解密会自动生成密钥并保存到数据库同目录的 `app-encryption.key`，无需手动配置。Web 和 Worker 必须共享这个目录；使用 `:memory:` 数据库时密钥保存在 `data/app-encryption.key`
- **已有部署如果设置过 `APP_ENCRYPTION_KEY`，升级时必须保留原值**，不会自动迁移到密钥文件。删除或更换原值无法解密旧数据，自动生成的新密钥也无法恢复旧会话
- `DATABASE_URL`：SQLite 文件路径，默认会落在挂载出来的 `data/` 目录里

`.env` 通过 Compose 的 `env_file` 在运行时注入 Web 和 Worker，不应提交到 GitHub、打包进镜像或作为构建凭据上传到 Actions。修改运行配置不需要重建镜像，执行 `docker compose up -d --no-build` 应用即可。模板复制完成后可删除 `.env.example`。

`docker-compose.yml` 会把宿主机的 `./data` 挂载到容器内的 `/app/data`，因此 Web 和 Worker 会共享同一份数据库文件。

默认密钥文件也保存在这个持久化目录中，权限为仅文件所有者可读写。请将数据库和密钥文件一起备份、一起恢复，不要删除密钥文件；容器重建不应清空该目录。若使用环境变量覆盖密钥，应另外安全备份原值。加密可保护单独泄露的数据库文件，但不能防止数据库和密钥一起泄露。

### 3. 启动服务

先确认首次镜像构建已成功。如果镜像保持私有，在服务器执行以下命令，并在密码提示中输入具有 `read:packages` 权限且能访问该包的 Personal Access Token（classic）。公开镜像无需此步骤：

```bash
docker login ghcr.io -u svlic
```

不要把 Token 写进 Compose、提交到仓库或直接写入命令历史。

在部署目录执行：

```bash
docker compose pull
docker compose up -d --no-build
```

首次启动会下载预构建镜像，然后启动 Web 和 Worker，服务器不进行镜像编译。

### 4. 检查运行状态

建议查看日志确认两个服务都已正常运行：

```bash
docker compose ps
docker compose logs -f web worker
```

如果启动成功，就可以通过 `http://服务器IP:54001` 或反向代理后的域名访问，无需输入后台密码。请仅在可信网络开放，或通过防火墙、反向代理限制访问。

### 5. 升级、指定版本与迁移现有部署

每次推送到 `main` 后，先等待 Actions 构建成功，再在服务器的部署目录执行：

```bash
docker compose pull
docker compose up -d --no-build
docker compose logs --tail=100 web worker
```

不再使用 `docker compose up -d --build`。镜像拉取不会替换运行中的容器，`up` 才会应用更新，更新时服务可能短暂中断。

默认使用 `latest`。如需固定版本，在服务器 `.env` 中增加 `IMAGE_TAG=完整Git提交ID`，再执行相同更新命令。此后部署保持该版本；恢复跟随最新镜像时，将其改为 `IMAGE_TAG=latest`。Web 和 Worker 始终使用同一标签。

从源码构建方式迁移时，先等待首次镜像发布成功，再在**原部署目录**替换 `docker-compose.yml` 并执行更新命令，保留原 `.env`、`data/` 和 Compose 项目名。如果必须移动部署目录，应先停止旧 Web 和 Worker，再完整迁移数据及配置，避免新旧 Worker 同时运行。

升级前请备份数据库和对应密钥；需要一致的文件备份时先停止 Web 和 Worker。指定旧镜像可以回退程序，但不保证旧版本兼容升级后的数据库，必要时需恢复配套的数据备份。

## 基本使用流程

1. 打开管理后台。
2. 创建一个 Telegram 账号记录。
3. 使用手机号发起 Telegram 登录。
4. 完成验证码校验，如有需要再完成两步验证。
5. 刷新该账号的会话或频道列表。
6. 创建同步任务，设置源频道、目标频道、执行模式、顺序和消息 ID 范围。
7. 保持 Worker 运行，并在后台查看任务进度与心跳状态。

## 当前限制

- 当前设计为单机、单 Worker 模式。
- `forward` 模式：相册会按 `groupedId` 拉取同组消息并整组转发（受任务 ID 区间与媒体/文本过滤约束）。
- `copy` 模式：支持纯文本与单条媒体复制；**相册整组复制**尚未实现，`copy` 下遇到相册时仍按单条消息处理，可能无法完整还原整组相册。
- 相册策略（仅作用于**相册/媒体组**内的消息选择，不影响非相册单条消息）：
  - `full_group`：组内消息在过滤后一并参与转发/复制（`forward` 下为整组转发）。
  - `captioned_only`：组内只处理带说明文字的那一条，同组其余条目记为跳过。
- Telegram 登录流程中，等待验证码或两步验证确认时使用的临时 `phoneCodeHash` 和 Telegram 会话字符串会加密持久化到 SQLite；手机号仍按账号元数据保存，整体仍只适合当前单机部署模型。

## 本地开发

```bash
npm install
npm run dev          # Web
npm run worker:dev   # Worker（读取 .env.local）
npm run lint
npm run typecheck
npm test
```
