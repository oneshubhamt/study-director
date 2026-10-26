// Generated from vendor/wordgard/src/editor/keymap.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Command } from "wordgard-vendor/command/index";
import { GardState } from "wordgard-vendor/state/index";
import { PhraseSet } from "wordgard-vendor/phrases/index";
import { type Wordgard } from "./editor";
export declare class KeyBinding {
    readonly spec: KeyBinding.Spec;
    extension: GardState.Extension;
    private constructor();
    static of(spec: KeyBinding.Spec): KeyBinding;
}
export declare namespace KeyBinding {
    interface Spec {
        char?: string;
        key?: string;
        mac?: string;
        win?: string;
        linux?: string;
        run: Command.Bound | Command;
        shift?: Command.Bound | Command;
        any?: (wg: Wordgard, event: KeyboardEvent) => boolean;
        allowDefault?: boolean;
        description?: PhraseSet.Ref | string;
        shiftDescription?: PhraseSet.Ref | string;
        group?: Group;
    }
    function handle(wg: Wordgard, event: KeyboardEvent): boolean;
    const keymap: GardState.Field.Derived<readonly KeyBinding[]>;
    const source: GardState.Facet<KeyBinding, readonly KeyBinding[]>;
    const useDefaultKeymap: GardState.Facet<boolean, boolean>;
    class Group {
        readonly description: PhraseSet.Ref | string;
        readonly rank: number;
        private constructor();
        static define(spec: {
            description: PhraseSet.Ref | string;
            rank?: number;
        }): Group;
        static Inline: Group;
        static Block: Group;
        static History: Group;
    }
    function lookupByDescription(state: GardState, desc: string | PhraseSet.Ref): string | null;
    const defaultKeymap: readonly KeyBinding[];
}
type PlatformName = "mac" | "win" | "linux" | "key";
export declare const currentPlatform: PlatformName;
export declare function normalizeKeyName(name: string, platform: PlatformName): string;
export {};
