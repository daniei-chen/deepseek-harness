# dsh.kaogong.art 变成"可安装的 Web 应用"（PWA）改动包

## 一句话

Chrome 抓 manifest 和图标时**不带 cookie**；而本站 server 级挂着 `auth_request /_dsh_gate;`，
匿名请求 `/manifest.webmanifest` 会被打回登录页 HTML，Chrome 因此判定"这不是应用"，
菜单里只剩"创建快捷方式"。本包把 PWA 门面（manifest + 图标 + favicon）从门禁里单独放行，
其余路径（含 `/`、`/assets/`）一律照旧需要 `dsh_gate` cookie。

## 证据（改动前，线上实测）

```
$ curl -sS -o /dev/null -w '%{http_code} %{content_type}\n' https://dsh.kaogong.art/manifest.webmanifest
200 text/html; charset=utf-8          # <- 登录页 HTML，不是 manifest
$ curl -sS ... /favicon.svg
200 text/html; charset=utf-8          # 同样被门禁拦成登录页
```

同日带 cookie 请求同一路径则是 `200 application/manifest+json`（255 字节）——
说明文件是有的，只是匿名拿不到，而 Chrome 的 manifest 请求正是匿名的
（web.dev: "The request for the manifest is made without credentials, even if it's on the same domain"）。

另外即使拿到，原 manifest 也不满足 Chrome 的安装条件：只有 1 个 SVG 图标
（`sizes: "any"`），而 Chrome 要求 `icons` 里同时有 **192×192 和 512×512**。
本包一并补上 PNG 图标，并把 `display` 从 `fullscreen` 改成 `standalone`（桌面更像应用而不是全屏霸屏）。

## 改了哪些东西

| 目标位置 | 内容 |
| --- | --- |
| `/var/www/dsh-pwa/` | 新增：`manifest.webmanifest` + `icons/`（192、512、512-maskable PNG、favicon.svg、favicon-dark.svg） |
| `/etc/nginx/snippets/dsh-pwa.conf` | 新增：4 个 `auth_request off;` 的 location，只放行上面这些静态资源 |
| `/etc/nginx/sites-available/dsh.kaogong.art` | 只加一行 `include snippets/dsh-pwa.conf;`（插在 `include snippets/dsh-session.conf;` 之后），其余一字未动 |

**不动**的东西：nginx 站点其余配置、限流、TLS、`proxy_pass`、`dsh_gate.js`、DSH 进程与它自己的 `dist/manifest.webmanifest`。

已在本机用真实 njs 模块 + 真实 `dsh_gate.js` 起了一个非特权 nginx 做对照实验（端口 18082，验证后已停）：

| 请求（Cookie: dsh_gate=） | `/` | `/assets/x.css` | `/manifest.webmanifest` | `/icons/icon-192.png` | `/favicon.svg` |
| --- | --- | --- | --- | --- | --- |
| 匿名 | 登录页 HTML ✅ 仍受保护 | 登录页 HTML ✅ 仍受保护 | `application/manifest+json` ✅ 放行 | `image/png` ✅ 放行 | `image/svg+xml` ✅ 放行 |
| 正确 cookie | 应用 ✅ | 应用资源 ✅ | 正常 ✅ | 正常 ✅ | 正常 ✅ |

## 怎么部署

```bash
sudo bash "/home/agentuser/DeepSeek 2/dsh-pwa/deploy.sh"
```

脚本做四件事：拷静态文件 → 装 nginx 片段 → 幂等地插入 include（并先备份站点配置到
`/etc/nginx/sites-available/dsh.kaogong.art.bak-<时间戳>`）→ `nginx -t` 通过后 `systemctl reload nginx`。

部署后：

```bash
bash "/home/agentuser/DeepSeek 2/dsh-pwa/verify.sh"   # 不需要 root，匿名复验全部路径
```

## 怎么回滚

```bash
sudo bash "/home/agentuser/DeepSeek 2/dsh-pwa/rollback.sh"
```

恢复最近的站点配置备份（没有备份则删掉 include 行）、删除片段、`nginx -t` + reload。
`/var/www/dsh-pwa` 静态目录会保留，确认不用了再 `rm -rf`。

## 部署后在 Chrome 里怎么确认

1. 打开 `https://dsh.kaogong.art/`，输口令进入应用（**要在应用页里安装**，不是登录页——登录页本身没有 manifest 链接）。
2. `F12 → Application → Manifest`：应该能看到 name / start_url / 192 与 512 图标，无红色报错。
3. 地址栏右侧出现"安装"图标；或 `⋮ → 投放、保存和分享 → 将网页安装为应用`。
4. 装完打开的是独立窗口（无地址栏、无标签页），系统应用列表里出现 "DeepSeek Harness"。
5. 想深挖可开 `chrome://web-app-internals`，看该 origin 的 installability 判定。

## 已知边界

1. **没加 Service Worker**：Chrome 108(移动)/112(桌面) 起，菜单里的"安装"已不再要求 fetch handler，所以本次不需要；
   而且 SW 挂在门禁后面有风险（缓存的应用外壳可能被未登录访问拿到）。要 `beforeinstallprompt`
   自定义安装按钮时才需要补 SW，届时再单独设计。
2. **登录页仍不可安装**：它由 njs 生成，head 里没有 manifest 链接。要的话可以在 `dsh_gate.js` 的
   `page()` 里加一行 `<link rel="manifest" href="/manifest.webmanifest">`（另需更新 `tests/test_gate.js` 并重新部署）。
3. **图标是从 DSH 前端 `favicon.svg` 现渲染的**：`tools/make-icons.mjs` 可直接重跑（`npm i sharp` 后
   `node tools/make-icons.mjs`）。**当前配色是白底 + 黑鲸鱼**（与 `favicon.svg` 一致），
   要换配色用环境变量即可：`ICON_BG=#4D6BFE ICON_FG=#ffffff node tools/make-icons.mjs`（蓝底白鲸）。
   DSH 升级换了品牌标识时，记得重跑并把 `/var/www/dsh-pwa/icons/` 覆盖一次。
   换图标后如果手机/Chrome 还显示旧图，把 manifest 里的 `?v=N` 递增一次（现在图标 URL 带 `?v=2`），
   缓存策略下 manifest 5 分钟就刷新，图标本身缓存 7 天——用版本号绕过即可。
4. **manifest 由 nginx 提供**（不经 DSH）。DSH 升级不会覆盖它，但两边若要一致也得手工同步。
