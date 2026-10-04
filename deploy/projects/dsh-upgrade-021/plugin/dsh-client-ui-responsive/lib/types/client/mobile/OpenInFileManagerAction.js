import { jsx as _jsx } from "react/jsx-runtime";
import { chooserAvailable, openPathChooser } from "./open-path.js";
import { sessionCwd } from "./session-cwd.js";
import { reportUserFacingResult } from "../export-result.js";
import { describeCallReason } from "../user-copy.js";
import css from './OpenInFileManagerAction.module.css';
/** Label used for both the accessible name and the tooltip. */
const LABEL = '在文件中打开';
/**
 * The header button.
 * @param props - the session-scoped utility share.
 * @returns the button, or null when the host cannot open paths.
 */
export function OpenInFileManagerAction({ sessionId, useSessions }) {
    const cwd = useSessions(state => sessionCwd(state, sessionId));
    if (!chooserAvailable() || cwd === undefined)
        return null;
    return (_jsx("button", { type: "button", className: css.button, "aria-label": LABEL, title: LABEL, onClick: () => {
            const result = openPathChooser(cwd, 'folder');
            if (!result.ok) {
                // P3-1/P3-6：`reason` 只进 detail 的诊断尾部（`data-*` 不可用时由调用方日志兜底），
                // 用户看到的正文一律由唯一真源翻译（旧文案把码直接印在括号里）。
                reportUserFacingResult({
                    ok: false,
                    title: '无法打开文件管理器',
                    detail: describeCallReason(result.reason),
                });
            }
        }, children: _jsx("svg", { width: "16", height: "16", viewBox: "0 0 16 16", "aria-hidden": "true", children: _jsx("path", { d: "M1.75 4.25c0-.55.45-1 1-1h3.1c.3 0 .58.13.77.36l.86 1.03h5.77c.55 0 1 .45 1 1v6.11c0 .55-.45 1-1 1H2.75c-.55 0-1-.45-1-1V4.25Z", fill: "none", stroke: "currentColor", strokeWidth: "1.2", strokeLinejoin: "round" }) }) }));
}
