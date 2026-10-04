/**
 * Trajectory local details panel (upstream ui-trajectory) on narrow screens
 * (issue apk#67): the upstream ≤760px media query positions the panel
 * absolute within the ledger region — sandwiched between the trajectory
 * timeline bar above and the composer seat below (which also covers its
 * bottom), leaving a cramped reading band. Overlay it full-viewport inside
 * the mobile frame: fixed positioning escapes the ledger, so the panel spans
 * the whole screen (header + tabs fixed, body scrolls) and the input bar
 * never covers it. The upstream col-resize handle is pointless on touch.
 */
export declare const TRAJECTORY_DETAILS_CSS: string;
