import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * 通知设置行（0.14.1 块J FIX-4 的页面半）。
 *
 * 背景（J-1「FIX-4 名义落地、实际不可达」）：壳侧 `NotifyCenter.settingsSnapshot` /
 * `applySetting` / `onSuppressForegroundChanged` 三个入口在 `app/src/main` 全仓**零外部调用点**
 * （只有定义处互调），`AndroidBridge.kt` 的 35 个 `@JavascriptInterface` 无一涉及 notify/suppress，
 * 本目录亦 0 命中——能力在、入口无，与它要修的缺陷同形复发。本组件补上页面侧入口。
 *
 * 通道选择：桥方法（`window.androidBridge.getNotifySetting` / `setNotifySetting`）而不是 `/api` 路由。
 * 理由是**真源位置**：这些设置落在 Android 侧 `SharedPreferences("dsh-notify")`，引擎侧插件进程
 * 读不到它；桥是同一宿主内的唯一可达通道，与 `setImmersiveMode` / `setDevLogEnabled` /
 * `setOverlayEnabled` / `setVdisplayScale` 等既有设置面完全同构。因此不新增 `/api` 路由，
 * `scripts/api-route-auth-policy.json` 无需登记（该门禁只约束 `/api` 注册）。
 *
 * 数据面纪律（与 `GeneralSettings` / `DevSection` 同款）：
 *  - 全部状态经 `useShellState` 订阅（挂载读 + 可见/回前台重读），不在 `useState` 初值器里裸读桥；
 *  - **写后回读**：`setNotifySetting` 的返回带 `applied`，只有 `applied=true` 才展示为新值，
 *    否则保留壳侧回读值并如实显示失败原因（拒绝乐观置位）。
 */
import { useCallback, useState } from 'react';
import { useShellState } from "../mobile/use-shell-state.js";
import { describeImportance, describeNotifyWriteFailure, noticeDataAttrs } from "../user-copy.js";
/**
 * 分类展示名 + **关掉会怎样**（与 `NotifyCenter.Face` 的五类一一对应；顺序即 UI 顺序）。
 *
 * 为什么每行必须带后果（0.14.1 批 4 / P0-5）：旧界面是五个纯标签开关，一行解释都没有。
 * 而关掉「提问 / 授权请求」的实际后果远重于其它三类——引擎侧 `ask_user_question` 与授权请求
 * **没有超时**，用户以为「少点打扰」，实际是任务永久挂起（现象是「AI 不动了」）。
 * 壳侧已把这类的关闭语义改成「不弹窗、不响铃，但仍投递到通知栏可作答」；文案必须如实说明这一点，
 * 否则用户仍在按旧语义做决定。
 */
const CATEGORY_LABELS = [
    ['report', '工作汇报', '关闭后不再提醒；任务本身不受影响'],
    ['question', '提问', '关闭 = 不弹窗、不响铃；提问仍会出现在通知栏、可直接作答（AI 在等你的回答）'],
    ['approval', '授权请求', '关闭 = 不弹窗、不响铃；仍需你在通知栏或应用内批准，工具不会自动放行'],
    ['todo', '待办进度', '关闭后不再显示步骤进度；任务本身不受影响'],
    ['silent', '后台动态', '关闭后不再显示看门狗与引擎状态；只影响提示，不影响引擎'],
];
/** 读自检；桥缺席/不可解析返回 null（页面显示「不可用」，不伪造）。 */
function readSelfCheck() {
    try {
        const raw = window.androidBridge?.notifySelfCheck?.();
        if (raw === undefined || raw === '')
            return null;
        const value = JSON.parse(raw);
        if (value === null || typeof value !== 'object')
            return null;
        if (value.ok === false)
            return null;
        return value;
    }
    catch {
        return null;
    }
}
/** 解析桥返回；不可解析/桥缺席一律返回 null（调用方据此显示「不可用」，不伪造状态）。 */
function parseSnapshot(raw) {
    if (raw === undefined || raw === '')
        return null;
    try {
        const value = JSON.parse(raw);
        if (value === null || typeof value !== 'object')
            return null;
        const snapshot = value;
        // `{ok:false}` = 壳侧明确拒绝（未绑定上下文等）：当作不可用，而不是当作「全部默认值」。
        if (snapshot.ok === false)
            return null;
        return snapshot;
    }
    catch {
        return null;
    }
}
/** 读壳侧真源（每次调用现读；桥缺席返回 undefined）。 */
function readSettings() {
    try {
        return window.androidBridge?.getNotifySetting?.('');
    }
    catch {
        return undefined;
    }
}
/**
 * 「通知」设置块：前台抑制开关 + 五类分类开关。
 * @returns 该设置分区内的一个功能块；桥不可用时只显示一行不可用说明。
 */
