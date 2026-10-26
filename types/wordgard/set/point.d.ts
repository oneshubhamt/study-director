// Generated from vendor/wordgard/src/set/point.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { ChangeSet } from "wordgard-vendor/doc/index";
import { Set } from "./set";
declare class Chunk<T extends PointSet.Value> {
    readonly start: number;
    readonly pos: number[];
    readonly value: T[];
    constructor(start: number, pos: number[], value: T[]);
    get end(): number;
    get startSide(): number;
    get endSide(): number;
    move(start: number): Chunk<T>;
}
export declare class PointSet<T extends PointSet.Value> implements Set<T> {
    readonly chunks: readonly Chunk<T>[];
    private constructor();
    static new<T extends PointSet.Value>(chunks: readonly Chunk<T>[]): PointSet<T>;
    static create<T extends PointSet.Value>(source: Set.Source<T>): PointSet<T>;
    get length(): number;
    get empty(): boolean;
    cursor(from?: number, side?: number): Set.Cursor<T>;
    static cursor<T extends PointSet.Value>(sets: readonly PointSet<T>[], from?: number, side?: number): Set.Cursor<T>;
    at(pos: number, pred?: (value: T) => boolean): T | undefined;
    map(map: ChangeSet, replace?: readonly Set.Replacement<T>[]): this;
    private mapInner;
    modify(spec: {
        replace?: readonly Set.Replacement<T>[];
        add?: Set.Source<T>;
        filter?: (value: T, from: number, to: number) => boolean;
    }): this;
    private modifyInner;
    compareRange(fromA: number, b: PointSet<T>, fromB: number, len: number, change: (pos: number, value: T) => void): void;
    static empty: PointSet<any>;
}
export declare namespace PointSet {
    interface Value {
        side: number;
        trackMode: ChangeSet.TrackMode | undefined;
        eq(other: Value): boolean;
    }
}
export {};
