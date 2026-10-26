// Generated from vendor/wordgard/src/set/range.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { ChangeSet } from "wordgard-vendor/doc/index";
import { Set } from "./set";
declare class Chunk<T> {
    readonly start: number;
    readonly from: number[];
    readonly to: number[];
    readonly value: T[];
    constructor(start: number, from: number[], to: number[], value: T[]);
    get end(): number;
    move(start: number): Chunk<T>;
}
export declare class RangeSet<T extends RangeSet.Value> extends Set<T> {
    readonly chunks: readonly Chunk<T>[];
    readonly next: RangeSet<T> | null;
    private constructor();
    static new<T extends RangeSet.Value>(chunks: readonly Chunk<T>[], next: RangeSet<T> | null): RangeSet<T>;
    static create<T extends RangeSet.Value>(source: Set.Source<T>): RangeSet<T>;
    get length(): number;
    get empty(): boolean;
    cursor(from?: number): Set.Cursor<T>;
    static cursor<T extends RangeSet.Value>(sets: readonly RangeSet<T>[], from?: number): Set.Cursor<T>;
    map(map: ChangeSet, replace?: readonly Set.Replacement<T>[]): this;
    private mapInner;
    modify(spec: {
        replace?: readonly Set.Replacement<T>[];
        add?: Set.Source<T>;
        filter?: (value: T, from: number, to: number) => boolean;
    }): this;
    private modifyInner;
    compareRange(fromA: number, b: RangeSet<T>, fromB: number, len: number, change: (from: number, to: number) => void): void;
    static empty: RangeSet<any>;
}
export declare namespace RangeSet {
    interface Value {
        inclusiveStart: boolean;
        inclusiveEnd: boolean;
        eq(other: Value): boolean;
    }
}
export {};
