// Generated from vendor/wordgard/src/schema/color.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Menu } from "wordgard-vendor/command/index";
import { GardState } from "wordgard-vendor/state/index";
import { PhraseSet } from "wordgard-vendor/phrases/index";
import { Wordgard } from "wordgard-vendor/editor/index";
export declare class ColorPicker {
    readonly wg: Wordgard;
    readonly finish: (color: string) => void;
    dom: HTMLElement;
    private width;
    private selPos;
    private options;
    private constructor();
    static create(wg: Wordgard, finish: (color: string) => void): ColorPicker;
    private move;
}
export declare namespace ColorPicker {
    type Option = {
        name: PhraseSet.Ref;
        detail?: PhraseSet.Ref;
        value: string;
    };
    const width: GardState.Facet<number, number>;
    const options: GardState.Facet<readonly Option[], readonly Option[]>;
    const theme: GardState.Extension;
}
export declare function color(): GardState.Extension;
export declare namespace color {
    const button: Menu.Submenu;
}
export declare function backgroundColor(): GardState.Extension;
export declare namespace backgroundColor {
    const button: Menu.Submenu;
}
