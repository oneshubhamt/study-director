// Generated from vendor/wordgard/src/editor/decoration.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { GardState } from "wordgard-vendor/state/index";
import { Mark, Mark as Mark_, Pos, Plot, Node, Shape as Shape_, ChangeSet, Schema, Elt } from "wordgard-vendor/doc/index";
import { RangeSet, PointSet, Set } from "wordgard-vendor/set/index";
import { Changes } from "./changes";
import { type Wordgard } from "./editor";
export declare class Widget<Param = unknown> {
    readonly value: Param;
    private constructor();
    static new<Param>(type: Widget.Type<Param>, value: Param): Widget<Param>;
    eq(other: any): boolean;
    static define<Param>(spec: Widget.Spec<Param>): Widget.Type<Param>;
    static create(spec: Widget.Spec<null>): Widget<null>;
    readonly type: Widget.Type<unknown extends Param ? any : Param>;
    render(wg: Wordgard): Element | Text;
    get hasContent(): boolean;
}
export declare namespace Widget {
    type Spec<Param> = {
        render: (value: Param, wg: Wordgard) => Element | Text;
        eq?: (a: Param, b: Param) => boolean;
        connect?: (value: Param, dom: Element | Text) => void;
        disconnect?: (value: Param, dom: Element | Text) => void;
        propagateEvent?: boolean | ((event: Event) => boolean);
        inFlow?: boolean;
        editable?: boolean;
    };
    class Type<Param> {
        readonly render: (value: Param, wg: Wordgard) => Element | Text;
        readonly eq: (a: Param, b: Param) => boolean;
        readonly propagateEvent: (event: Event) => boolean;
        readonly connect: ((value: Param, dom: Element | Text) => void) | null;
        readonly disconnect: ((value: Param, dom: Element | Text) => void) | null;
        readonly inFlow: boolean;
        readonly editable: boolean;
        private constructor();
        static new<Param>(spec: Widget.Spec<Param>): Type<Param>;
        of(value: Param): Widget<Param>;
    }
    const text: Type<string>;
    const editableText: Type<string>;
    const img: Widget<null>;
    const br: Widget<null>;
}
export type DecoElt = Elt<Widget | string>;
export declare namespace Decoration {
    type Shape = Widget | DecoElt;
    namespace Tag {
        function shape<T extends Node.Type.Ref<any>>(type: T, shape: Shape | ((tag: Node.Tag.For<T>) => Shape), config?: {
            atom?: boolean;
        }): GardState.Extension;
        namespace shape {
            function derived<T extends Node.Type<any>>(type: T, shape: (state: GardState) => Shape | ((tag: Node.Tag.For<T>) => Shape), config?: {
                atom?: boolean;
            }): GardState.Extension;
        }
        function wrapper(type: Node.Type.Ref<any>, wrapper: DecoElt, options?: {
            target?: string;
        }): GardState.Extension;
        function widget<T extends Node.Type.Ref<any>>(type: T, place: "before" | "after" | "start" | "end", widget: Widget | ((tag: Node.Tag.For<T>) => Widget)): GardState.Extension;
        namespace widget {
            function derived<T extends Node.Type.Ref<any>>(type: T, place: "before" | "after" | "start" | "end", widget: (state: GardState) => Widget | ((tag: Node.Tag.For<T>) => Widget)): GardState.Extension;
        }
        function attribute<T extends Node.Type.Ref<any>>(type: T, attr: string, value: string | ((tag: Node.Tag.For<T>) => string), options?: {
            target?: string;
        }): GardState.Extension;
    }
    namespace Mark {
        function shape<V>(type: Mark_.Type<V>, shape: Shape_.Element<V> | Shape_.Attribute<V> | Shape_.Attributes<V>): GardState.Extension;
        function shape(mark: Mark_<null>, shape: Shape_.Element<null> | Shape_.Attribute<null> | Shape_.Attributes<null>): GardState.Extension;
    }
    abstract class Point implements PointSet.Value {
        constructor();
        abstract eq(other: PointSet.Value): boolean;
        abstract side: number;
        abstract trackMode: ChangeSet.TrackMode | undefined;
        static widget(widget: Widget, options?: {
            side?: number;
            trackMode?: ChangeSet.TrackMode | undefined;
        }): Point;
        static attributes(attrs: Record<string, string>, options?: {
            target?: string;
        }): Point;
        static shape(shape: Shape): Point;
        static wrapper(wrapper: DecoElt, spec?: {
            target?: string;
        }): Point;
        static source: GardState.Facet<(state: GardState) => PointSet<Point>, readonly ((state: GardState) => PointSet<Point>)[]>;
        static set(source: Set.Source<Point>): Point.Set;
        static none: Point.Set;
    }
    namespace Point {
        type Set = PointSet<Point>;
    }
    abstract class Range implements RangeSet.Value {
        readonly query: Node.Query | null;
        readonly scope: DecorationScope;
        readonly inc: Inc;
        protected constructor(spec: Decoration.Range.Spec);
        get inclusiveStart(): boolean;
        get inclusiveEnd(): boolean;
        abstract eq(other: RangeSet.Value): boolean;
        static wrapper(tagName: string, spec: Decoration.Range.WrapperSpec): Range;
        static attribute(attr: string, value: string, options?: Decoration.Range.Spec): Range;
        static source: GardState.Facet<(state: GardState) => Range.Set, readonly ((state: GardState) => Range.Set)[]>;
        static set(source: Set.Source<Range>): Range.Set;
        static none: Range.Set;
    }
    namespace Range {
        interface Spec {
            inclusive?: boolean | "start" | "end";
            query?: Node.Query;
            scope?: "atom" | "inlineatom" | "all";
        }
        interface WrapperSpec extends Decoration.Range.Spec {
            attributes?: Record<string, string>;
            rank?: number;
            spanning?: boolean;
        }
        type Set = RangeSet<Range>;
    }
}
type TagWrapper = {
    type: Node.Type;
    elt: DecoElt;
    target: Elt.Selector | null;
};
declare const enum WidgetPlace {
    Before = 0,
    After = 1,
    Start = 2,
    End = 3
}
type TagWidget = {
    type: Node.Type;
    place: WidgetPlace;
    widget: Widget | ((tag: Node.Tag) => Widget);
};
type TagAttribute = {
    type: Node.Type;
    attr: string;
    value: (tag: Node.Tag) => string;
    target: Elt.Selector | null;
};
export declare function renderMarks(state: GardState, marks: Mark.Set, around: string): Element;
declare const enum DecorationScope {
    Atom = 1,
    InlineAtom = 2,
    All = 4
}
declare const enum Inc {
    None = 0,
    Start = 1,
    End = 2
}
declare class WrapperRangeDecoration extends Decoration.Range {
    readonly elt: Elt;
    readonly rank: number;
    readonly spanning: boolean;
    constructor(element: string, spec: Decoration.Range.WrapperSpec);
    eq(other: RangeSet.Value): boolean;
}
export type DecoSet = {
    points: Map<(state: GardState) => Decoration.Point.Set, Decoration.Point.Set>;
    ranges: Map<(state: GardState) => Decoration.Range.Set, Decoration.Range.Set>;
};
export declare function getDecoSet(state: GardState): DecoSet;
export declare function findChangedRanges(prevState: GardState, prevDeco: DecoSet, state: GardState, deco: DecoSet, sections: ChangeSet.Sections): Changes;
export interface DecoWalker {
    enter(node: Plot, shape: DecoElt, wrappers: readonly WrapperSource[]): void;
    leave(): void;
    node(node: Node, shape: Decoration.Shape, wrappers: readonly WrapperSource[], partial: number | undefined): void;
    nodePart(node: Node, length: number, done: boolean): void;
    widget(widget: Widget, side: number): void;
}
export type WrapperSource = Mark<any> | WrapperRangeDecoration;
export declare function renderWrapper(src: WrapperSource): DecoElt;
export declare const renderMarkWrapper: (arg: Mark<any>) => DecoElt;
export declare class DecoIterator {
    readonly state: GardState;
    readonly decoSet: DecoSet;
    tagShapes: Map<Node.Type, (tag: Node.Tag) => Decoration.Shape>;
    globalWidgets: readonly TagWidget[];
    globalWrappers: readonly TagWrapper[];
    globalAttrs: readonly TagAttribute[];
    markShapes: Map<Mark.Type, Mark.Type>;
    schema: Schema;
    pos: Pos;
    rangeCursor: Set.Cursor<Decoration.Range>;
    pointSets: readonly Decoration.Point.Set[];
    pointCursor: Set.Cursor<Decoration.Point>;
    endWidgets: boolean;
    constructor(state: GardState, decoSet: DecoSet);
    widgets(tag: Node.Tag, place: WidgetPlace, walker: DecoWalker): void;
    hasEndWidget(type: Node.Type): boolean;
    nodeWrappers(tag: Node.Tag, active: readonly Decoration.Range[], atom: boolean): readonly WrapperSource[];
    walk(from: number, inclusiveStart: boolean, to: number, walker: DecoWalker): void;
    tagShape(tag: Node.Tag, active: Decoration.Range[]): Decoration.Shape;
    atomCache: Map<number, boolean>;
    hasAtomShape(pos: number): boolean;
}
export {};
