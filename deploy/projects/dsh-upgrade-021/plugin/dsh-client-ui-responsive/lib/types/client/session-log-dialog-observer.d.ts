/** 上游导出弹窗的判定：`[role=dialog]` 且 aria-label 命中导出文案前缀。 */
export declare function isSessionLogDialog(element: Element): boolean;
export declare class SessionLogDialogObserver {
    private readonly mutationObserver;
    private attached;
    private readonly tagged;
    /** 开始监听导出弹窗（幂等）；原生支持 :has() 时 CSS 路径已足够，class 降级不启用。 */
    attach(): void;
    /** 停止监听并清除所有 class。 */
    detach(): void;
    /** 同步一次：命中导出弹窗 → 打 class；弹窗消失 → 收 class（绝不残留）。 */
    sync(): void;
    private isRelevantMutation;
}
/** CSS 支持探测：旧内核缺 `selector(:has(*))` 支持（真值需 Chromium 105+）。 */
export declare function supportsHasSelector(): boolean;
