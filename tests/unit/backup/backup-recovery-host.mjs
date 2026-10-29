import {readScript} from '../../../build/source-script.mts';
import {createBackupPresentation} from '../../helpers/backup-presentation.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for(const file of ['source/core/internal.js','source/core/managed-recovery.ts','source/core/backup-recovery-host.ts'])vm.runInThisContext(readScript(file),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const ManagedRecovery=registry.require('managed-recovery',1);
const BackupRecoveryHost=registry.require('backup-recovery-host',1);
const freeze=Object.freeze;
const CHECKPOINT=value=>'cp_'+value.repeat(32);

const events=[],statuses=[],diagnostics=[];
let storedPending=null,storageReadError=null,providerBringInResult=freeze({ok:true}),chooseMode='replace',restoredCheckpoint='',restoredConfirmed=false,suspended=0,cancelImportCalls=0,deviceCancelCalls=0,providerCancelCalls=0,lastProviderCancelId='';
let deletionResults=[];
let providerRestoreImpl=async()=>freeze({ok:true});
let driveConnected=false,noteVersionsImpl=async()=>freeze({available:true,entries:freeze([])}),lastProviderBringIn=null;
let deviceRestoreFailure=null;const removedVersions=[];
let deviceHistoryReads=0,providerHistoryReads=0,providerBringInCheckpoint='',lastUseBackupOptions=null,deviceCombineResult=freeze({ok:true}),lastDeviceCombine=null,deviceConnected=true,sessionBlocking=false;
const providerHooks={recovery:null,pending:null};
const deviceEntry=freeze({logicalId:'state_'+'a'.repeat(64),logicalFingerprint:'a'.repeat(64),exportedAt:'2026-09-20T12:00:00.000Z',counts:freeze({dailyRecord:2,note:1}),location:freeze({sourceId:'device-folder',sourceLabel:'Device Folder',checkpointId:CHECKPOINT('a'),exportedAt:'2026-09-20T12:00:00.000Z',tier:'latest',encrypted:false})});
const driveEntry=freeze({logicalId:'state_'+'b'.repeat(64),logicalFingerprint:'b'.repeat(64),exportedAt:'2026-09-20T11:00:00.000Z',counts:freeze({dailyRecord:1,note:1}),location:freeze({sourceId:'google-drive',sourceLabel:'Google Drive',checkpointId:CHECKPOINT('b'),exportedAt:'2026-09-20T11:00:00.000Z',tier:'latest',encrypted:false})});
let deviceHistory=freeze({available:true,sourceId:'device-folder',sourceLabel:'Device Folder',entries:freeze([deviceEntry])});
const driveHistory=freeze({available:true,sourceId:'google-drive',sourceLabel:'Google Drive',entries:freeze([driveEntry])});let driveHistoryNow=driveHistory;

