import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * 开发者选项「清除运行时缓存」面板（0.14.1 块 E 的客户端半）。
 *
 * 交互口径（`docs/0.14.1-preview-LEGACY-AND-PERF.md` §4.3③「先给可回收体积再执行」）：
 *  1. 挂载即扫描（GET `/api/android/runtime-cache/scan`，只读）→ 展示**实测**可回收体积与逐项清单；
 *  2. 用户点「清理」→ 二次确认（列出即将删除的项与体积）→ POST `.../execute`；
 *  3. 结果按项展示（removed/failed/skipped 与原因）——失败与跳过都如实呈现，不粉饰成「已清干净」。
 *
 * 纪律：两次请求都带 `credentials: 'same-origin'`（浏览器面凭据 = same-origin 会话 cookie；
 * 与 `DevSection` 的 file-incoming 面同款），且**绝不展示绝对路径**——宿主只下发
 * `$DSH_HOME`/`$DSH_FILES_DIR` 形态的标签。
 *
 * 用户裁定 7（仅用户平面，不给模型工具）：本面板只有页面按钮 + 受鉴权宿主能力，零新增模型可见工具。
 */
import { useCallback, useEffect, useState } from 'react';
import { describeHttpFailure, noticeDataAttrs } from "../user-copy.js";
/** 字节格式化（与设置页其它面同款口径）。 */
function fmtBytes(n) {
    if (n >= 1024 * 1024)
        return (n / 1024 / 1024).toFixed(1) + ' MB';
    if (n >= 1024)
        return (n / 1024).toFixed(1) + ' KB';
    return n + ' B';
}
/**
 * 跳过原因的中文短标签（未知原因**不原样透出**，见 P3-6：机器码不上屏）。
 *
 * 未登记的原因落到 [describeSkipReason] 的兜底句，原始串只进 `data-reason`。
 */
const SKIP_LABEL = {
    'not-allowlisted': '未列入白名单（本版不清理）',
    absent: '不存在',
    unreadable: '不可读',
    'log-root-unresolved': '日志目录未注入（应用未提供日志目录）',
    'current-generation-absent': '当前引擎日志不在场（引擎未启动）',
    preserved: '属保留项',
    'scope-rejected': '越出白名单作用域（已拒绝）',
    vanished: '执行前已消失',
    aborted: '被执行中断跳过',
    // 执行期失败：原因是稳定码，OS 错误串在 `detail` 里（只进 data-detail）。
    'remove-failed': '删除失败（文件被占用、只读或权限不足）',
};
/**
 * 跳过/失败原因 → 人话（P3-1）。
 * @param item - 扫描或执行结果里的一项。
 * @returns 已知原因的中文短标签；未知原因给兜底句（**不回显原码**）。
 */
function describe(item) {
    const reason = item.reason ?? '';
    if (reason === '')
        return '原因未记录';
    return SKIP_LABEL[reason] ?? '原因未在本版登记（可复制日志反馈）';
}
/**
 * 「清除运行时缓存」设置行。
 * @returns 该设置分区内的一个功能块。
 */
