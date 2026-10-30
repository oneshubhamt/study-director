import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync('source/app.html','utf8');
const background=fs.readFileSync('source/core/repository-background.js','utf8');
const device=fs.readFileSync('source/core/device-backup.js','utf8');
const provider=fs.readFileSync('source/core/backup-provider.js','utf8');
const assets=fs.readFileSync('source/core/asset-maintenance.js','utf8');
const repositories=fs.readFileSync('source/core/repositories.js','utf8');
const metadata=fs.readFileSync('source/core/host-metadata.js','utf8');
const backup=fs.readFileSync('source/core/backup.js','utf8');
const backupCapture=fs.readFileSync('source/core/backup-capture.js','utf8');
const managedRepository=fs.readFileSync('source/core/managed-repository.js','utf8');
const policy=fs.readFileSync('source/core/repository-policy.js','utf8');
const mutation=fs.readFileSync('source/core/mutation-coordinator.js','utf8');
const host=fs.readFileSync('source/core/backup-recovery-host.js','utf8');
const drive=fs.readFileSync('source/external/drive.js','utf8');

assert.match(app,/REPOSITORY_MAINTENANCE_VERSION=4/u);
assert.match(app,/nextEligibleAt[\s\S]*reason[\s\S]*repositoryScope[\s\S]*requestId/u,'durable maintenance intent must carry eligibility, reason and repository generation');
assert.match(metadata,/Number\(value\.version\)!==4/u,'the ordinary runtime reads only the current maintenance intent');
assert.match(fs.readFileSync('source/core/compatibility-host.js','utf8'),/MAINTENANCE_VERSION=4/u,'older maintenance intents are converted once by the compatibility host');

assert.match(background,/input\.intent\.clear\(pending\)/u,'maintenance completion must carry its serviced request');
assert.match(background,/generation!==requestGeneration/u,'requests arriving after a commit must retain their scheduling opportunity');
assert.match(repositories,/NotesRepository\.flush\(\{strict:true\}\)/u,'daily completion requires strict note durability');
assert.match(repositories,/flushDeletionRecovery\([^)]*\)!==true/u,'daily completion must reject incomplete deletion recovery');

