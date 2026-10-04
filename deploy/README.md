# deploy/ —— 本机对 DeepSeek Harness 的定制层

本目录**不是上游源码的一部分**，而是这套 DSH 实例在本机所做的改动与运维配置。
由服务器上的 `build-overlay.sh` 自动收集并**强制脱敏**后生成（自检发现敏感值残留即失败）。

上游源码（`apps/`、`packages/` 等）保持原样，本目录只承载"官方版之上我们改了什么"。

## 目录内容

| 目录 | 内容 |
|---|---|
| `runtime/` | 本机 runtime 安装的定制：`DSH_RELEASE` pin 钩子（`.pnpmfile.cjs`）、`package.json`、`install-manifest.json`（含 browserTrustPatch） |
| `profile/` | `~/.dsh/profiles/web` 的定制：`cordis.patch.yml`（插件挂载、模型 provider、MCP）、本地插件 `local/workspace-file-ops`、依赖声明 |
| `nginx/` | njs 登录门禁（`dsh_gate.js`）、站点配置、`snippets/`（会话 cookie 注入、PWA）、登录限流 `conf.d/` |
| `systemd/` | `deepseek-harness.service` 及其 drop-in、自愈看门狗 `dsh-profile-heal.*`、配对同步 `dsh-pair-sync.*`（含脚本与 timer 覆盖） |
| `scripts/` | `fix-chown-20261003.sh`（权限事故修复）、`verify-server-health.sh`（41 项健康检查） |
| `projects/` | 工作区项目：登录门禁改造与部署脚本、PWA、nginx body 限制、升级手册与回滚脚本 |

## ⚠️ 已脱敏：这些占位符需自行替换

| 占位符 | 原物 | 为什么必须脱敏 |
|---|---|---|
| `__GATE_SECRET__` | njs 门禁 cookie 的值 | 它**等同于免密凭据**：持有即免密进入 |
| `__GATE_SALT__` / `__GATE_PHASH__` | 口令的盐与 SHA-256 | 口令仅 10 位数字，明文哈希可离线爆破 |
| `__GATE_PASSPHRASE__` | 门禁明文口令 | 原来直接写在 README 与测试里 |
| `__SESSION_COOKIE__` | nginx 注入的 `dsh-auth-*` cookie | 等价于会话凭据 |
| `__MCP_API_KEY__` | `cordis.patch.yml` 中 MCP 服务的 Bearer 令牌 | 第三方 API Key |

应用本目录时，把这些占位符换回本机真实值（自行保管），或删掉不需要的部分。

## 重新生成

```bash
bash build-overlay.sh        # 收集 + 脱敏 + 自检；残留敏感值则退出码 2，不产出
```

> 脱敏覆盖**所有文本文件**（不按扩展名过滤）—— 本机存在
> `dsh_gate.js.original-20261003`、`dsh_gate.js.samesite-lax` 这类
> "扩展名不是 `.js`" 的门禁副本，按扩展名会漏掉。
