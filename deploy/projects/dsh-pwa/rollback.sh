#!/usr/bin/env bash
# 回滚 PWA 门面改动：恢复站点配置 + 删掉 include 片段，然后 reload。
# 用法：sudo bash rollback.sh
set -euo pipefail

SITE=/etc/nginx/sites-available/dsh.kaogong.art
SNIPPET=/etc/nginx/snippets/dsh-pwa.conf

[ "$(id -u)" = "0" ] || { echo "需要 root：sudo bash $0" >&2; exit 1; }

BACKUP="$(ls -1t "${SITE}".bak-* 2>/dev/null | head -1 || true)"
if [ -n "$BACKUP" ]; then
    cp -a "$BACKUP" "$SITE"
    echo "已恢复站点配置：$BACKUP -> $SITE"
else
    sed -i '\#include snippets/dsh-pwa.conf;#d' "$SITE"
    echo "无备份可恢复，已直接删掉 include 行"
fi
rm -f "$SNIPPET"

nginx -t
systemctl reload nginx
echo "回滚完成（/var/www/dsh-pwa 静态文件保留，可自行 rm -rf）"
