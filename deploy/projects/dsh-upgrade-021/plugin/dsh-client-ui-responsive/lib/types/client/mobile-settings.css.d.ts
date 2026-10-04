/**
 * Mobile settings-panel adaptation (issue #1; 2026-09-03 rework, 2026-09-10 de-fork).
 * Upstream SettingsRoot draws a fixed overlay with an 800px two-column panel
 * (nav + options). On the phone form it must reflow to a single column and fill
 * the viewport (user requirement: 设置页全屏显示).
 *
 * The panel renders inside the sidebar subtree, whose CSS-Module class names are
 * hashed and unreachable from here — and its own markup carries no stable
 * attribute. The mobile marker therefore tags the panel
 * (`data-dsh-settings-dialog`, written from its nav/content structure) and this
 * sheet keys on that tag plus the phone-form flag: pure attribute selectors,
 * effective on old kernels too (no `:has()`).
 */
export declare const MOBILE_SETTINGS_CSS: string;
