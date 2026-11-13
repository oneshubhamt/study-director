import {readHostHtml} from '../../../build/host-source.mjs';
import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=readHostHtml();
const startupOwner=readScript('source/core/startup-host.ts');
const background=readScript('source/core/repository-background.ts');
const device=readScript('source/core/device-backup.ts');
const provider=readScript('source/core/backup-provider.ts');
const assets=readScript('source/core/asset-maintenance.ts');
const repositories=readScript('source/core/repositories.ts');
const metadata=readScript('source/core/host-metadata.ts');
const backup=readScript('source/core/backup.ts');
const backupCapture=readScript('source/core/backup-capture.ts');
const managedRepository=readScript('source/core/managed-repository.ts');
const policy=readScript('source/core/repository-policy.ts');
const mutation=readScript('source/core/mutation-coordinator.ts');
const host=readScript('source/core/backup-recovery-host.ts');
const drive=fs.readFileSync('source/external/drive.js','utf8');

assert.match(app,/nextEligibleAt[\s\S]*reason[\s\S]*repositoryScope[\s\S]*requestId/u,'durable maintenance intent must carry eligibility, reason and repository generation');
assert.match(metadata,/Number\(value\.version\)!==4/u,'the ordinary runtime reads only the current maintenance intent');



// Scheduling policy is shared rather than duplicated in Device and Drive, with suspension settlement and opportunity-driven availability.
assert.match(background,/maintenanceDefersAcrossObservation[\s\S]*preserveDeferred[\s\S]*maintenanceDelay\(pending/u,'repeated inspection must preserve blocked/error deadlines instead of pulling them into a hot loop');
assert.match(background,/function createMaintenanceScheduler[\s\S]*state-read-failed[\s\S]*marker-clear-failed[\s\S]*intent-write-failed/u,'shared maintenance lifecycle must retain retry opportunities when durable marker operations fail');
assert.match(background,/function createIntegrityScheduler[\s\S]*integrityTargetDue[\s\S]*beginBackground\('integrity'[\s\S]*signal:scope\.signal[\s\S]*failureRetryMs/u,'repository integrity recurrence, ownership, cancellation and budget enforcement must be centralized in the shared background module');
assert.match(app,/function currentBackupSourceRevision\(\)\{[\s\S]*stored=AppData\.local\.getJson\(STORAGE_KEYS\.storageHealth,null\),memory=readStorageHealth\(\)[\s\S]*Date\.parse\(revision\)[\s\S]*at>latestAt[\s\S]*return latest;/u,'backup source revision must choose the newest valid fast projection instead of trusting a stale raw localStorage mirror first');
assert.doesNotMatch(app,/return stored&&stored\.lastLocalSaveAt\|\|readStorageHealth\(\)\.lastLocalSaveAt/u,'raw localStorage must never short-circuit a newer in-memory source revision');
assert.match(app,/startupChangeClockReady=reconcileChangeClock\(\)\.catch\(error=>\{startupChangeClockReady=null;throw error;\}\)/u,'failed change-clock reconciliation stays retryable');
assert.match(startupOwner,/markReady:async proof=>\{[\s\S]*await p\.reconcileChangeClock\(\);[\s\S]*p\.installBackground\(\)/u,'startup reconciles durable epoch before automatic background owners');
assert.match(app,/async function reconcileChangeClock\(\)[\s\S]*backup\.change-clock-read',error,'error'\);throw error;\}[\s\S]*function reconcileStartupChangeClock\(\)/u,'a failed authoritative change-clock read must reject startup rather than silently open automatic backup with stale freshness');
assert.match(app,/function ensureDeviceBackupInstalled\(\)[\s\S]*reconcileStartupChangeClock\(\)\.then\(\(\)=>DeviceBackup\.install\(\)[\s\S]*void ensureDeviceBackupInstalled\(\)\.then\(\(\)=>installRepositoryIntegrityScrub\(\)\)/u,'Device Folder startup and reset recovery must reuse the same authoritative change-clock and installation promise');
assert.match(background,/function suspend\(reason='suspended',\{preserveForegroundController=null\}\s*=\{\}\)[\s\S]*foreground\?\.respectBackgroundSuspension===true&&foreground\.controller!==preserveForegroundController[\s\S]*REPOSITORY_BACKGROUND_SUSPENDED[\s\S]*waiting\.push\(foreground\.settlement\)/u,'unrelated provider suspensions must pre-empt and await an automatic foreground handoff, while the same managed sync may retain its own controller');
assert.match(provider,/function suspendBackground\(reason='pwa-update',\{preserveManagedSync=false\}\s*=\{\}\)[\s\S]*reason==='sync'&&foregroundView\(\)\?\.kind==='sync'[\s\S]*preserveForegroundController:selected\.id===retainedProvider\?retained:null/u,'managed sync may preserve only its own foreground controller');
assert.match(provider,/async function backupProvider\(id=''\)[\s\S]*attemptRevision=canonicalConvergenceRevision\(\)[\s\S]*backoff:!behind,attemptRevision,trigger:behind\?'shared-behind':'sync-turn'/u,'foreground shared-turn retry must carry its attempt revision and exact trigger provenance');
assert.match(provider,/function automaticOpportunityUnspent\(selected\s*,eligibleAt\s*=Date\.now\(\)\)[\s\S]*deadline=automaticDueAt\(selected\)[\s\S]*deadline>at\+50/u,'automatic opportunity ownership must be evaluated against scheduler eligibility, not delayed async settlement time');
assert.match(provider,/const attemptRevision=canonicalConvergenceRevision\(\),eligibleMs=Date\.parse\(String\(eligibleAt\|\|''\)\),preserveAutomatic=automaticOpportunityUnspent\(selected,Number\.isFinite\(eligibleMs\)\?eligibleMs:Date\.now\(\)\)[\s\S]*catchUpSharedProvider\(selected,ahead,attemptRevision,\{preserveAutomatic\}\)/u,'a convergence attempt must carry whether it became eligible before the pending automatic deadline into asynchronous catch-up');
assert.match(provider,/function schedulePendingProviderBackup\(selected\s*,delay\s*=1000,\{backoff=false,attemptRevision='',preserveAutomatic=false,trigger='pending-retry'\}\s*=\{\}\)[\s\S]*const newer=backoff&&attemptRevision&&canonicalConvergenceRevision\(\)!==attemptRevision[\s\S]*preserve=automaticNeeded\(selected\)&&\(preserveAutomatic===true\|\|backoff&&automaticOpportunityUnspent\(selected\)\)[\s\S]*if\(newer\|\|preserve\)scheduleAutomaticBackup\(selected,\{urgent:Number\.isFinite\(automaticState\(selected\)\.urgentSince\)\}\)[\s\S]*backoff&&!newer&&!preserve\?'replace':'earliest'/u,'failure backoff must preserve newer canonical work and scheduler-owned unspent automatic opportunities; only spent same-revision work may back off');
assert.doesNotMatch(provider,/schedulePendingProviderBackup\([^\n]*\),'managed-recovery'/u,'generic failure retries must not masquerade as managed recovery');
assert.match(app,/function mutateRepositoryMaintenancePending[\s\S]*BackupAppMeta\.transaction\('readwrite'[\s\S]*handle\.request\.onerror[\s\S]*outcome='superseded'[\s\S]*strict:true/u,'maintenance mutation must compare requests inside a strict transaction and fail closed on unavailable state');
assert.doesNotMatch(device,/MAINTENANCE_(?:CATCHUP|GRACE|BLOCKED|ERROR|CONTENTION)_RETRY_MS/u,'Device must not retain a private maintenance cadence table');
assert.doesNotMatch(provider,/PROVIDER_MAINTENANCE_(?:CATCHUP|GRACE|BLOCKED|ERROR|CONTENTION)_RETRY_MS/u,'Drive must not retain a private maintenance cadence table');
assert.doesNotMatch(device,/createMaintenanceScheduler|createIntegrityScheduler|registerJob|beginBackground|beginForeground|setTimeout\(\(\)=>[^,]*schedule/u,'the Device Folder runs no jobs of its own: maintenance, integrity and automatic backups are the engine\'s per-location jobs');
// The Device Folder's own folder (made, claimed or moved from the old single
// folder) is written only by the writing tab, behind the shared gate and one
// tab at a time.
assert.match(device,/function prepareInBackground\(\)\{[\s\S]{0,400}environment\.backgroundBlocker\(\)[\s\S]{0,120}if\(blocked\)return;/u,'Device Folder preparation in the background waits for the shared gate');
assert.match(device,/function prepareRepository\(\{choose=false\}\s*=\{\}\)\s*\{[\s\S]{0,200}if\(!environment\.canMutate\(\)\)return Promise\.reject[\s\S]{0,240}preparing=environment\.withLock\(/u,'only the writing tab prepares the folder, under a lock');
assert.match(app,/backgroundBlocker:\(\)=>backgroundBlocker\(\),canMutate:\(\)=>appCanMutate\(\)[\s\S]{0,400}withLock:work=>navigator\.locks\?\.request\?navigator\.locks\.request\(ProfileScope\.scoped\('study-director-device-folder-prepare'\)/u,'the app hands the Device Folder the shared gate and a profile-scoped Web Lock');
assert.match(app,/\['device-folder',Object\.freeze\(\{wake:\(\)=>DeviceBackup\.wake\(\)\}\)\],\s*\['backup-locations'/u,'the folder is prepared when the gate opens, before the backup locations wake');
assert.match(provider,/async function historyRepositoryProvider[\s\S]*observeRepositoryMaintenance\(selected,repositoryInventoryObservation\(inventory\)\)/u,'history inspection must create durable maintenance intent when repository debris is observed, for every location');
assert.match(provider,/providerMaintenanceScheduler\(selected\)\?\.adopt\(cleanup,\{trigger:'safety-removal',pending:servicedPending\}/u,'Drive cleanup performed outside the scheduler must return through the shared maintenance state machine');
assert.match(managedRepository,/function rethrowCleanupControl[\s\S]*AbortError[\s\S]*_MAINTENANCE_BUDGET[\s\S]*catch\(error\)\{rethrowCleanupControl\(error\)/u,'shared repository cleanup must propagate cancellation/work-budget control flow instead of misclassifying it as corruption');

// One ownership/pre-emption model; local executors retain only their transport/cadence work.
assert.match(background,/function suspend\(reason='suspended',\{preserveForegroundController=null\}\s*=\{\}\)[\s\S]*waiting=\[\][\s\S]*row\.settlement[\s\S]*const settled=waitForSettlement\(waiting\)/u,'shared suspension must expose a settlement barrier rather than merely signal abort');
assert.match(provider,/if\(busy\|\|sync\?\.catching\)\{schedulePendingProviderBackup\(selected,PROVIDER_CONVERGENCE_BUSY_RETRY_MS,\{trigger:'provider-busy'\}\)/u,'automatic backups never start while a foreground operation owns the engine and retain their deferral provenance');
assert.match(provider,/async function createProtectedSafety\(id\s*,purpose='before-clear-library',options\s*=\{\}\)[\s\S]*beginForeground\(selected[\s\S]*await foreground\.settled[\s\S]*saveRepositoryProvider/u,'Before Clear Library safety must reserve foreground ownership and settle background work before repository work');
assert.match(provider,/background\.createIntegrityScheduler[\s\S]*budgetCode:'REPOSITORY_INTEGRITY_BUDGET'[\s\S]*execute:async\(\{target,trigger,nextEligibleAt,signal,checkpoint\}\)/u,'Drive integrity work must use the per-target shared recurrence and receive the shared cancellation signal');
assert.doesNotMatch(app,/INTEGRITY_TARGETS/u,'no fixed device/drive slots remain in the integrity record');
assert.match(app,/function backgroundBlocker\(\{housekeeping=true\}=\{\}\)\{\s*if\(!appCanMutate\(\)\)return 'awaiting-control';\s*if\(!StartupLifecycle\.status\(\)\.fullyInitialized\)return 'startup';[\s\S]*?housekeeping&&storageResetUnresolved\(\)\?'storage-reset'/u,'every background job shares one gate: write ownership (asked first, so a job configured during page load never reads start-up state early), start-up, and for housekeeping an unresolved browser-data clear');
assert.equal((app.match(/isAvailable:\(\)=>backgroundBlocker\(/gu)||[]).length,1,'repository integrity uses the shared gate directly');
assert.equal((app.match(/isAvailable:\(\)=>upkeepBlocker\(/gu)||[]).length,4,'canonical maintenance, attachment cleanup and verification, and scratch files use the upkeep gate');
assert.match(app,/NoticeCoordinator\.subscribe\(\(\)=>\{foregroundChanged\(\);\}\)/u,'notice changes check the watcher at once');
assert.match(backup,/function beginImport\(\{backgroundPreemptible=false\}=\{\}\)[\s\S]*backgroundPreemptible:backgroundPreemptible===true[\s\S]*importHoldsBackground:!!activeImportOperation&&!activeImportOperation\.backgroundPreemptible/u,'standalone/manual imports hold all providers while an admitted automatic sync does not cancel itself via the file observer');
assert.doesNotMatch(app,/schedule\w*\((?:15000|ATTACHMENT_INTEGRITY_RETRY_MS),'foreground-busy'\)/u,'no upkeep job polls for the foreground on its own');
assert.match(app,/function backupBackgroundAvailability\(\)\{return backgroundBlocker\(\)\|\|/u,'automatic backups and their upkeep use the shared gate');
assert.doesNotMatch(app,/isAvailable:\(\)=>(?:!StartupLifecycle|appCanMutate\(\))/u,'no background job keeps its own start-up or ownership check');
assert.match(app,/function settleStorageReset\(\)\{[\s\S]*?wakeBackgroundOperations\('storage-reset-settled'\)/u,'housekeeping paused by a clear resumes as soon as the clear is settled');
assert.match(provider,/isAvailable:\s*\(\s*\)\s*=>\s*\{const local\s*=integrityScrubHooks\s*\.isAvailable\s*\(id\s*\);return local\s*=\s*=\s*=true\?providerBackgroundAvailability\s*\(selected\s*\):String\s*\(local\|\|'awaiting-control'\s*\);\}/u,'provider integrity must preserve named event-driven unavailability instead of collapsing it to polling false');
assert.doesNotMatch(app,/REPOSITORY_INTEGRITY_POLICY|repositoryIntegrityTargetDue|scheduleRepositoryIntegrityScrub|runDeviceRepositoryIntegrityScrub/u,'retired host integrity wrappers must be removed after coordinator consolidation');
assert.match(backup,/const RepositoryBackgroundProviderPort\s*=freeze\s*\(\s*\{[\s\S]*format:RepositoryBackgroundModule\s*\.format[\s\S]*createCoordinator:RepositoryBackgroundModule\s*\.createCoordinator[\s\S]*maintenanceActionable:RepositoryBackgroundModule\s*\.maintenanceActionable[\s\S]*background:RepositoryBackgroundProviderPort/u,'Backup Provider must receive a narrow repository-background port instead of the whole internal module surface');

assert.match(app,/backgroundMaintenanceStatusBusy\(owner,field='busy'\)[\s\S]*catch\(error\)[\s\S]*return true/u,'foreground-status probe failures must conservatively block unrelated local background maintenance');
assert.match(app,/backgroundMaintenanceForegroundBusy\(\)[\s\S]*AppMutationCoordinator,'active'[\s\S]*BackupController[\s\S]*BackupProviderRuntime/u,'local background work must yield to foreground backup/recovery');
assert.match(app,/BackupOperationDiagnostics\.start\('data-maintenance'/u);
assert.match(app,/DATA_MAINTENANCE_SCHEDULE_INTERVAL_MS=AppData\.maintenance\.intervalMs,DATA_MAINTENANCE_FAILURE_RETRY_MS=30\*60\*1000/u,'canonical data maintenance takes its interval from the repository that records it, with a bounded failure retry');
assert.match(app,/status==='completed'\)\{[\s\S]{0,200}AppData\.notes\.purgeExpiredTrash\(\);[\s\S]{0,120}scheduleRichTextAssetMaintenance\(ATTACHMENT_CLEANUP_AFTER_UPKEEP_MS\);/u,'daily upkeep empties expired Recently deleted notes, then sweeps unused attachments');
assert.match(app,/status==='completed'[\s\S]*scheduleDataMaintenance\(DATA_MAINTENANCE_SCHEDULE_INTERVAL_MS,'interval'\)[\s\S]*reason==='recent'[\s\S]*lastRun\+DATA_MAINTENANCE_SCHEDULE_INTERVAL_MS[\s\S]*status==='failed'\|\|reason==='indexeddb-unavailable'[\s\S]*DATA_MAINTENANCE_FAILURE_RETRY_MS/u,'canonical data maintenance must remain live across long-running sessions and transient failures');
assert.match(app,/BackupOperationDiagnostics\.start\('attachment-integrity'/u);
assert.match(provider,/OperationDiagnostics\s*\.start\s*\('provider-integrity'[\s\S]*nextEligibleAt/u);
assert.match(provider,/OperationDiagnostics\s*\.start\s*\('provider-convergence'/u);
assert.match(app,/configuration:Object\.freeze\(\{release:APP_VERSION,limit:20\}\)/u,'diagnostic history must be large enough to inspect a background/foreground cycle');
assert.match(repositories,/async function rebaseBackupPreparationState\(\)[\s\S]*Meta\.transaction\s*\('readwrite'[\s\S]*canonicalMutationEpoch[\s\S]*backupPreparationUnitPrefix/u,'authoritative rebase must atomically reset durable acceleration metadata');
assert.match(backup,/if\s*\(changed\s*\)await rebaseRepositoryPreparationAcceleration\s*\('combine'\s*\)/u);
assert.match(backup,/await rebaseRepositoryPreparationAcceleration\s*\('replace'\s*\)/u);

// Persistence hardening and shared repository protocol policy.
assert.match(app,/limits:Object\.freeze\(\{publicationMaxAgeMs:RepositoryPolicyModule\.protocol\.publicationMaxAgeMs[\s\S]*maintenanceMaxAgeMs:RepositoryPolicyModule\.protocol\.maintenanceMaxAgeMs/u,'Device Folder storage must use the shared repository protocol policy for its locks');
assert.match(provider,/RepositoryPolicy\s*=input\s*\.repositoryPolicy[\s\S]*RepositoryPolicy\s*\.protocol/u,'Drive repository transport must consume shared repository protocol policy');
assert.match(mutation,/async function refreshAuthority[\s\S]*durableAcquire[\s\S]*writeLease\(kind,id\)[\s\S]*loseAuthority\(error,\{durableProtected:true\}\)/u,'local mirror renewal failure must retain the stronger durable lease while failing forward mutation closed');
assert.match(mutation,/function assertAuthority\s*\(options\s*=\{\}\)[\s\S]*allowDurableProtected[\s\S]*throw active\.authorityError/u,'destructive callers must have an explicit authority assertion with rollback-only durable protection');
assert.match(backup,/requireCanonicalComplete:true/u,'managed repository publication must require a complete canonical capture');
const pendingReader=host.slice(host.indexOf('async function readPending('),host.indexOf('function mutatePending('));
assert.doesNotMatch(pendingReader,/normalizePending\(null\)/u,'unavailable provider pending state must not be normalized into absence');

// Coordination boundaries, rather than historical timer/flag spellings. The
// unit and assembled integration suites establish the behavioral invariants.
const lifecycle=readScript('source/core/operation-lifecycle.ts');
assert.match(lifecycle,/function createJob[\s\S]*function reconcile[\s\S]*function wake[\s\S]*function complete/u);
assert.match(background,/Lifecycle\.createJob/u);
assert.match(provider,/background\.registerJob\('convergence'/u);
assert.match(app,/OperationLifecycle\.createGroup/u);assert.match(startupOwner,/ports\.wakeBackground\('ownership'\)/u);assert.match(app,/wakeBackgroundOperations\('encryption-unlocked'\)/u);
assert.match(provider,/budgetMs:background\.integrity\.workBudgetMs/u,'integrity policy must come from the bound coordinator');
assert.doesNotMatch(provider,/Background\.integrity|PROVIDER_CONVERGENCE_BUDGET|backgroundAfter|convergenceAfter|resumePendingProviderBackup/u,'retired handoffs and transfer deadlines must be absent');
assert.doesNotMatch(app,/dataMaintenanceTimer|attachmentIntegrityTimer|attachmentIntegrityRunning|attachmentIntegrityAwaitingControl|attachmentMaintenanceDailyTimer/u,'host timers must not duplicate lifecycle ownership');
assert.doesNotMatch(device,/scheduledUrgent|scheduledRetry|automaticRetryPaused/u,'automatic deadlines and blockers belong to the shared lifecycle');
// P5: exercise the exact production admission and ownership-wake functions
// under deterministic provider, lock, visibility and wall-clock conditions.
function productionFunction(signature){
 const start=app.indexOf(signature),end=start>=0?app.indexOf('\n}',start):-1;
 assert.ok(start>=0&&end>start,'missing production function '+signature);
 return app.slice(start,end+2);
}
const updateRuntime=productionFunction('function pwaProviderNetworkBusy(){')+'\n'+productionFunction('async function checkPwaUpdateIfDue({force=false}={}){');
function updateHarness({busy=false,backingUp=false,lockRace=false,offline=false}={}){
 const activity={busy,backingUp},calls={update:0,mark:0,fail:0,retry:[],lock:0};
 const context=vm.createContext({
  navigator:{onLine:!offline,locks:{request:async(_,__,perform)=>{calls.lock++;if(lockRace)activity.backingUp=true;return perform();}}},
  AppOwnership:{status:()=>({state:'primary'})},OWNERSHIP_STATES:{PRIMARY:'primary'},
  BackupProviderRuntime:{status:()=>({busy:activity.busy}),locationStatus:()=>({backingUp:activity.backingUp})},
  PwaLifecycle:{status:()=>({supported:true,registered:true,checkError:false}),checkForUpdate:async()=>{calls.update++;return true;}},
  pwaUpdateCheckDue:()=>true,markPwaUpdateCheck:()=>{calls.mark++;},clearPwaUpdateCheckFailure:()=>{},
  recordPwaUpdateCheckFailure:()=>{calls.fail++;},schedulePwaUpdateCheck:delay=>{calls.retry.push(delay);},
  AppDiagnostics:{capture:()=>{}},PWA_UPDATE_CHECK_LOCK:'qa-update-check',
  pwaUpdateCheckRetryAt:0,Date
 });
 vm.runInContext('let pwaUpdateCheckRunning=false;\n'+updateRuntime+'\nglobalThis.p5Check=checkPwaUpdateIfDue;',context);
 return {activity,calls,check:force=>context.p5Check({force})};
}
for(const mode of [{busy:true},{backingUp:true},{lockRace:true}]){
 const t=updateHarness(mode);
 assert.equal(await t.check(false),false);
 assert.equal(t.calls.update,0,'automatic discovery never competes with an observed provider transfer');
 assert.equal(t.calls.fail,0,'provider deferral must not count as update failure');
 assert.equal(t.calls.retry.at(-1),30000,'provider deferral retains a bounded retry on the existing timer');
 if(mode.lockRace)assert.equal(t.calls.lock,1,'busy state must be checked again after waiting on the Web Lock');
 else assert.equal(t.calls.lock,0,'busy provider does not acquire a network update lock');
 assert.equal(t.activity.backingUp===true||t.activity.busy===true,true);
}
{
 const t=updateHarness({busy:true,backingUp:true});
 assert.equal(await t.check(true),true,'manual user-triggered check must remain available');
 assert.equal(t.calls.update,1);assert.equal(t.calls.mark,1);assert.equal(t.calls.fail,0);
}
{
 const t=updateHarness();assert.equal(await t.check(false),true);
 assert.equal(t.calls.update,1);assert.equal(t.calls.mark,1);assert.equal(t.calls.lock,1);
}
{
 const t=updateHarness({offline:true});assert.equal(await t.check(false),false);
 assert.equal(t.calls.update,0);assert.equal(t.calls.lock,0);
}
const claimRuntime=productionFunction('async function checkSessionOwnershipClaim(){')+'\n'
 +productionFunction('function wakeSessionOwnershipClaim(slackMs=0){');
for(const path of ['source/core/internal.ts','source/core/execution-views.ts'])vm.runInThisContext(readScript(path),{filename:path});
const executionViews=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('execution-views',1);
function claimHarness(){
 const handlers=new Map(),intervals=[],wakes=[],checks=[];
 let visible=true,syncing=false;
 const document={get visibilityState(){return visible?'visible':'hidden';},addEventListener:(kind,fn)=>handlers.set('document:'+kind,fn)};
 const window={addEventListener:(kind,fn)=>handlers.set('window:'+kind,fn)};
 const context=vm.createContext({
  document,window,TASKS:[{}],sessionPanelMode:'active',
  StartupLifecycle:{status:()=>({fullyInitialized:true})},
  SessionHandoffRuntime:{
   checkClaim:async()=>{checks.push('check');return true;},
   wakeClaim:slack=>{wakes.push(Number(slack)||0);return Promise.resolve(true);}
  },
  BackupProviderRuntime:{syncing:()=>syncing,wakeBackground:reason=>wakes.push(reason)},
  AppDiagnostics:{capture:()=>{}},SESSION_CLAIM_WATCH_MS:15000,SESSION_WATCH_MS:120000,
  setInterval:(fn,ms)=>{intervals.push({fn,ms});return intervals.length;}
 });
 vm.runInContext(claimRuntime+'\nglobalThis.p5Wake=wakeSessionOwnershipClaim;globalThis.p5Check=checkSessionOwnershipClaim;',context);
 const views=executionViews.createController({...context,state:{sessionPanelMode:'active'},runtime:{TASKS:[{}],TimerEngine:{}},actions:{},cache:{},wakeSessionOwnershipClaim:context.p5Wake});
 context.p5Start=views.installSessionWatch;
 const settle=async()=>{for(let k=0;k<4;k++)await Promise.resolve();};
 return {
  start:()=>context.p5Start(),wake:()=>context.p5Wake(),check:()=>context.p5Check(),intervals,wakes,checks,
  setVisible:value=>{visible=value;},setSyncing:value=>{syncing=value;},
  event:async name=>{handlers.get(name)?.();await settle();},
  poll:async ms=>{intervals.find(x=>x.ms===ms)?.fn();await settle();}
 };
}
{
 const t=claimHarness();assert.equal(t.start(),true);assert.equal(t.start(),false,'one existing owner of intervals and wake handlers');
 assert.equal(t.intervals.length,2);
 await t.check();assert.deepEqual(t.checks,['check'],'explicit claim checks delegate to the checked handoff runtime');
 await t.poll(15000);assert.deepEqual(t.wakes,[1000],'the 15 s host interval delegates cadence/slack policy to P5.4C');
 await t.event('window:online');assert.deepEqual(t.wakes,[1000,0],'online events request one immediate P5.4C wake');
 t.setVisible(false);await t.event('document:visibilitychange');assert.deepEqual(t.wakes,[1000,0],'hidden transitions do not wake the claim controller');
 t.setVisible(true);await t.event('document:visibilitychange');assert.deepEqual(t.wakes,[1000,0,0],'foreground return delegates one wake');
 await t.poll(120000);assert.deepEqual(t.wakes,[1000,0,0],'ordinary session watch does not wake a provider that is idle');
 t.setSyncing(true);await t.poll(120000);assert.deepEqual(t.wakes,[1000,0,0,'session-watch'],'the coarse watch only wakes an already-syncing provider');
}
// BS11/17 retain safety-critical boundaries: read-only planning precedes the
// destructive lease, and startup orphan collection is not replaced by a wake.
assert.match(startupOwner,/p\.installBackground\(\);p\.scheduleMaintenance\(\);p\.wakeBackground\('startup'\);p\.installSessionWatch\(\)/u);
assert.match(startupOwner,/void p\.collectFiles\(\)\.catch/u,'cold startup must discover orphan scratch bytes even without a pending job');
// An app killed while a sync applied changes leaves an interrupted-step
// journal and its write lease (at most 20 s). Reopened at once, start-up
// recovery waits for that closed page's lease to end instead of locking the
// app until a reload; a live owner elsewhere, or a lease that never ends,
// still leaves recovery to its fail-closed path.
{
 const run=async({owner=true,foreignPolls=0}={})=>{
  let polls=0,waits=0;
  const context=vm.createContext({AppOwnership:{canMutate:()=>owner},AppMutationCoordinator:{foreignActive:()=>polls++<foreignPolls},setTimeout:(fn)=>{waits++;fn();return waits;},Promise});
  vm.runInContext(productionFunction('async function waitForClosedTabLease(limitMs=25000){')+'\nglobalThis.wait=waitForClosedTabLease;',context);
  const ended=await context.wait();return {ended,waits};
 };
 assert.deepEqual(await run({foreignPolls:3}),{ended:true,waits:3},'a closed page\'s lease: start-up waits until it ends, then recovers');
 assert.deepEqual(await run({foreignPolls:0}),{ended:true,waits:0},'no lease: no wait');
 const stuck=await run({foreignPolls:1000});assert.equal(stuck.ended,false,'a lease that never ends is not waited for forever');assert.equal(stuck.waits,100,'at most 25 s');
 assert.equal((await run({owner:false,foreignPolls:3})).waits,0,'without control this tab does not wait: recovery reports it');
 assert.match(startupOwner,/recoverInterruptedRestore:async\(\)=>\{await p\.hydratePlan\(\);if\(await p\.readRestoreJournal\(\)\.catch\(\(\)=>null\)\)await p\.waitForClosedTabLease\(\);/u,'interrupted restore waits for its closed-tab lease');
}
// Background sync waits while offline; coming back online wakes it at once.
assert.match(app,/window\.addEventListener\('online',\(\)=>\{try\{BackupProviderRuntime\.wakeBackground\('online'\);/u,'back online, background sync goes at once rather than at its next retry');

console.log(JSON.stringify({status:'PASS',suite:'background-work-contract',sharedStateMachine:true,maintenanceEligibility:true,maintenanceClassification:true,blockedBackoff:true,foregroundPreemption:true,suspensionSettlement:true,opportunityDrivenIntegrity:true,leanProviderPort:true,clearLibrarySafetyForeground:true,backgroundDiagnostics:true,authoritativeRebase:true,persistenceHardening:true,sharedRepositoryPolicy:true},null,2));
