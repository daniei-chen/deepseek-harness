// dsh.kaogong.art access gate — v2 (DeepSeek-branded login UI)
// Served by nginx njs: gate = auth_request handler, login = /dsh-login page.
// Keep this file ES5-only (njs rejects some modern syntax) and self-contained.
const crypto = require("crypto");

const SECRET = "__GATE_SECRET__";
const SALT = "__GATE_SALT__";
const PHASH = "__GATE_PHASH__";
const COOKIE = "dsh_gate";
const MAX_AGE = 31536000; // 1 year — 免密设备记忆时长
const WHALE_D = "M48.8354 10.0479C48.3232 9.79199 48.1025 10.2798 47.8032 10.5278C47.7007 10.6079 47.6143 10.7119 47.5273 10.8076C46.7793 11.624 45.9048 12.1597 44.7622 12.0957C43.0923 12 41.666 12.5356 40.4058 13.8398C40.1377 12.2319 39.2476 11.272 37.8926 10.6558C37.1836 10.3359 36.4668 10.0156 35.9702 9.31982C35.6235 8.82373 35.5293 8.27197 35.356 7.72754C35.2456 7.3999 35.1353 7.06396 34.7651 7.00781C34.3633 6.94385 34.2056 7.2876 34.0479 7.57568C33.418 8.75195 33.1733 10.0479 33.1973 11.3599C33.2524 14.312 34.4736 16.6641 36.8999 18.3359C37.1758 18.5278 37.2466 18.7197 37.1597 19C36.9946 19.5757 36.7974 20.1357 36.624 20.7119C36.5137 21.0801 36.3486 21.1597 35.9624 21C34.6309 20.4321 33.481 19.5918 32.4644 18.5757C30.7393 16.8721 29.1792 14.9917 27.2334 13.52C26.7764 13.1758 26.3193 12.856 25.8467 12.5518C23.8618 10.584 26.1069 8.96777 26.627 8.77588C27.1704 8.57568 26.8159 7.8877 25.0591 7.896C23.3022 7.90381 21.6953 8.50391 19.647 9.30371C19.3477 9.42383 19.0322 9.51172 18.7095 9.58398C16.8501 9.22363 14.9199 9.14355 12.9033 9.37598C9.10596 9.80762 6.07275 11.6396 3.84326 14.7681C1.16455 18.5278 0.53418 22.7998 1.30664 27.2559C2.11768 31.9521 4.46582 35.8398 8.07373 38.8799C11.8159 42.0322 16.1255 43.5762 21.041 43.2803C24.0269 43.104 27.3516 42.6963 31.1016 39.4561C32.0469 39.936 33.0396 40.1279 34.686 40.272C35.9546 40.3921 37.1758 40.208 38.1211 40.0078C39.6021 39.688 39.4995 38.2881 38.9639 38.0322C34.623 35.9678 35.5762 36.8081 34.71 36.1279C36.9155 33.4639 40.2402 30.6958 41.54 21.728C41.6426 21.0161 41.5557 20.5679 41.54 19.9917C41.5322 19.6396 41.6108 19.5039 42.0049 19.4639C43.0923 19.3359 44.1479 19.0317 45.1167 18.4878C47.9292 16.9199 49.064 14.3438 49.3315 11.2559C49.3711 10.7837 49.3237 10.2959 48.8354 10.0479ZM24.3262 37.8398C20.1196 34.4639 18.0791 33.3521 17.2358 33.3999C16.4482 33.4482 16.5898 34.3682 16.7632 34.9678C16.9443 35.5601 17.1812 35.9683 17.5117 36.4878C17.7402 36.832 17.8979 37.3442 17.2832 37.728C15.9282 38.584 13.5728 37.4399 13.4624 37.3838C10.7207 35.7358 8.42822 33.5601 6.81348 30.584C5.25342 27.7197 4.34766 24.6479 4.19775 21.3677C4.1582 20.5757 4.38672 20.2959 5.15869 20.1519C6.17529 19.96 7.22314 19.9199 8.23926 20.0718C12.5327 20.7119 16.1885 22.6719 19.2529 25.7759C21.002 27.5439 22.3252 29.6558 23.6885 31.7202C25.1377 33.9121 26.6978 36 28.6831 37.7119C29.3843 38.312 29.9434 38.7681 30.479 39.104C28.8643 39.2881 26.1699 39.3281 24.3262 37.8398ZM26.3433 24.6001C26.3433 24.248 26.6191 23.9678 26.9658 23.9678C27.0444 23.9678 27.1152 23.9839 27.1782 24.0078C27.2651 24.04 27.3438 24.0879 27.4067 24.1602C27.5171 24.272 27.5801 24.4321 27.5801 24.6001C27.5801 24.9521 27.3042 25.2319 26.9575 25.2319C26.6108 25.2319 26.3433 24.9521 26.3433 24.6001ZM32.6064 27.8799C32.2046 28.0479 31.8027 28.1919 31.4165 28.208C30.8179 28.2397 30.1641 27.9922 29.8096 27.688C29.2583 27.2158 28.8643 26.9521 28.6987 26.1279C28.6279 25.7759 28.6675 25.2319 28.7305 24.9199C28.8721 24.248 28.7144 23.8159 28.2495 23.4238C27.8716 23.104 27.3911 23.0161 26.8633 23.0161C26.666 23.0161 26.4849 22.9277 26.3511 22.856C26.1304 22.7441 25.9492 22.4639 26.1226 22.1201C26.1777 22.0078 26.4458 21.7358 26.5088 21.688C27.2256 21.272 28.0527 21.4077 28.8169 21.7197C29.5259 22.0161 30.0615 22.5601 30.834 23.3281C31.6216 24.2559 31.7632 24.5117 32.2124 25.208C32.5669 25.752 32.8901 26.312 33.1104 26.9521C33.2446 27.3521 33.0713 27.6802 32.6064 27.8799Z";

