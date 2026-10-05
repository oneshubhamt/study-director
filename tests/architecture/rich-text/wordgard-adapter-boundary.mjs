import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read=file=>fs.readFileSync(file,'utf8');
const posix=value=>value.split(path.sep).join('/');
function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const file=path.join(dir,entry.name);
    return entry.isDirectory()?walk(file):entry.isFile()?[file]:[];
  });
}

for(const file of ['rich-text/wordgard-adapter.ts','rich-text/typography.ts','rich-text/wordgard-patches/inert-html.ts','rich-text/wordgard-patches/cut.ts','build/wordgard-source-patches.mjs'])
  assert.ok(fs.existsSync(file),`Missing Wordgard architecture boundary: ${file}`);

const editor=read('rich-text/editor.ts');
assert.match(editor,/from ['"]\.\/wordgard-adapter['"]/,'Editor must use the Study Director Wordgard adapter.');
assert.doesNotMatch(editor,/vendor\/wordgard|wordgard-source\//,'Editor must not bypass the adapter.');
assert.match(editor,/engineVersion:__SD_WORDGARD_VERSION__/,'Runtime engine version must come from canonical build metadata.');
assert.match(editor,/focusOnMount\?:boolean/,'Rich editor mount must expose explicit focus intent instead of focusing by default.');
assert.match(editor,/if\(options\.focusOnMount\)queueMicrotask/,'Rich editor may focus only when the caller explicitly requests it.');
assert.doesNotMatch(editor,/refreshEditor\(\);queueMicrotask\(\(\)=>editor\.focus\(\)\)/,'Rich editor must not focus unconditionally after mount.');
assert.match(editor,/\.sd-rte-editor wg-placeholder\{display:inline;/,'Study Director must keep Wordgard placeholder content inline so a wrapped placeholder exposes per-line client rects rather than one multi-line caret box.');
assert.match(editor,/data-sd-suppress-gap-caret=true.*wg-cursor\.wg-cursor-h\{display:none!important\}/,'Atomic-gap caret suppression must remain scoped to atomic-node navigation and must not be repurposed for empty-editor caret sizing.');
assert.match(editor,/\.sd-rte-toolbar\{grid-row:1[\s\S]*?\.sd-rte-editor-host\{grid-row:2/,'Normal rich editor must keep the toolbar above the editor.');
assert.match(editor,/function mobileTouchLayout\(\)\{return matchMedia\('\(max-width:720px\)'\)\.matches&&\(matchMedia\('\(pointer: coarse\)'\)\.matches\|\|matchMedia\('\(any-pointer: coarse\)'\)\.matches\)\}/,'Focus-mode mobile toolbar routing must use the same coarse-pointer media contract as its CSS.');
assert.match(editor,/\.sd-rte-focus-body>\.sd-rte\{height:100%;min-height:0;grid-template-rows:minmax\(0,1fr\) auto auto\}[\s\S]*?\.sd-rte-focus-body>\.sd-rte>\.sd-rte-toolbar\{grid-row:2/,'Only mobile Focus Mode may place the toolbar below the editor.');
assert.match(editor,/visual\?\.addEventListener\('resize',syncViewport[\s\S]*?visual\?\.addEventListener\('scroll',syncViewport[\s\S]*?--sd-rte-focus-obscured-bottom/,'Focus Mode must track the visual viewport so the software keyboard cannot cover its bottom controls.');
assert.match(editor,/if\(selection instanceof GardSelection\.Node&&atomicNode\(selection\.node\)\)return atomicBackspace\(wg\);wg\.flush\(\);return atomicBackspace\(wg\)/,'Mobile beforeinput must delete an existing atomic node selection before any DOM-selection flush.');
assert.match(editor,/function coarsePointerAvailable\(\)\{return navigator\.maxTouchPoints>0\|\|matchMedia\('\(pointer: coarse\)'\)\.matches\|\|matchMedia\('\(any-pointer: coarse\)'\)\.matches\}/,'Mobile table resize affordance must recognize both touch capability and coarse pointers.');
assert.match(editor,/\.sd-rte-table-ruler-handle\{[^}]*top:50%;[^}]*width:44px;height:44px[\s\S]*?\.sd-rte-table-ruler-handle::before\{[^}]*width:7px;height:24px/,'Mobile table resizing must expose a 44px touch target with a compact midpoint grip.');
assert.match(editor,/tableRuler\.addEventListener\('pointerdown',[\s\S]*?beginTableResize\(event,target,editor\)/,'Mobile table grips must share the canonical desktop table-resize engine.');
const styles=read('source/styles/core.css');
assert.match(styles,/\.workspace-overlay-rich-text \.workspace-overlay-head\{flex-wrap:nowrap\}[\s\S]*?\.workspace-overlay-rich-text \.workspace-overlay-header-content\{order:0;flex:0 0 auto;flex-basis:auto;width:auto\}/,'Rich-text Focus Mode header must remain one line on mobile.');
assert.match(styles,/--sd-rte-focus-obscured-bottom,0px/,'Mobile Focus Mode geometry must consume the visual-viewport keyboard inset.');
const app=read('source/app.html');
assert.match(app,/if\(candidate&&!mounted\.has\(candidate\)&&!pending\.has\(candidate\)\)return activate\(candidate\);/,'Automatic view synchronization must mount editors without focus intent.');
assert.match(app,/function onFocusIn\(event\).*activate\(field,\{focus:true\}\);/,'Explicit textarea focus must preserve the user focus intent across rich-editor mounting.');
assert.match(app,/focusOnMount:options\.focus===true/,'Application focus intent must be forwarded explicitly to the rich editor.');

for(const file of walk('rich-text').filter(file=>file.endsWith('.ts')&&!posix(file).includes('/wordgard-source/')&&!posix(file).includes('/wordgard-patches/')&&!file.endsWith('wordgard-adapter.ts'))){
  assert.doesNotMatch(read(file),/vendor\/wordgard|from ['"]wordgard\//,`${file} bypasses wordgard-adapter.ts.`);
}

const typography=read('rich-text/typography.ts');
assert.match(typography,/from ['"]\.\/wordgard-adapter['"]/,'Typography extensions must use the adapter.');
assert.match(read('rich-text/wordgard-source/history.ts'),/from '\.\.\/\.\.\/vendor\/wordgard\/src\/history\/history'/u,'History comes from upstream; the build removes its menu buttons.');
assert.match(read('rich-text/wordgard-adapter.ts'),/export \{cutHandling\} from '\.\/wordgard-patches\/cut'/u,'Cut handling is a Study Director extension behind the adapter.');
assert.match(editor,/tableCore,history\(\),cutHandling,/u,'The editor installs the adapter cut handling.');
assert.match(read('rich-text/wordgard-source/command.ts'),/killToLineEnd, yankKilled/,'Command facade must resolve keymap imports without enabling the default keymap.');

const buildSource=read('build/wordgard-bundle.mjs');
assert.match(buildSource,/plugins:\[wordgardSourcePatchPlugin\(\{root:ROOT\}\)\]/,'Rich-text build must apply the explicit Wordgard source patch layer.');
assert.match(buildSource,/source\/external\/rich-text\.js/,'Rich-text build must retain one external bundle target.');

console.log(JSON.stringify({status:'PASS',boundary:'wordgard-adapter'},null,2));
