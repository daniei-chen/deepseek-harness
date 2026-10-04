import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Export-result dialog: the `shell.overlay` entry that renders the Android
 * shell's session-export outcome (and this plugin's own native-action
 * failures). Pure component: state arrives through the framework-bound
 * `useExportResult` hook, dismissal through the injected callback. The markup
 * reuses the web-ui dialog conventions (role=dialog / aria-modal) and the
 * shared design tokens, so the dialog matches the app's modal surfaces.
 */
import { useEffect } from 'react';
import css from './ExportResultDialog.module.css';
/** The single entry component; renders nothing while no result is open. */
export function ExportResultDialog({ useExportResult, close }) {
    const state = useExportResult(snapshot => snapshot);
    useEffect(() => {
        if (!state.open)
            return;
        const onKeyDown = (event) => {
            if (event.key === 'Escape')
                close();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => { window.removeEventListener('keydown', onKeyDown); };
    }, [state.open, close]);
    if (!state.open)
        return null;
    return (_jsx("div", { className: css.backdrop, onClick: () => close(), children: _jsxs("div", { role: "dialog", "aria-modal": "true", "aria-labelledby": "dsh-export-result-title", className: css.dialog, onClick: (event) => { event.stopPropagation(); }, children: [_jsx("h2", { id: "dsh-export-result-title", className: css.title, children: state.title }), _jsx("p", { className: css.detail, "data-status": state.ok ? 'success' : 'error', children: state.detail }), _jsx("div", { className: css.actions, children: _jsx("button", { type: "button", className: css.button, onClick: () => close(), children: "\u5173\u95ED" }) })] }) }));
}