export function RuntimeCacheRow() {
    const [scan, setScan] = useState({});
    /**
     * 扫描状态（S3-16）：`unknown`（还没读到/宿主不可用）与 `ok`（真值）必须分开——
     * 旧实现把「读不到」渲染成「可回收：0 B（0 项）」，看起来像「确实没东西可清」的合法空态。
     */
    const [scanState, setScanState] = useState('unknown');
    const [report, setReport] = useState(null);
    const [message, setMessage] = useState(null);
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const refresh = useCallback(async () => {
        try {
            const response = await fetch('/api/android/runtime-cache/scan', { credentials: 'same-origin', cache: 'no-store' });
            if (!response.ok) {
                // P3-1/P3-6：状态码只作分档依据，进正文的是「发生了什么 + 能做什么」。
                setScanState('failed');
                setMessage({ text: describeHttpFailure('读取运行时缓存', response.status), http: response.status });
                return;
            }
            const payload = (await response.json());
            setScan(payload);
            setScanState('ok');
            setMessage(null);
        }
        catch {
            // 桌面宿主/未装配：不报错（本行是 Android 壳设施），但**也不许冒充真值**——
            // 状态留 unknown ⇒ 头部显示「读不到」而不是「0 B」。
            setScanState('unknown');
            setMessage(null);
        }
    }, [setScan]);
    useEffect(() => { void refresh(); }, [refresh]);
    const run = useCallback(async () => {
        setConfirming(false);
        setBusy(true);
        setMessage(null);
        try {
            const response = await fetch('/api/android/runtime-cache/execute', {
                method: 'POST',
                credentials: 'same-origin',
                cache: 'no-store',
            });
            if (!response.ok) {
                setMessage({ text: describeHttpFailure('清理运行时缓存', response.status), http: response.status });
                return;
            }
            const payload = (await response.json().catch(() => null));
            setReport(payload);
            if (payload === null) {
                setMessage({ text: '清理结果无法解析（响应不是预期的数据）——请重试；仍失败可复制日志反馈' });
            }
        }
        catch {
            setMessage({ text: '清理请求失败（仅安卓应用内有此能力）——请确认在本机应用内操作' });
        }
        finally {
            setBusy(false);
            void refresh();
        }
    }, [refresh]);
    const reclaimable = typeof scan.reclaimableBytes === 'number' ? scan.reclaimableBytes : 0;
    const targets = Array.isArray(scan.targets) ? scan.targets : [];
    const skipped = Array.isArray(scan.skipped) ? scan.skipped : [];
    const items = report !== null && Array.isArray(report.items) ? report.items : [];
    return (_jsxs("div", { className: "dsh-dev-cache", "data-plugin": "dev-runtime-cache", children: [_jsxs("div", { className: "dsh-dev-row", "data-scan-state": scanState, children: [_jsx("span", { children: scanState === 'ok'
                            ? (reclaimable > 0
                                // 真值：读到了，且有可回收体积。
                                ? '运行时缓存可回收：' + fmtBytes(reclaimable) + '（' + String(targets.length) + ' 项）'
                                // 真值：读到了，确实没有可清理项（这才是合法的空态）。
                                : '运行时缓存：暂无可清理项（本版白名单内没有残留）')
                            : '运行时缓存可回收：读不到（不是 0——应用内的读取通道不可用或返回异常）' }), _jsx("button", { type: "button", className: "dsh-dev-btn", disabled: busy, onClick: () => { void refresh(); }, children: "\u91CD\u65B0\u626B\u63CF" }), _jsx("button", { type: "button", className: "dsh-dev-btn dsh-dev-danger", disabled: busy || scanState !== 'ok' || reclaimable === 0, onClick: () => { setConfirming(true); }, children: busy ? '清理中…' : '清理' })] }), scanState === 'ok' && targets.length > 0 && (_jsx("ul", { className: "dsh-dev-cache-list", children: targets.map((item) => (_jsxs("li", { children: [item.label ?? item.id, " \u2014 ", fmtBytes(typeof item.bytes === 'number' ? item.bytes : 0), typeof item.files === 'number' ? '（' + String(item.files) + ' 项）' : ''] }, item.label ?? item.id))) })), _jsx("p", { className: "dsh-dev-hint", children: "\u767D\u540D\u5355\u5236\uFF1A\u53EA\u6E05\u7406\u672C\u7248\u5DF2\u77E5\u5B89\u5168\u7684\u5F15\u64CE\u8FD0\u884C\u65F6\u6B8B\u7559\uFF08\u5F15\u64CE\u65E5\u5FD7\u5386\u53F2\u4EE3 + \u5E94\u7528\u79C1\u6709\u6570\u636E\u4E0B\u6709\u540D\u6709\u636E\u7684\u7F13\u5B58\u76EE\u5F55\uFF09\u3002 \u5F53\u524D\u5F15\u64CE\u65E5\u5FD7\uFF08\u58F3\u4FA7\u9274\u6743\u94FE\u4F9D\u8D56\u5B83\uFF09\u3001\u4F1A\u8BDD\u4E0E\u9644\u4EF6\u3001\u51ED\u636E\u3001\u7528\u6237\u8BBE\u7F6E\u3001\u5DF2\u88C5\u63D2\u4EF6\u4E00\u5F8B\u4E0D\u89E6\u78B0\uFF1B DSH_HOME/cache \u6309\u5B50\u76EE\u5F55\u5206\u522B\u88C1\u5B9A\uFF0C\u672C\u7248\u672A\u7EB3\u5165\u4EFB\u4F55\u5B50\u76EE\u5F55\uFF0C\u56E0\u6B64\u6574\u76EE\u5F55\u9010\u9879\u8DF3\u8FC7\u5E76\u5982\u5B9E\u5217\u51FA\u3002 \u672A\u8BC6\u522B\u7684\u8DEF\u5F84\u4F1A\u88AB\u663E\u5F0F\u8DF3\u8FC7\u3002\u672C\u7248\u4E0D\u6E05\u7406 pnpm store\uFF0C\u4E5F\u4E0D\u89E6\u78B0\u5FEB\u7167\u5728\u9014\u6807\u5FD7\u3002" }), skipped.length > 0 && (_jsxs("details", { className: "dsh-dev-hint", children: [_jsxs("summary", { children: ["\u8DF3\u8FC7 ", skipped.length, " \u9879\uFF08\u672A\u8BC6\u522B/\u4FDD\u7559\uFF09"] }), _jsx("ul", { className: "dsh-dev-cache-list", children: skipped.map((item) => (_jsxs("li", { children: [item.label ?? item.id, "\uFF1A", describe(item)] }, item.label ?? item.id))) })] })), message !== null && (_jsx("p", { className: "dsh-dev-hint", ...noticeDataAttrs(message), children: message.text })), report !== null && (_jsxs("div", { children: [_jsxs("p", { className: "dsh-dev-hint", children: ["\u5DF2\u6E05\u7406 ", String(report.removed ?? 0), " \u9879\uFF0C\u91CA\u653E ", fmtBytes(typeof report.removedBytes === 'number' ? report.removedBytes : 0), "\uFF08\u626B\u63CF\u503C ", fmtBytes(typeof report.plannedBytes === 'number' ? report.plannedBytes : 0), "\uFF09", typeof report.failed === 'number' && report.failed > 0 ? '；' + String(report.failed) + ' 项失败' : ''] }), _jsx("ul", { className: "dsh-dev-cache-list", children: items.map((item) => (_jsxs("li", { ...(item.reason === undefined || item.reason === '' ? {} : { 'data-reason': item.reason }), ...(item.detail === undefined || item.detail === '' ? {} : { 'data-detail': item.detail }), children: [item.label ?? item.id, " \u2014 ", item.status === 'removed' ? '已删除 ' + fmtBytes(typeof item.bytes === 'number' ? item.bytes : 0)
                                    : item.status === 'failed' ? '失败：' + describe(item)
                                        : '跳过：' + describe(item)] }, item.label ?? item.id))) })] })), confirming && (_jsx("div", { className: "dsh-dev-modal-overlay", role: "dialog", "aria-modal": "true", "aria-label": "\u786E\u8BA4\u6E05\u9664\u8FD0\u884C\u65F6\u7F13\u5B58", onClick: () => { setConfirming(false); }, children: _jsxs("div", { className: "dsh-dev-modal", role: "document", onClick: (event) => { event.stopPropagation(); }, children: [_jsx("p", { className: "dsh-dev-modal-title", children: "\u786E\u8BA4\u6E05\u9664\u8FD0\u884C\u65F6\u7F13\u5B58\uFF1F" }), _jsxs("p", { className: "dsh-dev-modal-desc", children: ["\u5C06\u5220\u9664\u4EE5\u4E0B ", targets.length, " \u9879\uFF0C\u5408\u8BA1 ", fmtBytes(reclaimable), "\u3002\u4F1A\u8BDD\u3001\u9644\u4EF6\u3001\u51ED\u636E\u3001 \u8BBE\u7F6E\u3001\u5DF2\u88C5\u63D2\u4EF6\u4E0E\u5F53\u524D\u5F15\u64CE\u65E5\u5FD7\u4E0D\u53D7\u5F71\u54CD\uFF1B\u5220\u9664\u9010\u9879\u8FDB\u884C\uFF0C\u5931\u8D25\u9879\u4F1A\u5982\u5B9E\u5217\u51FA\u3002"] }), _jsx("ul", { className: "dsh-dev-cache-list", children: targets.map((item) => (_jsxs("li", { children: [item.label ?? item.id, " \u2014 ", fmtBytes(typeof item.bytes === 'number' ? item.bytes : 0)] }, item.label ?? item.id))) }), _jsxs("div", { className: "dsh-dev-modal-actions", children: [_jsx("button", { type: "button", className: "dsh-dev-btn", autoFocus: true, onClick: () => { setConfirming(false); }, children: "\u53D6\u6D88" }), _jsx("button", { type: "button", className: "dsh-dev-btn dsh-dev-danger", onClick: () => { void run(); }, children: "\u6E05\u7406" })] })] }) }))] }));
}
