/**
 * Raise the conversation header while its vendored snapshot manager is open (#288).
 *
 * vendor/dsh-undo-savepoint/lib/client.js renders SnapshotPanel in
 * conversation.session.header.actions, not a body portal. Its exact hooks are
 * div.u_overlay[data-undo-panel] > div.u_panel and the panel's direct u_* rows.
 * ConversationHeader publishes data-window-drag and a direct leading seat;
 * ConversationMainPanel renders that header as a flex item under div[data-phase].
 * Raising this header puts its titleRow container context above transcript paint
 * without moving React nodes, changing code blocks, or raising the frame itself.
 * The deployed stacking chain/paint order has not been measured; this is the
 * source-backed header path, not a claim about every possible overlay ancestor.
 */
/** Own only the temporary header class; the companion stylesheet owns its paint level. */
export declare class SnapshotPanelsObserver {
    private readonly document;
    private observer;
    private readonly headers;
    private readonly leases;
    /** @param document - The document containing the conversation headers. */
    constructor(document?: Document);
    /** Observe existing and newly mounted snapshot managers; repeated attachment is harmless. */
    attach(): void;
    /** Stop observation and release only classes this observer leased, including detached headers. */
    detach(): void;
    private sync;
    private release;
    private relevant;
}
