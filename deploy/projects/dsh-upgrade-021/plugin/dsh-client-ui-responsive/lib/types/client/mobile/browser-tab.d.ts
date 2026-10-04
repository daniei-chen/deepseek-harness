import type { ReactNode } from 'react';
import type { TranslateNS } from '@deepseek-ai/dsh-client-locale/client';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SidebarRightTabDefinition } from '@deepseek-ai/dsh-client-ui-sidebar-right/client';
import { type BrowserBodyProps } from './upstream-browser/view/BrowserBody.tsx';
import type { NativeBrowserControlsInjected } from './native-browser-adapter.ts';
/** Own dispatch id; existing Android browser layout records keep their occurrence ids. */
export declare const BROWSER_TAB_ID = "android-browser";
/** Take the official builtin kind through the registry's extension band. */
export declare const BROWSER_TAB_KIND = "browser";
/** Guide-less resolver for pre-0.2 Android layouts, without rewriting any layout data. */
export declare const LEGACY_BROWSER_TAB_KIND = "android-browser";
/** Legacy needs a distinct implementation id because registry ids are globally unique. */
export declare const LEGACY_BROWSER_TAB_ID = "android-browser.legacy";
declare module '@deepseek-ai/dsh-client-ui-sidebar-right/client' {
    interface SidebarRightTabParamsMap {
        /** The official Browser URL parameter; native ids stay private to the adapter. */
        browser: {
            readonly url?: string;
        };
    }
}
/**
 * Contribute the official guide artwork and one Browser entry, not a replacement workspace tree.
 * @param t - locale-live private Browser dictionary.
 * @returns extension-band browser type.
 */
export declare function browserTabDefinition(t: TranslateNS<'androidSidebarBrowser'>): SidebarRightTabDefinition;
/** @param t - locale-live copy. @returns guide-less compatibility resolver. */
export declare function legacyBrowserTabDefinition(t: TranslateNS<'androidSidebarBrowser'>): SidebarRightTabDefinition;
/** Bound neutral browser state plus native-specific controls; no component sees Context. */
export type AndroidBrowserBodyProps = BrowserBodyProps & InjectFace<NativeBrowserControlsInjected>;
/** Reuse the official address/start/restore UI; native controls occupy their own non-stage row. */
export declare function BrowserTab(props: AndroidBrowserBodyProps): ReactNode;
/** Framework-owned menu occurrence; content actions join the real Sidebar tab menu. */
export type BrowserTabMenuProps = PropsRuntime<'sidebar.right.tab.menu.item'> & PropsLocale<'androidSidebarBrowser'> & InjectFace<NativeBrowserControlsInjected>;
/** Add native profile/status/close actions without fabricating a public toolbar slot. */
export declare function BrowserTabMenu({ tab, dismiss, useNativeBrowserState, setBrowserIdentity, refreshBrowserStatus, closeBrowserTab, t }: BrowserTabMenuProps): ReactNode;
