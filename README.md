# Telegram 消息迁移系统

这是一个用于管理 Telegram 频道消息迁移任务的后台系统，用来在不同频道之间按消息 ID 区间执行转发或复制。项目提供一个 Web 管理后台和一个独立 Worker，并通过 Docker Compose 进行单机部署。

## 项目功能

- 带密码保护的管理后台
- 支持管理多个 Telegram 用户账号，并保存登录会话
- 支持手机号登录、验证码校验和两步验证密码流程
- 支持刷新 Telegram 会话列表和频道列表
- 支持创建消息同步任务，在频道之间转发或复制指定范围的消息
- 记录 Worker 心跳状态与逐条消息处理结果

## 使用限制

- 本项目不会绕过 Telegram 的权限体系。
- 私有频道只有在当前登录账号本身已有访问权限时才能访问。
- 对于受保护内容或禁止转发的内容，系统不会绕过 Telegram 限制。
- `ADMIN_PASSWORD`、`APP_ENCRYPTION_KEY`、Telegram API 凭据、登录会话、验证码和两步验证密码等敏感信息必须始终保留在服务端。

## Docker 部署

当前仓库通过 `/opt/ocode/tgmf/docker-compose.yml` 启动两个服务：

- `web`：管理后台，默认监听 `3000` 端口
- `worker`：后台任务执行进程，负责轮询并处理同步任务

### 1. 准备环境变量

先复制环境变量模板：

```bash
cp .env.example .env
```

然后编辑 `/opt/ocode/tgmf/.env`，至少填写这些配置：

```env
DATABASE_URL=data/app.db
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
APP_ENCRYPTION_KEY=
ADMIN_PASSWORD=
```

说明：

- `TELEGRAM_API_ID` 和 `TELEGRAM_API_HASH`：你的 Telegram API 配置
- `APP_ENCRYPTION_KEY`：服务端加密/签名密钥，用于加密数据库中的敏感信息并签发管理会话；它不是登录密码，建议使用强随机且长度至少 32 个字符的密钥
- `ADMIN_PASSWORD`：后台登录密码，按普通管理员登录密码使用即可；生产环境建议使用 bcrypt 哈希
- `DATABASE_URL`：SQLite 文件路径，默认会落在挂载出来的 `data/` 目录里

### 2. 准备数据目录

创建本地数据目录，用于持久化 SQLite 数据库：

```bash
mkdir -p data
```

`docker-compose.yml` 会把宿主机的 `./data` 挂载到容器内的 `/app/data`，因此 Web 和 Worker 会共享同一份数据库文件。

### 3. 启动服务

执行：

```bash
docker compose up --build
```

首次启动会构建镜像，然后同时启动 Web 和 Worker。

### 4. 检查运行状态

建议查看日志确认两个服务都已正常运行：

```bash
docker compose logs -f web worker
```

如果启动成功，就可以通过你实际对外暴露的后台地址访问，例如 `http://服务器IP:3000` 或反向代理后的域名地址，并使用 `.env` 中配置的 `ADMIN_PASSWORD` 登录。

## 基本使用流程

1. 登录管理后台。
2. 创建一个 Telegram 账号记录。
3. 使用手机号发起 Telegram 登录。
4. 完成验证码校验，如有需要再完成两步验证。
5. 刷新该账号的会话或频道列表。
6. 创建同步任务，设置源频道、目标频道、执行模式、顺序和消息 ID 范围。
7. 保持 Worker 运行，并在后台查看任务进度与心跳状态。

## 当前限制

- 当前设计为单机、单 Worker 模式。
- `copy` 模式目前对纯文本消息支持较稳定，媒体复制链路尚未完全实现。
- 相册消息处理仍不完整：
  - `captioned_only` 仅为基础实现
  - `full_group` 仍需要更完整的分组媒体处理逻辑
- Telegram 登录流程中，等待验证码确认的临时状态当前保存在进程内存中。
