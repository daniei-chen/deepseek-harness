/**
 * Export-result channel: the shell-overlay dialog's data source.
 *
 * A plain observable rather than a framework store: this plugin's only shared
 * state is one dialog's payload, and 0.1.5's `dsh-client-store` is a separate
 * package whose own third-party imports (zustand) are not in the browser module
 * table for a feature plugin. The slot framework binds this source into a
 * `useExportResult` hook through the registration's `hooks` compartment.
 */
/** Host-owned channel: the plugin writes, the dialog component reads. */
export class ExportResultChannel {
    listeners = new Set();
    snapshot = { open: false, ok: true, title: '', detail: '' };
    /** @returns the current dialog state. */
    getSnapshot = () => this.snapshot;
    /**
     * @param listener - change observer.
     * @returns its disposer.
     */
    subscribe = (listener) => {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    };
    /**
     * Open the dialog with one outcome; a second result supersedes a still-open first.
     * @param payload - the outcome to show.
     */
    show(payload) {
        this.snapshot = { open: true, ok: payload.ok, title: payload.title, detail: payload.detail };
        this.publish();
    }
    /** Fold the dialog; the last result stays recorded. */
    close() {
        this.snapshot = { ...this.snapshot, open: false };
        this.publish();
    }
    publish() {
        for (const listener of [...this.listeners])
            listener();
    }
}
/**
 * Report one user-facing outcome through the shell-overlay dialog.
 *
 * The dialog entry subscribes to the `dsh:export-result` DOM event, which the
 * shell's export bridge and this plugin's own native-action failures both use:
 * one surface, one dismissal, no second dialog implementation.
 * @param payload - the outcome to show.
 */
export function reportUserFacingResult(payload) {
    window.dispatchEvent(new CustomEvent('dsh:export-result', { detail: payload }));
}
