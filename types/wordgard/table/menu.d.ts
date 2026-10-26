// Generated from vendor/wordgard/src/table/menu.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { GardState } from "wordgard-vendor/state/index";
import { Menu } from "wordgard-vendor/command/index";
export declare function tableMenu(): GardState.Extension;
export declare namespace tableMenu {
    const createTable: Menu.Submenu;
    const modifyTable: Menu.Submenu;
    const toggleHeader: Menu.Button;
    const addRowAbove: Menu.Button;
    const addRowBelow: Menu.Button;
    const deleteRow: Menu.Button;
    const addColumnBefore: Menu.Button;
    const addColumnAfter: Menu.Button;
    const deleteColumn: Menu.Button;
    const mergeCells: Menu.Button;
    const splitCell: Menu.Button;
}
