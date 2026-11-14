import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createStoreZip} from '../../../portable/zip.ts';
import {createProcessingEngine} from '../../../portable/processing.ts';

const run=file=>vm.runInThisContext(readRuntimeSource(new URL(file,import.meta.url)),{filename:file});
run('../../../source/core/internal.ts');run('../../../source/core/note-export.ts');
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const module=registry.require('note-export',2);
assert.equal(module.format,'study-director.note-export-module');
assert.equal(module.contractVersion,2);
assert.equal(module.limits.maxExportBytes,128*1024*1024);
const {cleanBaseName}=module.testing;

assert.equal(cleanBaseName('../A:*?\\B'),'A B');
assert.equal(cleanBaseName('   '),'Untitled Note');
assert.equal(cleanBaseName('CON'),'Note CON');
assert.ok(cleanBaseName('x'.repeat(500)).length<=120);

const makeBlob=(parts,type)=>new Blob(parts,{type});
const environment=Object.freeze({makeBlob,now:()=>new Date('2026-09-01T12:00:00Z'),textEncoder:()=>new TextEncoder()});
function zipEntries(blob){return blob.arrayBuffer().then(buffer=>{const bytes=new Uint8Array(buffer),view=new DataView(buffer),dec=new TextDecoder(),out=[];let offset=0;while(offset+4<=bytes.length&&view.getUint32(offset,true)===0x04034b50){const method=view.getUint16(offset+8,true),size=view.getUint32(offset+18,true),nameLength=view.getUint16(offset+26,true),extraLength=view.getUint16(offset+28,true),name=dec.decode(bytes.slice(offset+30,offset+30+nameLength));out.push({name,method,size});offset+=30+nameLength+extraLength+size;}assert.equal(view.getUint32(offset,true),0x02014b50,'ZIP must contain a central directory.');return out;});}
const directZip=await createStoreZip([{name:'notes/α.md',blob:makeBlob(['hello'],'text/markdown')},{name:'assets/a.png',blob:makeBlob([new Uint8Array([1,2,3])],'image/png')}],environment);
assert.equal(directZip.type,'application/zip');assert.deepEqual((await zipEntries(directZip)).map(x=>[x.name,x.method]),[['notes/α.md',0],['assets/a.png',0]]);
await assert.rejects(()=>createStoreZip([{name:'../escape.md',blob:makeBlob(['x'],'text/plain')}],environment),/path is invalid/);

const assetId='img-12345678901234567890';
const richImage=`WG1:${JSON.stringify({version:1,doc:{type:'Doc',content:[{type:'SDImage',param:{assetId,alt:'diagram',widthPct:100}}]}})}`;
function collectAssets(value){const parsed=String(value||'').startsWith('WG1:')?JSON.parse(String(value).slice(4)):null,out=[];const visit=node=>{if(node?.type==='SDImage'&&node.param?.assetId)out.push(node.param.assetId);for(const child of node?.content||[])visit(child);};if(parsed)visit(parsed.doc);return out;}
function markdown(value,options={}){if(value===richImage){const path=options.assetPath?.(assetId)||'';return path?`![diagram](${path})\n`:'[Image unavailable: diagram]\n';}return String(value||'').replace(/\r\n?/g,'\n');}
const downloads=[];const png=makeBlob([new Uint8Array([137,80,78,71])],'image/png');
let payload={plain:{key:'plain',label:'../Ethics:*?',text:'hello'}};
const create=(assetGet=async id=>id===assetId?png:null)=>module.createExporter(Object.freeze({ports:Object.freeze({
  assets:Object.freeze({get:assetGet}),
  environment,
  processing:Object.freeze({...createProcessingEngine((doc,text,options)=>markdown(text,options)),scope:fn=>fn(),job:fn=>fn(),cancel:()=>{},check:()=>{}}),
  notes:Object.freeze({get:key=>payload[key]||null}),
  output:Object.freeze({chooseSave:async()=>null,save:async({blob,filename})=>{downloads.push({blob,filename});return {status:'downloaded',filename};}}),
  scheduling:Object.freeze({yieldTask:async()=>{},budget:()=>()=>false}),
  richText:Object.freeze({assetIds:collectAssets,document:value=>({doc:null,text:value})})
})}));
let result=await create().exportKeys(['plain']);assert.equal(result.kind,'markdown');assert.equal(downloads.at(-1).filename,'Ethics.md');assert.equal(await downloads.at(-1).blob.text(),'hello');
payload={a:{key:'a',label:'Topic',text:richImage}};result=await create().exportKeys(['a']);assert.equal(result.kind,'zip');assert.equal(result.assets,1);assert.equal(result.filename,'Topic.zip');assert.deepEqual((await zipEntries(downloads.at(-1).blob)).map(x=>x.name),['Topic.md',`assets/${assetId}.png`]);
payload={a:{key:'a',label:'Same',text:richImage},b:{key:'b',label:'Same',text:richImage}};result=await create().exportKeys(['a','b']);assert.equal(result.kind,'zip');assert.equal(result.assets,1,'Shared assets must be deduplicated.');assert.deepEqual((await zipEntries(downloads.at(-1).blob)).map(x=>x.name),['notes/Same.md','notes/Same (2).md',`assets/${assetId}.png`]);
payload={a:{key:'a',label:'Missing',text:richImage}};result=await create(async()=>null).exportKeys(['a']);assert.equal(result.kind,'zip');assert.equal(result.missing,1);assert.match(await downloads.at(-1).blob.text(),/Image unavailable/);

const tooLargeAsset={type:'image/png',size:module.limits.maxExportBytes+1,arrayBuffer:async()=>new ArrayBuffer(0),stream(){return new Blob([]).stream();}};
const beforeDownloads=downloads.length;payload={a:{key:'a',label:'Large',text:richImage}};result=await create(async()=>tooLargeAsset).exportKeys(['a']);assert.equal(result.status,'too-large');assert.equal(result.maxBytes,module.limits.maxExportBytes);assert.equal(downloads.length,beforeDownloads,'Oversized export must stop before download generation.');

console.log(JSON.stringify({status:'PASS',suite:'note-export',engine:'wordgard',zipStore:true,selectionExports:true,sharedAssetDedup:true,filenameHygiene:true,resourceGateMiB:module.limits.maxExportBytes/(1024*1024)},null,2));
