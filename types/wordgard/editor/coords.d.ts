// Generated from vendor/wordgard/src/editor/coords.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Tile } from "./tile";
import { Wordgard } from "./editor";
export declare class Coords {
    readonly ref: Tile;
    readonly rect: DOMRect;
    constructor(ref: Tile, rect: DOMRect);
}
export declare function coordsAtPos(wg: Wordgard, pos: number, assoc: -1 | 1): Coords;
