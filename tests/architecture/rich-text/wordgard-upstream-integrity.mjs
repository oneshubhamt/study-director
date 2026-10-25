import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {WORDGARD_METADATA} from '../../../build/wordgard-metadata.mjs';
import {applyWordgardSourcePatch,wordgardSourcePatchPlugin} from '../../../build/wordgard-source-patches.mjs';
const withoutComments=source=>source.replace(/^\s*\/\/.*$/gmu,'');

const sha256=data=>crypto.createHash('sha256').update(data).digest('hex');
const shaFile=file=>sha256(fs.readFileSync(file));
const read=file=>fs.readFileSync(file,'utf8');
const posix=value=>value.split(path.sep).join('/');
function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const file=path.join(dir,entry.name);
    return entry.isDirectory()?walk(file):entry.isFile()?[file]:[];
  });
}

const pkg=JSON.parse(read('vendor/wordgard/package.json'));
assert.equal(pkg.version,WORDGARD_METADATA.version,'Vendored Wordgard version must match reviewed metadata.');
assert.equal(shaFile('vendor/wordgard/package.json'),WORDGARD_METADATA.packageSha256,'Vendored package manifest must match the reviewed upstream snapshot.');

const sourceRoot='vendor/wordgard/src';
const files=walk(sourceRoot).map(file=>({file,rel:posix(path.relative(sourceRoot,file))})).sort((a,b)=>a.rel.localeCompare(b.rel));
assert.equal(files.length,WORDGARD_METADATA.sourceFileCount,'Vendored Wordgard source-file count drifted.');
const manifest=files.map(({file,rel})=>`${rel}\0${shaFile(file)}\n`).join('');
assert.equal(sha256(manifest),WORDGARD_METADATA.sourceSnapshotSha256,'Vendored Wordgard source snapshot drifted.');
for(const [file,hash] of Object.entries(WORDGARD_METADATA.reviewedCoreSha256))assert.equal(shaFile(file),hash,`${file} drifted from reviewed upstream source.`);
assert.equal(shaFile('vendor/wordgard/src/editor/tile.ts'),WORDGARD_METADATA.tileSha256,'Reviewed table tile implementation drifted.');
assert.equal(fs.existsSync('vendor/wordgard/src/inert-html.ts'),false,'Study Director Trusted Types code must not enter upstream Wordgard.');
assert.equal(fs.existsSync('vendor/wordgard/src/history/core.ts'),false,'Study Director history patches must not enter upstream Wordgard.');

// Build rewrites name the upstream text they replace; they carry no whole-file
// fingerprints, so a new Wordgard version builds unless that text moved.

const patchedNode=applyWordgardSourcePatch('doc/node.ts',read('vendor/wordgard/src/doc/node.ts'));
assert.match(patchedNode,/slice\(from: number, to\?: number\)/);
assert.match(patchedNode,/to === undefined \? this\.length : to/);

const patchedClipboard=applyWordgardSourcePatch('editor/clipboard.ts',read('vendor/wordgard/src/editor/clipboard.ts'),'../inert-html');
assert.match(patchedClipboard,/^import \{parseInertHTML\}[^\n]*\/inert-html"\n/u,'Clipboard parsing must use the shared inert parser.');
assert.match(patchedClipboard,/let elt = parseInertHTML\(html\)/u);
assert.doesNotMatch(patchedClipboard,/createPolicy\("detachedDocument"|detachedDoc\(\)\.createElement/);
assert.match(patchedClipboard,/function clipboardDoc\(\)/,'Clipboard serialization must retain a detached non-parser document.');

assert.throws(()=>applyWordgardSourcePatch('editor/input.ts',read('vendor/wordgard/src/editor/input.ts')),/Unsupported Wordgard patch target/u,'Cut handling lives in the adapter, not in a rewrite of upstream input.');

const patchedState=applyWordgardSourcePatch('state/state.ts',read('vendor/wordgard/src/state/state.ts'),'../inert-html');
assert.match(patchedState,/const readHTML = parseInertHTML/u,'State parsing must use the shared inert parser.');
assert.doesNotMatch(patchedState,/createPolicy\("detachedDocument"/u);

const patchedHistory=withoutComments(applyWordgardSourcePatch('history/history.ts',read('vendor/wordgard/src/history/history.ts')));
assert.doesNotMatch(patchedHistory,/\bMenu\b|phrases|undoButton|redoButton/u,'Menu UI must not enter the history module.');
assert.match(patchedHistory,/export function history\(config: HistoryConfig = \{\}\)/u);

// Upstream changes elsewhere in a file pass; a moved anchor fails by name.
assert.match(applyWordgardSourcePatch('doc/node.ts',read('vendor/wordgard/src/doc/node.ts')+'\n// later upstream change\n'),/to === undefined \? this\.length : to/u);
assert.throws(()=>applyWordgardSourcePatch('doc/node.ts',read('vendor/wordgard/src/doc/node.ts').replace('slice(from: number, to = this.length) {','slice(start: number, to = this.length) {')),/Wordgard patch anchor changed: Node\.slice build compatibility/u);
assert.throws(()=>applyWordgardSourcePatch('history/history.ts',read('vendor/wordgard/src/history/history.ts').replace('/// A menu button that undoes a change.','')),/Wordgard patch anchor changed: history menu button definitions/u);

let loader;
wordgardSourcePatchPlugin({root:process.cwd()}).setup({onLoad(_options,fn){loader=fn;}});
assert.equal(typeof loader,'function','Wordgard build patch plugin must register its source transform.');
assert.match(loader({path:`${process.cwd()}/vendor/wordgard/src/doc/node.ts`}).contents,/slice\(from: number, to\?: number\)/);

console.log(JSON.stringify({status:'PASS',wordgard:WORDGARD_METADATA.version,sourceFiles:files.length,snapshot:WORDGARD_METADATA.sourceSnapshotSha256},null,2));
