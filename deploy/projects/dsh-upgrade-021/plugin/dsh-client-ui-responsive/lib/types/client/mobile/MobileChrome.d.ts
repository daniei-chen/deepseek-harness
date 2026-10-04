import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
/** The apply-world callbacks this entry may use. */
export interface MobileChromeInjected {
    /** Toggle the frame's left sidebar (upstream ctx.layout.toggleSidebar). */
    toggleSidebar(): void;
}
/** Full props: the overlay runtime share plus the injected toggle. */
export type MobileChromeProps = PropsRuntime<'shell.overlay'> & InjectFace<MobileChromeInjected>;
/**
 * The drawer mask for the phone form.
 * @param props - the injected drawer toggle (used to close on a tap beside the drawer).
 * @returns the mask, which is inert outside the phone form.
 */
export declare function MobileChrome({ toggleSidebar }: MobileChromeProps): import("react").JSX.Element;
