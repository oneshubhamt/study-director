// Generated from vendor/wordgard/src/schema/imagedialog.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Plot } from "wordgard-vendor/doc/index";
import { Wordgard } from "wordgard-vendor/editor/index";
import { GardState, GardSelection } from "wordgard-vendor/state/index";
import { Command } from "wordgard-vendor/command/index";
export declare const imageUploader: GardState.Facet<(file: File, wg: Wordgard, progress: (percent: number) => void) => Promise<string>, readonly ((file: File, wg: Wordgard, progress: (percent: number) => void) => Promise<string>)[]>;
export declare function activeImage(sel: GardSelection.Resolved): import("wordgard-vendor/doc/index").Leaf<unknown> | Plot.Tag<unknown> | null;
export declare const insertImage: Command;
export declare const imageDialogTheme: GardState.Extension;
