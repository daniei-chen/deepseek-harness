#!/usr/bin/env bash
# =====================================================================
#  DSH 访问鉴权四项修复（一键部署，含备份与自动回滚）
#
#  A.  门禁 cookie  SameSite=Strict → Lax
#      —— 解决「从微信/QQ/其他 App 点链接进来、或 iOS 桌面图标启动 PWA 时又被问密码」
#  A+. 门禁 cookie 自动换发（map + add_header）
#      —— 已授权的设备在下次正常访问时自动换成新属性，**无需再输一次口令**
#  B.  配对同步从「每天 04:30」改成「每 5 分钟」+ 换用只在变化时才 reload 的优化版脚本
#      —— 解决「每次 harness 重启后，所有设备都被 DSH 要求登录」（今天 13:33 升级即实例）
#  C.  /dsh-login 加限流（5r/m，burst 5）
#      —— 免密方案下，口令可被在线爆破；这也是你 README 里自己列的 TODO
#
#  用法：
#    sudo bash apply-auth-fixes.sh            # 干跑，只打印将做什么
#    sudo bash apply-auth-fixes.sh --apply    # 执行（失败自动回滚 nginx 配置）
#
#  回滚：脚本结束时打印备份目录，把里面的文件拷回去 + nginx -t + reload 即可
# =====================================================================
set -uo pipefail

APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1

SITE=/etc/nginx/sites-available/dsh.kaogong.art
GATE=/etc/nginx/njs/dsh_gate.js
GATE_NEW="/home/agentuser/DeepSeek 2/dsh-login-deepseek-ui/dsh_gate.js.samesite-lax"
PAIR=/usr/local/sbin/dsh-pair-sync.sh
PAIR_NEW="/home/agentuser/DeepSeek 2/dsh-upgrade-021/dsh-pair-sync.sh.optimized"
TIMER_DROPIN=/etc/systemd/system/dsh-pair-sync.timer.d/override.conf
LIMIT_CONF=/etc/nginx/conf.d/dsh-login-limit.conf
TS=$(date +%Y%m%d-%H%M%S)
BK=/var/backups/dsh-auth-fix-$TS

ok()   { printf '  \033[32m✔\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31m✘\033[0m %s\n' "$1"; }
info() { printf '  %s\n' "$1"; }
head1(){ printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }

run() {  # run "描述" 命令...
  local d="$1"; shift
  if [ "$APPLY" -eq 1 ]; then printf '  [执行] %s\n' "$d"; "$@"; else printf '  [干跑] %s\n' "$d"; fi
}

# ---------------------------------------------------------------------
head1 "0. 前置检查"
[ "$APPLY" -eq 1 ] && [ "$(id -u)" -ne 0 ] && { bad "需要 root：sudo bash \"$0\" --apply"; exit 1; }
for f in "$SITE" "$GATE" "$PAIR" "$GATE_NEW" "$PAIR_NEW"; do
  [ -e "$f" ] && ok "存在 $f" || { bad "缺少 $f"; exit 1; }
done
if grep -q 'dsh_gate_refresh' "$SITE" 2>/dev/null; then info "站点配置里已有自动换发（A+），将跳过"; A_PLUS_DONE=1; else A_PLUS_DONE=0; fi
if grep -q 'limit_req zone=dsh_login' "$SITE" 2>/dev/null;  then info "站点配置里已有登录限流（C），将跳过"; C_DONE=1; else C_DONE=0; fi
info "备份目录将为：$BK"

# ---------------------------------------------------------------------
head1 "1. 备份（原文件全部保留，可随时回滚）"
if [ "$APPLY" -eq 1 ]; then
  mkdir -p "$BK"
  cp -a "$GATE" "$BK/dsh_gate.js"
  cp -a "$SITE" "$BK/dsh.kaogong.art"
  cp -a "$PAIR" "$BK/dsh-pair-sync.sh"
  systemctl cat dsh-pair-sync.timer >"$BK/dsh-pair-sync.timer.txt" 2>/dev/null
  info "已备份到 $BK"; ls -l "$BK" | tail -n +2 | awk '{print "        "$9}'
