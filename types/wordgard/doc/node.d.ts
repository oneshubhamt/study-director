// Generated from vendor/wordgard/src/doc/node.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Token } from "./slice";
import { NodeShape } from "./shape";
import type { Schema } from "./schema";
import { Pos } from "./pos";
import { Mark } from "./mark";
import { Shape } from "./shape";
import { type parse } from "./parse";
declare const enum NodeFlag {
    None = 0,
    Inline = 1,
    InlineContent = 2,
    Atom = 4,
    Doc = 8,
    NullParam = 16,
    Selectable = 32,
    CanBeEmpty = 64
}
export type Node = Plot | Leaf;
export declare abstract class BaseType<Param> {
    readonly name: string;
    readonly flags: NodeFlag;
    readonly shape: NodeShape<Param>;
    readonly roles: Set<Node.Role>;
    constructor(name: string, flags: NodeFlag, spec: Node.Spec<Param>, shape: NodeShape<Param>);
    hasRole(role: Node.Role): boolean;
    get isInline(): boolean;
    get isBlock(): boolean;
    get isAtom(): boolean;
    abstract isLeaf: boolean;
    abstract isPlot: boolean;
    get isSelectable(): boolean;
}
export declare abstract class BaseTag<Param> {
    readonly param: Param;
    readonly marks: Mark.Set;
    abstract type: Node.Type<Param>;
    constructor(param: Param, marks: Mark.Set);
    mark<Value>(mark: Mark.Type<Value>): Value | undefined;
    get name(): string;
    abstract eq(other: Node | Node.Tag): boolean;
    abstract isLeaf: boolean;
    abstract isPlot: boolean;
    get isText(): boolean;
    is<T>(type: Leaf.Type<T>): this is Leaf<T>;
    is<T>(type: Plot.Type<T>): this is Plot.Tag<T>;
    toJSON(): Node.JSON;
}
export declare namespace Node {
    interface Shared {
        name: string;
        tag: Node.Tag;
        length: number;
        marks: Mark.Set;
        mark<Value>(mark: Mark.Type<Value>): Value | undefined;
        eq(other: Node): boolean;
        withMarks(marks: Mark.Set): Node;
        pushTo(nodes: Node[]): void;
        isLeaf: boolean;
        isText: boolean;
        isPlot: boolean;
        isBlock: boolean;
        isInline: boolean;
        toJSON(): Node.JSON;
    }
    type Type<T = unknown> = Leaf.Type<T> | Plot.Type<T>;
    namespace Type {
        type Ref<T> = Plot.Type<T> | Leaf.Type<T> | Plot.Tag<T> | Leaf<T>;
        function get<T>(ref: Ref<T>): Node.Type<T>;
    }
    type Tag = Leaf | Plot.Tag;
    namespace Tag {
        interface Shared<Param> {
            type: Node.Type<Param>;
            param: Param;
            marks: Mark.Set;
            name: string;
            mark<Value>(mark: Mark.Type<Value>): Value | undefined;
            eq(other: Node.Tag): boolean;
            isLeaf: boolean;
            isPlot: boolean;
            is<T>(type: Leaf.Type<T>): this is Leaf<T>;
            is<T>(type: Plot.Type<T>): this is Plot.Tag<T>;
            isText: boolean;
            toJSON(): Node.JSON;
        }
        type For<Type extends Node.Type.Ref<any>> = Type extends Leaf.Type<infer T> ? Leaf<T> : Type extends Plot.Type<infer T> ? Plot.Tag<T> : Type;
    }
    interface Spec<Param> {
        inline?: boolean;
        defaultParam?: Param;
        validate?: string | ((param: Param) => void);
        group?: Group | readonly Group[];
        role?: Node.Role | readonly Node.Role[];
        shape: Shape.Element<Param> | Shape.Structure<Param>;
        parseRules?: readonly parse.Rule.Element<Param>[];
        selectable?: boolean;
    }
    interface JSON {
        type: string;
        param?: any;
        marks?: {
            [name: string]: any;
        };
        content?: readonly Node.JSON[];
    }
    class Group {
        readonly parent: Group | undefined;
        private tag;
        private constructor();
        static define(parent?: Group): Group;
        static All: Group;
        static Inline: Group;
        static Block: Group;
        static Leaf: Group;
        static Plot: Group;
        static Textblock: Group;
        static Content: Group;
        static TableCell: Group;
        static ListItem: Group;
        static builtin: Group[];
    }
    type Query = Node.Tag | Node.Type | Group | readonly Node.Query[] | {
        and: readonly Node.Query[];
    };
    class Role {
        private constructor();
        private tag;
        static define(): Role;
        static Code: Role;
        static List: Role;
        static LineBreak: Role;
    }
}
export declare class Leaf<Param = unknown> extends BaseTag<Param> implements Node.Shared, Node.Tag.Shared<Param> {
    readonly type: Leaf.Type<Param>;
    private constructor();
    static new<Param>(type: Leaf.Type<Param>, param: Param, marks: Mark.Set): Leaf<Param>;
    get tag(): this;
    eq(other: Node | Node.Tag): boolean;
    static define(name: string, spec: Leaf.Spec<null>): Leaf<null>;
    withMarks(marks: Mark.Set): Leaf<Param>;
    get tokenType(): Token.Type.Node;
    get isLeaf(): true;
    get isPlot(): false;
    get isInline(): boolean;
    get isBlock(): boolean;
    get length(): number;
    pushTo(nodes: Node[]): void;
    sliceInner(from: number, to: number): readonly Token[];
    sliceText(from: number, to?: number): Leaf<string>;
    static text(text: string, marks?: Mark.Set): Leaf<string>;
    toString(): string;
}
export declare namespace Leaf {
    class Type<Param = unknown> extends BaseType<Param> {
        default: Leaf<Param> | null;
        readonly spec: Leaf.Spec<any>;
        private constructor();
        static new<Param>(name: string, flags: NodeFlag, spec: Leaf.Spec<Param>): Type<Param>;
        static define<T>(name: string, spec: Leaf.Spec<T>): Type<T>;
        of(param: Param, marks?: Mark.Set): Leaf<Param>;
        get isLeaf(): true;
        get isPlot(): false;
    }
    interface Spec<Param> extends Node.Spec<Param> {
        toText?: (node: Leaf) => string;
    }
    const Text: Leaf.Type<string>;
}
export declare class Plot implements Node.Shared {
    readonly tag: Plot.Tag;
    readonly content: readonly Node[];
    protected constructor(tag: Plot.Tag, content: readonly Node[]);
    contentLength: number;
    static create(tag: Plot.Tag, content: readonly Node[]): Plot;
    get name(): string;
    get type(): Plot.Type<unknown>;
    get marks(): Mark.Set;
    get length(): number;
    eq(other: Node): boolean;
    contentEq(other: Plot): boolean;
    sliceInner(from: number, to: number): readonly Token[];
    slicePlot(out: Token[], from: number, to: number): void;
    is<T>(type: Leaf.Type<T>): false;
    get isText(): false;
    get inlineContent(): boolean;
    get isTextblock(): boolean;
    get isLeaf(): false;
    get isPlot(): true;
    get isInline(): boolean;
    get isBlock(): boolean;
    get isDoc(): boolean;
    get firstChild(): Node | null;
    get lastChild(): Node | null;
    iterate(from: number, to: number, f: (node: Node, pos: number, parent: Plot | null, index: number) => boolean | void): void;
    iterate(f: (node: Node, pos: number, parent: Plot | null, index: number) => boolean | void): void;
    nodeAt(pos: number): Node | null;
    plotAt(pos: number): Plot | null;
    textContent(options?: {
        from?: number;
        to?: number;
        blockSeparator?: string;
        leafText?: string | ((node: Leaf) => string);
    }): string;
    iterInner(contentStart: number, from: number, to: number, f: (node: Node, pos: number, parent: Plot | null, index: number) => boolean | void): void;
    iterBack(contentEnd: number, from: number, to: number, f: (node: Node, pos: number, parent: Plot | null, index: number) => boolean | void): void;
    toString(): string;
    toJSON(): Node.JSON;
    mark<Value>(mark: Mark.Type<Value>): Value | undefined;
    pushTo(nodes: Node[]): void;
    withMarks(marks: Mark.Set): Plot;
    get tokenType(): Token.Type.Node;
    static define(name: string, spec: Plot.Spec<null>): Plot.Tag<null>;
    static defineDoc(spec: {
        inlineContent?: Node.Query | true;
        blockContent?: Node.Query;
        canBeEmpty?: boolean;
    }): Plot.Type<null>;
}
export declare namespace Plot {
    const End: {
        tokenType: Token.Type.Close;
        toJSON(): any;
    };
    class Tag<Param = unknown> extends BaseTag<Param> implements Node.Tag.Shared<Param> {
        readonly type: Plot.Type<Param>;
        private constructor();
        static new<Param>(type: Plot.Type<Param>, param: Param, marks: Mark.Set): Tag<Param>;
        eq(other: Node | Node.Tag): boolean;
        create(content?: readonly Node[]): Plot;
        withMarks(marks: Mark.Set): Tag<Param>;
        split(atEnd: boolean): Tag<Param>;
        get tokenType(): Token.Type.Open;
        get inlineContent(): boolean;
        get isTextblock(): boolean;
        get isLeaf(): false;
        get isPlot(): true;
        get isDoc(): boolean;
        toString(): string;
    }
    class Type<Param = unknown> extends BaseType<Param> {
        readonly default: Plot.Tag<Param> | null;
        readonly isolating: boolean;
        readonly defining: boolean;
        readonly neutral: boolean;
        readonly preserveWhitespace: boolean;
        readonly orientation: "row" | "column";
        readonly spec: Plot.Spec<any>;
        private constructor();
        static new<Param>(name: string, flags: NodeFlag, spec: Plot.Spec<Param>): Type<Param>;
        static define<T>(name: string, spec: Plot.Spec<T>): Type<T>;
        of(param: Param, marks?: Mark.Set): Tag<Param>;
        get inlineContent(): boolean;
        get isTextblock(): boolean;
        get isDoc(): boolean;
        get isLeaf(): false;
        get isPlot(): true;
        get canBeEmpty(): boolean;
    }
    interface Spec<Param> extends Node.Spec<Param> {
        blockContent?: Node.Query;
        inlineContent?: Node.Query | true;
        canBeEmpty?: boolean;
        cursorBarrier?: boolean;
        defaultBlock?: boolean;
        preserveWhitespace?: boolean;
        isolating?: boolean;
        orientation?: "row" | "column";
        defining?: boolean;
        neutral?: boolean;
        autoJoin?: boolean | ((before: Plot.Tag, after: Plot.Tag) => boolean);
        preserveOnSplitAtEnd?: boolean;
    }
    class Doc extends Plot {
        readonly schema: Schema;
        private constructor();
        static new(schema: Schema, children: readonly Node[]): Doc;
        get length(): number;
        slicePlot(content: Token[], from: number, to: number): void;
        resolve(pos: number): Pos;
        resolveNode(pos: number): Pos.Node | null;
        resolvePlot(pos: number): Pos.Plot | null;
        contextAt(pos: number, maxDepth?: number): readonly Plot.Tag[];
        slice(from: number, to?: number): readonly Token[];
        static noValidate<T>(f: () => T): T;
    }
}
export {};
