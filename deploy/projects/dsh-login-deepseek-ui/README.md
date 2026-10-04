# dsh.kaogong.art 登录页改造（DeepSeek 官网风格）

## 改了什么

`https://dsh.kaogong.art` 的门禁登录页由 nginx njs 模块 `/etc/nginx/njs/dsh_gate.js` 提供。
本次只替换该文件，**nginx 站点配置、限流、TLS、代理行为均未改动**。

- UI 换成 DeepSeek Harness 官网的视觉语言：官网上抓取的鲸鱼 logo（`/harness/favicon.svg` 的原始 path）、
  品牌蓝 `#3964FE`（浅色）/`#5686FE`（深色）、`--dsw-static-neutral-bluish-*` 灰阶、圆角卡片 + 极淡点阵背景。
- 图标（页面里的 logo 与浏览器标签 favicon）按官网 logo chip 的做法重做：**白色圆角方块 + 黑色鲸鱼**，
  白底加 1px 极淡描边以便在白卡片上仍有轮廓；鲸鱼缩到方块的 82% 留出内边距。
  深色模式下白底压暗为 `#F0F2F5`，黑鲸鱼保持不变，避免暗背景上出现刺眼纯白块（与官网 favicon 同策略）。
- 表单：访问口令输入框（含显示/隐藏眼睛按钮）+「进入」主按钮；错误时红色提示条 + 卡片轻微抖动。
- 样式跟随系统深/浅色（`prefers-color-scheme`），支持 `prefers-reduced-motion`，移动端不触发 iOS 输入缩放。
- 右上角可切换 中文 / English，选择会在登录成功后写入 `dsh_lang` cookie。
- 无外部资源：logo 与 favicon 全部内联为 SVG / data-URI，登录页离线也能正常显示。

## 登录行为

- 口令仍是 `SALT + 口令 → SHA-256 → PHASH` 比对，`/dsh-login` 只需口令，无用户名。
- **口令 `__GATE_PASSPHRASE__` 与改造前完全一致**（旧 PHASH 即为它的哈希），所以：
  - 已登录过、浏览器里存有 `dsh_gate` cookie 的设备仍然是**免密直进**，不需要重新登录；
  - 新设备输入该口令后，`dsh_gate` cookie 有效期 1 年（`Max-Age=31536000`），同样实现「输入一次、之后免密」。
- 「在本设备上记住我」复选框默认勾选；取消勾选只影响前端提示，cookie 策略由服务端统一为 1 年。
- **2026-10-04 起 `SameSite` 由 `Strict` 改为 `Lax`**（见下方变更记录）：`Strict` 会导致"从微信/QQ 等 App
  点链接进入、或 iOS 从桌面图标启动 PWA"时浏览器**不发送** cookie，从而被要求重新输口令。

## 部署与回滚

```bash
# 生效中的文件
/etc/nginx/njs/dsh_gate.js     # root:root 0600
# 当前校验值（2026-10-04 起 = SameSite=Lax 版，与 dsh_gate.js.samesite-lax 一致）
1c3b01c4bf2b9a1295159fdc3c408703dbfd3a43fb154ac3bd09e225b6a75c1e
# 历史值（SameSite=Strict 版，已被取代）
5285fca0899f3e426ccc823a1596a8ecee5f61eb96b55545599d73ab7b377266
```

部署/回滚全部由脚本完成（一键、带备份与 `nginx -t` 失败自动回滚）：

```bash
sudo bash apply-auth-fixes.sh            # 干跑
sudo bash apply-auth-fixes.sh --apply    # 执行（备份在 /var/backups/dsh-auth-fix-<时间戳>/）
# 单独回滚门禁脚本：
sudo cp /var/backups/dsh-auth-fix-<时间戳>/dsh_gate.js /etc/nginx/njs/dsh_gate.js
sudo chown root:root /etc/nginx/njs/dsh_gate.js && sudo chmod 600 /etc/nginx/njs/dsh_gate.js
sudo nginx -t && sudo systemctl reload nginx
```

回滚（需 root）：

```bash
cp dsh_gate.js.original-20261003 /etc/nginx/njs/dsh_gate.js
chown root:root /etc/nginx/njs/dsh_gate.js && chmod 600 /etc/nginx/njs/dsh_gate.js
nginx -t && nginx -s reload
```

注意：njs 模块在 worker 启动时载入，**改完必须 reload**，否则仍执行旧的 JS。

## 验证记录

