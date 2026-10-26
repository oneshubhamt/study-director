// Generated from vendor/wordgard/src/doc/pos.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import type { Node, Plot } from "./node";
import { Mark } from "./mark";
export declare class Pos {
    readonly parent: Pos.Plot;
    readonly pos: number;
    readonly index: number;
    readonly inText: number;
    private constructor();
    static create(parent: Pos.Plot, pos: number, index: number, inText: number): Pos;
    matchingParent(pred: (plot: _Plot) => boolean): Pos.Plot | null;
    advance(distance: number, walk?: Pos.Walker): Pos;
    walk(distance: number, walk: Pos.Walker): Pos;
    get nodeAfter(): Node | null;
    get nodeBefore(): Node | null;
    get textblockParent(): Pos.Plot | null;
    get depth(): number;
    parentAt(depth: number): Pos.Plot;
    isAtStart(parent: Pos.Plot): boolean;
    isAtEnd(parent: Pos.Plot): boolean;
    get doc(): Plot.Doc;
    marks(across?: Pos): Mark.Set;
    static resolve(doc: _Doc, pos: number): Pos;
    static resolveNode(doc: _Doc, pos: number): Pos.Node | null;
}
type _Node = Node;
type _Plot = Plot;
type _Doc = Plot.Doc;
type _Tag = Plot.Tag;
export declare namespace Pos {
    interface Walker {
        skip(node: _Node, pos: number, parent: Pos.Plot, index: number): void;
        enterPlot(node: _Plot, pos: number, parent: Pos.Plot, index: number): void | boolean;
        leavePlot(tag: _Tag, pos: number, parent: Pos.Plot, index: number): void;
    }
    class Node {
        readonly parent: Pos.Plot | null;
        readonly node: _Node;
        readonly pos: number;
        readonly index: number;
        protected constructor(parent: Pos.Plot | null, node: _Node, pos: number, index: number);
        static create(parent: Pos.Plot | null, node: _Node, pos: number, index: number): Node;
        get before(): number;
        get after(): number;
        get depth(): number;
        get doc(): _Doc;
        get isFirst(): boolean;
        get isLast(): boolean;
        get nextSibling(): _Node | null;
        get previousSibling(): _Node | null;
    }
    class Plot extends Pos.Node {
        node: _Plot;
        private constructor();
        static create(parent: Pos.Plot | null, node: _Plot, pos: number, index: number): Plot;
        get start(): number;
        get end(): number;
    }
}
export {};
