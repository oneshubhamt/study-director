// Generated from vendor/wordgard/src/doc/helper.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
export type DOMElement = Element;
export declare const none: readonly any[];
export declare function compareDeep(a: any, b: any): boolean;
export declare function eqArray<T extends {
    eq: (other: T) => boolean;
}>(a: readonly T[], b: readonly T[]): boolean;
export declare function validate<T>(validator: string | ((value: T) => void) | undefined, value: T): T;
