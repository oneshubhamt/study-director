// Build-only menu-free table support facade for Study Director.
// Keeps Wordgard's canonical cell selection, correction, paste and drop semantics
// without reaching the generic table menu, dimension picker or table theme wrapper.
import {CellSelection} from '../../vendor/wordgard/src/table/cellselection';
import {tableCorrection} from '../../vendor/wordgard/src/table/correct';
import {tablePasteHandler,tableDropHandler} from '../../vendor/wordgard/src/table/tablepaste';

export {CellSelection};
export const tableCore=[CellSelection,tableCorrection,tablePasteHandler,tableDropHandler];
