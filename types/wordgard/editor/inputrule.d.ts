// Generated from vendor/wordgard/src/editor/inputrule.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { GardState, Transaction } from "wordgard-vendor/state/index";
import { Plot, Pos } from "wordgard-vendor/doc/index";
export declare class InputRule {
    readonly expr: RegExp;
    readonly apply: (state: GardState, match: InputRule.MatchArray) => Transaction.Spec | null;
    extension: GardState.Extension;
    lookahead: RegExp | undefined;
    inCode: boolean;
    private constructor();
    static define(spec: InputRule.Spec): InputRule;
    static wrapping(expr: RegExp, tag: Plot.Tag | ((match: InputRule.MatchArray) => Plot.Tag), empty?: boolean): InputRule;
    static textblockType(expr: RegExp, tag: Plot.Tag | ((match: InputRule.MatchArray) => Plot.Tag), empty?: boolean): InputRule;
}
export declare namespace InputRule {
    interface Spec {
        expr: RegExp;
        apply: ((state: GardState, match: InputRule.MatchArray) => Transaction.Spec | null) | string;
        lookahead?: RegExp;
        inCode?: boolean;
    }
    type Match = {
        from: Pos;
        to: Pos;
        text: string;
    };
    type MatchArray = readonly (InputRule.Match | null)[] & {
        0: InputRule.Match;
    };
    const emDash: InputRule;
    const ellipsis: InputRule;
    const openDoubleQuote: InputRule;
    const closeDoubleQuote: InputRule;
    const openSingleQuote: InputRule;
    const closeSingleQuote: InputRule;
    const smartQuotes: readonly InputRule[];
}
