// Generated from vendor/wordgard/src/editor/dialog.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Transaction } from "wordgard-vendor/state/index";
import { Tooltip } from "./tooltip";
import { Wordgard } from "./editor";
export interface Dialog {
    key?: any;
    content?: (wg: Wordgard, close: () => void) => Element | DocumentFragment;
    label?: string;
    input?: {
        [attr: string]: string;
    };
    submitLabel?: string;
    class?: string;
    focus?: string | boolean;
    closedBy?: (tr: Transaction) => boolean;
    tooltip?: Omit<Tooltip, "create">;
    positioningHint?: DOMRect | true;
}
export declare namespace Dialog {
    function show(wg: Wordgard, config: Dialog): {
        close: () => void;
        result: Promise<HTMLFormElement | null>;
    };
    function get(wg: Wordgard, key: any): {
        dom: HTMLElement | null;
        close: () => void;
    } | null;
}
export declare namespace PositioningHint {
    function runWith<T>(hint: () => DOMRect, run: () => T): T;
    function get(): DOMRect | null;
}
