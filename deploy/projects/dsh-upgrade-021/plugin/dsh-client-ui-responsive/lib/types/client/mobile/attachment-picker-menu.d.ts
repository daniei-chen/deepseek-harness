/**
 * Owns the paperclip trigger, the short-lived source menu, and the delegation to InputBar's input.
 */
export declare class AttachmentPickerMenuEnhancer {
    private menu;
    private trigger;
    private restoreActivePicker;
    private observer;
    private mountScheduled;
    private attached;
    /** Triggers this enhancer mounted, with the anchor each was appended to. */
    private readonly mounted;
    private readonly onPointerDown;
    private readonly onKeyDown;
    private readonly onViewportChange;
    attach(): void;
    detach(): void;
    /**
     * Whether a tracked anchor or trigger left the DOM.
     *
     * Deliberately false while nothing is mounted: "no anchor seen yet" is answered by the cheap
     * added-node probe in onMutations, so an enhancer that has not mounted (no composer yet) does not
     * run a document-wide query on every unrelated mutation batch.
     */
    private mountSetDirty;
    /** Whether a mutated node is a slot anchor, or contains one. */
    private carriesSlotAnchor;
    private onMutations;
    private scheduleMounts;
    /** Mount our trigger into every live slot anchor that does not have one yet. */
    private syncMounts;
    private createTrigger;
    private toggle;
    private open;
    private place;
    private choose;
    private close;
}
