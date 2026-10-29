# ADR-0013：Web 服务器承担管理端访问控制

- 状态：已采用；取代原应用内管理员密码方案，外层具体配置未核实。
- 历史时间：2026-05-19 引入旧方案，10-23 替换；重建时间：2026-10-29。
- 原候选：16。

## 被取代的方案（A）

[46ed2a0](https://github.com/svlic/tgmf/commit/46ed2a0) 引入密码、JWT Cookie、登录限流及页面／API guard。
[0501a90](https://github.com/svlic/tgmf/commit/0501a90)、[60d8b74](https://github.com/svlic/tgmf/commit/60d8b74)、[caf2637](https://github.com/svlic/tgmf/commit/caf2637)、[05e0360](https://github.com/svlic/tgmf/commit/05e0360) 修复 Next 重定向控制流、根路径检查、环境校验耦合及 Cookie secure 判断。
期间增加过登录诊断，之后 [4bce2aa](https://github.com/svlic/tgmf/commit/4bce2aa)、[fa09088](https://github.com/svlic/tgmf/commit/fa09088) 减少日志；不能从这些修复推定“登录修不好所以删除”。

## 新决策与证据

- [767238f](https://github.com/svlic/tgmf/commit/767238f) 明确删除登录 UI、密码、管理员会话、限流和未使用依赖，允许页面和 API 直接访问。
- 保留 mutation CSRF 校验和数据库页面的请求时渲染，不是把后台变成静态站。
- **U**：最终由 Web 服务器提供相关访问控制功能。
- 当前：[CSRF](../../src/lib/csrf.ts)、[Compose](../../docker-compose.yml)、[部署警告](../../README.md)。

## 分析和责任

- **B**：由统一入口认证，应用不重复维护一套密码和会话；真实收益取决于入口确实不可绕过。
- **C**：未核实代理配置、认证方式、防火墙或公网可达性，不能声称线上已经受保护。

Web 服务器保护必须覆盖全部页面和 API。应用端口若对不可信网络直连开放，就能绕过代理；CSRF 是来源检查，不是身份认证。默认 Compose 的宿主端口映射见 TD-01。
不建议因这个债务重新加一套应用认证，而应先兑现已经确认的部署边界。
