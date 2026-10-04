/**
 * Skin for the injected main-panel back control (mobile/main-panel-back.ts).
 *
 * The page head (PluginManagerPage `.pageHead`) is a `space-between` flex row of
 * [title block, toolbar]. Our button becomes its first child, so the row needs three
 * adjustments on the phone:
 * - `justify-content: flex-start` stops the three items being spread across the row;
 * - the title block takes the remaining width (`flex: 1`, `min-width: 0`) so it
 *   truncates instead of pushing the toolbar past the edge;
 * - the toolbar stops being the `space-between` end and is pinned right by the title
 *   block's growth, which keeps the refresh button and "add plugin" at their own gap.
 *
 * AT 360px the row is the tightest case the phone form serves: the head measured
 * refresh [196,224] and add [240,336], i.e. a 16px gap with 24px of right padding.
 * The back control is therefore `flex: none` and sized to its content rather than
 * taking a share of the row, and the title block absorbs the squeeze (it wraps).
 */
export declare const MAIN_PANEL_BACK_CSS: string;
