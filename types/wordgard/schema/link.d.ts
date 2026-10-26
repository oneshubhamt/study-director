// Generated from vendor/wordgard/src/schema/link.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Menu } from "wordgard-vendor/command/index";
import { GardState } from "wordgard-vendor/state/index";
import { KeyBinding } from "wordgard-vendor/editor/index";
export declare function link(): GardState.Extension;
export declare namespace link {
    const keyBinding: KeyBinding;
    const button: Menu.Button;
    const tooltip: GardState.Extension;
    const pasteOver: GardState.Extension;
}
