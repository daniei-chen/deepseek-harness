import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * 「手机控制」设置分区（0.14.0 用户定例：把手机控制单独开一个设置页）。
 *
 * 内容：Shizuku 特权通道（状态 + 下载/打开入口 + 视频教程）/ 开放屏幕范围 / 虚拟屏分辨率档位 /
 * 虚拟屏浮窗（退后台自动显示）/ 无障碍入口（含 Android 13+ 受限设置解锁）/ 强制销毁（连点三次确认）。
 *
 * 数据面纪律：全部经 window.androidBridge 只读回读 + 写后回读；桥不可用/抛错一律**如实报不可读**，
 * 不用安全默认值冒充事实（0.14.1 UI 审查：桥缺席时页面显示「未开启 / 0.75 / 仅虚拟屏幕」这些
 * 看起来像事实的值，改完还会自己弹回）。
 *
 * 0.14.1 Shizuku 面重做（用户 2026-09-22 定例，UI 审查 P0）：
 *  - **状态源换掉**：旧实现读的是 `vdisplayStatus()`——标题写「Shizuku 特权通道」，内容却是虚拟屏
 *    状态码与 displayId（只有虚拟屏 blocked 时才顺带透出 Shizuku 的 guidance）。现在读 `shizukuStatus()`，
 *    虚拟屏状态另起一行、名字也改对。
 *  - **两个入口**：左「下载 Shizuku」右「打开 Shizuku」，并列半行宽；**未安装时「打开 Shizuku」不可点**
 *    （旧态是「模型让用户去设置页安装、启动并授权 Shizuku」，而那一页一个入口都没有——死循环）。
 *  - **两个外链共用一条壳侧通道**：下载页与视频教程都只是跳出去，页面只传 key，URL 表在壳侧
 *    （`ExternalLinks`），页面拿不到「打开任意地址」的能力。
 *  - **授权只能由用户在 Shizuku 内完成**（被提权方不得自改授权），壳侧只负责把人送到界面；
 *    回到本页每 2 秒轮询一次状态，授权完成会自动收敛，不需要用户手动点刷新。
 */
