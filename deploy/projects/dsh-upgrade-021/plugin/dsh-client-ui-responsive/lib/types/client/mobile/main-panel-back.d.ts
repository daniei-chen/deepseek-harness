/** Our control. Read by back-stack.ts as the list level's own closure. */
export declare const MAIN_PANEL_BACK_ATTR = "data-dsh-main-panel-back";
/**
 * One detail level of the plugin manager (package, ledger item, configurable row).
 *
 * Shared with back-stack.ts so the two cannot drift: this module hides its button while
 * one is present, and the stack pops that level through the crumb instead.
 */
export declare const PANEL_DETAIL_SELECTORS: readonly ["[data-plugin-detail]", "[data-plugin-item-detail]", "[data-plugin-row-detail]"];
/**
 * Mounts the list root's back control into the plugin-manager page head.
 *
 * `attach` starts the reconcile loop; `detach` removes the observer and every control
 * this instance mounted, so a hot unload leaves no orphan button behind.
 */
export declare class MainPanelBackMount {
    private observer;
    private scheduled;
    private attached;
    private readonly mounted;
    private readonly leave;
    /** @param leave - return to the Conversation (upstream `ctx.layout.selectPanel(null)`). */
    constructor(leave: () => void);
    /** Start reconciling; safe to call twice. */
    attach(): void;
    /** Stop reconciling and remove this instance's controls. */
    detach(): void;
    /**
     * Whether a tracked button or its page left the DOM.
     *
     * False while nothing is mounted keeps an idle enhancer from running a document-wide
     * query on every unrelated render batch (attachment-picker-menu's measure).
     */
    private dirty;
    /** Whether a mutated node is, or contains, the page we mount into. */
    private carriesPanel;
    private schedule;
    /**
     * Reconcile our controls with the live page.
     *
     * Cheap-exit first: with nothing mounted and no panel in the mutated batch this pass
     * does no document-wide query at all.
     */
    private sync;
    private createButton;
}
