/** Reconcile native AI-created/closed tabs with the official Sidebar occurrence inventory. */
import type { TabId } from '@deepseek-ai/dsh-client-ui-dockkit';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { SidebarRightOpenTab } from '@deepseek-ai/dsh-client-ui-sidebar-right/client';
import { NativeBrowserSession } from './native-browser-adapter.ts';
/** All navigation callbacks are captured by the browser registration's injected services. */
export interface NativeBrowserPlacementOptions {
    readonly sessions: () => readonly SessionId[];
    readonly tabs: () => readonly SidebarRightOpenTab[];
    readonly mounted: () => SessionId | undefined;
    readonly expanded: () => boolean;
    readonly open: (session: SessionId) => void;
    readonly close: (session: SessionId, tabId: TabId) => void;
    readonly kind: string;
    readonly legacyKind: string;
}
/** One workspace per Session; HMR disposes attachments, never native workspace contents. */
export declare class NativeBrowserPlacement {
    private readonly options;
    private readonly workspaces;
    private readonly pending;
    private timer;
    private disposed;
    constructor(options: NativeBrowserPlacementOptions);
    /** @param session - owning Session. @returns stable native adapter for that Session. */
    for(session: SessionId): NativeBrowserSession;
    /** Start discovery without expanding another Session or a collapsed column. */
    attach(): () => void;
    /** Hide attachments and stop discovery; explicit close remains a separate operation. */
    dispose(): void;
    private tick;
}
