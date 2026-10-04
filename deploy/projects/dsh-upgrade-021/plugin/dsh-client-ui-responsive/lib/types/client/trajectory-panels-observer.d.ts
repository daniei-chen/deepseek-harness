/**
 * 轨迹详情面板开合的 class 降级路径（2026-08-23，#17 回归修复）：
 * 主 CSS 用 :has()（Chromium 105+）抬升 ledger z-index；旧 WebView（MIUI12
 * 时代 Chromium 83）不支持 :has()，整条规则被丢弃 → 面板被顶部 banner 遮挡。
 * 本观察器用 MutationObserver 检测 aside[aria-label="Event details"] 的存在，
 * 给所属 ledger 切换 dsh-mobile-ledger-raised class（trajectory-details.css.ts
 * 的伴随规则兜底），并在浏览器原生支持 :has() 时自动停摆（零重复开销）。
 */
export declare class TrajectoryPanelsObserver {
    private readonly mutationObserver;
    private readonly ledger;
    private attached;
    constructor(ledger: Element | null);
    /** 开始监听面板开合（幂等）。 */
    attach(): void;
    /** 停止监听并清除 class。 */
    detach(): void;
    /** 面板存在 → 抬升 ledger（class 路径，CSS .dsh-mobile-ledger-raised）；否则移除。 */
    private sync;
    private isRelevantMutation;
    /** CSS 支持探测：:has() 对旧内核很可能是 SyntaxError 整条丢弃后的误报，
     *  用 CSS.supports 的官方探测（Chromium 105+ 才有 CSS.supports('selector(:has(*))') 真值）。 */
    private supportsHasSelector;
}
