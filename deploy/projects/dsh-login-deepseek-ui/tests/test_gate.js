// Local behavior harness for /etc/nginx/njs/dsh_gate.js (njs module shape).
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync("/tmp/dsh_gate_v2.js", "utf8");
const modPath = path.join(require("os").tmpdir(), "dsh_gate_harness.cjs");
fs.writeFileSync(modPath, src.replace(/export default \{[^}]*\};?/, "module.exports = { gate, login };"));
const { login, gate } = require(modPath);

function mkReq(opts) {
  const o = opts || {};
  return {
    method: o.method || "GET",
    args: (function () { var a = {}; String(o.args || "").split("&").forEach(function (kv) { if (!kv) return; var i = kv.indexOf("="); if (i < 0) a[kv] = ""; else a[kv.slice(0, i)] = kv.slice(i + 1); }); return a; })(),
    requestText: o.body,
    variables: o.variables || {},
    headersOut: {},
    status: null,
    body: null,
    return(status, body) {
      this.status = status;
      this.body = body === undefined ? "" : body;
      // njs turns return(3xx, url) into a Location header; emulate for assertions
      if (status >= 300 && status < 400 && typeof body === "string" && body) { this.headersOut["Location"] = body; this.body = ""; }
    }
  };
}

let failures = 0;
function check(name, cond, extra) {
  console.log((cond ? "PASS  " : "FAIL  ") + name + (cond ? "" : "   <<< " + (extra === undefined ? "" : extra)));
  if (!cond) failures++;
}

// --- gate ---
let r = mkReq({ variables: { cookie_dsh_gate: "wrong" } });
gate(r);
check("gate rejects bad cookie with 401", r.status === 401, r.status);

r = mkReq({ variables: { cookie_dsh_gate: "__GATE_SECRET__" } });
gate(r);
check("gate accepts correct cookie with 204", r.status === 204, r.status);

