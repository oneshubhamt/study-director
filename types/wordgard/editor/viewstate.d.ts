// Generated from vendor/wordgard/src/editor/viewstate.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { ChangeSet } from "wordgard-vendor/doc/index";
import { GardState, Transaction } from "wordgard-vendor/state/index";
import { Wordgard } from "./editor";
export declare const scrollIntoView: Transaction.Effect.Type<ScrollTarget>;
export declare class ScrollTarget {
    readonly from: number;
    readonly to: number;
    readonly assoc: -1 | 1;
    readonly spec: Required<Wordgard.ScrollSpec>;
    constructor(from: number, to: number, assoc: -1 | 1, spec: Required<Wordgard.ScrollSpec>);
    map(changes: ChangeSet): ScrollTarget;
    clip(state: GardState): ScrollTarget;
}
export declare class ViewState {
    state: GardState;
    initialized: boolean;
    contentDOMWidth: number;
    contentDOMHeight: number;
    editorHeight: number;
    editorOffset: number;
    editorWidth: number;
    scrollTarget: ScrollTarget | null;
    styleLTR: boolean;
    flushedState: GardState;
    pending: Transaction[];
    constructor(state: GardState);
    update(tr: Transaction): void;
    flush(): void;
    measure(wg: Wordgard): number;
    initialMeasure(wg: Wordgard): void;
}