import { useCallback, useEffect, useState } from 'react';
import { useShellState } from "../mobile/use-shell-state.js";
import { describeCallReason } from "../user-copy.js";
const SCOPES = ['virtual-only', 'real-only', 'all'];
const SCALE_OPTIONS = [0.5, 0.75, 1];
/** 外链 key（与壳侧 `ExternalLinks` 的登记名逐字一致）。 */
const LINK_DOWNLOAD = 'shizuku-download';
const LINK_TUTORIAL = 'shizuku-tutorial';
const STATUS_LABEL = {
    disabled: '已关闭',
    blocked: '需要准备',
    ready: '可创建',
    active: '已激活',
};
const A11Y_UNREADABLE = {
    readable: false,
    enabled: false,
    hint: '',
    restrictedSettingsApplies: false,
};
const SHIZUKU_UNREADABLE = {
    readable: false,
    installed: false,
    running: false,
    granted: false,
    bound: false,
    binding: false,
    guidance: '',
};
const ROOT_GRANT_UNREADABLE = {
    readable: false,
    granted: false,
    consentValid: false,
    channelUid: -1,
    channelRoot: false,
    rootGranted: false,
    rootState: 'unknown',
    honesty: '',
};
const OWNERSHIP_UNREADABLE = {
    readable: false, running: false, overdue: false, startedAt: 0, completedAt: 0, result: undefined,
};
function readOwnershipState(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        return OWNERSHIP_UNREADABLE;
    const parsed = value;
    if (typeof parsed.running !== 'boolean')
        return OWNERSHIP_UNREADABLE;
    const count = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
    const result = parsed.result !== null && typeof parsed.result === 'object' && !Array.isArray(parsed.result)
        ? parsed.result : undefined;
    return { readable: true, running: parsed.running, overdue: parsed.overdue === true,
        startedAt: count(parsed.startedAt), completedAt: count(parsed.completedAt),
        operation: typeof parsed.operation === 'string' ? parsed.operation : undefined, result };
}
/** Submitted/running/unknown results must never be rendered as completed repair. */
export function describeOwnershipRepair(state) {
    if (!state.readable || state.startedAt === 0)
        return undefined;
    if (state.running)
        return { ok: state.overdue ? false : undefined,
            text: state.overdue ? '特权工作结果仍不明，已暂停新派发和维护；不要重复操作。无法确认 helper 结算时请重启设备（仅重启应用不算结算）。'
                : state.operation !== undefined && !state.operation.includes('ownership')
                    ? '正在等待已有特权工作结算，尚未开始文件属主维护。'
                    : '属主维护进行中，正在有界检查本应用数据目录；结果会自动刷新。' };
    const result = state.result;
    if (result === undefined)
        return { ok: false, text: '属主维护结果不可读，不能确认修复完成；请复制诊断日志。' };
    if (result.skipped === 'no-root-path')
        return { ok: true, text: '当前没有可用 root 修复路径，未执行属主变更。' };
    const count = (key) => typeof result[key] === 'number' && Number.isFinite(result[key])
        && result[key] >= 0 ? String(result[key]) : '未知';
    const counts = '检查 ' + count('checked') + ' 项 / 修复 ' + count('healed') + ' 项 / 失败 ' + count('failures') + ' 项';
    const completeCounts = ['checked', 'healed'].every(key => typeof result[key] === 'number'
        && Number.isSafeInteger(result[key]) && result[key] >= 0);
    if (result.ok === true && completeCounts && result.truncated === false && result.deadlineExceeded === false
        && result.remaining === 0 && result.unverifiedMutations === 0 && result.failures === 0) {
        return { ok: true, text: '文件属主维护完成（' + counts + '）；未进行 SELinux 重标记。' };
    }
    const reason = typeof result.reason === 'string' ? result.reason : typeof result.code === 'string' ? result.code : undefined;
    return { ok: false, text: '文件属主维护未完成（' + counts + '）：' + describeCallReason(reason) };
}
const ROOT_ACCESS_UNREADABLE = {
    readable: false,
    suExists: false,
    state: 'unknown',
    uid: -1,
    granted: false,
    requesting: false,
    managerLabel: '',
    managerInstalled: false,
    guidance: '',
};
/** issue #262 用户指定文案（**逐字保留**，未 root 通道下的红字）。 */
export const ROOT_GRANT_NOT_ROOT_TEXT = '无法在未 root 的设备上赋予该权限';
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
export function shizukuStateLabel(status) {
    if (!status.readable)
        return '状态不可读';
    if (!status.installed)
        return '未安装';
    if (!status.running)
        return '已安装，Shizuku 未启动';
    if (!status.granted)
        return '已启动，尚未授权';
    if (!status.bound)
        return status.binding ? '已授权，通道建立中' : '已授权，通道未建立';
    return '通道就绪';
}
/** 壳侧 guidance 缺失时的兜底说明（每态都能说清「下一步做什么」）。 */
export function shizukuStepHint(status) {
    if (!status.readable)
        return '读不到 Shizuku 状态：壳侧桥未装配或解析失败。';
    if (!status.installed)
        return '点「下载 Shizuku」到发布页装好，再回来点「打开 Shizuku」。';
    if (!status.running)
        return '点「打开 Shizuku」，在应用内按提示用无线调试启动它（重启设备后需要重做一次）。';
    if (!status.granted)
        return '点「打开 Shizuku」，在里面允许本应用使用 Shizuku——授权只能由你亲手完成。';
    if (!status.bound)
        return '状态每 2 秒自动刷新，稍等即可；一直停在这里可以点「打开 Shizuku」重进一次。';
    return '特权通道已就绪，虚拟屏与特权 shell 可以用了。';
}
export function parseRootReply(raw) {
    if (!raw)
        return undefined;
    try {
        const value = JSON.parse(raw);
        return value !== null && typeof value === 'object' && !Array.isArray(value)
            ? value : undefined;
    }
    catch {
        return undefined;
    }
}
function parseAnswer(raw) {
    if (raw === undefined || raw === '')
        return undefined;
    try {
        return JSON.parse(raw);
    }
    catch {
        return undefined;
    }
}
/** 外链/拉起类调用统一结算：成功给人话，失败给「原因 + 下一步」，绝不静默。 */
export function settleLinkCall(raw, okText, failLead) {
    const answer = parseAnswer(raw);
    if (answer?.ok === true)
        return { ok: true, text: okText };
    return { ok: false, text: failLead + '：' + describeCallReason(answer?.reason) };
}
/** 受限设置解锁结算（壳侧回 `{ok, message}`，message 已是人话）。 */
export function settleUnlockCall(raw) {
    const answer = parseAnswer(raw);
    if (answer?.ok === true) {
        return { ok: true, text: answer.message ?? '已解锁受限设置，现在可以回系统页开启无障碍服务。' };
    }
    return {
        ok: false,
        text: '解锁失败：' + (answer?.message ?? describeCallReason(answer?.reason)),
    };
}
function readScope() {
    try {
        const raw = window.androidBridge?.getScreenScope?.();
        if (SCOPES.includes(raw))
            return raw;
    }
    catch {
        /* old/desktop shells retain the safe default */
    }
    return 'virtual-only';
}
function readVdisplay() {
    try {
        const raw = window.androidBridge?.vdisplayStatus?.();
        const parsed = raw ? JSON.parse(raw) : undefined;
        const state = parsed?.state;
        return {
            state: state === 'disabled' || state === 'blocked' || state === 'ready' || state === 'active' ? state : 'blocked',
            code: typeof parsed?.code === 'string' ? parsed.code : 'vdisplay-status-unavailable',
            guidance: typeof parsed?.guidance === 'string' ? parsed.guidance : '虚拟屏状态暂不可读；不会把虚拟屏请求回退到真实屏幕。',
            ...(typeof parsed?.displayId === 'number' ? { displayId: parsed.displayId } : {}),
        };
    }
    catch {
        // P3-6：旧文案是「虚拟屏状态读取失败（fail-closed）。」——`fail-closed` 是内部策略词，
        // 对用户没有意义；这里说清「读不到 + 不会做什么 + 能做什么」，策略词只留在 code 里。
        return { state: 'blocked', code: 'vdisplay-status-unavailable', guidance: '读不到虚拟屏状态：应用内桥未接好或解析失败。重新打开应用再试；读不到时不会把虚拟屏请求回退到真实屏幕。' };
    }
}
function readScale() {
    try {
        const value = window.androidBridge?.getVdisplayScale?.();
        if (typeof value === 'number' && Number.isFinite(value))
            return value;
    }
    catch {
        /* fall through to the default tier */
    }
    return 0.75;
}
function readFloat() {
    try {
        return window.androidBridge?.getVdisplayFloatEnabled?.() ?? true;
    }
    catch {
        return true;
    }
}
/**
 * Shizuku 通道状态（**唯一**「装没装」的事实来源）。
 *
 * `installed` 字段决定「打开 Shizuku」是否可点：拿不到状态时按**未安装**处理（复用
 * [SHIZUKU_UNREADABLE]），于是按钮不可点而不是点了没反应——死路形态在本页被结构性排除。
 */
export function readShizuku() {
    try {
        const raw = window.androidBridge?.shizukuStatus?.();
        const parsed = parseRootReply(raw);
        if (parsed === undefined || typeof parsed.installed !== 'boolean')
            return SHIZUKU_UNREADABLE;
        return {
            readable: true,
            installed: parsed.installed === true,
            running: parsed.running === true,
            granted: parsed.granted === true,
            bound: parsed.bound === true,
            binding: parsed.binding === true,
            guidance: typeof parsed.guidance === 'string' ? parsed.guidance : '',
        };
    }
    catch {
        return SHIZUKU_UNREADABLE;
    }
}
/**
 * issue #262「AI root 权限」读面（壳侧 [RootGrant.state] 的桥接）。
 *
 * 读不到一律回落 [ROOT_GRANT_UNREADABLE]（`readable:false`）：界面据此显示「状态不可读」
 * 而不是冒充「未授权」或「可开启」——与 [readShizuku] 同纪律。
 */
export function readRootGrant() {
    try {
        const raw = window.androidBridge?.rootGrantState?.();
        const parsed = parseRootReply(raw);
        if (parsed === undefined || typeof parsed.granted !== 'boolean')
            return ROOT_GRANT_UNREADABLE;
        return {
            readable: true,
            granted: parsed.granted === true,
            consentValid: parsed.consentValid === true,
            channelUid: typeof parsed.channelUid === 'number' ? parsed.channelUid : -1,
            channelRoot: parsed.channelRoot === true,
            rootGranted: parsed.rootGranted === true,
            rootState: typeof parsed.rootState === 'string' ? parsed.rootState : 'unknown',
            honesty: typeof parsed.honesty === 'string' ? parsed.honesty : '',
            ownership: readOwnershipState(parsed.ownership),
        };
    }
    catch {
        return ROOT_GRANT_UNREADABLE;
    }
}
/**
 * 应用级 root 授权读面（壳侧 [RootAccess.state] 的桥接）。
 *
 * 读不到一律回落 [ROOT_ACCESS_UNREADABLE]（`readable:false`）：界面据此显示「状态不可读」
 * 而不是冒充「未授权」或「已授权」——与 [readRootGrant] 同纪律。
 */
