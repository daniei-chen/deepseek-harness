/**
 * External-open attachment-draft consumer.
 *
 * The queue returns opaque file metadata only. The trusted shell bridge supplies the temporary
 * workspace cwd (never a source-file path); the normal client Session controller creates a blank
 * locally addressable Session there before the source is claimed and attached through the existing
 * composer/upload flow.
 */
export interface IncomingDraftItem {
    entryId: string;
    sessionId?: string;
    state: 'received' | 'session-created';
    name: string;
    bytes: number;
}
interface FetchResponse {
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
    blob(): Promise<Blob>;
}
export type IncomingDraftFetch = (input: string, init?: RequestInit) => Promise<FetchResponse>;
/** Narrow facade over existing session and conversation services. */
export interface IncomingDraftRuntime {
    refreshSessions(): Promise<void>;
    createSession(cwd: string): Promise<string>;
    openSession(sessionId: string): void;
    sessionScope(sessionId: string): unknown | undefined;
    attachGenericFile(sessionId: string, file: File): boolean;
    notify(scope: unknown, text: string): void;
}
/** Drives one process-local external attachment flow. */
export declare class IncomingDraftConsumer {
    private readonly fetchImpl;
    private readonly runtime;
    private busy;
    private readonly hydrating;
    private readonly createdSessions;
    /** review C10：逐条目的载入尝试计数与终止标记——无 sessionId 的补建必须**有限次**。 */
    private readonly attempts;
    private readonly exhausted;
    /** 已经提示过「临时工作区不可用」的条目（S3-21：同一 entryId 只提示一次）。 */
    private readonly workspaceWarned;
    private static readonly MAX_HYDRATE_ATTEMPTS;
    /** @param fetchImpl authenticated same-origin fetch. @param runtime session/conversation bridge. */
    constructor(fetchImpl: IncomingDraftFetch, runtime: IncomingDraftRuntime);
    /** Fetch eligible queue metadata and hydrate each blank-session attachment once. */
    poll(): Promise<void>;
    /**
     * review C10：尝试次数封顶。旧实现每次轮询无条件重试；createSession 失败时每次都会新建
     * workspace/session（用户侧表现：反复多出临时会话）。封顶后停止自动补建并提示一次，
     * 用户重新分享文件即可得到新条目（进程内新记录不受影响）。
     */
    private exhaustedFor;
    /**
     * 「拿不到临时工作区路径」的可见回执（S3-21；同一 entryId 只提示一次）。
     *
     * 为什么会拿不到：壳侧的临时工作区尚未建立（首启/引擎重启中），或壳侧未装配该 bridge 方法。
     * 旧实现直接 return —— 用户的分享就此消失，既没有提示也没有下一步。
     * @param item - 被卡住的来件条目。
     */
    private notifyWorkspaceUnavailable;
    private hydrate;
    private finish;
}
export {};
