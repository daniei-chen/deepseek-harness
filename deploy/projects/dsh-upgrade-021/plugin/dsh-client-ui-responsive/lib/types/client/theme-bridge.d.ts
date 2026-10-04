/**
 * ThemeBridge: make prefers-color-scheme follow the OS dark state on
 * WebViews whose media query does not track the system uiMode (observed on
 * vivo/Android 16: FORCE_DARK_AUTO leaves matchMedia stuck at light).
 *
 * The shell APK watches Configuration changes and pushes the dark flag via
 * window.__dshThemeBridge.setDark(dark). This module hooks matchMedia for the
 * (prefers-color-scheme: dark) query so the upstream ui-theme service
 * (default preference: system) resolves and live-updates through its own
 * listener — zero upstream changes.
 */
export declare class ThemeBridge {
    private dark;
    private listeners;
    private patched;
    /** Install the matchMedia hook and the bridge object (idempotent). */
    install(): void;
}
