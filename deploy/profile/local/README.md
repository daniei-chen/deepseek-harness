# 本地改动记录（右侧侧栏浏览器标签 + 工作区文件下载/删除）

本目录存放的是**本机对 DSH 的本地改造**，不参与 npm/pnpm 包安装。改动共三处，
其中两处已由 `cordis.patch.yml` 持久化，重启后依然生效。

## 1. 右侧侧栏「浏览器」标签

- 位置：`~/.dsh/profiles/web/cordis.patch.yml`
- 内容：覆盖 web-app 组合包中默认禁用的随附条目
  ```yaml
  - id: ui-sidebar-browser
    disabled: false
  ```
- 效果：侧栏引导页出现「浏览器」，可输入 HTTP(S) 地址（含 loopback 服务），
  聊天区链接偏好选「应用内侧边栏」时链接也在此打开。

## 2. 工作区文件树的「下载 / 删除」宿主能力（本目录的插件）

- 位置：`~/.dsh/profiles/web/local/workspace-file-ops/index.js`
- 由 `cordis.patch.yml` 末尾的 insert 条目挂载：
  ```yaml
  - insert:
      - id: workspace-file-ops
        name: "./local/workspace-file-ops/index.js"
  ```
- 路由（均受 Connection 信任围栏 + 会话 cookie 保护，仅应用自身来源可调用）：
  - `GET  /workspace-file-ops/download?session=<id>&path=<绝对路径>`
    文件直传；目录现场打包 ZIP（UTF-8 文件名，跳过符号链接，上限 256 MiB）。
  - `POST /workspace-file-ops/delete`  `{"session": <id>, "path": <绝对路径>}`
    递归删除，不弹确认（按用户要求），工作区根目录禁止删除。
- 路径一律经 `ctx.fs.resolve` + `ctx.fs.contains` 约束在会话工作区根目录内，
  符号链接指向工作区外的条目会被拒绝。
- 仅依赖 node 内置模块（自写 ZIP writer），因此在 profile 目录下也能加载。

## 3. 文件树行内的两个小按钮（客户端）

- 位置（**发布目录内，非 profile**），当前 release =
  `0.2.1-alpha.1-manual`：
  ```
  /opt/lightvela/dsh/current/node_modules/.pnpm/
    @deepseek-ai+dsh-client-ui-sidebar-files@0.2.1-alpha.1_@deepseek-ai+cordis@4.0.5-alpha.1/
    node_modules/@deepseek-ai/dsh-client-ui-sidebar-files/lib/client.js
  ```
- 内容：每行（文件与文件夹）右侧新增「下载」「删除」两个 22px 小按钮、
  `.k-1LKG_itemRow / rowActions / action` 样式、`entry.download / entry.delete /
  entry.deleted / error.operation` 四条中英文案，以及操作结果提示行
  （`data-files-notice`）。
- 基线：`./backups/client.js.orig-0.2.1-alpha.1`（与上一版 0.2.0-rc.2 的
  `./backups/client.js.orig` **逐字节相同**，sha256 前 12 位 `d5974bf247e1`），
  打补丁后为 `4e0aefdb5e22`（46012 字节）。

## 还原方法

```bash
PKG=/opt/lightvela/dsh/current/node_modules/.pnpm/@deepseek-ai+dsh-client-ui-sidebar-files@*/node_modules/@deepseek-ai/dsh-client-ui-sidebar-files
sudo cp ~/.dsh/profiles/web/local/backups/client.js.orig-0.2.1-alpha.1 "$PKG/lib/client.js"
cp ~/.dsh/profiles/web/local/backups/cordis.patch.yml.orig ~/.dsh/profiles/web/cordis.patch.yml
```

## 升级注意

- 第 1、2 项在 profile 内，DSH 升级后继续有效（相对路径指向本目录）。
- 第 3 项位于发布目录（`.pnpm` 内的版本化路径），**升级到新版本后会丢失**，
  需要对新版本的同名包重新打一次补丁：先比对
  `sha256sum ./backups/client.js.orig-0.2.1-alpha.1` 与新包是否仍逐字节相同，
  相同则直接 `sudo cp` 旧的打过补丁的 `client.js`；不同则按 `./backups/` 的
  diff 逐处重打（补丁点：CSS 字符串、`FilesBody_module_css_default` 映射表、
  `RowActions`/`RowAction` 组件、`Entry` 的行包裹、`FilesBody` 的 notice 状态与
  `onDelete`、中英文字典四条文案）。
- 客户端 bundle 由 `dsh-client-modules` **在启动时快照进内存**，但
  `dsh-client-hmr` 会轮询产物的 mtime/ctime/size，改动落盘后自动重新发布新 rev，
  浏览器无需重启服务；若页面没热更新，刷新一次即可。
- `dsh-profile-heal.timer` 只会补回 `cosmokit / dsh-credentials-local /
  schemastery` 三个包，不影响本目录。

## 自测脚本

`./tests/` 下三个无依赖脚本可直接重跑（升级后重新打补丁时用得上）：

```bash
node ~/.dsh/profiles/web/local/tests/wfo-harness.mjs      # 宿主路由：围栏、越界、软链逃逸、删除、ZIP
node ~/.dsh/profiles/web/local/tests/client-harness.mjs   # 客户端 bundle：行内两个按钮与点击行为
node ~/.dsh/profiles/web/local/tests/served-bundle.mjs    # 活服务器：确认下发的 bundle 已含补丁
node ~/.dsh/profiles/web/local/tests/live-route-check.mjs # 活服务器：下载/删除一个自建临时文件
```

前两个以“ALL CHECKS PASSED”结尾即为通过。后两个针对**正在运行的 `dsh web`**
（默认 `http://127.0.0.1:3080`，可用 `DSH_WEB_URL` 覆盖）：它们从
`~/.dsh/.credentials.yaml` 读取本机浏览器会话签名密钥自行签发 cookie
（密钥不会被打印），`live-route-check.mjs` 只动它自己创建的临时文件
（`<工作区>/.dsh-watch/wfo-live-<pid>.txt`，可用 `WORKSPACE` 覆盖目录）。
`client-harness.mjs` 会自动解析 `/opt/lightvela/dsh/current` 指向的 release，
也可用 `DSH_RELEASE` / `SIDEBAR_FILES_BUNDLE` 指定。
