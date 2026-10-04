import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
/** Full section props: the settings shell supplies only `close`. */
export type GeneralSettingsProps = PropsRuntime<'settings.general.item'>;
/**
 * Render the Android general-settings rows (immersive and screen scope).
 * @param props - composed slot props (contract/slots.ts).
 * @returns the section element tree.
 */
export declare function GeneralSettings(_props: GeneralSettingsProps): import("react").JSX.Element;
