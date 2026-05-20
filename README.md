# Telegram 消息迁移系统

这是一个用于管理 Telegram 频道消息迁移任务的后台系统，基于 Next.js、TypeScript、SQLite、GramJS，以及独立运行的 Worker 进程构建。

## 项目功能

本项目主要提供以下能力：

- 带密码保护的管理后台
- 支持管理多个 Telegram 用户账号，并保存会话
- 支持手机号登录、验证码校验和两步验证密码流程
- 按 Telegram 账号缓存会话列表与频道列表
- 支持创建消息同步任务，在频道之间按消息 ID 区间执行转发或复制
- 记录 Worker 心跳状态与逐条消息迁移结果
- 支持基于 Docker Compose 的单机部署

## 重要限制说明

在使用前，请注意以下限制：

- 本项目不会绕过 Telegram 的权限体系。
- 私有频道只有在当前登录的 Telegram 账号本身已经具备访问权限时才能访问。
- 对于受保护内容或禁止转发的内容，系统不会绕过 Telegram 限制。
- `ADMIN_PASSWORD`、`APP_ENCRYPTION_KEY`、Telegram API Hash、登录会话、验证码和两步验证密码等敏感信息必须始终保留在服务端，不能暴露到客户端。

## 环境变量

请将 `.env.example` 复制为 `.env`，并填写真实配置：

```env
DATABASE_URL=data/app.db
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
APP_ENCRYPTION_KEY=
ADMIN_PASSWORD=
APP_BASE_URL=http://localhost:3000
WORKER_ID=
```

### 变量说明

- `DATABASE_URL`：SQLite 数据库文件路径，Web 应用和 Worker 需要共享同一个数据库文件。
- `TELEGRAM_API_ID` 与 `TELEGRAM_API_HASH`：Telegram API 默认配置。当某个账号没有单独覆盖配置时，会使用这里的默认值。
- `APP_ENCRYPTION_KEY`：用于加密存储敏感信息，建议使用强随机生成的 32 字节密钥。
- `ADMIN_PASSWORD`：管理后台登录密码。可以是明文，也可以是 bcrypt 哈希。生产环境建议使用 bcrypt 哈希。
- `WORKER_ID`：Worker 实例标识。本地开发时可选；使用 Docker Compose 时通常由容器环境自动设置。

## 本地开发

先安装依赖：

```bash
npm install
```

启动 Web 管理后台：

```bash
npm run dev
```

在另一个终端启动 Worker：

```bash
npm run worker:dev
```

说明：

- `worker:dev` 会在开发环境下加载 `.env.local` 中的本地配置。
- 生产可用的 `worker` 命令不会强制加载 `.env.local`，它依赖 `.env` 或外部进程环境变量。

启动后，可通过 [http://localhost:3000](http://localhost:3000) 打开后台，并使用 `ADMIN_PASSWORD` 登录。

## 生产构建与运行

构建并启动 Web 服务：

```bash
npm run build
npm run start
```

Worker 仍需单独启动：

```bash
npm run worker
```

该命令不会自动加载 `.env.local`，请在启动前通过 `.env` 或进程管理器注入环境变量。

## Docker Compose 部署

当前仓库通过 `/opt/ocode/tgmf/docker-compose.yml` 启动两个服务，因此在执行 Compose 命令前需要先准备运行环境。

### 1. 准备环境变量

Compose 文件使用：

```yaml
env_file:
  - .env
```

因此必须先在项目根目录准备 `/opt/ocode/tgmf/.env` 文件。最简单的方式是：

```bash
cp .env.example .env
```

然后至少补齐以下关键配置：

- `TELEGRAM_API_ID`
- `TELEGRAM_API_HASH`
- `APP_ENCRYPTION_KEY`
- `ADMIN_PASSWORD`
- `APP_BASE_URL`

其中：

- `APP_BASE_URL` 在本地 Docker 部署时通常应设为 `http://localhost:3000`
- `ADMIN_PASSWORD` 生产环境建议使用 bcrypt 哈希，不建议直接使用明文
- `APP_ENCRYPTION_KEY` 应使用高强度随机值，不能留空

### 2. 准备数据目录

Compose 会把宿主机的 `./data` 挂载到容器内的 `/app/data`：

```yaml
volumes:
  - ./data:/app/data
```

因此建议在启动前先确保项目根目录下存在可写的数据目录：

```bash
mkdir -p data
```

SQLite 数据库文件会保存在这个目录中，Web 和 Worker 也会通过这个挂载目录共享同一份数据库。

### 3. 启动服务

完成以上准备后，再执行：

```bash
docker compose up --build
```

启动后会包含两个核心服务：

- `web`：运行 `npm run start`，提供 `3000` 端口上的 Next.js 管理后台
- `worker`：运行独立 Worker 进程，负责轮询并执行待处理的同步任务

这两个服务使用同一个镜像构建，但启动命令不同，并且都会读取同一个 `.env` 文件以及共享的 `./data` 数据目录。

### 4. 检查服务状态

启动后建议再查看日志，确认 Web 和 Worker 都已正常运行：

```bash
docker compose logs -f web worker
```

如果一切正常，就可以通过 [http://localhost:3000](http://localhost:3000) 访问后台，并使用 `.env` 中配置的 `ADMIN_PASSWORD` 登录。

## 当前行为与 v1 已知限制

当前版本有以下实现边界：

- Worker 设计为单机、单 Worker 模式。
- `copy` 模式目前对纯文本消息支持较稳定，媒体消息的复制链路尚未完全实现。
- 相册消息处理能力仍不完整：
  - `captioned_only` 仅做了较基础的实现
  - `full_group` 仍需要更完整的分组媒体处理逻辑
- Telegram 登录流程中，等待验证码确认的临时状态当前保存在进程内存中。
- Worker 会处理待执行任务、写入心跳、记录每条消息的处理结果，并在每条消息之间检查暂停或取消状态。

## 常用脚本

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run worker
npm run worker:dev
```

## 项目结构

- `/opt/ocode/tgmf/src/app`：Next.js 路由与 API 路由
- `/opt/ocode/tgmf/src/components`：后台界面组件
- `/opt/ocode/tgmf/src/lib`：认证、环境变量、加密、数据库、校验、Telegram 服务等基础模块
- `/opt/ocode/tgmf/worker/index.ts`：独立 Worker 主循环
- `/opt/ocode/tgmf/data`：SQLite 数据库存放目录

## 基本使用流程

1. 登录管理后台。
2. 创建一个 Telegram 账号记录。
3. 使用手机号发起 Telegram 登录。
4. 完成验证码校验，如有需要再完成两步验证。
5. 为该账号刷新会话或频道列表。
6. 创建同步任务，设置源频道、目标频道、执行模式、顺序和消息 ID 范围。
7. 启动 Worker，并在后台查看任务进度与心跳状态。
