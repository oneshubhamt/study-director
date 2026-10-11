/* Study Director's sole runtime gateway to Wordgard.
 * Upstream layout is normalized by the build-only wordgard-source facades;
 * Study Director compatibility behavior is normalized by wordgard-patches.
 * Application/editor code should import Wordgard primitives only from here. */
export {parseInertHTML} from './wordgard-patches/inert-html';
export {cutHandling} from './wordgard-patches/cut';

export {Wordgard,Decoration,PointSet,RangeSet,Widget,InputRule,KeyBinding,placeholder} from 'wordgard/editor';
export {GardState,GardSelection,Transaction} from 'wordgard/state';
export {
  Command,listIsActive,setTextblockType,setAlignment,toggleBlock,toggleList,toggleMark,
  canAddMarkInRange,selectedTextblocks,
} from 'wordgard/command';
export {history,redo,redoDepth,undo,undoDepth} from 'wordgard/history';
export {CellSelection,tableCore} from './wordgard-source/table';
export {ChangeSet,Elt,Leaf,Node,Plot,Mark,parse,serialize} from 'wordgard/doc';
export {
  Alignment,BlockCell,BlockHeaderCell,Blockquote,BulletList,Doc,Heading,HorizontalRule,
  LineBreak,Link,ListItem,OrderedList,Paragraph,Strikethrough,Subscript,Strong,Superscript,
  Table,TableRow,Underline,Emphasis,
} from 'wordgard/types';
