// Generated from vendor/wordgard/src/editor/selection.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { GardSelection } from "wordgard-vendor/state/index";
import { Wordgard } from "./editor";
import { type CoordPos } from "./tile";
import { SelectionRange } from "./dom";
export declare function setDOMSelection(wg: Wordgard): void;
export declare function readDOMSelection(wg: Wordgard, range: SelectionRange): GardSelection.Text;
export declare function selectionFromTouch(event: TouchEvent, wg: Wordgard): GardSelection.Node | GardSelection.Text;
export declare function rangeForClick(wg: Wordgard, pos: CoordPos, type: number): GardSelection;
export declare function moveVertically(wg: Wordgard, start: GardSelection, forward: boolean, distance?: number, selectNode?: boolean): GardSelection | null;
export declare function moveToLineBoundary(wg: Wordgard, start: GardSelection, forward: boolean): GardSelection.Text | null;
