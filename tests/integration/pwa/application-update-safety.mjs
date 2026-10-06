import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHarness as repositoryHarness} from '../../helpers/repository-harness.mjs';

// Execute the canonical host functions. Browser rendering is covered separately;
// these fixtures expose save failures, lock lifetime, and background drain races.
const source=fs.readFileSync('source/app.html','utf8');
const preparation=source.slice(source.indexOf('function pwaRecoveryReadBackIssue('),source.indexOf('function schedulePwaUpdateEvaluation('));
const updateScheduler=source.slice(source.indexOf('function schedulePwaUpdateEvaluation('),source.indexOf('async function evaluateAutomaticPwaUpdate('));
const scheduler=source.slice(source.indexOf('function pwaLastUpdateCheckAt('),source.indexOf('const PwaLifecycle=PwaLifecycleModule'));
const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
function deferred(){let resolve;const promise=new Promise(yes=>{resolve=yes;});return {promise,resolve};}
function fixture(){
  const calls=[],listeners=new Map(),elements=[],holds=new Set();
  const state={owner:{state:'primary',revision:1},mutation:{active:'',foreign:false},lifecycle:{ready:true,revision:1},
    startup:true,timer:false,pacer:false,attachment:false,providerBusy:false,dialog:false,diary:true,planFlush:true,reflection:true,
    deletionFlush:true,draft:'edited plan',storedDraft:'edited plan',noteFailure:null,loaded:{value:{revision:7},storage:{idb:true}},
    live:{ok:true,value:{revision:7},storage:{idb:true}},maintenance:Promise.resolve(),device:Promise.resolve({token:'device'}),
    diaryWait:Promise.resolve(),lockCount:0,quiesced:0,updates:0,checkSuccess:true,online:true,now:1000000,
    status:{supported:true,registered:true,updateReady:false},lastCheck:0,timers:new Map()};
  function element(tag){const node={tag,children:[],open:false,removed:false,setAttribute(){},addEventListener(type,fn){this[type]=fn;},append(...nodes){this.children.push(...nodes);},contains(target){return target===this||this.children.some(n=>n.contains(target));},showModal(){this.open=true;},close(){this.open=false;},remove(){this.removed=true;}};elements.push(node);return node;}
  const window={addEventListener(type,fn){const set=listeners.get(type)||new Set();set.add(fn);listeners.set(type,set);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);}};
  const record=async label=>{calls.push(label);};
  const sandbox={console,AbortController,Promise,Date:class extends Date{static now(){return state.now;}},Object,backUpBeforeUpdate:async()=>{calls.push('backup');},
    pwaUpdateReservation:null,pwaWorkRevision:0,pwaUpdateRetryTimer:null,pwaLatestUpdateState:{updateReady:true},pwaLastEditableInputAt:0,PWA_EDIT_IDLE_MS:1800,PWA_UPDATE_SAFETY_RETRY_MS:300000,evaluateAutomaticPwaUpdate:()=>calls.push('automatic-update'),imagePreparationCount:0,attachmentIntegrityRunning:Promise.resolve(),
    OWNERSHIP_STATES:{PRIMARY:'primary',SECONDARY:'secondary'},TIMER_MODES:{RUNNING:'running'},TimerState:{paused:false,mode:'running'},TASKS:[{}],
    document:{body:element('body'),createElement:element,querySelector:()=>state.dialog?{}:null,getElementById:()=>({value:state.draft})},window,
    StartupLifecycle:{status:()=>({fullyInitialized:state.startup})},AppOwnership:{status:()=>({...state.owner})},SessionLifecycle:{status:()=>({...state.lifecycle})},
    AppMutationCoordinator:{status:()=>({...state.mutation}),settled:()=>{throw new Error('A reservation must not wait for its own mutation.');},runExclusive:async(kind,run)=>{
      assert.equal(state.lockCount,0);state.lockCount++;state.mutation.active=kind;calls.push('lock');
      try{return await run({assert(){assert.equal(state.owner.state,'primary');}});}finally{state.mutation.active='';state.lockCount--;calls.push('unlock');}
    }},
    ReviewSaveService:{status:()=>({})},AttachmentLibrary:{status:()=>({busy:state.attachment})},AttachmentIngest:{status:()=>({busy:false})},Exports:{status:()=>({busy:false})},BackupController:{status:()=>({busy:false})},
    BackupProviderRuntime:{status:()=>({busy:state.providerBusy}),suspendBackground:()=>{calls.push('provider-suspend');holds.add('provider');return {settled:Promise.resolve(),release:()=>{holds.delete('provider');calls.push('provider-resume');}};}},
    DeviceBackup:{status:()=>({busy:false}),suspendAutomatic:()=>{holds.add('device');return state.device;},resumeAutomatic:()=>{holds.delete('device');calls.push('device-resume');}},
    AttachmentIntegrityJob:{settled:()=>Promise.resolve()},RichTextAssetMaintenance:{settled:()=>state.maintenance},OwnershipUiProjection:{apply(){calls.push('project');}},
    RichTextRuntime:{quiesce:async run=>{state.quiesced++;try{return await run();}finally{state.quiesced--;}}},
    quiesceManagedRecoveryRuntime:async run=>{state.quiesced++;try{return await run();}finally{state.quiesced--;}},
    PracticePacer:{status:()=>({running:state.pacer})},isLiveTrackableTimer:()=>state.timer,appCanMutate:()=>state.owner.state==='primary',pwaRecentEditableInput:()=>false,
    LibraryView:{settleDiary:async()=>{await state.diaryWait;calls.push('diary');return state.diary;}},
    PlanDraftEditor:{flush:async()=>{calls.push('plan-flush');return state.planFlush;},save:async()=>{calls.push('plan-save');return true;}},PlanData:{readDraft:()=>state.draft,settled:()=>record('plan-settled')},
    flushPendingReviewSave:()=>{calls.push('reflection');return state.reflection;},ReviewEditor:{settled:()=>record('review-settled')},
    writeLiveDraftNow:async options=>{assert.equal(options.allowDuringRecoveryQuiescence,true);calls.push('live');return state.live;},
    AppData:{maintenance:{settled:()=>Promise.resolve()},planData:{read:async()=>({draft:state.storedDraft})},
      notes:{flush:()=>record('notes'),failure:()=>state.noteFailure},deletionRecovery:{flush:async()=>{await record('deletions');return state.deletionFlush;}},
      activeSession:{settled:()=>record('session-settled'),load:async()=>state.loaded},local:{getText:()=>state.lastCheck,setText:(_,value)=>{state.lastCheck=Number(value);return true;}}},
    AppDiagnostics:{capture(){}},PwaLifecycle:{status:()=>state.status,checkForUpdate:async()=>{state.updates++;if(state.checkSuccess)state.status.registered=true;return state.checkSuccess;}},
    navigator:{get onLine(){return state.online;},locks:{request:async(_,__,run)=>run()}},STORAGE_KEYS:{pwaUpdateCheck:'last'},PWA_UPDATE_CHECK_LOCK:'update',
    PWA_UPDATE_CHECK_INTERVAL_MS:86400000,PWA_UPDATE_CHECK_RETRY_BASE_MS:30000,PWA_UPDATE_CHECK_RETRY_MAX_MS:900000,
    pwaLastSuccessfulUpdateCheckMemoryAt:0,pwaUpdateCheckFailureCount:0,pwaUpdateCheckRetryAt:0,pwaUpdateCheckTimer:null,pwaUpdateCheckRunning:false,
    setTimeout:(fn,delay)=>{const id=Symbol();state.timers.set(id,{fn,delay});return id;},clearTimeout:id=>state.timers.delete(id)
  };
  vm.createContext(sandbox);vm.runInContext(preparation+'\n'+updateScheduler+'\n'+scheduler,sandbox);
  const context=(extra={})=>({requestId:'request',automatic:false,external:false,signal:new AbortController().signal,...extra});
  return {state,calls,holds,sandbox,elements,listeners,context,reserve:extra=>{const ctx=context(extra);return {ctx,guard:sandbox.reserveApplicationUpdate(ctx)};}};
}
const cases=[];
async function test(name,run){await run();cases.push(name);}
await test('primary saves every surface and holds mutation and editor locks until release',async()=>{
  const h=fixture(),{guard,ctx}=h.reserve();assert.equal(h.sandbox.pwaUpdateReservation.requestId,ctx.requestId);await guard.ready;
  assert.equal(h.state.lockCount,1);assert.equal(h.state.quiesced,1);assert.equal(guard.validate(),true);
  assert.equal((await h.sandbox.prepareApplicationUpdate(ctx)).ok,true);
  for(const save of ['diary','plan-flush','reflection','live','notes','deletions','session-settled'])assert.ok(h.calls.includes(save),save);
  let prevented=false,stopped=false;for(const block of h.listeners.get('beforeinput'))block({target:{},preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}});
  assert.equal(prevented,true);assert.equal(stopped,true);assert.ok(h.elements.some(e=>e.tag==='dialog'&&e.open));
  assert.equal(h.state.lockCount,1);assert.equal(h.holds.size,2);await guard.release();await guard.release();
  assert.equal(h.state.lockCount,0);assert.equal(h.state.quiesced,0);assert.equal(h.holds.size,0);assert.equal(h.sandbox.pwaUpdateReservation,null);
  assert.ok([...h.listeners.values()].every(set=>set.size===0));assert.ok(h.elements.filter(e=>e.tag==='dialog').every(e=>!e.open&&e.removed));
  assert.equal(h.calls.filter(c=>c==='device-resume').length,1);
});
await test('background drain delays readiness and cancellation releases a late device suspension',async()=>{
  const h=fixture(),maintenance=deferred(),device=deferred(),abort=new AbortController();h.state.maintenance=maintenance.promise;h.state.device=device.promise;
  const {guard}=h.reserve({signal:abort.signal});let ready=false;guard.ready.then(()=>{ready=true;},()=>{});await flush();assert.equal(ready,false);
  abort.abort();await guard.release();assert.equal(h.state.lockCount,0);assert.equal(h.sandbox.pwaUpdateReservation,null);assert.equal(guard.validate(),false);
  device.resolve({token:'late'});maintenance.resolve();await flush();assert.equal(h.holds.size,0);assert.equal(ready,false);assert.equal(h.calls.filter(c=>c==='device-resume').length,1);
});
await test('successful drain is required before save preparation',async()=>{
  const h=fixture(),gate=deferred();h.state.maintenance=gate.promise;const {guard}=h.reserve();let ready=false;guard.ready.then(()=>{ready=true;});await flush();assert.equal(ready,false);gate.resolve();await guard.ready;assert.equal(ready,true);await guard.release();
});
await test('ownership and late work invalidate a prepared reservation',async()=>{
  const h=fixture(),{guard,ctx}=h.reserve();await guard.ready;assert.equal((await h.sandbox.prepareApplicationUpdate(ctx)).ok,true);
  h.sandbox.pwaWorkRevision++;assert.equal(guard.validate(),false);h.sandbox.pwaWorkRevision--;h.state.owner.revision++;assert.equal(guard.validate(),false);await guard.release();
});
await test('read-only follower guards reload without writing primary data',async()=>{
  const h=fixture();h.state.owner.state='secondary';h.state.mutation.foreign=true;const {guard,ctx}=h.reserve({external:true});await guard.ready;
  assert.equal((await h.sandbox.prepareApplicationUpdate(ctx)).ok,true);assert.equal(guard.validate(),true);assert.equal(h.state.lockCount,0);assert.equal(h.state.quiesced,1);
  assert.ok(!h.calls.some(c=>['diary','plan-flush','live','notes','reflection','lock'].includes(c)));await guard.release();
});
await test('failed saves and read-backs refuse preparation for all affected surfaces',async()=>{
  const failures=[['diary',false,/Diary/],['planFlush',false,/Plan draft/],['storedDraft','stale',/read-back/],['reflection',false,/reflection/],
    ['noteFailure',{failed:true,message:'notes failed'},/notes failed/],['deletionFlush',false,/Pending deletions/],['loaded',{value:{revision:6},storage:{idb:true}},/read-back/],
    ['loaded',{value:{revision:7},storage:{idb:false}},/canonical/],['live',{ok:false},/canonical/]];
  for(const [field,value,pattern] of failures){const h=fixture();h.state[field]=value;const {guard,ctx}=h.reserve();await guard.ready;const result=await h.sandbox.prepareApplicationUpdate(ctx);assert.equal(result.ok,false,field);assert.match(result.reason,pattern);await guard.release();assert.equal(h.state.lockCount,0);}
});
await test('real deletion recovery failures refuse reload preparation and remain retryable',async()=>{
 for(const failure of ['transaction','marker-read','marker-retirement']){
  const controls={},repo=repositoryHarness(new Map(),null,controls),h=fixture();
  const day={version:1,date:'2026-09-16',savedAt:'2026-09-17T10:00:00.000Z',updatedAt:'2026-09-17T10:00:00.000Z',reflection:'pending deletion'};
  await repo.app.dailyRecords.save(day);controls.failNextDailyWrite=true;await repo.app.dailyRecords.remove(day.date);
  assert.equal(repo.sharedLocal.has('deletionRecovery'),true);
  if(failure==='transaction')controls.failNextDailyWrite=true;
  if(failure==='marker-read')controls.failLocalGetKeys=new Set(['deletionRecovery']);
  if(failure==='marker-retirement')controls.failLocalRemoveKeys=new Set(['deletionRecovery']);
  h.sandbox.AppData.deletionRecovery.flush=()=>repo.app.deletionRecovery.flush();
  const first=h.reserve();await first.guard.ready;const result=await h.sandbox.prepareApplicationUpdate(first.ctx);
  assert.equal(result.ok,false,failure);assert.match(result.reason,/Pending deletions/);assert.equal(repo.sharedLocal.has('deletionRecovery'),true);
  assert.equal(h.calls.includes('session-settled'),false,'failed recovery must stop subsequent preparation steps');
  await first.guard.release();assert.equal(h.state.lockCount,0);assert.equal(h.holds.size,0);
  controls.failLocalGetKeys=new Set();controls.failLocalRemoveKeys=new Set();
  const retry=h.reserve();await retry.guard.ready;assert.equal((await h.sandbox.prepareApplicationUpdate(retry.ctx)).ok,true,failure+' must recover');
  assert.equal(repo.sharedLocal.has('deletionRecovery'),false);assert.equal(await repo.app.dailyRecords.get(day.date),null);
  await retry.guard.release();assert.equal(h.state.lockCount,0);assert.equal(h.holds.size,0);
 }
});
await test('cancelled preparation does not continue to subsequent saves',async()=>{
  const h=fixture(),gate=deferred(),abort=new AbortController();h.state.diaryWait=gate.promise;const {guard,ctx}=h.reserve({signal:abort.signal});await guard.ready;
  const preparation=h.sandbox.prepareApplicationUpdate(ctx);await flush();abort.abort();await guard.release();gate.resolve();assert.equal((await preparation).ok,false);assert.ok(!h.calls.includes('plan-flush'));
});
await test('active timer, pacer, picker, backup and attachment block automatic transition',async()=>{
  for(const flag of ['timer','pacer','dialog','providerBusy','attachment']){const h=fixture();h.state[flag]=true;assert.throws(()=>h.reserve(),{name:'Error'},flag);assert.equal(h.sandbox.pwaUpdateReservation,null);}
});
await test('missing registration retries despite prior success; failures back off without a success stamp',async()=>{
  const h=fixture();h.state.status.registered=false;h.state.lastCheck=h.state.now-10;h.state.checkSuccess=false;
  assert.equal(await h.sandbox.checkPwaUpdateIfDue(),false);assert.equal(h.state.updates,1);assert.equal(h.state.lastCheck,h.state.now-10);
  assert.equal([...h.state.timers.values()][0].delay,30000);assert.equal(await h.sandbox.checkPwaUpdateIfDue(),false);assert.equal(h.state.updates,1);
  h.state.now+=30000;h.state.checkSuccess=true;assert.equal(await h.sandbox.checkPwaUpdateIfDue(),true);assert.equal(h.state.updates,2);assert.equal(h.state.lastCheck,h.state.now);
  assert.equal([...h.state.timers.values()][0].delay,86400000);assert.equal(await h.sandbox.checkPwaUpdateIfDue(),false);
  assert.equal(await h.sandbox.checkPwaUpdateIfDue({force:true}),true);assert.equal(h.state.updates,3);
});
await test('unsupported, secondary and offline windows do not register through the scheduler',async()=>{
  for(const mode of ['unsupported','secondary','offline']){const h=fixture();if(mode==='unsupported')h.state.status.supported=false;if(mode==='secondary')h.state.owner.state='secondary';if(mode==='offline')h.state.online=false;assert.equal(await h.sandbox.checkPwaUpdateIfDue(),false);assert.equal(h.state.updates,0);if(mode!=='offline'){assert.equal(h.sandbox.schedulePwaUpdateCheck(),false);assert.equal(h.state.timers.size,0);}}
});
await test('retry notice, progress state and Pause & Update use the correct actions',async()=>{
  const h=fixture(),nodes=new Map(['pwa-update-control','pwa-update-apply','pwa-update-message','pwa-update-progress-message'].map(id=>[id,{}])),notices=[];
  Object.assign(h.sandbox,{pwaLatestUpdateState:null,pwaAutomaticBlockMessage:'',pwaUpdateRetryTimer:null,PWA_UPDATE_READY_DELAY_MS:1000,PWA_UPDATE_SAFETY_RETRY_MS:300000,
    NoticeCoordinator:{publish:(_,value)=>notices.push(value)},schedulePwaUpdateEvaluation(){},togglePause(){h.calls.push('pause');h.state.timer=false;}});
  h.sandbox.document.getElementById=id=>nodes.get(id);h.sandbox.PwaLifecycle.apply=async()=>{h.calls.push('apply');return true;};
  vm.runInContext(source.slice(source.indexOf('function pwaUpdateActionLabel('),source.indexOf('function pwaLastUpdateCheckAt(')),h.sandbox);
  h.state.status={supported:true,registered:false,registrationError:'offline',phase:'registration-failed',message:'Retry when online.'};h.sandbox.renderPwaUpdateStatus(h.state.status);
  assert.equal(nodes.get('pwa-update-apply').textContent,'Retry update check');assert.equal(notices.at(-1).actionLabel,'Retry update check');assert.equal(notices.at(-1).title,'Update checks unavailable');
  assert.equal(await h.sandbox.applyPwaUpdateFromUi(),true);assert.equal(h.state.updates,1);
  h.state.status={supported:true,registered:true,updateReady:true};h.state.timer=true;h.state.attachment=true;
  assert.equal(await h.sandbox.applyPwaUpdateFromUi(),false);assert.ok(!h.calls.includes('pause'));
  h.state.attachment=false;assert.equal(await h.sandbox.applyPwaUpdateFromUi(),true);assert.deepEqual(h.calls.filter(c=>['pause','backup','apply'].includes(c)),['pause','backup','apply'],'waiting automatic backups go out before the update applies');
  h.sandbox.renderPwaUpdateStatus({...h.state.status,applying:true,message:'Applying update…',phase:'activating'});
  assert.equal(nodes.get('pwa-update-apply').disabled,true);assert.equal(nodes.get('pwa-update-progress-message').textContent,'Applying update…');
});
await test('secondary window retries an external activation after transient blockers clear',async()=>{
  const h=fixture();h.state.owner.state='secondary';
  Object.assign(h.sandbox,{pwaLatestUpdateState:{updateReady:true,externalUpdate:true},pwaAutomaticBlockMessage:'',pwaUpdateRetryTimer:null,pwaUpdateEvaluationRunning:false,
    PWA_UPDATE_READY_DELAY_MS:650,PWA_UPDATE_SAFETY_RETRY_MS:300000,schedulePwaUpdateEvaluation(){},renderPwaUpdateStatus(){},pwaAppliedPlanEnded:()=>false});
  h.sandbox.PwaLifecycle.apply=async()=>{h.calls.push('external-apply');return true;};
  vm.runInContext(source.slice(source.indexOf('async function evaluateAutomaticPwaUpdate('),source.indexOf('async function applyPwaUpdateFromUi(')),h.sandbox);
  h.state.lifecycle.ready=false;assert.equal(await h.sandbox.evaluateAutomaticPwaUpdate(),false);assert.ok(!h.calls.includes('external-apply'));
  h.state.lifecycle.ready=true;h.state.timer=true;assert.equal(h.sandbox.pwaUpdateActionLabel(),'Update Now');assert.equal(await h.sandbox.evaluateAutomaticPwaUpdate(),true);assert.ok(h.calls.includes('external-apply'));
});
await test('pending boot confirmation has a visible retry action and clears only after proof',async()=>{
 const elements=new Map(['pwa-update-control','pwa-update-apply','pwa-update-message','pwa-update-progress-message'].map(id=>[id,{}])),notices=[],checks=[],evaluations=[];
 const state={supported:true,registered:true,updateReady:false,applying:false,checking:false,bootState:'pending',phase:'boot-pending',message:'Update confirmation is pending.'};
 const context={Object,String,backUpBeforeUpdate:async()=>{},document:{getElementById:id=>elements.get(id)},pwaLatestUpdateState:null,pwaAutomaticBlockMessage:'old automatic block',pwaUpdateCheckRunning:false,pwaUpdateRetryTimer:null,PWA_UPDATE_READY_DELAY_MS:1500,PWA_UPDATE_SAFETY_RETRY_MS:1000,
  NoticeCoordinator:{publish:(_,value)=>notices.push(value)},pwaUpdateActionLabel:()=> 'Update Now',clearTimeout(){},schedulePwaUpdateEvaluation:delay=>evaluations.push(delay),recordPwaUpdateCheckFailure(){},schedulePwaUpdateCheck(){},clearPwaUpdateCheckFailure(){},checkPwaUpdateIfDue:async options=>{checks.push(options);return true;},PwaLifecycle:{status:()=>state}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('async function applyPwaUpdateFromUi('),source.indexOf('function pwaLastUpdateCheckAt(')),context);
 context.renderPwaUpdateStatus(state);assert.equal(notices.at(-1).visible,true);assert.equal(notices.at(-1).title,'Update confirmation pending');assert.equal(elements.get('pwa-update-apply').textContent,'Retry confirmation');assert.equal(elements.get('pwa-update-message').textContent,state.message);assert.equal(evaluations.length,0);
 assert.equal(await context.applyPwaUpdateFromUi(),true);assert.equal(checks.length,1);assert.equal(checks[0].force,true);
 context.renderPwaUpdateStatus({...state,checking:true,phase:'checking'});assert.equal(elements.get('pwa-update-apply').disabled,true);
 context.renderPwaUpdateStatus({...state,bootState:'confirmed',phase:'idle',message:'This window’s version is confirmed.'});assert.equal(notices.at(-1).visible,false);
 context.renderPwaUpdateStatus({...state,bootState:'confirmed',phase:'installation-failed',checkError:'network unavailable',message:'The update check failed.'});assert.equal(notices.at(-1).visible,true);assert.equal(elements.get('pwa-update-apply').textContent,'Retry update check');assert.equal(elements.get('pwa-update-message').textContent,'The update check failed.');
});
await test('editing idle deadline survives focus, completion, and retry scheduling in every order',async()=>{
  for(const elapsed of [0,200,1799,1851])for(const requested of [0,250,1800,5000,300000]){
    const h=fixture(),started=h.state.now;h.sandbox.pwaLastEditableInputAt=started;h.state.now+=elapsed;
    h.sandbox.schedulePwaUpdateEvaluation(1850);h.sandbox.schedulePwaUpdateEvaluation(requested);
    assert.equal(h.state.timers.size,1,'Replacing a wake-up must leave exactly one timer.');
    const timer=[...h.state.timers.values()][0];
    assert.equal(timer.delay,Math.max(requested,1850-elapsed,0),'A wake-up cannot precede the editing idle deadline.');
    assert.deepEqual(h.calls,[]);timer.fn();assert.deepEqual(h.calls,['automatic-update']);
  }
  const h=fixture();h.sandbox.schedulePwaUpdateEvaluation(250);h.sandbox.pwaLatestUpdateState={updateReady:false};
  assert.equal(h.sandbox.schedulePwaUpdateEvaluation(0),false);assert.equal(h.state.timers.size,0);
});
console.log(JSON.stringify({status:'PASS',suite:'application-update-safety',cases},null,2));
