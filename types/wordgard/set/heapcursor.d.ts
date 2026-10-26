// Generated from vendor/wordgard/src/set/heapcursor.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Set } from "./set";
export declare class HeapCursor<T> implements Set.Cursor<T> {
    readonly cmp: (a: Set.Cursor<T>, b: Set.Cursor<T>) => number;
    readonly cursors: readonly Set.Cursor<T>[];
    heap: Set.Cursor<T>[];
    from: number;
    to: number;
    value: T | null;
    constructor(cmp: (a: Set.Cursor<T>, b: Set.Cursor<T>) => number, cursors: readonly Set.Cursor<T>[]);
    fill(): void;
    goto(pos: number, side?: number): void;
    next(): void;
    get set(): any;
}
