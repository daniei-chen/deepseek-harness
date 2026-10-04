/**
 * Composer popup geometry guard (issues apk#135).
 *
 * Two popups anchor to the composer card: the slash-command menu
 * (`[role='listbox']` inside a surface card) and the model menu
 * (`[role='menu']`, which is its own surface). Both are sized and positioned
 * against their trigger rather than the viewport, so on phones they can
 *   (a) grow past the left viewport edge — long model ids lose their prefix
 *       ("deepseek-v4-…" renders as "eek-v4-…"),
 *   (b) keep a surface card wider than its content once a width cap applies to
 *       the inner scroll container only, leaving a blank strip and a scrollbar
 *       floating away from the card edge, and
 *   (c) rise above the mobile top bar and hide their first rows.
 * The guard measures each open popup and writes the corrections as a width cap,
 * a horizontal shift and a height cap. Measuring rather than matching upstream
 * class names keeps the fix alive across upstream CSS-module renames.
 */
/** Gap kept between a popup and each horizontal viewport edge. */
export declare const POPUP_EDGE_GAP = 8;
/**
 * Width cap for a composer popup: the design cap, never more than the fraction
 * of the viewport the shell's injected stylesheet allows.
 * @param viewportWidth - layout viewport width in CSS pixels.
 * @returns the cap in whole CSS pixels.
 */
export declare function popupMaxWidth(viewportWidth: number): number;
/**
 * Horizontal shift that brings a popup back inside the viewport.
 * The right edge wins when the popup is wider than the viewport, so the
 * reading order (labels at the left) stays visible.
 * @param left - untransformed left edge.
 * @param right - untransformed right edge.
 * @param viewportWidth - layout viewport width in CSS pixels.
 * @param gap - minimum clearance to each edge.
 * @returns the shift in whole CSS pixels (0 when already inside).
 */
export declare function popupShiftLeft(left: number, right: number, viewportWidth: number, gap?: number): number;
/**
 * Usable height for an upward-opening popup.
 * The popup bottom is anchored to the composer, while the top chrome
 * (upstream's header) occupies part of the viewport above it.
 * @param popupBottom - popup bottom edge.
 * @param topbarBottom - bottom edge of the top chrome above the popup.
 * @param chromeHeight - popup padding/border excluded from a content-box cap.
 * @param cap - design height cap for this popup kind.
 * @returns the height cap in whole CSS pixels.
 */
export declare function composerPopupMaxHeight(popupBottom: number, topbarBottom: number, chromeHeight?: number, cap?: number): number;
/**
 * Keeps every open composer popup inside the viewport: width cap on the surface
 * and its scroll container, horizontal shift on the surface, height cap on the
 * scrolling element.
 */
export declare class ComposerPopupGuard {
    private readonly onViewportChange;
    private readonly mutationObserver;
    private readonly resizeObserver;
    private frame;
    private observed;
    private styled;
    /** Start observing composer popup geometry. */
    attach(): void;
    /** Stop observing and remove every geometric correction. */
    detach(): void;
    private queue;
    private apply;
    /** Drop every correction and forget the touched elements. */
    private clear;
    private clearElement;
    private syncObserved;
    private isRelevantMutation;
}
