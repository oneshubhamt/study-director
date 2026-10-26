// Generated from vendor/wordgard/src/state/selection.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Plot, Node, ChangeSet, Mark, Pos, Slice } from "wordgard-vendor/doc/index";
import type { GardState } from "./state";
type wgNode = Node;
export declare class SelectionType {
    readonly tag: string;
    readonly cls: any;
    readonly toJSON: (sel: GardSelection) => unknown;
    readonly fromJSON: (doc: Plot.Doc, json: any) => GardSelection;
    constructor(tag: string, cls: any, toJSON: (sel: GardSelection) => unknown, fromJSON: (doc: Plot.Doc, json: any) => GardSelection);
}
export declare abstract class GardSelection {
    readonly anchor: number;
    readonly head: number;
    readonly goalColumn?: number | undefined;
    protected constructor(anchor: number, head: number, goalColumn?: number | undefined);
    get from(): number;
    get to(): number;
    get empty(): boolean;
    get isCursor(): boolean;
    get ranges(): readonly {
        from: number;
        to: number;
    }[];
    get replacementRange(): {
        from: number;
        to: number;
    };
    get domSelection(): {
        head: number;
        headSide: -1 | 1;
        anchor: number;
        anchorSide: -1 | 1;
    };
    toSlice(doc: Plot.Doc): Slice;
    get headSide(): -1 | 1;
    get anchorSide(): -1 | 1;
    abstract eq(other: GardSelection): boolean;
    eqPos(other: GardSelection): boolean;
    abstract map(change: ChangeSet, cx: GardSelection.Context, assoc?: -1 | 1): GardSelection;
    check(config: GardState.Configuration, doc: Plot.Doc): void;
    resolve(doc: Plot.Doc): GardSelection.Resolved;
    toJSON(state: GardState): unknown;
    static fromJSON(cx: GardSelection.Context, json: unknown): GardSelection;
    static cursor(pos: number, side?: -1 | 1, goalColumn?: number): GardSelection.Text;
    static near(cx: GardSelection.Context, pos: number, side?: -1 | 1, goalColumn?: number): GardSelection.Text;
    static range(anchor: number, head?: number, headSide?: -1 | 1, goalColumn?: number): GardSelection.Text;
    static undirectionalRange(from: number, to: number): GardSelection.Text;
    static node(pos: number, node: wgNode, goalColumn?: number): GardSelection.Node;
    nextNormalCursor(cx: GardSelection.Context, forward?: boolean): GardSelection.Text | null;
    skipWord(cx: GardSelection.Context, forward?: boolean): GardSelection.Text | null;
    static atStart(cx: GardSelection.Context, block?: Pos.Plot): GardSelection.Text;
    static atEnd(cx: GardSelection.Context, block?: Pos.Plot): GardSelection.Text;
    static selectionType: GardState.Facet<SelectionType>;
}
export declare namespace GardSelection {
    function define<T extends GardSelection, JSON extends object>(tag: string, cls: {
        new (...args: any[]): T;
    }, toJSON: (sel: T) => JSON, fromJSON: (doc: Plot.Doc, json: JSON) => T): any;
    class Text extends GardSelection {
        private _headSide;
        readonly directional: boolean;
        readonly marks: Mark.Set | undefined;
        private constructor();
        static createInner(anchor: number, head: number, side: -1 | 1 | undefined, directional: boolean, goalColumn?: number, marks?: Mark.Set): Text;
        get headSide(): -1 | 1;
        get anchorSide(): -1 | 1;
        static create(spec: GardSelection.Text.Spec): Text;
        map(change: ChangeSet, cx: GardSelection.Context, assoc?: -1 | 1): GardSelection;
        eq(other: GardSelection): boolean;
    }
    namespace Text {
        type Spec = {
            anchor: number;
            head?: number;
            headSide?: -1 | 1;
            goalColumn?: number;
            marks?: Mark.Set;
            directional?: boolean;
        };
        type JSON = {
            anchor: number;
            head?: number;
            side?: -1 | 1;
            directional?: boolean;
            marks?: Record<string, any>;
        };
        const type: SelectionType;
    }
    class Node extends GardSelection {
        readonly node: wgNode;
        private constructor();
        static create(pos: number, node: wgNode, goalColumn?: number): Node;
        map(change: ChangeSet, cx: GardSelection.Context, assoc?: -1 | 1): Node | Text;
        eq(other: GardSelection): boolean;
    }
    namespace Node {
        type JSON = {
            pos: number;
        };
        const type: SelectionType;
    }
    class Resolved {
        readonly doc: Plot.Doc;
        readonly selection: GardSelection;
        anchor: Pos;
        head: Pos;
        private _ranges;
        private constructor();
        static create(doc: Plot.Doc, selection: GardSelection): Resolved;
        get from(): Pos;
        get to(): Pos;
        get ranges(): readonly {
            from: Pos;
            to: Pos;
        }[];
        private resolveRanges;
        get replacementRange(): {
            from: Pos;
            to: Pos;
        };
        get activeMarks(): Mark.Set;
    }
    type Context = {
        doc: Plot.Doc;
        config: GardState.Configuration;
    };
}
export declare function cursorAtStart(cx: GardSelection.Context, block?: Pos.Plot): GardSelection.Text;
export declare function wordAt(state: GardState, pos: number, bias: -1 | 1): GardSelection.Text;
export {};
