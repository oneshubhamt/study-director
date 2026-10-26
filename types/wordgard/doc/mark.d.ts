// Generated from vendor/wordgard/src/doc/mark.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Shape, Elt, Attributes } from "./shape";
import { type parse } from "./parse";
import { Node, Plot } from "./node";
export declare function addSet<T>(a: readonly T[], b: readonly T[], compare: (a: T, b: T) => number): T[];
export declare function subtractSet<T>(a: readonly T[], b: readonly T[], compare: (a: T, b: T) => number): T[];
export declare class Mark<Value = unknown> {
    readonly type: Mark.Type<Value>;
    readonly value: Value;
    private constructor();
    static create<Value>(type: Mark.Type<Value>, value: Value): Mark<Value>;
    eq(other: Mark): boolean;
    get name(): string;
    get rank(): number;
    get spanning(): boolean;
    toString(): string;
    static define(name: string, spec: Mark.Spec<null>): Mark<null>;
    addToSet(set: Mark.Set): Mark.Set;
    removeFromSet(set: Mark.Set): Mark.Set;
    isInSet(set: Mark.Set): Mark<Value> | null;
    static sameSet(a: Mark.Set, b: Mark.Set): boolean;
    static none: Mark.Set;
}
export declare namespace Mark {
    class Type<Param = unknown> {
        readonly name: string;
        readonly rank: number;
        readonly set: null | ((a: any, b: any) => number);
        readonly default: Mark<Param> | null;
        readonly inclusive: boolean;
        readonly element: {
            name: string;
            attrs(value: Param): Attributes;
        } | null;
        readonly attribute: {
            get(value: Param): Attributes;
            target: Elt.Selector | null;
        } | null;
        readonly spanning: boolean;
        readonly spec: Mark.Spec<any>;
        private constructor();
        of(value: Param): Mark<Param>;
        compareRank(other: Mark.Type): number;
        removeFromSet(set: Mark.Set): Mark.Set;
        isInSet(set: Mark.Set): Mark<Param> | null;
        get isElement(): boolean;
        static define<Param>(name: string, spec: Mark.Spec<Param>, isFlag?: boolean): Type<Param>;
    }
    interface Spec<Param> {
        target?: Node.Query;
        rank?: number;
        inclusive?: boolean;
        spanning?: boolean;
        keepOnSplit?: boolean | ((tag: Plot.Tag, atEnd: boolean) => boolean);
        keepOnTypeChange?: boolean | ((from: Node.Tag, to: Node.Tag) => boolean);
        defaultParam?: Param;
        validate?: string | ((value: Param) => void);
        set?: Param extends ReadonlyArray<infer Content> ? {
            compare: (a: Content, b: Content) => number;
        } : never;
        shape: Shape.Element<Param> | Shape.Attribute<Param> | Shape.Attributes<Param>;
        parseRules?: readonly parse.Rule<Param>[];
    }
    type Set = readonly Mark[];
}
export declare class AttributeShape<Param> {
    readonly get: (param: Param) => Attributes;
    readonly target: Elt.Selector | null;
    constructor(spec: Shape.Attribute<Param> | Shape.Attributes<Param>, type: Mark.Type<Param>);
}
