// Generated from vendor/wordgard/src/schema/code.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { GardState } from "wordgard-vendor/state/index";
import { Command, Menu } from "wordgard-vendor/command/index";
import { KeyBinding } from "wordgard-vendor/editor/index";
export declare function codeBlock(): GardState.Extension;
export declare namespace codeBlock {
    const keyBinding: KeyBinding;
    const button: Menu.Button;
    const createOnBackticks: GardState.Extension;
    const theme: GardState.Extension;
}
export declare function codeBlockLanguage(options?: {
    languages?: readonly string[];
}): GardState.Extension;
export declare namespace codeBlockLanguage {
    const selectLanguage: Command;
    const selectLanguageBinding: KeyBinding;
    const options: GardState.Facet<readonly string[], readonly string[]>;
}
