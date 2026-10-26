// Generated from vendor/wordgard/src/editor/changes.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
export type Changes = readonly number[];
export declare function addUpdated(sections: Changes, updated: readonly number[]): number[];
export declare function addSection(sections: number[], len: number, ins: number): void;
export declare function separateChange(changes: Changes, fromB: number, toB: number): number[] | null;
export declare function isEmpty(changes: Changes): boolean;
export declare function addRange(ranges: number[], from: number, to: number): void;
export declare function joinRanges(ranges: number[][]): number[];
