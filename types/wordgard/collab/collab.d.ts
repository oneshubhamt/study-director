// Generated from vendor/wordgard/src/collab/collab.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { GardState, Transaction, Correction } from "wordgard-vendor/state/index";
import { ChangeSet, Plot } from "wordgard-vendor/doc/index";
export declare function collab(config?: collab.Config): GardState.Extension;
export declare namespace collab {
    type Config = {
        startVersion?: number;
        clientID?: string;
        corrections?: readonly Correction[];
        sharedEffects?: (tr: Transaction) => readonly Transaction.Effect<any>[];
    };
    interface Update {
        version: number;
        clientID: string;
        changes: ChangeSet;
        effects?: readonly Transaction.Effect<unknown>[];
    }
    function receive(state: GardState, updates: readonly collab.Update[]): Transaction;
    function sendableUpdate(state: GardState): collab.Update | null;
    function hasUnsentUpdate(state: GardState): boolean;
    function getSyncedVersion(state: GardState): number;
    function getClientID(state: GardState): string;
    function transformUpdate(update: collab.Update, over: readonly {
        doc: Plot.Doc;
        changes: ChangeSet;
        clientID: string;
    }[], corrections?: readonly Correction[]): collab.Update | null;
}
