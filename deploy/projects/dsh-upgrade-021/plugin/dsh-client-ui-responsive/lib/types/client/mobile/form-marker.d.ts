/**
 * Mobile-form marker: the single source of truth behind every narrow-screen
 * rule this plugin injects.
 *
 * Two DOM facts are published here:
 * - `data-dsh-mobile-form` on `<html>` mirrors the `(max-width: 767px)` media
 *   query, so stylesheets re-anchored from the retired fork's `[data-mobile]`
 *   attribute keep one gate that matches the frame's own breakpoint choices
 *   (upstream's right panel turns fullscreen below 768px of frame width).
 * - `data-dsh-frame` tags the upstream frame root. The frame carries no stable
 *   hook of its own; its right column does (`data-rightbar-col`), so the tag is
 *   written from there and re-applied whenever the frame remounts.
 * - `data-dsh-modal-open` on `<html>` when any body-level modal is up, and
 *   `data-dsh-settings-dialog` on the settings panel itself. The settings
 *   overlay renders inside the sidebar subtree, so a translated (off-canvas)
 *   ancestor would carry it off-screen; the settings panel has no attribute of
 *   its own to key a stylesheet on, only its nav/content structure, so this
 *   marker is written onto the panel element it finds.
 * - `data-dsh-settings-open` on `<html>` while that settings panel is present.
 *   The narrow-form sheet must pin the drawer (transform: none) for the
 *   settings panel alone: a descendant rule cannot key on an attribute carried
 *   by the descendant, and a :has() selector would need a Chromium 105 floor
 *   this plugin does not have. Publishing the fact on the root keeps the
 *   stylesheet a plain attribute match on every supported kernel.
 */
/** Width at or below which the phone form applies; matches upstream's 768px fullscreen threshold. */
export declare const MOBILE_FORM_MAX_WIDTH = 767;
/** Marks the phone form on `<html>` and tags the upstream frame root. */
export declare class MobileFormMarker {
    private media;
    private observer;
    private frame;
    private modal;
    /** Publish both facts and keep them current. */
    attach(): void;
    /** Remove listeners, the observer, and both marks. */
    detach(): void;
    private readonly syncDom;
    /**
     * Publish "a modal is up", tag the settings panel, and mirror that one
     * dialog on the root.
     *
     * Dialogs inside the frame's own overlay layer (this plugin's export-result
     * dialog) are not modals over the sidebar and never pin the drawer.
     */
    private syncModal;
    private readonly syncForm;
    private readonly syncFrame;
}
