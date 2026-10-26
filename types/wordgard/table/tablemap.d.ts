// Generated from vendor/wordgard/src/table/tablemap.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Plot } from "wordgard-vendor/doc/index";
export declare class Rect {
    readonly startCol: number;
    readonly startRow: number;
    readonly endCol: number;
    readonly endRow: number;
    constructor(startCol: number, startRow: number, endCol: number, // Not inclusive
    endRow: number);
}
type Problem = {
    type: "collision";
    pos: number;
} | {
    type: "missing";
    row: number;
    n: number;
} | {
    type: "overlong_rowspan";
    pos: number;
    n: number;
};
declare class MapData {
    readonly table: Plot;
    readonly width: number;
    readonly height: number;
    readonly map: number[];
    readonly problems: Problem[] | null;
    readonly cellEnds: Map<number, number>;
    constructor(table: Plot, width: number, height: number, map: number[], problems: Problem[] | null, cellEnds: Map<number, number>);
}
export declare class TableMap {
    readonly start: number;
    readonly data: MapData;
    constructor(start: number, data: MapData);
    get width(): number;
    get height(): number;
    get table(): Plot;
    get tablePos(): number;
    cellRect(pos: number): Rect;
    nearestCell(pos: number, bias: -1 | 1): {
        from: number;
        to: number;
    };
    cellEnd(pos: number): number;
    rectBetween(a: number, b: number): Rect;
    cellsInRect(rect: Rect): number[];
    cellAt(col: number, row: number): number | null;
    rowPos(row: number): number;
    cellInsertionPos(col: number, row: number): number;
    getCell(pos: number): Plot;
    cellsOverlapRectangle(rect: Rect): boolean;
    static get(table: Plot, start: number): TableMap;
}
export {};
