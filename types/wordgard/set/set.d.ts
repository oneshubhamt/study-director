// Generated from vendor/wordgard/src/set/set.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { ChangeSet } from "wordgard-vendor/doc/index";
export declare abstract class Set<T> {
    abstract length: number;
    abstract empty: boolean;
    abstract cursor(from?: number): Set.Cursor<T>;
    abstract map(map: ChangeSet, replace?: readonly Set.Replacement<T>[]): this;
    abstract modify(spec: {
        replace?: readonly Set.Replacement<T>[];
        add?: Set.Source<T>;
        filter?: (value: T, from: number, to: number) => boolean;
    }): this;
}
export declare namespace Set {
    interface Cursor<T> {
        value: T | null;
        from: number;
        to: number;
        goto(pos: number, side?: number): void;
        next(): void;
        set: any;
    }
    type Source<T> = Iterable<[T, number, number?]> | ((add: (value: T, pos: number, to?: number) => void) => void);
    type Replacement<T> = {
        from: number;
        to: number;
        add?: Source<T>;
    };
}
