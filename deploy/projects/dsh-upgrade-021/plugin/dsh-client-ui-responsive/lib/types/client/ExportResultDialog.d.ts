import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { ExportResultSnapshot } from './export-result.ts';
/** Composed props: the overlay runtime share plus the injected dialog face. */
export interface ExportResultDialogProps extends PropsRuntime<'shell.overlay'> {
    /** Framework-bound reader over the channel's snapshot. */
    useExportResult: <T>(selector: (snapshot: ExportResultSnapshot) => T) => T;
    /** Fold the dialog. */
    close: () => void;
}
/** The single entry component; renders nothing while no result is open. */
export declare function ExportResultDialog({ useExportResult, close }: ExportResultDialogProps): import("react").JSX.Element | null;
