import {createBackupPresentation} from '../../helpers/backup-presentation.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for(const file of ['source/core/internal.js','source/core/managed-recovery.js','source/core/backup-recovery-host.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const ManagedRecovery=registry.require('managed-recovery',1);
const BackupRecoveryHost=registry.require('backup-recovery-host',1);
const freeze=Object.freeze;
const CHECKPOINT=value=>'cp_'+value.repeat(32);

const events=[],statuses=[],diagnostics=[],notified=[];
let storedPending=null,storageReadError=null,providerBringInResult=freeze({ok:true}),chooseMode='replace',restoredCheckpoint='',restoredConfirmed=false,suspended=0,cancelImportCalls=0,deviceCancelCalls=0,providerCancelCalls=0,lastProviderCancelId='';
let deletionResults=[];
let providerRestoreImpl=async()=>freeze({ok:true});
let deviceHistoryReads=0,providerHistoryReads=0,providerBringInCheckpoint='',lastUseBackupOptions=null;
const providerHooks={convergence:null,recovery:null,pending:null};
const deviceEntry=freeze({logicalId:'state_'+'a'.repeat(64),logicalFingerprint:'a'.repeat(64),exportedAt:'2026-09-20T12:00:00.000Z',counts:freeze({dailyRecord:2,areaNote:1}),location:freeze({sourceId:'device-folder',sourceLabel:'Device Folder',checkpointId:CHECKPOINT('a'),exportedAt:'2026-09-20T12:00:00.000Z',tier:'latest',encrypted:false})});
const driveEntry=freeze({logicalId:'state_'+'b'.repeat(64),logicalFingerprint:'b'.repeat(64),exportedAt:'2026-09-20T11:00:00.000Z',counts:freeze({dailyRecord:1,areaNote:1}),location:freeze({sourceId:'google-drive',sourceLabel:'Google Drive',checkpointId:CHECKPOINT('b'),exportedAt:'2026-09-20T11:00:00.000Z',tier:'latest',encrypted:false})});
const deviceHistory=freeze({available:true,sourceId:'device-folder',sourceLabel:'Device Folder',entries:freeze([deviceEntry])});
const driveHistory=freeze({available:true,sourceId:'google-drive',sourceLabel:'Google Drive',entries:freeze([driveEntry])});

