// Generated from vendor/wordgard/src/doc/text.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { type Node, type Leaf } from "./node";
export declare class TextOutput {
    readonly blockSep: string;
    readonly leafText?: ((node: Leaf) => string) | undefined;
    text: string;
    started: boolean;
    constructor(blockSep: string, leafText?: ((node: Leaf) => string) | undefined);
    serialize(node: Node): boolean;
    openBlock(): void;
}