function node(){const made={dataset:{},attributes:{},hidden:false,textContent:'',className:'',open:false,children:[],setAttribute(name,value){this.attributes[name]=String(value);},append(...items){this.children.push(...items);},appendChild(item){this.children.push(item);},replaceChildren(...items){this.children=[...items];},showModal(){this.open=true;},close(){this.open=false;}};made.classList={add:(...names)=>{made.className=[...new Set([...made.className.split(/\s+/u).filter(Boolean),...names])].join(' ');},contains:name=>made.className.split(/\s+/u).includes(name)};return made;}
const nodes=new Map([['managed-version-history',node()],['managed-version-history-kicker',node()],['managed-version-history-title',node()],['managed-version-history-copy',node()],['managed-version-history-progress',node()],['managed-version-history-progress-stage',node()],['managed-version-history-progress-detail',node()],['managed-version-history-list',node()],['managed-version-history-status',node()],['cancel-backup-import',node()]]);
const document={getElementById:id=>nodes.get(id)||null,createElement:()=>node()};
const plan={input:null,cached:'',persisted:'',stored:'',writable:true,saves:[]};
// Today's session: every write commits a new revision and moves the source revision.
const session={tasks:false,revision:0,writes:0,source:'2026-09-20T12:00:00.000Z'};
const host=BackupRecoveryHost.createHost(freeze({presentation:createBackupPresentation(),
  cancellation:freeze({cancelImport:()=>{cancelImportCalls+=1;return true;}}),
  diagnostics:freeze({capture:(scope,error,level)=>diagnostics.push(freeze({scope,message:String(error?.message||error),level})),mark:()=>false}),
  document,
  interactions:freeze({choose:async options=>{
    events.push(`choose:${options.title}`);
    if(options.title==='Use this version'){lastUseBackupOptions=options;return chooseMode;}
    if(options.title==='Remove safety version?'||options.title==='Remove this version?')return 'remove';
    return null;
  }}),
  lifecycle:freeze({
    activeSessionIssue:()=>'',activeSessionLoad:async()=>freeze({ok:true,value:session.tasks?freeze({revision:session.revision}):null,error:null,storage:freeze({idb:true})}),activeSessionSettled:async()=>{events.push('active-settled');return true;},
    attachmentBusy:()=>false,canonicalPlanDraft:async()=>plan.stored,deletionRecoveryFlush:async()=>{events.push('deletion-flush');const value=deletionResults.length?deletionResults.shift():true;if(value instanceof Error)throw value;return value;},
    flushNotes:async()=>{events.push('notes-flush');return true;},flushPlanDraft:async()=>{events.push('plan-flush');return true;},hasTasks:()=>session.tasks,noteFailure:()=>null,
    planDraft:()=>plan.cached,planInputValue:()=>plan.input,quiesce:async operation=>{events.push('quiesce-enter');try{return await operation();}finally{events.push('quiesce-exit');}},
    // Mirrors PlanData: the write is skipped when the page believes storage already holds it.
    savePlanDraft:async(options={})=>{plan.saves.push(options.force===true);if(options.force===true||plan.persisted!==plan.input){if(plan.writable)plan.stored=plan.input;plan.persisted=plan.input;}plan.cached=plan.input;return true;},settleAttachmentWriters:async()=>{events.push('attachments-settle');return true;},settlePlan:async()=>{events.push('plan-settle');return true;},writeLiveDraft:async()=>{session.writes+=1;session.revision+=1;session.source=new Date(Date.parse('2026-09-20T12:00:00.000Z')+session.revision*1000).toISOString();return freeze({ok:true,value:freeze({revision:session.revision}),storage:freeze({idb:true})});}
  }),
  managedRecovery:freeze({createCoordinator:input=>ManagedRecovery.createCoordinator(input)}),
  mutation:freeze({run:async(kind,operation)=>{events.push(`mutation:${kind}`);return operation();}}),
  // Every location, the Device Folder included, is reached through the engine.
  providers:freeze({
    bringInRepositoryProvider:async(id,options)=>{
      if(id==='device-folder'){events.push(`device-combine:${options.checkpointId}`);lastDeviceCombine=options;return deviceCombineResult;}
      providerBringInCheckpoint=options.checkpointId;lastProviderBringIn=options;events.push(`bring-in:${id}`);return providerBringInResult;
    },
    cancelForeground:(_reason,id)=>{if(id==='device-folder')deviceCancelCalls+=1;else providerCancelCalls+=1;lastProviderCancelId=String(id||'');return true;},
    configureManagedRecovery:config=>{providerHooks.recovery=config;return true;},
    configurePendingBackupRetry:config=>{providerHooks.pending=config;return true;},
    history:async id=>{if(id==='device-folder'){deviceHistoryReads+=1;return deviceHistory;}providerHistoryReads+=1;assert.equal(id,'google-drive');return driveHistoryNow;},
    list:()=>freeze([freeze({id:'google-drive',label:'Google Drive',shared:true,connected:driveConnected}),freeze({id:'device-folder',label:'Device Folder',connected:deviceConnected})]),
    noteVersions:(id,noteId,options)=>noteVersionsImpl(id,noteId,options),
    removeRepositoryProviderVersion:async(id,checkpointId)=>{removedVersions.push([id,checkpointId]);return freeze({removed:true,entries:freeze([])});},
    restoreRepositoryProviderVersion:async(id,options)=>{
      if(id==='device-folder'&&deviceRestoreFailure){const error=deviceRestoreFailure;deviceRestoreFailure=null;throw error;}
      if(id==='device-folder'){restoredCheckpoint=options.checkpointId;restoredConfirmed=options.confirmed===true;events.push(`restore:${restoredCheckpoint}`);return freeze({ok:true});}
      return providerRestoreImpl(id,options);
    },
    suspendBackground:()=>{suspended+=1;events.push('suspend');let released=false;return freeze({settled:Promise.resolve(),release:()=>{if(released)return false;released=true;suspended-=1;events.push('resume');return true;}});}
  }),
  session:freeze({hasBlocking:()=>sessionBlocking}),
  sourceRevision:()=>session.source,
  storage:freeze({read:async()=>{if(storageReadError)throw storageReadError;return storedPending;},remove:async()=>{storedPending=null;return true;},write:async value=>{storedPending=value;return true;}}),
  view:freeze({deviceName:id=>id==='inst_iphone_safari_mve00000_abcdef01'?'iPhone · Safari':'',invalidateAttachments:()=>events.push('invalidate-attachments'),refreshCore:()=>events.push('refresh-core'),refreshNotes:()=>events.push('refresh-notes'),refreshReview:()=>events.push('refresh-review'),renderLibrary:()=>events.push('render-library'),setStatus:(id,message,ok=true)=>{statuses.push(freeze({id,message,ok}));return true;}})
}));

