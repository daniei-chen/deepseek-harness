/**
 * Composer popup geometry (upstream ui-input-trigger + ui-model-selection):
 * - The slash menu's scroll container (`.viewport`, the `[role='listbox']`) is a
 *   flex child without flex:1, so when the candidate list exceeds max-height the
 *   viewport grows past the menu and is clipped by the menu's overflow:hidden —
 *   the scrollbar lands outside the visible area and the list appears
 *   unscrollable. Fix: let the viewport fill the menu and scroll inside it.
 * - The upstream menus clamp against viewport y=0 only, and size themselves
 *   against their trigger, so on phones they can leave the viewport sideways or
 *   rise above the fixed top bar. `ComposerPopupGuard` measures each open popup
 *   and writes the caps below; the width cap is applied to the scroll container
 *   and to the painted card alike so the card never stays wider than its
 *   content (a blank strip with a detached scrollbar — issue apk#135).
 */
export declare const COMPOSER_MENU_CSS: string;
