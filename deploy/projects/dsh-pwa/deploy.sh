#!/usr/bin/env bash
# 给 dsh.kaogong.art 装上 PWA 门面（manifest + 图标 + favicon 匿名可读）。
# 用法：把整个 dsh-pwa 目录拷到服务器上，然后  sudo bash deploy.sh
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATIC=/var/www/dsh-pwa
SITE=/etc/nginx/sites-available/dsh.kaogong.art
SNIPPET=/etc/nginx/snippets/dsh-pwa.conf
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${SITE}.bak-${STAMP}"

[ "$(id -u)" = "0" ] || { echo "需要 root：sudo bash $0" >&2; exit 1; }

# 1) 静态文件（manifest / 图标 / favicon），全站只有这些资源匿名可读
install -d -m 755 "$STATIC" "$STATIC/icons"
install -m 644 "$SRC/manifest.webmanifest" "$STATIC/manifest.webmanifest"
install -m 644 "$SRC/icons/"*.png "$STATIC/icons/"
install -m 644 "$SRC/icons/"favicon*.svg "$STATIC/icons/"
chown -R root:root "$STATIC"

# 2) nginx 片段
install -m 644 "$SRC/nginx/dsh-pwa.conf" "$SNIPPET"

# 3) 在 443 server 块里 include 片段（幂等；插入点在 dsh-session.conf 之后）
cp -a "$SITE" "$BACKUP"
python3 - "$SITE" <<'PY'
import sys
p = sys.argv[1]
t = open(p, encoding="utf-8").read()
if "include snippets/dsh-pwa.conf;" in t:
    print("include 已存在，配置未改动")
    sys.exit(0)
anchor = "    include snippets/dsh-session.conf;\n"
if anchor not in t:
    sys.exit("找不到锚点 'include snippets/dsh-session.conf;'，请手动加一行 include snippets/dsh-pwa.conf; 再跑本脚本")
open(p, "w", encoding="utf-8").write(t.replace(anchor, anchor + "    include snippets/dsh-pwa.conf;\n", 1))
print("已插入: include snippets/dsh-pwa.conf;")
PY

# 4) 语法检查 + reload（njs 与 nginx 配置都靠 reload 生效）
nginx -t
systemctl reload nginx

echo
echo "部署完成。站点配置备份：$BACKUP"
echo "回滚：sudo bash $SRC/rollback.sh"
echo "验证：bash $SRC/verify.sh"
