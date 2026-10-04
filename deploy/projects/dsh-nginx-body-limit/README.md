# dsh.kaogong.art：POST body 超过 1 MiB 就 500 —— 根因与修复

## 症状

手机 Chrome 上一张图能发，**两张以上图片就报**：

```
client api: session/prompt failed: transport failure for /api/session/prompt:
HTTP 500 (gateway/internal)
```

同时：从手机往工作区传稍大的文件也会 500。

## 根因（已用线上配置本地复刻 + nginx 原始日志确认）

DSH 的多图 prompt 是把每张图 **base64 内联在 JSON body 里**发的（SDK 定义见
`SdkEncodedImageBlock.data`），三张手机截图轻松超过 1 MiB。而线上 nginx 是这样写的：

```nginx
server {
    auth_request /_dsh_gate;                 # ← 子请求用默认 client_max_body_size = 1m
    error_page 401 =200 /dsh-login;
    location / {
        client_max_body_size 200m;           # ← 只有主请求用 200m
        ...
    }
}
```

`location /` 里的 `client_max_body_size 200m` **不会**被 auth 子请求 `/_dsh_gate` 继承。
body 一旦超过 1 MiB，子请求按默认 1m 判超限返回 413，而 auth_request 收到非
2xx/401/403 的状态就认为「auth 出错」，把主请求判成 500：

```
[error] client intended to send too large body: 1100000 bytes, client: ..., 
        request: "POST /api/...", subrequest: "/_dsh_gate"
[error] auth request unexpected status: 413
```

这也解释了三个看起来矛盾的现象：

| 请求 | 结果 | 原因 |
| --- | --- | --- |
| body ≤ 1 MiB（1,048,576 B） | 正常 | 子请求也放行 |
| body > 1 MiB，带 `Content-Length` | **nginx 500** | 子请求 413 → auth_request 判错 |
| body > 1 MiB，**chunked（无 Content-Length）** | 正常 | 长度未知，子请求不做大小判断 |
| 绕过 nginx 直连 127.0.0.1:3080 | 正常 | 与 nginx 无关 |

## 修法（一行）

在 **443 server 块**里（不是在 `location /` 里）加：

```nginx
    client_max_body_size 1024m;
```

`fix.sh` 会幂等地插到 `auth_request /_dsh_gate;` 之后，`nginx -t` 通过才 reload。
同时会补一条 `client_body_timeout 600s;`（默认 60 秒，手机上慢速传大文件容易被它中途掐断）。

**不要**把 `client_body_buffer_size` 设成 1g：那是「每个请求在内存里缓冲多少」，
超出的部分本来就会落盘到 `client_body_temp_path`（日志里有
`a client request body is buffered to a temporary file` 的 warn，说明落盘路径是好的）。
设成 1g 只会在并发大请求时把内存打爆。真正的「允许多大」是 `client_max_body_size`。

## 能传多大：nginx 只是第一道，后面还有硬上限

线上实测（2026-10-04，改完后）：body 1 MiB / 1.1 MiB / 5 MiB / 32 MiB / **129 MiB** 全部透传成功
（DSH 回 `404 not found`，即 body 已被完整接受）。

| 环节 | 上限 | 出处 |
| --- | --- | --- |
| nginx 单请求 body | **1024m（1 GiB）**，`LIMIT=` 可改 | 本次改动 |
| DSH → DeepSeek Files API 单文件上传 | **128 MiB**（硬上限，不可配） | `MAX_FILE_UPLOAD_BYTES` |
| 账号文件配额 | **25 GiB / 10,000 个文件** | `MAX_STORED_FILE_BYTES` / `MAX_STORED_FILE_COUNT` |
| 单请求内联图片（base64）总量 | 20 MiB，超过自动改走 Files API | `DEFAULT_MAX_INLINE_REQUEST_IMAGE_BYTES` |
| 单请求文件引用图片总量 | 128 MiB | `DEFAULT_MAX_REQUEST_FILES_BYTES` |
| 送给模型的每张图 | 自动压到 ≤2 MiB、单边 ≤4096 px | `DEFAULT_REQUEST_IMAGE_MAX_BYTES` / `REQUEST_IMAGE_MAX_DIMENSION` |
| 磁盘 | 整个 body 会缓冲到 `/var/lib/nginx/body`，1 GB 上传≈占 1 GB | `df -h /`（当时剩 41 GB） |

结论：**单文件 128 MiB 是 DeepSeek 侧的硬天花板**，把 nginx 调到 1 GiB 已经覆盖它有余；
再往上调 nginx 不会有额外收益（除非以后换掉 Files API 这条路）。

## 用法

```bash
sudo bash "/home/agentuser/DeepSeek 2/dsh-nginx-body-limit/fix.sh"     # 默认 1024m
sudo LIMIT=4096m bash ".../fix.sh"                                      # 想要更大也行
sudo bash "/home/agentuser/DeepSeek 2/dsh-nginx-body-limit/rollback.sh" # 回滚
```

## 验证

本机（脚本会打印完整命令）：

```bash
head -c 1100000 /dev/zero | tr '\0' a > /tmp/probe.bin
curl -o /dev/null -w '%{http_code}\n' -b "dsh_gate=<你的cookie>" \
     -X POST --data-binary @/tmp/probe.bin https://dsh.kaogong.art/api/__probe__
```

- 修复前：`500`（nginx 错误页，`<hr><center>nginx</center>`）
- 修复后：`404`（DSH 回 `not found`，说明 body 已经完整透传过去）

然后在手机上重新试「一次发多条消息 + 多张图」。