export function NotifySettingsRow() {
    const [raw, refresh] = useShellState(readSettings, { pollMs: 0 });
    // 回执 = 人话正文 + 机器码；码只进 `data-code`（P3-1/P3-6）。
    const [message, setMessage] = useState(null);
    // 自检按需拉取（用户点「通知自检」才读）：它是诊断面，不该在每次渲染都问壳侧。
    const [selfCheck, setSelfCheck] = useState(null);
    const [selfCheckTried, setSelfCheckTried] = useState(false);
    const snapshot = parseSnapshot(raw);
    /** 写一项并**按返回读回**（applied=false 即未生效，不乐观置位）。 */
    const write = useCallback((key, value) => {
        let reply = null;
        try {
            reply = parseSnapshot(window.androidBridge?.setNotifySetting?.(key, value));
        }
        catch {
            reply = null;
        }
        if (reply === null) {
            setMessage({ text: '写入失败：应用内连接不可用（仅安卓应用内可用）——请重新打开应用后重试' });
            refresh();
            return;
        }
        if (reply.applied !== true) {
            // 壳侧如实回了 applied=false（未知 key / 读回不一致）：显示人话真因，不改展示值。
            // P3-1/P3-6：旧文案把码与内部 key 一起上屏（「未生效（readback-mismatch）：cat.question」），
            // 码与 key 现在只进 data-* 与日志。
            setMessage({ text: describeNotifyWriteFailure(reply.reason), ...(reply.reason === undefined ? {} : { code: reply.reason }) });
            refresh();
            return;
        }
        setMessage(null);
        // 展示值只认壳侧回读：refresh() 重新从真源读，而不是把入参写进本地 state。
        refresh();
    }, [refresh]);
    if (snapshot === null) {
        return (_jsx("div", { className: "dsh-dev-notify", "data-plugin": "dev-notify-settings", children: _jsx("p", { className: "dsh-dev-hint", children: "\u901A\u77E5\u8BBE\u7F6E\u4E0D\u53EF\u7528\uFF08\u6865\u672A\u88C5\u914D\u6216\u58F3\u4FA7\u4E0A\u4E0B\u6587\u672A\u7ED1\u5B9A\uFF09\u3002" }) }));
    }
    const suppress = snapshot.suppressForeground === true;
    const isDefault = suppress === (snapshot.suppressForegroundDefault === true);
    const categories = snapshot.categories ?? {};
    const channelRows = selfCheck?.channels ?? [];
    const degradedRows = channelRows.filter((row) => row.degraded === true);
    /** 渠道档位文本：壳侧人话优先，缺失才回退到页面侧的数值翻译（快照可能比 APK 新）。 */
    const importanceTextOf = (row) => row.importanceLabel !== undefined && row.importanceLabel !== ''
        ? row.importanceLabel
        : describeImportance(row.importance);
    return (_jsxs("div", { className: "dsh-dev-notify", "data-plugin": "dev-notify-settings", children: [_jsxs("label", { className: "dsh-dev-row dsh-dev-switch", children: [_jsx("input", { type: "checkbox", role: "switch", "aria-label": "\u524D\u53F0\u6291\u5236\u901A\u77E5", checked: suppress, onChange: (event) => { write('suppressForeground', event.target.checked); } }), _jsx("span", { children: "\u5E94\u7528\u5728\u524D\u53F0\u65F6\u4E0D\u5F39\u5DE5\u4F5C\u6C47\u62A5\uFF08\u6539\u4E3A\u5EF6\u540E\uFF0C\u56DE\u540E\u53F0\u8865\u6295\uFF09" })] }), _jsxs("p", { className: "dsh-dev-hint", children: ["\u5F53\u524D\uFF1A", suppress ? '前台抑制开启（工作汇报延后）' : '前台照常推送', isDefault ? '；等于本版默认值' : '；已偏离本版默认值'] }), _jsx("p", { className: "dsh-dev-hint", children: "\u5173\u95ED\u6291\u5236\uFF08\u9ED8\u8BA4\uFF09\u5373\u300C\u524D\u53F0\u4E5F\u53D1\u7CFB\u7EDF\u901A\u77E5\u300D\uFF1B\u5F00\u542F\u540E\u547D\u4E2D\u7684\u5DE5\u4F5C\u6C47\u62A5\u8FDB\u5165\u5F85\u6295\u961F\u5217\uFF0C \u56DE\u5230\u540E\u53F0\u6216\u518D\u6B21\u5173\u95ED\u6291\u5236\u65F6\u8865\u6295\uFF08\u961F\u5217\u6709 TTL \u4E0E\u5BB9\u91CF\u4E0A\u9650\uFF09\u3002\u63D0\u95EE\u4E0E\u6388\u6743\u8BF7\u6C42\u6C38\u4E0D\u53D7\u6B64\u9879\u5F71\u54CD\u3002" }), _jsx("div", { className: "dsh-dev-notify-cats", children: CATEGORY_LABELS.map(([key, label, consequence]) => (_jsxs("div", { className: "dsh-dev-notify-cat", children: [_jsxs("label", { className: "dsh-dev-row dsh-dev-switch", children: [_jsx("input", { type: "checkbox", role: "switch", "aria-label": label, checked: categories[key] === true, onChange: (event) => { write('cat.' + key, event.target.checked); } }), _jsx("span", { children: label })] }), _jsx("p", { className: "dsh-dev-hint", children: consequence })] }, key))) }), _jsxs("div", { className: "dsh-dev-row dsh-dev-split", children: [_jsx("button", { type: "button", className: "dsh-dev-btn", onClick: () => {
                            setSelfCheckTried(true);
                            setSelfCheck(readSelfCheck());
                        }, children: "\u901A\u77E5\u81EA\u68C0" }), _jsx("button", { type: "button", className: "dsh-dev-btn", onClick: () => {
                            let ok = false;
                            try {
                                ok = window.androidBridge?.openNotifyAppSettings?.() === true;
                            }
                            catch {
                                ok = false;
                            }
                            if (!ok)
                                setMessage({ text: '该系统没有「应用通知设置」页——请在系统设置里手动找到本应用的通知项' });
                        }, children: "\u7CFB\u7EDF\u901A\u77E5\u8BBE\u7F6E" })] }), _jsx("div", { className: "dsh-dev-row", children: _jsx("button", { type: "button", className: "dsh-dev-btn", onClick: () => {
                        let posted = 0;
                        try {
                            posted = window.androidBridge?.notifySendTest?.() ?? 0;
                        }
                        catch {
                            posted = 0;
                        }
                        setMessage(posted > 0
                            ? { text: '已发送 ' + String(posted) + ' 条测试通知（五类各一条）——请到通知栏看哪几条真的到了、哪几条是静默的' }
                            : { text: '一条也没发出去：通知权限未授予或渠道不可用——请先在上面的自检里看渠道状态，并到系统设置里允许通知' });
                    }, children: "\u53D1\u9001\u6D4B\u8BD5\u901A\u77E5" }) }), selfCheckTried && selfCheck === null && (_jsx("p", { className: "dsh-dev-warn", children: "\u81EA\u68C0\u4E0D\u53EF\u7528\uFF08\u6865\u672A\u88C5\u914D\u6216\u58F3\u4FA7\u4E0A\u4E0B\u6587\u672A\u7ED1\u5B9A\uFF09\u3002" })), selfCheck !== null && (_jsxs("div", { className: "dsh-dev-notify-check", children: [_jsxs("p", { className: "dsh-dev-hint", children: ["\u5E94\u7528\u901A\u77E5\u603B\u5F00\u5173\uFF1A", selfCheck.notificationsEnabled === false ? '系统已关闭' : '已开启', '；', "\u901A\u77E5\u6743\u9650\uFF1A", selfCheck.permissionLabel ?? (selfCheck.permissionGranted === true ? '已授予' : '未授予（任务完成不会提醒）')] }), degradedRows.length > 0 ? (_jsxs("p", { className: "dsh-dev-warn", children: ["\u7CFB\u7EDF\u5DF2\u964D\u7EA7\u4EE5\u4E0B\u901A\u77E5\uFF1A\u300C", degradedRows.map((row) => row.label ?? row.category ?? '未知渠道').join('、'), "\u300D\u2014\u2014 \u5E94\u7528\u65E0\u6CD5\u8C03\u56DE\uFF0C\u9700\u5728\u7CFB\u7EDF\u8BBE\u7F6E\u91CC\u6062\u590D\uFF08\u53EF\u4ECE\u53F3\u4FA7\u6309\u94AE\u8FDB\u5165\uFF09\u3002"] })) : (_jsx("p", { className: "dsh-dev-hint", children: "\u7CFB\u7EDF\u672A\u964D\u7EA7\u4EFB\u4F55\u901A\u77E5\u6E20\u9053\u3002" })), channelRows.map((c) => (_jsxs("div", { className: "dsh-dev-row dsh-dev-check-row", children: [_jsxs("span", { children: [(c.label ?? c.category ?? '未知渠道'), '：', c.degraded === true
                                        ? '系统已降级'
                                        : (c.exists === false ? '渠道不存在' : '正常'), importanceTextOf(c) === '' ? '' : '（' + importanceTextOf(c) + '）'] }), _jsx("button", { type: "button", className: "dsh-dev-link", onClick: () => {
                                    const channelId = String(c.selected ?? '');
                                    let ok = false;
                                    try {
                                        ok = channelId !== '' && window.androidBridge?.openNotifyChannelSettings?.(channelId) === true;
                                    }
                                    catch {
                                        ok = false;
                                    }
                                    if (!ok)
                                        setMessage({ text: '无法打开该渠道的系统设置页——请在系统设置里手动查找' });
                                }, children: "\u6253\u5F00\u8BE5\u6E20\u9053\u8BBE\u7F6E" })] }, String(c.selected ?? c.category))))] })), message !== null && (_jsx("p", { className: "dsh-dev-warn", ...noticeDataAttrs(message), children: message.text }))] }));
}
/**
 * 「通知」设置分区（0.14.1 批 3 / P3-5）。
 *
 * 真因：本块此前的**唯一入口**在「开发者选项」里（`index.ts` 的 `settings.section` id
 * `android-dev`）。而「关掉提问提醒 = 引擎的提问被静默丢弃、任务永久挂起」这类后果，
 * 是**每个用户**都要面对的决定，把它埋在开发者选项等于对普通用户不可达
 * （审查档 §3.3 第 14 行：入口埋在开发者选项）。
 *
 * 现在的层级：设置页一级分区「通知」（`android-notify`，order 97），与「手机控制」（98）并列；
 * 开发者选项里保留一行**指路**文案，不重复渲染同一组开关（同功能双实现是审查档 §5 的结构性根因）。
 *
 * @returns 该设置分区的内容列。
 */
export function NotifySettingsSection(_props) {
    return (_jsxs("section", { className: "dsh-screen-control-card", "aria-labelledby": "dsh-notify-title", children: [_jsx("header", { className: "dsh-screen-control-header", children: _jsxs("span", { children: [_jsx("strong", { id: "dsh-notify-title", children: "\u901A\u77E5" }), _jsx("small", { children: "\u4EFB\u52A1\u6C47\u62A5\u3001\u5411\u4F60\u63D0\u95EE\u4E0E\u6388\u6743\u8BF7\u6C42\u7684\u63D0\u9192\u65B9\u5F0F\uFF1B\u6A21\u578B\u4E0D\u80FD\u81EA\u884C\u66F4\u6539\u8FD9\u91CC\u7684\u4EFB\u4F55\u8BBE\u7F6E\u3002" })] }) }), _jsx(NotifySettingsRow, {})] }));
}
