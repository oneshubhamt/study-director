// Build-only facade over the same Wordgard command implementations.
export {Command} from 'wordgard-vendor/command/command';
export {
  insertText, insertLineBreak, enter, transposeChars, undo, redo,
  moveByUnit, moveByWord, moveByLine, moveByPage, moveToLineSide,
  moveToTextblockSide, moveToDocSide, selectAll,
  deleteUnit, deleteWord, deleteToLineEnd, deleteLine, killToLineEnd, yankKilled,
  setTextblockType, unwrapBlock, wrapBlock, toggleBlock,
  setAlignment, setDirection, toggleList,
  toggleMark, toggleEmphasis, toggleStrong, toggleUnderline,
  listIsActive,
} from 'wordgard-vendor/command/commands';
export {
  liftEmptyBlock, splitTextblock, enterInCode, deleteSelection,
  deleteBackward, deleteForward, deleteEmptyPlot, joinBackward,
  joinListItems, joinForward, joinBlocks, selectedTextblocks,
  clearNonFitting, findWrappable, wrapBlockRange, findUnwrappable,
  doUnwrapBlock, canAddMarkInRange, autoJoinBlocks,
} from 'wordgard-vendor/command/helper';
