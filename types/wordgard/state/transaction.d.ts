// Generated from vendor/wordgard/src/state/transaction.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Plot, ChangeSet } from "wordgard-vendor/doc/index";
import type { GardState } from "./state";
import { GardSelection } from "./selection";
export declare class Transaction {
    readonly startState: GardState;
    readonly changes: ChangeSet;
    readonly selection: GardSelection | undefined;
    readonly effects: readonly Transaction.Effect<any>[];
    readonly annotations: readonly Transaction.Annotation<any>[];
    readonly scrollIntoView: boolean;
    _state: GardState | null;
    private constructor();
    newSelection: GardSelection;
    newDoc: Plot.Doc;
    static create(startState: GardState, spec: ResolvedSpec): Transaction;
    get state(): GardState;
    annotation<T>(type: Transaction.Annotation.Type<T>): T | undefined;
    get docChanged(): boolean;
    get reconfigured(): boolean;
    isUserEvent(event: string): boolean;
}
export declare namespace Transaction {
    interface Spec {
        changes?: ChangeSet.Spec;
        selection?: GardSelection | GardSelection.Text.Spec | ((cx: GardSelection.Context, changes: ChangeSet) => GardSelection | null);
        effects?: Transaction.Effect<any> | readonly Transaction.Effect<any>[];
        annotations?: Transaction.Annotation<any> | readonly Transaction.Annotation<any>[];
        userEvent?: string;
        scrollIntoView?: boolean;
        sequential?: boolean;
    }
    function merge(state: GardState, a: Transaction.Spec, b: Transaction.Spec): Transaction.Spec;
    let extender: GardState.Facet<(tr: Transaction) => Transaction.Spec | null>;
    let appender: GardState.Facet<(trs: readonly Transaction[], state: GardState) => Transaction.Spec | null>;
    function append(tr: Transaction): readonly Transaction[];
    class Annotation<T> {
        readonly type: Transaction.Annotation.Type<T>;
        readonly value: T;
        constructor(type: Transaction.Annotation.Type<T>, value: T);
        static define<T>(): Annotation.Type<T>;
        private _isAnnotation;
    }
    namespace Annotation {
        class Type<T> {
            of(value: T): Transaction.Annotation<T>;
        }
    }
    const foo: number;
    const time: Annotation.Type<number>;
    const userEvent: Annotation.Type<string>;
    const addToHistory: Annotation.Type<boolean>;
    const remote: Annotation.Type<boolean>;
    const appended: Annotation.Type<boolean>;
    class Effect<Value> {
        readonly type: Transaction.Effect.Type<Value>;
        readonly value: Value;
        constructor(type: Transaction.Effect.Type<Value>, value: Value);
        map(mapping: ChangeSet): Transaction.Effect<Value> | undefined;
        is<T>(type: Transaction.Effect.Type<T>): this is Transaction.Effect<T>;
        static define<Value = null>(spec?: Transaction.Effect.Spec<Value>): Transaction.Effect.Type<Value>;
    }
    namespace Effect {
        function mapEffects(effects: readonly Transaction.Effect<any>[], mapping: ChangeSet): readonly Effect<any>[];
        class Type<Value> {
            readonly map: (value: any, mapping: ChangeSet) => any | undefined;
            constructor(map: (value: any, mapping: ChangeSet) => any | undefined);
            of(value: Value): Transaction.Effect<Value>;
        }
        interface Spec<Value> {
            map?: (value: Value, mapping: ChangeSet) => Value | undefined;
        }
    }
}
type ResolvedSpec = {
    changes: ChangeSet;
    selection: GardSelection | undefined;
    effects: readonly Transaction.Effect<any>[];
    annotations: readonly Transaction.Annotation<any>[];
    scrollIntoView: boolean;
};
export declare function mergeTransaction(state: GardState, a: ResolvedSpec, b: ResolvedSpec): ResolvedSpec;
export declare function resolveTransactionInner(state: GardState, after: ChangeSet | null, spec: Transaction.Spec): ResolvedSpec;
export declare function resolveTransaction(state: GardState, spec: Transaction.Spec): Transaction;
export declare function asArray<T>(value: undefined | T | readonly T[]): readonly T[];
export {};
