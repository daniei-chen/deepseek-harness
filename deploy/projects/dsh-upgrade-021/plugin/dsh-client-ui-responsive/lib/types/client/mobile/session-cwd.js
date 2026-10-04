/**
 * One Session's workspace directory, read from the runtime session list.
 *
 * The session-list snapshot is typed loosely here (this plugin declares only the
 * slice it consumes), so the read goes through one narrow shape guard instead of
 * casting at every call site.
 */
/**
 * Read one Session's workspace directory.
 * @param state - the runtime's session-list snapshot.
 * @param sessionId - the Session whose summary is read.
 * @returns the directory, or `undefined` when the summary lacks one.
 */
export function sessionCwd(state, sessionId) {
    const byId = state.byId;
    const cwd = byId?.[sessionId]?.cwd;
    return typeof cwd === 'string' && cwd !== '' ? cwd : undefined;
}
