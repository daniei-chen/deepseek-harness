# DSH 升级手册：0.2.0-rc.2 → 0.2.1-alpha.1

> 制作于 2026-10-04。每一步都可单独验证；**只有步骤 4 会切换版本**，之前的步骤都不影响现役服务。

---

## 背景（为什么上次失败了）

| | |
|---|---|
| 上次尝试 | 今天 02:36 跑 `stage.sh`，失败，`releases/0.2.1-alpha.1-manual` 是空目录 |
| **真因** | **不是缺包**。`pnpm` 的 store 被 root 污染——`~/.local/share/pnpm/store` 里有 **21800 个 root 属主文件**（那次 pnpm 是以 root + `HOME=/home/agentuser` 跑的），之后 agentuser 再 install 就 `ERR_PNPM_EACCES` |
| 已验证 | 换用干净 store 重跑，**45.5 秒装好**，含 `koffi` / `node-pty` / `dsh-subprocess-local` 三个原生构建，`dsh = 0.2.1-alpha.1` |
| 现在的状态 | profile 已是 0.2.1 状态（pin + cosmokit 1.8.6-alpha.1 + schemastery 3.18.5-alpha.1），runtime 还是 0.2.0-rc.2 → **混合状态** |

---

## 步骤 0：修 store（必须做，顺带修一个隐患）

```bash
sudo chown -R agentuser:agentuser /home/agentuser/.local/share/pnpm/store
find /home/agentuser/.local/share/pnpm/store -user root | wc -l    # 期望输出 0
```

**为什么必须**：WebUI 里装/升级插件走的也是这个 store。store 被污染时，插件安装同样会 `ERR_PNPM_EACCES` —— 这是个随时可能踩到的隐患，不只是升级问题。

---

## 步骤 1：把装好的 0.2.1 树放进 releases/（需要 root）

我已经在 `/tmp/dsh-stage-test2` 装好了一份完整、经过验证的 0.2.1-alpha.1 运行树（528M，含 `node_modules/.bin/dsh`）。

```bash
# ⚠️ 三行必须一起执行：只 chown 不改权限，服务会读不了自己的代码
sudo cp -a /tmp/dsh-stage-test2/. /opt/lightvela/dsh/releases/0.2.1-alpha.1-manual/
sudo chown -R root:root /opt/lightvela/dsh/releases/0.2.1-alpha.1-manual
sudo chmod -R a+rX   /opt/lightvela/dsh/releases/0.2.1-alpha.1-manual
```

> 为什么要 `chmod -R a+rX`：我去 stage 时用的是 agentuser 身份，umask 是 077 → 文件是 `600`、目录是 `700`；而现役 release 是 `644 root:root / 755`。服务以 **agentuser** 身份运行，拷贝后如果不放开读权限，它会打不开自己的文件。`a+rX` 只加"读"和"目录/已有可执行位的 x"，不会给普通文件乱加执行权限。

**验证：**

```bash
stat -c '%a %U:%G %n' /opt/lightvela/dsh/releases/0.2.1-alpha.1-manual/package.json
# 期望：644 root root
sudo -u agentuser test -r /opt/lightvela/dsh/releases/0.2.1-alpha.1-manual/node_modules/.bin/dsh && echo "服务可读 ✔"
```

---

## 步骤 2：profile 收尾（agentuser 身份，不需要 root）

```bash
bash "/home/agentuser/DeepSeek 2/dsh-upgrade-021/apply-profile.sh" \
     "/home/agentuser/.dsh/profiles/web/local/plugins/dsh-android-dsh-client-ui-responsive-0.3.4-dsh021.1.tgz"
```

它会：把 `dsh-credentials-local` 升到 0.2.1-alpha.1 → 装上移动端适配插件 → 检查 `cordis.patch.yml`（已 patched 则跳过）。**自动备份**到 `~/.dsh/profiles/web/local/backups/upgrade-<时间戳>/`，**且不重启服务**。

---

## 步骤 3：同步看门狗的备用零件库（需要 root）

```bash
sudo cp -a /home/agentuser/.dsh/profiles/web/node_modules/@deepseek-ai/cosmokit \
           /home/agentuser/.dsh/profiles/web/node_modules/@deepseek-ai/schemastery \
           /home/agentuser/.dsh/profiles/web/node_modules/@deepseek-ai/dsh-credentials-local \
           /usr/local/share/dsh-profile-stash/@deepseek-ai/
sudo chown -R root:root /usr/local/share/dsh-profile-stash
```

**为什么**：`dsh-profile-heal` 看门狗从 stash 恢复丢失的包。stash 现在还是 0.2.0 时代的版本（cosmokit 1.8.5 / schemastery 3.18.4），一旦触发 heal，会把升到 0.2.1 的 profile **降级**回旧包。

---

## 步骤 4：切换版本并重启（⚠️ 页面会断几十秒，对话不丢）

> 步骤 2/3/4 建议**连着做别停**——中间那段时间 profile 已是 0.2.1 而 runtime 还是 rc.2，若恰好触发看门狗可能起不来。

```bash
sudo ln -sfn /opt/lightvela/dsh/releases/0.2.1-alpha.1-manual /opt/lightvela/dsh/current
sudo systemctl restart deepseek-harness
```

**验证：**

```bash
readlink -f /opt/lightvela/dsh/current          # 应指向 0.2.1-alpha.1-manual
systemctl is-active deepseek-harness            # active
bash "/home/agentuser/DeepSeek 2/verify-server-health.sh"   # 期望 32/0
ls -t /home/agentuser/.dsh/logs/startup-*.log | head -1     # 启动日志应为空或只有旧时间戳
```

---

## 回滚（步骤 4 之后如果起不来）

**通过 SSH 或腾讯云控制台**执行（WebUI 此时可能打不开）：

```bash
# 1) 切回旧 runtime
sudo ln -sfn /opt/lightvela/dsh/releases/0.2.0-rc.2-da8e5035082a-bced78b8 /opt/lightvela/dsh/current

# 2) 把 profile 也退回去（用 apply-profile.sh 自动留的备份）
BK=$(ls -dt /home/agentuser/.dsh/profiles/web/local/backups/upgrade-* | head -1)
cp -a "$BK"/.pnpmfile.cjs "$BK"/package.json "$BK"/cordis.patch.yml "$BK"/pnpm-lock.yaml \
      /home/agentuser/.dsh/profiles/web/
cd /home/agentuser/.dsh/profiles/web && \
  /opt/lightvela/dsh/tooling/pnpm-10.33.0/node_modules/.bin/pnpm install --no-frozen-lockfile

# 3) 重启
sudo systemctl restart deepseek-harness
```

---

## 收尾清理（升级成功后）

```bash
rm -rf /tmp/dsh-stage-test /tmp/dsh-stage-test2 /tmp/dsh-store-test   # 共 610M
```

> 删掉 `/tmp/dsh-store-test` 不会影响已装好的树：pnpm 用的是硬链接，release 里的文件是独立存在的。

---

## 一句话总结每步的风险

| 步骤 | 风险 | 可回滚 |
|---|---|---|
| 0 修 store | 无 | 无需 |
| 1 拷贝 release | 无（`current` 还没动） | 删目录即可 |
| 2 profile 收尾 | 低（profile 变 0.2.1，但服务未重启） | 有自动备份 |
| 3 更新 stash | 无 | 需手动 |
| 4 切软链+重启 | **这一步才是真正切换** | 见上 |
