import type { PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
/** Full section props: the settings shell supplies only `close`, plus the
 *  developer-options child seat (adb authorization panel et al) this section declares. */
export type DevSectionProps = PropsRuntime<'settings.section'> & Partial<PropsRenderSlots<'settings.dev.item'>>;
/**
 * Render the developer-options section content column.
 * @param props - composed slot props (contract/slots.ts).
 * @returns the section element tree.
 */
export declare function DevSection({ renderSlot }: DevSectionProps): import("react").JSX.Element;
