import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../../..');
const read=relative=>readScript(path.join(ROOT,relative));
// Deterministic import-while-Review-open lifecycle fixture.
for(const file of ['source/core/internal.ts','source/core/session-lifecycle.ts'])vm.runInThisContext(read(file),{filename:file});
const Lifecycle=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('session-lifecycle',1);
let primary=true;
let repository={Area:{key:'Area',text:'before'}};
const oldField={value:'stale rendered value',bound:true,disabled:false,revision:0};
const currentField={value:'before',bound:true,disabled:false,revision:0};
let lifecycleRevision=0;
const coordinator=Lifecycle.createCoordinator(Object.freeze({hooks:Object.freeze({
  canMutate:()=>primary,
  flushPending:()=>true,
  prepare:context=>{
    lifecycleRevision=context.revision;
    for(const field of [oldField,currentField]){field.bound=false;field.disabled=true;field.revision=context.revision;}
  },
  reconcile:context=>{
    currentField.value=repository.Area.text;
    currentField.bound=true;currentField.disabled=false;currentField.revision=context.revision;
  },
  complete:context=>{if(!context.reconciled)currentField.disabled=true;},
  capture:()=>false
})}));
coordinator.reconcile('startup-ready');
const commit=field=>{
  if(!coordinator.canWrite()||!field.bound||field.disabled||field.revision!==lifecycleRevision)return false;
  repository.Area={...repository.Area,text:field.value};return true;
};
oldField.value='stale overwrite';
await coordinator.run('imported-notes',{},async()=>{
  assert.equal(commit(oldField),false,'retained Review field must be unable to write during import');
  repository={Area:{key:'Area',text:'imported canonical'}};
});
assert.equal(currentField.value,'imported canonical','UI hydrates only after repository import');
assert.equal(commit(oldField),false,'retained pre-import field stays invalid after reconciliation');
currentField.value='valid post-import edit';
assert.equal(commit(currentField),true);
assert.equal(repository.Area.text,'valid post-import edit');

console.log(JSON.stringify({
  status:'PASS',lifecycleScenario:'import while Review open',staleEditorRejected:true,canonicalHydrationAfterImport:true
},null,2));