// --- login GET (zh) ---
r = mkReq({});
login(r);
const zhHtml = r.body;
const css = (zhHtml.match(/<style>([\s\S]*?)<\/style>/) || ["",""])[1];
check("GET /dsh-login -> 200", r.status === 200, r.status);
check("content-type html", r.headersOut["Content-Type"] === "text/html; charset=utf-8");
check("no-store header", r.headersOut["Cache-Control"] === "no-store");
check("zh page has access-code heading", zhHtml.indexOf("访问口令") > -1);
check("zh page has lang=zh-CN", zhHtml.indexOf('<html lang="zh-CN"') > -1);
check("zh page has password input named p", /<input id="p" name="p" type="password"/.test(zhHtml));
check("zh page has POST form", /<form id="f" method="POST" action="\/dsh-login"/.test(zhHtml));
check("zh page has submit button", /class="submit"/.test(zhHtml));
check("zh page has remember checkbox", /<input type="checkbox" id="c" checked>/.test(zhHtml));
check("zh page has English switch", zhHtml.indexOf("/dsh-login?lang=en") > -1);
check("zh error block present but hidden on clean GET", /<p class="err" id="err" role="alert"/.test(zhHtml) && zhHtml.indexOf('<main class="card">') > -1);
check("zh page embeds whale mark", zhHtml.indexOf('<svg class="mark"') > -1);
check("zh page embeds svg favicon", /rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,%3Csvg[^"]*">/.test(zhHtml));
check("no leftover njs template artifacts", zhHtml.indexOf("${") === -1 && zhHtml.indexOf("undefined") === -1);


// --- markup safety: nothing may terminate attributes or leak outside <svg> ---
const attrZone = zhHtml.split('<body>')[0];
check("favicon data URI has no raw angle bracket", !/href=data:image\/svg\+xml,[^>]*</.test(attrZone));
check("no raw < inside href attributes", !/href="[^"]*</.test(zhHtml));
check("mark is a white rounded chip", /<svg class="mark" viewBox="0 0 27 27"[^>]*><rect width="27" height="27" rx="6" fill="#ffffff"\/>/.test(zhHtml));
check("whale inside the chip is black", /<path fill="#000" transform=/.test(zhHtml));
check("chip carries a hairline for contrast", /\.mark\{[^}]*box-shadow/.test(css));
check("favicon chip turns light grey in dark mode", /prefers-color-scheme:dark\)\{rect:first-of-type\{fill:#F0F2F5\}\}/.test(decodeURIComponent(zhHtml.match(/href="data:image\/svg\+xml,([^"]+)"/)[1])));
check("favicon data URI contains no whitespace", !/href="data:[^"]*[\s][^"]*"/.test(zhHtml));
check("favicon data URI is fully self-contained", /%3C\/svg%3E">/.test(zhHtml));
check("no unescaped svg markup right after <body>", !/<body><path/.test(zhHtml), zhHtml.slice(zhHtml.indexOf("<body>"), zhHtml.indexOf("<body>") + 60));
check("favicon href percent-encodes markup", /href="data:image\/svg\+xml,%3Csvg/.test(zhHtml));
check("body starts with the layout wrapper", /<body><div class="wrap">/.test(zhHtml));

// --- login GET?e=1 (zh, failed) ---
r = mkReq({ args: "e=1" });
login(r);
check("failed GET sets shake flag", r.body.indexOf('<main class="card" data-shake="1">') > -1);
check("failed GET keeps error block", r.body.indexOf('class="err" id="err"') > -1);

// --- login GET?lang=en ---
r = mkReq({ args: "lang=en" });
login(r);
check("en page heading", r.body.indexOf("Access code") > -1);
check("en page lang=en", r.body.indexOf('<html lang="en"') > -1);
check("en page switches back to 中文", r.body.indexOf("/dsh-login\"") > -1 || r.body.indexOf("中文") > -1);
check("en form action carries lang", r.body.indexOf('action="/dsh-login?lang=en"') > -1);

// --- lang cookie, no query arg ---
r = mkReq({ variables: { cookie_dsh_lang: "en" } });
login(r);
check("cookie_dsh_lang=en renders English", r.body.indexOf("Access code") > -1);

// --- login POST wrong password ---
r = mkReq({ method: "POST", body: "p=definitely-wrong" });
login(r);
check("wrong password -> 303", r.status === 303, r.status);
check("wrong password redirects to ?e=1", r.headersOut["Location"] === "/dsh-login?e=1", r.headersOut["Location"]);

// --- login POST correct password ---
r = mkReq({ method: "POST", body: "p=__GATE_PASSPHRASE__" });
login(r);
check("correct password -> 303", r.status === 303, r.status);
check("correct password redirects to /", r.headersOut["Location"] === "/", r.headersOut["Location"]);
const sc = r.headersOut["Set-Cookie"];
check("sets gate cookie", Array.isArray(sc) ? sc[0].indexOf("dsh_gate=77444369") === 0 : String(sc).indexOf("dsh_gate=77444369") === 0, JSON.stringify(sc));
check("cookie remembers device 1 year", JSON.stringify(sc).indexOf("Max-Age=31536000") > -1);
check("cookie is Secure+HttpOnly+SameSite=Strict", JSON.stringify(sc).indexOf("Secure") > -1 && JSON.stringify(sc).indexOf("HttpOnly") > -1 && JSON.stringify(sc).indexOf("SameSite=Strict") > -1);

// --- login POST correct password + urlencoded / plus-mangled body ---
r = mkReq({ method: "POST", body: "p=__GATE_PASSPHRASE__%0D%0A" });
login(r);
check("trailing CRLF in value does not authenticate", r.status === 303 && r.headersOut["Location"] !== "/", r.headersOut["Location"]);

// --- login POST with en lang ---
r = mkReq({ method: "POST", args: "lang=en", body: "p=__GATE_PASSPHRASE__" });
login(r);
check("en POST redirects to /", r.headersOut["Location"] === "/");
check("en POST persists lang cookie", JSON.stringify(r.headersOut["Set-Cookie"]).indexOf("dsh_lang=en") > -1);

// --- empty body ---
r = mkReq({ method: "POST", body: "" });
login(r);
check("empty body rejected", r.status === 303 && r.headersOut["Location"].indexOf("e=1") > -1);

console.log("\n" + (failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"));
process.exit(failures === 0 ? 0 : 1);