assert.equal(host.format,'study-director.backup-recovery-host');
assert.ok(providerHooks.recovery&&providerHooks.pending,'provider hooks must be configured once through the extracted host');
await providerHooks.pending.mark('google-drive');assert.equal(storedPending.entries[0].providerId,'google-drive');await providerHooks.pending.clear('google-drive');assert.equal(storedPending,null);
const preservedPending=freeze({format:'study-director.managed-provider-backup-pending',version:1,entries:freeze([freeze({providerId:'other-provider',requestedAt:'2026-09-20T12:00:00.000Z',sourceRevision:'2026-09-20T11:59:59.000Z'})])});
storedPending=preservedPending;storageReadError=new Error('temporary appMeta read failure');
await assert.rejects(()=>providerHooks.pending.read('google-drive'),/temporary appMeta read failure/,'an unavailable pending-marker read must not become confirmed absence');
await assert.rejects(()=>providerHooks.pending.mark('google-drive'),/temporary appMeta read failure/,'pending-marker mutation must fail closed when the durable state cannot be read');
assert.equal(storedPending,preservedPending,'failed strict pending-marker mutation must not overwrite or remove unread durable state');
storageReadError=null;assert.equal(await providerHooks.pending.read('google-drive'),null,'a successfully read marker without this provider is confirmed absence');storedPending=null;diagnostics.length=0;

const recovery=await host.managedRecovery(freeze({kind:'restore-version',label:'Device Folder',createSafety:async()=>freeze({verified:true,checkpointId:CHECKPOINT('c'),sourceRevision:'2026-09-20T12:00:00.000Z'}),apply:async()=>{events.push('apply');return freeze({ok:true});},publishPresent:async()=>freeze({status:'completed',checkpointId:CHECKPOINT('e')})}));
assert.equal(recovery.managedRecovery.present.status,'completed');assert.equal(suspended,0);

await host.history.open();await new Promise(resolve=>setImmediate(resolve));
assert.equal(deviceHistoryReads,1);assert.equal(providerHistoryReads,0,'Version History reads only the locations that are connected');
assert.equal(nodes.get('managed-version-history-title').textContent,'Version History');
const deviceButton={dataset:{versionHistorySource:'device-folder',versionHistoryCheckpoint:CHECKPOINT('a')}};
const presentation=[];host.history.subscribePresentation(value=>presentation.push(value));
assert.equal(await host.history.recover({target:{closest:()=>deviceButton}}),true);
assert.equal(presentation.at(-1).active,false);assert.equal(presentation.at(-1).lifecycle,'succeeded');assert.match(presentation.at(-1).message,/restored locally/);
assert.equal(restoredCheckpoint,CHECKPOINT('a'));assert.equal(restoredConfirmed,true,'provider-owned Replace choice must be the only confirmation before exact restore');
assert.equal(lastUseBackupOptions.cancelLabel,'Keep current');assert.deepEqual(lastUseBackupOptions.choices.map(choice=>choice.value),['missing','combine','replace']);

chooseMode='combine';driveConnected=true;await host.history.open();await new Promise(resolve=>setImmediate(resolve));
assert.equal(deviceHistoryReads,2);assert.equal(providerHistoryReads,1,'with Drive connected too, one list reads both');
assert.deepEqual(host.history.status().entries.map(entry=>[entry.location.sourceId,entry.location.checkpointId]),[['device-folder',CHECKPOINT('a')],['google-drive',CHECKPOINT('b')]],'each version once, read from where it is held');
const driveButton={dataset:{versionHistorySource:'google-drive',versionHistoryCheckpoint:CHECKPOINT('b')}};
assert.equal(await host.history.recover({target:{closest:()=>driveButton}}),true);assert.equal(providerBringInCheckpoint,CHECKPOINT('b'));



// Close dismisses only the recovery surface; it must not abort an in-flight restore. Reopening reattaches to the same live presentation.
chooseMode='replace';providerBringInResult=freeze({ok:true});await host.history.open();await new Promise(resolve=>setImmediate(resolve));
let releaseCloseRestore,lateProgress;providerRestoreImpl=async(_id,options)=>new Promise(resolve=>{lateProgress=options.onProgress;options.onProgress?.(freeze({stage:'download',message:'Downloading backup data…',current:2,total:8,bytesDone:2048,bytesTotal:8192}));releaseCloseRestore=resolve;});
const closeRestore=host.history.recover({target:{closest:()=>driveButton}});await new Promise(resolve=>setImmediate(resolve));
assert.equal(host.history.status().busy,true);assert.equal(host.history.status().progress.current,2);assert.equal(nodes.get('managed-version-history').open,true);
const restorePresentationId=presentation.at(-1).operationId;assert.match(presentation.at(-1).message,/Downloading/);
host.history.close();assert.equal(nodes.get('managed-version-history').open,false,'Close must dismiss the modal while recovery continues.');assert.equal(cancelImportCalls,0);assert.equal(deviceCancelCalls,0);assert.equal(providerCancelCalls,0,'Close must not cancel provider recovery.');
await host.history.open();assert.equal(nodes.get('managed-version-history').open,true,'Reopening Version History must reattach to the live recovery.');assert.equal(nodes.get('managed-version-history-progress-stage').textContent,'Downloading backup data…');assert.match(nodes.get('managed-version-history-progress-detail').textContent,/2 of 8 complete/);
assert.equal(presentation.at(-1).operationId,restorePresentationId,'reopening retains the operation identity');
releaseCloseRestore(freeze({ok:true,convergence:{source:{status:'completed'},others:[{label:'Device Folder',status:'pending'}]}}));assert.equal(await closeRestore,true);assert.match(presentation.at(-1).message,/Google Drive already holds it/);assert.match(presentation.at(-1).message,/Device Folder backs it up next/);

