#!/usr/bin/env bash
# =====================================================================
#  修复 2026-10-03「chown -R agentuser」事故
#
#  事故现象：/var/lib /var/log /var/www /var/run /dev/shm /tmp /var/tmp
#           /var/backups /opt /usr/local/bin 等被整体改成 agentuser 属主，
#           导致以其他身份运行的服务无法访问自己的数据目录：
#            - PostgreSQL：数据目录 700 agentuser，postgres 用户读不到
#              → 所有新连接 FATAL: could not open file "global/pg_filenode.map"
#            - kaogong-api（www-data）：SQLite 目录 750 agentuser，重启即失败
#            - wanyu-api（www-data）：日志目录不可写
#            - redis（redis）：数据目录/日志不可写
#            - fail2ban：/etc/fail2ban/jail.local 缺 [DEFAULT] 段头（另一处故障）
#            - logrotate：日志轮转产物属主被污染，服务退出码 1
#
#  用法：
#     sudo bash fix-chown-20261003.sh            # 干跑，只打印将要做什么
#     sudo bash fix-chown-20261003.sh --apply    # 真正执行
#     sudo bash fix-chown-20261003.sh --apply --harden   # 附带关闭提权后门
#
#  说明：脚本可重复执行（幂等）；每一步失败会继续，最后统一汇报。
# =====================================================================
set -uo pipefail

APPLY=0
HARDEN=0
for arg in "$@"; do
  case "$arg" in
    --apply)  APPLY=1 ;;
    --harden) HARDEN=1 ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "未知参数: $arg（可用: --apply --harden）"; exit 2 ;;
  esac
done

if [ "$APPLY" -eq 1 ] && [ "$(id -u)" -ne 0 ]; then
  echo "错误：--apply 需要 root 权限，请用 sudo 运行。"
  exit 1
fi

LOG="/var/log/fix-chown-$(date +%Y%m%d-%H%M%S).log"
if [ "$APPLY" -eq 1 ]; then
  : > "$LOG" 2>/dev/null || LOG=/tmp/fix-chown-$(date +%Y%m%d-%H%M%S).log
fi

ok=0; fail=0; steps=0
say()  { printf '%s\n' "$*"; }
head1() { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }

# run "描述" 命令...
run() {
  local desc="$1"; shift
  steps=$((steps+1))
  if [ "$APPLY" -eq 1 ]; then
    printf '  [执行] %s\n' "$desc"
    if "$@" >>"$LOG" 2>&1; then ok=$((ok+1)); else fail=$((fail+1)); printf '         \033[33m⚠ 失败\033[0m（详见 %s）\n' "$LOG"; fi
  else
    printf '  [干跑] %s\n' "$desc"
  fi
}

chown_tree() { # chown_tree <owner:group> <path>...
  local owner="$1"; shift
  local p
  for p in "$@"; do
    [ -e "$p" ] || continue
    run "chown -R $owner $p" chown -R "$owner" "$p"
  done
}

chown_one() { # chown_one <owner:group> <path>...
  local owner="$1"; shift
  local p
  for p in "$@"; do
    [ -e "$p" ] || continue
    run "chown $owner $p" chown "$owner" "$p"
  done
}

chmod_one() { # chmod_one <mode> <path>...
  local mode="$1"; shift
  local p
  for p in "$@"; do
    [ -e "$p" ] || continue
    run "chmod $mode $p" chmod "$mode" "$p"
  done
}

# ---------------------------------------------------------------------
head1 "0. 现状快照"
say "  运行身份: $(id -un) (uid=$(id -u))   模式: $([ $APPLY -eq 1 ] && echo 执行 || echo 干跑)  加固: $([ $HARDEN -eq 1 ] && echo 开 || echo 关)"
say "  日志: $LOG"
say "  失败服务: $(systemctl --failed --no-pager --plain 2>/dev/null | grep -c '\.service' || true) 个"