function node(){return {dataset:{},hidden:false,textContent:'',className:'',open:false,children:[],append(...items){this.children.push(...items);},appendChild(item){this.children.push(item);},replaceChildren(...items){this.children=[...items];},showModal(){this.open=true;},close(){this.open=false;}};}
const nodes=new Map([['managed-version-history',node()],['managed-version-history-kicker',node()],['managed-version-history-title',node()],['managed-version-history-copy',node()],['managed-version-history-progress',node()],['managed-version-history-progress-stage',node()],['managed-version-history-progress-detail',node()],['managed-version-history-list',node()],['managed-version-history-status',node()],['cancel-backup-import',node()]]);
const document={getElementById:id=>nodes.get(id)||null,createElement:()=>node()};
const plan={input:null,cached:'',persisted:'',stored:'',writable:true,saves:[]};
// Today's session: every write commits a new revision and moves the source revision.
const session={tasks:false,revision:0,writes:0,source:'2026-09-20T12:00:00.000Z'};
const host=BackupRecoveryHost.createHost(freeze({presentation:createBackupPresentation(),
  cancellation:freeze({cancelImport:()=>{cancelImportCalls+=1;return true;}}),
  device:freeze({
    backupNow:async reason=>{events.push(`backup:${reason}`);return freeze({ok:true,checkpointId:CHECKPOINT('d')});},
    bringIn:async options=>{events.push(`device-combine:${options.checkpointId}`);return freeze({ok:true});},
    cancelForeground:()=>{deviceCancelCalls+=1;return true;},
    history:async()=>{deviceHistoryReads+=1;return deviceHistory;},
    notifyChange:change=>{notified.push(change);return true;},
    removeSafetyBackup:async()=>freeze({removed:true,entries:freeze([])}),
    restoreVersion:async options=>{restoredCheckpoint=options.checkpointId;restoredConfirmed=options.confirmed===true;events.push(`restore:${restoredCheckpoint}`);return freeze({ok:true});},
    resumeAutomatic:async()=>{suspended-=1;events.push('resume');return true;},
    status:()=>freeze({connected:true}),
    suspendAutomatic:async()=>{suspended+=1;events.push('suspend');return freeze({token:'s1'});}
  }),
  diagnostics:freeze({capture:(scope,error,level)=>diagnostics.push(freeze({scope,message:String(error?.message||error),level})),mark:()=>false}),
  document,
  interactions:freeze({choose:async options=>{
    events.push(`choose:${options.title}`);
    if(options.title==='Restore or combine checkpoint'){lastUseBackupOptions=options;return chooseMode;}
    if(options.title==='Remove safety backup?')return 'remove';
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
  providers:freeze({
    bringInRepositoryProvider:async(id,options)=>{providerBringInCheckpoint=options.checkpointId;events.push(`bring-in:${id}`);return providerBringInResult;},
    cancelForeground:(_reason,id)=>{providerCancelCalls+=1;lastProviderCancelId=String(id||'');return true;},
    configureConvergencePropagation:config=>{providerHooks.convergence=config;return true;},
    configureManagedRecovery:config=>{providerHooks.recovery=config;return true;},
    configurePendingBackupRetry:config=>{providerHooks.pending=config;return true;},
    history:async id=>{providerHistoryReads+=1;assert.equal(id,'google-drive');return driveHistory;},
    list:()=>freeze([freeze({id:'google-drive',label:'Google Drive'})]),
    removeProtectedRepositoryProvider:async()=>freeze({removed:true,entries:freeze([])}),
    restoreRepositoryProviderVersion:async(id,options)=>providerRestoreImpl(id,options)
  }),
  session:freeze({hasBlocking:()=>false}),
  sourceRevision:()=>session.source,
  storage:freeze({read:async()=>{if(storageReadError)throw storageReadError;return storedPending;},remove:async()=>{storedPending=null;return true;},write:async value=>{storedPending=value;return true;}}),
  view:freeze({invalidateAttachments:()=>events.push('invalidate-attachments'),refreshCore:()=>events.push('refresh-core'),refreshNotes:()=>events.push('refresh-notes'),refreshReview:()=>events.push('refresh-review'),renderLibrary:()=>events.push('render-library'),setStatus:(id,message,ok=true)=>{statuses.push(freeze({id,message,ok}));return true;}})
}));

assert.equal(host.format,'study-director.backup-recovery-host');
assert.ok(providerHooks.convergence&&providerHooks.recovery&&providerHooks.pending,'provider hooks must be configured once through the extracted host');
await providerHooks.pending.mark('google-drive');assert.equal(storedPending.entries[0].providerId,'google-drive');await providerHooks.pending.clear('google-drive');assert.equal(storedPending,null);
const preservedPending=freeze({format:'study-director.managed-provider-backup-pending',version:1,entries:freeze([freeze({providerId:'other-provider',requestedAt:'2026-09-20T12:00:00.000Z',sourceRevision:'2026-09-20T11:59:59.000Z'})])});
storedPending=preservedPending;storageReadError=new Error('temporary appMeta read failure');
await assert.rejects(()=>providerHooks.pending.read('google-drive'),/temporary appMeta read failure/,'an unavailable pending-marker read must not become confirmed absence');
await assert.rejects(()=>providerHooks.pending.mark('google-drive'),/temporary appMeta read failure/,'pending-marker mutation must fail closed when the durable state cannot be read');
assert.equal(storedPending,preservedPending,'failed strict pending-marker mutation must not overwrite or remove unread durable state');
storageReadError=null;assert.equal(await providerHooks.pending.read('google-drive'),null,'a successfully read marker without this provider is confirmed absence');storedPending=null;diagnostics.length=0;
const convergence=await providerHooks.convergence.device(freeze({source:'google-drive'}));assert.equal(convergence.status,'pending');assert.equal(notified.at(-1).reason,'managed-convergence');

const recovery=await host.managedRecovery(freeze({kind:'restore-version',label:'Device Folder',createSafety:async()=>freeze({verified:true,checkpointId:CHECKPOINT('c'),sourceRevision:'2026-09-20T12:00:00.000Z'}),apply:async()=>{events.push('apply');return freeze({ok:true});},publishPresent:async()=>freeze({status:'completed',checkpointId:CHECKPOINT('e')})}));
assert.equal(recovery.managedRecovery.present.status,'completed');assert.equal(suspended,0);

await host.history.openSource('device-folder');await new Promise(resolve=>setImmediate(resolve));
assert.equal(deviceHistoryReads,1);assert.equal(providerHistoryReads,0,'Device Folder recovery must not inspect or authorize Google Drive');
const deviceButton={dataset:{versionHistorySource:'device-folder',versionHistoryCheckpoint:CHECKPOINT('a')}};
const presentation=[];host.history.subscribePresentation(value=>presentation.push(value));
assert.equal(await host.history.recover({target:{closest:()=>deviceButton}}),true);
assert.equal(presentation.at(-1).active,false);assert.equal(presentation.at(-1).lifecycle,'succeeded');assert.match(presentation.at(-1).message,/restored locally/);
assert.equal(restoredCheckpoint,CHECKPOINT('a'));assert.equal(restoredConfirmed,true,'provider-owned Replace choice must be the only confirmation before exact restore');
assert.equal(lastUseBackupOptions.cancelLabel,'Keep current');assert.deepEqual(lastUseBackupOptions.choices.map(choice=>choice.value),['combine','replace']);

chooseMode='combine';await host.history.openSource('google-drive');await new Promise(resolve=>setImmediate(resolve));
assert.equal(deviceHistoryReads,1,'Google Drive recovery must not inspect Device Folder');assert.equal(providerHistoryReads,1);
const driveButton={dataset:{versionHistorySource:'google-drive',versionHistoryCheckpoint:CHECKPOINT('b')}};
assert.equal(await host.history.recover({target:{closest:()=>driveButton}}),true);assert.equal(providerBringInCheckpoint,CHECKPOINT('b'));



// Close dismisses only the recovery surface; it must not abort an in-flight restore. Reopening reattaches to the same live presentation.
chooseMode='replace';providerBringInResult=freeze({ok:true});await host.history.openSource('google-drive');await new Promise(resolve=>setImmediate(resolve));
let releaseCloseRestore,lateProgress;providerRestoreImpl=async(_id,options)=>new Promise(resolve=>{lateProgress=options.onProgress;options.onProgress?.(freeze({stage:'download',message:'Downloading backup data…',current:2,total:8,bytesDone:2048,bytesTotal:8192}));releaseCloseRestore=resolve;});
const closeRestore=host.history.recover({target:{closest:()=>driveButton}});await new Promise(resolve=>setImmediate(resolve));
assert.equal(host.history.status().busy,true);assert.equal(host.history.status().progress.current,2);assert.equal(nodes.get('managed-version-history').open,true);
const restorePresentationId=presentation.at(-1).operationId;assert.match(presentation.at(-1).message,/Downloading/);
host.history.close();assert.equal(nodes.get('managed-version-history').open,false,'Close must dismiss the modal while recovery continues.');assert.equal(cancelImportCalls,0);assert.equal(deviceCancelCalls,0);assert.equal(providerCancelCalls,0,'Close must not cancel provider recovery.');
await host.history.openSource('google-drive');assert.equal(nodes.get('managed-version-history').open,true,'Reopening Version History must reattach to the live recovery.');assert.equal(nodes.get('managed-version-history-progress-stage').textContent,'Downloading backup data…');assert.match(nodes.get('managed-version-history-progress-detail').textContent,/2 of 8 complete/);
assert.equal(presentation.at(-1).operationId,restorePresentationId,'reopening retains the operation identity');
releaseCloseRestore(freeze({ok:true,convergence:{source:{status:'completed'},device:{status:'pending'}}}));assert.equal(await closeRestore,true);assert.match(presentation.at(-1).message,/Google Drive backup state is verified/);assert.match(presentation.at(-1).message,/Device Folder backup update is pending/);

const finalMessage=presentation.at(-1).message;lateProgress({message:'Late stale download'});assert.equal(presentation.at(-1).message,finalMessage,'completed restore callbacks cannot revive progress');

// Cancel must abort only the active provider/import operation and surface safe cancellation locally.
await host.history.openSource('google-drive');await new Promise(resolve=>setImmediate(resolve));
providerRestoreImpl=async(_id,options)=>new Promise((resolve,reject)=>{const fail=()=>reject(options.signal?.reason||Object.assign(new Error('cancelled'),{name:'AbortError',code:'STUDY_DIRECTOR_IMPORT_CANCELLED'}));if(options.signal?.aborted)fail();else options.signal?.addEventListener('abort',fail,{once:true});});
const cancelBefore={import:cancelImportCalls,device:deviceCancelCalls,provider:providerCancelCalls};
const cancelRestore=host.history.recover({target:{closest:()=>driveButton}});await new Promise(resolve=>setImmediate(resolve));
lateProgress({message:'Wrong operation'});assert.notEqual(host.history.status().progress?.message,'Wrong operation','old callbacks cannot overwrite a newer operation');
assert.equal(host.history.cancel(),true);assert.ok(cancelImportCalls>cancelBefore.import);assert.equal(deviceCancelCalls,cancelBefore.device,'Provider recovery cancel must not poke the unrelated Device Folder controller.');assert.ok(providerCancelCalls>cancelBefore.provider);assert.equal(lastProviderCancelId,'google-drive','Provider cancellation must remain source-scoped.');assert.equal(await cancelRestore,false);assert.equal(nodes.get('managed-version-history-status').textContent,'Recovery cancelled safely.');
assert.equal(presentation.at(-1).lifecycle,'cancelled');assert.equal(presentation.at(-1).active,false);
providerRestoreImpl=async()=>freeze({ok:true});

chooseMode='combine';providerBringInResult=freeze({ok:false,error:new Error('repository manifest invalid')});
await host.history.openSource('google-drive');await new Promise(resolve=>setImmediate(resolve));assert.equal(await host.history.recover({target:{closest:()=>driveButton}}),false);
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
  await assert.rejects(()=>host.managedRecovery(spec(false)),/changed while the Before restore safety backup/,'a recovery that may replace the session keeps the stale-safety protection');
  assert.equal(session.writes,2);assert.equal(suspended,0);
  Object.assign(session,{tasks:false,writes:0});
}
console.log(JSON.stringify({status:'PASS',suite:'backup-recovery-host',providerScopedRecovery:true,noCrossProviderDiscovery:true,replaceAndCombine:true,durableProviderRetry:true,pendingMutationFailClosed:true,managedRecoveryLifecycle:true,closeDoesNotCancel:true,reopenReattaches:true,cancelSourceScoped:true},null,2));
