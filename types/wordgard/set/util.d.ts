// Generated from vendor/wordgard/src/set/util.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { ChangeSet } from "wordgard-vendor/doc/index";
export declare function findAbove(array: readonly number[], start: number, n: number): number;
export declare function addReplacements(changes: ChangeSet, replace: readonly {
    from: number;
    to: number;
}[]): ChangeSet.Sections;
