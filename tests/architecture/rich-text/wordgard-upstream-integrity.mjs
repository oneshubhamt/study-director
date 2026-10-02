import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {WORDGARD_METADATA} from '../../../build/wordgard-metadata.mjs';
import {applyWordgardSourcePatch,wordgardSourcePatchPlugin} from '../../../build/wordgard-source-patches.mjs';

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

const patchedNode=applyWordgardSourcePatch('doc/node.ts',read('vendor/wordgard/src/doc/node.ts'));
assert.match(patchedNode,/slice\(from: number, to\?: number\)/);
assert.match(patchedNode,/to === undefined \? this\.length : to/);
assert.equal(sha256(patchedNode),'5d45e494440ec2c6f66381885b25570bb02c4b4a19c6c27c740c0311b0e86f44','Node compatibility transform drifted.');

const patchedClipboard=applyWordgardSourcePatch('editor/clipboard.ts',read('vendor/wordgard/src/editor/clipboard.ts'),'../inert-html');
const canonicalClipboard=patchedClipboard.replace(/^import \{parseInertHTML\} from [^\n]+\n/,"import {parseInertHTML} from '../inert-html'\n");
assert.equal(sha256(canonicalClipboard),'f674a77cdf9f51c8e37409f8079657a4c89e1d65cb62c84a21d2946fb6f9bf47','Clipboard Trusted Types transform drifted.');
assert.doesNotMatch(patchedClipboard,/createPolicy\("detachedDocument"|detachedDoc\(\)\.createElement/);
assert.match(patchedClipboard,/function clipboardDoc\(\)/,'Clipboard serialization must retain a detached non-parser document.');

const patchedInput=applyWordgardSourcePatch('editor/input.ts',read('vendor/wordgard/src/editor/input.ts'));
assert.equal(sha256(patchedInput),'b6f26f21c7722e22cf7c5915d3c708c14fecef23ece2fe90890ca0ffa6176a29','Input Cut transform drifted.');
assert.match(patchedInput,/if \(!event\.clipboardData\) return false/,'Cut must fall back to native handling when ClipboardEvent data is unavailable.');
assert.match(patchedInput,/deleteByCut: wg =>/,'beforeinput deleteByCut must have a transactional Wordgard path.');

const patchedState=applyWordgardSourcePatch('state/state.ts',read('vendor/wordgard/src/state/state.ts'),'../inert-html');
const canonicalState=patchedState.replace(/^import \{parseInertHTML\} from [^\n]+\n/,"import {parseInertHTML} from '../inert-html'\n");
assert.equal(sha256(canonicalState),'6e8080ceb7a91457b9045f11aaca7398c0c5666a635450ded04d68f3c723bb7f','State Trusted Types transform drifted.');
assert.throws(()=>applyWordgardSourcePatch('doc/node.ts',read('vendor/wordgard/src/doc/node.ts')+'\n// drift'),/upstream source changed/,'Patch layer must reject unreviewed upstream drift.');

let loader;
wordgardSourcePatchPlugin({root:process.cwd()}).setup({onLoad(_options,fn){loader=fn;}});
assert.equal(typeof loader,'function','Wordgard build patch plugin must register its source transform.');
assert.match(loader({path:`${process.cwd()}/vendor/wordgard/src/doc/node.ts`}).contents,/slice\(from: number, to\?: number\)/);

console.log(JSON.stringify({status:'PASS',wordgard:WORDGARD_METADATA.version,sourceFiles:files.length,snapshot:WORDGARD_METADATA.sourceSnapshotSha256},null,2));
