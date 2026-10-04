#!/usr/bin/env bash
# 回滚 body 限制改动：恢复最近一次站点配置备份并 reload。
set -euo pipefail

SITE=/etc/nginx/sites-available/dsh.kaogong.art
[ "$(id -u)" = "0" ] || { echo "需要 root：sudo bash $0" >&2; exit 1; }

BACKUP="$(ls -1t "${SITE}".bak-* 2>/dev/null | head -1 || true)"
if [ -z "$BACKUP" ]; then
    sed -i '\#^    client_max_body_size #d' "$SITE"
    echo "无备份，已直接删掉 server 级 client_max_body_size 行"
else
    cp -a "$BACKUP" "$SITE"
    echo "已恢复：$BACKUP"
fi
nginx -t
systemctl reload nginx
echo "回滚完成"
