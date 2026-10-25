import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {richTextRuntimeSource} from '../../helpers/rich-text-runtime.mjs';

const source=richTextRuntimeSource();
const sandbox={console,URL,TextEncoder,TextDecoder,setTimeout,clearTimeout,queueMicrotask,structuredClone};sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(source,sandbox,{filename:'rich-text.js'});
const rich=sandbox.StudyDirectorRichText;
const A='att-1234567890abcdefghij',B='att-abcdefghij1234567890';
let n=0;const eq=(name,actual,expected)=>{assert.deepEqual(actual,expected,name);n++;console.log('ok - '+name)};const ok=(name,v)=>{assert.ok(v,name);n++;console.log('ok - '+name)};

ok('public attachment APIs exist',typeof rich.scanAttachmentReferences==='function'&&typeof rich.insertAttachmentReference==='function'&&typeof rich.removeAttachmentReferences==='function');
const image=rich.insertAttachmentReference('',{id:A,name:'Image',mode:'inline-image'}).value;
ok('att id can be a true inline image',rich.isRichTextValue(image)&&rich.assetIds(image).includes(A));
eq('scanner sees inline image',Array.from(rich.scanAttachmentReferences(image).occurrences,x=>x.kind),['inline-image']);
const linked=rich.insertAttachmentReference('Alpha',{id:A,name:'Report.pdf',mode:'link'}).value;
ok('link insertion keeps existing text',rich.toPlainText(linked).includes('Alpha')&&rich.toPlainText(linked).includes('Report.pdf'));
eq('scanner sees internal link',Array.from(rich.scanAttachmentReferences(linked).occurrences,x=>x.kind),['link']);
const mixed=rich.insertAttachmentReference(rich.insertAttachmentReference('Keep',{id:A,name:'A.pdf',mode:'link'}).value,{id:B,name:'B image',mode:'inline-image'}).value;
const removedA=rich.removeAttachmentReferences(mixed,[A]);
ok('remove one id preserves another id',!rich.scanAttachmentReferences(removedA.value).assetIds.includes(A)&&rich.scanAttachmentReferences(removedA.value).assetIds.includes(B));
ok('remove one id preserves unrelated text',rich.toPlainText(removedA.value).includes('Keep'));

const formatted='WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content:[{type:'Paragraph',content:[{type:'Text',param:'Read report',marks:{Strong:null,Link:'#attachment='+A}}]}]}});
const unlinked=rich.removeAttachmentReferences(formatted,[A]);
ok('embedded link removal preserves visible text',rich.toPlainText(unlinked.value)==='Read report');
ok('embedded link removal preserves unrelated Strong mark',rich.exportDocument(unlinked.value).doc.content[0].content[0].marks.Strong===null);

const onlyImageRemoved=rich.removeAttachmentReferences(image,[A]);
ok('removing only image leaves canonical rich document',rich.isRichTextValue(onlyImageRemoved.value));
eq('removing only image removes exactly one image',onlyImageRemoved.removed.images,1);
const bad='WG1:{"version":1,"doc":{"type":"Doc","content":[{"type":"SDImage","param":{"assetId":"bad","alt":"","widthPct":68}}]}}';
eq('malformed rich scanner fails closed',rich.scanAttachmentReferences(bad).trusted,false);
assert.throws(()=>rich.removeAttachmentReferences(bad,[A]),/invalid|cannot be changed safely/i,'malformed WG1 removal must throw');n++;console.log('ok - malformed WG1 removal throws');
assert.throws(()=>rich.insertAttachmentReference(bad,{id:A,name:'x',mode:'link'}),/invalid|cannot be changed safely/i,'malformed WG1 insertion must throw');n++;console.log('ok - malformed WG1 insertion throws');
console.log(JSON.stringify({status:'PASS',suite:'rich-attachment-api',checks:n}));
