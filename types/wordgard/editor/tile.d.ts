// Generated from vendor/wordgard/src/editor/tile.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Node, Mark, ChangeSet, Attributes } from "wordgard-vendor/doc/index";
import { GardState, TextblockMap } from "wordgard-vendor/state/index";
import { Widget, DecoElt, DecoSet } from "./decoration";
import { DOMNode } from "./dom";
import { Changes } from "./changes";
import { type CompositionInfo } from "./input";
import { type Wordgard } from "./editor";
export declare const enum TileFlag {
    None = 0,
    NodeInner = 1,
    PlotContent = 2,
    Spanning = 4,
    Wrapper = 8,
    Point = 16,
    PointBefore = 32,
    PointAfter = 64,
    PointSide = 96,
    Composition = 128,
    Synced = 256,// Node has been synced. DOM content matches child list / text content, child array becomes read-only
    Atom = 512,// Composite tile whose length isn't determined by child length
    HasContent = 1024,// EltTile whose elt has a content hole
    AfterContent = 2048,// Tiles that sit after their parent's content position
    ContentNotLast = 4096,// EltTile that has children with AfterContent flag
    Dirty = 8192
}
declare const enum Orientation {
    Row = 0,
    Col = 1
}
export declare class CoordPos {
    readonly pos: number;
    readonly target: number | null;
    readonly side: -1 | 1;
    readonly vertOutside: boolean;
    constructor(pos: number, target: number | null, side: -1 | 1, vertOutside: boolean);
    map(mapping: ChangeSet): CoordPos;
    static create(pos: number, side: -1 | 1, target?: number | null, vertOutside?: boolean): CoordPos;
}
export declare class TilePos {
    readonly tile: Tile;
    readonly offset: number;
    readonly pos: number;
    constructor(tile: Tile, offset: number, pos: number);
    get dom(): Element | Text;
}
export declare abstract class Tile {
    dom: Element | Text;
    parent: CompositeTile | null;
    abstract children: Tile[];
    length: number;
    flags: TileFlag;
    constructor(dom: Element | Text, flags: number);
    get isAtom(): boolean;
    get isNodeOuter(): boolean;
    get isNodeInner(): boolean;
    get isNode(): boolean;
    get isPlotContent(): boolean;
    get isText(): boolean;
    get isDoc(): boolean;
    get isWrapper(): boolean;
    get isSpanning(): boolean;
    get isComposition(): boolean;
    get isPoint(): boolean;
    get tag(): Node.Tag | null;
    posBeforeChild(child: Tile, ownStart?: number): number;
    get posBefore(): number;
    get posAtStart(): number;
    get posAfter(): number;
    get posAtEnd(): number;
    get boundary(): 0 | 1;
    get firstChild(): Tile | null;
    get lastChild(): Tile | null;
    get nodeParent(): Tile;
    ignoreEvent(event: Event): boolean;
    get ignoreMutations(): boolean;
    toString(): string;
    abstract sync(): void;
    connect(): void;
    disconnect(reused?: Map<Tile, Reused>): void;
    nearestNode(): Tile;
    markDirty(): void;
    posAtCoords(state: GardState, x: number, y: number): CoordPos;
    abstract posAtCoordsInner(start: number, state: GardState, x: number, y: number, textblock: TextblockMap | null, orientation: Orientation): CoordPos;
    static get(node: DOMNode): Tile | undefined;
}
export declare class CompositeTile extends Tile {
    children: Tile[];
    dom: Element;
    addChild(child: Tile): void;
    sync(): void;
    syncChildren(): void;
    posAtCoordsInner(start: number, state: GardState, x: number, y: number, textblock: TextblockMap | null, orientation: Orientation): CoordPos;
    posAtCoordsRow(start: number, state: GardState, x: number, y: number, textblock: TextblockMap | null): CoordPos | null;
    posAtCoordsCol(start: number, state: GardState, x: number, y: number, textblock: TextblockMap | null): CoordPos;
}
export declare function ltrAt(state: GardState, pos: number, assoc: -1 | 1, textblock?: TextblockMap | null): boolean;
export declare class DocTile extends CompositeTile {
    readonly state: GardState;
    readonly cursorWrapper: Mark.Set | null;
    readonly decoSet: DecoSet;
    dom: Element;
    constructor(state: GardState, dom: Element, cursorWrapper: Mark.Set | null, decoSet: DecoSet);
    static create(state: GardState, dom: Element, wg: Wordgard): DocTile;
    get isDoc(): boolean;
    get tag(): import("wordgard-vendor/doc/index").Plot.Tag<unknown>;
    update(state: GardState, changes: Changes, wg: Wordgard, composition?: CompositionInfo | null): DocTile;
    updateRanges(state: GardState, decoSet: DecoSet, changes: Changes, wg: Wordgard, composition?: CompositionInfo | null): DocTile;
    nearest(dom: DOMNode, requireNode?: boolean): Tile | null;
    owns(elt: Tile): boolean;
    nodeTile(pos: number): TextTile | Tile | null;
    resolve(pos: number, side?: -1 | 1): TilePos;
    posFromDOM(dom: DOMNode, offset: number, bias?: -1 | 1): number;
    posBeforeDOM(dom: DOMNode): number | null;
    coordsForElement(pos: number): DOMRect | null;
}
export declare class EltTile extends CompositeTile {
    readonly elt: DecoElt;
    readonly _tag: Node.Tag | null;
    dom: Element;
    parent: CompositeTile;
    constructor(elt: DecoElt, _tag: Node.Tag | null, flags: number, length: number, dom: Element);
    get isSpanning(): boolean;
    get isNodeOuter(): boolean;
    get isAtom(): boolean;
    get boundary(): 0 | 1;
    get tag(): Node.Tag | null;
    get contentTile(): EltTile | null;
    static of(elt: DecoElt, tag: Node.Tag | null, flags: number, length: number, dom?: Element | null): EltTile;
}
export declare class WidgetTile extends Tile {
    readonly widget: Widget<any>;
    readonly _tag: Node.Tag | null;
    constructor(widget: Widget<any>, _tag: Node.Tag | null, flags: TileFlag, dom: Element | Text, length?: number);
    get isNodeOuter(): boolean;
    get isAtom(): boolean;
    get tag(): Node.Tag | null;
    get children(): Tile[];
    ignoreEvent(event: Event): boolean;
    get ignoreMutations(): boolean;
    sync(): void;
    connect(): void;
    disconnect(reused?: Map<Tile, Reused>): void;
    toString(): string;
    posAtCoordsInner(start: number, state: GardState, x: number, y: number, textblock: TextblockMap | null, orientation: Orientation): CoordPos;
}
export declare class TextTile extends Tile {
    text: string;
    dom: Text;
    constructor(text: string, dom: Text, flags?: TileFlag);
    get children(): Tile[];
    get isText(): boolean;
    get isNodeOuter(): boolean;
    get isAtom(): boolean;
    sync(): void;
    toString(): string;
    posAtCoordsInner(start: number, state: GardState, x: number, y: number, textblock: TextblockMap | null, orientation: Orientation): CoordPos;
    static of(text: string): TextTile;
}
declare const enum Reused {
    Full = 1,
    DOM = 2
}
export declare function updateAttributes(dom: Element, a: Attributes, b: Attributes): boolean;
export {};
