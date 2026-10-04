/**
 * 侧栏收起时「有待展开的浏览器标签」的标记属性（S3-19）。
 *
 * 唯一真源在这里（写方），读方是 `MobileChrome` 的侧栏开关徽标——两处必须同字面量，
 * 所以只在这个模块里定义一次并导出。
 */
export declare const BROWSER_PENDING_ATTR = "data-dsh-browser-pending";
/** Shell status document, as far as placement reads it. */
export interface BrowserHostStatusLike {
    /** A page exists in the shell's current workspace. */
    created?: unknown;
    /** Per-page generation counter; part of the edge signature. */
    pageGeneration?: unknown;
    /** Tab summaries; only identity fields are read. */
    tabs?: unknown;
    /** Session the shell's current workspace belongs to (`BrowserHost.status()`). */
    ownerSessionId?: unknown;
}
/** Right-Sidebar face used by placement: the session-addressed navigation entry only. */
export interface BrowserSidebarFace {
    /**
     * Session-addressed placement (`ctx.sidebarRight.openTabIn`, shipped since 0.1.5-rc.1). The
     * mounted-session `openTab` is deliberately not part of this face: on a composition without the
     * addressed entry placement skips rather than writing into whichever session is on screen.
     */
    openTabIn?: (sessionId: string, kind: string, options?: {
        revealIfOpened?: boolean;
    }) => void;
}
/** Everything one placement pass reads; all of it injectable so the policy is unit-testable. */
export interface BrowserAutoPlaceOptions {
    /** Tab kind to register (the AI browser page). */
    kind: string;
    /** Raw shell status document, or `undefined` when the bridge is absent. */
    status: () => string | undefined;
    /** Session on screen (`data-dsh-session-id`), or `undefined` while none is selected. */
    currentSessionId: () => string | undefined;
    /** Resolved right-Sidebar face; `undefined` when the composition has no right column. */
    sidebar: () => BrowserSidebarFace | undefined;
    /** Whether the column is collapsed (upstream expand control present). */
    collapsed: () => boolean;
    /** Poll period; only used to discover edges. */
    intervalMs?: number;
    /** Interval/timer host; defaults to the page `window`. */
    scheduler?: BrowserAutoPlaceScheduler;
}
/** The two timer calls placement needs; a seam for tests without a real clock. */
export interface BrowserAutoPlaceScheduler {
    setInterval(handler: () => void, ms: number): number;
    clearInterval(handle: number): void;
}
/** Session on screen as published by `SessionMarker`; `undefined` when no session is selected. */
export declare function domCurrentSessionId(): string | undefined;
/** Upstream's authoritative collapsed signal: the expand control renders only while collapsed. */
export declare function domCollapsedNow(): boolean;
/**
 * Edge-triggered, session-addressed placement of the AI browser page.
 *
 * One instance tracks every session it has observed: a per-session signature baseline plus a
 * per-session `pending` flag. Nothing is written for a session that is not both the shell's
 * current workspace owner and the session on screen.
 */
export declare class BrowserAutoPlace {
    private readonly options;
    private readonly seen;
    private readonly pending;
    /**
     * Owners whose workspace was observed **empty** during this page load, before it had a page.
     *
     * This is what separates the two otherwise identical "first observation" cases for one owner:
     *  - the owner was seen empty, then a page appeared: the page cannot predate this page load, so
     *    it is a real appearance and must be placed;
     *  - a page on the very first observation of that owner (`reloadWebUI` with a live BrowserHost):
     *    it may predate this page load, so it only establishes a baseline and never steals the
     *    column.
     *
     * Keyed by owner on purpose: a global flag would let "some workspace was empty once" turn every
     * later session's pre-existing page into a placement, which is the misplacement this module
     * exists to prevent. An empty observation that carries no owner is not attributed to anyone.
     */
    private readonly seenEmpty;
    private timer;
    private attached;
    private readonly intervalMs;
    private readonly scheduler;
    /**
     * @param options - status/session/sidebar/collapse readers and the poll period.
     */
    constructor(options: BrowserAutoPlaceOptions);
    /**
     * Start polling for placement edges.
     * @returns the disposer that stops the poll.
     */
    attach(): () => void;
    /** Stop polling; pending state is dropped (a later mount re-observes its baseline). */
    detach(): void;
    /** Sessions with a recorded pending placement; exposed for assertions and diagnostics. */
    pendingSessions(): string[];
    /**
     * One placement pass. Never throws: a bridge that is absent, a status that is unreadable, or a
     * sidebar that is not mounted all leave every column untouched.
     */
    tick(): void;
    private place;
}
