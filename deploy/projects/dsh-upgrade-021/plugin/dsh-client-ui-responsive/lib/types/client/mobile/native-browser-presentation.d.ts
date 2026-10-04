/** Position one native tab over only the official BrowserBody viewport. */
import type { BrowserPresentation } from './upstream-browser/view/BrowserPresentation.ts';
/** Identity and visibility remain owned by the Session/occurrence adapter. */
export interface NativeBrowserPresentationOptions {
    readonly session: string;
    readonly uiTabId: string;
    readonly nativeTabId: () => string | undefined;
    readonly visible: () => boolean;
    readonly ready: () => boolean;
}
/** Native presentation never opens or closes a page; detach is targeted hide only. */
export declare class NativeBrowserPresentation implements BrowserPresentation {
    private readonly options;
    private release;
    private publish;
    constructor(options: NativeBrowserPresentationOptions);
    /** Republish after a framework-visible tab or native navigation change. */
    refresh(): void;
    mount(viewportId: string): () => void;
    /** Release observers and hide only this Session's native tab. */
    detach(): void;
}
