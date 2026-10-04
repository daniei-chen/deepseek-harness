/**
 * Move the phone drawer aside when a global main panel is selected (0.14.2 FX1-C).
 *
 * The panel the drawer navigates to is drawn in the centre column, but on the phone
 * form the sidebar is a `position: fixed` off-canvas overlay 289px wide (mobile-form.css.ts).
 * Selecting a panel therefore left the drawer covering the panel it had just opened -
 * including that panel's own back control, which the user then could not see or tap
 * ("点进去就出不来" / "你关闭键呢").
 *
 * Upstream cannot do this itself: `selectPanel` only writes `panelInfo.activePanelId`,
 * and the docked desktop sidebar has no reason to close. Closing only on the
 * Conversation -> panel transition (rather than on every notification) keeps a user who
 * re-opens the drawer while a panel is presented in control: that drawer stays open.
 */
/** Phone-form marker (mobile/form-marker.ts); the drawer is an overlay only on phones. */
const MOBILE_FORM_ATTR = 'data-dsh-mobile-form';
/** Frame root tag written by the form marker. */
const FRAME_SELECTOR = '[data-dsh-frame]';
/** Frame attribute: present while the left drawer is collapsed. */
const SIDEBAR_COLLAPSED_ATTR = 'data-sidebar-collapsed';
/**
 * Collapses the drawer once, when a panel selection replaces the Conversation.
 *
 * Not a subscription owner: the caller feeds it the layout service's notifications,
 * so this class holds no listener of its own and cannot leak one.
 */
export class PanelNavDrawer {
    deps;
    lastPanelId;
    /** @param deps - frame facts and the drawer action. */
    constructor(deps) {
        this.deps = deps;
        this.lastPanelId = deps.activePanelId();
    }
    /**
     * Reconcile against the current panel selection.
     * @returns whether the drawer was collapsed by this call.
     */
    sync() {
        const panelId = this.deps.activePanelId();
        const opened = panelId !== null && this.lastPanelId === null;
        this.lastPanelId = panelId;
        if (!opened)
            return false;
        if (!document.documentElement.hasAttribute(MOBILE_FORM_ATTR))
            return false;
        const frame = this.deps.frame() ?? document.querySelector(FRAME_SELECTOR);
        // Already collapsed: nothing to do, and calling the toggle would re-open it.
        if (frame === null || frame.hasAttribute(SIDEBAR_COLLAPSED_ATTR))
            return false;
        this.deps.collapseDrawer();
        return true;
    }
}
