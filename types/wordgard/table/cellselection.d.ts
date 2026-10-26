// Generated from vendor/wordgard/src/table/cellselection.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { GardState, GardSelection } from "wordgard-vendor/state/index";
import { Plot, Slice, ChangeSet } from "wordgard-vendor/doc/index";
export declare class CellSelection extends GardSelection {
    readonly anchorCell: number;
    readonly headCell: number;
    readonly _ranges: readonly {
        from: number;
        to: number;
    }[];
    readonly anchorRange: number;
    private constructor();
    get ranges(): readonly {
        from: number;
        to: number;
    }[];
    get replacementRange(): {
        from: number;
        to: number;
    };
    get domSelection(): {
        readonly anchor: number;
        readonly anchorSide: 1;
        readonly head: number;
        readonly headSide: -1;
    };
    toSlice(doc: Plot.Doc): Slice;
    eq(other: GardSelection): boolean;
    map(changes: ChangeSet, cx: GardSelection.Context, assoc?: -1 | 1): CellSelection | GardSelection.Text;
    moveHead(doc: Plot.Doc, dir: "up" | "down" | "forward" | "backward"): CellSelection | null;
    static between(doc: Plot.Doc, anchor: number, head: number): CellSelection | null;
    static normalize(sel: GardSelection, doc: Plot.Doc): GardSelection | null;
    static extension: GardState.Extension;
}
