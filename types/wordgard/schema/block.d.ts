// Generated from vendor/wordgard/src/schema/block.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Plot } from "wordgard-vendor/doc/index";
import { GardState } from "wordgard-vendor/state/index";
import { Menu } from "wordgard-vendor/command/index";
import { KeyBinding, InputRule } from "wordgard-vendor/editor/index";
export declare function blockDoc(): GardState.Extension;
export declare function inlineDoc(): GardState.Extension;
export declare function selectionInType(tag: Plot.Tag): (state: GardState) => boolean;
export declare function paragraph(): GardState.Extension;
export declare namespace paragraph {
    const keyBinding: KeyBinding;
    const button: Menu.Button;
}
export declare function heading(): GardState.Extension;
export declare namespace heading {
    const keyBindings: KeyBinding[];
    const button1: Menu.Button;
    const button2: Menu.Button;
    const button3: Menu.Button;
    const createOnHash: InputRule;
}
export declare function alignment(): GardState.Extension;
export declare namespace alignment {
    const keyBindings: KeyBinding[];
    const buttonStart: Menu.Button;
    const buttonEnd: Menu.Button;
    const buttonCenter: Menu.Button;
    const button: Menu.Submenu;
}
export declare function direction(): GardState.Extension;
export declare namespace direction {
    const textblockDir: GardState.Extension;
    const buttonLTR: Menu.Button;
    const buttonRTL: Menu.Button;
    const buttonAuto: Menu.Button;
    const button: Menu.Submenu;
}
export declare function blockquote(): GardState.Extension;
export declare namespace blockquote {
    const button: Menu.Button;
    const createOnGT: InputRule;
    const theme: GardState.Extension;
}
export declare function horizontalRule(): GardState.Extension;
export declare namespace horizontalRule {
    const createOnDashes: InputRule;
}