const finalMessage=presentation.at(-1).message;lateProgress({message:'Late stale download'});assert.equal(presentation.at(-1).message,finalMessage,'completed restore callbacks cannot revive progress');

// Cancel must abort only the active provider/import operation and surface safe cancellation locally.
await host.history.open();await new Promise(resolve=>setImmediate(resolve));
providerRestoreImpl=async(_id,options)=>new Promise((resolve,reject)=>{const fail=()=>reject(options.signal?.reason||Object.assign(new Error('cancelled'),{name:'AbortError',code:'STUDY_DIRECTOR_IMPORT_CANCELLED'}));if(options.signal?.aborted)fail();else options.signal?.addEventListener('abort',fail,{once:true});});
const cancelBefore={import:cancelImportCalls,device:deviceCancelCalls,provider:providerCancelCalls};
const cancelRestore=host.history.recover({target:{closest:()=>driveButton}});await new Promise(resolve=>setImmediate(resolve));
lateProgress({message:'Wrong operation'});assert.notEqual(host.history.status().progress?.message,'Wrong operation','old callbacks cannot overwrite a newer operation');
assert.equal(host.history.cancel(),true);assert.ok(cancelImportCalls>cancelBefore.import);assert.equal(deviceCancelCalls,cancelBefore.device,'Provider recovery cancel must not poke the unrelated Device Folder controller.');assert.ok(providerCancelCalls>cancelBefore.provider);assert.equal(lastProviderCancelId,'google-drive','Provider cancellation must remain source-scoped.');assert.equal(await cancelRestore,false);assert.equal(nodes.get('managed-version-history-status').textContent,'Recovery cancelled safely.');
assert.equal(presentation.at(-1).lifecycle,'cancelled');assert.equal(presentation.at(-1).active,false);
providerRestoreImpl=async()=>freeze({ok:true});

