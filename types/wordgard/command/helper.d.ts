// Generated from vendor/wordgard/src/command/helper.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Plot, Node, Mark, Pos, ChangeSet, Schema } from "wordgard-vendor/doc/index";
import { GardState, Transaction } from "wordgard-vendor/state/index";
export declare function liftEmptyBlock(state: GardState): Transaction.Spec | false;
export declare function enterInCode(state: GardState): Transaction.Spec | false;
export declare function splitTextblock(state: GardState, splitListItem?: boolean): Transaction.Spec | false;
export declare function deleteSelection(state: GardState): Transaction.Spec | false;
export declare function deleteEmptyPlot(state: GardState, dir?: -1 | 1): Transaction.Spec | false;
export declare function joinBackward(state: GardState): Transaction.Spec | false;
export declare function joinListItems(state: GardState): Transaction.Spec | false;
export declare function joinForward(state: GardState): Transaction.Spec | false;
export declare function deleteBackward(state: GardState, word?: boolean): Transaction.Spec | false;
export declare function deleteForward(state: GardState, word?: boolean): Transaction.Spec | false;
export declare function selectedTextblocks(state: GardState): Pos.Plot[];
export declare function clearNonFitting(schema: Schema, node: Pos.Plot, type: Plot.Type): ChangeSet.Spec;
export declare function findWrappable(from: Pos, to: Pos, wrapper: Plot.Tag): {
    from: Pos;
    to: Pos;
} | null;
export declare function wrapBlockRange(range: {
    from: Pos;
    to: Pos;
}, wrapper: Plot.Tag): ChangeSet.Spec[];
export declare function findUnwrappable(schema: Schema, from: Pos, to: Pos, query?: Node.Query): Pos.Plot[] | null;
export declare function doUnwrapBlock(block: Pos.Plot, from?: number, to?: number): ChangeSet.Spec;
export declare function joinBlocks(before: Pos.Plot, after: Pos.Plot): ChangeSet.Spec;
export declare function canAddMarkInRange(doc: Plot.Doc, from: number, to: number, mark: Mark | Mark.Type): boolean;
export declare function autoJoinBlocks(state: GardState, tr: Transaction.Spec): Transaction.Spec;
