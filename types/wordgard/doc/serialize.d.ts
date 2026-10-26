// Generated from vendor/wordgard/src/doc/serialize.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Plot, Node } from "./node";
import { Slice } from "./slice";
import { Elt } from "./shape";
export declare function serialize(doc: Plot.Doc, options?: serialize.Options): Elt.Fragment;
export declare namespace serialize {
    interface Options {
        emitNewlines?: boolean;
        override?: (tag: Node.Tag) => Elt | null;
    }
    function node(node: Node, options?: serialize.Options): Elt | string;
    function slice(slice: Slice, options?: slice.Options): Elt.Fragment;
    namespace slice {
        interface Options extends serialize.Options {
            openAttr?: string;
            includeContext?: number;
        }
    }
}
