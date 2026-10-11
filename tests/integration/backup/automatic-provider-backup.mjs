import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createFakeClock} from '../../helpers/fake-clock.mjs';

// Automatic Google Drive backups run through the production engine on a fake
// clock: the same cadence as the Device Folder, an early run before the
// sign-in ends, catch-up on the next sign-in, and one quiet expiry notice
// only for people who back up to Drive.
const freeze=Object.freeze,noop=()=>{},MINUTE=60*1000;
function fixture({covered='',signedIn=true,expiresInMs=59*MINUTE}={}){
  const clock=createFakeClock('2026-10-06T08:00:00.000Z'),emitted=[],publishedAt=[];
  let current=new clock.Date().toISOString(),authorized=signedIn,expiresAt=clock.now()+expiresInMs,listener=null,publicationHook=noop,durable=null;
  const context={Object,Symbol,TypeError,Error,Date:clock.Date,AbortController,Blob,Promise,Map,Set,TextEncoder,Uint8Array,console,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout};context.globalThis=context;vm.createContext(context);
  for(const name of ['internal','operation-lifecycle','repository-policy','repository-background','backup-provider','backup-recovery-host','notice-coordinator','backup-presentation'])vm.runInContext(fs.readFileSync(`source/core/${name}.js`,'utf8'),context,{filename:`source/core/${name}.js`});
  const registry=context[Symbol.for('studyDirector.internalModules.v1')],lifecycle=registry.require('operation-lifecycle',1),background=registry.require('repository-background',1,freeze({lifecycle})),policy=registry.require('repository-policy',1);
  const coordinator=registry.require('notice-coordinator',1).createCoordinator(freeze({setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout}));
  const notifications=freeze({...coordinator,emit:raw=>{emitted.push(raw);return coordinator.emit(raw);}});
  const presentation=registry.require('backup-presentation',1).createPresentation(freeze({notifications}));
  const pending=registry.require('backup-recovery-host',1).createPendingStore(freeze({sourceRevision:()=>current,diagnostics:freeze({capture:noop}),storage:freeze({read:async()=>durable,write:async value=>{durable=value;},remove:async()=>{durable=null;}})}));
  const unexpected=()=>{throw new Error('Unexpected executor in the automatic backup test');};
  const pipeline=freeze({noteObject:unexpected,readNote:unexpected,createPublication:unexpected,publishInline:unexpected,inspectManifest:unexpected,inspect:unexpected,bringIn:unexpected,restoreVersion:unexpected,verifyCheckpoint:unexpected,verifyObject:unexpected,inspectCommit:unexpected,
    publish:async(_history,options,executor)=>{
      assert.equal(options.interactive,false,'automatic backups never prompt');
      const captured=current;publishedAt.push(clock.now());await publicationHook(options);
      await executor.onCommitted(freeze({sourceRevision:captured,exportedAt:captured}));
      return {checkpointId:'cp_'+'a'.repeat(32),sourceRevision:captured,publication:{name:'cp_'+'a'.repeat(32)},manifest:{objects:[]}};
    },
    scrub:async()=>({status:'completed',complete:true}),cleanup:async()=>({gcPending:false}),retention:freeze({}),validatePolicy:noop,classifyState:()=>({committed:[],uncommitted:[],orphanCommits:[],invalidPairs:[]}),activeProtected:()=>null,selectRetention:()=>({retained:[],remove:[]}),projectHistory:()=>[],markCompleted:({copy})=>{if(copy)covered=copy.sourceRevision;}});
  const runtime=registry.require('backup-provider',1,freeze({repositoryPolicy:policy})).createRuntime(freeze({background:freeze({format:background.format,contractVersion:1,createCoordinator:background.createCoordinator,maintenance:background.maintenance,maintenanceActionable:background.maintenanceActionable}),repository:pipeline,ports:freeze({
    configuration:freeze({appVersion:'qa'}),controller:freeze({beginImport:noop,cancelImport:noop,finishImport:noop}),exports:freeze({run:unexpected}),domain:freeze({clampText:value=>String(value||'')}),view:freeze({presentation}),
    ownership:freeze({canRunBackground:()=>true,requireMutationControl:noop}),environment:freeze({setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout}),diagnostics:freeze({capture:noop,start:()=>'trace',mark:noop,finish:noop,fail:noop})
  })}));
  const connected=()=>authorized&&clock.now()<expiresAt;
  runtime.register(freeze({id:'google-drive',label:'Google Drive',connected,backgroundAvailable:connected,connectionExpiresAt:()=>connected()?expiresAt:0,subscribeConnection:fn=>{listener=fn;},
    repository:freeze({scope:async()=>'repo-scope',list:async()=>({items:[],overflow:false,ignored:0}),upload:unexpected,download:unexpected,delete:unexpected})}));
  runtime.configurePendingBackupRetry(freeze(pending));
  runtime.configureAutomaticBackup(freeze({covered:()=>covered,current:()=>current}));
  return {
    clock,runtime,policy:policy.protocol,publishedAt,onPublication:fn=>{publicationHook=fn;},
    change:(urgent=false)=>{current=new clock.Date(clock.now()).toISOString();runtime.noteChange({urgent});},
    expire:()=>{expiresAt=clock.now();listener?.();},
    signIn:(lifetime=59*MINUTE)=>{authorized=true;expiresAt=clock.now()+lifetime;listener?.();},
    notices:()=>emitted.filter(raw=>raw.source==='google-drive'&&raw.id==='permission'),
    noticeEvent:()=>coordinator.eventStatus().events.find(row=>row.source==='google-drive'&&row.id==='permission')
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
  cases.push('20-minute cadence from the first change');
}
{
  const t=fixture({covered:'2026-10-06T08:00:00.000Z'});await tick(t,1000);t.change();await tick(t,MINUTE);
  const before=t.publishedAt.length;t.change(true);await tick(t,t.policy.automaticUrgentMs+1000);
  assert.equal(t.publishedAt.length,before+1,'a key moment (finishing the day) backs up within seconds');
  cases.push('key moments back up within seconds');
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
console.log(JSON.stringify({status:'PASS',suite:'automatic-provider-backup',productionRuntime:true,cases},null,2));
