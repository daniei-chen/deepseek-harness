/** Locale-owned Browser tab copy. */
export declare const zh: {
    'native.desktop': string;
    'native.mobile': string;
    'native.viewport': string;
    'native.viewport.apply': string;
    'native.viewport.invalid': string;
    'native.unavailable': string;
    'native.profile.unavailable': string;
    'native.close': string;
    'native.retry': string;
    'native.operation.failed': string;
    'type.label': string;
    'guide.title': string;
    'guide.description': string;
    'shortcut.noSession': string;
    'address.placeholder': string;
    'address.changed': string;
    back: string;
    forward: string;
    reload: string;
    go: string;
    external: string;
    'sandbox.disable': string;
    'sandbox.enable': string;
    'sandbox.warning': string;
    start: string;
    loading: string;
    'restore.previous': string;
    'restore.action': string;
    'error.empty': string;
    'error.invalid': string;
    'error.protocol': string;
    'error.credentials': string;
    'error.application-origin': string;
    'load.failed': string;
    'load.failed.detail': string;
    'address.unknown': string;
};
/** Browser dictionary key union. */
export type SidebarBrowserKey = keyof typeof zh;
/** English dictionary with the same keys. */
export declare const en: {
    'native.desktop': string;
    'native.mobile': string;
    'native.viewport': string;
    'native.viewport.apply': string;
    'native.viewport.invalid': string;
    'native.unavailable': string;
    'native.profile.unavailable': string;
    'native.close': string;
    'native.retry': string;
    'native.operation.failed': string;
    'type.label': string;
    'guide.title': string;
    'guide.description': string;
    'shortcut.noSession': string;
    'address.placeholder': string;
    'address.changed': string;
    back: string;
    forward: string;
    reload: string;
    go: string;
    external: string;
    'sandbox.disable': string;
    'sandbox.enable': string;
    'sandbox.warning': string;
    start: string;
    loading: string;
    'restore.previous': string;
    'restore.action': string;
    'error.empty': string;
    'error.invalid': string;
    'error.protocol': string;
    'error.credentials': string;
    'error.application-origin': string;
    'load.failed': string;
    'load.failed.detail': string;
    'address.unknown': string;
};
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Sidebar Browser labels, navigation controls, and failures. */
        androidSidebarBrowser: SidebarBrowserKey;
    }
}
