import {readScript} from '../../../build/source-script.mts';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={console,Map,Set,Object,Promise,Number,String,Math,Date,JSON,structuredClone};
context.globalThis=context;vm.createContext(context);
for(const file of ['source/core/internal.js','source/core/library-clear.ts']){
  vm.runInContext(readScript(file),context,{filename:file});
}
const mod=context[Symbol.for('studyDirector.internalModules.v1')].require('library-clear',1);
const A='att-aaaaaaaaaaaaaaaaaaaa';
const B='att-bbbbbbbbbbbbbbbbbbbb';
const C='att-cccccccccccccccccccc';
const D='att-dddddddddddddddddddd';
const attachments=[A,B,C,D].map(id=>({id,name:id,type:'application/pdf',size:1,hash:'a'.repeat(64),library:true}));
const sources=[
  {kind:'note',key:'n1',label:'N1',ids:new Set([B,C])},
  {kind:'day',key:'2026-09-10',label:'Day',ids:new Set([C])},
  {kind:'session',key:'current',label:'Session reflection · 2026-09-11',ids:new Set([D])}
];

const onlyAttachments=mod.createPlan({selection:{savedDays:false,notes:false,attachments:true},attachments,sources});
assert.deepEqual([...onlyAttachments.attachments.unreferencedIds],[A]);
assert.deepEqual([...onlyAttachments.attachments.selectedRecordOnlyIds],[]);
assert.deepEqual([...onlyAttachments.attachments.safeIds],[A]);
assert.deepEqual([...onlyAttachments.attachments.protectedIds],[B,C,D]);
assert.equal(onlyAttachments.attachments.protectedReferences.length,4);

const notesAndAttachments=mod.createPlan({selection:{savedDays:false,notes:true,attachments:true},attachments,sources});
assert.deepEqual([...notesAndAttachments.attachments.safeIds],[A,B]);
assert.deepEqual([...notesAndAttachments.attachments.selectedRecordOnlyIds],[B]);
assert.deepEqual([...notesAndAttachments.attachments.protectedIds],[C,D]);

const daysNotesAttachments=mod.createPlan({selection:{savedDays:true,notes:true,attachments:true},attachments,sources});
assert.deepEqual([...daysNotesAttachments.attachments.safeIds],[A,B,C]);
assert.deepEqual([...daysNotesAttachments.attachments.protectedIds],[D]);

const repeat=mod.createPlan({selection:{savedDays:true,notes:true,attachments:true},attachments:[...attachments].reverse(),sources:[...sources].reverse()});
assert.equal(repeat.signature,daysNotesAttachments.signature,'signature must be stable across input ordering');
const changed=mod.createPlan({selection:{savedDays:true,notes:true,attachments:true},attachments,sources:[...sources,{kind:'note',key:'n2',label:'N2',ids:new Set([A])}]});
assert.notEqual(changed.signature,daysNotesAttachments.signature,'reference changes must invalidate the signature');

const noAttachmentSelection=mod.createPlan({selection:{savedDays:true,notes:false,attachments:false},attachments,sources});
assert.equal(noAttachmentSelection.attachments.safeIds.length,0);
assert.equal(noAttachmentSelection.attachments.protectedIds.length,0);

console.log(JSON.stringify({status:'PASS',suite:'library-clear-planner',checks:14},null,2));
