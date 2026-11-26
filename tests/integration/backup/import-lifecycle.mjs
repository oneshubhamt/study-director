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

{
  vm.runInThisContext(read('source/core/backup-actions-host.ts'),{filename:'source/core/backup-actions-host.ts'});
  const Host=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('backup-actions-host',1);
  class FileInput{constructor(){this.value='';this.files=[];this.clicks=0;}click(){this.clicks++;}}
  const original=Object.getOwnPropertyDescriptor(globalThis,'HTMLInputElement');
  Object.defineProperty(globalThis,'HTMLInputElement',{configurable:true,value:FileInput});
  try{
    const file=new Blob(['fixture']),node=new FileInput(),calls=[];let revision=1,mode='native',resolvePicker,releaseDevice,releasePassword,deviceConnected=true,deviceBackups=0,driveBackups=0,historyOpens=0;
    const freeze=Object.freeze,noop=()=>{},controller=freeze({importLocal:async(event,assertOrigin)=>{assertOrigin();calls.push(event.target.files[0]);return {verified:true};},cancelStandalone:()=>true});
    const controls=Host.createControls(freeze({document:{getElementById:id=>id==='import-file'?node:null},controller,processing:freeze({open:input=>mode==='fallback'?(input.click(),Promise.resolve(null)):new Promise(resolve=>{resolvePicker=resolve;})}),protection:freeze({withPassword:async open=>{await new Promise(resolve=>{releasePassword=resolve;});return open();}}),device:()=>({status:()=>({connected:deviceConnected}),backupNow:()=>{deviceBackups++;return new Promise(resolve=>{releaseDevice=resolve;});}}),providers:freeze({connected:id=>id==='google-drive',backup:async id=>{assert.equal(id,'google-drive');driveBackups++;return true;}}),presentation:freeze({condition:noop}),verifiedAt:()=>'',timeLabel:()=>'',capture:noop,captureActionAuthority:()=>{const owner=revision;return()=>{if(owner!==revision)throw Error('owner changed');};},resolveFileOpen:noop,foregroundChanged:noop,scheduleSyncStatus:noop,renderProfile:noop,firstStartOpen:()=>false,renderFirstStart:noop,scheduleUpdate:noop,connectDevice:noop,connectDrive:noop,openHistory:()=>{historyOpens++;return true;}}));
    let pick=controls.pickImportFile();revision+=2;resolvePicker(file);assert.equal(await pick,false);assert.equal(calls.length,0);
    pick=controls.pickImportFile();resolvePicker(file);assert.equal(await pick,true);assert.deepEqual(calls,[file]);
    mode='fallback';await controls.pickImportFile();assert.equal(node.clicks,1);revision+=2;node.files=[file];node.value='selected';assert.equal(controls.importLocal({target:node}),false);assert.equal(node.value,'');assert.equal(calls.length,1);
    await controls.pickImportFile();node.files=[file];assert.equal((await controls.importLocal({target:node})).verified,true);assert.equal(calls.length,2);
    assert.equal(controls.importLocal({target:node}),false,'fallback ticket is single-use');
    pick=controls.pickImportFile();controls.cancelStandalone();node.files=[file];await pick;assert.equal(controls.importLocal({target:node}),false);
    let backup=controls.backUpEverywhere();assert.equal(deviceBackups,1);revision+=2;releaseDevice(true);assert.equal(await backup,false);assert.equal(driveBackups,0,'retired Device Folder completion cannot start a Drive backup under its successor');
    backup=controls.backUpEverywhere();releaseDevice(true);assert.equal(await backup,true);assert.equal(driveBackups,1,'both connected locations are backed up by the current click');
    deviceConnected=false;assert.equal(await controls.backUpEverywhere(),true);assert.equal(deviceBackups,2);assert.equal(driveBackups,2);
    let history=controls.openHistory();revision+=2;releasePassword();assert.equal(await history,false);assert.equal(historyOpens,0,'retired password prompt cannot open successor history');
    history=controls.openHistory();releasePassword();assert.equal(await history,true);assert.equal(historyOpens,1);
    console.log('PASS: actual BackupActions native/fallback picker, sequential backup, and password-history origin authority');
  }finally{if(original)Object.defineProperty(globalThis,'HTMLInputElement',original);else delete globalThis.HTMLInputElement;}
}
