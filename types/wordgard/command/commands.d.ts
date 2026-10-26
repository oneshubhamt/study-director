// Generated from vendor/wordgard/src/command/commands.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { Plot, Node, Mark } from "wordgard-vendor/doc/index";
import { GardState } from "wordgard-vendor/state/index";
import { Command } from "./command";
export declare const insertText: Command.Pure<{
    from: number;
    to: number;
    insert: string;
    userEvent: string;
}>;
export declare const insertLineBreak: Command.Pure;
export declare const enter: Command.Pure;
export declare const deleteUnit: Command.Pure<"forward" | "backward">;
export declare const deleteWord: Command.Pure<"forward" | "backward">;
export declare const deleteToLineEnd: Command<"forward" | "backward">;
export declare const killToLineEnd: Command;
export declare const yankKilled: Command;
export declare const deleteLine: Command;
export declare const transposeChars: Command.Pure;
export declare const setTextblockType: Command.Pure<Plot.Tag>;
export declare const unwrapBlock: Command.Pure<Node.Query | null>;
export declare const wrapBlock: Command.Pure<Plot.Tag>;
export declare const toggleBlock: Command.Pure<Plot.Tag>;
export declare const toggleMark: Command.Pure<Mark>;
export declare const toggleEmphasis: Command.Pure;
export declare const toggleStrong: Command.Pure;
export declare const toggleUnderline: Command.Pure;
export declare const setAlignment: Command.Pure<null | "start" | "end" | "center" | "left" | "right">;
export declare const setDirection: Command.Pure<null | "ltr" | "rtl" | "auto">;
export declare const toggleList: Command.Pure<Plot.Tag>;
export declare const listIsActive: (listTag: Plot.Tag) => (state: GardState) => boolean;
export declare const moveByUnit: Command.Pure<{
    dir: "left" | "right" | "forward" | "backward";
    extend?: boolean;
}>;
export declare const moveByWord: Command.Pure<{
    dir: "left" | "right";
    extend?: boolean;
}>;
export declare const moveByLine: Command<{
    dir: "up" | "down";
    extend?: boolean;
}>;
export declare const moveByPage: Command<{
    dir: "up" | "down";
    extend?: boolean;
}>;
export declare const moveToLineSide: Command<{
    dir: "left" | "right" | "forward" | "backward";
    extend?: boolean;
}>;
export declare const moveToTextblockSide: Command<{
    dir: "left" | "right" | "forward" | "backward";
    extend?: boolean;
}>;
export declare const moveToDocSide: Command.Pure<{
    side: "start" | "end";
    extend?: boolean;
}>;
export declare const selectAll: Command.Pure;
export declare const undo: Command;
export declare const redo: Command;
