// Generated from vendor/wordgard/src/state/bidi.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
export declare class BidiSpan {
    readonly from: number;
    readonly to: number;
    readonly level: number;
    get ltr(): boolean;
    constructor(from: number, to: number, level: number);
    side(end: boolean, ltr: boolean): number;
    forward(forward: boolean, ltr: boolean): boolean;
    static find(order: readonly BidiSpan[], index: number, assoc: number): number;
    static strongDir(ch: number): boolean | null;
}
export type Isolate = {
    from: number;
    to: number;
    ltr: boolean;
    inner: readonly Isolate[];
};
export declare function isolatesEq(a: readonly Isolate[], b: readonly Isolate[]): boolean;
export declare function computeOrder(line: string, ltr: boolean, isolates: readonly Isolate[]): BidiSpan[];
