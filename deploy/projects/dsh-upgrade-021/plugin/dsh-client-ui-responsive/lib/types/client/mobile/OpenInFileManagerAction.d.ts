/**
 * Session-header "open in file manager": the Android replacement for upstream's
 * desktop `open-in-app` split button (both upstream rows are disabled in the
 * Android profile — their host catalog probes Finder/Terminal/editors).
 *
 * It opens the Session's workspace directory through the shell's native
 * chooser (MT Manager, the system file manager), which is the one meaningful
 * "open outside the app" gesture a phone has. Renders nothing without the
 * shell bridge, so a browser host never grows the control.
 */
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
/**
 * The header button.
 * @param props - the session-scoped utility share.
 * @returns the button, or null when the host cannot open paths.
 */
export declare function OpenInFileManagerAction({ sessionId, useSessions }: PropsRuntime<'conversation.session.header.utilities'>): import("react").JSX.Element | null;
