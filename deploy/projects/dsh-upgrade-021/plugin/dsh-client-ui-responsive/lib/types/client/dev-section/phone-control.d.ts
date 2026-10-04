import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
interface A11yStatus {
    /** 状态是否真的读到了（false = 桥缺席/解析失败，界面不得冒充「未开启」）。 */
    readable: boolean;
    enabled: boolean;
    hint: string;
    restrictedSettingsApplies: boolean;
}
interface ShizukuStatus {
    /** 状态是否真的读到了（false = 桥缺席/解析失败）。 */
    readable: boolean;
    installed: boolean;
    running: boolean;
    granted: boolean;
    bound: boolean;
    binding: boolean;
    guidance: string;
}
/**
 * issue #262「AI root 权限」开关状态（壳侧 [RootGrant.state] 的同构面）。
 *
 * 判据要点：`channelRoot` 是**通道身份**（Shizuku 服务端 uid==0），不是「设备是否 root」——
 * 已 root 但 Shizuku 以 ADB 启动的设备此值为 false，开关必须置灰（假绿是 issue 点名的缺陷形态）。
 */
interface RootOwnershipStatus {
    readable: boolean;
    running: boolean;
    overdue: boolean;
    startedAt: number;
    completedAt: number;
    operation?: string;
    result: Record<string, unknown> | undefined;
}
interface RootGrantStatus {
    /** 状态是否真的读到了（false = 桥缺席/解析失败，界面不得冒充「未授权」以外的任何状态）。 */
    readable: boolean;
    granted: boolean;
    /** 「已阅读」同意是否对**当前版本**有效（与 versionCode 绑定，升级后需重新确认）。 */
    consentValid: boolean;
    /** 通道身份 uid（读不到 = -1）。 */
    channelUid: number;
    /** 通道身份是否 root（== 开关是否具备开启资格）。 */
    channelRoot: boolean;
    /** 应用级 root 授权（Root 管理器）是否已获得——开关放行的第三道门（2026-09-30 主人定例）。 */
    rootGranted: boolean;
    /** 应用级 root 授权状态词（unknown/requesting/granted/denied/timeout/no-su）。 */
    rootState: string;
    /** 壳侧诚实性说明（策略门 ≠ 技术沙箱）。 */
    honesty: string;
    /** Shared single-flight native maintenance, observed by existing root polling. */
    ownership?: RootOwnershipStatus;
}
/**
 * 应用级 root 授权面（壳侧 [RootAccess.state] 的同构面，2026-09-30 主人定例）。
 *
 * 「这个开关应该调用一下 root 弹窗，并且检测 root 是否授权，如果没有，请写好引导去
 * Root 管理器，授予 root」——本面就是那条流程的读面：状态 + 管理器 + 引导语。
 */
interface RootAccessStatus {
    readable: boolean;
    /** 本机是否存在可执行的 su（未 root / 未装管理器时为 false）。 */
    suExists: boolean;
    /** unknown | requesting | granted | denied | timeout | no-su */
    state: string;
    uid: number;
    granted: boolean;
    /** 请求在飞（弹窗已弹出、等用户在管理器上点「允许」）。 */
    requesting: boolean;
    /** Root 管理器（KernelSU / Magisk / APatch）。 */
    managerLabel: string;
    managerInstalled: boolean;
    /** 壳侧引导语（每态都能说清「下一步做什么」）。 */
    guidance: string;
}
/** Submitted/running/unknown results must never be rendered as completed repair. */
export declare function describeOwnershipRepair(state: RootOwnershipStatus): {
    ok: boolean | undefined;
    text: string;
} | undefined;
/** issue #262 用户指定文案（**逐字保留**，未 root 通道下的红字）。 */
export declare const ROOT_GRANT_NOT_ROOT_TEXT = "\u65E0\u6CD5\u5728\u672A root \u7684\u8BBE\u5907\u4E0A\u8D4B\u4E88\u8BE5\u6743\u9650";
/**
 * 外链/拉起失败原因的中文口径在**唯一真源** `../user-copy.ts`（0.14.1 批 3 / P3-1）。
 *
 * 本文件此前自带一张 `LINK_REASON_LABEL` 局部表——与本页其它面、以及壳侧各自的局部表并存，
 * 于是同一个码在不同界面说法不同。局部表已删除：翻译只此一处，码本身只进 `data-*`。
 */
