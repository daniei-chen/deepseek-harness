#!/usr/bin/env bash
# =====================================================================
#  DSH 回滚：0.2.1-alpha.1  →  0.2.0-rc.2
#
#  用途：升级后如果 WebUI 起不来（页面 2 分钟以上不恢复），
#        在 SSH 或腾讯云控制台执行这一条即可退回原状态：
#
#        sudo bash "/home/agentuser/DeepSeek 2/dsh-upgrade-021/rollback.sh"
#
#  它做三件事：切回旧 runtime → 恢复 profile 配置 → 重装依赖 → 重启服务
# =====================================================================
set -uo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "需要 root，请用： sudo bash \"$0\""
  exit 1
fi

OLD=/opt/lightvela/dsh/releases/0.2.0-rc.2-da8e5035082a-bced78b8
PROF=/home/agentuser/.dsh/profiles/web
BK=$PROF/local/backups/upgrade-20261004-024835      # 02:48 那份 = 升级前的 rc.2 状态
PNPM=/opt/lightvela/dsh/tooling/pnpm-10.33.0/node_modules/.bin/pnpm

echo "=========================================="
echo " 回滚前状态"
echo "=========================================="
echo "  current -> $(readlink -f /opt/lightvela/dsh/current 2>/dev/null)"
echo "  服务     = $(systemctl is-active deepseek-harness 2>/dev/null)"
echo "  时间     = $(date '+%F %T')"
echo

echo "[1/4] 切回旧 runtime"
ln -sfn "$OLD" /opt/lightvela/dsh/current
echo "      current -> $(readlink -f /opt/lightvela/dsh/current)"

echo "[2/4] 恢复 profile 配置（rc.2 时代）"
for f in .pnpmfile.cjs package.json cordis.patch.yml pnpm-lock.yaml; do
  if [ -f "$BK/$f" ]; then
    cp -a "$BK/$f" "$PROF/$f" && echo "      已恢复 $f"
  else
    echo "      ⚠ 备份里缺 $f，跳过"
  fi
done

echo "[3/4] 重装 profile 依赖（约 1 分钟）"
su -s /bin/bash agentuser -c "cd '$PROF' && '$PNPM' install --no-frozen-lockfile --config.auto-install-peers=false" 2>&1 | tail -6

echo "[4/4] 重启服务"
systemctl restart deepseek-harness
sleep 8
st=$(systemctl is-active deepseek-harness 2>/dev/null)
echo "      服务状态 = $st"
echo
if [ "$st" = "active" ]; then
  echo "✅ 回滚完成，WebUI 应已恢复（页面刷新即可）"
else
  echo "⚠ 服务仍是 $st，排查线索："
  echo "    systemctl status deepseek-harness --no-pager | head -20"
  echo "    ls -t /home/agentuser/.dsh/logs/startup-*.log | head -1 | xargs tail -40"
fi