- `tests/test_gate.js`：Node 端行为回归（gate 判定、页面渲染、图标结构、错误/成功分支、cookie 属性、参数解析），全部通过。
- `tests/browser_e2e.js`：真实 Chromium 通过 CDP 走完整流程 —— 匿名访问得到登录页 → 输错口令回到
  `/dsh-login?e=1` 且错误条可见、不写 cookie → 输入正确口令 303 跳回 `/` 并写入 1 年 HttpOnly/Secure/
  SameSite=Strict cookie → 刷新免密进入应用，全部通过。
- `screenshots/`：浅色、深色、错误态、移动端、英文五种实拍（截图直接取自线上页面）。

## 2026-10-04 变更记录（四项，均已上线并验证）

起因：用户反馈「很多设备已经输过口令，再次进入时仍被要求输口令」。排查结论：**不是门禁遗忘设备**
（`SECRET`/`SALT`/`PHASH` 三个常量与旧版完全一致，cookie 仍是 1 年），而是三个"cookie 带不回来"的环节：

| # | 改动 | 解决的问题 |
|---|---|---|
| **A** | `dsh_gate` cookie `SameSite=Strict → Lax` | 从微信/QQ 等 App 点链接、或 iOS 桌面图标启动 PWA 时浏览器不发送 cookie，导致被要求重新输口令 |
| **A+** | 站点配置加 `map $cookie_dsh_gate $dsh_gate_refresh` + `location /` 内 `add_header Set-Cookie $dsh_gate_refresh;` | **存量设备零动作迁移**到 Lax：已授权的请求会被重新签发新属性，无需再输一次口令 |
| **B** | `dsh-pair-sync.timer` 由「每天 04:30」改为**每 5 分钟**；脚本换成"仅在 cookie 变化时才写文件 + reload nginx"的优化版 | 每次 harness 重启后注入用 token cookie 失效，原本要等到次日 04:30 才恢复（重启后所有设备被 DSH 要求登录） |
| **C** | `conf.d/dsh-login-limit.conf` 声明 `limit_req_zone zone=dsh_login rate=5r/m`，`location = /dsh-login` 内启用 `burst=5 nodelay` + `limit_req_status 429` | 免密方案下口令可被在线爆破（原"已知遗留 1"） |

**A+ 的两个实现要点（第一版踩过的坑，务必保留）**：

1. map 的 **key 必须短**。第一版把 64 字符的 `SECRET` 直接当 key，触发 nginx 默认
   `map_hash_bucket_size=64` 的限制：`[emerg] could not build map_hash`。现改为短正则
   `"~^[a-f0-9]{64}$"`（17 字符）。
2. **不能把 `SECRET` 写进站点配置**。`/etc/nginx/sites-available/dsh.kaogong.art` 是 644 世界可读，
   写进去等于把"免密凭据"泄露给本机任何用户。现值改为原样回填 `$cookie_dsh_gate`；
   而是否真的放行仍由 njs 门禁按 `SECRET` 严格判定（伪造别的 64 位十六进制值只会拿到它自己，无访问权）。

**上线后实测（curl 端到端）**：

```
匿名访问                 -> 200（登录页），无任何 Set-Cookie
带正确 dsh_gate          -> 200 + set-cookie: dsh_gate=…; Max-Age=31536000; Secure; HttpOnly; Path=/; SameSite=Lax
带伪造的 64 位十六进制值  -> 200（仍要求登录）、无换发（401 后走 /dsh-login 分支，add_header 不参与）
/dsh-login 连打 8 次     -> 前 3 次 200，第 4 次起 429
带 cookie 访问主应用     -> 200（未被限流误伤）
```

## 已知遗留（更新于 2026-10-04）

1. ~~`/dsh-login` 无限流~~ → **已修**（见上表 C，实测第 4 次起 429）。
2. ~~`dsh_inject_cookie` 是 token 型 cookie，轮换需与 DSH 进程一致~~ → **已缓解**：
   配对同步改为**每 5 分钟**一次，且脚本只在 cookie 真的变化时才 reload nginx。
   仍存在的固有特性：harness 重启会产生新 token，最多 5 分钟内自动恢复。
3. 另有一处非本站点问题：DSH 云的备用入口 `ins-21adb….dsh.lightvela.tech` 解析到 **43.140.151.18**
   （非本机），**不经过本站门禁**，其 cookie 与 `dsh.kaogong.art` 完全不共享。若某些设备使用该网址，
   需单独登录，且本站口令对其无效。
2. `dsh_inject_cookie`（snippets/dsh-session.conf）是 token 型 cookie，若轮换需与 DSH 进程一致，本次未改。
