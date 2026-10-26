// Generated from vendor/wordgard/src/table/table.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { GardState } from "wordgard-vendor/state/index";
export declare function tables(config?: tables.Spec): GardState.Extension;
export declare namespace tables {
    type Spec = {
        headerCells?: boolean;
        cellSpanning?: boolean;
        cellContent?: "inline" | "block";
    };
    const correction: import("wordgard-vendor/state/index").Correction;
    const pasteHandler: GardState.Extension;
    const dropHandler: GardState.Extension;
}
