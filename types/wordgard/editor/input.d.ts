// Generated from vendor/wordgard/src/editor/input.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { GardSelection, GardState, Transaction } from "wordgard-vendor/state/index";
import { Plot, ChangeSet, Mark, Slice } from "wordgard-vendor/doc/index";
import { Wordgard } from "./editor";
export declare const eventHandler: GardState.Facet<{
    event: string;
    handler: (event: Event, wg: Wordgard) => boolean | void;
}, Record<string, ((event: Event, wg: Wordgard) => boolean | void)[]>>;
export declare const eventObserver: GardState.Facet<{
    event: string;
    observer: (event: Event, wg: Wordgard) => void;
}, Record<string, ((event: Event, wg: Wordgard) => void)[]>>;
type InputEventData = {
    inputType: string;
    data: string | null;
    domRange: {
        from: number;
        to: number;
    } | null;
};
export declare class InputState {
    readonly wg: Wordgard;
    shiftKey: boolean;
    lastKeyCode: number;
    lastKeyTime: number;
    lastTouchTime: number;
    lastTouchEvent: TouchEvent | null;
    lastScrollTop: number;
    lastScrollLeft: number;
    lastContextMenu: number;
    scrollHandlers: ((event: Event) => boolean | void)[];
    handlers: {
        [event: string]: {
            observers: readonly HandlerFunction[];
            handlers: readonly HandlerFunction[];
        };
    };
    composing: null | {
        changes: number;
        target: Text | null;
    };
    compositionEndedAt: number;
    compositionPendingKey: boolean;
    wrappingComposition: Mark.Set | null;
    mouseSelection: MouseSelection | null;
    draggedContent: GardSelection | null;
    notifiedFocused: boolean;
    suppressEvents: boolean;
    pendingInputEvent: InputEventData | null;
    domDoc: Plot.Doc;
    _domMapping: ChangeSet;
    domMappingIndex: number;
    domChanges: ChangeSet | null;
    constructor(wg: Wordgard);
    handleEvent(event: Event): void;
    runHandlers(type: string, event: Event): void;
    ensureHandlers(state: GardState): void;
    keydown(event: KeyboardEvent): boolean;
    ignoreDuringComposition(event: Event): boolean;
    startMouseSelection(mouseSelection: MouseSelection): void;
    update(update: Wordgard.Update): void;
    getDOMPos(node: Node, offset: number): number;
    get domMapping(): ChangeSet;
    get unflushedSelection(): boolean;
    posAtDOM(node: Node, offset: number, assoc?: -1 | 1): number;
    beforeInput(event: InputEvent, data: InputEventData): false | undefined;
    addDOMChange(change: ChangeSet): void;
    findComposition(prev: Text | null): Text | null;
    getCompositionInfo(wg: Wordgard): CompositionInfo | null;
    clearComposition(): boolean;
    abortComposition(): void;
    recordTouch(e: TouchEvent): void;
    connect(): void;
    disconnect(): void;
}
type HandlerFunction = (wg: Wordgard, event: Event) => boolean | void;
export declare const modifierCodes: number[];
export declare const mouseSelectionStyle: GardState.Facet<MakeSelectionStyle, readonly MakeSelectionStyle[]>;
export type MakeSelectionStyle = (wg: Wordgard, event: MouseEvent) => Wordgard.MouseSelectionStyle | null;
declare class MouseSelection {
    private wg;
    private startEvent;
    private style;
    private mustSelect;
    dragging: null | boolean;
    extend: boolean;
    lastEvent: MouseEvent;
    scrollParents: {
        x?: HTMLElement;
        y?: HTMLElement;
    };
    scrollSpeed: {
        x: number;
        y: number;
    };
    scrolling: number;
    constructor(wg: Wordgard, startEvent: MouseEvent, style: Wordgard.MouseSelectionStyle, mustSelect: boolean);
    start(event: MouseEvent): void;
    move(event: MouseEvent): void;
    up(event: MouseEvent): void;
    disconnect(): void;
    setScrollSpeed(sx: number, sy: number): void;
    scroll(): void;
    select(event: MouseEvent): void;
    update(update: Wordgard.Update): void;
}
export declare const dragBehavior: GardState.Facet<(event: MouseEvent) => boolean, readonly ((event: MouseEvent) => boolean)[]>;
export declare const dropHandler: GardState.Facet<(wg: Wordgard, event: DragEvent, pos: number, move: {
    from: number;
    to: number;
} | null, slice: Slice) => boolean, readonly ((wg: Wordgard, event: DragEvent, pos: number, move: {
    from: number;
    to: number;
} | null, slice: Slice) => boolean)[]>;
export declare const pasteHandler: GardState.Facet<(wg: Wordgard, event: InputEvent, slice: Slice) => boolean, readonly ((wg: Wordgard, event: InputEvent, slice: Slice) => boolean)[]>;
export declare const isFocusChange: Transaction.Annotation.Type<boolean>;
export type CompositionInfo = {
    fromB: number;
    toB: number;
    text: string;
    target: Text | null;
    wrapCursor?: Mark.Set | null;
};
export {};
