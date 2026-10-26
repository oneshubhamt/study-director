// Generated from vendor/wordgard/src/editor/showkeys.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { KeyBinding } from "./keymap";
import { GardState } from "wordgard-vendor/state/index";
import { Command, Menu } from "wordgard-vendor/command/index";
export declare function keyBindingHelp(): GardState.Extension;
export declare namespace keyBindingHelp {
    const showKeyBindings: Command;
    const button: Menu.Button;
    const keyBindings: KeyBinding[];
}
