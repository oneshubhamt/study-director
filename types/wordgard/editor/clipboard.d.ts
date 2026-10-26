// Generated from vendor/wordgard/src/editor/clipboard.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Slice, Pos } from "wordgard-vendor/doc/index";
import { GardState } from "wordgard-vendor/state/index";
export declare const clipboardOutputFilter: GardState.Facet<(content: Slice, state: GardState) => Slice, readonly ((content: Slice, state: GardState) => Slice)[]>;
export declare const clipboardOutputHTMLFilter: GardState.Facet<(html: string, state: GardState) => string, readonly ((html: string, state: GardState) => string)[]>;
export declare const clipboardTextSerializer: GardState.Facet<(slice: Slice, state: GardState) => string | null, readonly ((slice: Slice, state: GardState) => string | null)[]>;
export declare const clipboardOutputTextFilter: GardState.Facet<(html: string, state: GardState) => string, readonly ((html: string, state: GardState) => string)[]>;
export declare const clipboardInputFilter: GardState.Facet<(content: Slice, state: GardState) => Slice, readonly ((content: Slice, state: GardState) => Slice)[]>;
export declare const clipboardInputHTMLFilter: GardState.Facet<(html: string, state: GardState) => string, readonly ((html: string, state: GardState) => string)[]>;
export declare const clipboardTextParser: GardState.Facet<(text: string, state: GardState) => Slice | null, readonly ((text: string, state: GardState) => Slice | null)[]>;
export declare const clipboardInputTextFilter: GardState.Facet<(html: string, state: GardState) => string, readonly ((html: string, state: GardState) => string)[]>;
export declare function writeClipboard(state: GardState, slice: Slice, data: DataTransfer): void;
export declare function readClipboard(state: GardState, data: DataTransfer, targetContext: Pos, plain: boolean): Slice | null;
