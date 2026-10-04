/**
 * The Android shell's native "open with" channel.
 *
 * The shell exposes `androidBridge.openPathChooser(path, mode)` (Kotlin
 * `PathOpen`), which shows the system chooser over the installed file managers
 * (MT Manager, the system DocumentsUI) and answers with a JSON result. Every
 * caller here degrades to "unavailable" when the bridge (or that method) is
 * missing, which is the desktop/non-shell case.
 */
import type { OpenPathMode, OpenPathResult } from '../android-bridge.ts';
/**
 * Whether the running host can raise the native chooser.
 * @returns true when the shell injected the method.
 */
export declare function chooserAvailable(): boolean;
/**
 * Ask the shell to open a path through the system chooser.
 * @param path - absolute device path.
 * @param mode - `folder` targets file managers on the directory, `view` on the file.
 * @returns the shell's outcome; `{ ok: false, reason: 'unavailable' }` without a shell.
 */
export declare function openPathChooser(path: string, mode?: OpenPathMode): OpenPathResult;
