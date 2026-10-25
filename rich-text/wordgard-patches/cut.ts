import {Wordgard} from 'wordgard/editor';
import {GardSelection} from 'wordgard/state';

// Wordgard's copy and cut read its selection. Bring the editor up to date with
// the DOM first, so what was just selected or typed is what gets copied.
function syncBeforeClipboard(_event: ClipboardEvent, wg: Wordgard) {
  wg.flush();
  return false;
}

// A cut the browser performs itself (its menu, or a cut Wordgard left to it)
// arrives as beforeinput "deleteByCut", which Wordgard maps to no command:
// delete the selection as one undoable transaction.
function deleteByCut(event: InputEvent, wg: Wordgard) {
  if (event.inputType != 'deleteByCut') return false;
  wg.flush();
  const {state} = wg;
  if (state.readOnly || state.selection.empty) return false;
  wg.dispatch({
    changes: state.selection.ranges.map(range => ({from: range.from, to: range.to, fit: true})),
    selection: (cx, changes) => GardSelection.near(cx, changes.mapPos(state.selection.from, -1), 1),
    scrollIntoView: true,
    userEvent: 'delete.cut'
  });
  return true;
}

export const cutHandling = [
  Wordgard.domEventHandler('copy', syncBeforeClipboard),
  Wordgard.domEventHandler('cut', syncBeforeClipboard),
  Wordgard.domEventHandler('beforeinput', deleteByCut)
];
