import type { TabId } from '@deepseek-ai/dsh-client-ui-dockkit';
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots';
import type { BrowserPage, BrowserPageOptions } from './upstream-browser/browser/BrowserPage.ts';
import type { NativeBrowserAction, NativeBrowserSnapshot, NativeBrowserTab } from './native-browser-bridge.ts';
/** Private renderer facts, exposed only through framework-bound keyed hooks. */
export interface NativeBrowserControlState {
    readonly nativeTabId: string | undefined;
    readonly available: boolean;
    readonly reason: string;
    readonly profileAvailable: boolean;
    readonly profileReason: string;
    readonly identityId: string;
    readonly viewportWidth: number;
    readonly viewportHeight: number;
}
/** Companion controls; components receive bound hooks, not sources or services. */
export interface NativeBrowserControlsInjected {
    readonly keyedHooks: {
        readonly nativeBrowserState: (key: string) => HostObservable<NativeBrowserControlState>;
    };
    setBrowserVisible(tabId: TabId, visible: boolean): void;
    setBrowserIdentity(tabId: TabId, desktop: boolean): void;
    setBrowserViewport(tabId: TabId, width: number, height: number): void;
    refreshBrowserStatus(tabId: TabId): void;
    closeBrowserTab(tabId: TabId): void;
}
/** Native tabs outlive DOM mounts and plugin HMR; explicit layout close owns destruction. */
export declare class NativeBrowserSession {
    readonly session: string;
    private snapshot;
    private readonly bindings;
    private readonly visible;
    private readonly controls;
    private readonly frames;
    private readonly listeners;
    private disposed;
    constructor(session: string);
    /** Read native authority for reconciliation; failed polls cannot authorize removals. */
    getSnapshot(): NativeBrowserSnapshot;
    /** Refresh only this Session; there is no global-focus status fallback. */
    refresh(): NativeBrowserSnapshot;
    /** Framework keyed source, stable before the BrowserBody commits its container. */
    controlSource: (key: string) => HostObservable<NativeBrowserControlState>;
    /** Assemble the official controller's native navigation and targeted presentation. */
    createPage: (options: BrowserPageOptions) => BrowserPage;
    /** Recover a binding only from native ownership or a validated retained checkpoint. */
    refreshStatus(uiTabId: string, retainedNativeId?: string): void;
    /** Bind a native tab; absentPreviousUi is accepted only after complete layout-inventory absence. */
    claim(uiTabId: string, nativeTabId: string, absentPreviousUi?: string): boolean;
    /** Read only this occurrence's validated native id. */
    nativeTabId(uiTabId: string): string | undefined;
    /** Read only this occurrence's native navigation. */
    nativeTab(uiTabId: string): NativeBrowserTab | undefined;
    /** Native select changes ownership; visibility is delivered separately through bounds. */
    setVisible(uiTabId: string, visible: boolean): void;
    /** Visibility comes from the actual useTabInfo tab occurrence. */
    isVisible(uiTabId: string): boolean;
    /** Execute one targeted navigation; opening an empty GUI occurrence creates its own native tab. */
    command(uiTabId: string, action: NativeBrowserAction, url?: string): void;
    /** Explicit UI close only; cleanup failure keeps the Sidebar record through its close handler. */
    closeUi(uiTabId: string): void;
    /** Apply the shell's profile, never a UI-only UA label or optimistic readiness flag. */
    setIdentity(uiTabId: string, desktop: boolean): void;
    /** Keep native viewport dimensions separate from the viewport's presentation rectangle. */
    setViewport(uiTabId: string, width: number, height: number): void;
    /** Subscribe outside components; renderer sees only the derived inject observables. */
    subscribe(listener: () => void): () => void;
    /** Publish a local integration refusal without treating a failed operation as native tab absence. */
    reportFailure(reason: string): void;
    /** Stop this provider and hide its attachments; no native tabs or workspace are closed. */
    dispose(): void;
    private setting;
    private accept;
    private controlState;
    private publish;
}
