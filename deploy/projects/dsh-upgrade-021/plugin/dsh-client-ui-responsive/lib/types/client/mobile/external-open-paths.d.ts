/**
 * The open-with type's pure decisions: what it claims and how it names a tab.
 *
 * Split from the component so the rules are testable without React, the store
 * engine, or a DOM.
 */
import type { SidebarRightTabDefinition } from '@deepseek-ai/dsh-client-ui-sidebar-right/client';
/** This type's identity: the registry id and the key its body registers under. */
export declare const EXTERNAL_OPEN_ID = "@dsh-android/client-ui-responsive/open-with";
/** This type's kind discriminator. */
export declare const EXTERNAL_OPEN_KIND = "open-with";
/**
 * The lowercase suffix of a path, without its dot.
 * @param path - decoded file path.
 * @returns the suffix, or an empty string when the name has none.
 */
export declare function extensionOf(path: string): string;
/**
 * Whether a path's content has no preview and belongs to another application.
 * @param path - decoded file path.
 * @returns true for the curated suffix list.
 */
export declare function isExternalOnlyPath(path: string): boolean;
/**
 * The decoded last segment of an address, used as the tab's chip title.
 * @param address - a `dsh-resource://file/…` address.
 * @returns the decoded name, or the address when it has no segment.
 */
export declare function basenameOf(address: string): string;
/**
 * The type's registry definition.
 * @param claimedByAnother - asks the registry whether a builtin or extension type already welcomes the address.
 * @returns the definition to register.
 */
export declare function externalOpenDefinition(claimedByAnother: (address: string) => boolean): SidebarRightTabDefinition;
