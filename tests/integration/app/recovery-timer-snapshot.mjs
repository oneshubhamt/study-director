import {readHostHtml} from '../../../build/host-source.mjs';
import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Bug 13: an add-what's-missing bring-in uploaded its Drive safety version,
// then stopped because local data changed during that upload, and started
// again with a second safety upload. Nothing was being edited: a running
// timer saves a snapshot once a minute, and one landing during the upload
// moved the change clock. The snapshot now waits while a restore, combine or
// sync runs, and is written on the first tick after it.
const source=readHostHtml();
const start=source.indexOf('function maybeSnapshotRunningTimer(){'),end=source.indexOf('\n}',start);
assert.ok(start>0&&end>start,'maybeSnapshotRunningTimer must exist');
let now=0,running='',writes=0;
const context=vm.createContext({
  restoreSessionPersistenceSuppressed:()=>false,managedRecoverySessionQuiesced:()=>false,
  AppMutationCoordinator:{status:()=>({active:running})},
  TimerState:{paused:false,inactiveGap:false,runtime:{startMs:0}},
  DecisionClock:{nowMs:()=>now},TIMER_SNAPSHOT_INTERVAL_MS:60000,
  writeLiveDraftNow:()=>{writes++;context.lastTimerSnapshotMs=now;},lastTimerSnapshotMs:0
});
vm.runInContext(`${source.slice(start,end+2)}\nglobalThis.tick=maybeSnapshotRunningTimer;`,context);

now=60000;context.tick();assert.equal(writes,1,'a running timer saves once a minute');
running='managed-recovery';
for(now=60000;now<=200000;now+=1000)context.tick();
assert.equal(writes,1,'no snapshot lands while a recovery runs, however long its safety upload takes');
running='';now+=1000;context.tick();
assert.equal(writes,2,'the first tick after the recovery writes the snapshot');
running='restore-backup';now+=60000;context.tick();
assert.equal(writes,3,'other stored-data work does not hold the snapshot back');

console.log(JSON.stringify({status:'PASS',suite:'recovery-timer-snapshot',heldDuringRecovery:true,writtenAfter:true}));
