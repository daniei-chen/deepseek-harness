#!/usr/bin/env bash
# 匿名验证：PWA 门面必须能匿名取到，其余路径必须仍然回到登录页。
# 用法：bash verify.sh        （不需要 root，任何联网机器都能跑）
set -uo pipefail

HOST="${HOST:-https://dsh.kaogong.art}"
BODY="$(mktemp)"
fail=0

probe() { # name url want_code want_type_glob
    local name="$1" url="$2" want_code="$3" want_type="$4"
    local got; got="$(curl -sS -m 20 -H 'Cookie: dsh_gate=' -o "$BODY" -w '%{http_code} %{content_type}' "$url" || echo '000 -')"
    local code="${got%% *}" type="${got#* }"
    if [ "$code" = "$want_code" ] && [[ "$type" == $want_type ]]; then
        printf 'PASS  %-28s %s %s\n' "$name" "$code" "$type"
    else
        printf 'FAIL  %-28s got=%s want=%s %s\n' "$name" "$got" "$want_code $want_type"
        fail=$((fail + 1))
    fi
}

probe "manifest"          "$HOST/manifest.webmanifest"      200 "application/manifest+json*"
probe "icon-192"          "$HOST/icons/icon-192.png"        200 "image/png*"
probe "icon-512"          "$HOST/icons/icon-512.png"        200 "image/png*"
probe "icon-512-maskable" "$HOST/icons/icon-512-maskable.png" 200 "image/png*"
probe "favicon.svg"       "$HOST/favicon.svg"               200 "image/svg+xml*"

# 门禁仍然生效：首页与 assets 匿名访问应拿到登录页 HTML
probe "home still gated"    "$HOST/"         200 "text/html*"
grep -q -E '登录|Sign in' "$BODY" && echo "PASS  home body is login page" || { echo "FAIL  home body is not the login page"; fail=$((fail + 1)); }
probe "assets still gated"  "$HOST/assets/"  200 "text/html*"

# manifest 内容自检
curl -sS -m 20 -H 'Cookie: dsh_gate=' "$HOST/manifest.webmanifest" -o "$BODY"
python3 - "$BODY" 2>/dev/null <<'PY' && echo "PASS  manifest has name + 192 + 512 icons" || { echo "FAIL  manifest content"; fail=$((fail + 1)); }
import json, sys
m = json.load(open(sys.argv[1]))
sizes = {i.get("sizes") for i in m.get("icons", [])}
assert m.get("name") or m.get("short_name"), "no name"
assert m.get("start_url"), "no start_url"
assert m.get("display") in ("fullscreen", "standalone", "minimal-ui", "window-controls-overlay"), m.get("display")
assert "192x192" in sizes and "512x512" in sizes, sizes
PY

rm -f "$BODY"
echo
if [ "$fail" = 0 ]; then echo "全部通过。"; else echo "$fail 项失败。"; exit 1; fi
