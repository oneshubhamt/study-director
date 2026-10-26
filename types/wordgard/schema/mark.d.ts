// Generated from vendor/wordgard/src/schema/mark.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { GardState } from "wordgard-vendor/state/index";
import { Menu } from "wordgard-vendor/command/index";
import { KeyBinding } from "wordgard-vendor/editor/index";
export declare function strong(): GardState.Extension;
export declare namespace strong {
    const keyBinding: KeyBinding;
    const button: Menu.Button;
}
export declare function emphasis(): GardState.Extension;
export declare namespace emphasis {
    const keyBinding: KeyBinding;
    const button: Menu.Button;
}
export declare function code(): GardState.Extension;
export declare namespace code {
    const keyBinding: KeyBinding;
    const button: Menu.Button;
}
export declare function underline(): GardState.Extension;
export declare namespace underline {
    const keyBinding: KeyBinding;
    const button: Menu.Button;
}
export declare function strikethrough(): GardState.Extension;
export declare namespace strikethrough {
    const keyBinding: KeyBinding;
    const button: Menu.Button;
}
export declare function superscript(): GardState.Extension;
export declare namespace superscript {
    const keyBinding: KeyBinding;
    const button: Menu.Button;
}
export declare function subscript(): GardState.Extension;
export declare namespace subscript {
    const keyBinding: KeyBinding;
    const button: Menu.Button;
}
