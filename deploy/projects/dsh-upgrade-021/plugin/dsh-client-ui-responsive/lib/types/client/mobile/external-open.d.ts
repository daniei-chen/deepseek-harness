import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
/**
 * The tab body: name the file, then hand it to the system chooser.
 * @param props - the session-scoped tab share (runtime hooks + the tab reader).
 * @returns the card, or an explanation when this host cannot open paths.
 */
export declare function ExternalOpenTab({ sessionId, useSessions, useTabInfo }: PropsRuntime<'sidebar.right.pane.tab'>): import("react").JSX.Element;
