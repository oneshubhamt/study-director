import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as esbuild from 'esbuild-wasm';
import {richTextRuntimeSource} from '../../helpers/rich-text-runtime.mjs';

const built=await esbuild.build({entryPoints:['rich-text/wg1-codec.ts'],bundle:true,write:false,format:'iife',globalName:'WG1Codec',platform:'browser',target:['es2020'],logLevel:'silent'});
let codecParses=0,richParses=0;
const codecJson={parse(value){codecParses++;return JSON.parse(value)},stringify:JSON.stringify};
const codecSandbox={console,TextEncoder,TextDecoder,JSON:codecJson};codecSandbox.globalThis=codecSandbox;vm.createContext(codecSandbox);vm.runInContext(built.outputFiles[0].text,codecSandbox);
const codec=codecSandbox.WG1Codec;

const richJson={parse(value){richParses++;return JSON.parse(value)},stringify:JSON.stringify};
const richSandbox={console,URL,TextEncoder,TextDecoder,setTimeout,clearTimeout,queueMicrotask,JSON:richJson};richSandbox.globalThis=richSandbox;vm.createContext(richSandbox);vm.runInContext(richTextRuntimeSource(),richSandbox,{filename:'rich-text.js'});
const rich=richSandbox.StudyDirectorRichText;

const text=(param,marks)=>marks?{type:'Text',param,marks}:{type:'Text',param};
const paragraph=(value,marks)=>({type:'Paragraph',content:[text(value,marks)]});
const cell=(value,width=50)=>({type:'Cell',marks:{SDCellWidth:width,SDCellHeight:34},content:[paragraph(value)]});
const cases=[
  {name:'paragraphs',doc:{type:'Doc',content:[paragraph('Alpha'),paragraph('Beta')]}},
  {name:'heading-break-linebreak',doc:{type:'Doc',content:[{type:'Heading',param:2,content:[text('Heading')]},{type:'Paragraph',content:[text('A'),{type:'LineBreak'},text('B')]}]}},
  {name:'atomic-blocks',doc:{type:'Doc',content:[paragraph('Before'),{type:'HorizontalRule'},{type:'SDImage',param:{assetId:'img-12345678901234567890',alt:'diagram',widthPct:60}},paragraph('After')]}},
  {name:'table',doc:{type:'Doc',content:[{type:'Table',marks:{SDTableWidth:100},content:[{type:'TableRow',content:[cell('R1C1'),cell('R1C2')]},{type:'TableRow',content:[cell('R2C1'),cell('R2C2')]}]},paragraph('Tail')]}},
  {name:'list',doc:{type:'Doc',content:[{type:'BulletList',content:[{type:'ListItem',content:[paragraph('One')]},{type:'ListItem',content:[paragraph('Two')]}]}]}}
];
for(const test of cases){
  const value=codec.encodeWG1Document(test.doc);
  assert.equal(rich.isRichTextValue(value),true,`${test.name} fixture must be valid WG1.`);
  assert.equal(codec.wg1ToPlainText(value),rich.toPlainText(value),`${test.name} codec and runtime plain-text semantics drifted.`);
}
for(const literal of ['Plain text','WG1: notes about the format','WG1:not-json'])assert.equal(codec.wg1ToPlainText(literal),rich.toPlainText(literal));
const polluted=codec.WG1_STORAGE_PREFIX+JSON.stringify({version:codec.WG1_VERSION,doc:cases[0].doc,history:{done:[1]}});
assert.equal(codec.wg1ToPlainText(polluted),'');assert.equal(rich.toPlainText(polluted),'','Transient/editor state must fail closed instead of becoming searchable text.');

const words=Array.from({length:10000},(_,index)=>`w${index}`).join(' ');
const largeDoc={type:'Doc',content:[{type:'Heading',param:2,content:[text('Case Sensitive')]},{type:'Paragraph',content:[text(words),{type:'LineBreak'},text('Tail')]},{type:'HorizontalRule'}]};
const largeValue=codec.encodeWG1Document(largeDoc);
codecParses=0;const pureText=codec.wg1ToPlainText(largeValue);assert.equal(codecParses,1,'DOM-free conversion must parse a valid WG1 envelope exactly once.');
richParses=0;const runtimeText=rich.toPlainText(largeValue);assert.equal(richParses,1,'Runtime conversion must parse a valid WG1 envelope exactly once.');
assert.equal(runtimeText,pureText);assert.ok(runtimeText.startsWith('Case Sensitive\nw0 w1'));assert.ok(runtimeText.endsWith('Tail\n---'));
codecParses=0;const prefixedPlain='WG1: ordinary human notes about the format';assert.equal(codec.wg1ToPlainText(prefixedPlain),prefixedPlain);assert.equal(codecParses,1,'WG1-prefixed plaintext must make at most one parse attempt.');

console.log(JSON.stringify({status:'PASS',cases:cases.map(test=>test.name),largeWords:10000,singleParse:true,runtimeParity:true},null,2));