else
  info "[干跑] 将把 dsh_gate.js / 站点配置 / pair-sync 脚本 / timer 定义备份到 $BK"
fi

# ---------------------------------------------------------------------
head1 "2. A：部署 SameSite=Lax 的门禁脚本"
run "安装 dsh_gate.js（SameSite=Lax，仅 1 行差异）" cp -f "$GATE_NEW" "$GATE"
run "chown root:root + chmod 600" bash -c "chown root:root '$GATE'; chmod 600 '$GATE'"

# ---------------------------------------------------------------------
head1 "3. A+：站点配置加「cookie 自动换发」"
if [ "$A_PLUS_DONE" -eq 0 ]; then
  if [ "$APPLY" -eq 1 ]; then
    SECRET=$(grep -oE 'SECRET = "[a-f0-9]{64}"' "$GATE" | head -1 | cut -d'"' -f2)
    # 只做格式校验：下面的 map 用 64 位十六进制正则匹配，**不把 SECRET 写进站点配置**
    # （站点配置文件是 644 世界可读，写进去等于把"免密凭据"泄露给本机任何用户）
    if [ -z "${SECRET:-}" ] || [ "${#SECRET}" -ne 64 ]; then
      bad "SECRET 格式不符（应为 64 位十六进制），终止，不改站点配置"; exit 1
    fi
    python3 - "$SITE" <<'PY'
import sys, pathlib
site = pathlib.Path(sys.argv[1])
lines = site.read_text().splitlines(keepends=True)
out, added_map, added_hdr = [], False, False
# 两个关键设计（第一次部署失败后修正）：
#  1) key 用**短正则**（17 字符）。写死 64 字符的 SECRET 会触发 nginx 默认
#     map_hash_bucket_size=64 的限制（[emerg] could not build map_hash）。
#  2) 值**原样回填 $cookie_dsh_gate**，配置里不出现 SECRET。
#     是否真放行仍由 njs 门禁按 SECRET 严格判定，伪造别的 64 位十六进制值不会获得访问权。
map_block = (
    "# 2026-10-04：门禁 cookie 自动换发 —— 带着合规 dsh_gate 的请求会被重新签发为新属性，\n"
    "# 用于把存量设备从 SameSite=Strict 平滑迁移到 Lax（设备无需再输一次口令）。\n"
    "# 键为短正则、值原样回填（均不含 SECRET）；无 cookie 或格式不符时不发送任何 Set-Cookie。\n"
    "map $cookie_dsh_gate $dsh_gate_refresh {\n"
    '    default "";\n'
    '    "~^[a-f0-9]{64}$" "dsh_gate=$cookie_dsh_gate; Max-Age=31536000; Secure; HttpOnly; Path=/; SameSite=Lax";\n'
    "}\n"
)
for ln in lines:
    if not added_map and ln.startswith("js_path "):
        out.append(map_block); added_map = True
    if not added_hdr and ln.strip().startswith("proxy_pass http://127.0.0.1:3080;"):
        out.append("        add_header Set-Cookie $dsh_gate_refresh;\n"); added_hdr = True
    out.append(ln)
assert added_map and added_hdr, f"锚点未命中 map={added_map} hdr={added_hdr}"
site.write_text("".join(out))
print("        [patch] map 块（短正则 key、值回填）+ add_header 已插入")
PY
    ok "站点配置已插入 map 与 add_header"
  else
    info "[干跑] 在站点配置插入 map \$cookie_dsh_gate \$dsh_gate_refresh + location / 内 add_header Set-Cookie"
  fi
else
  info "已存在，跳过"
fi

# ---------------------------------------------------------------------
head1 "4. C：/dsh-login 限流"
if [ "$C_DONE" -eq 0 ]; then
  if [ "$APPLY" -eq 1 ]; then
    cat > "$LIMIT_CONF" <<'EOF'
# 2026-10-04：/dsh-login 门禁页限流（每 IP 5r/m、突发 5），防口令在线爆破。
# 本机为「输一次口令、设备永久免密」方案，故该入口的暴露面主要是爆破与扫描。
limit_req_zone $binary_remote_addr zone=dsh_login:10m rate=5r/m;
EOF
    python3 - "$SITE" <<'PY'