# ---------------------------------------------------------------------
head1 "1. PostgreSQL（优先修；已能查询则自动跳过）"
PG_OK=0
if [ "$APPLY" -eq 1 ]; then
  timeout 15 su -s /bin/bash postgres -c 'psql -tAc "select 1"' >/dev/null 2>&1 && PG_OK=1
else
  [ "$(stat -c %U /var/lib/postgresql/16/main 2>/dev/null)" = "postgres" ] && PG_OK=1
fi
if [ "$PG_OK" -eq 1 ]; then
  say "  PostgreSQL 已可正常查询 → 跳过停止/改属主/启动（避免多余的一次停启）"
else
  # 日志目录必须先能写：pg_ctlcluster 会以 postgres 身份打开这里的日志文件
  chown_tree "postgres:adm" /var/log/postgresql
  run "清理残留的 postmaster.pid" bash -c 'rm -f /var/lib/postgresql/16/main/postmaster.pid'
  run "停止 postgresql@16-main" timeout 90 systemctl stop postgresql@16-main
  run "清理 /dev/shm 中属主错误的共享内存段" bash -c 'rm -f /dev/shm/PostgreSQL.*'
  chown_tree "postgres:postgres" /var/lib/postgresql
  chown_one  "postgres:postgres" /run/postgresql
  chmod_one  "2775" /run/postgresql
  run "启动 postgresql@16-main" timeout 90 systemctl start postgresql@16-main
  run "冒烟测试: SELECT 1（15 秒超时，不会卡住）" \
      timeout 15 su -s /bin/bash postgres -c 'psql -tAc "select 1"'
fi

# ---------------------------------------------------------------------
head1 "2. Redis（数据与日志当前不可写，随时可能丢 RDB）"
chown_tree "redis:redis" /var/lib/redis /var/log/redis
chown_one  "redis:redis" /run/redis 2>/dev/null || true
run "触发一次 BGSAVE 验证持久化" redis-cli bgsave

# ---------------------------------------------------------------------
head1 "3. 业务服务数据目录（按各自的 systemd User= 还原）"
# kaogong-api.service -> User=www-data，SQLite 需要可写目录
chown_tree "www-data:www-data" /var/lib/kaogong-api
chmod_one  "750" /var/lib/kaogong-api
run "重启 kaogong-api（重启后仍能打开数据库才算修好）" systemctl restart kaogong-api

# wanyu-api.service -> User=www-data
chown_tree "www-data:adm" /var/log/wanyu
# wanyu 的监控/巡检由 root cron 执行，数据目录归 root
chown_tree "root:root" /var/lib/wanyu-patrol /var/lib/wanyu-monitor

# ---------------------------------------------------------------------
head1 "4. /var/log 属主与属组还原"
# 4.1 /var/log 顶层仍是 agentuser 的条目，先统一回 root:adm
run "顶层日志归 root:adm" bash -c 'find /var/log -maxdepth 1 -user agentuser -exec chown root:adm {} +'
# 4.2 特殊归属覆盖（必须在上面之后执行）
chown_one  "root:utmp"            /var/log/btmp /var/log/btmp.1 /var/log/wtmp /var/log/lastlog
run "btmp/wtmp 历史轮转文件归 root:utmp" bash -c 'find /var/log -maxdepth 1 \( -name "btmp.*" -o -name "wtmp.*" -o -name "lastlog.*" \) -user agentuser -exec chown root:utmp {} +'
chown_tree "root:systemd-journal" /var/log/journal
chown_tree "root:adm"             /var/log/unattended-upgrades /var/log/fail2ban.log.1 /var/log/fail2ban.log.2.gz
chown_tree "root:root"            /var/log/letsencrypt /var/log/alternatives.log
chown_tree "postgres:adm"         /var/log/postgresql
run "postgres 日志补属组" bash -c 'find /var/log/postgresql -user root -exec chgrp adm {} +'
chown_one  "root:adm"             /var/log/qcloud_action.log /var/log/kagong-maintenance.log

