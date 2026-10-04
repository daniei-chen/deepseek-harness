// Drive the live login page in real Chromium via CDP: type password, submit,
// then confirm the gate cookie is set and the app loads without the code again.
const http = require("http");

function get(url) {
  return new Promise((res, rej) => {
    http.get(url, (r) => { let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => res(d)); }).on("error", rej);
  });
}

function cdp(ws) {
  let id = 0;
  const waiting = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
  });
  return function send(method, params) {
    const mid = ++id;
    return new Promise((res, rej) => {
      waiting.set(mid, (m) => (m.error ? rej(new Error(method + ": " + JSON.stringify(m.error))) : res(m.result)));
      ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
    });
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const list = JSON.parse(await get("http://127.0.0.1:9222/json/list"));
  const page = list.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  const send = cdp(ws);
  let failures = 0;
  const check = (name, cond, extra) => {
    console.log((cond ? "PASS  " : "FAIL  ") + name + (cond ? "" : "   <<< " + JSON.stringify(extra)));
    if (!cond) failures++;
  };

  await send("Page.enable");
  await send("Network.enable");
  await send("Page.navigate", { url: "https://dsh.kaogong.art/" });
  await sleep(2500);

  let r = await send("Runtime.evaluate", {
    expression: `JSON.stringify({title:document.title, h1:(document.querySelector('h1')||{}).textContent, hasPw:!!document.querySelector('input[type=password][name=p]'), btn:(document.querySelector('button.submit')||{}).textContent, focused:document.activeElement&&document.activeElement.id})`,
    returnByValue: true
  });
  const st = JSON.parse(r.result.value);
  console.log("page state:", st);
  check("login page rendered", st.title === "登录 · DeepSeek Harness", st.title);
  check("password input present", st.hasPw === true);
  check("submit button labelled 进入", st.btn === "进入", st.btn);
  check("input autofocused", st.focused === "p", st.focused);

  // cookie must not exist yet
  let ck = await send("Network.getCookies", { urls: ["https://dsh.kaogong.art/"] });
  check("no gate cookie before login", !ck.cookies.some((c) => c.name === "dsh_gate"), ck.cookies.map((c) => c.name));

  // type the wrong code first
  await send("Input.insertText", { text: "0000" });
  r = await send("Runtime.evaluate", { expression: `document.getElementById('p').value`, returnByValue: true });
  check("typing fills the field", r.result.value === "0000", r.result.value);
  await send("Runtime.evaluate", { expression: `document.getElementById('f').requestSubmit()`, returnByValue: true });
  await sleep(2500);
  r = await send("Runtime.evaluate", {
    expression: `JSON.stringify({url:location.pathname+location.search, err:getComputedStyle(document.getElementById('err')).display})`,
    returnByValue: true
  });
  const bad = JSON.parse(r.result.value);
  console.log("after wrong code:", bad);
  check("wrong code returns to login with error", bad.url === "/dsh-login?e=1", bad.url);
  check("error message is visible", bad.err === "flex", bad.err);
  ck = await send("Network.getCookies", { urls: ["https://dsh.kaogong.art/"] });
  check("wrong code sets no gate cookie", !ck.cookies.some((c) => c.name === "dsh_gate"), ck.cookies.map((c) => c.name));

  // now the correct code
  await send("Runtime.evaluate", { expression: `document.getElementById('p').value=''`, returnByValue: true });
  await send("Runtime.evaluate", { expression: `document.getElementById('p').focus()`, returnByValue: true });
  await send("Input.insertText", { text: "__GATE_PASSPHRASE__" });
  await send("Runtime.evaluate", { expression: `document.getElementById('f').requestSubmit()`, returnByValue: true });
  await sleep(3500);

  r = await send("Runtime.evaluate", {
    expression: `JSON.stringify({url:location.href, title:document.title, isApp:!!document.querySelector('base')||document.body.innerText.length>100})`,
    returnByValue: true
  });
  const good = JSON.parse(r.result.value);
  console.log("after correct code:", good);
  check("correct code lands on the app", good.url === "https://dsh.kaogong.art/" || good.url === "https://dsh.kaogong.art", good.url);
  check("app (not login page) is shown", good.title !== "登录 · DeepSeek Harness", good.title);

  ck = await send("Network.getCookies", { urls: ["https://dsh.kaogong.art/"] });
  const gate = ck.cookies.find((c) => c.name === "dsh_gate");
  check("gate cookie stored for 1 year", !!gate && gate.expires - Date.now() / 1000 > 300 * 24 * 3600, gate && gate.expires);
  check("cookie is HttpOnly + Secure + SameSite=Strict", !!gate && gate.httpOnly === true && gate.secure === true && gate.sameSite === "Strict", gate);

  // reload: 免密 access
  await send("Page.navigate", { url: "https://dsh.kaogong.art/" });
  await sleep(3000);
  r = await send("Runtime.evaluate", { expression: `JSON.stringify({url:location.pathname, title:document.title})`, returnByValue: true });
  const revisit = JSON.parse(r.result.value);
  console.log("revisit:", revisit);
  check("revisit is password-free (app loads)", revisit.title !== "登录 · DeepSeek Harness", revisit.title);

  console.log("\n" + (failures === 0 ? "BROWSER E2E: ALL PASS" : "BROWSER E2E: " + failures + " FAILURE(S)"));
  ws.close();
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR", e); process.exit(2); });
