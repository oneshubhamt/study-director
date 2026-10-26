// Generated from vendor/wordgard/src/doc/change.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Plot, Node } from "./node";
import { Mark } from "./mark";
import { Schema } from "./schema";
import { Slice, Token } from "./slice";
type Modification = {
    add: Mark;
} | {
    remove: Mark;
};
type SectionData = readonly Token[] | readonly Modification[] | null;
export declare class ChangeSet {
    readonly sections: ChangeSet.Sections;
    readonly data: readonly SectionData[];
    private _length;
    private _newLength;
    private constructor();
    static new(sections: ChangeSet.Sections, data: readonly SectionData[]): ChangeSet;
    get length(): number;
    get newLength(): number;
    get empty(): boolean;
    eq(other: ChangeSet): boolean;
    apply(doc: Plot.Doc): Plot.Doc;
    toJSON(): ChangeSet.JSON;
    static fromJSON(schema: Schema, json: ChangeSet.JSON): ChangeSet;
    transform(doc: Plot.Doc, other: ChangeSet, before?: boolean): ChangeSet;
    compose(other: ChangeSet): ChangeSet;
    invert(doc: Plot.Doc): ChangeSet;
    correct(doc: Plot.Doc, local?: boolean): ChangeSet;
    mapPos(pos: number, assoc?: -1 | 1): number;
    mapPos(pos: number, assoc: -1 | 1, track?: ChangeSet.TrackMode): number | null;
    findInserted(pred: (tag: Node.Tag) => boolean): number | null;
    touchesRange(from: number, to: number): "cover" | boolean;
    iterChanges(replaced: (fromA: number, toA: number, fromB: number, toB: number, inserted: readonly Token[]) => void, preserved?: (fromA: number, toA: number, fromB: number, toB: number, modifications: readonly Modification[] | null) => void): void;
    iterGaps(gap: (fromA: number, toA: number, fromB: number, toB: number, last: boolean) => void, change?: (fromA: number, toA: number, fromB: number, toB: number) => void): void;
    iterChangedRanges(range: (fromA: number, toA: number, fromB: number, toB: number) => void): void;
    pad(before: number, after: number): ChangeSet;
    clip(from: number, to: number): ChangeSet | null;
    static create(doc: Plot.Doc, spec: ChangeSet.Spec): ChangeSet;
    static empty(length: number): ChangeSet;
    toString(): string;
    static composeSections(a: ChangeSet.Sections, b: ChangeSet.Sections): ChangeSet.Sections;
    static transform(doc: Plot.Doc, a: ChangeSet, b: ChangeSet): {
        a: ChangeSet;
        b: ChangeSet;
    };
}
export declare namespace ChangeSet {
    type Change = {
        from: number;
        to?: number;
        insert?: Slice | readonly Token[];
        fit?: boolean;
        add?: Mark;
        remove?: Mark;
    };
    type Spec = ChangeSet.Change | {
        correct: ChangeSet.Spec;
        local?: boolean;
    } | ChangeSet | readonly ChangeSet.Spec[];
    type Sections = readonly number[];
    type JSON = readonly (number | [number, readonly Token.JSON[] | readonly ModificationJSON[]])[];
    type TrackMode = "before" | "after" | "around";
}
type ModificationJSON = {
    add: string;
    value: any;
} | {
    remove: string;
    value: any;
};
export {};
