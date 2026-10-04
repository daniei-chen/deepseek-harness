import { jsx as _jsx } from "react/jsx-runtime";
/**
 * Mobile chrome: the drawer mask (0.14.2 P4).
 *
 * Registered into the frame's shell.overlay seat. It used to own the drawer toggle
 * too, inside a self-drawn 44px band ([data-dsh-mobile-topbar]) above the header;
 * the user reported that band as wasted vertical space ("这个顶部的额头太大了（标题上方留空）
 * 挤占屏幕空间"), so the toggle moved into upstream's own header row
 * (conversation.header.leading, see SidebarToggle.tsx) and this entry keeps only the
 * mask that covers the frame while the drawer is open.
 *
 * The open state is mirrored from the frame's own data-sidebar-collapsed attribute
 * rather than owned here: the drawer keeps its own toggle inside, and the marker may
 * also flip the attribute through rotation. Reading it keeps the mask honest without
 * a second source of truth.
 */
import { useEffect, useState } from 'react';
import css from './MobileChrome.module.css';
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
 * The drawer mask for the phone form.
 * @param props - the injected drawer toggle (used to close on a tap beside the drawer).
 * @returns the mask, which is inert outside the phone form.
 */
export function MobileChrome({ toggleSidebar }) {
    const open = useSidebarOpen();
    return (_jsx("div", { className: css.root, children: _jsx("div", { className: css.mask, "data-open": open || undefined, "data-dsh-mobile-mask": "", onClick: () => { toggleSidebar(); } }) }));
}
