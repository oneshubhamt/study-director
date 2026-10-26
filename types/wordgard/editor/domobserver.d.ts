// Generated from vendor/wordgard/src/editor/domobserver.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Wordgard } from "./editor";
import { DOMNode, DOMSelectionState } from "./dom";
export declare class DOMObserver {
    private wg;
    dom: HTMLElement;
    win: Window | null;
    observer: MutationObserver;
    active: boolean;
    selectionRange: DOMSelectionState;
    selectionChanged: boolean;
    resizeTimeout: number;
    queue: MutationRecord[];
    dirty: number[] | null;
    scrollTargets: HTMLElement[];
    resizeScroll: ResizeObserver | null;
    darkThemeQuery: MediaQueryList | null;
    constructor(wg: Wordgard);
    connect(): void;
    disconnect(): void;
    onScroll(e: Event): void;
    onResize(): void;
    onColorSchemeChange(): void;
    onSelectionChange(): void;
    pollSelection(): void;
    readSelectionRange(): boolean;
    setSelectionRange(anchor: {
        dom: DOMNode;
        offset: number;
    }, head: {
        dom: DOMNode;
        offset: number;
    }): void;
    ignore<T>(f: () => T): T;
    clear(): void;
    takeRecords(): MutationRecord[];
    addDirtyRange(from: number, to: number): void;
    processRecords(records: readonly MutationRecord[]): void;
    findMutation(record: MutationRecord): [number, number] | null;
    takeDirty(): number[] | null;
}
