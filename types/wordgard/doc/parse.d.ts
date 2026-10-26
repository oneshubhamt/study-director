// Generated from vendor/wordgard/src/doc/parse.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Schema } from "./schema";
import { Plot, Node, Leaf } from "./node";
import { Mark } from "./mark";
import { Slice } from "./slice";
type DOMElement = Element;
export declare function parse(schema: Schema, doc: Element | DocumentFragment, options?: parse.Options): Plot.Doc;
export declare namespace parse {
    type Options = {
        collapseWhiteSpace?: boolean;
        isOpen?: (elt: Element) => null | "start" | "end" | "start end";
        ruleSet?: parse.Rule.Set;
    };
    function slice(schema: Schema, doc: Element | DocumentFragment, options?: parse.Options): Slice;
    type Rule<Param = any> = Rule.Element<Param> | Rule.Attribute<Param>;
    namespace Rule {
        interface Element<Param> {
            selector: string;
            tag?: Leaf<Param> | Plot.Tag<Param> | Node.Type<Param>;
            mark?: Mark.Type<Param> | Mark<Param>;
            ignore?: boolean | "skip";
            param?: Param;
            readElement?: (element: DOMElement) => Param | typeof Reject;
            marksFrom?: string;
            contentElement?: string | ((elt: DOMElement) => DOMElement);
            ignoreContent?: string | ((elt: DOMElement) => boolean);
            precedence?: number;
        }
        interface Attribute<Param> {
            attribute: string;
            value?: string;
            mark?: Mark.Type<Param> | Mark<Param>;
            clearMark?: (mark: Mark<unknown>) => boolean;
            ignore?: boolean;
            param?: Param;
            readAttribute?: (value: string) => Param | typeof Reject;
            consuming?: boolean;
            precedence?: number;
        }
        class Set {
            readonly rules: readonly Rule[];
            elementRules: Rule.Element<unknown>[];
            attributeRules: Rule.Attribute<unknown>[];
            private constructor();
            static of(rules: readonly Rule[]): Set;
            static fromSchema(schema: Schema): Set;
            matchElement(elt: DOMElement): {
                rule: Rule.Element<unknown>;
                value?: unknown;
            } | null;
        }
    }
    const Reject: unique symbol;
}
export {};
