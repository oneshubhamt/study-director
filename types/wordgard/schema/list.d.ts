// Generated from vendor/wordgard/src/schema/list.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { GardState } from "wordgard-vendor/state/index";
import { Menu } from "wordgard-vendor/command/index";
import { InputRule } from "wordgard-vendor/editor/index";
export declare function bulletList(config?: {
    blockItems?: boolean;
}): GardState.Extension[];
export declare namespace bulletList {
    const createOnDash: InputRule;
    const toggleButton: Menu.Button;
}
export declare function orderedList(config?: {
    blockItems?: boolean;
}): GardState.Extension[];
export declare namespace orderedList {
    const createOnNumber: InputRule;
    const toggleButton: Menu.Button;
}
