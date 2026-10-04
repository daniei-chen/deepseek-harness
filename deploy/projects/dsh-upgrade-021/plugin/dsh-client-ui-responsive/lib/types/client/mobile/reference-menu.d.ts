/**
 * 勾选框与底部条样式。
 *
 * - 勾选框用 `<span>` + CSS 画（原生 input 在深色主题里是浏览器默认方块，与上游行样式不融）；
 * - 选中态由 `[data-dsh-ref-on]` 属性派生 —— 属性是状态，样式是后果，中间没有 JS 同步步骤；
 * - 底部条的关键样式在 JS 里内联 `!important`（上游 button 默认样式会盖过注入样式表）。
 */
export declare const REFERENCE_BAR_CSS: string;
/** Multi-select state plus the mobile-only row behavior for the reference menu. */
export declare class ReferenceMenuEnhancer {
    /** 多选集合：**稳定键**（标签 + 同标签内序号），不是裸显示文本（#169-5）。 */
    private readonly checked;
    private observer;
    /** 按行去抖（#169-6）：同一行的三连手势只动作一次，但**不**吞掉别的行。 */
    private readonly lastGesture;
    private scheduled;
    private readonly onGesture;
    private readonly onMenuClick;
    attach(): void;
    detach(): void;
    /** Coalesce DOM churn into one enhance pass per frame. */
    private schedule;
    /** 清空多选状态与底部条（菜单关闭 / 卸载时；#169-6 的幻影残留防线）。 */
    private clearState;
    /**
     * Ensure every row carries a checkbox + a stable key, re-apply the checked mark, refresh the bar.
     * 菜单不在场时清态（避免关掉菜单后重开还看到「已选 N 项」）。
     * 非移动形态直接不注入（#169-4）。
     */
    private enhance;
    /** Toggle one row：状态落在行元素上，随后由 CSS 呈现（无二次同步步骤）。 */
    private toggle;
    /**
     * 底部条关键样式内联写入：`style.setProperty(..., 'important')` 优先级高于任何样式表规则
     * （含上游对 `button` 的默认样式——真机实测过一次「白底白字」正是这个原因）。
     * 颜色不取 `--dsw-alias-brand-primary`（深色下近白），用显式品牌蓝。
     */
    private applyBarStyles;
    /**
     * 底部条渲染（**幂等**，#169-2）：节点只建一次，之后只更新文本；绝不 `innerHTML=''` 重建
     * ——旧实现每帧重建子节点会触发 MutationObserver → schedule() → 再重建，选中期间持续抖动。
     */
    private renderBar;
    /** 上一次插入的残留提示（#169-3：失败要如实说，不能无声清空选择）。 */
    private lastReport;
    private statusText;
    /** Insert every checked candidate through upstream's settle-pick, one reference at a time. */
    private addSelected;
    /**
     * Drive one upstream pick for `key`: focus the composer, (re)open the menu with `@` when it
     * closed, then settle the matching row. Upstream owns the reference it inserts; a row that never
     * appears ends the sequence (reported by the caller) rather than inventing text upstream would
     * not have produced.
     */
    private pickByKey;
    /** The row whose stable key matches（#169-5：不再按显示文本取第一个同名行）。 */
    private findRow;
    /** Poll one predicate for up to `timeout` ms (menu open/close is not observable otherwise). */
    private waitFor;
}
