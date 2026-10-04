export interface ShellStateOptions {
    /** 可见时的轮询间隔（毫秒）；缺省不轮询（只靠 visibilitychange/focus 重读）。 */
    pollMs?: number;
}
/**
 * @param getter - 真源读函数（壳桥或由其派生的值）；必须同步、无副作用。
 * @param options - 可选轮询间隔。
 * @returns `[当前值, refresh]`：refresh 立即重读真源（供写后回读），失败保留上一次值。
 */
export declare function useShellState<T>(getter: () => T, options?: ShellStateOptions): readonly [T, () => void];
