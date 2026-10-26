// Generated from vendor/wordgard/src/highlight-code/highlight.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Plot } from "wordgard-vendor/doc/index";
import { GardState } from "wordgard-vendor/state/index";
import { Language } from "./languages";
export declare function highlightCode(options?: {
    languages?: readonly Language[];
    getLanguage?: (block: Plot) => Language | null;
}): GardState.Extension;
