/**
 * 用户面文案唯一真源（**页面侧**，0.14.1 批 3 / P3-1）。
 *
 * 规则（`docs/0.14.1-COPY-STANDARD.md`）：
 *  1. **机器码不上屏**。壳侧 `reason` / HTTP 状态码 / 内部 key 只允许进 `data-*` 属性与日志；
 *     用户看到的必须是这里给出的「发生了什么 + 你现在能做什么」。
 *  2. **映射表落一处**。页面侧所有「码 → 中文」都在本文件；任何组件里再写一张局部表
 *     （副本）都算回归——两张表必然漂移，这正是本批要收的形态。
 *  3. 表里查不到的码**也要给人话**：回一句可反馈的兜底，而不是把码原样抛给用户。
 *     兜底句里不带原码，原码由调用方放进 `data-*`（可截图/可 grep，但不打断阅读）。
 *
 * 为什么页面侧与壳侧各有一张表：两侧是**两种语言的两个渲染面**（WebView 页面 / 原生 UI），
 * 不存在共享的常量载体。故约定「每个渲染面一张表、各一张」，并在规范文档里登记这两张表的
 * 位置与覆盖的码集合；壳侧那张是 `UserCopy.kt`。
 */
/** 未知码的兜底（**不带原码**；原码由调用方放进 `data-*`）。 */
export declare const UNKNOWN_CALL_REASON = "\u8C03\u7528\u5931\u8D25\uFF08\u539F\u56E0\u672A\u5728\u672C\u7248\u767B\u8BB0\uFF09\u2014\u2014\u8BF7\u91CD\u8BD5\uFF1B\u591A\u6B21\u5931\u8D25\u53EF\u590D\u5236\u65E5\u5FD7\u53CD\u9988";
/**
 * 壳侧/页面侧的失败原因 → 人话。
 *
 * `load-error:<code>` 这类**带前缀的复合码**按前缀归类（后缀是 WebView 的内部错误码，
 * 对用户无意义）；`reason` 里混进异常消息时也走兜底——绝不把异常措辞当文案。
 * @param reason - 壳侧回的原因码，或页面自查码。
 * @returns 用户可读的一句话（含下一步）。
 */
export declare function describeCallReason(reason: string | undefined): string;
/**
 * HTTP 状态 → 人话（**状态码不上屏**）。
 *
 * 缺陷现场（审查档 §4.1）：界面上出现过「未获授权（HTTP 401）」「扫描失败（HTTP 500）」——
 * 用户拿不到任何可执行信息，只知道有个编号。这里按语义分档，`status` 仅留给调用方放进
 * `data-http` 与诊断日志。
 * @param action - 动作名（「读取来件状态」「清理运行时缓存」…），拼进句子。
 * @param status - HTTP 状态码（仅用于分档，不拼进返回串）。
 * @returns 用户可读的一句话（含下一步）。
 */
export declare function describeHttpFailure(action: string, status: number): string;
/**
 * 通知设置写失败原因 → 人话（P3-1 + P3-6）。
 *
 * 壳侧 `NotifyCenter.applySetting` 回 `unknown-key` / `readback-mismatch` 两个码：
 * 前者是本版不认识该开关（不该发生），后者是写完读回与预期不一致（系统拦了写入）。
 * 旧实现把码与内部 key 一起上屏（「未生效（readback-mismatch）：cat.question」），
 * 这里改成「哪一类开关没生效 + 下一步」，key 不收进句子。
 */
export declare function describeNotifyWriteFailure(reason: string | undefined): string;
/**
 * 通知渠道重要性（壳侧 `importance` 数字）→ 人话。
 *
 * 旧实现直接把数字印成「（重要性 4）」——数字档位对用户没有意义，用户要看的是
 * 「会不会响、会不会弹」。档位语义与 Android `NotificationManager.IMPORTANCE_*` 一一对应。
 * @param importance - 壳侧回的重要性整数。
 * @returns 「高（会弹出并响铃）」这类人话；非数字返回空串（调用方整段省略）。
 */
export declare function describeImportance(importance: unknown): string;
/**
 * 硬截断唯一入口（P3-4）：超长一律附省略号。
 *
 * 缺陷现场：`take(24)` / `slice(0, 20)` 这类硬截断把 `rm -rf /data/loca` 呈现成一条**看起来
 * 完整**的命令——用户据此判断「AI 在跑什么」会得出错误结论。截断必须自己说出来。
 * @param text - 原文。
 * @param max - 允许的最大字符数（含省略号）。
 * @returns 未超长时原样；超长时 `max-1` 个字符 + `…`。
 */
export declare function truncateWithEllipsis(text: string, max: number): string;
/**
 * 时长口径唯一真源（P3-3，页面侧）。
 *
 * 口径与壳侧 `UserCopy.durationText` **同规则**：`< 60s` 用「X秒」、`>= 60s` 用「X分Y秒」、
 * `>= 1h` 用「X小时Y分」；不出现 `8.4s` / `1m24s` 这类英文单位混排。
 * 未知（`<= 0`）返回空串，调用方**整段省略**，不打印 `-` 这类占位符。
 * @param ms - 毫秒数。
 * @returns 统一口径的时长文本。
 */
export declare function formatDuration(ms: number): string;
/**
 * 一条用户可见回执：**人话正文 + 机器码**。
 *
 * 这是「码不上屏」这一条规则的载体：正文由本文件的翻译函数产出，码/状态码只经
 * [noticeDataAttrs] 落进 `data-*`。组件里有 `code`/`http` 时**不得**把它拼进 `text`。
 */
export interface Notice {
    /** 用户可读正文（含下一步）。 */
    text: string;
    /** 壳侧/页面侧的失败原因码（诊断用；不进正文）。 */
    code?: string;
    /** HTTP 状态码（诊断用；不进正文）。 */
    http?: number;
}
/**
 * [Notice] → 可直接展开进 JSX 的 `data-*` 属性（空值不产生属性）。
 * @param notice - 回执。
 * @returns `{'data-code'?: string, 'data-http'?: string}`。
 */
export declare function noticeDataAttrs(notice: Notice): Record<string, string>;
