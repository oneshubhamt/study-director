import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {importRichTextReconciliationSource} from '../../helpers/typescript-source.mjs';
import {richTextRuntimeSource} from '../../helpers/rich-text-runtime.mjs';

const R=await importRichTextReconciliationSource();
const sandbox={console,URL,TextEncoder,TextDecoder,setTimeout,clearTimeout,queueMicrotask,JSON};sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(richTextRuntimeSource(),sandbox,{filename:'source/external/rich-text.js'});
const runtime=sandbox.StudyDirectorRichText;
const text=(param,marks)=>marks?{type:'Text',param,marks}:{type:'Text',param};
const p=(...content)=>({type:'Paragraph',content:content.flat().map(node=>typeof node==='string'?text(node):node)});
const wrap=content=>'WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content}});
const imageId='img-12345678901234567890',attachmentId='att-12345678901234567890';
const local=wrap([p('Alpha anchor. Delta anchor.')]);
const incoming=wrap([p('Alpha anchor. ',text('Added evidence. ',{Strong:null}),text('MRI link. ',{Link:'#attachment='+attachmentId}),text('Delta anchor.')),{type:'SDImage',param:{assetId:imageId,alt:'scan',widthPct:68}}]);

const comparison=R.compareRichText(local,incoming);
assert.equal(comparison.incomingOnly.length,3,'Two prose additions plus one image must be incoming-only.');
const merged=R.mergeIncomingAdditions(local,incoming);
assert.equal(merged.changed,true);
assert.equal(runtime.isRichTextValue(merged.value),true,'CR2 output must remain valid under the shipping Wordgard schema/runtime.');
assert.equal(runtime.toPlainText(merged.value).includes('Added evidence.'),true);
const refs=runtime.scanAttachmentReferences(merged.value);
assert.equal(refs.trusted,true);
assert.deepEqual(JSON.parse(JSON.stringify([...refs.assetIds].sort())),[attachmentId,imageId].sort(),'Merged output must preserve link/image attachment IDs for later CR4 resolution.');
const exported=runtime.exportDocument(merged.value);
const added=exported.doc.content[0].content.find(node=>node.type==='Text'&&String(node.param).includes('Added evidence.'));
const linked=exported.doc.content[0].content.find(node=>node.type==='Text'&&String(node.param).includes('MRI link.'));
assert.equal(added.marks.Strong,null,'Runtime decode must preserve inserted Strong marks.');
assert.equal(linked.marks.Link,'#attachment='+attachmentId,'Runtime decode must preserve inserted attachment Link mark.');
assert.equal(exported.doc.content[1].param.assetId,imageId,'Runtime decode must preserve inserted image identity.');
const roundTrip=R.compareRichText(merged.value,incoming);
assert.equal(roundTrip.incomingOnly.length,0,'Merged output must converge with the incoming additions on a second comparison.');

console.log(JSON.stringify({status:'PASS',suite:'rich-text-reconciliation-runtime-integration',checks:10,coverage:['WG1 runtime validity','runtime plain text','attachment reference scan','marks','links','image IDs','convergence']},null,2));
