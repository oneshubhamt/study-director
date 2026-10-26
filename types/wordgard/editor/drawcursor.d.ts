// Generated from vendor/wordgard/src/editor/drawcursor.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Mark, Node } from "wordgard-vendor/doc/index";
import { GardState } from "wordgard-vendor/state/index";
import type { Wordgard } from "./editor";
export declare const cursorBlinkRate: GardState.Facet<number, number>;
type CursorInfo = {
    left: number;
    top: number;
    size: number;
    horiz: boolean;
    style: CursorStyle | null;
} | null;
declare class CursorStyle {
    readonly height: number;
    readonly align: string;
    readonly color: string;
    readonly bold: boolean;
    readonly italic: boolean;
    constructor(height: number, align: string, color: string, bold: boolean, italic: boolean);
    static read(node: Element | Text, height: number): CursorStyle;
    eq(other: CursorStyle | null): boolean | null;
}
export declare class CursorLayer {
    readonly layer: HTMLElement;
    info: CursorInfo;
    cached: {
        style: CursorStyle;
        marks: Mark.Set;
        parent: Node.Tag;
    } | null;
    constructor(wg: Wordgard);
    update(update: Wordgard.Update): void;
    docUpdate(wg: Wordgard): void;
    remove(): void;
    positionCursor(wg: Wordgard): void;
}
export {};
