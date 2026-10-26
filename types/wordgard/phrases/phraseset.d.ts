// Generated from vendor/wordgard/src/phrases/phraseset.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { GardState } from "wordgard-vendor/state/index";
export declare class PhraseSet<Tags extends string> {
    readonly phrases: {
        [tag in Tags]: string;
    };
    private constructor();
    private refs;
    get<Tag extends Tags>(state: GardState, tag: Tag, ...insert: any[]): string;
    ref<Tag extends Tags>(tag: Tag): PhraseSet.Ref;
    translate(phrases: {
        [tag in Tags]: string;
    }): GardState.Extension;
    translatePartial(phrases: {
        [tag in Tags]?: string;
    }): GardState.Extension;
    static define<Tags extends string>(phrases: {
        [tag in Tags]: string;
    }): PhraseSet<Tags>;
    static didChange(a: GardState, b: GardState): boolean;
}
export declare namespace PhraseSet {
    type Ref = (state: GardState, ...insert: any[]) => string;
    type Tag<Set extends PhraseSet<any>> = Set extends PhraseSet<infer T> ? T : never;
}