# ---------------------------------------------------------------------
head1 "5. /var/lib 系统目录还原（递归，仅限系统自身目录）"
SYS_LIB_DIRS="app-info apport apt aptitude boltd ca-certificates-java chrony cloud \
command-not-found dbus dhcpcd dpkg git grub ieee-data kdump landscape libuuid logrotate \
man-db misc os-prober PackageKit pam plymouth polkit-1 private python selinux sgml-base \
snapd sudo swcatalog systemd tpm ubuntu-advantage ubuntu-drivers-common ubuntu-fan \
ubuntu-release-upgrader ucf udisks2 unattended-upgrades update-manager update-notifier \
upower usb_modeswitch vim xml-core fail2ban letsencrypt docker containerd"
for d in $SYS_LIB_DIRS; do
  chown_tree "root:root" "/var/lib/$d"
done
# apt 的两个 partial 目录必须是 _apt:root（否则 apt update 会失败）
chown_tree "_apt:root" /var/lib/apt/lists/partial /var/cache/apt/archives/partial

# ---------------------------------------------------------------------
head1 "6. /run 与 /dev/shm 还原（不改 /run/user/*）"
run "顶层 /run 条目归 root:root（跳过 /run/user、postgresql、redis）" bash -c \
  'find /run -maxdepth 2 -user agentuser \
     ! -path "/run/user/*" ! -path "/run/postgresql*" ! -path "/run/redis*" \
     -exec chown root:root {} +'
chown_one "root:root" /run /run/lock /dev/shm /tmp /var/tmp /var/lib /var/backups /var/www

# ---------------------------------------------------------------------
head1 "7. 其它目录本体还原"
chown_one "root:root" /var /var/cache
chmod_one "1777" /tmp /var/tmp /dev/shm
chmod_one "1775" /run/lock
chown_tree "root:root" /var/backups

# ---------------------------------------------------------------------
head1 "8. fail2ban 修复（jail.local 缺 [DEFAULT] 段头，服务启动即失败）"
if [ "$APPLY" -eq 1 ]; then
  if [ -f /etc/fail2ban/jail.local ] && ! grep -q '^\[' /etc/fail2ban/jail.local; then
    cp -a /etc/fail2ban/jail.local "/etc/fail2ban/jail.local.bak-$(date +%Y%m%d-%H%M%S)"
    printf '[DEFAULT]\n%s\n' "$(cat /etc/fail2ban/jail.local)" > /etc/fail2ban/jail.local
    chown root:root /etc/fail2ban/jail.local
    say "  已补写 [DEFAULT] 段头并备份原文件"
  else
    say "  jail.local 已有段头，跳过"
  fi
else
  say "  [干跑] 给 /etc/fail2ban/jail.local 补 [DEFAULT] 段头（先备份）"
fi
chown_tree "root:root" /var/lib/fail2ban
run "重启 fail2ban" systemctl restart fail2ban

# ---------------------------------------------------------------------
head1 "9. logrotate 修复与轮转验证"
chown_tree "root:root" /var/lib/logrotate
run "启动一次 logrotate" systemctl start logrotate
run "若上面失败，用 -v 打出真实报错：logrotate -v /etc/logrotate.conf" \
    bash -c '/usr/sbin/logrotate -v /etc/logrotate.conf 2>&1 | tail -20'

# ---------------------------------------------------------------------
head1 "10. 磁盘收尾"
if [ -f /swapfile-build ]; then
  run "卸载并删除废弃的 /swapfile-build（释放 1G）" bash -c 'swapoff /swapfile-build && rm -f /swapfile-build'
fi
run "压缩 systemd journal 到 100M" journalctl --vacuum-size=100M
run "清理 apt 缓存" bash -c 'apt-get clean'

