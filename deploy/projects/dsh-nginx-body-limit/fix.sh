#!/usr/bin/env bash
# 修掉 dsh.kaogong.art「POST body 超过 1 MiB 就 500」的问题。
#
# 根因（线上 nginx 复刻实验里的原始日志）：
#   [error] client intended to send too large body: 1100000 bytes, ...
#           request: "POST /api/..." , subrequest: "/_dsh_gate"
#   [error] auth request unexpected status: 413
# → nginx 的 auth_request 子请求 /_dsh_gate 没吃到 location / 里的 client_max_body_size 200m，
#   它用的是默认值 1m；body 一旦超过 1 MiB，子请求返回 413，nginx 就把主请求判成 500。
#   （所以：≤1 MiB 正常、>1 MiB 必 500、chunked 不带 Content-Length 反而正常。）
#
# 修法：在 443 server 块里加一行 server 级 client_max_body_size，子请求与大请求都按它判。
#      不用碰 client_body_buffer_size（那是每个请求的内存缓冲，设 1g 会把内存打爆）。
set -euo pipefail

SITE="${SITE:-/etc/nginx/sites-available/dsh.kaogong.art}"
LIMIT="${LIMIT:-1024m}"
DRY_RUN="${DRY_RUN:-0}"          # DRY_RUN=1 只改文件、不 nginx -t / reload（自测用）
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${SITE}.bak-${STAMP}"

[ "$(id -u)" = "0" ] || [ "$DRY_RUN" = "1" ] || { echo "需要 root：sudo bash $0" >&2; exit 1; }

cp -a "$SITE" "$BACKUP"

python3 - "$SITE" "$LIMIT" "${BODY_TIMEOUT:-600s}" <<'PY'
import re, sys

path, limit, body_timeout = sys.argv[1], sys.argv[2], sys.argv[3]
lines = open(path, encoding="utf-8").read().splitlines(keepends=True)
anchor = "    auth_request /_dsh_gate;\n"

if not any(l == anchor for l in lines):
    sys.exit("找不到锚点 'auth_request /_dsh_gate;'，请手工在 443 server 块里加 client_max_body_size。")

notes = []
for name, value in (("client_max_body_size", limit), ("client_body_timeout", body_timeout)):
    wanted = f"    {name} {value};\n"
    # 只认 server 级（4 空格缩进）；location / 里的 8 空格那份不动
    hit = next((i for i, l in enumerate(lines) if re.match(rf"^    {name} ", l)), None)
    if hit is not None:
        if lines[hit] == wanted:
            notes.append(f"已存在: {wanted.strip()}")
        else:
            notes.append(f"已更新: {lines[hit].strip()} -> {wanted.strip()}")
            lines[hit] = wanted
    else:
        pos = lines.index(anchor) + 1
        lines.insert(pos, wanted)
        notes.append(f"已插入 server 级: {wanted.strip()}")

open(path, "w", encoding="utf-8").write("".join(lines))
for n in notes:
    print(n)
PY

if [ "$DRY_RUN" = "1" ]; then
    echo "DRY_RUN=1：跳过 nginx -t 与 reload"
    exit 0
fi

nginx -t
systemctl reload nginx

echo
echo "完成。站点配置备份：$BACKUP"
echo "回滚：sudo bash $(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/rollback.sh"
echo "验证（本机直接打大 body，正常应看到 404「not found」而不是 nginx 的 500 页面）："
echo "  head -c 1100000 /dev/zero | tr '\\0' a > /tmp/probe.bin"
echo "  curl -o /dev/null -w '%{http_code}\\n' -b 'dsh_gate=<你的cookie>' -X POST --data-binary @/tmp/probe.bin https://dsh.kaogong.art/api/__probe__"