chooseMode='combine';providerBringInResult=freeze({ok:false,error:new Error('repository manifest invalid')});
await host.history.open();await new Promise(resolve=>setImmediate(resolve));assert.equal(await host.history.recover({target:{closest:()=>driveButton}}),false);
assert.equal(nodes.get('managed-version-history-status').textContent,'The selected backup could not be applied safely.');
assert.equal(presentation.at(-1).lifecycle,'failed');
assert.equal(diagnostics.length,0,'recoverable return values should not be misreported as thrown diagnostics');
// Every local settlement gate precedes application and releases automatic suspension.
for(const gate of [0,1])for(const failure of [false,undefined,new Error('Temporary deletion read failure')]){
  deletionResults=gate?[true,failure]:[failure];let safeties=0,applies=0;
  const spec=freeze({kind:'restore-version',label:'Device Folder',createSafety:async()=>{safeties++;return freeze({verified:true,checkpointId:CHECKPOINT('c'),sourceRevision:'2026-09-20T12:00:00.000Z'});},apply:async()=>{applies++;return freeze({ok:true});},publishPresent:async()=>freeze({status:'completed'})});
  await assert.rejects(()=>host.managedRecovery(spec),/deletion/i);
  assert.equal(safeties,gate);assert.equal(applies,0);assert.equal(suspended,0);
  deletionResults=[];const retried=await host.managedRecovery(spec);assert.equal(retried.ok,true);assert.equal(applies,1);assert.equal(suspended,0);
}
// Browser data clearing removes the stored draft while the page still believes it
// wrote that text. Recovery writes the visible draft again instead of failing.
{
  const spec=freeze({kind:'restore-version',label:'Device Folder',createSafety:async()=>freeze({verified:true,checkpointId:CHECKPOINT('c'),sourceRevision:'2026-09-20T12:00:00.000Z'}),apply:async()=>freeze({ok:true}),publishPresent:async()=>freeze({status:'completed'})});
  Object.assign(plan,{input:'09:00 Economics 60',cached:'09:00 Economics 60',persisted:'09:00 Economics 60',stored:null,saves:[]});
  assert.equal((await host.managedRecovery(spec)).ok,true,'a draft lost from storage is rewritten before recovery');
  assert.equal(plan.stored,'09:00 Economics 60');assert.deepEqual(plan.saves,[true],'one forced write repairs the lost draft; the final settlement then reads it back');
  Object.assign(plan,{input:'',cached:'',persisted:'',stored:null,saves:[]});
  assert.equal((await host.managedRecovery(spec)).ok,true,'an empty visible draft is stored as empty rather than failing against an absent row');
  assert.equal(plan.stored,'');
  Object.assign(plan,{input:'09:00 Ethics 30',cached:'09:00 Ethics 30',persisted:'09:00 Ethics 30',stored:null,writable:false,saves:[]});
  await assert.rejects(()=>host.managedRecovery(spec),/pre-recovery read-back check/,'a draft that still cannot be read back stops recovery before local data changes');
  Object.assign(plan,{input:null,writable:true,saves:[]});
}
// A running session is written once before the safety backup. A recovery that
// keeps today's session does not write it again, so the safety backup stays
// current; any other recovery still treats that write as a change.
{
  const spec=keeps=>freeze({kind:'bring-in',label:'Device Folder',...(keeps?{keepsActiveSession:true}:{}),createSafety:async()=>freeze({verified:true,checkpointId:CHECKPOINT('c'),sourceRevision:session.source}),apply:async()=>freeze({ok:true}),publishPresent:async()=>freeze({status:'completed'})});
  Object.assign(session,{tasks:true,writes:0});
  assert.equal((await host.managedRecovery(spec(true))).ok,true,'a session-preserving recovery is not stopped by its own settlement');
  assert.equal(session.writes,1,'the session is written once, before the safety backup');
  session.writes=0;
  await assert.rejects(()=>host.managedRecovery(spec(false)),/changed while the Before restore safety version/,'a recovery that may replace the session keeps the stale-safety protection');
  assert.equal(session.writes,2);assert.equal(suspended,0);
  Object.assign(session,{tasks:false,writes:0});
}
// Earlier versions of one note open Version History in note mode. Comparing a
// version skips the Restore or Combine choice, and an outcome that changes
// nothing keeps the list open.
{
  driveConnected=false;
  noteVersionsImpl=async id=>freeze({available:true,entries:freeze(id==='device-folder'?[freeze({sourceId:'device-folder',sourceLabel:'Device Folder',checkpointId:CHECKPOINT('a'),exportedAt:deviceEntry.exportedAt,text:'earlier text'})]:[])});
  const ethicsId='n_00000000000e7a1c',restoredNotes=[],chooseCount=()=>events.filter(event=>event.startsWith('choose:')).length,noteButton={dataset:{action:'compare-managed-note',versionHistorySource:'device-folder',versionHistoryCheckpoint:CHECKPOINT('a')}};
  // An active study session blocks whole-library recovery but not one note.
  sessionBlocking=true;
  assert.equal(await host.history.open(),false,'whole-library recovery still waits for the session to be suspended');
  assert.deepEqual(await host.history.openNote({id:ethicsId,label:'GS2 > Ethics',text:'current text',onRestored:value=>restoredNotes.push(value)}),{opened:true},'a note opens its earlier versions during a study session');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(await host.history.recover({target:{closest:()=>deviceButton}}),false,'the whole-library button does nothing in note mode');
  assert.equal(nodes.get('managed-version-history-kicker').textContent,'Earlier versions');assert.equal(nodes.get('managed-version-history-title').textContent,'GS2 > Ethics');
  const choicesBefore=chooseCount();deviceCombineResult=freeze({ok:false,reason:'note-unchanged'});
  assert.equal(await host.history.recover({target:{closest:()=>noteButton}}),false);
  assert.equal(lastDeviceCombine.note,ethicsId,'the comparison names the note by id');assert.equal(lastDeviceCombine.confirmed,false);assert.match(host.history.status().status.message,/same text as this note/u);assert.equal(nodes.get('managed-version-history').open,true);
  deviceCombineResult=freeze({ok:true});
  assert.equal(await host.history.recover({target:{closest:()=>noteButton}}),true);
  assert.equal(chooseCount(),choicesBefore,'a note comparison never asks Restore or Combine');assert.deepEqual(restoredNotes.map(value=>value.exportedAt),[deviceEntry.exportedAt]);
  // Opening Version History from Data & Backup leaves note mode.
  sessionBlocking=false;await host.history.open();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(nodes.get('managed-version-history-title').textContent,'Version History');
  deviceConnected=false;assert.deepEqual(await host.history.openNote({id:'n_0123456789abcdef',label:'Ethics'}),{opened:false,reason:'no-source'},'without a connected backup nothing opens');deviceConnected=true;
  deviceCombineResult=freeze({ok:true});host.history.close();
}
// Every restore offers the same three choices; adding only what is missing
// runs the missing-only Combine and explains when something needs a choice.
{
  chooseMode='missing';deviceCombineResult=freeze({ok:false,reason:'needs-decision'});
  await host.history.open();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(await host.history.recover({target:{closest:()=>deviceButton}}),false);
  assert.deepEqual(lastUseBackupOptions.choices.map(choice=>choice.value),['missing','combine','replace']);
  assert.equal(lastDeviceCombine.missingOnly,true);assert.match(host.history.status().status.message,/needs your choice, so nothing was changed/u);
  deviceCombineResult=freeze({ok:true});assert.equal(await host.history.recover({target:{closest:()=>deviceButton}}),true);
  chooseMode='replace';host.history.close();
}
// Version History lists versions newest first by when they were saved,
// whatever their tier and whatever order the location returned them in.
{
  const entry=(letter,exportedAt,tier)=>freeze({...deviceEntry,logicalId:'state_'+letter.repeat(64),exportedAt,location:freeze({...deviceEntry.location,checkpointId:CHECKPOINT(letter),exportedAt,tier})});
  const scrambled=[entry('c','2026-06-01T08:00:00.000Z','monthly'),entry('d','2026-09-20T12:00:00.000Z','latest'),entry('e','2026-07-15T09:00:00.000Z','saved'),entry('f','2026-09-18T21:00:00.000Z','daily'),entry('a','2026-09-10T07:00:00.000Z','before-restore'),entry('b','2026-08-30T10:00:00.000Z','weekly')];
  const previous=deviceHistory;deviceHistory=freeze({...previous,entries:freeze(scrambled)});
  await host.history.open();await new Promise(resolve=>setImmediate(resolve));
  const listed=host.history.status().entries.map(item=>item.exportedAt),rendered=nodes.get('managed-version-history-list').children.map(card=>card.dataset.logicalVersion);
  assert.deepEqual(listed,[...listed].sort().reverse(),'newest first');assert.deepEqual(rendered,host.history.status().entries.map(item=>item.logicalId),'the dialog shows them in that order');
  deviceHistory=previous;host.history.close();
}
// One Version History for both locations. A version both hold shows once and
// is read from the Device Folder: the same id (a copy), or the same data under
// another id. Each location keeps its own safety version. The newest version is
// Latest whichever location made it, and a version only one location holds
// says where it is.
{
  const entry=(sourceId,sourceLabel,letter,data,exportedAt,tier,extra={})=>freeze({...deviceEntry,logicalId:'state_'+data.repeat(64),logicalFingerprint:data.repeat(64),exportedAt,location:freeze({sourceId,sourceLabel,checkpointId:CHECKPOINT(letter),exportedAt,tier,encrypted:false,...extra})});
  const folder=(...args)=>entry('device-folder','Device Folder',...args),drive=(...args)=>entry('google-drive','Google Drive',...args);
  const previous=deviceHistory;
  deviceHistory=freeze({...previous,entries:freeze([folder('c','c','2026-09-20T10:00:00.000Z','latest'),folder('d','d','2026-09-20T09:00:00.000Z','hourly'),folder('s','s','2026-09-19T08:00:00.000Z','before-restore',{safetyCheckpointId:CHECKPOINT('s')})])});
  driveHistoryNow=freeze({...driveHistory,entries:freeze([drive('e','e','2026-09-20T11:00:00.000Z','latest'),drive('c','c','2026-09-20T10:00:00.000Z','hourly'),drive('f','d','2026-09-20T09:00:05.000Z','hourly'),drive('t','t','2026-09-19T07:00:00.000Z','before-restore',{safetyCheckpointId:CHECKPOINT('t')})])});
  driveConnected=true;await host.history.open();await new Promise(resolve=>setImmediate(resolve));
  const listed=host.history.status().entries;
  assert.deepEqual(listed.map(item=>[item.location.sourceId,item.location.checkpointId,item.location.tier,item.held.join('+')]),[
    ['google-drive',CHECKPOINT('e'),'latest','Google Drive'],
    ['device-folder',CHECKPOINT('c'),'hourly','Device Folder+Google Drive'],
    ['device-folder',CHECKPOINT('d'),'hourly','Device Folder+Google Drive'],
    ['device-folder',CHECKPOINT('s'),'before-restore','Device Folder'],
    ['google-drive',CHECKPOINT('t'),'before-restore','Google Drive']
  ],'each version once, read locally when both hold it; each safety version on its own');
  const statusText=card=>card.children[1].children[0].children[0].textContent,cards=nodes.get('managed-version-history-list').children;
  assert.deepEqual(cards.map(statusText).map(text=>text.replace(/^.*?(?= · Only in|$)/u,'')),[' · Only in Google Drive','','',' · Only in Device Folder',' · Only in Google Drive'],'only a version one location holds says where it is');
  assert.match(statusText(cards[0]),/^Latest/u);assert.equal(nodes.get('managed-version-history-status').textContent,'5 versions.');
  // Restoring a version both hold reads it from the Device Folder.
  chooseMode='replace';restoredCheckpoint='';
  assert.equal(await host.history.recover({target:{closest:()=>cards[2].children[1].children[1].children[0]}}),true);assert.equal(restoredCheckpoint,CHECKPOINT('d'));
  // With one location connected, rows do not say where a version is.
  driveConnected=false;await host.history.open();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(nodes.get('managed-version-history-list').children.map(statusText).some(text=>text.includes('Only in')),false);
  // A location that cannot be read is named; the other's versions still list.
  driveConnected=true;driveHistoryNow=freeze({available:false,reason:'permission'});await host.history.open();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(host.history.status().entries.length,3);assert.equal(nodes.get('managed-version-history-status').textContent,'3 versions. Google Drive needs permission again.');
  deviceHistory=previous;driveHistoryNow=driveHistory;driveConnected=false;host.history.close();
}
// A version this app cannot read shows on its own with Remove. A copy waiting
// for the password gives way to one that can be read, and one with no other
// copy says it is locked. A version the Device Folder cannot read is read from
// Drive instead, but only when nothing changed yet.
{
  const entry=(sourceId,sourceLabel,letter,data,exportedAt,tier,extra={})=>freeze({...deviceEntry,logicalId:'state_'+data.repeat(64),logicalFingerprint:data.repeat(64),exportedAt,location:freeze({sourceId,sourceLabel,checkpointId:CHECKPOINT(letter),exportedAt,tier,encrypted:false,...extra})});
  const folder=(...args)=>entry('device-folder','Device Folder',...args),drive=(...args)=>entry('google-drive','Google Drive',...args);
  const special=(kind,letter,exportedAt,tier)=>freeze({logicalId:`${kind}_${CHECKPOINT(letter)}`,logicalFingerprint:'',exportedAt,counts:null,origin:'',[kind]:true,location:freeze({sourceId:'device-folder',sourceLabel:'Device Folder',checkpointId:CHECKPOINT(letter),exportedAt,tier,encrypted:kind==='locked'})});
  const previous=deviceHistory;
  deviceHistory=freeze({...previous,entries:freeze([special('unreadable','u','2026-09-20T13:00:00.000Z','unreadable'),special('locked','l','2026-09-20T10:00:00.000Z','latest'),folder('c','c','2026-09-20T09:00:00.000Z','retained'),special('locked','m','2026-09-20T08:00:00.000Z','retained')])});
  driveHistoryNow=freeze({...driveHistory,entries:freeze([drive('l','l','2026-09-20T10:00:00.000Z','latest'),drive('c','c','2026-09-20T09:00:00.000Z','hourly')])});
  driveConnected=true;await host.history.open();await new Promise(resolve=>setImmediate(resolve));
  const listed=host.history.status().entries,cards=nodes.get('managed-version-history-list').children;
  assert.deepEqual(listed.map(item=>[item.location.sourceId,item.location.checkpointId,item.location.tier]),[['device-folder',CHECKPOINT('u'),'unreadable'],['google-drive',CHECKPOINT('l'),'latest'],['device-folder',CHECKPOINT('c'),'retained'],['device-folder',CHECKPOINT('m'),'retained']],'an unreadable version is never Latest; a locked copy gives way to Drive’s');
  assert.deepEqual(listed[1].copies.map(at=>at.sourceId),['device-folder']);assert.deepEqual(listed[2].copies.map(at=>at.sourceId),['google-drive']);
  assert.equal(nodes.get('managed-version-history-status').textContent,'3 versions. 1 can’t be read by this app.');
  assert.equal(cards[0].children[0].children[1].textContent,'Can’t be read by this app');assert.match(cards[0].children[1].children[0].children[0].textContent,/newer Study Director, or the file is damaged/u);
  const [restore,remove]=cards[0].children[1].children[1].children;assert.equal(cards[0].children[1].children[1].children.length,2);
  assert.ok(cards[0].classList.contains('unreadable')&&cards[0].attributes['aria-disabled']==='true','it shows muted');assert.equal(restore.disabled,true,'Restore is there but disabled');
  assert.equal(remove.dataset.action,'remove-managed-version');assert.ok(remove.classList.contains('danger')&&!remove.disabled,'Remove is red and enabled');
  assert.match(cards[3].children[0].children[1].textContent,/^Locked: enter the backup password/u);
  // Restore: the Device Folder's read fails before anything changed, so Drive's copy is read.
  let driveRestored='';providerRestoreImpl=async(id,options)=>{driveRestored=`${id}:${options.checkpointId}`;return freeze({ok:true});};
  chooseMode='replace';deviceRestoreFailure=Object.assign(new Error('Repository object obj_x is unavailable.'),{repositoryReadFailed:true});
  assert.equal(await host.history.recover({target:{closest:()=>cards[2].children[1].children[1].children[0]}}),true);assert.equal(driveRestored,`google-drive:${CHECKPOINT('c')}`);
  assert.ok(diagnostics.some(row=>row.scope==='backup.version-history-other-copy'));
  // Any other failure is reported, not tried elsewhere.
  await host.history.open();await new Promise(resolve=>setImmediate(resolve));driveRestored='';deviceRestoreFailure=new Error('This device’s data changed. Nothing was restored.');
  assert.equal(await host.history.recover({target:{closest:()=>nodes.get('managed-version-history-list').children[2].children[1].children[1].children[0]}}),false);assert.equal(driveRestored,'');
  // Remove asks first, then removes it from the list.
  await host.history.open();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(await host.history.removeVersion({target:{closest:()=>nodes.get('managed-version-history-list').children[0].children[1].children[1].children[1]}}),true);
  assert.deepEqual(removedVersions.at(-1),['device-folder',CHECKPOINT('u')]);assert.ok(host.history.status().entries.every(item=>item.location.tier!=='unreadable'));assert.equal(nodes.get('managed-version-history-status').textContent,'Version removed.');
  providerRestoreImpl=async()=>freeze({ok:true});deviceHistory=previous;driveHistoryNow=driveHistory;driveConnected=false;host.history.close();
}
// A note's earlier versions combine every connected location: one entry per
// distinct text, newest first, never the note's current text. Labels read in
// plain time, with the time added when two share a date. Review compares that
// one note, by id.
{
  driveConnected=true;const calls=[];
  const version=(sourceId,sourceLabel,letter,exportedAt,text)=>freeze({sourceId,sourceLabel,checkpointId:CHECKPOINT(letter),exportedAt,text});
  const covered=freeze({checkpointIds:freeze([CHECKPOINT('c'),CHECKPOINT('d'),CHECKPOINT('e')]),contents:freeze(['c'.repeat(64)])});let driveSkip=null;
  noteVersionsImpl=async(id,noteId,options)=>{calls.push([id,noteId]);if(id==='google-drive')driveSkip=options.skip||null;return id==='device-folder'
    ?freeze({available:true,covered,entries:freeze([version('device-folder','Device Folder','c','2026-09-20T12:00:00.000Z','current text'),version('device-folder','Device Folder','d','2026-09-19T12:00:00.000Z','older text'),version('device-folder','Device Folder','e','2026-09-18T09:00:00.000Z','oldest text')])})
    :freeze({available:true,entries:freeze([version('google-drive','Google Drive','f','2026-09-19T18:00:00.000Z','older text'),version('google-drive','Google Drive','g','2026-09-18T20:00:00.000Z','text only on Drive')])});};
  const opened=await host.history.openNote(freeze({id:'n_0123456789abcdef',label:'Ethics',text:'current text',onRestored:()=>{}}));
  assert.equal(opened.opened,true);await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls,[['device-folder','n_0123456789abcdef'],['google-drive','n_0123456789abcdef']],'every connected location is asked for the note by id');
  assert.deepEqual(driveSkip&&{checkpointIds:[...driveSkip.checkpointIds],contents:[...driveSkip.contents]},{checkpointIds:covered.checkpointIds.slice(),contents:covered.contents.slice()},'Drive skips the versions the Device Folder already read');
  const cards=nodes.get('managed-version-history-list').children,buttons=cards.map(card=>card.children[0].children[2]),labels=cards.map(card=>card.children[0].children[0].textContent);
  assert.deepEqual(buttons.map(button=>button.dataset.versionHistoryCheckpoint),[CHECKPOINT('f'),CHECKPOINT('g'),CHECKPOINT('e')],'one entry per distinct text, newest first, without the current text');
  assert.equal(labels[0].includes(','),false,'a date with one version shows the day only');assert.ok(labels[1].includes(',')&&labels[2].includes(','),'two versions on one date show their times');
  assert.equal(nodes.get('managed-version-history-title').textContent,'Ethics');
  providerBringInResult=freeze({ok:true});
  assert.equal(await host.history.recover({target:{closest:()=>buttons[1]}}),true);
  assert.equal(providerBringInCheckpoint,CHECKPOINT('g'));assert.equal(lastProviderBringIn.note,'n_0123456789abcdef','Review compares only this note');
  host.history.close();driveConnected=false;
}
console.log(JSON.stringify({status:'PASS',suite:'backup-recovery-host',oneVersionHistory:true,noteVersionsReadOnce:true,combinedNoteVersions:true,providerScopedRecovery:true,noCrossProviderDiscovery:true,replaceAndCombine:true,durableProviderRetry:true,pendingMutationFailClosed:true,managedRecoveryLifecycle:true,closeDoesNotCancel:true,reopenReattaches:true,cancelSourceScoped:true},null,2));
