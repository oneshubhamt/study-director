import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createFakeClock} from '../../helpers/fake-clock.mjs';

const freeze=Object.freeze,noop=()=>{};
const marker=()=>({format:'study-director.managed-provider-backup-pending',version:1,entries:[{providerId:'google-drive',requestedAt:'2026-09-01T00:00:00.000Z',sourceRevision:'2026-09-01T00:00:00.000Z'}]});
// Load complete production modules. Publication is a verified executor port;
// the repository-checkpoint suite separately exercises the real binary pipeline.
function fixture({durable=marker(),authorized=true,authorizedFolder=true,both=false,failReads=[]}={}){
  const clock=createFakeClock(),captures=[],traces=[],readTimes=[];let reads=0,writes=0,clears=0,connectionListener=null,readUnavailable=false,control=true,locked=false,maintenance=null,cleanupPasses=0,publicationHook=noop;
  const context={Object,Symbol,TypeError,Error,Date:clock.Date,AbortController,Blob,Promise,Map,Set,TextEncoder,Uint8Array,console,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout};context.globalThis=context;vm.createContext(context);
  for(const name of ['internal','operation-lifecycle','repository-policy','repository-background','backup-provider','backup-recovery-host','notice-coordinator','backup-presentation'])vm.runInContext(fs.readFileSync(`source/core/${name}.js`,'utf8'),context,{filename:`source/core/${name}.js`});
  const registry=context[Symbol.for('studyDirector.internalModules.v1')],lifecycle=registry.require('operation-lifecycle',1),background=registry.require('repository-background',1,freeze({lifecycle}));
  const notifications=registry.require('notice-coordinator',1).createCoordinator(freeze({setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout})),presentation=registry.require('backup-presentation',1).createPresentation(freeze({notifications}));
  const pending=registry.require('backup-recovery-host',1).createPendingStore(freeze({sourceRevision:()=>new clock.Date().toISOString(),diagnostics:freeze({capture:(...args)=>captures.push(args)}),storage:freeze({
    read:async()=>{reads++;readTimes.push(clock.now());if(readUnavailable||failReads.includes(reads))throw new Error('Temporary metadata read failure');return durable;},
    write:async value=>{durable=value;},remove:async()=>{clears++;durable=null;}
  })}));
  const unexpected=()=>{throw new Error('Unexpected executor in pending lifecycle test');};
  const pipeline=freeze({noteObject:unexpected,readNote:unexpected,createPublication:unexpected,publish:async(_history,options)=>{assert.equal(options.interactive,false,'automatic publication must never prompt for keys');writes++;await publicationHook(options);return {checkpointId:'cp_verified',sourceRevision:new clock.Date().toISOString(),publication:{name:'cp_verified'},manifest:{objects:[]}};},publishInline:unexpected,inspectManifest:unexpected,inspect:unexpected,bringIn:unexpected,restoreVersion:unexpected,verifyCheckpoint:unexpected,sharedBase:async()=>null,establishBase:unexpected,verifyObject:unexpected,scrub:async()=>({status:'completed',complete:true}),cleanup:async()=>{cleanupPasses++;return {gcPending:false};},inspectCommit:unexpected,retention:freeze({}),validatePolicy:noop,classifyState:()=>({committed:[],uncommitted:[],orphanCommits:[],invalidPairs:[]}),activeProtected:()=>null,selectRetention:()=>({retained:[],remove:[]}),projectHistory:()=>[],markCompleted:noop});
  const runtime=registry.require('backup-provider',1,freeze({repositoryPolicy:registry.require('repository-policy',1)})).createRuntime(freeze({background:freeze({format:background.format,contractVersion:1,createCoordinator:background.createCoordinator,maintenance:background.maintenance,maintenanceActionable:background.maintenanceActionable}),repository:pipeline,ports:freeze({
    configuration:freeze({appVersion:'qa'}),controller:freeze({beginImport:noop,cancelImport:noop,finishImport:noop}),exports:freeze({followProtection:async()=>false,protect:async file=>{const value=typeof file==='function'?await file():file;return freeze({...value,encrypted:false,protectionId:'',checkProtection:async()=>{}});},unprotect:async blob=>freeze({blob,encrypted:false}),run:unexpected}),domain:freeze({clampText:value=>String(value||'')}),view:freeze({presentation}),ownership:freeze({canShare:()=>true,canRunBackground:()=>!control?'awaiting-control':locked?'locked':true,requireMutationControl:noop}),environment:freeze({setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout}),diagnostics:freeze({capture:(...args)=>captures.push(args),start:()=>{traces.push('start');return 'trace';},mark:noop,finish:()=>traces.push('finish'),fail:()=>traces.push('fail')})
  })}));
  const selected=freeze({id:'google-drive',label:'Google Drive',connected:()=>authorized,backgroundAvailable:()=>authorized,subscribeConnection:fn=>{connectionListener=fn;},repository:freeze({scope:async()=>'repo-scope',list:async()=>({items:[],overflow:false,ignored:0}),upload:unexpected,download:unexpected,delete:unexpected})});
  const folder=freeze({id:'device-folder',label:'Device Folder',connected:()=>authorizedFolder,backgroundAvailable:()=>authorizedFolder,repository:freeze({scope:async()=>'folder-scope',list:async()=>({items:[],overflow:false,ignored:0}),upload:unexpected,download:unexpected,delete:unexpected})});
  return {clock,runtime,pending,captures,traces,readTimes,register:()=>{runtime.register(selected);if(both)runtime.register(folder);},configure:()=>runtime.configurePendingBackupRetry(freeze(pending)),
    authorization:value=>{authorized=value;},folderAuthorization:value=>{authorizedFolder=value;runtime.wakeBackground('folder-permission');},control:value=>{control=value;runtime.wakeBackground('ownership');},lock:value=>{locked=value;runtime.wakeBackground('encryption-unlocked');},notify:()=>connectionListener?.(),fail:value=>{readUnavailable=value;},onPublication:fn=>{publicationHook=fn;},
    maintenance:()=>{maintenance={repositoryScope:'repo-scope',requestedAt:new clock.Date().toISOString(),nextEligibleAt:new clock.Date(clock.now()+1000).toISOString(),reason:'repository-state'};runtime.configureRepositoryMaintenance(freeze({read:async()=>maintenance,mark:async(_id,value)=>{maintenance={...maintenance,...value};return true;},clear:async()=>{maintenance=null;return true;}}));},
    stats:()=>({reads,writes,clears,durable,maintenance,cleanupPasses}),status:()=>runtime.backgroundStatus().find(row=>row.job==='google-drive convergence')};
}
async function tick(t,ms){await t.clock.advance(ms);await t.clock.drainMicrotasks(240);}
const cases=[];
for(const failedRead of [1,2]){
 const t=fixture({failReads:[failedRead]});t.register();t.configure();await tick(t,1000);
 assert.equal(t.stats().writes,0);assert.equal(t.stats().clears,0);assert.ok(t.stats().durable);assert.equal(t.status().pending,true);assert.equal(t.status().scheduled,true);assert.ok(t.traces.includes('fail'));
 await tick(t,30000);assert.equal(t.stats().writes,1);assert.equal(t.stats().clears,1);assert.equal(t.stats().durable,null);await tick(t,3600000);assert.equal(t.stats().writes,1);assert.equal(t.clock.pending(),0);
 cases.push('strict read failure '+failedRead+' preserves intent and recovers once');
}
{
 const t=fixture();t.fail(true);t.register();t.configure();for(const delay of [1000,30000,120000,600000,1800000])await tick(t,delay);
 assert.equal(t.stats().reads,5);assert.equal(t.stats().writes,0);assert.deepEqual(t.readTimes.slice(1).map((time,i)=>time-t.readTimes[i]),[30000,120000,600000,1800000]);assert.equal(t.clock.pending(),1);
 t.fail(false);await tick(t,1800000);assert.equal(t.stats().writes,1);assert.equal(t.stats().durable,null);assert.equal(t.clock.pending(),0);cases.push('repeated failure has one capped-backoff opportunity');
}
{
 const t=fixture({durable:null});t.register();t.configure();await tick(t,3600000);assert.equal(t.stats().reads,1);assert.equal(t.stats().writes,0);assert.equal(t.clock.pending(),0);assert.equal(t.traces.length,0);cases.push('confirmed absence retires without publication');
}
for(const order of ['before-hooks','after-hooks'])for(const blocker of ['authorization','control','lock']){
 const t=fixture({authorized:blocker!=='authorization'});if(blocker==='control')t.control(false);if(blocker==='lock')t.lock(true);
 if(order==='before-hooks'){t.register();t.configure();}else{t.configure();t.register();}
 t.notify();await tick(t,3600000);assert.equal(t.stats().reads,0);assert.equal(t.clock.pending(),0);assert.equal(t.status().pending,true);assert.equal(t.status().state,'paused');
 if(blocker==='authorization'){t.authorization(true);t.notify();t.notify();}else if(blocker==='control')t.control(true);else t.lock(false);
 assert.equal(t.clock.pending(),1);await tick(t,1000);assert.equal(t.stats().writes,1);assert.equal(t.stats().clears,1);assert.equal(t.clock.pending(),0);cases.push(order+' restores '+blocker);
}
{
 const t=fixture({durable:null});t.register();t.configure();t.maintenance();t.authorization(false);t.notify();await tick(t,3600000);
 assert.equal(t.stats().cleanupPasses,0);assert.ok(t.stats().maintenance);assert.equal(t.clock.pending(),0);
 t.authorization(true);t.notify();await tick(t,1000);assert.equal(t.stats().cleanupPasses,1);assert.equal(t.stats().maintenance,null);assert.equal(t.clock.pending(),0);cases.push('reconnection independently wakes cleanup with no backup intent or history action');
}
{
 const t=fixture();t.register();t.configure();const hold=t.runtime.suspendBackground('pwa-update');await hold.settled;await tick(t,3600000);assert.equal(t.stats().reads,0);t.notify();assert.equal(t.clock.pending(),0);assert.equal(hold.release(),true);assert.equal(hold.release(),false);await tick(t,1000);assert.equal(t.stats().writes,1);assert.equal(t.stats().durable,null);cases.push('suspension preserves and reconnects one opportunity');
}
{
 const t=fixture();t.register();t.configure();t.onPublication(async()=>{await t.pending.mark('google-drive');});await tick(t,1000);
 assert.equal(t.stats().writes,1);assert.equal(t.stats().clears,0);assert.ok(t.stats().durable);assert.equal(t.status().pending,true,'older publication cannot clear a newer durable request');t.onPublication(noop);await tick(t,30000);assert.equal(t.stats().writes,2);assert.equal(t.stats().durable,null);cases.push('completion compares the serviced request before clearing durable intent');
}
{
 const t=fixture();t.register();t.configure();let release,started=false;t.onPublication(()=>{started=true;return new Promise(resolve=>{release=resolve;});});
 await tick(t,1000);assert.equal(started,true);const history=t.runtime.history('google-drive',{interactive:false});await t.clock.drainMicrotasks(40);assert.equal(t.runtime.status().busy,true);release();assert.equal((await history).available,true);await t.clock.drainMicrotasks(120);assert.equal(t.runtime.status().busy,false);cases.push('foreground history waits for actual transfer release and remains successful');
}
for(const blocker of ['control','authorization','lock']){
 const t=fixture();t.register();t.configure();let aborted=0;
 t.onPublication(({signal})=>new Promise((_,reject)=>{signal.addEventListener('abort',()=>{aborted++;reject(signal.reason);},{once:true});}));
 await tick(t,1000);assert.equal(t.status().busy,true);
 if(blocker==='control')t.control(false);else if(blocker==='lock')t.lock(true);else{t.authorization(false);t.notify();}
 await t.clock.drainMicrotasks(240);assert.equal(aborted,1);assert.equal(t.status().busy,false);assert.equal(t.status().pending,true);assert.equal(t.status().state,'paused');assert.equal(t.clock.pending(),0);assert.ok(t.stats().durable);
 t.onPublication(noop);if(blocker==='control')t.control(true);else if(blocker==='lock')t.lock(false);else{t.authorization(true);t.notify();}
 await tick(t,15000);assert.equal(t.stats().writes,2);assert.equal(t.stats().durable,null);assert.equal(t.clock.pending(),0);cases.push('active transfer safely reconnects after '+blocker+' loss');
}
// Source and peer locations are independent durability obligations. Rebuilding
// the runtime from the persisted marker must resume only the destination that
// was unavailable before the crash, without replaying the already saved one.
for(const unavailable of ['google-drive','device-folder']){
  const pendingBoth={format:'study-director.managed-provider-backup-pending',version:1,entries:[
    {providerId:'google-drive',requestedAt:'2026-09-01T00:00:00.000Z',sourceRevision:'2026-09-01T00:00:00.000Z'},
    {providerId:'device-folder',requestedAt:'2026-09-01T00:00:00.000Z',sourceRevision:'2026-09-01T00:00:00.000Z'}
  ]};
  const first=fixture({durable:pendingBoth,both:true,authorized:unavailable!=='google-drive',authorizedFolder:unavailable!=='device-folder'});
  first.register();first.configure();await tick(first,1000);
  assert.equal(first.stats().writes,1,'the connected source or peer must publish independently');
  assert.equal(first.stats().durable?.entries.length,1,'only the unavailable location may retain a retry marker');
  assert.equal(first.stats().durable.entries[0].providerId,unavailable);
  // The next fixture loads the old durable app metadata into a new production
  // provider runtime. Old in-memory timers and callbacks are deliberately lost.
  const restarted=fixture({durable:structuredClone(first.stats().durable),both:true});
  restarted.register();restarted.configure();await tick(restarted,1000);
  assert.equal(restarted.stats().writes,1,'the restarted runtime must publish only the outstanding location');
  assert.equal(restarted.stats().durable,null,'the final per-provider marker must be cleared after verified publication');
  await tick(restarted,3600000);
  assert.equal(restarted.stats().writes,1,'a completed location must not publish again after restart');
  assert.equal(restarted.clock.pending(),0,'a fully converged runtime leaves no retry timers');
  cases.push('crash/restart settles outstanding '+unavailable+' without replaying its peer');
}
// Forgetting a location drops the backup it still owed: nothing is uploaded later, and no retry stays scheduled.
{
 const t=fixture();t.register();t.configure();assert.ok(t.stats().durable,'a backup is owed');
 assert.equal(await t.runtime.forget('google-drive'),true);assert.equal(t.stats().durable,null,'the owed backup is dropped');
 await tick(t,3600000);assert.equal(t.stats().writes,0,'nothing is uploaded after Forget');assert.equal(t.clock.pending(),0);cases.push('forget retires the owed backup');
}
console.log(JSON.stringify({status:'PASS',suite:'pending-provider-recovery',productionRuntime:true,cases},null,2));
