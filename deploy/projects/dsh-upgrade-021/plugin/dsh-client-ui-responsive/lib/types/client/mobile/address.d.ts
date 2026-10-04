/**
 * `dsh-resource://file/…` address parsing for the Android open-with entries.
 *
 * The grammar is upstream's (`@deepseek-ai/dsh-util-workspace-path`), which the
 * Files tab uses to name a row: `dsh-resource://file/session/<sessionId>/<path>`
 * for a workspace path, `dsh-resource://file/absolute/<path>` for a path the
 * Session does not root. The package is not a shared module-table seat, so this
 * module re-states the parse rule the Android side needs; a change upstream is
 * caught by `tests/address.spec.ts`.
 */
/** Parts of a file resource address this plugin acts on. */
export type ParsedFileAddress = {
    readonly scope: 'session';
    readonly sessionId: string;
    readonly path: string;
} | {
    readonly scope: 'absolute';
    readonly path: string;
};
/**
 * Read a file address back into its parts.
 * @param address - a candidate address.
 * @returns the parts, or `undefined` when the string is not a file address in a known scope or a segment is malformed.
 */
export declare function parseFileAddress(address: string): ParsedFileAddress | undefined;
/**
 * Resolve a parsed address to the absolute device path the shell can open.
 * @param parsed - the parsed address.
 * @param sessionRoot - the Session's workspace directory, from its summary.
 * @returns the absolute path, or `undefined` when a relative path has no known root.
 */
export declare function resolveAbsolutePath(parsed: ParsedFileAddress, sessionRoot: string | undefined): string | undefined;
