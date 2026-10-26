// Generated from vendor/wordgard/src/doc/shape.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { DOMElement } from "./helper";
import { type parse } from "./parse";
export declare class Elt<T = string> {
    readonly tagName: string;
    readonly attrs: Attributes;
    readonly children: readonly (T | Elt<T> | 0)[];
    private constructor();
    static create<T = string>(tagName: string, attrs: Attributes, children: readonly (T | Elt<T> | 0)[]): Elt<Exclude<T, Elt<any> | 0>>;
    static mk<T = string>(name: string, children?: (T | 0 | Elt<T>)[]): Elt<Exclude<T, Elt<any> | 0>>;
    static mk<T = string>(name: string, attrs: Record<string, string>, children?: readonly (T | 0 | Elt<T>)[]): Elt<Exclude<T, Elt<any> | 0>>;
    get hasContent(): boolean;
    eqTag(elt: Elt<any>): boolean;
    eqChildren(elt: Elt<T>): boolean;
    eq(other: any): boolean;
    outerDOM(doc?: Document): MathMLElement | SVGElement;
    wrap(wrapper: Elt<T>, target?: Elt.Selector): Elt<T>;
    addAttrs(attrs: Attributes, target?: Elt.Selector): Elt<T>;
    fill(content: readonly (0 | T | Elt<T>)[]): Elt<T>;
    private modifyBySelector;
    toHTML(this: Elt<string>): string;
    toDOM(this: Elt<string>, doc?: Document): Element;
    static empty: readonly any[];
    static hole: readonly [0];
}
export declare namespace Elt {
    class Fragment<T = string> {
        readonly content: readonly (T | Elt<T>)[];
        private constructor();
        static create<T = string>(content: readonly (T | Elt<T>)[]): Fragment<T>;
        toHTML(this: Fragment<string>): string;
        toDOM(this: Fragment<string>, doc?: Document): DocumentFragment;
    }
    class Selector {
        readonly tag: string | null;
        readonly classes: readonly string[];
        private constructor();
        eq(other: Elt.Selector): boolean;
        match(elt: Elt<any>): boolean;
        static parse(selector: string): Selector;
    }
}
export type Attributes = readonly string[];
export declare namespace Attributes {
    const none: Attributes;
    function eq(a: Attributes, b: Attributes): boolean;
    function compare(a: Attributes, b: Attributes): number;
    function merge(a: Attributes, b: Attributes): Attributes;
    function push(a: string[], name: string, value: string): void;
    function read(obj: Record<string, string | null>): Attributes;
    function get(attrs: Attributes, name: string): string | null;
}
export declare namespace Shape {
    type Element<Param> = {
        element: string;
        selector?: string;
        attributes?: Record<string, string> | ((param: Param) => Record<string, string>);
        readElement?: (element: DOMElement) => Param | typeof parse.Reject;
        atom?: boolean;
    };
    type Structure<Param> = {
        structure: Elt<string> | ((param: Param) => Elt<string>);
        atom?: boolean;
    };
    type Attribute<Param> = {
        attribute: string;
        value: (Param extends string ? 0 : never) | string | ((param: Param) => string | null);
        readAttribute?: (value: string) => Param | typeof parse.Reject;
        preferTarget?: string;
    };
    type Attributes<Param> = {
        attributes: Record<string, string> | ((param: Param) => Record<string, string>);
        preferTarget?: string;
    };
}
export declare class NodeShape<Param> {
    readonly atom: boolean;
    readonly create: (param: any) => Elt<string>;
    constructor(atom: boolean, create: (param: any) => Elt<string>);
    static from<Param>(name: string, leaf: boolean, spec: Shape.Element<Param> | Shape.Structure<Param>): NodeShape<Param>;
}
