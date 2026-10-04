/**
 * 会话身份标记（ST-15 页侧半边，F-UI-01）。
 *
 * 工具行的文件链接必须按**行所属会话**解析：上游自己的权威做法是
 * `ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd`
 * （dsh/packages/client/ui-chat/src/client/apply.ts:132-136）。注入层（host-web-compat）
 * 在页面里拿不到客户端会话快照，因此由本模块把**当前会话 id** 发布到 DOM：
 * `<html data-dsh-session-id="...">`，供注入层随点击请求带给引擎端点。
 *
 * 真源 = 客户端会话快照（单一权威）；无会话时移除属性（注入层据此走"无会话"分支，
 * 而不是猜一个会话）。卸载时移除属性，避免残留旧会话身份。
 */
export interface SessionListSnapshot {
    current?: unknown;
}
export interface SessionListLike {
    getSnapshot?(): SessionListSnapshot | undefined;
    subscribe?(listener: () => void): (() => void) | undefined;
}
export interface SessionsFace {
    list?: SessionListLike;
}
/** 发布当前会话 id 的 DOM 属性名（注入层与 e2e 断言共用）。 */
export declare const SESSION_ID_ATTRIBUTE = "data-dsh-session-id";
export declare class SessionMarker {
    private readonly sessions;
    private unsubscribe;
    private attached;
    constructor(sessions: SessionsFace | undefined);
    /** 开始跟踪当前会话（幂等）。 */
    attach(): void;
    /** 停止跟踪并移除标记。 */
    detach(): void;
    /** 同步一次：当前会话 id → 属性；无会话则移除。 */
    sync(): void;
}
