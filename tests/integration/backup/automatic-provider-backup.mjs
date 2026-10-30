import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createFakeClock} from '../../helpers/fake-clock.mjs';

// Automatic Google Drive backups run through the production engine on a fake
// clock: the same cadence as the Device Folder, an early run before the
// sign-in ends, catch-up on the next sign-in, and one quiet expiry notice
// only for people who back up to Drive.
const freeze=Object.freeze,noop=()=>{},MINUTE=60*1000;
// both: a Device Folder too, with Drive as the shared location, as on a
// computer that uses both.
// shared, driveList, driveDownload and sharedBase: Drive as the shared
// location with versions of its own, for the sync catch-up.
// share: whether this device may upload to the shared location (no while it
// holds data from a newer version).
function fixture({covered='',signedIn=true,expiresInMs=59*MINUTE,both=false,shared=both,driveList=null,driveDownload=null,sharedBase=async()=>null,share=()=>true}={}){
  const clock=createFakeClock('2026-10-06T08:00:00.000Z'),emitted=[],publishedAt=[],publishedBy=[],diagnosticStarts=[],coveredBy=new Map();
  let current=new clock.Date().toISOString(),authorized=signedIn,expiresAt=clock.now()+expiresInMs,listener=null,publicationHook=noop,durable=null;
  const context={Object,Symbol,TypeError,Error,Date:clock.Date,AbortController,Blob,Promise,Map,Set,TextEncoder,Uint8Array,console,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout};context.globalThis=context;vm.createContext(context);
  for(const name of ['internal','operation-lifecycle','repository-policy','repository-background','backup-provider','backup-recovery-host','notice-coordinator','backup-presentation'])vm.runInContext(fs.readFileSync(`source/core/${name}.js`,'utf8'),context,{filename:`source/core/${name}.js`});
  const registry=context[Symbol.for('studyDirector.internalModules.v1')],lifecycle=registry.require('operation-lifecycle',1),background=registry.require('repository-background',1,freeze({lifecycle})),policy=registry.require('repository-policy',1);
  const coordinator=registry.require('notice-coordinator',1).createCoordinator(freeze({setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout}));
  const notifications=freeze({...coordinator,emit:raw=>{emitted.push(raw);return coordinator.emit(raw);}});
  const presentation=registry.require('backup-presentation',1).createPresentation(freeze({notifications}));
  const pending=registry.require('backup-recovery-host',1).createPendingStore(freeze({sourceRevision:()=>current,diagnostics:freeze({capture:noop}),storage:freeze({read:async()=>durable,write:async value=>{durable=value;},remove:async()=>{durable=null;}})}));
  const unexpected=()=>{throw new Error('Unexpected executor in the automatic backup test');};
  const pipeline=freeze({noteObject:unexpected,readNote:unexpected,createPublication:unexpected,publishInline:unexpected,inspectManifest:unexpected,inspect:unexpected,bringIn:unexpected,restoreVersion:unexpected,verifyCheckpoint:unexpected,sharedBase,establishBase:unexpected,verifyObject:unexpected,inspectCommit:unexpected,
    publish:async(_history,options,executor)=>{
      assert.equal(options.interactive,false,'automatic backups never prompt');
      const captured=current;publishedAt.push(clock.now());publishedBy.push(freeze({by:both&&options.shared!==true?'device-folder':'google-drive',at:clock.now()}));await publicationHook(options);
      await executor.onCommitted(freeze({sourceRevision:captured,exportedAt:captured}));
      return {checkpointId:'cp_'+'a'.repeat(32),sourceRevision:captured,publication:{name:'cp_'+'a'.repeat(32)},manifest:{objects:[]}};
    },
    scrub:async()=>({status:'completed',complete:true}),cleanup:async()=>({gcPending:false}),retention:freeze({}),validatePolicy:noop,classifyState:()=>({committed:[],uncommitted:[],orphanCommits:[],invalidPairs:[]}),activeProtected:()=>null,selectRetention:()=>({retained:[],remove:[]}),projectHistory:()=>[],markCompleted:({copy})=>{if(copy)coveredBy.set(copy.source,copy.sourceRevision);}});
  const runtime=registry.require('backup-provider',1,freeze({repositoryPolicy:policy})).createRuntime(freeze({background:freeze({format:background.format,contractVersion:1,createCoordinator:background.createCoordinator,maintenance:background.maintenance,maintenanceActionable:background.maintenanceActionable}),repository:pipeline,ports:freeze({
    configuration:freeze({appVersion:'qa'}),controller:freeze({beginImport:()=>freeze({cancel:noop}),cancelImport:noop,finishImport:noop}),exports:freeze({followProtection:async()=>false,protect:async file=>{const value=typeof file==='function'?await file():file;return freeze({...value,encrypted:false,protectionId:'',checkProtection:async()=>{}});},unprotect:async blob=>freeze({blob,encrypted:false}),run:unexpected}),domain:freeze({clampText:value=>String(value||'')}),view:freeze({presentation}),
    ownership:freeze({canShare:()=>share(),canRunBackground:()=>true,requireMutationControl:noop}),environment:freeze({setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout}),diagnostics:freeze({capture:noop,start:(name,label,details)=>{diagnosticStarts.push(freeze({name,label,details}));return 'trace';},mark:noop,finish:noop,fail:noop})
  })}));
  const connected=()=>authorized&&clock.now()<expiresAt;
  if(both)runtime.register(freeze({id:'device-folder',label:'Device Folder',connected:()=>true,backgroundAvailable:()=>true,
    repository:freeze({scope:async()=>'folder-scope',list:async()=>({items:[],overflow:false,ignored:0}),upload:unexpected,download:unexpected,delete:unexpected})}));
  runtime.register(freeze({id:'google-drive',label:'Google Drive',...(shared?{shared:true}:{}),connected,backgroundAvailable:connected,connectionExpiresAt:()=>connected()?expiresAt:0,subscribeConnection:fn=>{listener=fn;},
    repository:freeze({scope:async()=>'repo-scope',list:driveList||(async()=>({items:[],overflow:false,ignored:0})),upload:unexpected,download:driveDownload||unexpected,delete:unexpected})}));
  runtime.configurePendingBackupRetry(freeze(pending));
  runtime.configureAutomaticBackup(freeze({covered:id=>coveredBy.has(id)?coveredBy.get(id):covered,current:()=>current}));
  return {
    clock,runtime,presentation,policy:policy.protocol,publishedAt,publishedBy,diagnosticStarts,onPublication:fn=>{publicationHook=fn;},
    change:(urgent=false)=>{current=new clock.Date(clock.now()).toISOString();runtime.noteChange({urgent});},
    expire:()=>{expiresAt=clock.now();listener?.();},
    signIn:(lifetime=59*MINUTE)=>{authorized=true;expiresAt=clock.now()+lifetime;listener?.();},
    notices:(id='permission')=>emitted.filter(raw=>raw.source==='google-drive'&&raw.id===id),
    noticeEvent:(id='permission')=>coordinator.eventStatus().events.find(row=>row.source==='google-drive'&&row.id===id)
  };
}
// Small steps, so work started by a timer finishes before the clock moves on.
async function tick(t,ms){for(let left=ms;left>0;left-=5000){await t.clock.advance(Math.min(5000,left));await t.clock.drainMicrotasks(240);}}
const cases=[];
{
  const t=fixture();assert.equal(t.policy.automaticQuietMs,20*MINUTE,'automatic backups follow the 20-minute cadence');
  await tick(t,1000);t.change();t.change();await tick(t,2*MINUTE);t.change();await tick(t,4*60*MINUTE);t.expire();await tick(t,MINUTE);
  assert.equal(t.publishedAt.length,0,'a device that never backed up to Drive never backs up to it on its own');
  assert.equal(t.notices().length,0,'and is never told about the sign-in ending');
  cases.push('never used: no automatic backups, no notices');
}
{
  const t=fixture({covered:'2026-10-06T07:00:00.000Z'});await tick(t,1000);assert.equal(t.publishedAt.length,1,'signing in catches up on changes made since the last Drive backup');
  const start=t.clock.now();t.change();await tick(t,10*MINUTE);t.change();await tick(t,9*MINUTE);
  assert.equal(t.publishedAt.length,1,'later changes do not restart the countdown, and nothing runs before it ends');
  await tick(t,1*MINUTE+1000);assert.equal(t.publishedAt.length,2);assert.ok(t.publishedAt[1]-start>=20*MINUTE&&t.publishedAt[1]-start<=20*MINUTE+5000,'a backup within 20 minutes of the first change');
  await tick(t,60*MINUTE);assert.equal(t.publishedAt.length,2,'no changes, no further backups');
  assert.ok(t.diagnosticStarts.some(row=>row.name==='provider-convergence'&&row.details?.trigger==='automatic'),'ordinary cadence must retain its automatic trigger');
  cases.push('20-minute cadence from the first change');
}
{
  const t=fixture({covered:'2026-10-06T08:00:00.000Z'});await tick(t,1000);t.change();await tick(t,MINUTE);
  const before=t.publishedAt.length;t.change(true);await tick(t,t.policy.automaticUrgentMs+1000);
  assert.equal(t.publishedAt.length,before+1,'a key moment (finishing the day) backs up within seconds');
  assert.ok(t.diagnosticStarts.some(row=>row.name==='provider-convergence'&&row.details?.trigger==='important-change'),'urgent work must retain its important-change trigger rather than being mislabeled managed recovery');
  cases.push('key moments back up within seconds, correctly attributed in diagnostics');
}
{
  const t=fixture({covered:'2026-10-06T08:00:00.000Z',expiresInMs:12*MINUTE});await tick(t,1000);
  const start=t.clock.now();t.change();await tick(t,8*MINUTE);
  assert.equal(t.publishedAt.length,1,'changes back up before the sign-in ends instead of waiting for the next one');
  assert.ok(t.publishedAt[0]-start<=7*MINUTE+5000,'five minutes before the sign-in ends');
  cases.push('backs up before the sign-in expires');
}
{
  const t=fixture({covered:'2026-10-06T08:00:00.000Z'});await tick(t,1000);t.change();await tick(t,MINUTE);t.expire();await tick(t,1000);
  assert.equal(t.notices().length,1,'one notice when the sign-in ends');
  const notice=t.notices()[0];assert.equal(notice.surface,'toast');assert.notEqual(notice.persistent,true,'the notice closes on its own and can be dismissed');assert.equal(notice.lifecycle,'succeeded');assert.equal(notice.action?.label,undefined,'the app supplies the Reconnect action');
  for(let i=0;i<5;i++){t.change(i%2===0);await tick(t,30*MINUTE);t.expire();}
  assert.equal(t.notices().length,1,'changes and later checks while signed out never repeat it');
  assert.equal(t.publishedAt.length,0,'nothing is backed up while signed out');
  t.signIn();await tick(t,2000);assert.equal(t.publishedAt.length,1,'the next sign-in backs up what changed while signed out');
  assert.equal(t.noticeEvent(),undefined,'signing in clears the notice');
  t.expire();await tick(t,1000);assert.equal(t.notices().length,2,'a later sign-in that ends is mentioned once again');
  cases.push('one dismissible expiry notice per sign-in, catch-up on reconnect');
}
{
  const t=fixture({covered:'2026-10-06T08:00:00.000Z'});await tick(t,1000);let release;
  t.change(true);t.onPublication(()=>new Promise(resolve=>{release=resolve;}));await tick(t,5000);
  t.change();t.onPublication(noop);release();await tick(t,MINUTE);
  assert.equal(t.publishedAt.length,1,'a change during a backup waits for the normal cadence, not a failure retry');
  await tick(t,20*MINUTE);assert.equal(t.publishedAt.length,2);
  cases.push('changes during a backup wait for the next cadence');
}
{
  const t=fixture({covered:'2026-10-06T08:00:00.000Z'});await tick(t,1000);t.change();await tick(t,MINUTE);
  assert.equal(t.publishedAt.length,0);const flushed=t.runtime.flushAutomatic('app-hidden');await tick(t,5000);await flushed;
  assert.equal(t.publishedAt.length,1,'going to the background backs up waiting changes at once');
  await t.runtime.flushAutomatic('app-update');await tick(t,5000);assert.equal(t.publishedAt.length,1,'nothing waiting, nothing backed up');
  assert.equal(t.runtime.automaticWaiting(),false);t.change();assert.equal(t.runtime.automaticWaiting(),true);
  cases.push('backs up at once when the app goes to the background or updates');
}
{
  // A computer with both locations publishes the same canonical local state
  // independently to each destination. Neither location waits for or copies
  // a checkpoint from the other.
  const t=fixture({covered:'2026-10-06T08:00:00.000Z',both:true});await tick(t,1000);t.publishedBy.length=0;
  t.change();await tick(t,MINUTE);assert.equal(t.publishedBy.length,0);
  const start=t.clock.now();await t.runtime.flushAutomatic('app-hidden');await tick(t,30*1000);
  const folder=t.publishedBy.find(row=>row.by==='device-folder'),drive=t.publishedBy.find(row=>row.by==='google-drive');
  assert.ok(folder&&folder.at-start<=5000,'the Device Folder backs up at once');
  assert.ok(drive&&drive.at-start<=5000,'Drive independently backs up the same local state at once');
  // The next urgent round independently reaches both locations again; order is
  // deliberately not part of the contract.
  t.publishedBy.length=0;t.change(true);await tick(t,t.policy.automaticUrgentMs+30*1000);
  assert.equal(t.publishedBy.length,2);assert.deepEqual(new Set(t.publishedBy.map(row=>row.by)),new Set(['device-folder','google-drive']));
  cases.push('both locations: each publishes canonical local state independently');
}
{
  // Drive holds a version this device has not taken in. A catch-up that fails
  // is tried again on the backoff (30 seconds, then 2 and 10 minutes), not at
  // the next 20-minute check; after four failures the notice speaks of
  // syncing, and it goes once Drive is in step again.
  const id='cp_'+'b'.repeat(32),item=kind=>freeze({kind,id,name:id+(kind==='commit'?'.sdcommit':'.sdcheckpoint'),size:100,createdAt:'2026-10-06T07:30:00.000Z',modifiedAt:'2026-10-06T07:30:00.000Z',remoteId:kind+'-1'});
  const reads=[];let inStep=false;
  const t=fixture({covered:'2026-10-06T09:00:00.000Z',shared:true,sharedBase:async()=>inStep?freeze({checkpointId:id}):null,
    driveList:async({kind})=>({items:kind==='checkpoint'||kind==='commit'?[item(kind)]:[],overflow:false,ignored:0}),
    driveDownload:async()=>{reads.push(t.clock.now());throw Object.assign(new Error('network down'),{code:'DRIVE_NETWORK'});}});
  const start=t.clock.now(),attempts=()=>[...new Set(reads.map(at=>Math.round((at-start)/1000)))];
  await tick(t,10*1000);assert.equal(attempts().length,1,'signing in catches up at once');
  assert.equal(t.runtime.locationStatus('google-drive').sync.failed,true,'a failed sync is known');
  assert.match(t.presentation.syncLabel({...t.runtime.locationStatus('google-drive'),sync:{...t.runtime.locationStatus('google-drive').sync,syncedAt:'2026-10-06T07:00:00.000Z'}}),/^Last synced /u,'so the sidebar says "Last synced", not "Synced"');
  await tick(t,40*1000);assert.equal(attempts().length,2,'a failed catch-up is tried again within a minute');
  assert.ok(t.diagnosticStarts.some(row=>row.name==='provider-convergence'&&row.details?.trigger==='catch-up-failed'),'when catch-up failure backoff owns the next run, diagnostics preserve its exact trigger');
  await tick(t,2*MINUTE);assert.equal(attempts().length,3,'then after two minutes');
  assert.ok(attempts().at(-1)<5*MINUTE,'long before the next 20-minute check');
  await tick(t,11*MINUTE);assert.equal(attempts().length,4,'then after ten');
  const failing=t.notices('retry-exhausted');assert.equal(failing.length,1,'four failures in a row are mentioned once');
  assert.match(String(failing[0].message||''),/^Syncing with Google Drive keeps failing/u,'in words about syncing, not backing up');
  inStep=true;await tick(t,31*MINUTE);
  assert.equal(attempts().length,4,'once Drive is in step nothing more is read');
  assert.equal(t.noticeEvent('retry-exhausted'),undefined,'and the notice goes');
  assert.equal(t.runtime.locationStatus('google-drive').sync.failed,false,'and the sidebar says "Synced" again');
  cases.push('a failed sync catch-up retries on the backoff, not the 20-minute check');
}
{
  // Force a sync-only catch-up first, then create an urgent canonical edit
  // inside that catch-up. Its failure belongs to the older attempt revision,
  // so that backoff must not replace the newer edit's urgent deadline.
  const id='cp_'+'d'.repeat(32),item=kind=>freeze({kind,id,name:id+(kind==='commit'?'.sdcommit':'.sdcheckpoint'),size:100,createdAt:'2026-10-06T07:30:00.000Z',modifiedAt:'2026-10-06T07:30:00.000Z',remoteId:kind+'-revision'});
  const reads=[];let t=null,changed=false,changedAt=NaN;
  t=fixture({covered:'2026-10-06T07:00:00.000Z',shared:true,
    driveList:async({kind})=>({items:kind==='checkpoint'||kind==='commit'?[item(kind)]:[],overflow:false,ignored:0}),
    driveDownload:async()=>{reads.push(t.clock.now());if(!changed){changed=true;await t.clock.advance(1);changedAt=t.clock.now();t.change(true);}throw Object.assign(new Error('network down'),{code:'DRIVE_NETWORK'});}});
  assert.equal(t.runtime.scheduleSharedSync('google-drive','revision-aware-catch-up'),true);
  await tick(t,t.policy.automaticUrgentMs+7000);
  assert.ok(Number.isFinite(changedAt),'the canonical edit must occur inside the first catch-up attempt');
  // The change is asynchronous and may occur at the end of the first fake-clock
  // advance. Give its own urgent deadline time to become eligible.
  await tick(t,t.policy.automaticUrgentMs+1000);
  // FakeClock finishes its advance before microtasks can arm a timer that is
  // already due. Flush that same instant once, matching the browser's next task.
  await t.clock.advance(0);await t.clock.drainMicrotasks(240);
  const distinctReads=[...new Set(reads)];
  assert.ok(distinctReads.some(at=>at>changedAt&&at<=changedAt+t.policy.automaticUrgentMs+1000),'the newer revision must get another catch-up opportunity inside its urgent window rather than inherit the older attempt\'s backoff');
  const afterUrgent=distinctReads.length;await tick(t,10*1000);
  assert.equal([...new Set(reads)].length,afterUrgent,'once the newer revision\'s own catch-up attempt fails, its normal retry backoff may govern');
  cases.push('catch-up failure backoff is revision-aware');
}
{
  // A manual shared upload that loses its turn may discover a newer local edit
  // during the attempt. That edit keeps its urgent deadline.
  const t=fixture({covered:'2026-10-06T08:00:00.000Z',shared:true});await tick(t,1000);let first=true;
  // Give Back up now real canonical work. The publication hook then creates a
  // second urgent revision inside that in-flight attempt before simulating turn loss.
  t.change();
  t.onPublication(async()=>{if(!first)return;first=false;await t.clock.advance(1000);t.change(true);throw Object.assign(new Error('another device is publishing'),{code:'REPOSITORY_SYNC_TURN'});});
  assert.equal(await t.runtime.backup('google-drive'),false);
  assert.equal(first,false,'manual turn regression must reach the publication hook');
  assert.equal(t.publishedAt.length,1,'manual turn regression must exercise exactly one publication attempt before checking its retry deadline');
  const pending=t.runtime.backgroundStatus().find(row=>row.job==='google-drive convergence'),dueAt=Date.parse(pending?.nextEligibleAt||'');
  assert.ok(Number.isFinite(dueAt)&&dueAt<=t.clock.now()+t.policy.automaticUrgentMs+1000,`manual-turn deadline state=${JSON.stringify({now:t.clock.now(),urgentMs:t.policy.automaticUrgentMs,pending,publishedAt:t.publishedAt,starts:t.diagnosticStarts.filter(row=>row.name==='provider-convergence')})}`);
  await tick(t,t.policy.automaticUrgentMs+5000);assert.ok(t.publishedAt.length>=2,'newer local work must run before the turn retry deadline');
  cases.push('manual shared turn backoff preserves a newer canonical revision');
}
{
  // Drive's newest version is one this app cannot read (from a newer Study
  // Director, or damaged). Sync reads it once, then waits: no retry ladder,
  // one notice, "Needs app update", and no upload over it. Once that version
  // is gone, the regular check takes sync up again and the notice goes.
  const id='cp_'+'c'.repeat(32),item=kind=>freeze({kind,id,name:id+(kind==='commit'?'.sdcommit':'.sdcheckpoint'),size:100,createdAt:'2026-10-06T07:30:00.000Z',modifiedAt:'2026-10-06T07:30:00.000Z',remoteId:kind+'-2'});
  const reads=[];let present=true;
  const t=fixture({covered:'2026-10-06T09:00:00.000Z',shared:true,
    driveList:async({kind})=>({items:present&&(kind==='checkpoint'||kind==='commit')?[item(kind)]:[],overflow:false,ignored:0}),
    driveDownload:async()=>{reads.push(t.clock.now());throw Object.assign(new Error('Repository checkpoint manifest version is not supported.'),{repositoryUnreadable:true});}});
  await tick(t,10*1000);assert.equal(reads.length>0,true,'signing in tries to catch up');
  const firstReads=reads.length;
  t.change();await tick(t,15*MINUTE);
  assert.equal(reads.length,firstReads,'a version this app cannot read is not retried');
  assert.equal(t.notices('retry-exhausted').length,0,'waiting for an update is not a failure');
  assert.equal(t.notices('sync-newer').length,1,'the person is told once');
  assert.match(String(t.notices('sync-newer')[0].message||''),/can’t read/u);
  assert.equal(t.runtime.locationStatus('google-drive').sync.newer,true,'the sync status says it needs an app update');
  assert.equal(t.presentation.syncLabel(t.runtime.locationStatus('google-drive')),'Needs app update');
  assert.equal(t.runtime.diagnosticSync()[0].needsUpdate,true,'and diagnostics too');
  assert.equal(t.publishedAt.length,0,'nothing is uploaded over a version this app cannot read');
  present=false;await tick(t,25*MINUTE);
  assert.equal(t.runtime.locationStatus('google-drive').sync.newer,false,'once that version is gone sync carries on');
  assert.equal(t.noticeEvent('sync-newer'),undefined,'and the notice goes');
  cases.push('a Drive version this app cannot read makes sync wait for an update');
}
{
  // Coming back to the app checks Drive when the last check is a minute or
  // more old, not at the next 20-minute check; sooner than that it waits.
  const t=fixture({covered:'2026-10-06T08:00:00.000Z',shared:true});await tick(t,10*1000);
  const checked=()=>t.runtime.diagnosticSync()[0].checkedAt,first=checked();
  assert.ok(first,'signing in checks Drive');
  await tick(t,20*1000);t.runtime.wakeBackground('activation');await tick(t,5000);
  assert.equal(checked(),first,'a return within a minute does not check again');
  await tick(t,40*1000);t.runtime.wakeBackground('activation');await tick(t,5000);
  assert.notEqual(checked(),first,'a return after a minute checks Drive at once');
  cases.push('coming back to the app after a minute checks Drive at once');
}
{
  // While this device holds data from a newer version, it uploads nothing to
  // Drive: a version without that data would read as its deletion elsewhere.
  let allowed=false;
  const t=fixture({covered:'2026-10-06T08:00:00.000Z',shared:true,share:()=>allowed?true:'unsupported-data'});await tick(t,1000);t.publishedAt.length=0;
  t.change();await tick(t,25*MINUTE);
  assert.equal(t.publishedAt.length,0,'no Drive upload while newer data is held');
  allowed=true;t.change();await tick(t,25*MINUTE);
  assert.ok(t.publishedAt.length>0,'uploads resume once it may share again');
  cases.push('no Drive upload while this device holds data from a newer version');
}
{
  // A new canonical revision gets its own urgent deadline even if the
  // preceding revision fails, while a repeated signal for the same revision
  // must not defeat the failed work's backoff.
  const t=fixture({covered:'2026-10-06T08:00:00.000Z'});await tick(t,1000);
  let attempts=0;t.onPublication(()=>{attempts++;if(attempts===1){t.change(true);throw new Error('Simulated provider outage');}});
  t.change(true);await tick(t,t.policy.automaticUrgentMs+1000);
  assert.equal(attempts,1,'the first urgent attempt failed');
  assert.equal(t.runtime.backgroundStatus().find(row=>row.job==='google-drive convergence').reason,'important-change','a newer revision keeps its urgent trigger');
  await tick(t,t.policy.automaticUrgentMs+1000);
  assert.equal(attempts,2,'a new revision must not be delayed by the previous revision backoff');
  cases.push('new canonical revision retains urgent scheduling through failed attempt');
}
{
  const t=fixture({covered:'2026-10-06T08:00:00.000Z'});await tick(t,1000);
  let attempts=0;t.onPublication(()=>{attempts++;if(attempts===1){t.runtime.noteChange({urgent:true});throw new Error('Simulated provider outage');}});
  t.change(true);await tick(t,t.policy.automaticUrgentMs+1000);
  assert.equal(attempts,1);
  await tick(t,20*1000);assert.equal(attempts,1,'same-revision urgency cannot bypass backoff');
  await tick(t,12*1000);assert.equal(attempts,2,'same failed revision retries on the governed backoff');
  cases.push('same-revision urgency obeys backoff');
}
console.log(JSON.stringify({status:'PASS',suite:'automatic-provider-backup',productionRuntime:true,cases},null,2));
