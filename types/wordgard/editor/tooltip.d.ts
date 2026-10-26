// Generated from vendor/wordgard/src/editor/tooltip.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { GardState, Transaction } from "wordgard-vendor/state/index";
import { Wordgard } from "./editor";
export interface Tooltip {
    pos: number;
    end?: number;
    create(wg: Wordgard): Tooltip.View;
    above?: boolean;
    strictSide?: boolean;
    arrow?: boolean;
    clip?: boolean;
}
export declare namespace Tooltip {
    function configure(config?: {
        position?: "fixed" | "absolute";
        parent?: HTMLElement;
        tooltipSpace?: (wg: Wordgard) => DOMRect;
    }): GardState.Extension;
    interface View {
        dom: HTMLElement;
        offset?: {
            x: number;
            y: number;
        };
        getCoords?: (pos: number) => DOMRect;
        overlap?: boolean;
        update?(update: Wordgard.Update): void;
        connect?(wg: Wordgard): void;
        disconnect?(wg: Wordgard): void;
        remove?(wg: Wordgard): void;
        positioned?(space: DOMRect): void;
        resize?: boolean;
    }
    const show: GardState.Facet<Tooltip | null, readonly (Tooltip | null)[]>;
    function get<T extends Tooltip>(wg: Wordgard, tooltip: T): ReturnType<T["create"]> | null;
    function get<T extends Tooltip.View>(wg: Wordgard, create: (wg: Wordgard) => T): T | null;
    function reposition(wg: Wordgard): void;
    function hover(source: HoverTooltipSource, options?: hover.Spec): {
        extension: GardState.Extension;
        active: GardState.Field<readonly Tooltip[]>;
    };
    namespace hover {
        type Spec = {
            hideOn?: (tr: Transaction, tooltip: Tooltip) => boolean;
            hideOnChange?: boolean | "touch";
            hoverTime?: number;
        };
        function has(state: GardState): boolean;
        const closeAll: Transaction.Effect<null>;
    }
}
export type HoverTooltipSource = (wg: Wordgard, pos: number, side: -1 | 1) => Tooltip | readonly Tooltip[] | null | Promise<Tooltip | readonly Tooltip[] | null>;
