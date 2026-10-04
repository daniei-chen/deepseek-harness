/**
 * Android mobile adaptation layer over the upstream frame.
 *
 * 0.2.0 de-forked this plugin: 0.1.5 turned `ui-layout` into the layout service
 * hub (`ctx.layout`, the keyed `main` panel seat, the right column's
 * track/fullscreen reporting), and the previous fork of its AppFrame had to
 * reproduce that whole surface. The plugin now keeps upstream's frame and adds
 * only what a phone needs:
 *
 * - a phone form (<768px) in CSS: the left sidebar becomes an off-canvas drawer,
 *   the centre column spans the frame, and the right Sidebar keeps upstream's own
 *   fullscreen slide-over (its threshold is the same 768px);
 * - one drawer toggle in upstream's own header row (`conversation.header.leading`),
 *   so no control is added to the sidebar rail or the composer row;
 * - the drawer mask (`shell.overlay`), which covers the frame while it is open;
 * - the native "open with" wiring: a Session-header action for the workspace
 *   directory and an `extension`-band tab type for files no preview can show;
 * - the pre-existing Android fixes (composer popups, insets, keyboard boundary,
 *   Enter guard, theme bridge, developer section, export-result dialog, external
 *   file delivery).
 *
 * Nothing here provides `ctx.layout` any more: the upstream plugin owns it, and
 * a second provider would fail the composition.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type ExportResultPayload } from './export-result.ts';
export { MOBILE_FORM_MAX_WIDTH } from './mobile/form-marker.ts';
declare global {
    interface Window {
        /** Android shell session-export outcome bridge (success / failure). */
        __dshExportResult?: (payload: ExportResultPayload) => void;
    }
}
/** Required services: composition, copy/theme faces, the runtime sessions, and the frame's panel actions. */
export declare const inject: string[];
/**
 * Client plugin body: the Android adaptation layer over the upstream frame.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