# ---------------------------------------------------------------------
if [ "$HARDEN" -eq 1 ]; then
  head1 "11. 加固：关闭 agentuser → root 的提权路径（--harden）"
  say "  以下路径当前是「root 运行、agentuser 可写」= 等于 agentuser 就是 root："
  say "    · /usr/local/bin（3 个被 root cron 调用的脚本在这里）"
  say "    · /usr/local/sbin/dsh-pair-sync.sh、dsh-profile-heal.sh（root systemd 服务）"
  say "    · /opt/workbuddy-manager（root 服务 workbuddy-web 的代码与 venv）"
  say "    · /opt/quota-dashboard（root 服务 quota-dashboard 的代码）"
  say "    · /usr/local/qcloud/tat_agent（root 服务 tat_agent 的二进制）"
  chown_one  "root:root" /usr/local/bin /usr/local/sbin
  run "root cron 脚本收归 root" bash -c \
    'chown root:root /usr/local/bin/kagong-maintenance.sh /usr/local/bin/wanyu-patrol /usr/local/bin/wanyu-restore-drill 2>/dev/null; chmod 755 /usr/local/bin/kagong-maintenance.sh /usr/local/bin/wanyu-patrol /usr/local/bin/wanyu-restore-drill 2>/dev/null; true'
  chown_one  "root:root" /usr/local/sbin/dsh-pair-sync.sh /usr/local/sbin/dsh-profile-heal.sh
  chown_tree "root:root" /opt/workbuddy-manager /opt/quota-dashboard /usr/local/qcloud/tat_agent
  say "  注意：docker.sock 与 /run/docker.sock 未改动，agentuser 仍可免 sudo 使用 docker。"
else
  head1 "11. 加固（本次未启用，加 --harden 可关闭提权后门）"
  say "  预览：/usr/local/bin、/usr/local/sbin、/opt/workbuddy-manager、/opt/quota-dashboard"
  say "        会收归 root:root；它们都是「root 运行 + agentuser 可写」。"
fi

# ---------------------------------------------------------------------
head1 "12. 验证"
say "  --- 失败服务 ---"
systemctl --failed --no-pager --plain 2>/dev/null | head -8 | sed 's/^/  /'
say "  --- PostgreSQL ---"
systemctl is-active postgresql@16-main 2>/dev/null | sed 's/^/  active: /'
pg_isready -q -h /var/run/postgresql && say "  pg_isready: OK" || say "  pg_isready: \033[31m连接仍在失败\033[0m"
if [ "$APPLY" -eq 1 ]; then
  timeout 15 su -s /bin/bash postgres -c 'psql -tAc "select 1"' 2>&1 | head -3 | sed 's/^/  select 1 -> /'
fi
say "  --- Redis ---"
redis-cli ping 2>&1 | sed 's/^/  ping: /'
say "  --- fail2ban ---"
fail2ban-client status 2>&1 | head -3 | sed 's/^/  /'
say "  --- 关键属主 ---"
for p in /tmp /var/lib /var/lib/postgresql /var/lib/kaogong-api /run /dev/shm /var/log; do
  stat -c '  %A %U:%G  %n' "$p" 2>/dev/null
done
say "  --- 业务探活 ---"
for u in http://127.0.0.1:8787/api/health https://kaogong.art/ https://dsh.kaogong.art/; do
  printf '  %-38s -> %s\n' "$u" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "$u" 2>/dev/null)"
done
say "  --- 资源 ---"
free -h | sed 's/^/  /'
df -h / | sed 's/^/  /'

head1 "完成"
if [ "$APPLY" -eq 1 ]; then
  say "  已执行 $steps 步：成功 $ok，失败 $fail。日志：$LOG"
  say "  建议：再单独验证一次重启安全性 —— 只重启服务，不要直接重启机器。"
  say "    例如 systemctl restart nginx postgresql@16-main redis-server kaogong-api fail2ban"
else
  say "  这是干跑，未做任何修改。确认无误后执行："
  say "    sudo bash \"$0\" --apply"
  say "  想同时关掉提权后门："
  say "    sudo bash \"$0\" --apply --harden"
fi
