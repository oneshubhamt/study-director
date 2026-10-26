// Generated from vendor/wordgard/src/table/tablepaste.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Node, Slice } from "wordgard-vendor/doc/index";
import { GardState, Transaction } from "wordgard-vendor/state/index";
import { TableMap } from "./tablemap";
export declare function insertCells(state: GardState, map: TableMap, startCol: number, startRow: number, cells: {
    width: number;
    height: number;
    rows: (readonly Node[])[];
}, event: string): Transaction.Spec;
export declare function handleTablePaste(state: GardState, slice: Slice, drop?: number): false | Transaction.Spec;
export declare const tablePasteHandler: GardState.Extension;
export declare const tableDropHandler: GardState.Extension;