/**
 * Shizuku 通道状态 → 中文状态词。
 *
 * 五态与壳侧 `ShizukuTransport.status()` 的字段一一对应；顺序即真实推进顺序
 * （未安装 → 未启动 → 未授权 → 未绑定 → 就绪），用户据此知道自己在第几步。
 */
export declare function shizukuStateLabel(status: ShizukuStatus): string;
/** 壳侧 guidance 缺失时的兜底说明（每态都能说清「下一步做什么」）。 */
export declare function shizukuStepHint(status: ShizukuStatus): string;
export declare function parseRootReply(raw: string | undefined): Record<string, unknown> | undefined;
/** 外链/拉起类调用统一结算：成功给人话，失败给「原因 + 下一步」，绝不静默。 */
export declare function settleLinkCall(raw: string | undefined, okText: string, failLead: string): {
    ok: boolean;
    text: string;
};
/** 受限设置解锁结算（壳侧回 `{ok, message}`，message 已是人话）。 */
export declare function settleUnlockCall(raw: string | undefined): {
    ok: boolean;
    text: string;
};
/**
 * Shizuku 通道状态（**唯一**「装没装」的事实来源）。
 *
 * `installed` 字段决定「打开 Shizuku」是否可点：拿不到状态时按**未安装**处理（复用
 * [SHIZUKU_UNREADABLE]），于是按钮不可点而不是点了没反应——死路形态在本页被结构性排除。
 */
export declare function readShizuku(): ShizukuStatus;
/**
 * issue #262「AI root 权限」读面（壳侧 [RootGrant.state] 的桥接）。
 *
 * 读不到一律回落 [ROOT_GRANT_UNREADABLE]（`readable:false`）：界面据此显示「状态不可读」
 * 而不是冒充「未授权」或「可开启」——与 [readShizuku] 同纪律。
 */
export declare function readRootGrant(): RootGrantStatus;
/**
 * 应用级 root 授权读面（壳侧 [RootAccess.state] 的桥接）。
 *
 * 读不到一律回落 [ROOT_ACCESS_UNREADABLE]（`readable:false`）：界面据此显示「状态不可读」
 * 而不是冒充「未授权」或「已授权」——与 [readRootGrant] 同纪律。
 */
export declare function readRootAccess(): RootAccessStatus;
/** 应用级 root 授权状态 → 中文状态词（与壳侧 RootAccess 的状态常量一一对应）。 */
export declare function rootAccessStateLabel(status: RootAccessStatus): string;
/** 请求按钮可否点：有 su 且没有请求在飞。 */
export declare function canRequestRoot(status: RootAccessStatus): boolean;
/**
 * 开关状态 → 中文状态词（与壳侧字段一一对应，供测试直接断言）。
 *
 * 顺序即真实判据顺序：读不到 → 通道非 root（置灰）→ 未授权 → 已授权。
 */
export declare function rootGrantStateLabel(status: RootGrantStatus): string;
/** 开关可否点击：只有**通道身份确为 root**才可点（读不到/非 root 一律不可点）。 */
export declare function canToggleRootGrant(status: RootGrantStatus): boolean;
/** Shizuku 以 ADB（shell）身份启动时的通道 uid（issue #262 点名的分流判据）。 */
export declare const SHIZUKU_SHELL_UID = 2000;
/**
 * 非 root 通道下的引导语（issue #262 要求**按通道身份分流**，2026-09-30 对账补）：
 *  - 通道 uid == 2000（Shizuku 以 ADB 启动，设备**可能已 root**）⇒ 引导「在 Shizuku 内以 root 启动」；
 *  - 其它（无通道 / 未 root）⇒ 用户指定红字「无法在未 root 的设备上赋予该权限」（逐字）。
 *
 * 两者都置灰开关；区别只在**用户下一步该做什么**——把已 root 的设备误报成「未 root」会让人
 * 去折腾设备 root，而真正要做的是重启 Shizuku 的启动方式。
 */
export declare function rootGrantChannelHint(status: RootGrantStatus): {
    text: string;
    kind: 'shell-identity' | 'not-root' | 'none';
};
/** 无障碍通道状态；读不到时如实报不可读，不冒充「未开启」（0.14.1 UI 审查 P1）。 */
export declare function readA11y(): A11yStatus;
/**
 * 渲染「手机控制」设置分区。
 * @returns 分区元素树。
 */
export declare function PhoneControlSection(_props: PropsRuntime<'settings.section'>): import("react").JSX.Element;
export {};