export function readRootAccess() {
    try {
        const raw = window.androidBridge?.rootAccessState?.();
        const parsed = parseRootReply(raw);
        if (parsed === undefined || typeof parsed.state !== 'string')
            return ROOT_ACCESS_UNREADABLE;
        const manager = (parsed.manager ?? {});
        return {
            readable: true,
            suExists: parsed.suExists === true,
            state: parsed.state,
            uid: typeof parsed.uid === 'number' ? parsed.uid : -1,
            granted: parsed.granted === true,
            requesting: parsed.requesting === true,
            managerLabel: typeof manager.label === 'string' ? manager.label : '',
            managerInstalled: manager.installed === true,
            guidance: typeof parsed.guidance === 'string' ? parsed.guidance : '',
        };
    }
    catch {
        return ROOT_ACCESS_UNREADABLE;
    }
}
/** 应用级 root 授权状态 → 中文状态词（与壳侧 RootAccess 的状态常量一一对应）。 */
export function rootAccessStateLabel(status) {
    if (!status.readable)
        return '状态不可读';
    switch (status.state) {
        case 'granted': return '已授权（uid 0）';
        case 'requesting': return '正在检测授权…';
        case 'denied': return '已拒绝';
        case 'timeout': return '检测超时，请在管理器确认后重试';
        case 'no-su': return '本机没有可用的 su';
        default: return '未检测';
    }
}
/** 请求按钮可否点：有 su 且没有请求在飞。 */
export function canRequestRoot(status) {
    return status.readable && status.suExists && !status.requesting;
}
/**
 * 开关状态 → 中文状态词（与壳侧字段一一对应，供测试直接断言）。
 *
 * 顺序即真实判据顺序：读不到 → 通道非 root（置灰）→ 未授权 → 已授权。
 */
export function rootGrantStateLabel(status) {
    if (!status.readable)
        return '状态不可读';
    if (!status.channelRoot && !status.rootGranted)
        return '没有可用 root 通道';
    if (!status.granted)
        return '未授权';
    return '已授权（AI 可用 root）';
}
/** 开关可否点击：只有**通道身份确为 root**才可点（读不到/非 root 一律不可点）。 */
export function canToggleRootGrant(status) {
    return status.readable && (status.channelRoot || status.rootGranted);
}
/** Shizuku 以 ADB（shell）身份启动时的通道 uid（issue #262 点名的分流判据）。 */
export const SHIZUKU_SHELL_UID = 2000;
/**
 * 非 root 通道下的引导语（issue #262 要求**按通道身份分流**，2026-09-30 对账补）：
 *  - 通道 uid == 2000（Shizuku 以 ADB 启动，设备**可能已 root**）⇒ 引导「在 Shizuku 内以 root 启动」；
 *  - 其它（无通道 / 未 root）⇒ 用户指定红字「无法在未 root 的设备上赋予该权限」（逐字）。
 *
 * 两者都置灰开关；区别只在**用户下一步该做什么**——把已 root 的设备误报成「未 root」会让人
 * 去折腾设备 root，而真正要做的是重启 Shizuku 的启动方式。
 */
export function rootGrantChannelHint(status) {
    if (!status.readable)
        return { text: '', kind: 'none' };
    if (status.channelRoot)
        return { text: '', kind: 'none' };
    if (status.channelUid === SHIZUKU_SHELL_UID) {
        return {
            text: 'Shizuku 当前以 shell（uid 2000）身份运行——请在 Shizuku 内以 root 启动它，再回到本页开启。',
            kind: 'shell-identity',
        };
    }
    return { text: ROOT_GRANT_NOT_ROOT_TEXT, kind: 'not-root' };
}
/** 无障碍通道状态；读不到时如实报不可读，不冒充「未开启」（0.14.1 UI 审查 P1）。 */
export function readA11y() {
    try {
        const raw = window.androidBridge?.a11yStatus?.();
        if (typeof raw === 'string' && raw.startsWith('{')) {
            const parsed = JSON.parse(raw);
            return {
                readable: true,
                enabled: parsed.enabled === true,
                hint: typeof parsed.hint === 'string' ? parsed.hint : '',
                restrictedSettingsApplies: parsed.restrictedSettingsApplies === true,
            };
        }
    }
    catch {
        /* bridge absent: report unavailable rather than guessing */
    }
    return A11Y_UNREADABLE;
}
/**
 * 渲染「手机控制」设置分区。
 * @returns 分区元素树。
 */
