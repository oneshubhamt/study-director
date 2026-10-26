// Generated from vendor/wordgard/src/history/history.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { GardState, Transaction } from "wordgard-vendor/state/index";
import { ChangeSet } from "wordgard-vendor/doc/index";
import { Command, Menu } from "wordgard-vendor/command/index";
interface HistoryConfig {
    minDepth?: number;
    newGroupDelay?: number;
    joinToEvent?: (tr: Transaction, isAdjacent: boolean) => boolean;
}
export declare function history(config?: HistoryConfig): GardState.Extension;
export declare namespace history {
    const field: GardState.Field<unknown>;
    const isolate: Transaction.Annotation.Type<"after" | "before" | true>;
    const invertedEffects: GardState.Facet<(tr: Transaction) => readonly Transaction.Effect<any>[], readonly ((tr: Transaction) => readonly Transaction.Effect<any>[])[]>;
    type EventJSON = {
        changes: ChangeSet.JSON;
        selection: unknown;
    };
    type JSON = {
        done: readonly EventJSON[];
        undone: readonly EventJSON[];
    };
}
export declare const undo: Command.Pure;
export declare const redo: Command.Pure;
export declare const undoDepth: (state: GardState) => number;
export declare const redoDepth: (state: GardState) => number;
export declare const undoButton: Menu.Button;
export declare const redoButton: Menu.Button;
export {};
