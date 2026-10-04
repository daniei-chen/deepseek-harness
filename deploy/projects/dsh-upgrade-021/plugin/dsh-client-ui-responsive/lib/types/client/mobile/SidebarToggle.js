import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The drawer toggle, seated in upstream's own header row (0.14.2 P4).
 *
 * It replaced a self-drawn 44px band ([data-dsh-mobile-topbar]) that sat above the
 * header: the user reported that band as wasted vertical space ("这个顶部的额头太大了
 * （标题上方留空）挤占屏幕空间"). Upstream already reserves an empty global-navigation
 * seat beside the Session title (conversation.header.leading, kind single, scope root),
 * so the control moves there and the band is removed.
 *
 * The open state is mirrored from the frame's own data-sidebar-collapsed attribute
 * rather than owned here: the drawer keeps its own toggle inside, the marker can flip
 * the attribute on rotation, and reading it keeps aria-expanded honest without a
 * second source of truth.
 */
import { useEffect, useState } from 'react';
import { BROWSER_PENDING_ATTR } from "./browser-auto-place.js";
import css from './MobileChrome.module.css';
/** Copy (the Android layer's product strings are Chinese; see DevSection/ExportResultDialog). */
const TOGGLE_OPEN = '打开导航';
const TOGGLE_CLOSE = '关闭导航';
/** The frame root, tagged by the form marker; the right column identifies it before the tag lands. */
function frameElement() {
    return document.querySelector('[data-dsh-frame]')
        ?? document.querySelector('[data-rightbar-col]')?.parentElement
        ?? null;
}
/**
 * Mirror whether the left sidebar is expanded.
 * @returns true while the frame renders the sidebar opened.
 */
function useSidebarOpen() {
    const [open, setOpen] = useState(false);
    useEffect(() => {
        let frame = null;
        let frameObserver = null;
        const sync = () => { setOpen(frame !== null && !frame.hasAttribute('data-sidebar-collapsed')); };
        const bind = () => {
            frame = frameElement();
            if (frame === null)
                return false;
            frameObserver = new MutationObserver(sync);
            frameObserver.observe(frame, { attributes: true, attributeFilter: ['data-sidebar-collapsed'] });
            sync();
            return true;
        };
        if (bind())
            return () => { frameObserver?.disconnect(); };
        // The frame can mount after this entry (plugin order): wait for it.
        const waitObserver = new MutationObserver(() => { if (bind())
            waitObserver.disconnect(); });
        waitObserver.observe(document.documentElement, { childList: true, subtree: true });
        return () => {
            waitObserver.disconnect();
            frameObserver?.disconnect();
        };
    }, []);
    return open;
}
/**
 * Observe the cross-module signal "the model opened a browser tab while the sidebar
 * is collapsed" (S3-19).
 *
 * The defect: with the sidebar collapsed, a model-opened browser tab was completely
 * silent for the user - browser-auto-place only recorded the intent and waited for a
 * manual expand, with nothing on screen saying something was waiting. This turns it
 * into a badge on the sidebar toggle: the marker sits on the very button the user has
 * to press, so opening it reveals the tab.
 * @returns true while a browser tab is waiting for the drawer.
 */
function useBrowserPending() {
    const [pending, setPending] = useState(false);
    useEffect(() => {
        const sync = () => { setPending(document.documentElement.hasAttribute(BROWSER_PENDING_ATTR)); };
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: [BROWSER_PENDING_ATTR] });
        return () => { observer.disconnect(); };
    }, []);
    return pending;
}
/**
 * The drawer toggle for the header's leading seat.
 * @param props - runtime share and the injected toggle.
 * @returns the toggle button, with the pending-browser badge when one is waiting.
 */
export function SidebarToggle({ toggleSidebar }) {
    const open = useSidebarOpen();
    const browserPending = useBrowserPending();
    return (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: css.toggle, "data-dsh-sidebar-toggle": "", "aria-label": browserPending && !open
                    ? TOGGLE_OPEN + '（有一个浏览器标签在等你展开侧栏）'
                    : (open ? TOGGLE_CLOSE : TOGGLE_OPEN), "aria-expanded": open, onClick: () => { toggleSidebar(); }, children: [_jsx("svg", { width: "18", height: "18", viewBox: "0 0 18 18", "aria-hidden": "true", children: _jsx("path", { d: "M2.5 4.5h13M2.5 9h13M2.5 13.5h13", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round" }) }), browserPending && !open && _jsx("span", { className: css.badge, "data-dsh-browser-badge": "pending", "aria-hidden": "true" })] }), browserPending && !open && (_jsx("span", { className: css.pendingHint, "data-dsh-browser-pending-hint": "", children: "\u6709\u6D4F\u89C8\u5668\u6807\u7B7E\u5F85\u5C55\u5F00" }))] }));
}
