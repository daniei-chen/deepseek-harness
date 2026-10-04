import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * "Open with" tab body: what the right Sidebar shows for a file no preview can
 * render (archives, packages, binaries, installers). The type's claims live in
 * `external-open-paths.ts`; this file is only the card and its two gestures.
 *
 * The body reads no file content: it names the file and hands the absolute
 * device path to the shell's native chooser, so opening a 200 MB archive costs
 * nothing.
 */
import { useState } from 'react';
import { parseFileAddress, resolveAbsolutePath } from "./address.js";
import { basenameOf } from "./external-open-paths.js";
import { chooserAvailable, openPathChooser } from "./open-path.js";
import { sessionCwd } from "./session-cwd.js";
import { reportUserFacingResult } from "../export-result.js";
import css from './ExternalOpen.module.css';
/** The directory holding a path (the chooser's `folder` target). */
function parentDirectory(path) {
    const cut = path.replace(/\/+$/, '').lastIndexOf('/');
    return cut <= 0 ? path : path.slice(0, cut);
}
/**
 * The tab body: name the file, then hand it to the system chooser.
 * @param props - the session-scoped tab share (runtime hooks + the tab reader).
 * @returns the card, or an explanation when this host cannot open paths.
 */
export function ExternalOpenTab({ sessionId, useSessions, useTabInfo }) {
    const info = useTabInfo();
    const cwd = useSessions(state => sessionCwd(state, sessionId));
    const address = info.tab.navigation.address;
    const parsed = parseFileAddress(address);
    const absolute = parsed === undefined ? undefined : resolveAbsolutePath(parsed, cwd);
    const [failure, setFailure] = useState(null);
    const hand = (target, mode) => {
        const result = openPathChooser(target, mode);
        if (result.ok) {
            setFailure(null);
            return;
        }
        const next = result.reason === 'no-handler'
            ? { title: '没有可用的文件管理器', detail: '设备上没有能打开该路径的应用，可先安装 MT 管理器。' }
            : { title: '打开失败', detail: `调用系统选择器失败（${result.reason ?? 'unknown'}）。` };
        setFailure(next);
        reportUserFacingResult({ ok: false, ...next });
    };
    return (_jsxs("div", { className: css.card, children: [_jsx("p", { className: css.name, children: basenameOf(address) }), _jsx("p", { className: css.path, children: absolute ?? address }), _jsx("p", { className: css.hint, children: "\u8BE5\u683C\u5F0F\u6CA1\u6709\u5185\u7F6E\u9884\u89C8\uFF0C\u53EF\u4EA4\u7ED9\u8BBE\u5907\u4E0A\u7684\u5E94\u7528\u6253\u5F00\u3002" }), chooserAvailable() && absolute !== undefined
                ? (_jsxs("div", { className: css.actions, children: [_jsx("button", { type: "button", className: css.primary, onClick: () => { hand(parentDirectory(absolute), 'folder'); }, children: "\u6253\u5F00\u6240\u5728\u6587\u4EF6\u5939" }), _jsx("button", { type: "button", className: css.secondary, onClick: () => { hand(absolute, 'view'); }, children: "\u7528\u5176\u5B83\u5E94\u7528\u6253\u5F00" })] }))
                : (_jsx("p", { className: css.hint, children: absolute === undefined ? '无法确定该文件的设备路径。' : '当前环境不支持调用系统应用（请在安卓应用内打开）。' })), failure !== null && _jsxs("p", { className: css.failure, children: [failure.title, "\uFF1A", failure.detail] })] }));
}
