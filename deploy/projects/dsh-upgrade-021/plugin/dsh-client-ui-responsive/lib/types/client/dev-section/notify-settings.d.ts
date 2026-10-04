import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
/**
 * 「通知」设置块：前台抑制开关 + 五类分类开关。
 * @returns 该设置分区内的一个功能块；桥不可用时只显示一行不可用说明。
 */
export declare function NotifySettingsRow(): import("react").JSX.Element;
/**
 * 「通知」设置分区（0.14.1 批 3 / P3-5）。
 *
 * 真因：本块此前的**唯一入口**在「开发者选项」里（`index.ts` 的 `settings.section` id
 * `android-dev`）。而「关掉提问提醒 = 引擎的提问被静默丢弃、任务永久挂起」这类后果，
 * 是**每个用户**都要面对的决定，把它埋在开发者选项等于对普通用户不可达
 * （审查档 §3.3 第 14 行：入口埋在开发者选项）。
 *
 * 现在的层级：设置页一级分区「通知」（`android-notify`，order 97），与「手机控制」（98）并列；
 * 开发者选项里保留一行**指路**文案，不重复渲染同一组开关（同功能双实现是审查档 §5 的结构性根因）。
 *
 * @returns 该设置分区的内容列。
 */
export declare function NotifySettingsSection(_props: PropsRuntime<'settings.section'>): import("react").JSX.Element;