export function PhoneControlSection(_props) {
    const [scope, refreshScope] = useShellState(readScope);
    const [vdisplay, refreshVdisplay] = useShellState(readVdisplay, { pollMs: 2_000 });
    const [shizuku, refreshShizuku] = useShellState(readShizuku, { pollMs: 2_000 });
    const [scale, refreshScale] = useShellState(readScale);
    const [floatOn, refreshFloat] = useShellState(readFloat);
    const [a11y, refreshA11y] = useShellState(readA11y, { pollMs: 3_000 });
    // issue #262：root 授权面（2s 轮询与 Shizuku 面同拍——开关资格取决于通道身份，二者必须同源同拍）。
    const [rootGrant, refreshRootGrant] = useShellState(readRootGrant, { pollMs: 2_000 });
    // 2026-09-30 主人定例：应用级 root 授权面（2s 同拍——开关资格与授权状态必须同源同拍）。
    const [rootAccess, refreshRootAccess] = useShellState(readRootAccess, { pollMs: 2_000 });
    /** 用户尝试开启开关但 root 未授权：壳侧已弹授权框，授权一到就自动续开（见下方 effect）。 */
    const [pendingEnable, setPendingEnable] = useState(false);
    const [rootMsg, setRootMsg] = useState(null);
    const [rootOk, setRootOk] = useState(null);
    const [confirmStage, setConfirmStage] = useState(0);
    // 失败回执带 `code`：码只进 `data-code`（可 grep / 可截图给维护方），不进正文（P3-1/P3-6）。
    const [forceMsg, setForceMsg] = useState(null);
    const [shizukuMsg, setShizukuMsg] = useState(null);
    const [shizukuOk, setShizukuOk] = useState(null);
    const [a11yMsg, setA11yMsg] = useState(null);
    const [a11yOk, setA11yOk] = useState(null);
    // 三连点确认：4 秒内没有下一步就复位，避免「隔很久点一下」误触。
    useEffect(() => {
        if (confirmStage === 0)
            return undefined;
        const timer = window.setTimeout(() => setConfirmStage(0), 4_000);
        return () => window.clearTimeout(timer);
    }, [confirmStage]);
    const setScope = useCallback((next) => {
        try {
            window.androidBridge?.setScreenScope?.(next);
        }
        catch { /* readback keeps the truth */ }
        refreshScope();
    }, [refreshScope]);
    const setScale = useCallback((next) => {
        try {
            window.androidBridge?.setVdisplayScale?.(next);
        }
        catch { /* readback keeps the truth */ }
        refreshScale();
    }, [refreshScale]);
    const setFloat = useCallback((enable) => {
        try {
            window.androidBridge?.setVdisplayFloatEnabled?.(enable);
        }
        catch { /* readback keeps the truth */ }
        refreshFloat();
    }, [refreshFloat]);
    const openA11y = useCallback(() => {
        try {
            window.androidBridge?.openA11ySettings?.();
        }
        catch { /* bridge absent on desktop */ }
    }, []);
    const unlockA11y = useCallback(() => {
        let raw;
        try {
            raw = window.androidBridge?.unlockRestrictedSettings?.();
        }
        catch {
            raw = undefined;
        }
        const settled = settleUnlockCall(raw);
        setA11yOk(settled.ok);
        setA11yMsg(settled.text);
        refreshA11y();
    }, [refreshA11y]);
    /** 外链与拉起的共同收口（两个入口共用一条通道，结算也共用）。 */
    const runShizukuAction = useCallback((call, okText, failLead) => {
        let raw;
        try {
            raw = call?.();
        }
        catch {
            raw = undefined;
        }
        const settled = settleLinkCall(raw, okText, failLead);
        setShizukuOk(settled.ok);
        setShizukuMsg(settled.text);
        refreshShizuku();
    }, [refreshShizuku]);
    const downloadShizuku = useCallback(() => {
        runShizukuAction(window.androidBridge?.openExternalLink
            ? () => window.androidBridge.openExternalLink(LINK_DOWNLOAD)
            : undefined, '已打开 Shizuku 发布页——下载 release 版 APK 装好后回到这里。', '打开下载页失败');
    }, [runShizukuAction]);
    const tutorialShizuku = useCallback(() => {
        runShizukuAction(window.androidBridge?.openExternalLink
            ? () => window.androidBridge.openExternalLink(LINK_TUTORIAL)
            : undefined, '已用浏览器打开视频教程。', '打开教程失败');
    }, [runShizukuAction]);
    const openShizuku = useCallback(() => {
        runShizukuAction(window.androidBridge?.openShizukuManager
            ? () => window.androidBridge.openShizukuManager()
            : undefined, '已打开 Shizuku——在那里启动并授权后，回到本页状态会自动刷新。', '打开 Shizuku 失败');
    }, [runShizukuAction]);
    /**
     * 2026-09-30：**显式请求 Shizuku 授权**。
     *
     * 实测缺陷：授权请求此前只在 `ensureBound` 的后台路径自动发起，而 Shizuku 的
     * `requestPermission` 需要前台 Activity 才能把对话框落到用户眼前 ⇒ 静默失败，
     * 管理器「应用管理」列表里根本没有本应用、状态恒 denied，用户没有任何可点的授权入口。
     * 本入口在 UI 线程发起请求，对话框随即出现。
     */
    const requestShizukuPermission = useCallback(() => {
        runShizukuAction(window.androidBridge?.requestShizukuPermission
            ? () => window.androidBridge.requestShizukuPermission()
            : undefined, '已发起 Shizuku 授权请求——请在弹窗上点「允许」（本页每 2 秒自动刷新）。', '请求 Shizuku 授权失败');
    }, [runShizukuAction]);
    /**
     * 「重置链接」：强制移除 Shizuku 侧 UserService 并清空绑定态。
     *
     * 与「刷新状态」同一行（都是非破坏性只读/自愈动作），结算沿用既有 [runShizukuAction] →
     * [settleLinkCall]，**不新造结算口径**：壳侧回 {ok, code/guidance}，ok=false 走失败支并把人话原因说清。
     *
     * 「持续扫描链接」= 既有的 2 秒轮询（[runShizukuAction] 内部已调 refreshShizuku 立刻回读一次，
     * 之后交给 useShellState 的 2s 轮询自然收敛）。**不新开定时器**：新增常驻轮询=新增常驻 CPU，
     * 与 T1（dsh-model-capability 每 5s 全量 describe 造成 24-26% CPU）同族，明确禁止。
     */
    const resetShizuku = useCallback(() => {
        runShizukuAction(window.androidBridge?.resetShizukuConnection
            ? () => window.androidBridge.resetShizukuConnection()
            : undefined, '已重置 Shizuku 连接，正在重新建立通道（本页每 2 秒自动重扫）。', '重置 Shizuku 连接失败');
    }, [runShizukuAction]);
    /**
     * issue #262：root 授权面三个动作（开关 / 「已阅读」确认 / 免责声明）的共同收口。
     *
     * 结算口径沿用 [settleLinkCall]（壳侧回 {ok, code/guidance}），写后立刻 [refreshRootGrant] 回读——
     * 不新造结算口径、不新开定时器（2s 轮询已由 useShellState 承担）。
     */
    const runRootAction = useCallback((call, okText, failLead, preRaw) => {
        let raw = preRaw;
        if (raw === undefined) {
            try {
                raw = call?.();
            }
            catch {
                raw = undefined;
            }
        }
        const settled = settleLinkCall(raw, okText, failLead);
        setRootOk(settled.ok);
        setRootMsg(settled.text);
        refreshRootGrant();
        refreshRootAccess();
    }, [refreshRootGrant, refreshRootAccess]);
    const toggleRootGrant = useCallback((next) => {
        // 尝试开启 ⇒ 记 pending：若壳侧因「root 未授权」拦下并弹出授权框，授权一到自动续开。
        setPendingEnable(false);
        let raw;
        try {
            raw = window.androidBridge?.setRootGranted ? window.androidBridge.setRootGranted(next) : undefined;
        }
        catch {
            raw = undefined;
        }
        // 「请求已发起」不是失败（2026-09-30 复核补）：壳侧在被第三道门拦下时当场弹授权框并回
        // `code=request-started`——渲染成「进行中」，否则用户先看到红字「开启失败」、2 秒后开关
        // 又自己开起来（提示与实际结果自相矛盾）。
        const parsed = parseRootReply(raw);
        if (next && parsed?.code === 'request-started') {
            setPendingEnable(true);
            setRootOk(true);
            setRootMsg('正在检测 root 授权。若没有弹窗，请在你使用的 Root 管理器中允许本应用；授权后会继续本次开启操作。');
            refreshRootGrant();
            refreshRootAccess();
            return;
        }
        runRootAction(undefined, next
            ? '已开启 AI root 权限：特权通道按 root 身份执行，请在需要时使用、用完即关。'
            : '已关闭 AI root 权限：特权通道已恢复整体拒绝。', next ? '开启 AI root 权限失败' : '关闭 AI root 权限失败', raw);
    }, [runRootAction, refreshRootGrant, refreshRootAccess]);
    /**
     * 检测 / 尝试获取 root 授权（壳侧后台跑一次 `su -c id`；本页 2s 轮询看到结果）。
     *
     * ★口径（2026-09-30 主人指正）：**多数 Root 管理器不再自动弹授权框**（除 Magisk 外，
     * 用户得自己打开管理器授予）✗ ⇒ 文案**不承诺"会弹窗"**，只承诺"取一次真实身份并如实回报" ✓。
     */
    const requestRoot = useCallback(() => {
        runRootAction(window.androidBridge?.requestRootAccess
            ? () => window.androidBridge.requestRootAccess()
            : undefined, '已发起 root 授权检测，结果会自动刷新；检测成功不代表 AI root 开关已开启。', '检测 root 授权未通过');
        refreshRootAccess();
    }, [runRootAction, refreshRootAccess]);
    const [repairReply, setRepairReply] = useState();
    const [repairFailure, setRepairFailure] = useState();
    const polledRepair = rootGrant.ownership ?? OWNERSHIP_UNREADABLE;
    const repairState = polledRepair.readable && polledRepair.startedAt >= (repairReply?.startedAt ?? 0)
        ? polledRepair : repairReply ?? polledRepair;
    const repairFeedback = repairFailure === undefined ? describeOwnershipRepair(repairState) : { ok: false, text: repairFailure };
    /** Native request is asynchronous and single-flight; only later native result counts as completed. */
    const repairOwnership = useCallback(() => {
        let raw;
        try {
            raw = window.androidBridge?.repairRootOwnership?.();
        }
        catch {
            raw = undefined;
        }
        const parsed = parseRootReply(raw);
        const observed = readOwnershipState(parsed);
        if (parsed?.ok === true && (parsed.code === 'repair-started' || parsed.code === 'repair-running')
            && observed.readable && observed.startedAt > 0
            && (observed.running || (observed.completedAt >= observed.startedAt && observed.result !== undefined))) {
            setRepairReply(observed);
            setRepairFailure(undefined);
        }
        else {
            setRepairFailure('启动文件属主维护失败：' + describeCallReason(typeof parsed?.reason === 'string' ? parsed.reason : undefined));
        }
        refreshRootGrant();
    }, [refreshRootGrant]);
    /**
     * 自动续开（2026-09-30 主人定例的体验闭环）：用户开开关 → 壳侧因「root 未授权」拦下并
     * **弹出授权框** → 用户点「允许」→ 本页 2s 轮询看到 `rootAccess.granted` → 自动把开关续开。
     * 用户只需点一次开关 + 在弹窗上点一次「允许」，不必回设置页再点一次。
     */
    useEffect(() => {
        if (!pendingEnable)
            return;
        if (!rootGrant.consentValid || ['denied', 'timeout', 'no-su'].includes(rootAccess.state)) {
            setPendingEnable(false);
            return;
        }
        if (rootGrant.granted) {
            setPendingEnable(false);
            return;
        }
        if (rootAccess.granted) {
            setPendingEnable(false);
            toggleRootGrant(true);
        }
    }, [pendingEnable, rootGrant.granted, rootGrant.consentValid, rootAccess.granted, rootAccess.state, toggleRootGrant]);
    const toggleRootConsent = useCallback((next) => {
        runRootAction(window.androidBridge?.setRootConsent
            ? () => window.androidBridge.setRootConsent(next)
            : undefined, next
            ? '已记录「已阅读」——与当前版本绑定，升级后需重新确认。'
            : '已撤销同意，并同时关闭了 AI root 权限。', next ? '记录「已阅读」失败' : '撤销同意失败');
    }, [runRootAction]);
    const openRootDisclaimer = useCallback(() => {
        runRootAction(window.androidBridge?.openRootDisclaimer
            ? () => window.androidBridge.openRootDisclaimer()
            : undefined, '已打开免责声明（APK 内置文档，离线可读）。', '打开免责声明失败');
    }, [runRootAction]);
    const tapForce = useCallback(() => {
        const next = confirmStage + 1;
        if (next < 3) {
            setConfirmStage(next);
            setForceMsg(null);
            return;
        }
        setConfirmStage(0);
        try {
            const raw = window.androidBridge?.forceDestroyVdisplay?.();
            const parsed = raw ? JSON.parse(raw) : undefined;
            const ok = parsed?.ok === true;
            setForceMsg(ok
                ? { ok: true, text: '已强制销毁全部虚拟屏。' }
                : { ok: false, text: '销毁失败：' + describeCallReason(parsed?.code), code: String(parsed?.code ?? 'unknown') });
        }
        catch {
            setForceMsg({ ok: false, text: '销毁调用失败（应用内桥不可用）——请重新打开应用后重试。', code: 'bridge-threw' });
        }
        refreshVdisplay();
    }, [confirmStage, refreshVdisplay]);
    const forceLabel = confirmStage === 0
        ? '强制销毁虚拟屏'
        : '再次点击确认（' + confirmStage + '/3）';
    // P5-5：进入确认态后必须给**取消途径**。旧实现没有任何退出通道——误点一下就只能
    // 「再点两下把它执行掉」或者等 4 秒超时（超时不可见，用户并不知道自己还能等）。
    const forceArmed = confirmStage > 0;
    const cancelForce = useCallback(() => {
        setConfirmStage(0);
        setForceMsg(null);
    }, []);
    // 「打开 Shizuku」的可点条件：只有**确知已安装**才可点（读不到状态时按未安装处理）。
    const canOpenShizuku = shizuku.readable && shizuku.installed;
    return (_jsxs("section", { className: "dsh-screen-control-card", "aria-labelledby": "dsh-phone-control-title", ...(vdisplay.displayId === undefined ? {} : { 'data-display-id': String(vdisplay.displayId) }), children: [_jsxs("header", { className: "dsh-screen-control-header", children: [_jsxs("span", { children: [_jsx("strong", { id: "dsh-phone-control-title", children: "\u624B\u673A\u63A7\u5236" }), _jsx("small", { children: "\u5C4F\u5E55\u4E0E\u7279\u6743\u901A\u9053\u7684\u6388\u6743\u9762\uFF1B\u6A21\u578B\u4E0D\u80FD\u81EA\u884C\u66F4\u6539\u8FD9\u91CC\u7684\u4EFB\u4F55\u8BBE\u7F6E\u3002" })] }), _jsx("span", { className: "dsh-screen-control-state", "data-state": vdisplay.state, children: STATUS_LABEL[vdisplay.state] })] }), vdisplay.guidance !== shizuku.guidance ? (_jsx("p", { className: "dsh-dev-hint", children: vdisplay.guidance })) : null, _jsxs("div", { className: "dsh-screen-control-detail", children: [_jsx("strong", { children: "Shizuku \u7279\u6743\u901A\u9053" }), _jsx("span", { "data-code": shizuku.readable ? undefined : 'shizuku-status-unreadable', children: shizukuStateLabel(shizuku) })] }), _jsx("p", { className: "dsh-dev-hint", children: shizuku.guidance !== '' ? shizuku.guidance : shizukuStepHint(shizuku) }), _jsxs("div", { className: "dsh-dev-row dsh-dev-split", children: [_jsx("button", { type: "button", className: "dsh-dev-btn", onClick: downloadShizuku, children: "\u4E0B\u8F7D Shizuku" }), _jsx("button", { type: "button", className: "dsh-dev-btn", disabled: !canOpenShizuku, onClick: openShizuku, children: "\u6253\u5F00 Shizuku" })] }), _jsx("p", { className: "dsh-dev-hint", children: "\u4E24\u4E2A\u5165\u53E3\u90FD\u4F1A\u8DF3\u5230\u5E94\u7528\u5916\uFF08\u7CFB\u7EDF\u6D4F\u89C8\u5668 / Shizuku \u5E94\u7528\uFF09\u3002\u88C5\u597D\u5E76\u6388\u6743\u540E\u56DE\u5230\u672C\u9875\u5373\u53EF\u2014\u2014 \u72B6\u6001\u6BCF 2 \u79D2\u81EA\u52A8\u5237\u65B0\uFF0C\u4E0D\u9700\u8981\u624B\u52A8\u64CD\u4F5C\u3002\u6388\u6743\u53EA\u80FD\u5728 Shizuku \u5185\u7531\u4F60\u4EB2\u624B\u5B8C\u6210\u3002" }), _jsxs("div", { className: "dsh-dev-row", children: [_jsx("button", { type: "button", className: "dsh-dev-link", onClick: tutorialShizuku, children: "\u70B9\u51FB\u67E5\u770B\u6559\u7A0B" }), _jsx("button", { type: "button", className: "dsh-dev-btn", onClick: refreshShizuku, children: "\u5237\u65B0\u72B6\u6001" }), _jsx("button", { type: "button", className: "dsh-dev-btn", onClick: resetShizuku, children: "\u91CD\u7F6E\u94FE\u63A5" })] }), shizuku.granted ? null : (_jsxs("div", { className: "dsh-dev-row", children: [_jsx("button", { type: "button", className: "dsh-dev-btn", disabled: !shizuku.readable || !shizuku.running, onClick: requestShizukuPermission, children: "\u8BF7\u6C42 Shizuku \u6388\u6743" }), _jsx("span", { className: "dsh-dev-hint", children: "\u6388\u6743\u6846\u9700\u8981\u524D\u53F0\u754C\u9762\u624D\u80FD\u5F39\u51FA\u2014\u2014\u540E\u53F0\u81EA\u52A8\u8BF7\u6C42\u4F1A\u9759\u9ED8\u5931\u8D25\uFF08\u7BA1\u7406\u5668\u91CC\u4F1A\u770B\u4E0D\u5230\u672C\u5E94\u7528\uFF09\u3002" })] })), shizukuMsg === null ? null : (_jsx("p", { className: shizukuOk === true ? 'dsh-dev-hint' : 'dsh-dev-error', children: shizukuMsg })), _jsxs("section", { className: "dsh-root-access-card", "aria-label": "Root \u6743\u9650\u8BBE\u7F6E", children: [_jsxs("div", { className: "dsh-screen-control-header", children: [_jsxs("span", { children: [_jsx("strong", { children: "Root \u6743\u9650" }), _jsx("small", { children: "\u5148\u786E\u8BA4\u53EF\u7528\u901A\u9053\uFF0C\u518D\u51B3\u5B9A\u662F\u5426\u5141\u8BB8 AI \u4F7F\u7528\u3002" })] }), _jsx("span", { className: "dsh-screen-control-state", "data-state": rootGrant.granted ? 'active' : 'disabled', children: rootGrant.granted ? 'AI 已开启' : 'AI 未开启' })] }), _jsxs("div", { className: "dsh-root-step", children: [_jsxs("div", { className: "dsh-screen-control-detail", children: [_jsx("strong", { children: "1. \u5E94\u7528 root \u6388\u6743" }), _jsx("span", { "data-code": rootAccess.readable ? rootAccess.state : 'root-access-unreadable', children: rootAccessStateLabel(rootAccess) })] }), _jsx("p", { className: "dsh-dev-hint", children: rootAccess.guidance || '检测应用的 su 授权；Shizuku 已以 root 启动时，也可直接使用该通道。' }), _jsx("button", { type: "button", className: "dsh-dev-btn", disabled: !canRequestRoot(rootAccess), onClick: requestRoot, children: rootAccess.requesting ? '正在检测…' : '检测 root 授权' }), rootAccess.managerInstalled ? (_jsxs("p", { className: "dsh-dev-hint", children: ["Root \u7BA1\u7406\u5668\uFF1A", rootAccess.managerLabel, "\u3002\u8BF7\u5728\u7BA1\u7406\u5668\u4E2D\u5141\u8BB8\u672C\u5E94\u7528\uFF0C\u518D\u56DE\u5230\u8FD9\u91CC\u68C0\u6D4B\u3002"] })) : null] }), _jsxs("div", { className: "dsh-root-step", children: [_jsxs("div", { className: "dsh-screen-control-detail", children: [_jsx("strong", { children: "2. AI root \u6743\u9650" }), _jsx("span", { "data-code": rootGrant.readable ? undefined : 'root-grant-unreadable', children: rootGrantStateLabel(rootGrant) })] }), !rootGrant.readable ? (_jsx("p", { className: "dsh-dev-error", children: "\u6388\u6743\u72B6\u6001\u4E0D\u53EF\u8BFB\u3002\u91CD\u65B0\u6253\u5F00\u5E94\u7528\u518D\u8BD5\uFF1B\u8BFB\u4E0D\u5230\u65F6\u4E0D\u4F1A\u5141\u8BB8 AI \u4F7F\u7528 root\u3002" })) : !rootGrant.channelRoot && !rootGrant.rootGranted ? (_jsx("p", { className: rootGrantChannelHint(rootGrant).kind === 'shell-identity' ? 'dsh-dev-hint' : 'dsh-dev-error', "data-code": rootGrantChannelHint(rootGrant).kind === 'shell-identity' ? 'shizuku-shell-identity' : 'not-root-channel', children: rootGrantChannelHint(rootGrant).text })) : (_jsxs("p", { className: "dsh-dev-hint", children: ["\u53EF\u7528\u901A\u9053\uFF1A", rootGrant.channelRoot ? 'Shizuku root' : '应用 su root', "\u3002\u5E94\u7528\u83B7\u5F97\u6388\u6743\u4E0D\u7B49\u4E8E\u5DF2\u5141\u8BB8 AI \u4F7F\u7528\u3002"] })), _jsx("button", { type: "button", className: "dsh-dev-link", onClick: openRootDisclaimer, children: "\u9605\u8BFB\u300AAI root \u6743\u9650\u514D\u8D23\u58F0\u660E\u300B" }), _jsxs("label", { className: "dsh-screen-scope-row dsh-root-toggle-row", children: [_jsxs("span", { children: [_jsx("strong", { children: "\u5DF2\u9605\u8BFB\u514D\u8D23\u58F0\u660E" }), _jsx("small", { children: "\u7406\u89E3 root \u64CD\u4F5C\u53EF\u80FD\u4FEE\u6539\u6216\u5220\u9664\u7CFB\u7EDF\u4E0E\u4E2A\u4EBA\u6570\u636E\uFF0C\u5E76\u613F\u610F\u627F\u62C5\u76F8\u5E94\u98CE\u9669\u3002\u5347\u7EA7\u540E\u9700\u91CD\u65B0\u786E\u8BA4\uFF1B\u64A4\u9500\u540C\u610F\u4F1A\u540C\u65F6\u5173\u95ED AI \u5F00\u5173\u3002" })] }), _jsx("input", { type: "checkbox", "aria-label": "\u5DF2\u9605\u8BFB\u514D\u8D23\u58F0\u660E", checked: rootGrant.consentValid, disabled: !rootGrant.readable, onChange: (event) => toggleRootConsent(event.target.checked) })] }), _jsxs("label", { className: "dsh-screen-scope-row dsh-root-toggle-row", children: [_jsxs("span", { children: [_jsx("strong", { children: "\u6388\u6743 AI \u4F7F\u7528 root" }), _jsx("small", { children: rootGrant.honesty || '这是策略与知情同意开关，不是技术沙箱。关闭后 AI 的 root 执行路径会被拒绝。' })] }), _jsx("input", { type: "checkbox", role: "switch", "aria-label": "\u6388\u6743 AI \u4F7F\u7528 root", checked: rootGrant.granted, disabled: !rootGrant.readable || (!rootGrant.granted && (!canToggleRootGrant(rootGrant) || !rootGrant.consentValid)), onChange: (event) => toggleRootGrant(event.target.checked) })] }), rootGrant.readable && canToggleRootGrant(rootGrant) && !rootGrant.consentValid ? (_jsx("p", { className: "dsh-dev-hint", children: "\u8BF7\u5148\u9605\u8BFB\u5E76\u786E\u8BA4\u514D\u8D23\u58F0\u660E\uFF0C\u624D\u80FD\u5F00\u542F AI root \u6743\u9650\u3002" })) : null, rootMsg === null ? null : (_jsx("p", { role: "status", "aria-live": "polite", className: rootOk === true ? 'dsh-dev-hint' : 'dsh-dev-error', children: rootMsg }))] }), _jsxs("details", { className: "dsh-root-maintenance", children: [_jsx("summary", { children: "\u6587\u4EF6\u5C5E\u4E3B\u7EF4\u62A4" }), _jsx("p", { className: "dsh-dev-hint", children: "root \u5199\u76D8\u540E\u5E94\u7528\u65E0\u6CD5\u8BFB\u53D6\u6587\u4EF6\u65F6\u4F7F\u7528\u3002\u4EC5\u4FEE\u590D\u672C\u5E94\u7528\u6570\u636E\u76EE\u5F55\uFF0C\u4E0D\u6539\u53D8 AI \u6388\u6743\u3002" }), _jsx("button", { type: "button", className: "dsh-dev-btn", disabled: repairState.running || (!rootAccess.granted && !rootGrant.channelRoot), onClick: repairOwnership, children: repairState.running ? '属主维护进行中' : '修复文件属主' }), repairFeedback === undefined ? null : (_jsx("p", { role: "status", "aria-live": "polite", className: repairFeedback.ok === false ? 'dsh-dev-error' : 'dsh-dev-hint', children: repairFeedback.text }))] })] }), _jsxs("label", { className: "dsh-screen-scope-row", children: [_jsxs("span", { children: [_jsx("strong", { children: "\u5F00\u653E\u5C4F\u5E55\u8303\u56F4" }), _jsx("small", { children: "\u9ED8\u8BA4\u4EC5\u865A\u62DF\u5C4F\u5E55\u3002\u771F\u5B9E\u5C4F\u5E55\u3001\u622A\u56FE\u4E0E\u63A7\u5236\u90FD\u9075\u5B88\u6B64\u8303\u56F4\u548C\u5B8C\u5168\u8BBF\u95EE\u6743\u9650\u3002" })] }), _jsxs("select", { "aria-label": "\u5F00\u653E\u5C4F\u5E55\u8303\u56F4", value: scope, onChange: (event) => setScope(event.target.value), children: [_jsx("option", { value: "virtual-only", children: "\u4EC5\u865A\u62DF\u5C4F\u5E55" }), _jsx("option", { value: "real-only", children: "\u4EC5\u771F\u5B9E\u5C4F\u5E55" }), _jsx("option", { value: "all", children: "\u5168\u90E8\u5F00\u653E" })] })] }), _jsxs("label", { className: "dsh-screen-scope-row", children: [_jsxs("span", { children: [_jsx("strong", { children: "\u865A\u62DF\u5C4F\u5206\u8FA8\u7387\u6863\u4F4D" }), _jsx("small", { children: "\u8DDF\u968F\u771F\u673A\u6BD4\u4F8B\u5E76\u540C\u6BD4\u4F8B\u7F29\u653E densityDpi\uFF08\u4E0B\u6B21\u5EFA\u5C4F\u751F\u6548\uFF1B\u9ED8\u8BA4 0.75\uFF0C\u66F4\u7701\u6027\u80FD\uFF09\u3002" })] }), _jsx("select", { "aria-label": "\u865A\u62DF\u5C4F\u5206\u8FA8\u7387\u6863\u4F4D", value: String(scale), onChange: (event) => setScale(Number(event.target.value)), children: SCALE_OPTIONS.map((option) => (_jsx("option", { value: String(option), children: option === 1 ? '原生' : String(Math.round(option * 100)) + '%' }, option))) })] }), _jsxs("label", { className: "dsh-screen-scope-row", children: [_jsxs("span", { children: [_jsx("strong", { children: "\u865A\u62DF\u5C4F\u6D6E\u7A97\uFF08\u9000\u540E\u53F0\u81EA\u52A8\u663E\u793A\uFF09" }), _jsx("small", { children: "\u53EA\u8BFB\u6D6E\u7A97\uFF1A\u5E94\u7528\u5207\u5230\u540E\u53F0\u65F6\u663E\u793A\u865A\u62DF\u5C4F\u753B\u9762\uFF1B\u524D\u53F0\u53EA\u5728\u4FA7\u680F\u53EF\u89C1\u3002\u4E0E\u5F00\u53D1\u8005\u9009\u9879\u91CC\u7684\u300C\u60AC\u6D6E\u7403\u300D\u4E0D\u662F\u540C\u4E00\u4E2A\u4E1C\u897F\uFF08\u90A3\u4E2A\u662F\u4EFB\u52A1\u9762\u677F\u5165\u53E3\uFF09\u3002" })] }), _jsx("input", { "aria-label": "\u865A\u62DF\u5C4F\u6D6E\u7A97\uFF08\u9000\u540E\u53F0\u81EA\u52A8\u663E\u793A\uFF09", type: "checkbox", checked: floatOn, onChange: (event) => setFloat(event.target.checked) })] }), _jsxs("div", { className: "dsh-screen-control-detail", children: [_jsx("strong", { children: "\u65E0\u969C\u788D\u901A\u9053" }), _jsx("span", { children: !a11y.readable
                            ? '状态不可读'
                            : (a11y.enabled ? '已开启（语义读取/点击/输入）' : '未开启（推荐开启）') }), a11y.hint !== '' ? _jsx("span", { children: a11y.hint }) : null] }), a11y.readable && !a11y.enabled && a11y.restrictedSettingsApplies ? (_jsx("p", { className: "dsh-dev-hint", children: "Android 13 \u53CA\u4EE5\u4E0A\u5BF9\u4FA7\u8F7D\u5E94\u7528\u9ED8\u8BA4\u5F00\u542F\u300C\u53D7\u9650\u8BBE\u7F6E\u300D\uFF1A\u7CFB\u7EDF\u9875\u91CC\u672C\u5E94\u7528\u7684\u5F00\u5173\u4F1A\u662F\u7070\u7684\u3002 \u5148\u70B9\u300C\u89E3\u9501\u53D7\u9650\u8BBE\u7F6E\u300D\uFF08\u7ECF Shizuku \u7279\u6743\u901A\u9053\uFF0C\u53EA\u5F71\u54CD\u672C\u5E94\u7528\u8FD9\u4E00\u9879\uFF09\uFF0C\u518D\u56DE\u53BB\u5F00\u542F\u3002" })) : null, _jsxs("div", { className: "dsh-dev-row", children: [_jsx("button", { type: "button", className: "dsh-dev-btn", onClick: openA11y, children: "\u53BB\u5F00\u542F\u65E0\u969C\u788D\u670D\u52A1" }), a11y.readable && !a11y.enabled && a11y.restrictedSettingsApplies ? (_jsx("button", { type: "button", className: "dsh-dev-btn", onClick: unlockA11y, children: "\u89E3\u9501\u53D7\u9650\u8BBE\u7F6E" })) : null] }), a11yMsg === null ? null : (_jsx("p", { className: a11yOk === true ? 'dsh-dev-hint' : 'dsh-dev-error', children: a11yMsg })), _jsxs("div", { className: "dsh-screen-control-detail", children: [_jsx("strong", { children: "\u5F3A\u5236\u9500\u6BC1\u865A\u62DF\u5C4F" }), _jsx("span", { children: "\u9500\u6BC1\u5168\u90E8\u865A\u62DF\u5C4F\u4E0E\u5176\u4E0A\u7684\u4EFB\u52A1\uFF08\u65E0\u89C6\u4F1A\u8BDD\u5F52\u5C5E\uFF09\uFF1B\u9700\u8FDE\u7EED\u70B9\u51FB\u4E09\u6B21\u786E\u8BA4\uFF0C\u70B9\u9519\u53EF\u53D6\u6D88\u3002" })] }), _jsxs("div", { className: "dsh-dev-row", children: [_jsx("button", { type: "button", className: forceArmed ? 'dsh-dev-btn dsh-dev-danger' : 'dsh-dev-btn', "data-stage": confirmStage, "data-armed": forceArmed ? 'true' : 'false', onClick: tapForce, children: forceLabel }), forceArmed ? (_jsx("button", { type: "button", className: "dsh-dev-link", onClick: cancelForce, children: "\u53D6\u6D88" })) : null] }), forceMsg === null ? null : (_jsx("p", { className: forceMsg.ok ? 'dsh-dev-hint' : 'dsh-dev-error', ...(forceMsg.code === undefined ? {} : { 'data-code': forceMsg.code }), children: forceMsg.text }))] }));
}
