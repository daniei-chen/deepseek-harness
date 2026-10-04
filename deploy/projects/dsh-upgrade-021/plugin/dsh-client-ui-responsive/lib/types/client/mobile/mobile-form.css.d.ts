/**
 * The phone form (<768px) over the upstream frame.
 *
 * Upstream keeps ownership of the frame, the columns, and both sidebars; this
 * sheet only re-shapes them for a phone:
 * - the left sidebar becomes an off-canvas drawer (its collapsed rail steps
 *   aside with it; the header's leading toggle is the entry, and the rail's own
 *   toggle keeps working from inside the drawer);
 * - the centre column spans the whole frame and pads only under the system inset;
 * - the right column keeps its zero-width track so the upstream panel (already
 *   fullscreen below 768px of frame width) hangs over the centre as a
 *   slide-over, with the system insets respected;
 * - the desktop drag handles are touch noise and step aside.
 *
 * The frame's track widths are inline styles, so the grid override must be
 * `!important`. Children are placed explicitly: with the sidebar out of flow,
 * auto-placement would otherwise drop the centre column into the first track.
 */
export declare const MOBILE_FORM_CSS: string;
