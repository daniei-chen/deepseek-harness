/**
 * KeyboardBoundary (issue #57): Android 16 edge-to-edge WebViews do not
 * shrink the layout viewport when the soft keyboard opens (adjustResize
 * does not resize the WebView content; visualViewport shrinks but
 * innerHeight stays 758). The frame (height: 100%, upstream ui-layout's root
 * grid) therefore extends under the keyboard, and its scrollable content leaves
 * a blank band below the composer — swiping up past the input reveals empty
 * black.
 *
 * Fix: while the IME inset is non-zero, pin the mobile frame's height to the
 * visualViewport height (the keyboard's top edge). The frame's overflow:
 * hidden then clips the blank band instead of letting it scroll into view.
 * Restored to 100% when the keyboard closes.
 *
 * The composer seat (position: sticky; bottom: 0) normally relies on
 * composer-insets.css.ts padding-bottom = --dsh-android-ime-bottom to lift
 * the input above the keyboard while the frame keeps its full height. Once
 * this class pins the frame to the keyboard top edge, that same padding
 * becomes redundant and inflates the seat past its sticky container (seat
 * height > scrollBody height makes the sticky bottom anchor inert and the
 * composer drifts to the top of the viewport). While pinned, the seat's
 * padding-bottom is therefore zeroed; it is restored on keyboard close.
 */
export declare class KeyboardBoundary {
    private frame;
    private seat;
    private media;
    private lastIme;
    private lastVv;
    /** 上次补偿用的视觉视口平移量（#197 机制①第二道防线）。 */
    private lastVvTop;
    /** 收敛代次（#197 机制②）：新事件打断旧的复算链，避免过期复算覆盖新状态。 */
    private settleGeneration;
    /** 延迟复算的定时器句柄（detach 时清掉；jsdom 测试结束后残留回调会报错）。 */
    private settleTimer;
    /** 已卸载标记：卸载后任何延迟回调都必须直接返回（宿主可能已销毁 window/document）。 */
    private detached;
    /** Watch visualViewport resize + scroll + the shell's IME inset variable. */
    attach(): void;
    /** Remove listeners and restore the frame and seat styles. */
    detach(): void;
    private readonly onViewportChange;
    /** 按当前 IME inset 与可视视口高度决定钉住还是还原（可重复调用，幂等）。 */
    private apply;
    /** Restore the natural frame height and seat padding. */
    private restore;
}
