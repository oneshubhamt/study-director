// Build-only history facade for Study Director. The build removes upstream's
// undo/redo menu buttons from this module (build/wordgard-source-patches.mjs).
export {history, undo, redo, undoDepth, redoDepth} from '../../vendor/wordgard/src/history/history';
