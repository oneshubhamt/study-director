// Generated from vendor/wordgard/src/editor/dom.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Tile } from "./tile";
export type DOMNode = Node;
declare global {
    interface Node {
        wgTile?: Tile;
    }
}
export declare function getSelection(root: DocumentOrShadowRoot): Selection | null;
export declare function hasSelection(dom: Element, selection: SelectionRange): boolean;
export declare function isEquivalentPosition(node: Node, off: number, targetNode: Node | null, targetOff: number): boolean;
export declare function domIndex(node: Node): number;
export declare function rmDOM(dom: ChildNode): ChildNode | null;
export declare function isBlockElement(node: Node): boolean;
export declare function isBlocking(node: Node): number | boolean;
export declare function maxOffset(node: Node): number;
export declare function windowRect(win: Window): DOMRect;
export declare function getScale(elt: HTMLElement, rect: DOMRect): {
    scaleX: number;
    scaleY: number;
};
export declare function scrollRectIntoView(dom: HTMLElement, rect: DOMRect, side: -1 | 1, x: "nearest" | "start" | "end" | "center", y: "nearest" | "start" | "end" | "center", xMargin: number, yMargin: number, ltr: boolean): void;
export declare function scrollableParents(dom: HTMLElement): {
    x: HTMLElement | undefined;
    y: HTMLElement | undefined;
};
export interface SelectionRange {
    focusNode: Node | null;
    focusOffset: number;
    anchorNode: Node | null;
    anchorOffset: number;
}
export declare class DOMSelectionState implements SelectionRange {
    anchorNode: Node | null;
    anchorOffset: number;
    focusNode: Node | null;
    focusOffset: number;
    eq(domSel: SelectionRange): boolean;
    get empty(): boolean;
    setRange(range: SelectionRange): void;
    set(anchorNode: Node | null, anchorOffset: number, focusNode: Node | null, focusOffset: number): void;
}
export declare function textRange(node: Text, from: number, to?: number): Range;
export declare function clearScratchRange(): void;
export declare function singleRect(target: Element | Text | Range, bias: -1 | 1, preferWide?: boolean): DOMRect;
export declare function getRoot(node: Node | null | undefined): DocumentOrShadowRoot | null;
export declare function textNodeBefore(startNode: Node, startOffset: number): Text | null;
export declare function textNodeAfter(startNode: Node, startOffset: number): Text | null;
