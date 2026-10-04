/** The complete narrow command vocabulary implemented by the Android shell. */
export type NativeBrowserAction = 'open' | 'back' | 'forward' | 'reload' | 'select' | 'close' | 'status' | 'tabs';
/** One native tab; its id belongs to the named Session, not to global focus. */
export interface NativeBrowserTab {
    readonly tabId: string;
    readonly uiTabId: string | undefined;
    readonly url: string;
    readonly title: string;
    readonly pageGeneration: number;
    readonly loadState: string;
    readonly canGoBack: boolean;
    readonly canGoForward: boolean;
    readonly identityId: string;
    readonly viewportWidth: number;
    readonly viewportHeight: number;
    readonly profileAvailable: boolean;
    readonly profileReason: string;
    readonly reason: string;
}
/** Validated native authority; an unavailable result must never remove layout records. */
export interface NativeBrowserSnapshot {
    readonly ok: boolean;
    readonly available: boolean;
    readonly session: string;
    readonly reason: string;
    readonly profileAvailable: boolean;
    readonly profileReason: string;
    readonly tabs: readonly NativeBrowserTab[];
    readonly authoritativeTabs: boolean;
    readonly tabId: string | undefined;
}
/** @param session - requesting Session. @param reason - wire refusal. @returns explicit unavailable state. */
export declare function unavailableNativeBrowser(session: string, reason: string): NativeBrowserSnapshot;
/**
 * Decode shell JSON, rejecting malformed ids, duplicate tabs and foreign Sessions.
 * @param raw - synchronous shell reply.
 * @param session - Session captured by the caller before the operation.
 * @returns validated native state, or an explicit unavailable reason.
 */
export declare function parseNativeBrowserSnapshot(raw: string | undefined, session: string): NativeBrowserSnapshot;
/**
 * Execute only the declared trusted command with captured Session and occurrence ids.
 * @param session - owning Session.
 * @param action - narrow operation.
 * @param options - native/GUI ids and optional validated address.
 * @returns decoded reply; bridge failures are unavailable state, not optimistic UI success.
 */
export declare function nativeBrowserCommand(session: string, action: NativeBrowserAction, options?: {
    readonly tabId?: string;
    readonly uiTabId?: string;
    readonly url?: string;
}): NativeBrowserSnapshot;