import sys, pathlib
site = pathlib.Path(sys.argv[1])
s = site.read_text()
old = "    location = /dsh-login { auth_request off; js_content dshg.login; }"
new = ("    location = /dsh-login {\n"
       "        auth_request off;\n"
       "        js_content dshg.login;\n"
       "        limit_req zone=dsh_login burst=5 nodelay;\n"
       "        limit_req_status 429;\n"
       "    }")
assert s.count(old) == 1, "未找到唯一的 /dsh-login 行"
site.write_text(s.replace(old, new))
print("        [patch] /dsh-login 已展开为多行并加入 limit_req")
PY
    ok "限流 zone 与 location 已写入"
  else
    info "[干跑] 写 $LIMIT_CONF，并把 /dsh-login 展开为多行 + limit_req"
  fi
else
  info "已存在，跳过"
fi

# ---------------------------------------------------------------------
head1 "5. B：配对同步改每 5 分钟（+ 优化版脚本）"
run "安装优化版 pair-sync（仅 cookie 变化时才 reload nginx）" cp -f "$PAIR_NEW" "$PAIR"
run "chown root:root + chmod 755" bash -c "chown root:root '$PAIR'; chmod 755 '$PAIR'"
if [ "$APPLY" -eq 1 ]; then
  mkdir -p "$(dirname "$TIMER_DROPIN")"
  printf '[Timer]\nOnCalendar=\nOnCalendar=*:0/5\n' > "$TIMER_DROPIN"
  ok "timer override 已写入 $TIMER_DROPIN"
else
  info "[干跑] 写 $TIMER_DROPIN（OnCalendar=*:0/5）"
fi

# ---------------------------------------------------------------------
head1 "6. 校验（nginx -t；失败则自动回滚站点配置）"
if [ "$APPLY" -eq 1 ]; then
  if nginx -t 2>&1 | tail -3; then
    ok "nginx 配置语法通过"
    run "reload nginx" systemctl reload nginx
    run "systemd 重新加载并重启 timer" bash -c "systemctl daemon-reload && systemctl restart dsh-pair-sync.timer"
    info "立刻跑一次配对同步（同时验证优化版脚本可用）"
    systemctl start dsh-pair-sync.service
    tail -3 /var/log/dsh-pair-sync.log 2>/dev/null | sed 's/^/        /'
  else
    bad "nginx -t 失败 → 回滚站点配置与门禁脚本"
    cp -a "$BK/dsh.kaogong.art" "$SITE"
    cp -a "$BK/dsh_gate.js" "$GATE"
    rm -f "$LIMIT_CONF"
    nginx -t && systemctl reload nginx
    bad "已回滚，未做任何生效改动。请把上面的报错发我。"
    exit 1
  fi
else
  info "[干跑] 将执行 nginx -t；失败则从 $BK 回滚"
fi

# ---------------------------------------------------------------------
head1 "7. 结果核对"
if [ "$APPLY" -eq 1 ]; then
  info "门禁脚本 sha256（Lax 版应为 1c3b01c4bf2b9a12…）：$(sha256sum "$GATE" | cut -c1-32)"
  info "站点配置里的新片段："
  grep -nE "dsh_gate_refresh|limit_req zone=dsh_login|add_header Set-Cookie" "$SITE" | sed 's/^/        /'
  info "timer 下次触发："; systemctl list-timers dsh-pair-sync.timer --no-pager 2>/dev/null | head -2 | sed 's/^/        /'
  info "匿名访问响应头（不应出现空的 Set-Cookie）："
  curl -sI --max-time 10 https://dsh.kaogong.art/ 2>/dev/null | grep -iE "^(HTTP|set-cookie|location)" | sed 's/^/        /' || info "        （拿不到响应，跳过）"
  printf '\n  备份目录：%s\n  回滚方式：cp -a %s/{dsh.kaogong.art,dsh_gate.js} 对应路径 + nginx -t && systemctl reload nginx\n' "$BK" "$BK"
else
  info "[干跑] 以上为将执行的动作；确认无误后加 --apply"
fi
