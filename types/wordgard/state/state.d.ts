// Generated from vendor/wordgard/src/state/state.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Schema, Plot, Node, Pos } from "wordgard-vendor/doc/index";
import { GardSelection } from "./selection";
import { Transaction } from "./transaction";
import { TextblockMap } from "./textblock";
type DocSource = Plot.Doc | HTMLElement | DocumentFragment | string | Node.JSON | ((schema: Schema) => Plot.Doc);
export declare class GardState {
    readonly config: GardState.Configuration;
    private _doc;
    private _selection;
    readonly values: any[];
    readonly status: SlotStatus[];
    computeSlot: null | ((state: GardState, slot: DynamicSlot) => SlotStatus);
    private resolvedSel;
    private trackAccess;
    static create(spec: GardState.Spec): GardState;
    private constructor();
    get doc(): Plot.Doc;
    get schema(): Schema;
    get selection(): GardSelection;
    get sel(): GardSelection.Resolved;
    field<T>(field: GardState.Field<T> | GardState.Field.Derived<T>): T;
    field<T>(field: GardState.Field<T>, require: false): T | undefined;
    field<T>(field: GardState.Field.Derived<T>, require: false): T;
    facet<Output>(facet: GardState.Facet.Reader<Output>): Output;
    update(spec: Transaction.Spec): Transaction;
    applyTransaction(tr: Transaction): void;
    recordAccess<T>(slots: Slot[] | null, f: (state: GardState) => T): T;
    textblockMap(node: Pos.Plot): TextblockMap;
    toJSON(fields?: {
        [prop: string]: GardState.Field<any>;
    }): any;
    static fromJSON(json: any, extensions: GardState.Extension, fields?: {
        [prop: string]: GardState.Field<any>;
    }): GardState;
    static fromConfig(config: GardState.Configuration, doc: Plot.Doc, selection: GardSelection): GardState;
    get readOnly(): boolean;
    get textLTR(): boolean;
    textblockLTR(plot: Plot): boolean;
    isAtom(type: Node.Type): boolean;
    wordAt(pos: number, bias?: -1 | 1): GardSelection.Text;
    static reconfigure: Transaction.Effect.Type<GardState.Extension>;
    static appendConfig: Transaction.Effect.Type<GardState.Extension>;
}
export declare namespace GardState {
    interface Spec {
        doc?: DocSource;
        selection?: GardSelection | GardSelection.Text.Spec | ((cx: GardSelection.Context) => GardSelection);
        config?: GardState.Extension | GardState.Configuration;
    }
    class Field<Value> {
        readonly id: number;
        private createF;
        private updateF;
        private compareF;
        readonly spec: GardState.Field.Spec<Value>;
        provides: GardState.Extension | undefined;
        private constructor();
        static define<Value>(config: GardState.Field.Spec<Value>): GardState.Field<Value>;
        private create;
        slot(addresses: {
            [id: number]: number;
        }): DynamicSlot;
        get extension(): GardState.Extension;
        init(create: (state: GardState) => Value): GardState.Extension;
    }
    namespace Field {
        type Spec<Value> = {
            create: (state: GardState) => Value;
            update: (value: Value, transaction: Transaction) => Value;
            compare?: (a: Value, b: Value) => boolean;
            provide?: (field: GardState.Field<Value>) => GardState.Extension;
            toJSON?: (value: Value, state: GardState) => any;
            fromJSON?: (json: any, state: GardState) => Value;
        };
        class Derived<Value> {
            readonly value: (state: GardState) => Value;
            private compareF;
            readonly id: number;
            dependencies: Slot[];
            private constructor();
            static define<Value>(compute: (state: GardState) => Value, spec?: {
                compare?: (a: Value, b: Value) => boolean;
            }): Derived<Value>;
            get extension(): GardState.Extension;
            slot(addresses: {
                [id: number]: number;
            }): DynamicSlot;
        }
    }
    class Facet<Input, Output = readonly Input[]> implements GardState.Facet.Reader<Output> {
        readonly combine: (values: readonly Input[]) => Output;
        readonly compareInput: (a: Input, b: Input) => boolean;
        readonly compare: (a: Output, b: Output) => boolean;
        readonly isStatic: boolean;
        readonly id: number;
        readonly default: Output;
        readonly extensions: GardState.Extension | undefined;
        private constructor();
        get reader(): GardState.Facet.Reader<Output>;
        static define<Input, Output = readonly Input[]>(config?: GardState.Facet.Spec<Input, Output>): Facet<Input, Output>;
        of(value: Input): GardState.Extension;
        derive(get: (state: GardState) => Input): GardState.Extension;
        deriveN(get: (state: GardState) => readonly Input[]): GardState.Extension;
        from<T extends Input>(field: GardState.Field<T> | GardState.Field.Derived<T>): GardState.Extension;
        from<T>(field: GardState.Field<T> | GardState.Field.Derived<T>, get: (value: T) => Input): GardState.Extension;
        tag: Output;
    }
    namespace Facet {
        type Spec<Input, Output> = {
            combine?: (value: readonly Input[]) => Output;
            compare?: (a: Output, b: Output) => boolean;
            compareInput?: (a: Input, b: Input) => boolean;
            static?: boolean;
            enables?: GardState.Extension | ((self: GardState.Facet<Input, Output>) => GardState.Extension);
        };
        type Reader<Output> = {
            id: number;
            default: Output;
            tag: Output;
        };
        function combineConfig<Config extends object>(configs: readonly Partial<Config>[], defaults: Partial<Config>, // Should hold only the optional properties of Config, but I haven't managed to express that
        combine?: {
            [P in keyof Config]?: (first: Config[P], second: Config[P]) => Config[P];
        }): Config;
    }
    class Configuration {
        readonly base: GardState.Extension;
        readonly compartments: Map<GardState.Compartment, GardState.Extension>;
        readonly dynamicSlots: DynamicSlot[];
        readonly address: {
            [id: number]: number;
        };
        readonly staticValues: readonly any[];
        readonly facets: {
            [id: number]: readonly FacetProvider<any>[];
        };
        readonly statusTemplate: SlotStatus[];
        private constructor();
        staticFacet<Output>(facet: GardState.Facet<any, Output>): Output;
        static resolve(base: GardState.Extension, compartments: Map<GardState.Compartment, GardState.Extension>, oldState?: GardState): Configuration;
        static create(extensions: GardState.Extension): Configuration;
        get schema(): Schema | null;
        get textLTR(): boolean;
        textblockLTR(plot: Plot): boolean;
        get visualCursorMotion(): boolean;
        isAtom(type: Node.Type): boolean;
    }
    type Extension = {
        extension: GardState.Extension;
    } | readonly GardState.Extension[];
    const prec: {
        highest: (ext: GardState.Extension) => GardState.Extension;
        high: (ext: GardState.Extension) => GardState.Extension;
        default: (ext: GardState.Extension) => GardState.Extension;
        low: (ext: GardState.Extension) => GardState.Extension;
        lowest: (ext: GardState.Extension) => GardState.Extension;
    };
    class Compartment {
        private constructor();
        static define(): Compartment;
        of(ext: GardState.Extension): GardState.Extension;
        reconfigure(content: GardState.Extension): Transaction.Effect<unknown>;
        get(state: GardState): GardState.Extension | undefined;
        static reconfigureCompartment: Transaction.Effect.Type<{
            compartment: GardState.Compartment;
            extension: GardState.Extension;
        }>;
    }
    const schemaElement: Facet<readonly Schema.Element[] | Schema.Element, readonly Schema.Element[]>;
    const readOnly: Facet<boolean, boolean>;
    const textLTR: Facet<boolean, boolean>;
    const textblockLTR: Facet<(plot: Plot) => boolean | null, readonly ((plot: Plot) => boolean | null)[]>;
    const visualCursorMotion: Facet<boolean, boolean>;
    const isAtom: Facet<[Plot.Type<unknown>, boolean], Map<Plot.Type<unknown>, boolean>>;
}
type Slot = GardState.Facet.Reader<any> | GardState.Field<any> | GardState.Field.Derived<any> | "doc" | "selection" | "schema";
declare const enum ProviderFlag {
    None = 0,
    Static = 1,
    Multi = 2,// Dynamic providers may produce an array of values
    Auto = 4
}
declare const enum SlotStatus {
    Unresolved = 0,
    Changed = 1,
    Computed = 2,
    Computing = 4
}
declare class FacetProvider<Input> {
    readonly facet: GardState.Facet<Input, any>;
    readonly id: number;
    readonly flags: ProviderFlag;
    readonly value: Input | null;
    extension: GardState.Extension;
    constructor(facet: GardState.Facet<Input, any>, id: number, flags: ProviderFlag, value: Input | null);
}
interface DynamicSlot {
    create(state: GardState): SlotStatus;
    update(state: GardState, tr: Transaction): SlotStatus;
    reconfigure(state: GardState, oldState: GardState): SlotStatus;
}
export {};
