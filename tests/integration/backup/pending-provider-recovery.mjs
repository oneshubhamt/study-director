import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createFakeClock} from '../../helpers/fake-clock.mjs';

for(const file of ['source/core/internal.js','source/core/operation-lifecycle.js','source/core/repository-background.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')],freeze=Object.freeze;
const Background=registry.require('repository-background',1,freeze({lifecycle:registry.require('operation-lifecycle',1)}));
const host=fs.readFileSync('source/core/backup-recovery-host.js','utf8'),provider=fs.readFileSync('source/core/backup-provider.js','utf8');
const marker=()=>({format:'study-director.managed-provider-backup-pending',version:1,entries:[{providerId:'google-drive',requestedAt:'2026-09-01T00:00:00.000Z',sourceRevision:'2026-09-01T00:00:00.000Z'}]});

// Exercise canonical host reads, retry/connection/registration functions and the
// real coordinator. Only provider I/O and presentation ports are stubbed here;
// the existing repository suite checks actual publication and durable storage.
function fixture({durable=marker(),authorized=true,failReads=[]}={}){
  const clock=createFakeClock(),bg=Background.createCoordinator(freeze({target:'google-drive',environment:freeze({AbortController,now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout})}));
  const captures=[],traces=[],readTimes=[];let reads=0,writes=0,clears=0,connectionListener=null,readUnavailable=false;
  const hostContext={Object,String,Array,Number,Set,Date:clock.Date,Promise,freeze,PENDING_FORMAT:'study-director.managed-provider-backup-pending',PROVIDER_ID:/^[a-z][a-z0-9-]{0,40}$/u,
    input:{storage:{read:async()=>{reads++;readTimes.push(clock.now());if(readUnavailable||failReads.includes(reads))throw new Error('Temporary metadata read failure');return durable;},write:async value=>{durable=value;},remove:async()=>{durable=null;}},diagnostics:{capture:(...args)=>captures.push(args)}},pendingWriteChain:Promise.resolve()};
  vm.createContext(hostContext);
  vm.runInContext(host.slice(host.indexOf('  function normalizePending('),host.indexOf('  function userMessage(')),hostContext);
  vm.runInContext(host.slice(host.indexOf('    async function readPending('),host.indexOf('    async function requestDeviceConvergence(')),hostContext);
  const pending=vm.runInContext('pending',hostContext);
  const context={Object,String,Number,Date:clock.Date,Promise,freeze,safeId:value=>String(value||''),busy:false,preparing:false,foregroundController:null,providers:new Map(),
    providerConvergenceRetryAttempts:new Map(),PROVIDER_CONVERGENCE_RETRY_DELAYS:[30000,120000,600000,1800000],PROVIDER_CONVERGENCE_BUSY_RETRY_MS:15000,PROVIDER_MAINTENANCE_BUDGET_MS:30000,
    pendingRetryHooks:null,providerBackground:()=>bg,providerBackgroundAvailability:()=>authorized?true:'authorized-opportunity',
    AppDiagnostics:{capture:(...args)=>captures.push(args)},OperationDiagnostics:{start:()=>{traces.push('start');return 'trace';},mark(){},finish:()=>traces.push('finish'),fail:()=>traces.push('fail')},
    presentation:{condition(){},read:()=>null,resolve(){},begin:()=>({update(){},finish(){}})},renderButtons(){},saveRepositoryProvider:async()=>{writes++;return {checkpointId:'cp_fixture'};},scheduleProviderIntegrityScrub(){},
    statusText(){},setBusy:value=>{context.busy=value;},release:async()=>{},elements:()=>({overlay:null}),close(){},presentProvider(){},userProviderMessage:error=>error.message,freezeProvider:value=>value};
  vm.createContext(context);
  for(const [begin,end] of [
    ['  async function pendingRetryState(','  async function queueResolvedProviderState('],
    ['  function beginForeground(selected,','  function cancelForeground('],
    ['  async function authorize(','  function repositoryProviderItem('],
    ['  async function connectCurrent(','  async function disconnectCurrent('],
    ['  function configurePendingBackupRetry(','  function configureRepositoryMaintenance('],
    ['  function register(config=','  function list()']
  ])vm.runInContext(provider.slice(provider.indexOf(begin),provider.indexOf(end)),context);
  const selected={id:'google-drive',label:'Google Drive',repository:{},authorize:async()=>{authorized=true;},subscribeConnection:callback=>{connectionListener=callback;}};
  context.provider=()=>selected;
  const hooks=freeze({read:pending,clear:async()=>{clears++;durable=null;return true;},mark:async()=>true});
  return {clock,bg,context,selected,pending,hooks,captures,traces,readTimes,
    register:()=>context.register(selected),configure:()=>context.configurePendingBackupRetry(hooks),connect:()=>context.connectCurrent(),
    schedule:delay=>context.schedulePendingProviderBackup(selected,delay),
    authorization:value=>{authorized=value;},notify:()=>connectionListener?.(),fail:value=>{readUnavailable=value;},
    stats:()=>({reads,writes,clears,durable})};
}
async function tick(t,ms){await t.clock.advance(ms);await t.clock.drainMicrotasks(160);}
const cases=[];
for(const failedRead of [1,2]){
  const t=fixture({failReads:[failedRead]});t.register();t.configure();await tick(t,1000);
  assert.equal(t.stats().writes,0);assert.equal(t.stats().clears,0);assert.equal(t.stats().durable.entries.length,1);
  assert.deepEqual([...t.bg.status().scheduled],['convergence'],'unavailable pending state must retain a bounded retry');
  assert.ok(t.traces.includes('fail'),'a pre-publication read failure must have a developer operation outcome');
  await tick(t,30000);assert.equal(t.stats().writes,1);assert.equal(t.stats().clears,1);assert.equal(t.stats().durable,null);
  await tick(t,3600000);assert.equal(t.stats().writes,1);assert.equal(t.clock.pending(),0);
  cases.push('read failure '+failedRead+' resumes once');
}
{
  const t=fixture();t.fail(true);t.register();t.configure();
  for(const delay of [1000,30000,120000,600000,1800000])await tick(t,delay);
  assert.equal(t.stats().reads,5);assert.equal(t.stats().writes,0);assert.equal(t.stats().clears,0);
  assert.deepEqual(t.readTimes.slice(1).map((time,i)=>time-t.readTimes[i]),[30000,120000,600000,1800000]);
  assert.equal(t.clock.pending(),1,'repeated failure must keep one coalesced timer with capped backoff');
  t.fail(false);await tick(t,1800000);assert.equal(t.stats().writes,1);assert.equal(t.stats().clears,1);assert.equal(t.clock.pending(),0);
  cases.push('repeated read failure uses capped backoff');
}
{
  const t=fixture({durable:null});t.register();t.configure();await tick(t,1000);await tick(t,3600000);
  assert.equal(t.stats().reads,1);assert.equal(t.stats().writes,0);assert.equal(t.clock.pending(),0);assert.equal(t.traces.length,0);
  cases.push('confirmed absence stops without publication');
}
{
  const t=fixture();t.register();t.configure();t.authorization(false);await tick(t,1000);await tick(t,3600000);
  assert.equal(t.clock.pending(),0);assert.equal(t.stats().writes,0);assert.ok(t.stats().durable);
  assert.equal(await t.connect(),true);await tick(t,1000);await tick(t,3600000);
  assert.equal(t.stats().writes,1);assert.equal(t.stats().clears,1);assert.equal(t.clock.pending(),0);
  cases.push('canonical reconnect wakes retained intent');
}
for(const registrationOrder of ['before-hooks','after-hooks']){
  const t=fixture({authorized:false});
  if(registrationOrder==='before-hooks'){t.register();t.configure();}else{t.configure();t.register();}
  t.notify();await tick(t,3600000);assert.equal(t.stats().reads,0);assert.equal(t.clock.pending(),0,'unavailable authorization must not poll');
  t.authorization(true);t.notify();t.notify();assert.equal(t.clock.pending(),1,'connection notifications must coalesce');
  await tick(t,1000);assert.equal(t.stats().writes,1);assert.equal(t.stats().clears,1);assert.equal(t.clock.pending(),0);
  cases.push('connection wake '+registrationOrder);
}
for(const registrationOrder of ['before-hooks','after-hooks']){
  const t=fixture();if(registrationOrder==='before-hooks'){t.register();t.configure();}else{t.configure();t.register();}
  await tick(t,1000);assert.equal(t.stats().writes,1);assert.equal(t.stats().durable,null);
  cases.push('persisted intent discovered '+registrationOrder);
}
{
  const t=fixture();t.register();t.configure();t.context.busy=true;await tick(t,1000);assert.equal(t.stats().writes,0);
  t.context.busy=false;await tick(t,15000);assert.equal(t.stats().writes,1);assert.equal(t.stats().clears,1);
  cases.push('foreground contention resumes');
}
{
  const t=fixture();t.register();t.configure();const foreground=t.context.beginForeground(t.selected);await foreground.settled;
  // Repository generation discovery can retire scheduled jobs during foreground
  // work. Shared release must rediscover retained intent after that retirement.
  t.bg.clearAllScheduled();assert.equal(foreground.release(),true);assert.equal(foreground.release(),false);
  await tick(t,1000);assert.equal(t.stats().writes,1);assert.equal(t.stats().clears,1);assert.equal(t.clock.pending(),0);
  cases.push('foreground release rediscovers intent after schedule retirement');
}
{
  const t=fixture();t.register();t.configure();const hold=t.bg.suspend('pwa-update');await hold.settled;
  await tick(t,3600000);assert.equal(t.stats().reads,0);assert.equal(t.stats().writes,0);
  t.notify();assert.equal(t.clock.pending(),0);t.bg.resume(hold);await tick(t,1000);
  assert.equal(t.stats().writes,1);assert.equal(t.stats().clears,1);assert.equal(t.clock.pending(),0);
  cases.push('suspension keeps one pending opportunity');
}
console.log(JSON.stringify({status:'PASS',suite:'pending-provider-recovery',cases},null,2));
