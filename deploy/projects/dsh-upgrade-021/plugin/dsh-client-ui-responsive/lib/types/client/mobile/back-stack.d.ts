/**
 * Back-stack signal: the page half of the shell's system-back policy (iteration
 * 0.14.0-preview, plan §5.1 "方案 1" / source diagnosis §6).
 *
 * The shell decides in ONE synchronous back callback, and `evaluateJavascript` is
 * asynchronous, so the page can never be asked at back time: this module observes
 * the known in-memory layers of the upstream frame, keeps them in an ordered
 * stack, exposes `window.__dshBack()`, and pushes "a layer can be popped" to the
 * shell through the synchronous `dshBackBridge.setAvailable` uplink whenever that
 * boolean changes. The shell caches the boolean and calls `window.__dshBack()`.
 *
 * Why an observed layer stack instead of the alternatives:
 * - `WebView.canGoBack()` does not see same-document history entries on the
 *   measured WebView (Chromium 110), so pushState routing cannot drive the shell;
 * - one synthetic Escape would hit every mounted document-level listener at once
 *   (settings, Modal, menu, lightbox) and still miss drawer, trajectory details,
 *   and the right column.
 *
 * Each layer is closed through its OWN control, by stable hook (data attributes,
 * roles, mask structure), not by localized copy:
 * - drawer: the layout service's own toggle (the top-bar button's action);
 * - dialog (settings panel, `Modal`, image lightbox): its mask, else its close
 *   button, else its clickable backdrop;
 * - trajectory "Event details" `<aside>`: its close button;
 * - right column fullscreen, while the column is presented: its mode toggle, else its
 *   collapse toggle;
 * - `@`/slash menu: the menu's own outside-pointerdown dismissal;
 * - menu drill-down: the last enabled breadcrumb (one level per press).
 * - attachment source menu (this plugin's own paperclip popup): its own
 *   outside-pointerdown dismissal, which the enhancer implements.
 * - global main panel (upstream's plugin manager and its kin): one detail level
 *   per press through the page's own crumb control, then the page's own back
 *   control (this plugin's, at the list root — see mobile/main-panel-back.ts).
 *
 * Failure direction: the stack only ever pops through reconciliation (a layer's
 * anchor disappearing from the DOM). A layer whose control cannot be found keeps
 * being counted, so the shell consumes the press instead of finishing the
 * activity ("an unobserved or unclosable layer must never exit the app").
 *
 * The main-panel layer is the one kind that always finds a closure: its top level
 * (the plugin manager list root) draws no control upstream, so it ends at the layout
 * service's own panel selection rather than consuming the press without effect.
 */
/** Layer kinds, bottom to top as detected within one pass. */
export type BackLayerKind = 'drawer' | 'dialog' | 'trajectory-details' | 'right-fullscreen' | 'menu' | 'menu-drill' | 'attachment-menu' | 'main-panel';
declare global {
    interface Window {
        /** Pop the topmost page layer; false when the page holds no layer of its own. */
        __dshBack?: () => boolean;
        /** Number of layers the page currently holds (device-side observability). */
        __dshBackDepth?: number;
        /** Layer kinds bottom to top (device-side observability). */
        __dshBackKinds?: string[];
        /** Synchronous shell uplink registered by the APK (`BackGateBridge`). */
        dshBackBridge?: {
            setAvailable?: (available: boolean) => void;
        };
    }
}
/** Wiring the stack needs from the plugin body. */
export interface BackStackOptions {
    /** Toggle the phone drawer: `ctx.layout.toggleSidebar()`, the top-bar button's own action. */
    toggleSidebar: () => void;
    /**
     * The presented global main panel (`ctx.layout.panelInfo.activePanelId`), or
     * null while the Conversation is presented.
     *
     * Read from the layout service rather than the DOM: it is the upstream fact
     * "which main panel is selected", it covers every registrant of the `main`
     * seat, and it keeps the layer out of the Conversation — where the shell must
     * still finish the activity.
     */
    activePanelId: () => string | null;
    /**
     * Leave the presented main panel (upstream `ctx.layout.selectPanel(null)`).
     *
     * The list root draws no back control of its own, so this is that level final
     * closure; the detail levels never reach it (their crumb pops first).
     */
    leaveMainPanel: () => void;
}
/**
 * The page-side layer stack behind the shell's system-back callback.
 *
 * `attach` publishes `window.__dshBack` and starts observing; `detach` removes
 * the observer, the globals, and the shell's cached availability (a hot unload
 * must not leave the shell believing a layer is still up).
 */
export declare class BackStackSignal {
    private readonly options;
    private observer;
    private layers;
    private seq;
    private depth;
    private kinds;
    private uplinked;
    private available;
    private attached;
    /** @param options - the drawer toggle callback. */
    constructor(options: BackStackOptions);
    /** Publish the back entry and keep the stack current. */
    attach(): void;
    /** Stop observing and remove every trace of the signal. */
    detach(): void;
    /** The layer kinds currently stacked, bottom to top (device-side assertions read the global). */
    currentKinds(): readonly BackLayerKind[];
    /**
     * Re-reconcile now.
     *
     * The main-panel layer fact lives in the layout service, not in the DOM, so a panel
     * switch is also pushed from its subscription; a DOM change that leaves the same panel
     * selected must not be the only trigger.
     */
    refresh(): void;
    /**
     * Pop the topmost layer through its own control.
     * @returns whether a layer existed (the shell consumes the press either way);
     *   the stack itself only shrinks when the layer's anchor leaves the DOM.
     */
    private popTop;
    /** Reconcile the observed layers with the stack, keeping open order. */
    private sync;
    /** Every layer currently in the DOM, in a fixed detection order. */
    private detect;
    /** The drawer: the phone form's expanded left sidebar. */
    private detectDrawer;
    /**
     * The presented global main panel (plugin manager, task manager).
     *
     * It is not a dialog, so nothing else in this stack sees it: without this
     * layer a back press finished the activity from inside the page. The stack
     * position is above the drawer (the panel covers it) and below dialogs and
     * menus, so a surface opened over the panel still closes first.
     */
    private detectMainPanel;
    /** Every modal surface, in document order (settings panel, Modal, lightbox). */
    private detectDialogs;
    /** The trajectory inspector side panel. */
    private detectTrajectoryDetails;
    /** The right column's fullscreen presentation. */
    private detectRightFullscreen;
    /** An open command/reference menu. */
    private detectMenu;
    /**
     * This plugin's own attachment-source menu.
     *
     * Distinct from the upstream trigger menus: it is our node, mounted on document.body, and the
     * enhancer already closes it on the same outside-pointerdown gesture upstream menus use - so the
     * shared dismissal path below is the right control.
     */
    private detectAttachmentMenu;
    /** A menu listing descended into a directory (its breadcrumb header is up). */
    private detectMenuDrill;
    /** Publish the observability globals and the shell uplink (only on change). */
    private publish;
}
