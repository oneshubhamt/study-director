// Generated from vendor/wordgard/src/doc/slice.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import type { Plot, Node, Leaf } from "./node";
import { Schema } from "./schema";
export type Token = Node | Plot.Tag | typeof Plot.End;
export declare namespace Token {
    enum Type {
        Open = 0,
        Close = 1,
        Node = 2
    }
    const End: {
        tokenType: Token.Type.Close;
        toJSON(): any;
    };
    type JSON = Node.JSON | ".";
    function fromJSON(schema: Schema, value: JSON): Plot.Tag<unknown> | {
        tokenType: Token.Type.Close;
        toJSON(): any;
    } | Node;
}
export declare class Slice {
    readonly content: readonly Token[];
    readonly context: readonly Plot.Tag[];
    readonly length: number;
    private constructor();
    static of(content: readonly Token[], context?: readonly Plot.Tag[]): Slice;
    concat(other: Slice): Slice;
    textContent(options?: {
        blockSeparator?: string;
        leafText?: string | ((node: Leaf) => string);
    }): string;
    static empty: Slice;
    toString(): string;
    static get(doc: Plot.Doc, from: number, to?: number): Slice;
    static run(tokens: readonly Token[], track: SliceWalker, startPos?: number): void;
    static concat(a: readonly Token[], b: readonly Token[]): Token[];
    static slice(tokens: readonly Token[], from: number, to?: number): readonly Token[];
    static eq(a: readonly Token[], b: readonly Token[]): boolean;
}
export interface SliceWalker {
    node(node: Node, pos: number): void;
    open(tag: Plot.Tag, pos: number): void;
    close(pos: number): void;
}
