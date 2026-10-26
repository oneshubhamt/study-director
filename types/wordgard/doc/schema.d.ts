// Generated from vendor/wordgard/src/doc/schema.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Plot, Node, Leaf } from "./node";
import { Mark } from "./mark";
export declare class Schema {
    readonly elements: readonly Schema.Element[];
    readonly nodes: readonly Node.Type[];
    readonly marks: readonly Mark.Type[];
    private plotContent;
    private markTarget;
    private nodeGroup;
    readonly docTag: Plot.Tag<null>;
    readonly lineBreak: Leaf | null;
    private nodesByName;
    private marksByName;
    private wrappingCache;
    private validated;
    private constructor();
    doc(children: readonly Node[]): Plot.Doc;
    validate(node: Node): void;
    validateTag(tag: Node | Plot.Tag): void;
    validateMark(mark: Mark<any>, node: Node.Type): void;
    has(elt: Mark<any> | Mark.Type | Node.Type.Ref<any>): boolean;
    matchNode(node: Node.Type, q: Node.Query): boolean;
    markAllowed(mark: Mark.Type, node: Node.Type): boolean;
    sharesContent(a: Plot.Type, b: Plot.Type): boolean;
    withMarksFrom<T extends Node.Tag>(from: Node.Tag, to: T): T;
    canContain(parent: Plot.Type, child: Node.Type): boolean;
    defaultContentTag(parent: Plot.Type): Node.Tag | null;
    defaultContentPlot(parent: Plot.Type): Plot.Tag | null;
    createDefault(parent: Plot.Type): Node;
    createAndFill(parent: Node.Tag): Node;
    findWrapping(parent: Plot.Type, child: Node.Type): readonly Plot.Tag[] | null;
    private findWrappingInner;
    getMark(name: string): Mark.Type | undefined;
    getNode(name: string): Node.Type | undefined;
    static define(spec: readonly Schema.Element[]): Schema;
    nodeFromJSON(json: Node.JSON): Node;
    tagFromJSON(json: Node.JSON): Leaf<unknown> | Plot.Tag<unknown>;
    marksFromJSON(json: Record<string, any>): Mark.Set;
    docFromJSON(json: Node.JSON): Plot.Doc;
}
export declare namespace Schema {
    type Element = Node.Tag | Node.Type | Mark | Mark.Type | Schema.Override;
    class Override {
        readonly type: Mark.Type | Node.Type;
        readonly target?: ((query: Node.Query) => Node.Query) | undefined;
        readonly content?: ((query: Node.Query) => Node.Query) | undefined;
        readonly group?: readonly Node.Group[] | undefined;
        private constructor();
        eq(other: Schema.Override): boolean;
        tag: "schema.override";
        static markTarget(mark: Mark.Type | Mark, target: Node.Query | ((target: Node.Query) => Node.Query)): Override;
        static plotContent(plot: Plot.Type | Plot.Tag, content: Node.Query | ((content: Node.Query) => Node.Query)): Override;
        static nodeGroup(node: Node.Type | Node.Tag, group: Node.Group | readonly Node.Group[]): Override;
    }
}
