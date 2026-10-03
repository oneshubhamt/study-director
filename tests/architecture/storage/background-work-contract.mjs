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
assert.match(metadata,/version!==1&&version!==2&&version!==3&&version!==4/u,'legacy maintenance metadata must remain readable during migration');

assert.match(background,/input\.intent\.clear\(pending\)/u,'maintenance completion must carry its serviced request');
assert.match(background,/generation!==requestGeneration/u,'requests arriving after a commit must retain their scheduling opportunity');
assert.match(repositories,/AreaNotesRepository\.flush\(\{strict:true\}\)/u,'daily completion requires strict note durability');
assert.match(repositories,/flushDeletionRecovery\(\)!==true/u,'daily completion must reject incomplete deletion recovery');

// Scheduling policy is shared rather than duplicated in Device and Drive, with suspension settlement and opportunity-driven availability.
assert.match(background,/const MAINTENANCE=freeze\(\{[\s\S]*continuationMs:5000[\s\S]*contentionMs:15\*60\*1000[\s\S]*errorMs:5\*60\*1000[\s\S]*blockedMs:15\*60\*1000[\s\S]*graceMs:6\*60\*60\*1000/u,'maintenance cadence must be defined once in the repository-background policy');
assert.match(background,/function maintenancePlan\(cleanup\)[\s\S]*bounded-continuation[\s\S]*contentionRetryMs[\s\S]*publication-contention[\s\S]*delete-failure[\s\S]*blocked-uncertain[\s\S]*gc-grace/u,'shared maintenance policy must distinguish actionable, expiry-aware contention, failures, uncertainty and grace-deferred work');
assert.match(background,/maintenanceDefersAcrossObservation[\s\S]*preserveDeferred[\s\S]*maintenanceDelay\(pending/u,'repeated inspection must preserve blocked/error deadlines instead of pulling them into a hot loop');
assert.match(background,/function createMaintenanceScheduler[\s\S]*state-read-failed[\s\S]*marker-clear-failed[\s\S]*intent-write-failed/u,'shared maintenance lifecycle must retain retry opportunities when durable marker operations fail');
assert.match(background,/function createIntegrityScheduler[\s\S]*integrityTargetDue[\s\S]*beginBackground\('integrity'[\s\S]*signal:scope\.signal[\s\S]*failureRetryMs/u,'repository integrity recurrence, ownership, cancellation and budget enforcement must be centralized in the shared background module');
assert.match(app,/readRepositoryMaintenancePending\(\{throwOnError=false\}=[\s\S]*if\(throwOnError\)throw error/u,'durable maintenance state reads must be able to fail closed instead of silently becoming empty state');
assert.match(app,/function mutateRepositoryMaintenancePending[\s\S]*BackupAppMeta\.transaction\('readwrite'[\s\S]*handle\.request\.onerror[\s\S]*outcome='superseded'[\s\S]*strict:true/u,'maintenance mutation must compare requests inside a strict transaction and fail closed on unavailable state');
assert.doesNotMatch(device,/MAINTENANCE_(?:CATCHUP|GRACE|BLOCKED|ERROR|CONTENTION)_RETRY_MS/u,'Device must not retain a private maintenance cadence table');
assert.doesNotMatch(provider,/PROVIDER_MAINTENANCE_(?:CATCHUP|GRACE|BLOCKED|ERROR|CONTENTION)_RETRY_MS/u,'Drive must not retain a private maintenance cadence table');
assert.match(device,/background\.createMaintenanceScheduler/u,'Device maintenance must use the shared lifecycle scheduler');
assert.match(provider,/background\.createMaintenanceScheduler/u,'Drive maintenance must use the per-target shared lifecycle scheduler');
assert.match(provider,/scheduler\.observe\(observation/u,'Drive inspection must feed repository observations into durable maintenance intent');
assert.match(device,/async function history[\s\S]*scheduleRepositoryMaintenanceForState\(state/u,'Device history inspection must create durable maintenance intent when repository debris is observed');
assert.match(device,/maintenanceScheduler\.adopt\(cleanup,\{trigger:'safety-removal',pending:servicedPending\}/u,'Device cleanup performed outside the scheduler must return through the shared maintenance state machine');
assert.match(provider,/providerMaintenanceScheduler\(selected\)\?\.adopt\(cleanup,\{trigger:'safety-removal',pending:servicedPending\}/u,'Drive cleanup performed outside the scheduler must return through the shared maintenance state machine');
assert.match(provider,/backgroundAvailable:typeof config\.backgroundAvailable==='function'[\s\S]*providerBackgroundAvailability/u,'provider background scheduling must preserve a non-interactive availability contract');
assert.match(provider,/isAvailable:\(\)=>providerBackgroundAvailability\(selected\)/u,'Drive maintenance must become opportunity-driven when provider authorization is unavailable');
assert.match(managedRepository,/overflow===true[\s\S]*gcPending:true/u,'fail-closed repository-list overflow must remain durably pending for later maintenance');
assert.match(managedRepository,/function rethrowCleanupControl[\s\S]*AbortError[\s\S]*_MAINTENANCE_BUDGET[\s\S]*catch\(error\)\{rethrowCleanupControl\(error\)/u,'shared repository cleanup must propagate cancellation/work-budget control flow instead of misclassifying it as corruption');
assert.match(managedRepository,/objectListingFailed=true[\s\S]*uncertainCount:uncertain/u,'repository object-list failures must remain diagnosable blocked uncertainty');

// One ownership/pre-emption model; local executors retain only their transport/cadence work.
assert.match(background,/const PRIORITY=freeze\(\{integrity:10,maintenance:20,automatic:30,convergence:40\}\)/u,'background priority must be explicit and shared');
assert.match(background,/function beginForeground[\s\S]*suspendTimers\(\)[\s\S]*row\.controller\.abort/u,'foreground work must disarm scheduled work and abort active lower-priority jobs');
assert.match(background,/function suspend\(reason='suspended'\)[\s\S]*waiting=\[\][\s\S]*row\.settlement[\s\S]*const settled=waitForSettlement\(waiting\)/u,'shared suspension must expose a settlement barrier rather than merely signal abort');
assert.match(device,/canSchedulePendingBackup\(\)[\s\S]*!foregroundController/u,'automatic Device backup scheduling must be excluded while a foreground operation owns the subsystem');
assert.match(device,/beginAutomaticBackupController[\s\S]*background\.beginBackground\('automatic'/u,'automatic Device publication must use the shared background ownership gate');
assert.match(device,/function beginForegroundController[\s\S]*background\.beginForeground/u,'Device explicit operations must reserve shared foreground ownership');
assert.match(device,/\(automatic\|\|integrityRepair\)&&foregroundController/u,'automatic and integrity-repair Device publications must not begin under foreground ownership');
assert.match(device,/async function createProtectedSafety[\s\S]*beginForegroundController[\s\S]*await foreground\.settled[\s\S]*queryPermission/u,'Before Clear Library safety must reserve foreground ownership and settle background work before permission/repository work');
assert.match(provider,/function beginForeground\(selected[\s\S]*background\.beginForeground/u,'Drive explicit operations must reserve shared foreground ownership');
assert.match(provider,/beginBackground\('convergence'/u,'deferred Drive convergence must use the shared priority gate');
assert.match(provider,/background\.createIntegrityScheduler[\s\S]*budgetCode:'REPOSITORY_INTEGRITY_BUDGET'[\s\S]*execute:async\(\{target,trigger,nextEligibleAt,signal\}\)/u,'Drive integrity work must use the per-target shared recurrence and receive the shared cancellation signal');
assert.match(app,/DeviceRepositoryBackground\.createIntegrityScheduler[\s\S]*budgetCode:'DEVICE_INTEGRITY_BUDGET'[\s\S]*backgroundOwned:true/u,'Device integrity work must use the per-target shared recurrence/ownership rather than nesting a second coordinator scope');
assert.match(app,/isAvailable:\(\)=>DeviceBackup\.status\(\)\.connected\?backupBackgroundAvailability\(\):'awaiting-connection'/u,'disconnected Device integrity must sleep until a connection opportunity instead of polling');
assert.match(app,/isAvailable:id=>id!=='google-drive'\?'unavailable':appCanMutate\(\)\?true:'awaiting-control'/u,'Drive integrity must become opportunity-driven while this tab lacks mutation control');
assert.match(provider,/isAvailable:\(\)=>\{const local=integrityScrubHooks\.isAvailable\(id\);return local===true\?providerBackgroundAvailability\(selected\):String\(local\|\|'awaiting-control'\);\}/u,'provider integrity must preserve named event-driven unavailability instead of collapsing it to polling false');
assert.doesNotMatch(app,/REPOSITORY_INTEGRITY_POLICY|repositoryIntegrityTargetDue|scheduleRepositoryIntegrityScrub|runDeviceRepositoryIntegrityScrub/u,'retired host integrity wrappers must be removed after coordinator consolidation');
assert.match(backup,/const RepositoryBackgroundProviderPort=freeze\(\{[\s\S]*format:RepositoryBackgroundModule\.format[\s\S]*createCoordinator:RepositoryBackgroundModule\.createCoordinator[\s\S]*maintenanceActionable:RepositoryBackgroundModule\.maintenanceActionable[\s\S]*background:RepositoryBackgroundProviderPort/u,'Backup Provider must receive a narrow repository-background port instead of the whole internal module surface');

assert.match(app,/backgroundMaintenanceStatusBusy\(owner,field='busy'\)[\s\S]*catch\(error\)[\s\S]*return true/u,'foreground-status probe failures must conservatively block unrelated local background maintenance');
assert.match(app,/backgroundMaintenanceForegroundBusy\(\)[\s\S]*AppMutationCoordinator,'active'[\s\S]*BackupController[\s\S]*BackupProviderRuntime[\s\S]*DeviceBackup/u,'local background work must yield to foreground backup/recovery');
assert.match(app,/BackupOperationDiagnostics\.start\('data-maintenance'/u);
assert.match(app,/DATA_MAINTENANCE_SCHEDULE_INTERVAL_MS=24\*60\*60\*1000[\s\S]*DATA_MAINTENANCE_FAILURE_RETRY_MS=30\*60\*1000/u,'canonical data maintenance must have an explicit recurring interval and bounded failure retry');
assert.match(app,/status==='completed'[\s\S]*scheduleDataMaintenance\(DATA_MAINTENANCE_SCHEDULE_INTERVAL_MS,'interval'\)[\s\S]*reason==='recent'[\s\S]*lastRun\+DATA_MAINTENANCE_SCHEDULE_INTERVAL_MS[\s\S]*status==='failed'\|\|reason==='indexeddb-unavailable'[\s\S]*DATA_MAINTENANCE_FAILURE_RETRY_MS/u,'canonical data maintenance must remain live across long-running sessions and transient failures');
assert.match(assets,/diagnostics\?\.start\?\.\('asset-maintenance'/u);
assert.match(app,/BackupOperationDiagnostics\.start\('attachment-integrity'/u);
assert.match(device,/operationStart\('device-integrity'[\s\S]*nextEligibleAt/u);
assert.match(provider,/OperationDiagnostics\.start\('provider-integrity'[\s\S]*nextEligibleAt/u);
assert.match(provider,/OperationDiagnostics\.start\('provider-convergence'/u);
assert.match(app,/configuration:Object\.freeze\(\{release:APP_VERSION,limit:20\}\)/u,'diagnostic history must be large enough to inspect a background/foreground cycle');
assert.match(repositories,/async function rebaseBackupPreparationState\(\)[\s\S]*Meta\.transaction\('readwrite'[\s\S]*canonicalMutationEpoch[\s\S]*backupPreparationUnitPrefix/u,'authoritative rebase must atomically reset durable acceleration metadata');
assert.match(backup,/if\(changed\)await rebaseRepositoryPreparationAcceleration\('combine'\)/u);
assert.match(backup,/await rebaseRepositoryPreparationAcceleration\('replace'\)/u);

// Persistence hardening and shared repository protocol policy.
assert.match(policy,/const maintenanceWorkBudgetMs=30\*1000,maintenanceReleaseGraceMs=maintenanceWorkBudgetMs/u,'repository maintenance liveness must derive its bounded release grace from the existing 30-second work budget');
assert.match(policy,/publicationMaxAgeMs:24\*60\*60\*1000[\s\S]*publicationAssertionMarginMs:30\*60\*1000[\s\S]*maintenanceWorkBudgetMs,[\s\S]*maintenanceReleaseGraceMs,[\s\S]*maintenanceMaxAgeMs:maintenanceWorkBudgetMs\+maintenanceReleaseGraceMs[\s\S]*maintenanceAssertionMarginMs:maintenanceReleaseGraceMs[\s\S]*objectGcGraceMs:48\*60\*60\*1000/u,'shared repository protocol must bound maintenance leases by work budget plus release grace rather than a long-lived lock');
assert.match(device,/RepositoryPolicy=input\.repositoryPolicy[\s\S]*RepositoryPolicy\.protocol/u,'Device repository transport must consume shared repository protocol policy');
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
assert.match(provider,/background\.registerJob\('convergence'/u);assert.match(device,/background\.registerJob\('automatic'/u);
assert.match(assets,/Lifecycle\.createJob/u);assert.match(app,/const DataMaintenanceJob=OperationLifecycle\.createJob/u);assert.match(app,/const AttachmentIntegrityJob=OperationLifecycle\.createJob/u);
assert.match(app,/OperationLifecycle\.createGroup/u);assert.match(app,/wakeBackgroundOperations\('ownership'\)/u);assert.match(app,/wakeBackgroundOperations\('encryption-unlocked'\)/u);
assert.match(provider,/providerMaintenanceScheduler\(selected\);providerIntegrityScheduler\(selected\);providerConvergenceJob\(selected\)/u,'registration and reconnection must wake complete provider ownership');
assert.match(provider,/budgetMs:background\.integrity\.workBudgetMs/u,'integrity policy must come from the bound coordinator');
assert.doesNotMatch(provider,/Background\.integrity|PROVIDER_CONVERGENCE_BUDGET|backgroundAfter|convergenceAfter|resumePendingProviderBackup/u,'retired handoffs and transfer deadlines must be absent');
assert.doesNotMatch(app,/dataMaintenanceTimer|attachmentIntegrityTimer|attachmentIntegrityRunning|attachmentIntegrityAwaitingControl|attachmentMaintenanceDailyTimer/u,'host timers must not duplicate lifecycle ownership');
assert.doesNotMatch(device,/scheduledUrgent|scheduledRetry|automaticRetryPaused/u,'automatic deadlines and blockers belong to the shared lifecycle');
assert.match(host,/JSON\.stringify\(pending\)!==JSON\.stringify\(expected\)/u,'publication completion must compare the serviced durable request');
console.log(JSON.stringify({status:'PASS',suite:'background-work-contract',sharedStateMachine:true,maintenanceEligibility:true,maintenanceClassification:true,blockedBackoff:true,foregroundPreemption:true,suspensionSettlement:true,opportunityDrivenIntegrity:true,leanProviderPort:true,clearLibrarySafetyForeground:true,backgroundDiagnostics:true,authoritativeRebase:true,persistenceHardening:true,sharedRepositoryPolicy:true},null,2));
