# ADR-0004：媒体复制通过临时文件下载后重传

- 状态：已采用；大文件优化目的由用户追溯确认。
- 历史时间：2026-05-27～06-01，后续维护至 10 月；重建时间：2026-10-29。
- 原候选：4。

## 前后方案与证据（A）

1. 最初 copy 仅支持文本。
2. [6e0f628](https://github.com/svlic/tgmf/commit/6e0f628)：尝试把源 media 对象直接传给 sendFile，保留格式实体并拒绝 protected 内容。
3. [6f61065](https://github.com/svlic/tgmf/commit/6f61065)：改成下载到 Buffer，再通过 CustomFile 上传。
4. [10d44e5](https://github.com/svlic/tgmf/commit/10d44e5)：保留文件名、文档属性和视频 streaming 信息。
5. [2d682e1](https://github.com/svlic/tgmf/commit/2d682e1)：改为临时文件路径上传，增加文件名清理、进度／心跳和 finally 清理。
6. [49dd360](https://github.com/svlic/tgmf/commit/49dd360)：以行为测试保护元数据和清理后简化实现。

当前：[copyMessage 及文件处理](../../src/lib/telegram/service.ts)。

## 原因与分析

- **U**：这是为大文件做的优化。
- **B**：不要求应用持有完整媒体 Buffer，以本地磁盘和额外读写换取更可控的内存需求；复制仍需要下载和上传带宽。
- **C**：未记录实际 OOM、文件大小上限或性能对照，不能声称历史上发生 OOM，或优化后的内存／耗时已经验证。

## 后果与边界

文件名不能决定任意写入路径；正常成功／异常路径清理临时目录。强制终止进程不会执行 finally，磁盘不足、残留文件和长传输控制响应仍需单独处理。
copy 逐条上传相册成员，不承诺在目标重建相册。临时文件不是绕过 Telegram 禁止转发／受保护内容的手段。
