/** The frame facts this behaviour reads. */
export interface PanelNavDrawerDeps {
    /** The presented main panel, or null while the Conversation is shown. */
    activePanelId(): string | null;
    /** Collapse the drawer: upstream `ctx.layout.toggleSidebar()`. */
    collapseDrawer(): void;
    /** The tagged frame root, or null before the form marker lands. */
    frame(): Element | null;
}
/**
 * Collapses the drawer once, when a panel selection replaces the Conversation.
 *
 * Not a subscription owner: the caller feeds it the layout service's notifications,
 * so this class holds no listener of its own and cannot leak one.
 */
export declare class PanelNavDrawer {
    private readonly deps;
    private lastPanelId;
    /** @param deps - frame facts and the drawer action. */
    constructor(deps: PanelNavDrawerDeps);
    /**
     * Reconcile against the current panel selection.
     * @returns whether the drawer was collapsed by this call.
     */
    sync(): boolean;
}