// Scheduling policy is shared rather than duplicated in Device and Drive, with suspension settlement and opportunity-driven availability.
assert.match(background,/const MAINTENANCE=freeze\(\{[\s\S]*continuationMs:5000[\s\S]*contentionMs:15\*60\*1000[\s\S]*errorMs:5\*60\*1000[\s\S]*blockedMs:15\*60\*1000[\s\S]*graceMs:6\*60\*60\*1000/u,'maintenance cadence must be defined once in the repository-background policy');
assert.match(background,/function maintenancePlan\(cleanup\)[\s\S]*bounded-continuation[\s\S]*contentionRetryMs[\s\S]*publication-contention[\s\S]*delete-failure[\s\S]*blocked-uncertain[\s\S]*gc-grace/u,'shared maintenance policy must distinguish actionable, expiry-aware contention, failures, uncertainty and grace-deferred work');
assert.match(background,/maintenanceDefersAcrossObservation[\s\S]*preserveDeferred[\s\S]*maintenanceDelay\(pending/u,'repeated inspection must preserve blocked/error deadlines instead of pulling them into a hot loop');
assert.match(background,/function createMaintenanceScheduler[\s\S]*state-read-failed[\s\S]*marker-clear-failed[\s\S]*intent-write-failed/u,'shared maintenance lifecycle must retain retry opportunities when durable marker operations fail');
assert.match(background,/function createIntegrityScheduler[\s\S]*integrityTargetDue[\s\S]*beginBackground\('integrity'[\s\S]*signal:scope\.signal[\s\S]*failureRetryMs/u,'repository integrity recurrence, ownership, cancellation and budget enforcement must be centralized in the shared background module');
assert.match(background,/function createIntegrityScheduler[\s\S]*function schedule\(delay,reason='scheduled'\)\{return job\.schedule\([^\n]*'earliest'\)/u,'new integrity rechecks must retain their earlier deadline during a running scan');
assert.match(app,/function currentBackupSourceRevision\(\)\{[\s\S]*stored=AppData\.local\.getJson\(STORAGE_KEYS\.storageHealth,null\),memory=readStorageHealth\(\)[\s\S]*Date\.parse\(revision\)[\s\S]*at>latestAt[\s\S]*return latest;/u,'backup source revision must choose the newest valid fast projection instead of trusting a stale raw localStorage mirror first');
assert.doesNotMatch(app,/return stored&&stored\.lastLocalSaveAt\|\|readStorageHealth\(\)\.lastLocalSaveAt/u,'raw localStorage must never short-circuit a newer in-memory source revision');
assert.match(app,/let startupChangeClockReady=null;[\s\S]*function reconcileStartupChangeClock\(\)[\s\S]*startupChangeClockReady=reconcileChangeClock\(\)\.catch\(error=>\{startupChangeClockReady=null;throw error;\}\)[\s\S]*markReady:async proof=>\{[\s\S]*await reconcileStartupChangeClock\(\);[\s\S]*installBackgroundOwners\(\)/u,'startup must reconcile the durable mutation epoch before automatic background owners can activate');
assert.match(app,/async function reconcileChangeClock\(\)[\s\S]*backup\.change-clock-read',error,'error'\);throw error;\}[\s\S]*function reconcileStartupChangeClock\(\)/u,'a failed authoritative change-clock read must reject startup rather than silently open automatic backup with stale freshness');
assert.match(app,/void reconcileStartupChangeClock\(\)\.then\(\(\)=>DeviceBackup\.install\(\)\)/u,'Device Folder installation must share the same startup change-clock prerequisite');
assert.match(background,/function beginForeground\(\{[\s\S]*respectBackgroundSuspension=false[\s\S]*suspensionAware&&suspensions\.size[\s\S]*respectBackgroundSuspension:suspensionAware/u,'repository foreground admission must expose a narrow suspension-aware mode without changing explicit foreground semantics');
assert.match(background,/function suspend\(reason='suspended',\{preserveForegroundController=null\}=\{\}\)[\s\S]*foreground\?\.respectBackgroundSuspension===true&&foreground\.controller!==preserveForegroundController[\s\S]*REPOSITORY_BACKGROUND_SUSPENDED[\s\S]*waiting\.push\(foreground\.settlement\)/u,'unrelated provider suspensions must pre-empt and await an automatic foreground handoff, while the same managed sync may retain its own controller');
assert.match(provider,/function suspendBackground\(reason='pwa-update',\{preserveManagedSync=false\}=\{\}\)[\s\S]*reason==='sync'&&foregroundView\(\)\?\.kind==='sync'[\s\S]*preserveForegroundController:selected\.id===retainedProvider\?retained:null/u,'managed sync may preserve only its own foreground controller');
assert.match(provider,/function catchUpSharedProvider\(selected,head,attemptRevision=canonicalConvergenceRevision\(\)\)[\s\S]*syncRepositoryProvider\(selected\.id,\{checkpointId:head\.item\.id,presentation:summary,respectBackgroundSuspension:true\}\)[\s\S]*backoff:true,attemptRevision,trigger:'catch-up-failed'/u,'automatic Drive catch-up must be suspension-aware and retain the canonical revision that owns a failure backoff');
assert.match(provider,/async function backupProvider\(id=''\)[\s\S]*attemptRevision=canonicalConvergenceRevision\(\)[\s\S]*backoff:!behind,attemptRevision,trigger:behind\?'shared-behind':'sync-turn'/u,'foreground shared-turn retry must carry its attempt revision and exact trigger provenance');
assert.match(provider,/function canonicalConvergenceRevision\(\)[\s\S]*automaticHooks\?\.current\?\.\(\)/u,'convergence must identify a canonical revision, without introducing a competing scheduler');
assert.match(provider,/function schedulePendingProviderBackup\(selected,delay=1000,\{backoff=false,attemptRevision='',trigger='pending-retry'\}=\{\}\)[\s\S]*const newer=backoff&&attemptRevision&&canonicalConvergenceRevision\(\)!==attemptRevision,automaticDeadline=automaticDueAt\(selected\)[\s\S]*unspentAutomatic=backoff&&automaticNeeded\(selected\)&&Number\.isFinite\(automaticDeadline\)&&automaticDeadline>Date\.now\(\)\+50[\s\S]*if\(newer\|\|unspentAutomatic\)scheduleAutomaticBackup\(selected,\{urgent:Number\.isFinite\(automaticState\(selected\)\.urgentSince\)\}\)[\s\S]*backoff&&!newer&&!unspentAutomatic\?'replace':'earliest'/u,'failure backoff must preserve a newer revision and any not-yet-due automatic opportunity; only spent same-revision work may move onto failure backoff');
assert.doesNotMatch(provider,/schedulePendingProviderBackup\([^\n]*\),'managed-recovery'/u,'generic failure retries must not masquerade as managed recovery');
assert.match(app,/readRepositoryMaintenancePending\(\{throwOnError=false\}=[\s\S]*if\(throwOnError\)throw error/u,'durable maintenance state reads must be able to fail closed instead of silently becoming empty state');
assert.match(app,/function mutateRepositoryMaintenancePending[\s\S]*BackupAppMeta\.transaction\('readwrite'[\s\S]*handle\.request\.onerror[\s\S]*outcome='superseded'[\s\S]*strict:true/u,'maintenance mutation must compare requests inside a strict transaction and fail closed on unavailable state');
assert.doesNotMatch(device,/MAINTENANCE_(?:CATCHUP|GRACE|BLOCKED|ERROR|CONTENTION)_RETRY_MS/u,'Device must not retain a private maintenance cadence table');
assert.doesNotMatch(provider,/PROVIDER_MAINTENANCE_(?:CATCHUP|GRACE|BLOCKED|ERROR|CONTENTION)_RETRY_MS/u,'Drive must not retain a private maintenance cadence table');
assert.doesNotMatch(device,/createMaintenanceScheduler|createIntegrityScheduler|registerJob|beginBackground|beginForeground|setTimeout\(\(\)=>[^,]*schedule/u,'the Device Folder runs no jobs of its own: maintenance, integrity and automatic backups are the engine\'s per-location jobs');
// The Device Folder's own folder (made, claimed or moved from the old single
// folder) is written only by the writing tab, behind the shared gate and one
// tab at a time.
assert.match(device,/function prepareInBackground\(\)\{[\s\S]{0,400}environment\.backgroundBlocker\(\)[\s\S]{0,120}if\(blocked\)return;/u,'Device Folder preparation in the background waits for the shared gate');
assert.match(device,/function prepareRepository\(\{choose=false\}=\{\}\)\{[\s\S]{0,200}if\(!environment\.canMutate\(\)\)return Promise\.reject[\s\S]{0,240}preparing=environment\.withLock\(/u,'only the writing tab prepares the folder, under a lock');
assert.match(app,/backgroundBlocker:\(\)=>backgroundBlocker\(\),canMutate:\(\)=>appCanMutate\(\)[\s\S]{0,400}withLock:work=>navigator\.locks\?\.request\?navigator\.locks\.request\(ProfileScope\.scoped\('study-director-device-folder-prepare'\)/u,'the app hands the Device Folder the shared gate and a profile-scoped Web Lock');
assert.match(app,/\['device-folder',Object\.freeze\(\{wake:\(\)=>DeviceBackup\.wake\(\)\}\)\],\s*\['backup-locations'/u,'the folder is prepared when the gate opens, before the backup locations wake');
assert.match(provider,/background\.createMaintenanceScheduler/u,'Drive maintenance must use the per-target shared lifecycle scheduler');
assert.match(provider,/scheduler\.observe\(observation/u,'Drive inspection must feed repository observations into durable maintenance intent');
assert.match(provider,/async function historyRepositoryProvider[\s\S]*observeRepositoryMaintenance\(selected,repositoryInventoryObservation\(inventory\)\)/u,'history inspection must create durable maintenance intent when repository debris is observed, for every location');
assert.match(provider,/providerMaintenanceScheduler\(selected\)\?\.adopt\(cleanup,\{trigger:'safety-removal',pending:servicedPending\}/u,'Drive cleanup performed outside the scheduler must return through the shared maintenance state machine');
assert.match(provider,/backgroundAvailable:typeof config\.backgroundAvailable==='function'[\s\S]*providerBackgroundAvailability/u,'provider background scheduling must preserve a non-interactive availability contract');
assert.match(provider,/isAvailable:\(\)=>providerBackgroundAvailability\(selected\)/u,'Drive maintenance must become opportunity-driven when provider authorization is unavailable');
assert.match(managedRepository,/overflow===true[\s\S]*gcPending:true/u,'fail-closed repository-list overflow must remain durably pending for later maintenance');
assert.match(managedRepository,/function rethrowCleanupControl[\s\S]*AbortError[\s\S]*_MAINTENANCE_BUDGET[\s\S]*catch\(error\)\{rethrowCleanupControl\(error\)/u,'shared repository cleanup must propagate cancellation/work-budget control flow instead of misclassifying it as corruption');
assert.match(managedRepository,/objectListingFailed=true[\s\S]*uncertainCount:uncertain/u,'repository object-list failures must remain diagnosable blocked uncertainty');

// One ownership/pre-emption model; local executors retain only their transport/cadence work.
assert.match(background,/const PRIORITY=freeze\(\{integrity:10,maintenance:20,convergence:30\}\)/u,'background priority must be explicit and shared');
assert.match(background,/function beginForeground[\s\S]*suspendTimers\(\)[\s\S]*row\.controller\.abort/u,'foreground work must disarm scheduled work and abort active lower-priority jobs');
assert.match(background,/function suspend\(reason='suspended',\{preserveForegroundController=null\}=\{\}\)[\s\S]*waiting=\[\][\s\S]*row\.settlement[\s\S]*const settled=waitForSettlement\(waiting\)/u,'shared suspension must expose a settlement barrier rather than merely signal abort');
assert.match(provider,/if\(busy\|\|sync\?\.catching\)\{schedulePendingProviderBackup\(selected,PROVIDER_CONVERGENCE_BUSY_RETRY_MS,\{trigger:'provider-busy'\}\)/u,'automatic backups never start while a foreground operation owns the engine and retain their deferral provenance');
assert.match(provider,/scope=await background\.beginBackground\('convergence'/u,'automatic publication must use the shared background ownership gate');
assert.match(provider,/async function createProtectedSafety\(id,purpose='before-clear-library',options=\{\}\)[\s\S]*beginForeground\(selected[\s\S]*await foreground\.settled[\s\S]*saveRepositoryProvider/u,'Before Clear Library safety must reserve foreground ownership and settle background work before repository work');
assert.match(provider,/function beginForeground\(selected[\s\S]*background\.beginForeground/u,'Drive explicit operations must reserve shared foreground ownership');
assert.match(provider,/beginBackground\('convergence'/u,'deferred Drive convergence must use the shared priority gate');
assert.match(provider,/background\.createIntegrityScheduler[\s\S]*budgetCode:'REPOSITORY_INTEGRITY_BUDGET'[\s\S]*execute:async\(\{target,trigger,nextEligibleAt,signal,checkpoint\}\)/u,'Drive integrity work must use the per-target shared recurrence and receive the shared cancellation signal');
assert.match(app,/const INTEGRITY_LOCATION_ID=\/\^\[a-z\]\[a-z0-9-\]\{0,40\}\$\/u;/u,'the integrity record is keyed by location id, so every location runs on the engine\'s per-location integrity scheduler');
assert.doesNotMatch(app,/INTEGRITY_TARGETS/u,'no fixed device/drive slots remain in the integrity record');
assert.match(app,/function backgroundBlocker\(\{housekeeping=true\}=\{\}\)\{\s*if\(!appCanMutate\(\)\)return 'awaiting-control';\s*if\(!StartupLifecycle\.status\(\)\.fullyInitialized\)return 'startup';[\s\S]*?housekeeping&&storageResetUnresolved\(\)\?'storage-reset'/u,'every background job shares one gate: write ownership (asked first, so a job configured during page load never reads start-up state early), start-up, and for housekeeping an unresolved browser-data clear');
assert.equal((app.match(/isAvailable:\(\)=>backgroundBlocker\(/gu)||[]).length,1,'repository integrity uses the shared gate directly');
assert.equal((app.match(/isAvailable:\(\)=>upkeepBlocker\(/gu)||[]).length,4,'canonical maintenance, attachment cleanup and verification, and scratch files use the upkeep gate');
assert.match(app,/function upkeepBlocker\(options\)\{\s*const blocker=backgroundBlocker\(options\);if\(blocker\)return blocker;\s*\/\/[^\n]*\n\s*if\(UnsupportedData\.held\(\)\)return 'unsupported-data';\s*if\(!backgroundMaintenanceForegroundBusy\(\)\)return '';\s*if\(foregroundWatch===null\)foregroundWatch=setTimeout\(foregroundChanged,FOREGROUND_RECHECK_MS\);\s*return 'foreground-busy';/u,'local upkeep waits under a named reason while the person is busy or data this build cannot read is held; one watcher, not each job, checks back');
assert.match(app,/function foregroundChanged\(\)\{\s*if\(foregroundWatch===null\)return false;[\s\S]*?return wakeBackgroundOperations\('foreground-released'\);/u,'the watcher wakes every job once the foreground work ends');
assert.match(app,/NoticeCoordinator\.subscribe\(\(\)=>\{foregroundChanged\(\);\}\)/u,'notice changes check the watcher at once');
assert.match(app,/if\(pwaUpdateReservation===token\)\{pwaUpdateReservation=null;foregroundChanged\(\);\}/u,'an app update that ends releases upkeep at once');
assert.match(app,/function holdBackgroundForFileWork\(\)\{\s*const status=BackupController\.status\(\),active=!!\(status\.importHoldsBackground\|\|status\.standaloneExportActive\);[\s\S]*?BackupProviderRuntime\.suspendBackground\('file-backup'\)[\s\S]*?hold\.release\(\)[\s\S]*?foregroundChanged\(\);\s*\}\s*BackupController\.subscribeStatus\(holdBackgroundForFileWork\);/u,'a file backup or import the person starts holds background backup work; automatic backups never set those flags');
assert.match(app,/if\(importCancel\)importCancel\.hidden=!state\.importHoldsBackground/u,'the standalone-file import Cancel control must not appear for an automatic provider catch-up');
assert.match(backup,/function beginImport\(\{backgroundPreemptible=false\}=\{\}\)[\s\S]*backgroundPreemptible:backgroundPreemptible===true[\s\S]*importHoldsBackground:!!activeImportOperation&&!activeImportOperation\.backgroundPreemptible/u,'standalone/manual imports hold all providers while an admitted automatic sync does not cancel itself via the file observer');
assert.match(provider,/BackupController\.beginImport\(\{backgroundPreemptible:options&&options\.respectBackgroundSuspension===true\}\)/u,'automatic catch-up must use the controller under its already suspension-aware provider ownership');
assert.doesNotMatch(app,/schedule\w*\((?:15000|ATTACHMENT_INTEGRITY_RETRY_MS),'foreground-busy'\)/u,'no upkeep job polls for the foreground on its own');
assert.match(app,/function backupBackgroundAvailability\(\)\{return backgroundBlocker\(\)\|\|/u,'automatic backups and their upkeep use the shared gate');
assert.match(app,/const DataMaintenanceJob=[\s\S]{0,120}isAvailable:\(\)=>upkeepBlocker\(\{housekeeping:false\}\)/u,'canonical maintenance is recovery and keeps running through a browser-data clear');
assert.doesNotMatch(app,/isAvailable:\(\)=>(?:!StartupLifecycle|appCanMutate\(\))/u,'no background job keeps its own start-up or ownership check');
assert.match(app,/function settleStorageReset\(\)\{[\s\S]*?wakeBackgroundOperations\('storage-reset-settled'\)/u,'housekeeping paused by a clear resumes as soon as the clear is settled');
assert.match(provider,/isAvailable:\(\)=>\{const local=integrityScrubHooks\.isAvailable\(id\);return local===true\?providerBackgroundAvailability\(selected\):String\(local\|\|'awaiting-control'\);\}/u,'provider integrity must preserve named event-driven unavailability instead of collapsing it to polling false');
assert.doesNotMatch(app,/REPOSITORY_INTEGRITY_POLICY|repositoryIntegrityTargetDue|scheduleRepositoryIntegrityScrub|runDeviceRepositoryIntegrityScrub/u,'retired host integrity wrappers must be removed after coordinator consolidation');
assert.match(backup,/const RepositoryBackgroundProviderPort=freeze\(\{[\s\S]*format:RepositoryBackgroundModule\.format[\s\S]*createCoordinator:RepositoryBackgroundModule\.createCoordinator[\s\S]*maintenanceActionable:RepositoryBackgroundModule\.maintenanceActionable[\s\S]*background:RepositoryBackgroundProviderPort/u,'Backup Provider must receive a narrow repository-background port instead of the whole internal module surface');

assert.match(app,/backgroundMaintenanceStatusBusy\(owner,field='busy'\)[\s\S]*catch\(error\)[\s\S]*return true/u,'foreground-status probe failures must conservatively block unrelated local background maintenance');
assert.match(app,/backgroundMaintenanceForegroundBusy\(\)[\s\S]*AppMutationCoordinator,'active'[\s\S]*BackupController[\s\S]*BackupProviderRuntime/u,'local background work must yield to foreground backup/recovery');
assert.match(app,/BackupOperationDiagnostics\.start\('data-maintenance'/u);
assert.match(app,/DATA_MAINTENANCE_SCHEDULE_INTERVAL_MS=AppData\.maintenance\.intervalMs,DATA_MAINTENANCE_FAILURE_RETRY_MS=30\*60\*1000/u,'canonical data maintenance takes its interval from the repository that records it, with a bounded failure retry');
assert.match(app,/status==='completed'\)\{[\s\S]{0,200}AppData\.notes\.purgeExpiredTrash\(\);[\s\S]{0,120}scheduleRichTextAssetMaintenance\(ATTACHMENT_CLEANUP_AFTER_UPKEEP_MS\);/u,'daily upkeep empties expired Recently deleted notes, then sweeps unused attachments');
assert.doesNotMatch(app,/scheduleDailyAttachmentMaintenance|(?<!OBSOLETE_)STORAGE_KEYS\.attachmentMaintenance/u,'attachment cleanup keeps no browser-storage record of its own');
assert.match(app,/status==='completed'[\s\S]*scheduleDataMaintenance\(DATA_MAINTENANCE_SCHEDULE_INTERVAL_MS,'interval'\)[\s\S]*reason==='recent'[\s\S]*lastRun\+DATA_MAINTENANCE_SCHEDULE_INTERVAL_MS[\s\S]*status==='failed'\|\|reason==='indexeddb-unavailable'[\s\S]*DATA_MAINTENANCE_FAILURE_RETRY_MS/u,'canonical data maintenance must remain live across long-running sessions and transient failures');
assert.match(assets,/diagnostics\?\.start\?\.\('asset-maintenance'/u);
assert.match(app,/BackupOperationDiagnostics\.start\('attachment-integrity'/u);
assert.match(provider,/OperationDiagnostics\.start\('provider-integrity'[\s\S]*nextEligibleAt/u);
assert.match(provider,/OperationDiagnostics\.start\('provider-convergence'/u);
assert.match(app,/configuration:Object\.freeze\(\{release:APP_VERSION,limit:20\}\)/u,'diagnostic history must be large enough to inspect a background/foreground cycle');
assert.match(repositories,/async function rebaseBackupPreparationState\(\)[\s\S]*Meta\.transaction\('readwrite'[\s\S]*canonicalMutationEpoch[\s\S]*backupPreparationUnitPrefix/u,'authoritative rebase must atomically reset durable acceleration metadata');
assert.match(backup,/if\(changed\)await rebaseRepositoryPreparationAcceleration\('combine'\)/u);
assert.match(backup,/await rebaseRepositoryPreparationAcceleration\('replace'\)/u);

// Persistence hardening and shared repository protocol policy.
assert.match(policy,/const maintenanceWorkBudgetMs=30\*1000,maintenanceReleaseGraceMs=maintenanceWorkBudgetMs/u,'repository maintenance liveness must derive its bounded release grace from the existing 30-second work budget');
assert.match(policy,/publicationMaxAgeMs:24\*60\*60\*1000[\s\S]*publicationAssertionMarginMs:30\*60\*1000[\s\S]*maintenanceWorkBudgetMs,[\s\S]*maintenanceReleaseGraceMs,[\s\S]*maintenanceMaxAgeMs:maintenanceWorkBudgetMs\+maintenanceReleaseGraceMs[\s\S]*maintenanceAssertionMarginMs:maintenanceReleaseGraceMs[\s\S]*objectGcGraceMs:48\*60\*60\*1000/u,'shared repository protocol must bound maintenance leases by work budget plus release grace rather than a long-lived lock');
assert.match(app,/limits:Object\.freeze\(\{publicationMaxAgeMs:RepositoryPolicyModule\.protocol\.publicationMaxAgeMs[\s\S]*maintenanceMaxAgeMs:RepositoryPolicyModule\.protocol\.maintenanceMaxAgeMs/u,'Device Folder storage must use the shared repository protocol policy for its locks');
assert.match(provider,/RepositoryPolicy=input\.repositoryPolicy[\s\S]*RepositoryPolicy\.protocol/u,'Drive repository transport must consume shared repository protocol policy');
assert.match(mutation,/async function refreshAuthority[\s\S]*durableAcquire[\s\S]*writeLease\(kind,id\)[\s\S]*loseAuthority\(error,\{durableProtected:true\}\)/u,'local mirror renewal failure must retain the stronger durable lease while failing forward mutation closed');
assert.match(mutation,/function assertAuthority\(options=\{\}\)[\s\S]*allowDurableProtected[\s\S]*throw active\.authorityError/u,'destructive callers must have an explicit authority assertion with rollback-only durable protection');
assert.match(backup,/requireCanonicalComplete:true/u,'managed repository publication must require a complete canonical capture');
assert.match(backupCapture,/BACKUP_CANONICAL_CAPTURE_INCOMPLETE/u,'incomplete rescue captures must have an explicit managed-publication rejection');
assert.match(managedRepository,/health:manifest\.warning\?'degraded':'healthy'[\s\S]*warning:String\(manifest\.warning/u,'Version History must preserve and surface legacy degraded checkpoint warnings');
const pendingReader=host.slice(host.indexOf('async function readPending('),host.indexOf('function mutatePending('));
assert.match(pendingReader,/throw error/u,'provider pending reads and mutations must propagate unavailable durable state');
assert.doesNotMatch(pendingReader,/normalizePending\(null\)/u,'unavailable provider pending state must not be normalized into absence');
assert.doesNotMatch(app,/REPOSITORY_INTEGRITY_META_KEY|exactCanonicalKeys\(/u,'retired host declarations must not remain after ownership cleanup');
assert.doesNotMatch(drive,/function readWithTimeout\b/u,'retired Drive timeout helper must be removed');

// Coordination boundaries, rather than historical timer/flag spellings. The
// unit and assembled integration suites establish the behavioral invariants.
const lifecycle=fs.readFileSync('source/core/operation-lifecycle.js','utf8');
assert.match(lifecycle,/function createJob[\s\S]*function reconcile[\s\S]*function wake[\s\S]*function complete/u);
assert.match(background,/Lifecycle\.createJob/u);assert.match(background,/registerJob\('maintenance'/u);assert.match(background,/registerJob\('integrity'/u);
assert.match(provider,/background\.registerJob\('convergence'/u);
assert.match(assets,/Lifecycle\.createJob/u);assert.match(app,/const DataMaintenanceJob=OperationLifecycle\.createJob/u);assert.match(app,/const AttachmentIntegrityJob=OperationLifecycle\.createJob/u);
assert.match(app,/OperationLifecycle\.createGroup/u);assert.match(app,/wakeBackgroundOperations\('ownership'\)/u);assert.match(app,/wakeBackgroundOperations\('encryption-unlocked'\)/u);
assert.match(provider,/providerMaintenanceScheduler\(selected\);providerIntegrityScheduler\(selected\);(?:const job=)?providerConvergenceJob\(selected\)/u,'registration and reconnection must wake complete provider ownership');
assert.match(provider,/budgetMs:background\.integrity\.workBudgetMs/u,'integrity policy must come from the bound coordinator');
assert.doesNotMatch(provider,/Background\.integrity|PROVIDER_CONVERGENCE_BUDGET|backgroundAfter|convergenceAfter|resumePendingProviderBackup/u,'retired handoffs and transfer deadlines must be absent');
assert.doesNotMatch(app,/dataMaintenanceTimer|attachmentIntegrityTimer|attachmentIntegrityRunning|attachmentIntegrityAwaitingControl|attachmentMaintenanceDailyTimer/u,'host timers must not duplicate lifecycle ownership');
assert.doesNotMatch(device,/scheduledUrgent|scheduledRetry|automaticRetryPaused/u,'automatic deadlines and blockers belong to the shared lifecycle');
assert.match(host,/JSON\.stringify\(pending\)!==JSON\.stringify\(expected\)/u,'publication completion must compare the serviced durable request');
console.log(JSON.stringify({status:'PASS',suite:'background-work-contract',sharedStateMachine:true,maintenanceEligibility:true,maintenanceClassification:true,blockedBackoff:true,foregroundPreemption:true,suspensionSettlement:true,opportunityDrivenIntegrity:true,leanProviderPort:true,clearLibrarySafetyForeground:true,backgroundDiagnostics:true,authoritativeRebase:true,persistenceHardening:true,sharedRepositoryPolicy:true},null,2));