// White rounded chip + black whale, mirroring the site's logo chip
// (<rect fill="var(--harness-logo-foreground)"> + white whale on top).
const MARK_SIZE = 27;
function markSvg(chipFill) {
    var s = MARK_SIZE, k = (s * 0.82) / 50, w = 50 * k, h = 50 * k, ox = (s - w) / 2, oy = (s - h) / 2;
    return '<svg class="mark" viewBox="0 0 ' + s + ' ' + s + '" aria-hidden="true" focusable="false">' +
        '<rect width="' + s + '" height="' + s + '" rx="6" fill="' + (chipFill || MARK_WHITE) + '"/>' +
        '<path fill="#000" transform="translate(' + ox + ',' + oy + ') scale(' + k + ')" d="' + WHALE_D + '"/>' +
        '</svg>';
}
const MARK_WHITE = "#ffffff";
const WHALE_FAVICON = (function () {
    var s = markSvg(MARK_WHITE)
        .replace('class="mark"', ' xmlns="http://www.w3.org/2000/svg"')
        .replace("</svg>", "<style>@media(prefers-color-scheme:dark){rect:first-of-type{fill:#F0F2F5}}</style></svg>");
    // data: URI must not contain raw <, >, " or # — they would terminate the HTML attribute
    return s.replace(/</g, "%3C").replace(/>/g, "%3E").replace(/"/g, "'").replace(/#/g, "%23").replace(/\s+/g, ";");
})();

function sha(s) { return crypto.createHash("sha256").update(s).digest("hex"); }

function gate(r) {
    if (r.variables.cookie_dsh_gate === SECRET) { r.return(204); }
    else { r.return(401, "login required"); }
}

function pickLang(r) {
    var c = String(r.variables["cookie_dsh_lang"] || "");
    if (c.indexOf("en") === 0) { return "en"; }
    return "zh";
}

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

function page(lang, failed) {
    var zh = lang !== "en";
    var T = zh ? {
        lang: "zh-CN",
        title: "登录 · DeepSeek Harness",
        head: "访问口令",
        lead: "这台设备上运行着 DeepSeek Harness。请输入访问口令继续。",
        label: "访问口令",
        ph: "请输入访问口令",
        remember: "在本设备上记住我，下次免密进入",
        submit: "进入",
        busy: "验证中…",
        err: "口令不正确，请重新输入。",
        note: "仅限授权设备访问。勾选后本设备 1 年内免密进入；公共设备请取消勾选。",
        other: "English",
        otherHref: "/dsh-login?lang=en" + (failed ? "&e=1" : ""),
        brand: "DeepSeek Harness"
    } : {
        lang: "en",
        title: "Sign in · DeepSeek Harness",
        head: "Access code",
        lead: "DeepSeek Harness is running on this device. Enter the access code to continue.",
        label: "Access code",
        ph: "Enter access code",
        remember: "Remember me on this device",
        submit: "Continue",
        busy: "Checking…",
        err: "Incorrect access code. Please try again.",
        note: "Authorized devices only. When checked, this device stays signed in for 1 year; uncheck it on shared devices.",
        other: "中文",
        otherHref: "/dsh-login" + (failed ? "?e=1" : ""),
        brand: "DeepSeek Harness"
    };
    var otherHref = T.otherHref;

    var css = [
        "*,*::before,*::after{box-sizing:border-box}",
        ":root{color-scheme:light dark;",
        "--brand:#3964fe;--brand-hi:#5686fe;--brand-soft:rgba(57,100,254,.10);",
        "--bg:#ffffff;--bg-2:#f9fafb;--surface:rgba(255,255,255,.86);",
        "--text:#0f1115;--text-2:#61666b;--text-3:#81858c;",
        "--line:rgba(32,33,36,.14);",
        "--field:#ffffff;--field-line:rgba(32,33,36,.16);--field-focus:rgba(57,100,254,.45);",
        "--danger:#e5484d;--danger-bg:rgba(229,72,77,.08);--danger-line:rgba(229,72,77,.28);",
        "--shadow:0 1px 2px rgba(15,17,21,.04),0 12px 32px -12px rgba(15,17,21,.18);",
        "--radius:18px}",
        "@media (prefers-color-scheme:dark){:root{",
        "--brand:#5686fe;--brand-hi:#679efe;--brand-soft:rgba(86,134,254,.16);",
        "--bg:#0f1115;--bg-2:#151517;--surface:rgba(28,28,30,.72);",
        "--text:#f9fafb;--text-2:#adb2b8;--text-3:#81858c;",
        "--line:hsla(0,0%,100%,.10);",
        "--field:rgba(255,255,255,.04);--field-line:hsla(0,0%,100%,.14);--field-focus:rgba(86,134,254,.55);",
        "--danger:#f2555a;--danger-bg:rgba(242,85,90,.10);--danger-line:rgba(242,85,90,.30);",
        "--shadow:0 1px 2px rgba(0,0,0,.3),0 24px 48px -24px rgba(0,0,0,.7)}}",
        "html,body{height:100%}",
        "body{margin:0;background:var(--bg);color:var(--text);",
        "font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;",
        "font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}",
        "body::before,body::after{content:'';position:fixed;inset:0;pointer-events:none;z-index:0}",
        "body::before{background:radial-gradient(820px 460px at 50% -8%,var(--brand-soft),transparent 68%)}",
        "body::after{background-image:radial-gradient(rgba(127,127,140,.14) 1px,transparent 1px);background-size:22px 22px;",
        "-webkit-mask-image:radial-gradient(760px 420px at 50% 6%,#000,transparent 72%);",
        "mask-image:radial-gradient(760px 420px at 50% 6%,#000,transparent 72%);opacity:.7}",
        ".wrap{position:relative;z-index:1;min-height:100%;display:flex;flex-direction:column;align-items:center;",
        "justify-content:center;gap:18px;padding:32px 18px 40px}",
        ".card{width:100%;max-width:400px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);",
        "box-shadow:var(--shadow);backdrop-filter:blur(14px) saturate(1.4);-webkit-backdrop-filter:blur(14px) saturate(1.4);",
        "padding:30px 30px 26px}",
        ".brandrow{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:22px}",
        ".brand{display:inline-flex;align-items:center;gap:9px;text-decoration:none;color:inherit;min-width:0}",
        ".mark{width:24px;height:24px;flex:none;display:block;border-radius:6px;box-shadow:0 0 0 1px rgba(32,33,36,.10),0 1px 2px rgba(15,17,21,.06)}",
        "@media (prefers-color-scheme:dark){.mark{box-shadow:0 0 0 1px rgba(0,0,0,.35),0 1px 3px rgba(0,0,0,.4)}}",
        ".brandname{font-size:15px;font-weight:600;letter-spacing:.2px;white-space:nowrap}",
        ".lang{font-size:12.5px;color:var(--text-3);text-decoration:none;border:1px solid var(--line);",
        "border-radius:999px;padding:3px 11px;transition:color .16s,border-color .16s,background-color .16s;flex:none}",
        ".lang:hover{color:var(--text);border-color:var(--field-line);background:var(--bg-2)}",
        "h1{margin:0 0 6px;font-size:21px;line-height:1.3;font-weight:600;letter-spacing:-.2px}",
        ".lead{margin:0 0 20px;color:var(--text-2);font-size:13.5px}",
        "form{margin:0}",
        ".field{position:relative;margin-bottom:12px}",
        "label{display:block;font-size:12.5px;font-weight:500;color:var(--text-2);margin-bottom:7px}",
        "input[type=password],input[type=text]{width:100%;height:44px;padding:0 46px 0 13px;border-radius:11px;",
        "border:1px solid var(--field-line);background:var(--field);color:var(--text);font-size:15px;font-family:inherit;",
        "outline:none;transition:border-color .16s,box-shadow .16s,background-color .16s}",
        "input::placeholder{color:var(--text-3)}",
        "input:hover{border-color:var(--field-line)}",
        "input:focus{border-color:var(--brand);box-shadow:0 0 0 3.5px var(--field-focus)}",
        ".eye{position:absolute;right:6px;bottom:6px;width:32px;height:32px;display:grid;place-items:center;",
        "border:0;background:transparent;color:var(--text-3);border-radius:8px;cursor:pointer;padding:0}",
        ".eye:hover{color:var(--text-2);background:var(--bg-2)}",
        ".eye svg{width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}",
        ".remember{display:flex;align-items:center;gap:9px;margin:2px 0 16px;color:var(--text-2);font-size:13px;cursor:pointer;user-select:none}",
        ".remember input{appearance:none;-webkit-appearance:none;width:17px;height:17px;flex:none;margin:0;cursor:pointer;",
        "border:1.5px solid var(--field-line);border-radius:5px;background:var(--field);position:relative;transition:background-color .15s,border-color .15s}",
        ".remember input:checked{background:var(--brand);border-color:var(--brand)}",
        ".remember input:checked::after{content:'';position:absolute;left:5px;top:1.5px;width:4.5px;height:9px;",
        "border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}",
        ".remember input:focus-visible{box-shadow:0 0 0 3.5px var(--field-focus)}",
        "button.submit{width:100%;height:44px;border:0;border-radius:11px;background:var(--brand);color:#fff;",
        "font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;position:relative;",
        "transition:background-color .16s,transform .06s,opacity .16s}",
        "button.submit:hover{background:var(--brand-hi)}",
        "button.submit:active{transform:translateY(.5px)}",
        "button.submit:focus-visible{outline:2px solid var(--brand);outline-offset:2px}",
        "button.submit[data-busy]{cursor:progress;opacity:.75}",
        ".spin{display:none;width:15px;height:15px;margin-right:7px;vertical-align:-2px;border-radius:50%;",
        "border:2px solid rgba(255,255,255,.45);border-top-color:#fff;animation:sp .7s linear infinite}",
        "button.submit[data-busy] .spin{display:inline-block}",
        "@keyframes sp{to{transform:rotate(360deg)}}",
        ".err{display:" + (failed ? "flex" : "none") + ";align-items:flex-start;gap:8px;margin:0 0 14px;padding:9px 11px;",
        "border:1px solid var(--danger-line);background:var(--danger-bg);color:var(--danger);",
        "border-radius:10px;font-size:13px}",
        ".err svg{width:15px;height:15px;flex:none;margin-top:2px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round}",
        ".note{margin:16px 0 0;color:var(--text-3);font-size:12px;line-height:1.5}",
        ".foot{color:var(--text-3);font-size:12px;text-align:center}",
        "@keyframes shake{10%,90%{transform:translateX(-1.5px)}20%,80%{transform:translateX(2.5px)}30%,50%,70%{transform:translateX(-4px)}40%,60%{transform:translateX(4px)}}",
        "@media (prefers-reduced-motion:no-preference){.card[data-shake=\"1\"]{animation:shake .45s cubic-bezier(.36,.07,.19,.97) both}}",
        "@media (max-width:420px){.card{padding:24px 20px 22px;border-radius:16px}h1{font-size:19px}.wrap{padding:24px 14px 32px}input[type=password],input[type=text]{font-size:16px}}",
        "@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}"
    ].join("");

    var js = [
        "(function(){",
        "var f=document.getElementById('f'),i=document.getElementById('p'),b=document.getElementById('go'),",
        "t=document.getElementById('t'),lang=f&&f.getAttribute('data-lang');",
        "if(!f||!i)return;",
        "if(lang==='en')f.setAttribute('action','/dsh-login?lang=en');",
        "var show=function(){if(t)t.style.display=i.value?'none':'block';};",
        "i.addEventListener('input',show);show();",
        "if(t)t.addEventListener('click',function(){var s=i.type==='password';i.type=s?'text':'password';",
        "t.setAttribute('aria-label',s?'隐藏口令':'显示口令');i.focus();});",
        "f.addEventListener('submit',function(){",
        "if(!i.value)return;",
        "if(b){b.setAttribute('data-busy','1');b.disabled=true;}",
        "});",
        "})();"
    ].join("");

    var html = "";
    html += '<!doctype html><html lang="' + T.lang + '"><head><meta charset="utf-8">';
    html += '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">';
    html += '<meta name="robots" content="noindex,nofollow">';
    html += '<meta name="color-scheme" content="light dark">';
    html += '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff">';
    html += '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0f1115">';
    html += '<title>' + esc(T.title) + '</title>';
    html += '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,' + WHALE_FAVICON + '">';
    html += '<style>' + css + '</style></head><body><div class="wrap">';
    html += '<main class="card"' + (failed ? ' data-shake="1"' : '') + '>';
    html += '<div class="brandrow"><span class="brand">' + markSvg(MARK_WHITE) + '<span class="brandname">' + esc(T.brand) + '</span></span>';
    html += '<a class="lang" href="' + esc(otherHref) + '" rel="nofollow">' + esc(T.other) + '</a></div>';
    html += '<h1>' + esc(T.head) + '</h1><p class="lead">' + esc(T.lead) + '</p>';
    html += '<p class="err" id="err" role="alert" aria-live="assertive"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle>';
    html += '<path d="M12 7.5v5.5M12 16.2v.3"></path></svg><span>' + esc(T.err) + '</span></p>';
    var action = "/dsh-login" + (lang === "en" ? "?lang=en" : "");
    html += '<form id="f" method="POST" action="' + esc(action) + '" data-lang="' + lang + '">';
    html += '<div class="field"><label for="p">' + esc(T.label) + '</label>';
    html += '<input id="p" name="p" type="password" autocomplete="current-password"';
    html += ' placeholder="' + esc(T.ph) + '" autofocus required aria-describedby="err">';
    html += '<button class="eye" type="button" id="t" aria-label="显示口令" tabindex="0">';
    html += '<svg viewBox="0 0 24 24" id="e"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"></path>';
    html += '<circle cx="12" cy="12" r="3.1"></circle></svg></button></div>';
    html += '<label class="remember" for="c"><input type="checkbox" id="c" checked><span>' + esc(T.remember) + '</span></label>';
    html += '<button class="submit" type="submit" id="go"><span class="spin"></span>' + esc(T.submit) + '</button>';
    html += '</form><p class="note">' + esc(T.note) + '</p></main>';
    html += '<p class="foot">DeepSeek Harness · dsh.kaogong.art</p></div>';
    html += '<script>' + js + '</script></body></html>';
    return html;
}

function argGet(args, k) {   // njs exposes r.args as an object (or a string in older builds)
    if (!args) { return ""; }
    if (typeof args === "object") { return args[k] === undefined ? "" : String(args[k]); }
    var m = String(args).match(new RegExp("(?:^|&)" + k + "=([^&]*)"));
    return m ? m[1] : "";
}

function langFromArgs(args, r) {
    var l = argGet(args, "lang");
    if (l === "en") { return "en"; }
    if (l === "zh") { return "zh"; }
    return pickLang(r);
}

function login(r) {
    var args = r.args;
    var lang = langFromArgs(args, r);
    var failed = argGet(args, "e") === "1";

    if (r.method !== "POST") {
        r.headersOut["Content-Type"] = "text/html; charset=utf-8";
        r.headersOut["Cache-Control"] = "no-store";
        r.headersOut["X-Robots-Tag"] = "noindex, nofollow";
        r.return(200, page(lang, failed));
        return;
    }

    var body = r.requestText !== undefined && r.requestText !== null ? String(r.requestText) : (r.requestBuffer ? r.requestBuffer.toString() : "");
    var m = body.match(/(?:^|&)p=([^&]*)/);
    var p = m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : "";
    var ok = p.length > 0 && sha(SALT + p) === PHASH;

    if (ok) {
        r.headersOut["Set-Cookie"] = COOKIE + "=" + SECRET + "; Max-Age=" + MAX_AGE + "; Secure; HttpOnly; Path=/; SameSite=Lax";
        var lg = argGet(args, "lang");
        if (lg === "en" || lg === "zh") {
            r.headersOut["Set-Cookie"] = [
                r.headersOut["Set-Cookie"],
                "dsh_lang=" + lg + "; Max-Age=" + MAX_AGE + "; Secure; Path=/dsh-login; SameSite=Lax"
            ];
        }
        r.return(303, "/");   // njs: url as 2nd arg emits the Location header
        return;
    }

    var loc = "/dsh-login?e=1" + (lang === "en" ? "&lang=en" : "");
    r.headersOut["Cache-Control"] = "no-store";
    r.return(303, loc);   // njs: url as 2nd arg emits the Location header
}

export default { gate, login };
