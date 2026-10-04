import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Developer-options settings page (Android shell facilities): restart / shut down (both with a
 * custom confirm) / refresh UI / open console / dev debug-log toggle. Registered at the upstream
 * settings.section extension point (auto-projected by ui-settings-general's nav, zero upstream
 * changes). Bridge calls go through window.androidBridge (injected by MainActivity's
 * addJavascriptInterface).
 *
 * Restart and shut down draw a custom frontend confirm because WebView's window.confirm is
 * unreliable under the shell's auto-approving onJsAlert; "Shut down" stops the engine and falls
 * back to the init screen (shell shutdownToGuide bridge).
 */
import { useCallback, useEffect, useState } from 'react';
import { useShellState } from "../mobile/use-shell-state.js";
import { describeHttpFailure, noticeDataAttrs } from "../user-copy.js";
import { RuntimeCacheRow } from "./runtime-cache.js";
/** 壳侧悬浮球开关真值回读（桥不可用/抛错 → false）。
 *  ST-02（页侧半边）：壳侧 getOverlayEnabled() = 偏好 && 悬浮窗权限 && 服务实例在场，
 *  权限缺失时偏好已回落 false —— 展示值只能以该回读为准，不得沿用上次的 UI 值。 */
function readOverlayEnabled() {
    try {
        return window.androidBridge?.getOverlayEnabled?.() ?? false;
    }
    catch {
        return false;
    }
}
/**
 * 破坏性/中断性操作的二次确认文案（0.14.1 批 9 / S3-14）。
 *
 * 为什么三处都要确认：同一页里「运行时缓存清理」原本有确认弹窗，而「一键清理临时工作区」
 * 与「关闭」一样是**单击即执行**的破坏性操作——同一个页面里同级破坏力却有两种确认强度，
 * 用户无法从外观预判哪一下会真的删东西（审查档 §3.3 第 14 行）。
 */
const CONFIRM_TEXT = {
    restart: {
        title: '重启 DeepCode？',
        desc: '将终止并自动重新启动本地引擎与页面（约数秒）。未发送的内容会保留在输入框。',
        ok: '重启',
    },
    close: {
        title: '关闭并回退到初始化界面？',
        desc: '将停止本地引擎并退出到初始化界面；引擎不会自动重启，需手动再次启动。',
        ok: '关闭',
    },
    clean: {
        title: '清理临时工作区？',
        desc: '将删除文件直达（分享进来）的临时文件；相关会话中的文件引用会失效，无法恢复。'
            + '会话本身、附件、配置与凭据不受影响。',
        ok: '清理',
    },
};
/**
 * Render the developer-options section content column.
 * @param props - composed slot props (contract/slots.ts).
 * @returns the section element tree.
 */
