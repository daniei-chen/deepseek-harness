#!/usr/bin/env bash
# =====================================================================
#  服务器健康检查（免 root）
#
#  针对 2026-10-03 chown 事故修复后的状态做回归检查。
#  建议在每次重启机器后跑一次：bash verify-server-health.sh
#
#  退出码：0 = 全部通过；1 = 有项目异常
# =====================================================================
pass=0; fail=0
ok()   { printf '  \033[32m✔\033[0m %s\n' "$1"; pass=$((pass+1)); }
bad()  { printf '  \033[31m✘\033[0m %s\n' "$1"; fail=$((fail+1)); }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
sec()  { printf '\n\033[1;36m== %s ==\033[0m\n' "$1"; }

# 判断 agentuser 能不能写某个路径——**按权限位计算**，绝不用 [ -w ]
# （[ -w ] 的结果取决于"当前运行者"，用 sudo 跑会对每个路径都返回真 → 误报）
writable_by_agentuser() {
  local p="$1" mode owner group
  read -r mode owner group < <(stat -c '%a %U %G' "$p" 2>/dev/null) || return 1
  if [ "$owner" = agentuser ] && [ $(( 8#$mode & 0200 )) -ne 0 ]; then return 0; fi
  if [ "$group" = agentuser ] && [ $(( 8#$mode & 0020 )) -ne 0 ]; then return 0; fi
  [ $(( 8#$mode & 0002 )) -ne 0 ] && return 0
  return 1
}

sec "0. 运行身份"
printf '  当前身份：%s (uid=%s)\n' "$(id -un)" "$(id -u)"
if [ "$(id -u)" = "0" ]; then
  warn "以 root/sudo 运行：涉及「agentuser 能不能写」的判断会失真，建议去掉 sudo 重跑"
fi

sec "1. 失败的服务"
failed=$(systemctl --failed --no-pager --plain 2>/dev/null | awk '/\.service/ {print $1}')
if [ -z "$failed" ]; then
  ok "没有失败的服务"
else
  for u in $failed; do
    [ "$u" = "wanyu-backup.service" ] && warn "$u 失败（已知的老问题：备份自 9/28 起未产出 bundle）" \
                                      || bad "$u 处于 failed 状态"
  done
fi

sec "2. 关键服务运行状态"
for s in postgresql@16-main redis-server nginx kaogong-api fail2ban systemd-resolved docker workbuddy-web deepseek-harness; do
  st=$(systemctl is-active "$s" 2>/dev/null)
  [ "$st" = "active" ] && ok "$s = active" || bad "$s = $st"
done

sec "3. PostgreSQL 可用性"
if pg_isready -q 2>/dev/null; then ok "pg_isready = accepting connections"; else bad "pg_isready 失败"; fi
out=$(timeout 8 psql "host=127.0.0.1 port=5432 user=postgres connect_timeout=5" -c 'select 1' 2>&1 | tail -1)
case "$out" in
  *fe_sendauth*|*password*|*"no password supplied"*) ok "服务端能处理查询（已走到认证层）" ;;
  *pg_filenode.map*|*Permission\ denied*) bad "数据目录权限又坏了：$out" ;;
  *) warn "连接结果需人工确认：$out" ;;
esac

sec "4. Redis"
r=$(redis-cli ping 2>&1)
[ "$r" = "PONG" ] && ok "redis-cli ping = PONG" || bad "redis 无响应：$r"

sec "5. HTTP 端点"
for u in https://kaogong.art/ https://dsh.kaogong.art/ http://127.0.0.1:8787/api/health; do
  c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$u" 2>/dev/null)
  [ "$c" = "200" ] && ok "$u -> $c" || bad "$u -> $c"
done

sec "6. 关键属主（这次事故的核心）"
chk_owner() { # chk_owner <路径> <期望属主[:属组]>
  local cur; cur=$(stat -c '%U:%G' "$1" 2>/dev/null)
  [ "$cur" = "$2" ] && ok "$1 = $cur" || bad "$1 = ${cur:-读不到}（应为 $2）"
}
chk_owner /tmp                     root:root
chk_owner /run                     root:root
chk_owner /var/lib                 root:root
chk_owner /dev/shm                 root:root
chk_owner /var/lib/postgresql/16/main postgres:postgres
chk_owner /run/postgresql          postgres:postgres
chk_owner /var/lib/redis           redis:redis
chk_owner /run/redis               redis:redis
chk_owner /var/lib/kaogong-api     www-data:www-data
chk_owner /etc/ssl/private         root:ssl-cert
chk_owner /etc/redis               root:redis
chk_owner /etc/postgresql/16/main  postgres:postgres

sec "7. 会阻塞重启的残留文件"
blockers=0
for f in /run/postgresql/.s.PGSQL.5432 /run/postgresql/.s.PGSQL.5432.lock /run/redis/redis-server.pid /run/systemd/resolve/io.systemd.Resolve; do
  if [ -e "$f" ]; then
    o=$(stat -c '%U' "$f" 2>/dev/null)
    case "$f" in
      /run/postgresql/*|/run/redis/*) [ "$o" = "agentuser" ] && { bad "$f 属主仍是 agentuser（重启会阻塞）"; blockers=$((blockers+1)); } ;;
      /run/systemd/resolve/*)          [ "$o" = "agentuser" ] && { bad "$f 属主仍是 agentuser（resolved 重启会失败）"; blockers=$((blockers+1)); } ;;
    esac
  fi
done
[ "$blockers" -eq 0 ] && ok "没有发现会阻塞重启的残留文件"

sec "8. 权限漂移回归（应为 0）"
n1=$(find /var/lib -user agentuser 2>/dev/null | wc -l)
n2=$(find /var/log -user agentuser 2>/dev/null | wc -l)
if [ "$n1" -eq 0 ]; then
  ok "/var/lib 无 agentuser 属主文件"
else
  bad "/var/lib 有 $n1 个 agentuser 属主文件："
  find /var/lib -user agentuser 2>/dev/null | head -5 | sed 's/^/      /'
fi
if [ "$n2" -eq 0 ]; then
  ok "/var/log 无 agentuser 属主文件"
else
  bad "/var/log 有 $n2 个 agentuser 属主文件："
  find /var/log -user agentuser -printf '      %M %u:%g %TH:%TM %p\n' 2>/dev/null | head -8
fi
# 可见性自检：读不到的目录会被 find 静默跳过，导致计数偏小（本次踩过的坑）
blind=$(for d in /var/log/*/; do d=${d%/}; { [ -r "$d" ] && [ -x "$d" ]; } || printf '%s ' "$d"; done)
if [ -n "${blind// /}" ]; then
  warn "以下目录当前身份读不到，上面的 /var/log 计数可能偏小："
  printf '      %s\n' "$blind"
  printf '      用 root 复核：sudo find /var/log -user agentuser -printf "%%M %%u:%%g %%p\\n"\n'
fi

sec "9. 已知未决项"
b=$(find /var/backups /opt/wanyu -name '*.bundle' 2>/dev/null | wc -l)
[ "$b" -gt 0 ] && ok "找到 $b 个 wanyu 备份 bundle" \
               || warn "wanyu 备份 bundle 数量为 0（已确认是你主动删除，备份定时器已停用）"
backdoors=""
for p in /usr/local/bin /usr/local/sbin /opt/workbuddy-manager /opt/quota-dashboard /usr/local/qcloud/tat_agent; do
  [ -e "$p" ] || continue
  writable_by_agentuser "$p" && backdoors="$backdoors $p"
done
if [ -n "$backdoors" ]; then
  bad "提权后门仍在（root 执行 + agentuser 可写）：$backdoors"
else
  ok "提权后门已关闭（root 执行的脚本与代码均归 root 所有）"
fi
sock_u=$(stat -c '%U' /run/docker.sock 2>/dev/null)
if [ "$sock_u" = "agentuser" ]; then
  warn "docker.sock 属主是 agentuser（非标准配置）"
else
  warn "agentuser 无 docker 权限（socket 属主 ${sock_u:-未知}，属预期）"
fi

sec "10. 系统日志链（2026-10-04 踩过的坑：rsyslog 写不进去 / logrotate 跳过日志）"
# 10.1 rsyslog 写的三个日志必须归 syslog:adm —— 归错则 rsyslog 静默写不进去（只剩 journal）
CUT=$(date -d '-60 minutes' '+%Y-%m-%d %H:%M:%S' 2>/dev/null)
for f in /var/log/syslog /var/log/auth.log /var/log/kern.log; do
  if [ -e "$f" ]; then
    cur=$(stat -c '%U:%G' "$f" 2>/dev/null)
    [ "$cur" = "syslog:adm" ] && ok "$f = syslog:adm" \
                             || bad "$f = ${cur:-?}（应为 syslog:adm，否则 rsyslog 写不进去）"
    newer=$(find "$f" -newermt "$CUT" 2>/dev/null)
    [ -n "$newer" ] || warn "$f 近 60 分钟无写入（机器空闲时正常；持续如此请查 rsyslog）"
  else
    warn "$f 不存在"
  fi
done
# 10.2 /var/log 目录属组（stock = root:syslog；若为 agentuser 会连累 logrotate 跳过日志）
lg=$(stat -c '%U:%G' /var/log 2>/dev/null)
[ "$lg" = "root:syslog" ] && ok "/var/log = root:syslog" \
                          || warn "/var/log = ${lg:-?}（stock 应为 root:syslog）"
# 10.3 关键配置是否声明了 create 显式属主
#     （缺它则轮转时"继承旧属主"——本次故障链就是：旧属主被污染 → 新文件写不进去 → 日志停写）
for c in rsyslog redis-server; do
  if grep -qE '^[[:space:]]*create ' "/etc/logrotate.d/$c" 2>/dev/null; then
    ok "/etc/logrotate.d/$c 含 create 显式属主"
  else
    bad "/etc/logrotate.d/$c 缺 create 指令（轮转可能继承错误属主，导致日志停写）"
  fi
done
# 10.4 权威检查：让 logrotate 自己说有没有在跳过日志（需免密 sudo；撤销授权后自动跳过）
if sudo -n true 2>/dev/null; then
  sk=$(sudo -n logrotate -d /etc/logrotate.conf 2>&1 | grep -c '^error: skipping')
  [ "${sk:-0}" -eq 0 ] && ok "logrotate 未跳过任何日志（-d 权威校验）" \
                       || bad "logrotate 跳过了 $sk 个日志（父目录权限 / 缺 su 声明）"
fi
# 10.5 logrotate 服务本身
[ "$(systemctl is-failed logrotate 2>/dev/null)" = "failed" ] \
  && bad "logrotate.service 处于 failed" || ok "logrotate.service 状态正常"
# 10.5 审计链（有免密 sudo 时才查，撤销授权后自动跳过）
if sudo -n test -r /var/log/auth.log 2>/dev/null; then
  n=$(sudo -n grep -c "COMMAND=" /var/log/auth.log 2>/dev/null)
  [ "${n:-0}" -gt 0 ] && ok "auth.log 有 $n 条 sudo 审计记录（审计链正常）" \
                       || warn "auth.log 暂无可读的 sudo 记录"
fi

sec "11. 资源"
free -h  | awk 'NR<=2 {printf "  %s\n", $0}'
df -h /  | awk 'NR<=2 {printf "  %s\n", $0}'
swapon --show 2>/dev/null | awk 'NR>1 {printf "  swap: %s used %s\n", $1, $4}'

printf '\n\033[1m合计：通过 %d，异常 %d\033[0m\n' "$pass" "$fail"
[ "$fail" -eq 0 ] && exit 0 || exit 1
