import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
/** The apply-world callbacks this entry may use. */
export interface SidebarToggleInjected {
    /** Toggle the frame's left sidebar (upstream ctx.layout.toggleSidebar). */
    toggleSidebar(): void;
}
/** Full props: the header-leading runtime share plus the injected toggle. */
export type SidebarToggleProps = PropsRuntime<'conversation.header.leading'> & InjectFace<SidebarToggleInjected>;
/**
 * The drawer toggle for the header's leading seat.
 * @param props - runtime share and the injected toggle.
 * @returns the toggle button, with the pending-browser badge when one is waiting.
 */
export declare function SidebarToggle({ toggleSidebar }: SidebarToggleProps): import("react").JSX.Element;
