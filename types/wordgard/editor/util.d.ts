// Generated from vendor/wordgard/src/editor/util.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { GardState } from "wordgard-vendor/state/index";
export declare function eqArray<T extends {
    eq(b: T): boolean;
}>(a?: readonly T[] | null, b?: readonly T[] | null): boolean;
export declare const exceptionSink: GardState.Facet<(exception: any) => void, readonly ((exception: any) => void)[]>;
export declare function logException(state: GardState, exception: any, context?: string): void;
