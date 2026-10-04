/** 发布当前会话 id 的 DOM 属性名（注入层与 e2e 断言共用）。 */
export const SESSION_ID_ATTRIBUTE = 'data-dsh-session-id';
export class SessionMarker {
    sessions;
    unsubscribe;
    attached = false;
    constructor(sessions) {
        this.sessions = sessions;
    }
    /** 开始跟踪当前会话（幂等）。 */
    attach() {
        if (this.attached)
            return;
        this.attached = true;
        this.sync();
        try {
            this.unsubscribe = this.sessions?.list?.subscribe?.(() => { this.sync(); });
        }
        catch {
            this.unsubscribe = undefined; // 快照实现不支持订阅：只保留挂载时的一次发布
        }
    }
    /** 停止跟踪并移除标记。 */
    detach() {
        try {
            this.unsubscribe?.();
        }
        catch {
            /* dispose already gone: nothing to release */
        }
        this.unsubscribe = undefined;
        this.attached = false;
        try {
            document.documentElement.removeAttribute(SESSION_ID_ATTRIBUTE);
        }
        catch {
            /* no document (non-browser host): nothing to clean */
        }
    }
    /** 同步一次：当前会话 id → 属性；无会话则移除。 */
    sync() {
        try {
            const current = this.sessions?.list?.getSnapshot?.()?.current;
            const root = document.documentElement;
            if (current === undefined || current === null || String(current) === '')
                root.removeAttribute(SESSION_ID_ATTRIBUTE);
            else
                root.setAttribute(SESSION_ID_ATTRIBUTE, String(current));
        }
        catch {
            /* 快照不可读：保持现状（不把标记清成错误值） */
        }
    }
}
