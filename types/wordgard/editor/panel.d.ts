// Generated from vendor/wordgard/src/editor/panel.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { GardState } from "wordgard-vendor/state/index";
import { Wordgard } from "./editor";
type PanelConfig = {
    topContainer?: HTMLElement;
    bottomContainer?: HTMLElement;
};
export interface Panel {
    dom: HTMLElement;
    top?: boolean;
    update?(update: Wordgard.Update): void;
    connect?(wg: Wordgard): void;
    disconnect?(wg: Wordgard): void;
    remove?(wg: Wordgard): void;
}
export declare namespace Panel {
    type Constructor = (wg: Wordgard) => Panel;
    const show: GardState.Facet<Constructor | null, readonly (Constructor | null)[]>;
    function get<T extends Panel>(wg: Wordgard, constructor: (wg: Wordgard) => T): T | null;
    function configure(config?: PanelConfig): GardState.Extension;
}
export {};
