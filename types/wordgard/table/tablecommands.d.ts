// Generated from vendor/wordgard/src/table/tablecommands.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { GardState } from "wordgard-vendor/state/index";
import { Schema } from "wordgard-vendor/doc/index";
import { Command } from "wordgard-vendor/command/index";
import { TableMap } from "./tablemap";
export declare function tableContext(state: GardState, pos?: number): {
    cells: number[];
    map: TableMap;
} | null;
export declare function cellTag(schema: Schema): import("wordgard-vendor/doc/index").Plot.Tag<null>;
export declare function headerCellTag(schema: Schema): import("wordgard-vendor/doc/index").Plot.Tag<null> | null;
export declare const toggleHeaderCell: Command.Pure;
export declare const addColumn: Command.Pure<"before" | "after">;
export declare const deleteColumn: Command.Pure;
export declare const addRow: Command.Pure<"before" | "after">;
export declare const deleteRow: Command.Pure;
export declare const mergeCells: Command.Pure;
export declare const splitCell: Command.Pure;
