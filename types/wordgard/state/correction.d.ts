// Generated from vendor/wordgard/src/state/correction.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Node, Pos, ChangeSet, Plot } from "wordgard-vendor/doc/index";
import { Transaction } from "./transaction";
import { GardState } from "./state";
declare const enum CorrectionEvent {
    ChildList = 0,
    Content = 1,
    Marks = 2
}
export declare class Correction {
    readonly event: CorrectionEvent;
    readonly query: Node.Query;
    readonly correct: (node: Pos.Node) => ChangeSet.Spec | null;
    extension: GardState.Extension;
    private constructor();
    extend(tr: Transaction): {
        changes: ChangeSet.Spec[];
        sequential: boolean;
    } | null;
    scan(state: GardState): Transaction | null;
    static onChildList(query: Node.Query, correct: (node: Pos.Plot) => ChangeSet.Spec | null): Correction;
    static onContent(query: Node.Query, correct: (node: Pos.Plot) => ChangeSet.Spec | null): Correction;
    static onMarks(query: Node.Query, correct: (node: Pos.Node) => ChangeSet.Spec | null): Correction;
    static check(changes: ChangeSet, doc: Plot.Doc, corrections: readonly Correction[]): ChangeSet | null;
}
export {};
