import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/** Official BrowserBody/BrowserTitle chrome with an Android-native page provider. */
import { useLayoutEffect, useState } from 'react';
import { GuideArtworkBrowser, MenuItemButton } from '@deepseek-ai/dsh-client-ui-primitives';
import { BrowserBody } from "./upstream-browser/view/BrowserBody.js";
import css from './BrowserTab.module.css';
/** Own dispatch id; existing Android browser layout records keep their occurrence ids. */
export const BROWSER_TAB_ID = 'android-browser';
/** Take the official builtin kind through the registry's extension band. */
export const BROWSER_TAB_KIND = 'browser';
/** Guide-less resolver for pre-0.2 Android layouts, without rewriting any layout data. */
export const LEGACY_BROWSER_TAB_KIND = 'android-browser';
/** Legacy needs a distinct implementation id because registry ids are globally unique. */
export const LEGACY_BROWSER_TAB_ID = 'android-browser.legacy';
/**
 * Contribute the official guide artwork and one Browser entry, not a replacement workspace tree.
 * @param t - locale-live private Browser dictionary.
 * @returns extension-band browser type.
 */
export function browserTabDefinition(t) {
    return { id: BROWSER_TAB_ID, kind: BROWSER_TAB_KIND, priority: 'extension', multiple: true, keepMounted: true,
        title: () => t('type.label'),
        guide: [{ id: 'new', commandId: 'browser.new', order: 30,
                title: () => t('guide.title'), description: () => t('guide.description'), icon: GuideArtworkBrowser }] };
}
/** @param t - locale-live copy. @returns guide-less compatibility resolver. */
export function legacyBrowserTabDefinition(t) {
    return { ...browserTabDefinition(t), id: LEGACY_BROWSER_TAB_ID, kind: LEGACY_BROWSER_TAB_KIND, guide: [] };
}
function parseResolution(value) {
    const match = /^\s*(\d{2,4})\s*[x×*]\s*(\d{2,4})\s*$/i.exec(value);
    if (match === null)
        return undefined;
    const width = Number(match[1]);
    const height = Number(match[2]);
    return width >= 240 && width <= 3840 && height >= 240 && height <= 3840 ? { width, height } : undefined;
}
/** Reuse the official address/start/restore UI; native controls occupy their own non-stage row. */
export function BrowserTab(props) {
    const { useTabInfo, useNativeBrowserState, setBrowserVisible, setBrowserIdentity, setBrowserViewport, refreshBrowserStatus, t } = props;
    const { tab } = useTabInfo();
    const state = useNativeBrowserState(tab.id);
    const current = state !== undefined && state.viewportWidth > 0 && state.viewportHeight > 0
        ? state.viewportWidth + 'x' + state.viewportHeight : '390x844';
    const [edit, setEdit] = useState();
    const [invalid, setInvalid] = useState(false);
    const value = edit?.current === current ? edit.value : current;
    const ready = state?.available === true && state.nativeTabId !== undefined;
    const desktop = state?.identityId === 'linux-desktop';
    const mobile = state?.identityId === 'android-real';
    useLayoutEffect(() => {
        setBrowserVisible(tab.id, tab.visible);
        return () => { setBrowserVisible(tab.id, false); };
    }, [setBrowserVisible, tab.id, tab.visible]);
    const submit = (event) => {
        event.preventDefault();
        const resolution = parseResolution(value);
        setInvalid(resolution === undefined);
        if (resolution !== undefined)
            setBrowserViewport(tab.id, resolution.width, resolution.height);
    };
    return _jsxs("div", { className: css.root, children: [state?.available === false && _jsxs("div", { className: css.status, role: "status", children: [t('native.unavailable', { reason: state.reason }), _jsx("button", { type: "button", onClick: () => { refreshBrowserStatus(tab.id); }, children: t('native.retry') })] }), state?.available === true && state.reason !== '' && _jsx("div", { className: css.status, role: "status", children: t('native.operation.failed', { reason: state.reason }) }), state?.available === true && state.profileAvailable === false && _jsx("div", { className: css.status, role: "status", children: t('native.profile.unavailable', { reason: state.profileReason }) }), _jsx("div", { className: css.official, children: _jsx(BrowserBody, { ...props }) }), _jsxs("form", { className: css.controls, onSubmit: submit, children: [_jsx("button", { type: "button", className: css.mode, disabled: !ready, "aria-pressed": desktop, onClick: () => { setBrowserIdentity(tab.id, true); }, children: t('native.desktop') }), _jsx("button", { type: "button", className: css.mode, disabled: !ready, "aria-pressed": mobile, onClick: () => { setBrowserIdentity(tab.id, false); }, children: t('native.mobile') }), _jsx("input", { className: css.resolution, value: value, "aria-label": t('native.viewport'), "aria-invalid": invalid, disabled: !ready, spellCheck: false, onChange: event => { setEdit({ current, value: event.currentTarget.value }); setInvalid(false); } }), _jsx("button", { type: "submit", className: css.apply, disabled: !ready, children: t('native.viewport.apply') })] }), invalid && _jsx("div", { className: css.status, role: "alert", children: t('native.viewport.invalid') })] });
}
/** Add native profile/status/close actions without fabricating a public toolbar slot. */
export function BrowserTabMenu({ tab, dismiss, useNativeBrowserState, setBrowserIdentity, refreshBrowserStatus, closeBrowserTab, t }) {
    const state = useNativeBrowserState(tab.id);
    if (tab.kind !== BROWSER_TAB_KIND && tab.kind !== LEGACY_BROWSER_TAB_KIND)
        return null;
    const ready = state?.available === true && state.nativeTabId !== undefined;
    return _jsxs(_Fragment, { children: [_jsx(MenuItemButton, { separatorBefore: true, disabled: !ready, onSelect: () => { dismiss(); setBrowserIdentity(tab.id, true); }, children: t('native.desktop') }), _jsx(MenuItemButton, { disabled: !ready, onSelect: () => { dismiss(); setBrowserIdentity(tab.id, false); }, children: t('native.mobile') }), _jsx(MenuItemButton, { onSelect: () => { dismiss(); refreshBrowserStatus(tab.id); }, children: t('native.retry') }), _jsx(MenuItemButton, { danger: true, onSelect: () => { dismiss(); closeBrowserTab(tab.id); }, children: t('native.close') })] });
}
