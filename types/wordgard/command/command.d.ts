// Generated from vendor/wordgard/src/command/command.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { type Wordgard } from "wordgard-vendor/editor/index";
import { GardState, Transaction } from "wordgard-vendor/state/index";
export type Command<Param = null> = (target: Wordgard, param: Param) => boolean | Transaction.Spec;
export declare namespace Command {
    type Pure<Param = null> = (target: {
        state: GardState;
    }, param: Param) => false | Transaction.Spec;
    function handler<Param>(command: Command<Param>, handler: Command<Param>): GardState.Extension;
    function bind<Param>(command: Command<Param>, param: Param): Command.Bound;
    type Bound = {
        readonly tag: unique symbol;
        readonly command: Command<any>;
        readonly param: any;
    };
    function dispatch(wg: Wordgard, command: Command<null> | Command.Bound): boolean;
    function dispatch<Param>(wg: Wordgard, command: Command<Param>, param: Param): boolean;
}