export function DevSection({ renderSlot }) {
    // ST-09：四处壳侧状态全部经 useShellState 订阅（挂载 + 可见/回前台重读 + 写后回读），
    // 不再裸写一次性桥读 —— 组件内不得在 useState 初值器里直读 window.androidBridge。
    const [devLog, refreshDevLog] = useShellState(() => {
        try {
            return window.androidBridge?.getDevLogEnabled?.() ?? false;
        }
        catch {
            return false;
        }
    });
    // 0.13.2 W7：悬浮球开关（壳侧持久化 + overlay 权限引导；未授权返回 false 并自动跳系统设置）。
    // ST-02：展示值一律以桥回读为准（壳侧 = 偏好 && 权限 && 服务在场），不做乐观置位。
    const [overlayOn, refreshOverlay] = useShellState(readOverlayEnabled);
    const [overlayMsg, setOverlayMsg] = useState(null);
    const [restarting, setRestarting] = useState(false);
    /** 重启/刷新等动作的失败回执（S3-15：旧实现在桥缺席时显示「重启中…」两秒后自己变回去）。 */
    const [actionMsg, setActionMsg] = useState(null);
    const [allFiles] = useShellState(() => {
        try {
            return window.androidBridge?.hasAllFilesAccess?.() ?? false;
        }
        catch {
            return false;
        }
    });
    const [confirm, setConfirm] = useState(null);
    // F5.1/D15（2026-08-23 补齐）：文件直达临时工作区占用 + 一键清理（R16 手动清理 + 占用展示）
    const [incomingBytes, setIncomingBytes] = useState(null);
    // 回执 = 人话正文 + 机器码；码只进 `data-http`（P3-1/P3-6）。
    const [incomingMsg, setIncomingMsg] = useState(null);
    const [cleaning, setCleaning] = useState(false);
    const refreshIncoming = useCallback(async () => {
        try {
            // FX-205.6：端点带插件侧鉴权——浏览器面凭据是 same-origin 会话 cookie，必须显式声明。
            const r = await fetch('/api/android/file-incoming', { credentials: 'same-origin', cache: 'no-store' });
            if (!r.ok) {
                setIncomingMsg({ text: describeHttpFailure('读取来件占用', r.status), http: r.status });
                return;
            }
            if (r.ok) {
                const j = (await r.json());
                setIncomingBytes(typeof j.bytes === 'number' ? j.bytes : null);
            }
        }
        catch {
            /* 非安卓应用内（浏览器等）：静默 */
        }
    }, []);
    useEffect(() => {
        void refreshIncoming();
    }, [refreshIncoming]);
    // 来件占用的可见/回前台刷新（F5 消费端同款路径）。壳侧状态的同类重读由 useShellState 负责。
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState !== 'visible')
                return;
            void refreshIncoming();
        };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', onVisible);
        return () => {
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', onVisible);
        };
    }, [refreshIncoming]);
    const cleanIncoming = useCallback(async () => {
        setCleaning(true);
        setIncomingMsg(null);
        try {
            const r = await fetch('/api/android/file-incoming/clean', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
            if (!r.ok) {
                setIncomingMsg({ text: describeHttpFailure('清理临时工作区', r.status), http: r.status });
                return;
            }
            const j = (await r.json().catch(() => null));
            // FX-205.5：清理范围收敛为「本工具自有临时项」，用户放入工作区的文件不再被删。
            setIncomingMsg(j?.ok
                ? { text: `已清理本工具临时项（${j.removed ?? 0} 项）——相关会话中的文件引用将失效` }
                : { text: '清理未完成——请重试；仍失败可复制日志反馈', ...(j?.reason === undefined ? {} : { code: j.reason }) });
        }
        catch {
            setIncomingMsg({ text: '清理请求失败（仅安卓应用内有此能力）——请确认在本机应用内操作' });
        }
        finally {
            setCleaning(false);
            void refreshIncoming();
        }
    }, [refreshIncoming]);
    const fmtBytes = (n) => {
        if (n >= 1024 * 1024)
            return (n / 1024 / 1024).toFixed(1) + ' MB';
        if (n >= 1024)
            return (n / 1024).toFixed(1) + ' KB';
        return n + ' B';
    };
    const askRestart = useCallback(() => setConfirm('restart'), []);
    const askClose = useCallback(() => setConfirm('close'), []);
    const cancelConfirm = useCallback(() => setConfirm(null), []);
    const doRestart = useCallback(() => {
        setConfirm(null);
        setActionMsg(null);
        // S3-15：只有**真的发起了**重启才进入忙碌态；否则如实说没发起（旧实现无论成败都显示
        // 「重启中…」并在 2s 后自己变回——那是「看起来在工作」的假忙碌，用户会以为重启过了）。
        let started = false;
        try {
            started = window.androidBridge?.restartEngine?.() === true;
        }
        catch {
            started = false;
        }
        if (!started) {
            setActionMsg({ text: '重启没有发起：应用与页面的连接不可用，或已在重启中——请稍等几秒；仍无效请关闭并重新打开应用' });
            return;
        }
        setRestarting(true);
        window.setTimeout(() => setRestarting(false), 2000);
    }, []);
    const doClose = useCallback(() => {
        setConfirm(null);
        try {
            window.androidBridge?.shutdownToGuide?.();
        }
        catch {
            /* bridge absent: nothing to do */
        }
    }, []);
    const reload = useCallback(() => {
        setActionMsg(null);
        try {
            if (window.androidBridge?.reloadWebUI === undefined) {
                setActionMsg({ text: '刷新界面不可用：应用与页面的连接未装配——请关闭并重新打开应用' });
                return;
            }
            window.androidBridge.reloadWebUI();
        }
        catch {
            setActionMsg({ text: '刷新界面失败：应用与页面的连接不可用——请关闭并重新打开应用' });
        }
    }, []);
    const openConsole = useCallback(() => {
        setActionMsg(null);
        try {
            if (window.androidBridge?.openConsole === undefined) {
                setActionMsg({ text: '控制台不可用：应用与页面的连接未装配——请关闭并重新打开应用' });
                return;
            }
            window.androidBridge.openConsole();
        }
        catch {
            setActionMsg({ text: '控制台打开失败：应用与页面的连接不可用——请关闭并重新打开应用' });
        }
    }, []);
    const toggleLog = useCallback((enabled) => {
        try {
            window.androidBridge?.setDevLogEnabled?.(enabled);
        }
        catch {
            /* bridge absent: nothing to do */
        }
        // 写后回读（§4.5 七模式之五）：展示值 = 壳侧真值，不做乐观置位
        // （ST-11 落地后 getDevLogEnabled = 偏好 && 采集器在跑，回读即真实采集状态）。
        refreshDevLog();
    }, [refreshDevLog]);
    // 0.13.2 W7：悬浮球开关（实时查看 AI 工具调用 + 停止）。
    const toggleOverlay = useCallback((enabled) => {
        setOverlayMsg(null);
        try {
            const started = window.androidBridge?.setOverlayEnabled?.(enabled) ?? false;
            // ST-02：开关以桥回读为准（权限缺失时壳侧偏好已回落 false），不再乐观置位；
            // 「返回后自动生效」因此不再成立——必须回前台重读 + 用户重新打开开关。
            refreshOverlay();
            if (enabled && !started) {
                setOverlayMsg('已打开系统授权页；授予后请重新打开本开关');
            }
            else if (enabled) {
                setOverlayMsg('悬浮球已开启：任意界面可拖拽；点开面板实时查看工具调用，可一键停止');
            }
            else {
                setOverlayMsg('悬浮球已关闭');
            }
        }
        catch {
            setOverlayMsg('应用内连接不可用（悬浮球仅安卓应用内支持）——请重新打开应用后重试');
        }
    }, [refreshOverlay]);
    // 0.13.1 W4：配置导入/导出（安全手改通道——引擎读私有目录，外部改共享副本无效）。
    const [configMsg, setConfigMsg] = useState(null);
    const exportConfig = useCallback(() => {
        try {
            const raw = window.androidBridge?.exportConfig?.();
            const j = JSON.parse(raw ?? '{}');
            setConfigMsg(j.ok ? `已导出到 ${j.path ?? 'exports/config/settings.yaml'}` : `导出失败：${j.error ?? '未知错误'}`);
        }
        catch {
            setConfigMsg('导出失败：应用内连接不可用（仅安卓应用内可用）——请重新打开应用后重试');
        }
    }, []);
    const importConfig = useCallback(() => {
        try {
            const raw = window.androidBridge?.importConfig?.();
            const j = JSON.parse(raw ?? '{}');
            setConfigMsg(j.ok ? `已导入并生效（原配置备份为 settings.yaml.import-backup）。${j.hint ?? ''}` : `导入失败：${j.error ?? '未知错误'}`);
        }
        catch {
            setConfigMsg('导入失败：应用内连接不可用（仅安卓应用内可用）——请重新打开应用后重试');
        }
    }, []);
    const onKeyDown = useCallback((e) => {
        if (e.key === 'Escape')
            cancelConfirm();
    }, [cancelConfirm]);
    const logPathHint = allFiles === false
        ? '未授予「所有文件访问」：日志将写入应用私有目录，授权后自动切换公共目录。'
        : '开启后按天写入 Documents/dshdata/log/dsh-<日期>.log。';
    return (_jsxs("div", { "data-plugin": "dev-section", onKeyDown: onKeyDown, children: [_jsx("p", { className: "dsh-dev-note", children: "DeepCode \u5F00\u53D1\u8005\u9009\u9879\uFF1A\u63A7\u5236\u53F0\u4E3A\u8FD0\u884C\u65F6\u5185\u5D4C\u547D\u4EE4\u884C\uFF1B\u65E5\u5FD7\u9ED8\u8BA4\u5173\u95ED\u3002" }), renderSlot?.('settings.dev.item', {}), _jsxs("div", { className: "dsh-dev-row", children: [_jsx("button", { type: "button", className: "dsh-dev-btn", onClick: askRestart, disabled: restarting, children: restarting ? '重启中…' : '重启' }), _jsx("button", { type: "button", className: "dsh-dev-btn dsh-dev-danger", onClick: askClose, children: "\u5173\u95ED" }), _jsx("button", { type: "button", className: "dsh-dev-btn", onClick: reload, children: "\u5237\u65B0\u754C\u9762" }), _jsx("button", { type: "button", className: "dsh-dev-btn", onClick: openConsole, children: "\u6253\u5F00\u63A7\u5236\u53F0" })] }), actionMsg !== null && _jsx("p", { className: "dsh-dev-warn", ...noticeDataAttrs(actionMsg), children: actionMsg.text }), _jsxs("label", { className: "dsh-dev-row dsh-dev-switch", children: [_jsx("input", { type: "checkbox", checked: devLog, onChange: (e) => toggleLog(e.target.checked) }), _jsx("span", { children: "\u5F00\u53D1\u8005\u8C03\u8BD5\u65E5\u5FD7" })] }), _jsxs("label", { className: "dsh-dev-row dsh-dev-switch", children: [_jsx("input", { type: "checkbox", checked: overlayOn, onChange: (e) => toggleOverlay(e.target.checked) }), _jsx("span", { children: "\u60AC\u6D6E\u7403\uFF08\u4EFB\u610F\u754C\u9762\u53EF\u89C1\u7684\u4EFB\u52A1\u9762\u677F\u5165\u53E3\uFF09" })] }), _jsx("p", { className: "dsh-dev-hint", children: "\u5C4F\u5E55\u4E0A\u7684\u5706\u7403\uFF1A\u70B9\u5F00\u53EF\u770B\u5B9E\u65F6\u5DE5\u5177\u8C03\u7528\u3001\u53EF\u4E00\u952E\u505C\u6B62\u3002\u4E0E\u300C\u624B\u673A\u63A7\u5236\u300D\u9875\u7684\u300C\u865A\u62DF\u5C4F\u6D6E\u7A97\u300D \uFF08\u9000\u540E\u53F0\u663E\u793A\u865A\u62DF\u5C4F\u753B\u9762\uFF09\u662F\u4E24\u4E2A\u4E0D\u540C\u7684\u4E1C\u897F\u3002" }), overlayMsg !== null && _jsx("p", { className: "dsh-dev-hint", children: overlayMsg }), _jsxs("div", { className: "dsh-dev-row", children: [_jsx("button", { type: "button", className: "dsh-dev-btn", onClick: exportConfig, children: "\u5BFC\u51FA\u914D\u7F6E" }), _jsx("button", { type: "button", className: "dsh-dev-btn", onClick: importConfig, children: "\u5BFC\u5165\u914D\u7F6E" })] }), configMsg !== null && _jsx("p", { className: "dsh-dev-hint", children: configMsg }), _jsx("p", { className: "dsh-dev-hint", children: "\u5BFC\u51FA\u4F4D\u7F6E Documents/dshdata/exports/config/settings.yaml\uFF1B\u7528\u6587\u4EF6\u7BA1\u7406\u5668\u4FEE\u6539\u540E\u70B9\u300C\u5BFC\u5165\u914D\u7F6E\u300D\u5373\u53EF\u751F\u6548\u3002 \u914D\u7F6E\u4E0D\u542B API \u5BC6\u94A5\uFF08\u5BC6\u94A5\u5728\u5E94\u7528\u79C1\u6709\u76EE\u5F55\uFF0C\u4E0D\u968F\u5BFC\u51FA\u6CC4\u6F0F\uFF09\u3002" }), _jsx(RuntimeCacheRow, {}), _jsx("p", { className: "dsh-dev-hint", children: "\u901A\u77E5\u7684\u63D0\u9192\u65B9\u5F0F\uFF08\u542B\u300C\u5173\u6389\u63D0\u95EE\u63D0\u9192\u4F1A\u53D1\u751F\u4EC0\u4E48\u300D\uFF09\u5728\u300C\u8BBE\u7F6E \u2192 \u901A\u77E5\u300D\u91CC\u3002" }), incomingBytes !== null && (_jsxs("div", { className: "dsh-dev-row", children: [_jsxs("span", { children: ["\u6587\u4EF6\u76F4\u8FBE\u4E34\u65F6\u5DE5\u4F5C\u533A\u5360\u7528\uFF1A", fmtBytes(incomingBytes)] }), _jsx("button", { type: "button", className: "dsh-dev-btn dsh-dev-danger", disabled: cleaning || incomingBytes === 0, onClick: () => { setConfirm('clean'); }, children: cleaning ? '清理中…' : '一键清理' })] })), incomingMsg !== null && _jsx("p", { className: "dsh-dev-hint", ...noticeDataAttrs(incomingMsg), children: incomingMsg.text }), _jsx("p", { className: "dsh-dev-hint", children: "\u6E05\u7406\u4F1A\u5220\u9664\u4E34\u65F6\u5DE5\u4F5C\u533A\u5185\u7684\u5916\u90E8\u6587\u4EF6\uFF1B\u76F8\u5173\u4F1A\u8BDD\u4E2D\u7684\u6587\u4EF6\u5F15\u7528\u5C06\u5931\u6548\uFF08D15\uFF1A\u7EAF\u624B\u52A8\u6E05\u7406\uFF0C\u65E0\u81EA\u52A8\u6E05\u7406\uFF09\u3002" }), _jsx("p", { className: "dsh-dev-hint", children: logPathHint }), _jsx("p", { className: "dsh-dev-warn", children: "\u65E5\u5FD7\u5305\u542B\u547D\u4EE4\u4E0E\u6A21\u578B\u5185\u5BB9\uFF0C\u4EC5\u7528\u4E8E\u6392\u67E5\uFF0C\u8BF7\u53CA\u65F6\u6E05\u7406\u3002" }), confirm !== null && (_jsx("div", { className: "dsh-dev-modal-overlay", role: "dialog", "aria-modal": "true", "aria-label": CONFIRM_TEXT[confirm].title, onClick: cancelConfirm, children: _jsxs("div", { className: "dsh-dev-modal", role: "document", onClick: (e) => e.stopPropagation(), children: [_jsx("p", { className: "dsh-dev-modal-title", children: CONFIRM_TEXT[confirm].title }), _jsx("p", { className: "dsh-dev-modal-desc", children: CONFIRM_TEXT[confirm].desc }), _jsxs("div", { className: "dsh-dev-modal-actions", children: [_jsx("button", { type: "button", className: "dsh-dev-btn", autoFocus: true, onClick: cancelConfirm, children: "\u53D6\u6D88" }), _jsx("button", { type: "button", className: confirm === 'restart' ? 'dsh-dev-btn' : 'dsh-dev-btn dsh-dev-danger', onClick: () => {
                                        const which = confirm;
                                        setConfirm(null);
                                        if (which === 'restart')
                                            doRestart();
                                        else if (which === 'close')
                                            doClose();
                                        else
                                            void cleanIncoming();
                                    }, children: CONFIRM_TEXT[confirm].ok })] })] }) }))] }));
}
