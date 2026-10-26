// Generated from vendor/wordgard/src/editor/plotdeco.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Plot, Node } from "wordgard-vendor/doc/index";
import { GardState, Transaction } from "wordgard-vendor/state/index";
import { Decoration } from "./decoration";
type Config = {
    type: Node.Query;
    ranges?: (node: Plot, range: (deco: Decoration.Range, from: number, to: number) => void) => void;
    points?: (node: Plot, point: (deco: Decoration.Point, pos: number) => void) => void;
    refresh?: (tr: Transaction) => boolean | ((plot: Plot) => boolean);
};
export declare function decoratePlots(config: Config): GardState.Extension;
export {};
