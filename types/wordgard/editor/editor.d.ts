// Generated from vendor/wordgard/src/editor/editor.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { GardState, Transaction, GardSelection } from "wordgard-vendor/state/index";
import { ChangeSet, Node } from "wordgard-vendor/doc/index";
import { PhraseSet } from "wordgard-vendor/phrases/index";
import { StyleModule, StyleSpec } from "style-mod";
import { DocTile } from "./tile";
import { DOMObserver } from "./domobserver";
import { InputState } from "./input";
import { ViewState } from "./viewstate";
import { DOMNode } from "./dom";
export declare class Wordgard {
    static create(spec: Wordgard.Spec): Wordgard;
    get state(): GardState;
    get flushedState(): GardState;
    get composing(): boolean;
    get compositionStarted(): boolean | null;
    get editable(): boolean;
    get focusable(): boolean;
    root: DocumentOrShadowRoot;
    get win(): Window & typeof globalThis;
    readonly dom: HTMLElement;
    readonly scrollDOM: HTMLElement;
    readonly contentDOM: HTMLElement;
    private announceDOM;
    private id;
    inputState: InputState;
    viewState: ViewState;
    docTile: DocTile;
    plugins: PluginInstance[];
    private pluginMap;
    private editorAttrs;
    private contentAttrs;
    private styleModules;
    connected: boolean;
    private flushing;
    private willFlush;
    private flushFunc;
    lastFlush: number;
    private autoColorScheme;
    observer: DOMObserver;
    private domReaders;
    private domWriters;
    private pendingTransactionListeners;
    private constructor();
    setConnected(value: boolean): void;
    dispatch(tr: Transaction | Transaction.Spec): void;
    scheduleFlush(): void;
    flush(): void;
    private scrollTo;
    private runUpdate;
    private updatePlugins;
    private updateAttrs;
    private checkDir;
    private showAnnouncements;
    private mountStyles;
    scheduleDOMRead(read: (wg: Wordgard) => void): void;
    scheduleDOMWrite(write: (wg: Wordgard) => void): void;
    plugin<T extends Wordgard.Plugin.Value>(plugin: Wordgard.Plugin<T>): T | null;
    private ensureFlushed;
    moveToLineBoundary(start: GardSelection, forward: boolean): GardSelection.Text | null;
    moveVertically(start: GardSelection, forward: boolean, distance?: number, allowNode?: boolean): GardSelection | null;
    domAtPos(pos: number, assoc?: -1 | 1): {
        node: DOMNode;
        offset: number;
    };
    nodeDOM(pos: number): Element | null;
    posAtDOM(node: DOMNode, offset?: number): number;
    nodeFromDOM(node: Element): {
        pos: number;
        node: Node;
    } | null;
    posAtCoords(coords: {
        x: number;
        y: number;
    }): {
        pos: number;
        side: -1 | 1;
        target: number | null;
    };
    coordsAtPos(pos: number, assoc?: -1 | 1): DOMRect;
    coordsForElement(pos: number): DOMRect | null;
    get hasFocus(): boolean;
    focus(): void;
    get themeClasses(): string;
    static scrollIntoView(pos: number | GardSelection, options?: Wordgard.ScrollSpec): Transaction.Effect<unknown>;
    static label(label: string | PhraseSet.Ref): GardState.Extension;
    static clipboardOutputFilter: GardState.Facet<(content: import("wordgard-vendor/doc/index").Slice, state: GardState) => import("wordgard-vendor/doc/index").Slice, readonly ((content: import("wordgard-vendor/doc/index").Slice, state: GardState) => import("wordgard-vendor/doc/index").Slice)[]>;
    static clipboardOutputHTMLFilter: GardState.Facet<(html: string, state: GardState) => string, readonly ((html: string, state: GardState) => string)[]>;
    static clipboardTextSerializer: GardState.Facet<(slice: import("wordgard-vendor/doc/index").Slice, state: GardState) => string | null, readonly ((slice: import("wordgard-vendor/doc/index").Slice, state: GardState) => string | null)[]>;
    static clipboardOutputTextFilter: GardState.Facet<(html: string, state: GardState) => string, readonly ((html: string, state: GardState) => string)[]>;
    static clipboardInputFilter: GardState.Facet<(content: import("wordgard-vendor/doc/index").Slice, state: GardState) => import("wordgard-vendor/doc/index").Slice, readonly ((content: import("wordgard-vendor/doc/index").Slice, state: GardState) => import("wordgard-vendor/doc/index").Slice)[]>;
    static clipboardInputHTMLFilter: GardState.Facet<(html: string, state: GardState) => string, readonly ((html: string, state: GardState) => string)[]>;
    static clipboardTextParser: GardState.Facet<(text: string, state: GardState) => import("wordgard-vendor/doc/index").Slice | null, readonly ((text: string, state: GardState) => import("wordgard-vendor/doc/index").Slice | null)[]>;
    static clipboardInputTextFilter: GardState.Facet<(html: string, state: GardState) => string, readonly ((html: string, state: GardState) => string)[]>;
    static pasteHandler: GardState.Facet<(wg: Wordgard, event: InputEvent, slice: import("wordgard-vendor/doc/index").Slice) => boolean, readonly ((wg: Wordgard, event: InputEvent, slice: import("wordgard-vendor/doc/index").Slice) => boolean)[]>;
    static dropHandler: GardState.Facet<(wg: Wordgard, event: DragEvent, pos: number, move: {
        from: number;
        to: number;
    } | null, slice: import("wordgard-vendor/doc/index").Slice) => boolean, readonly ((wg: Wordgard, event: DragEvent, pos: number, move: {
        from: number;
        to: number;
    } | null, slice: import("wordgard-vendor/doc/index").Slice) => boolean)[]>;
    static isFocusChange: Transaction.Annotation.Type<boolean>;
    static styleModule: GardState.Facet<StyleModule, readonly StyleModule[]>;
    static domEventHandler<Event extends keyof HTMLElementEventMap>(event: Event, handler: (event: HTMLElementEventMap[Event], wg: Wordgard) => boolean | void): GardState.Extension;
    static domEventObserver<Event extends keyof HTMLElementEventMap>(event: Event, observer: (event: HTMLElementEventMap[Event], wg: Wordgard) => void): GardState.Extension;
    static scrollHandler: GardState.Facet<(wg: Wordgard, target: {
        from: number;
        to: number;
    } & Wordgard.ScrollSpec) => boolean, readonly ((wg: Wordgard, target: {
        from: number;
        to: number;
    } & Wordgard.ScrollSpec) => boolean)[]>;
    static exceptionSink: GardState.Facet<(exception: any) => void, readonly ((exception: any) => void)[]>;
    static transactionListener: GardState.Facet<(trs: readonly Transaction[], wg: Wordgard) => void, readonly ((trs: readonly Transaction[], wg: Wordgard) => void)[]>;
    private runTransactionListeners;
    static updateListener: GardState.Facet<(update: Wordgard.Update) => void, readonly ((update: Wordgard.Update) => void)[]>;
    static editable: GardState.Facet<boolean, boolean>;
    static cursorBlinkRate: GardState.Facet<number, number>;
    static mouseSelectionStyle: GardState.Facet<import("./input").MakeSelectionStyle, readonly import("./input").MakeSelectionStyle[]>;
    static dragMovesSelection: GardState.Facet<(event: MouseEvent) => boolean, readonly ((event: MouseEvent) => boolean)[]>;
    getScrollMargins(): {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
    static theme(spec: Record<string, StyleSpec>): GardState.Extension;
    static colorScheme: GardState.Facet<"auto" | "dark" | "light", "auto" | "dark" | "light">;
    configureColorScheme(scheme: "light" | "dark"): void;
    static styles(spec: Record<string, StyleSpec>): GardState.Extension;
    static scrolling(height: number | string): GardState.Extension;
    static cspNonce: GardState.Facet<string, string>;
    static contentAttributes: GardState.Facet<AttrSource, readonly AttrSource[]>;
    static editorAttributes: GardState.Facet<AttrSource, readonly AttrSource[]>;
    static announce: Transaction.Effect.Type<string>;
    static DocTile: typeof DocTile;
    static coveredMargins: GardState.Facet<(wg: Wordgard) => Partial<DOMRect> | null, readonly ((wg: Wordgard) => Partial<DOMRect> | null)[]>;
}
export declare namespace Wordgard {
    interface Spec extends Partial<GardState.Spec> {
        state?: GardState;
        parent?: Element | DocumentFragment;
        scrollTo?: Transaction.Effect<any>;
    }
    type ScrollSpec = {
        y?: "nearest" | "start" | "end" | "center";
        x?: "nearest" | "start" | "end" | "center";
        yMargin?: number;
        xMargin?: number;
    };
    interface MouseSelectionStyle {
        get: (curEvent: MouseEvent, extend: boolean) => GardSelection;
        update: (update: Wordgard.Update) => boolean | void;
    }
    function logException(state: GardState, exception: any, context?: string): void;
    class Plugin<V extends Wordgard.Plugin.Value> {
        readonly create: (wg: Wordgard) => V;
        extension: GardState.Extension;
        private constructor();
        static define<V extends Wordgard.Plugin.Value>(create: (wg: Wordgard) => V, provide?: (plugin: Wordgard.Plugin<V>) => GardState.Extension): Plugin<V>;
        static fromClass<V extends Wordgard.Plugin.Value>(cls: {
            new (wg: Wordgard): V;
        }, provide?: (plugin: Wordgard.Plugin<V>) => GardState.Extension): Plugin<V>;
        eventHandler<Event extends keyof HTMLElementEventMap>(event: Event, handler: (event: HTMLElementEventMap[Event], wg: Wordgard, value: V) => boolean | void): GardState.Extension;
        eventObserver<Event extends keyof HTMLElementEventMap>(event: Event, observer: (event: HTMLElementEventMap[Event], wg: Wordgard, value: V) => void): GardState.Extension;
    }
    namespace Plugin {
        interface Value {
            update?(update: Wordgard.Update): void;
            docUpdate?(wg: Wordgard): void;
            connect?(wg: Wordgard): void;
            disconnect?(wg: Wordgard): void;
            remove?(wg: Wordgard): void;
        }
    }
    class Update {
        readonly editor: Wordgard;
        readonly startState: GardState;
        readonly state: GardState;
        readonly transactions: readonly Transaction[];
        flags: number;
        readonly changes: ChangeSet;
        private constructor();
        static create(wg: Wordgard, startState: GardState, state: GardState, transactions: readonly Transaction[], flags?: number): Update;
        get geometryChanged(): boolean;
        get focusChanged(): boolean;
        get docChanged(): boolean;
        get selectionSet(): boolean;
        get empty(): boolean;
    }
}
export declare const editorPlugin: GardState.Facet<Wordgard.Plugin<Wordgard.Plugin.Value>, readonly Wordgard.Plugin<Wordgard.Plugin.Value>[]>;
declare class PluginInstance {
    spec: Wordgard.Plugin<any>;
    mustUpdate: Wordgard.Update | null;
    value: Wordgard.Plugin.Value | null;
    deactivated: boolean;
    constructor(spec: Wordgard.Plugin<any>);
    update(wg: Wordgard): this;
    docUpdate(wg: Wordgard): void;
    connect(wg: Wordgard): void;
    disconnect(wg: Wordgard): void;
    remove(wg: Wordgard): void;
    deactivate(remove: Wordgard | null): void;
}
export type AttrSource = Record<string, string | null> | ((wg: Wordgard) => Record<string, string | null>);
export declare const enum UpdateFlag {
    Focus = 1,
    Geometry = 2
}
export {};
