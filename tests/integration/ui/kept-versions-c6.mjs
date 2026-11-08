import {readHostHtml} from '../../../build/host-source.mjs';
import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=readHostHtml();
const start=html.indexOf('const KeptVersions=(()=>{'),end=html.indexOf('\n// Library → Data says what this device holds from a newer version.',start);
assert.ok(start>=0&&end>start,'production Kept Versions UI owner must be available');
const source=html.slice(start,end);
const open=[
  {id:'pr_first',subject:'personal',ref:'personal',keptAt:'2026-11-05T01:00:00.000Z',resolvedAt:''},
  {id:'pr_second',subject:'savedDay',ref:'2026-11-04',keptAt:'2026-11-05T02:00:00.000Z',resolvedAt:''}
];
let busy=false,canMutate=true,pruneCalls=0,renderCount=0,renderDrive=0,cleared=0,notifications=0,failPrune=false;
const diagnostics=[];
const factory=new Function('AppData','BackupController','appCanMutate','AppDiagnostics','renderKeptVersions','renderDriveBackup','LibraryView','NoticeCoordinator','Interactions','driveConnectCard','sessionYieldedAt',
  source+'\nreturn KeptVersions;');
const controller={
  status:()=>({busy}),
  resolveConvergedKeptVersions:async()=>{
    pruneCalls++;
    if(failPrune)throw new Error('Injected strict review-receipt failure');
    // The real controller resolves an already-equal alternative, not a
    // version whose data still meaningfully differs.
    const first=open.find(row=>row.id==='pr_first');if(first)first.resolvedAt='2026-11-05T03:00:00.000Z';
    return first?1:0;
  },
  reviewKeptVersions:async()=>({reviewed:0,left:open.filter(x=>!x.resolvedAt).length,changed:0})
};
const kept=factory({pendingReviews:{list:async()=>open.map(item=>({...item}))}},controller,()=>canMutate,
  {capture:(...args)=>diagnostics.push(args)},()=>renderCount++,()=>renderDrive++,
  {refreshNotes:()=>{}},{resolveEvent:()=>cleared++},{notify:()=>notifications++},null,0);
assert.equal(await kept.refresh(),true);
assert.equal(kept.count(),1,'auto-resolved alternative is not counted after verified tombstone');
assert.equal(pruneCalls,1);
assert.equal(renderCount,1);
assert.equal(renderDrive,1);
assert.equal(notifications,0,'existing alternatives do not produce a spurious first-appearance alert');
busy=true;
assert.equal(await kept.refresh(),true);
assert.equal(pruneCalls,1,'a running sync must not race with automatic review resolution');
assert.equal(kept.count(),1);
busy=false;canMutate=false;
assert.equal(await kept.refresh(),true);
assert.equal(pruneCalls,1,'a follower tab may display counts but never resolve canonical reviews');
canMutate=true;failPrune=true;
assert.equal(await kept.refresh(),true);
assert.equal(kept.count(),1,'failed acknowledgement cannot remove an open review from the count');
assert.ok(diagnostics.some(([label])=>label==='kept-versions.convergence'));
failPrune=false;
open[1].resolvedAt='2026-11-05T03:30:00.000Z';
assert.equal(await kept.refresh(),true);
assert.equal(kept.count(),0);
assert.ok(cleared>=1,'an empty canonical count clears the Kept Versions notice');
console.log(JSON.stringify({status:'PASS',suite:'kept-versions-c6',sourceBacked:true,
  checks:['canonical count after pruning','sync busy gate','follower read only','failure retains count','empty state clears notice']}));
