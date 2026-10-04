#!/bin/bash
# =====================================================================
#  dsh-pair-sync.sh（优化版）
#
#  与原版的区别：
#    1) 拿到 cookie 后先与现役 snippet 比对，**只有变化时才写文件 + reload nginx**
#       —— 这样把定时器改成"每 5 分钟"也不会每 5 分钟 reload 一次
#    2) 逻辑其余完全保持原样（同样的 token 抓取、Host、超时、重试次数、日志位置）
#
#  部署（需 root）：
#    sudo cp /usr/local/sbin/dsh-pair-sync.sh /usr/local/sbin/dsh-pair-sync.sh.bak-$(date +%Y%m%d-%H%M%S)
#    sudo cp "/home/agentuser/DeepSeek 2/dsh-upgrade-021/dsh-pair-sync.sh.optimized" /usr/local/sbin/dsh-pair-sync.sh
#    sudo chown root:root /usr/local/sbin/dsh-pair-sync.sh && sudo chmod 755 /usr/local/sbin/dsh-pair-sync.sh
#    sudo systemctl start dsh-pair-sync.service && sudo tail -3 /var/log/dsh-pair-sync.log
#
#  回滚：把 .bak-* 拷回去即可
# =====================================================================
LOG=/var/log/dsh-pair-sync.log
CONF=/etc/nginx/snippets/dsh-session.conf
exec >>"$LOG" 2>&1
echo "=== $(date -Is) run"

for i in $(seq 1 20); do
  TOKEN=$(journalctl -u deepseek-harness.service --no-pager | grep -oE "token=[A-Za-z0-9_-]{40,}" | tail -1 | cut -d= -f2)
  if [ -n "$TOKEN" ]; then
    HDR=$(mktemp)
    curl -s --max-time 10 "http://127.0.0.1:3080/?token=$TOKEN" -H "Host: dsh.kaogong.art" -D "$HDR" -o /dev/null 2>/dev/null
    COOKIE=$(grep -i "^set-cookie: dsh-auth-" "$HDR" | tail -1 | sed -E "s/^[Ss]et-[Cc]ookie: //; s/;.*//")
    rm -f "$HDR"
    if [ -n "$COOKIE" ]; then
      CUR=$(sed -n 's/^set \$dsh_inject_cookie "\(.*\)";$/\1/p' "$CONF" 2>/dev/null | head -1)
      if [ "$CUR" = "$COOKIE" ]; then
        echo "OK: unchanged (${COOKIE%%=*})"; exit 0
      fi
      NEW=$(mktemp)
      { echo "# generated at $(date -Is)"; echo "set \$dsh_inject_cookie \"$COOKIE\";"; } > "$NEW"
      mv "$NEW" "$CONF"
      chmod 640 "$CONF"
      if nginx -t -q 2>/dev/null && systemctl reload nginx; then
        echo "OK: updated ${COOKIE%%=*}"; exit 0
      fi
      echo "attempt $i: nginx reload failed (will retry)"
    else
      echo "attempt $i: app not ready"
    fi
  else
    echo "attempt $i: no token yet"
  fi
  sleep 4
done
echo "GAVE UP (timer will heal)"; exit 0
