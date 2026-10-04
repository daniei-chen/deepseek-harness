/**
 * Composer insets adaptation for mobile/edge-to-edge:
 * On Android edge-to-edge mode, the shell supplies --dsh-android-system-bottom
 * (gesture / nav-bar height) and --dsh-android-ime-bottom (soft keyboard height).
 * Padding the whole composer seat ([data-composer-seat]) pushes the input card,
 * mode pills, anchored command menu, and the StatsLine footer above the navigation
 * bar / gesture pill and the soft keyboard.
 * On desktop / non-Android environments where CSS variables are unset,
 * max(0px, 0px, 0px) evaluates cleanly to 0px (zero side-effects).
 */
export declare const COMPOSER_INSETS_CSS: string;
