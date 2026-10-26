// Generated from vendor/wordgard/src/state/textblock.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Plot } from "wordgard-vendor/doc/index";
import { BidiSpan } from "./bidi";
import { type GardSelection } from "./selection";
export declare class TextblockMap {
    readonly start: number;
    readonly node: Plot;
    readonly ltr: boolean;
    readonly text: string;
    private _order;
    private config;
    private sections;
    private constructor();
    get order(): readonly BidiSpan[];
    static get(cx: GardSelection.Context, start: number, node: Plot): TextblockMap;
    private static create;
    toIndex(pos: number): number;
    fromIndex(index: number): number;
    moveVisually(start: number, side: number, forward: boolean, skipped?: string[]): {
        pos: number;
        side: -1 | 1;
    } | null;
    skipWord(start: number, side: number, forward: boolean, visually: boolean): {
        pos: number;
        side: -1 | 1;
    } | null;
    moveLogically(start: number, forward: boolean): {
        pos: number;
        side: -1 | 1;
    } | null;
}
