// Generated from vendor/wordgard/src/schema/image.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Wordgard, KeyBinding } from "wordgard-vendor/editor/index";
import { GardState } from "wordgard-vendor/state/index";
import { Command, Menu } from "wordgard-vendor/command/index";
export declare function image(): GardState.Extension;
export declare function figure(conf?: {
    captioned?: boolean;
}): GardState.Extension;
export declare function imageResizing(): GardState.Extension;
export declare namespace imageResizing {
    const resizeCommand: (by: number, relative?: boolean) => Command;
    const keyBindings: KeyBinding[];
    const dragHandle: GardState.Extension;
}
export declare namespace image {
    const keyBinding: KeyBinding;
    const button: Menu.Button;
    const dropHandler: GardState.Extension;
    const insert: Command;
    const uploader: GardState.Facet<(file: File, wg: Wordgard, progress: (percent: number) => void) => Promise<string>, readonly ((file: File, wg: Wordgard, progress: (percent: number) => void) => Promise<string>)[]>;
}
