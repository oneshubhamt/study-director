import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import vm from 'node:vm';

for(const file of ['source/core/internal.ts','source/core/backup-recovery-host.ts'])vm.runInThisContext(readScript(file),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const BackupRecoveryHost=registry.require('backup-recovery-host',1);
const freeze=Object.freeze;
const clearedAt='2026-11-07T08:00:00.000Z';
const now=Date.parse('2026-11-07T08:01:00.000Z');
const checkpoint='cp_'+'a'.repeat(32);

async function drain(){
  for(let index=0;index<12;index++)await Promise.resolve();
}

function harness({empty=true,sync={cancelled:true,reason:'needs-decision'},missing={cancelled:false,verified:true,added:1,assetsRestored:0,exportedAt:clearedAt},restore={cancelled:false,verified:true},confirm=true,driveConnected=false,driveBusy=false,deviceConnected=false}={}){
  const state={owner:true,revision:1,empty,afterConfirm:()=>{},driveConnected,driveBusy,deviceConnected,health:{lastStudyDataSaveAt:'2026-11-06T12:00:00.000Z',browserDataClearedAt:clearedAt},resets:1,startedFresh:false};
  const calls={syncs:[],missing:[],history:0,restores:[],confirms:0,decisions:0,successes:0,captures:[],suspends:0,releases:0,wakes:[],remember:0,installs:0,refreshes:0};
  let listener=()=>{},timerSequence=0;
  const locations=()=>freeze([
    freeze({id:'google-drive',label:'Google Drive',connected:state.driveConnected}),
    freeze({id:'device-folder',label:'Device Folder',connected:state.deviceConnected})
  ]);
  const controller=BackupRecoveryHost.createStorageReset(freeze({
    authority:freeze({canMutate:()=>state.owner,captureOrigin:()=>{const revision=state.revision;return ()=>{if(!state.owner||revision!==state.revision)throw new Error('origin changed');};}}),
    canonical:freeze({
      dailyRecordsList:async()=>{if(state.empty===null)throw new Error('canonical unavailable');return state.empty?freeze([]):freeze([freeze({date:'2026-11-06'})]);},
      notesReadFreshPayload:async()=>freeze({}),
      activeSessionLoad:async()=>freeze({ok:true,value:null,error:null,storage:freeze({idb:true})}),
      planDataRead:async()=>freeze({draft:'',savedPlans:freeze([])}),
      attachmentsList:async()=>freeze([]),
      pendingReviewsList:async()=>freeze([]),
      savedDayDeletions:async()=>freeze([]),
      noteDeletions:async()=>freeze([])
    }),
    writeback:freeze({
      installationKeep:()=>true,notesRecover:()=>true,planRewrite:()=>true,settingsFlush:()=>true,hasTasks:()=>false,
      writeLiveDraft:async()=>freeze({ok:true,value:null,error:null,storage:freeze({idb:true})})
    }),
    provider:freeze({
      history:async(id,options)=>{
        assert.equal(id,'device-folder');assert.equal(options.interactive,false);calls.history++;
        return freeze({available:true,entries:freeze([freeze({exportedAt:clearedAt,location:freeze({tier:'latest',checkpointId:checkpoint,exportedAt:clearedAt})})])});
      },
      restoreRepositoryProviderVersion:async(id,options)=>{options.assertOrigin();calls.restores.push([id,options]);return restore;},
      bringInRepositoryProvider:async(id,options)=>{calls.missing.push([id,options]);if(missing instanceof Error)throw missing;return missing;},
      syncRepositoryProvider:async id=>{calls.syncs.push(id);if(sync instanceof Error)throw sync;return sync;},
      list:locations,
      locationStatus:id=>id==='google-drive'?freeze({connected:state.driveConnected,engineBusy:state.driveBusy}):id==='device-folder'?freeze({connected:state.deviceConnected}):null,
      suspendBackground:reason=>{assert.equal(reason,'storage-reset');calls.suspends++;let released=false;return freeze({settled:Promise.resolve(),release:()=>{if(released)return false;released=true;calls.releases++;return true;}});},
      connected:id=>id==='google-drive'?state.driveConnected:id==='device-folder'?state.deviceConnected:false
    }),
    device:freeze({
      status:()=>freeze({connected:state.deviceConnected}),
      connect:async()=>{state.deviceConnected=true;return true;},
      install:async()=>{calls.installs++;return true;},
      refreshPermission:async()=>{calls.refreshes++;return true;},
      rememberAfterStorageReset:async()=>{calls.remember++;return true;}
    }),
    storage:freeze({
      health:()=>freeze({...state.health}),
      updateHealth:patch=>{state.health={...state.health,...patch};return true;},
      storedHealth:()=>freeze({...state.health}),
      indexedDbLifecycle:()=>freeze({resets:state.resets,startedFresh:state.startedFresh})
    }),
    presentation:freeze({
      restoreChoices:()=>'your backups',
      openRestore:async()=>true,
      confirm:async()=>{calls.confirms++;state.afterConfirm();return confirm;},
      notify:()=>true,
      emit:event=>{if(event.id==='detected')calls.decisions++;if(event.id==='restored')calls.successes++;return true;},
      resolve:()=>true,
      subscribe:next=>{listener=next;return ()=>{};}
    }),
    ownership:freeze({announceStorageReset:()=>true}),
    mutation:freeze({settled:async()=>true}),
    background:freeze({wake:reason=>{calls.wakes.push(reason);return true;}}),
    session:freeze({hasBlocking:()=>false,suspend:async()=>true}),
    view:freeze({refreshAfterWriteback:()=>true}),
    readiness:freeze({reconcileStartupChangeClock:async()=>true}),
    diagnostics:freeze({capture:(scope,error,level)=>{calls.captures.push([scope,String(error&&error.message||error),level]);return true;}}),
    environment:freeze({
      now:()=>now,nowIso:()=>new Date(now).toISOString(),
      setTimeout:(_callback,_ms)=>++timerSequence,clearTimeout:()=>{}
    })
  }));
  return {
    controller,state,calls,
    begin(){assert.equal(controller.resume(),true,'stored unresolved clear must resume through the checked owner');assert.equal(calls.suspends,1,'resumption must pause provider background work');},
    connectDrive(){state.driveConnected=true;return controller.connectionsChanged();},
    disconnectDrive(){state.driveConnected=false;return controller.connectionsChanged();},
    verifyBackup(){listener({events:freeze([freeze({id:'backup-verified',lifecycle:'succeeded',completedAt:new Date(now+1).toISOString()})])});}
  };
}

const cases=[];
{
  const h=harness({empty:true,sync:freeze({cancelled:false,verified:true})});
  h.begin();assert.equal(h.controller.unresolved(),true);assert.equal(h.connectDrive(),true);await drain();
  assert.deepEqual(h.calls.syncs,['google-drive'],'an empty device must recover through a verified provider sync');
  assert.equal(h.calls.missing.length,0,'empty-device recovery must not use missing-only import');
  assert.equal(h.controller.unresolved(),false,'verified sync settles the clear');
  assert.equal(h.calls.releases,1,'provider suspension releases only after verified recovery');
  assert.deepEqual(h.calls.wakes,['storage-reset-settled']);assert.equal(h.calls.successes,1);
  cases.push('empty device: verified sync from Drive');
}
for(const [label,sync] of [
  ['an unverified sync',freeze({cancelled:false,verified:false})],
  ['a sync needing a decision',freeze({cancelled:true,reason:'needs-decision'})],
  ['a failed sync',new Error('Drive unavailable')],
  ['an empty Drive',freeze({cancelled:true,reason:'no-source'})]
]){
  const h=harness({empty:true,sync});h.begin();const decisions=h.calls.decisions;assert.equal(h.connectDrive(),true,label);await drain();
  assert.equal(h.controller.unresolved(),true,label+' must keep the clear unresolved');
  assert.equal(h.calls.releases,0,label+' must keep automatic uploads suspended');
  assert.ok(h.calls.decisions>decisions,label+' must retain the recovery decision');
  cases.push('empty device: '+label+' keeps the hold');
}
for(const [label,empty] of [['device with data',false],['unreadable local state',null]]){
  const h=harness({empty,missing:freeze({cancelled:false,verified:true,added:1,assetsRestored:0,exportedAt:clearedAt})});
  h.begin();assert.equal(h.connectDrive(),true);await drain();
  assert.equal(h.calls.missing.length,1,label+' must add only missing content');
  assert.equal(h.calls.missing[0][0],'google-drive');assert.equal(h.calls.missing[0][1].missingOnly,true);
  assert.deepEqual(h.calls.syncs,[],'local data or an unreadable local state must never force a replacing sync');
  assert.equal(h.controller.unresolved(),false);assert.equal(h.calls.releases,1);
  cases.push(label+': missing-only recovery');
}
{
  const h=harness({empty:true,deviceConnected:false,confirm:true});h.begin();
  assert.equal(await h.controller.connectDevice(),true);assert.equal(h.calls.history,1);assert.equal(h.calls.confirms,1);assert.equal(h.calls.restores.length,1);
  assert.equal(h.calls.restores[0][0],'device-folder');assert.equal(h.calls.restores[0][1].checkpointId,checkpoint);
  assert.equal(h.controller.unresolved(),true,'the hold stays until verified backup completion is observed');
  h.verifyBackup();await drain();assert.equal(h.controller.unresolved(),false);assert.equal(h.calls.releases,1);
  cases.push('empty device: Device Folder recovery settles only after verification');
}
{
  const h=harness({empty:true,deviceConnected:false,confirm:false});h.begin();const decisions=h.calls.decisions;
  await h.controller.connectDevice();assert.equal(h.calls.history,1);assert.equal(h.calls.restores.length,0);assert.equal(h.controller.unresolved(),true);
  assert.ok(h.calls.decisions>decisions,'declining Device Folder recovery keeps the decision visible');
  assert.equal(h.calls.releases,0);
  cases.push('empty device: declined Device Folder recovery keeps the hold');
}
{
  const h=harness({empty:true,deviceConnected:false,confirm:true,restore:freeze({cancelled:false,verified:false})});h.begin();const decisions=h.calls.decisions;
  await h.controller.connectDevice();
  assert.equal(h.calls.restores.length,1,'the Device Folder restore is attempted');
  assert.equal(h.controller.unresolved(),true,'an unverified Device Folder outcome cannot settle the clear');
  assert.equal(h.calls.releases,0,'automatic uploads stay suspended after an unverified Device Folder outcome');
  assert.ok(h.calls.decisions>decisions,'an unverified Device Folder outcome keeps the recovery decision visible');
  cases.push('empty device: unverified Device Folder restore keeps the hold');
}
{
  const h=harness({empty:true,sync:freeze({cancelled:true,reason:'needs-decision'})});h.begin();
  h.state.driveConnected=true;h.state.driveBusy=true;assert.equal(h.controller.connectionsChanged(),false,'busy Drive must not start recovery');
  h.state.driveBusy=false;assert.equal(h.controller.connectionsChanged(),true);await drain();assert.deepEqual(h.calls.syncs,['google-drive']);
  assert.equal(h.controller.connectionsChanged(),false,'the same connection is tried once');
  h.disconnectDrive();h.state.driveConnected=true;assert.equal(h.controller.connectionsChanged(),true,'a later reconnection may retry');await drain();
  assert.equal(h.calls.syncs.length,2);h.controller.settle();assert.equal(h.controller.connectionsChanged(),false,'settled clears have no connection recovery');
  cases.push('Drive connection recovery is once per connection and respects busy state');
}

for(const [label,change] of [
  ['successor owner',h=>{h.state.revision++;}],
  ['new local study data',h=>{h.state.empty=false;}],
  ['retired recovery hold',h=>{h.controller.settle();}]
]){
  const h=harness({empty:true,deviceConnected:false,confirm:true});h.begin();
  h.state.afterConfirm=()=>change(h);
  await h.controller.connectDevice();
  assert.equal(h.calls.confirms,1,label+' changed during the confirmation');
  assert.equal(h.calls.restores.length,0,label+' cannot authorize the stale replacement');
  if(label!=='retired recovery hold'){assert.equal(h.controller.unresolved(),true);assert.equal(h.calls.releases,0);}
  cases.push('stale Device Folder confirmation: '+label);
}

console.log(JSON.stringify({status:'PASS',suite:'storage-reset-connect-recovery',productionOwner:'backup-recovery-host',cases},null,2));
