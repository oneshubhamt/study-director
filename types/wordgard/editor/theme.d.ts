// Generated from vendor/wordgard/src/editor/theme.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { GardState } from "wordgard-vendor/state/index";
import { StyleModule, StyleSpec } from "style-mod";
export declare const theme: GardState.Facet<string, string>;
export declare const colorScheme: GardState.Facet<"auto" | "dark" | "light", "auto" | "dark" | "light">;
export declare const styleID: string, baseLightID: string, baseDarkID: string;
export declare const lightDarkIDs: {
    "&light": string;
    "&dark": string;
};
export declare function buildTheme(main: string, spec: {
    [name: string]: StyleSpec;
}, scopes?: {
    [name: string]: string;
}): StyleModule;
export declare const baseStyles: StyleModule;
