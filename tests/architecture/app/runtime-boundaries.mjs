import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import {readHostHtml} from '../../../build/host-source.mjs';
import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {richTextRuntimeSource} from '../../helpers/rich-text-runtime.mjs';

const foundation=readRuntimeSource('source/core/foundation-host.ts');

// Current runtime boundary invariants: decision time, pacing, presentation, and bounded background/display work.

{ // decision-clock-boundary
const host=readHostHtml();
const timer=readScript('source/core/timer-engine.ts');
const execution=readScript('source/core/execution-host.ts');
const executionViews=readScript('source/core/execution-views.ts');
const actions=readScript('source/core/session-actions.ts');
const sessionHost=readScript('source/core/session-host.ts');
const sessionHandoff=readScript('source/core/session-handoff.ts');
const attachments=readScript('source/core/attachments.ts');
const mutation=readScript('source/core/mutation-coordinator.ts');

function section(source,start,end){
  const from=source.indexOf(start),to=source.indexOf(end,from+start.length);
  assert.ok(from>=0&&to>from,`Missing architecture section: ${start}`);
  return source.slice(from,to);
}

assert.match(host,/const DecisionClock=Object\.freeze\(\{nowMs:\(\)=>Date\.now\(\)\}\);/,'DecisionClock is a nowMs-only capability');
assert.doesNotMatch(host,/DecisionClock\.nowIso\b/,'DecisionClock must not grow informational timestamp helpers');
assert.match(host,/document,window,now:DecisionClock\.nowMs,randomIdPart,/,'App ownership decisions use the shared DecisionClock');

assert.match(timer,/clock:freeze\(\['nowMs'\]\)/,'Timer engine clock contract is nowMs-only');
assert.match(timer,/function nowIso\(\)\{return new Date\(\)\.toISOString\(\);\}/,'Timer informational timestamps remain ambient wall clock');
assert.doesNotMatch(timer,/clockNowIso|ports\.clock\.nowIso/,'Timer engine must not obtain ISO timestamps from DecisionClock');

assert.doesNotMatch(attachments,/\bp\.clock\b|\bclock\.nowIso\b|Attachment reference clock/,'Attachment reference rollback must not depend on DecisionClock');
assert.match(attachments,/const nowIso=\(\)=>new Date\(\)\.toISOString\(\);/,'Attachment rollback stamps remain ordinary wall-clock metadata');

assert.match(host,/MutationCoordinatorModule\.createCoordinator\(Object\.freeze\(\{[\s\S]*now:DecisionClock\.nowMs/u,'the extracted mutation coordinator receives the shared DecisionClock as its lease-decision clock');
assert.match(mutation,/const nowMs=\(\)=>\{const value=Number\(input\.environment\.now\(\)\)/u,'mutation lease decisions use the injected decision clock');
assert.match(mutation,/Number\(value\.expiresAt\)>nowMs\(\)/,'foreign mutation-lease expiry uses the injected decision clock');
assert.equal((mutation.match(/nowMs\(\)\+LEASE_MS/g)||[]).length,3,'local and durable lease acquisition/refresh expiry use the injected decision clock');
assert.match(mutation,/Number\(result\.holder&&result\.holder\.expiresAt\)-nowMs\(\)\+50/,'recovery lease wait uses the injected decision clock');
assert.match(mutation,/const id=`mutation_\$\{nowMs\(\)\.toString\(36\)\}_/,'mutation identifiers use the same injected decision clock');
assert.match(mutation,/startedAt:new Date\(\)\.toISOString\(\)/,'human/audit mutation start time remains informational wall clock');

assert.doesNotMatch(host,/PracticePacer\.pauseFromMain\(PRACTICE_PAUSE_CAUSES\.MAIN\s*,\s*Date\.now\(\)\)/,'host Pacer bridges must not bypass the injected Pacer clock');
assert.equal(((host+execution+executionViews).match(/PracticePacer\.pauseFromMain\(PRACTICE_PAUSE_CAUSES\.MAIN\);/g)||[]).length,2,'both host Pacer pause bridges defer to the Pacer clock');

const runtimePayload=section(execution,'function timerRuntimePayload(', 'function validateTimerRestoreCandidate(');
assert.doesNotMatch(runtimePayload,/Date\.now\(\)/,'persisted timer runtime arithmetic uses DecisionClock');
assert.match(runtimePayload,/DecisionClock\.nowMs\(\)/,'timer runtime captures decision time from DecisionClock');

assert.match(host,/SessionHostModule\.createController\(Object\.freeze\(\{/u,'canonical Active Session composition crosses the checked session host');
const executionComposition=section(host,'const ExecutionRuntime=ExecutionHostModule.createRuntime(Object.freeze({','const {\n  TimerState,SessionState');
const hostReviewPort=section(executionComposition,'reviewEvidence:Object.freeze({','}),\n    clockEnvironment');
assert.doesNotMatch(hostReviewPort,/buildRealTimeSnapshot|exactTaskCompletionPercent|liveTaskOutcome|resolveTaskCompletion|setTaskDoneState|setTaskSkippedState/u,'execution host must not self-reference runtime exports before ExecutionRuntime is initialized');
assert.match(sessionHost,/strictDurability:true/u,'critical local session transitions require strict repository durability');
assert.doesNotMatch(sessionHost,/Date\.now\(\)/,'session-host decisions use injected clocks rather than ambient Date.now');
assert.match(sessionHost,/clock\.nowMs\(\)/u,'live-draft debounce and timer snapshot cadence use the injected decision clock');
assert.match(sessionHost,/persistence\.recoveryWorkActive\(\)/u,'timer snapshots remain quiesced while managed recovery owns the mutation lane');
for(const token of ['claimSessionOwnership','continueSessionHere','BackupProviderRuntime','sessionHandoff']){
  assert.equal(sessionHost.includes(token),false,`P5.4B session host must not absorb P5.4C distributed ownership: ${token}`);
}
assert.match(host,/SessionHandoffModule\.createController\(Object\.freeze\(\{/u,'distributed session ownership crosses the checked P5.4C handoff boundary');
assert.doesNotMatch(sessionHandoff,/Date\.now\(\)|new Date\(/u,'handoff decisions and stamps use injected clocks');
for(const token of ['BackupProviderRuntime','AppData.activeSession','google-drive','document.','window.']){
  assert.equal(sessionHandoff.includes(token),false,`P5.4C handoff core consumes ports instead of host/provider implementation details: ${token}`);
}
assert.match(sessionHandoff,/runtime\.stopExecution\(\)[\s\S]*session\.host\.cancelPendingLiveDraftSave\(\)/u,'remote claims stop execution before persistence/sync work');
assert.match(sessionHandoff,/timerRuntime:current\.snapshot\.timerRuntime/u,'frozen claim projection preserves preemption-time timer evidence');
assert.match(sessionHandoff,/claimOwnership\([\s\S]*saveCanonicalSession\(next,'claiming Active Session ownership'/u,'Continue Here linearizes the provider claim before strict local ownership commit');
assert.match(sessionHandoff,/saveCanonicalSession\(previous,'compensating a failed ownership transfer'[\s\S]*releaseClaim/u,'failed local handoff compensates only after canonical rollback');
assert.match(sessionHandoff,/session-handoff-source-advanced[\s\S]*SESSION_CONTINUE_SYNC_REQUIRED/u,'unproven advanced remote content is delegated to ordinary sync rather than guessed');
const handoffAdapter=section(actions,'async function transferSessionOwnershipHere(', 'function setSessionHandoff(');
assert.doesNotMatch(handoffAdapter,/AppData\.activeSession|claimSessionOwnership|releaseSessionClaim|readSessionClaim/u,'host Continue Here adapter contains no distributed state-machine implementation');
assert.equal((host.match(/readSessionHandoffSource\(/gu)||[]).length,1,'host reaches the provider handoff-source reader only through P5.4C composition');
const continueFlow=section(actions,'async function continueSessionHere(', 'async function continueSessionOnExecute(');
assert.match(continueFlow,/SessionHandoffRuntime\?\.prefetchSource\(\)/u,'Continue Here latency prefetch remains inside the checked P5.4C provider boundary');
const finishTransition=section(actions,'async function finishTodaySession(', 'async function resetTodaySession(');
assert.match(finishTransition,/rollbackSnapshot=ports\.ActiveSessionRuntime\.captureSnapshot\(\)[\s\S]*writeCanonicalNow\('finishing today’s session'/u,'finish captures a recoverable runtime before its strict canonical commit');
assert.match(finishTransition,/ActiveSessionRuntime\.rollbackLocalTransition\(rollbackSnapshot,'finish-today-rollback'\)/u,'failed finish delegates runtime and recovery compensation to the checked local-session owner');
assert.doesNotMatch(finishTransition,/withPersistenceSuppressed|applyStoredSession\(rollbackSession|writeSnapshot\(rollbackSnapshot/u,'finish host wiring must not duplicate the local-session rollback state machine');

const restoreTimer=section(execution,'function deriveRestoredTimerState(', 'function createScheduleGateway(');
assert.doesNotMatch(restoreTimer,/Date\.now\(\)/,'restored timer/gap/break arithmetic uses DecisionClock');
assert.match(restoreTimer,/now=DecisionClock\.nowMs\(\)/,'restored timer fallbacks capture DecisionClock once');
assert.match(restoreTimer,/deriveRestoredInactiveGap\(runtime\s*,idx\s*,now=DecisionClock\.nowMs\(\)\)/,'restored inactive-gap arithmetic uses DecisionClock');
assert.match(restoreTimer,/deriveRestoredBreakState\(runtime\s*,idx\s*,now=DecisionClock\.nowMs\(\)\)/,'restored break arithmetic uses DecisionClock');

assert.match(host,/nowIso:\(\)=>new Date\(\)\.toISOString\(\)\n\}\)\);/,'Library-clear informational rollback stamps remain wall clock');

console.log(JSON.stringify({status:'PASS',boundary:'decision-clock',decisionClock:['nowMs'],ambientInformationalTimestamps:true},null,2));
}



{ // live-execution-host-boundary
const host=readHostHtml();
const executionHost=readScript('source/core/execution-host.ts');
const views=readScript('source/core/execution-views.ts');
const timer=readScript('source/core/timer-engine.ts');
const plan=readScript('source/core/plan.ts');
const review=readScript('source/core/review.ts');
assert.match(host,/ExecutionHostModule\.createRuntime\(Object\.freeze\(\{/u,'live execution composition crosses the checked execution host');
assert.doesNotMatch(host,/const TaskSessionState=\(\(\)=>\{/u,'per-task runtime evidence no longer has an untyped host implementation');
for(const direct of [
  /TimerStateModule\.createStateController\(/u,
  /PomodoroModule\.createController\(/u,
  /PracticePacerModule\.createModel\(/u,
  /PracticePacerModule\.createController\(/u,
  /TimerEngineModule\.createEngine\(/u
]) assert.doesNotMatch(host,direct,'main host must not reconstruct a typed execution engine directly');
assert.match(executionHost,/const byTaskId=new Map\s*\(\)/u,'task-session evidence has one task-identity keyed store after TypeScript erasure');
assert.match(executionHost,/taskIdentity\.indexForId\(row\.taskId,indexMap\)/u,'runtime evidence is remapped through stable task identity');
for(const token of ['AppData.activeSession','BackupProviderRuntime','claimSessionOwnership','continueSessionHere','sessionHandoff']){
  assert.equal(executionHost.includes(token),false,`P5.4A execution host must not absorb later Active Session/handoff ownership: ${token}`);
}
assert.match(views,/function togglePause\(\)\{const result=togglePauseTimer\(\);if\(result===true\)\{sendSessionChangeSoon[\s\S]*?schedulePwaUpdateEvaluation\(150\);\}return result;\}/u,'pause/resume publication and update work occur only after a real timer transition');
assert.match(views,/function skipTask\(\)\{[\s\S]*?if\(result===true\)\{notifyDeviceBackupIfStudyDayResolved\(\);sendSessionChangeSoon\('block-skipped'\);schedulePwaUpdateEvaluation\(150\);/u,'skip side effects occur only after a real block transition');
assert.match(timer,/function beginTimerPause\([^)]*[\s\S]*?if\(!appCanMutate\(\)\|\|TimerState\.mode!==TIMER_MODES\.RUNNING/u,'pause begins only while this tab retains mutation authority');
assert.match(timer,/function jumpTo\([^)]*\)\{[\s\S]*?if\(!appCanMutate\(\)\)return false;[\s\S]*?return startCur\(\)===true;/u,'jump refuses before capture/task mutation when ownership is lost and reports the real start result');
assert.match(timer,/function finishTrackableBlock\([^)]*\)\{[\s\S]*?if\(!appCanMutate\(\)\|\|!isTrackableBlock/u,'finish and skip share an ownership-fenced transition');
assert.match(timer,/function toggleDone\([^)]*\)\{[\s\S]*?const result=toggleDoneState\(i\);[\s\S]*?if\(result===false\)return false;/u,'done-marker toggles route through the checked completion-state owner');
assert.match(executionHost,/function toggleDoneState\([^)]*\)\{[\s\S]*?taskSessionState\.toggleDone\(index\)[\s\S]*?sources\.SKIPPED[\s\S]*?sources\.FINISHED_UNVERIFIED/u,'completion reopen cleanup is owned by the checked execution boundary');
assert.doesNotMatch(timer,/toggleDoneMarker/u,'timer engine no longer reaches an untyped host completion mutator');
assert.match(timer,/function classifyInactiveGap\([^)]*\)\{[\s\S]*?if\(!appCanMutate\(\)\)return false;[\s\S]*?const gap=TimerState\.inactiveGap/u,'inactive-gap classification cannot consume a pending decision from a read-only tab');
assert.match(timer,/function tick\(\)\{[\s\S]*?if\(!appCanMutate\(\)\)\{stopExecution\(\);return false;\}/u,'stale interval ticks stop before mutating execution after ownership loss');
assert.match(timer,/function syncTimerAfterWake\(\)\{[\s\S]*?if\(!appCanMutate\(\)\)\{stopExecution\(\);return false;\}/u,'wake reconciliation cannot mutate execution after ownership loss');
assert.match(timer,/function resumeRestoredPaused\([^)]*\)\{[\s\S]*?if\(!appCanMutate\(\)\)return false;/u,'paused timer restoration is authority fenced inside the engine');
assert.match(timer,/function resumeRestoredRunning\(\)\{[\s\S]*?if\(!appCanMutate\(\)\)return false;/u,'running timer restoration is authority fenced inside the engine');
assert.match(timer,/function recoveryCaptureActiveBeforeSwitch\(\)\{[\s\S]*?if\(!appCanMutate\(\)[\s\S]*?recordCurrentActiveToTask[\s\S]*?storeResolvedCompletion/u,'timer switching captures focus/completion inside the checked engine under current authority');
assert.match(executionHost,/function breakState\(action='status'\)[\s\S]*?if\(!active\|\|resolveActivePauseBeforeTimerSwitch\(\)!==true\)return false;[\s\S]*?writeLiveDraftNow\(\)/u,'Plan break termination delegates to the ownership-fenced checked timer transition after confirmation');
assert.match(plan,/return scheduleGateway\.breakState\('end'\)===true;/u,'Plan application propagates a failed break termination instead of claiming success');
assert.doesNotMatch(review,/function setCompletionState\(/u,'Review must consume the checked completion-state owner instead of maintaining a duplicate mutator');
assert.match(review,/resolveTaskCompletion,storeResolvedCompletion,setCompletionState,syncProgressInputsToState/u,'Review completion editing consumes the checked execution evidence port');
const reviewHost=readScript('source/core/review-host.ts');
assert.match(host,/const ReviewHostModule=INTERNAL_MODULES\.load\('review-host',1,'study-director\.review-host-module',1\);/u,'Review composition loads the checked P5.5A host owner');
assert.match(host,/const ReviewSubsystem=ReviewHostModule\.createSubsystem\(Object\.freeze\(\{[\s\S]*?module:ReviewModule,[\s\S]*?subsystem:Object\.freeze\(\{/u,'Review subsystem composition crosses the checked P5.5A host boundary');
assert.doesNotMatch(host,/ReviewModule\.createReviewSubsystem\(/u,'the main host must not bypass the checked Review host boundary');
assert.match(reviewHost,/input\.module\.format!=='study-director\.review'[\s\S]*input\.module\.contractVersion!==1/u,'Review host rejects an incompatible feature module');
assert.match(reviewHost,/!Object\.isFrozen\(input\.subsystem\)/u,'Review host rejects mutable provider composition');
assert.match(reviewHost,/!Object\.isFrozen\(subsystem\)[\s\S]*subsystem\.format!=='study-director\.review-subsystem'[\s\S]*subsystem\.contractVersion!==1/u,'Review host validates the composed subsystem before publication');
assert.match(review,/qualityFields\.some\(field=>[\s\S]{0,420}reviewOwnershipRevision[\s\S]{0,240}getOwnershipRevision\(\)[\s\S]{0,240}reviewLifecycleRevision/u,'quality controls are fenced by both ownership and lifecycle revisions before Review persistence');
const reviewPersistence=readScript('source/core/review-persistence.ts');
assert.match(host,/const ReviewPersistence=ReviewPersistenceModule\.createPersistence\(Object\.freeze\(\{/u,'Daily Reflection and Diary persistence cross the checked P5.5B owner');
assert.doesNotMatch(host,/const DailyReflectionPersistence=\(\(\)=>|const LibraryDiaryEditor=\(\(\)=>/u,'the host must not retain parallel untyped reflection or Diary persistence engines');
assert.match(reviewPersistence,/storage[\s\S]{0,180}indexeddb/u,'reflection persistence refuses fallback-only write receipts');
assert.match(reviewPersistence,/await records\.verifyCanonical\(next\)|await records\.verifyCanonical\(diary\)/u,'reflection persistence requires canonical read-back after writes');
assert.match(reviewPersistence,/await records\.verifyCanonicalAbsent\(date\)/u,'Diary-only deletion requires physical canonical absence');
assert.match(reviewPersistence,/diaryOwnershipRevision[\s\S]{0,300}ownership\.revision\(\)/u,'Diary editor bindings are fenced by ownership revision');
assert.match(reviewHost,/function createDayState\(/u,'Review date/revision/reminder state has a checked P5.5B owner');
assert.match(reviewHost,/function createSavedDayCoordinator\(/u,'Saved-Day reminder, acknowledgement, suspended-save and rollover orchestration have one checked P5.5B owner');
for(const stale of ['function promptSaveToday(','function revalidateSaveReminderAfterCanonicalConvergence(','async function acknowledgeSavedStudyDay(','const DailyReflectionPersistence=(()=>','const LibraryDiaryEditor=(()=>']){
  assert.equal(host.includes(stale),false,`main host must not retain extracted P5.5B behavior: ${stale}`);
}

for(const stale of ['function latestTrackableEndMin(','const TaskSessionState=(()=>','function getRealTimeState(','function rebuildOriginalSchedule(','function resolveTaskCompletion(','function toggleDoneMarker(','function recoveryCaptureActiveBeforeSwitch(','function resolveActivePauseBeforeTimerSwitch(']){
  assert.equal(host.includes(stale),false,`main host must not retain extracted P5.4A runtime logic: ${stale}`);
}
console.log(JSON.stringify({status:'PASS',boundary:'live-execution-host',checkedComposition:true,taskIdentityEvidence:true,noOpSideEffectsGated:true,authorityFenced:true,staleHostRuntimeRemoved:true},null,2));
}

{ // practice-pacer-boundary
const pacer=readScript('source/core/practice-pacer.ts');
const timer=readScript('source/core/timer-engine.ts');
const modelAt=pacer.indexOf('function createModel');
const controllerAt=pacer.indexOf('function createController');
assert.ok(modelAt>0&&controllerAt>modelAt,'Practice Pacer exposes distinct model/controller boundaries');
const modelSource=pacer.slice(modelAt,controllerAt);
for(const token of ['document','window','querySelector','getElementById','localStorage','sessionStorage','Pomodoro','TimerState']){
  assert.equal(new RegExp(`\\b${token}\\b`).test(modelSource),false,`Practice Pacer model remains browser/state-orchestration free: ${token}`);
}
assert.match(timer,/const \{controller:PracticePacer,model:PracticePacerModel\}=ports\.practice;/);
assert.doesNotMatch(timer,/practice-pacer-(?:setup|live|message|state)/,'timer engine does not own Practice Pacer DOM rendering');
assert.doesNotMatch(timer,/parsePracticeUnitPlan\s*\(/,'timer engine does not own Practice Pacer parsing algorithms');
assert.doesNotMatch(pacer,/Date\.now\(\)/,'Practice Pacer decision timing must use its injected clock');
assert.doesNotMatch(timer,/Date\.now\(\)/,'Timer state-machine timing must use its injected clock');
console.log(JSON.stringify({status:'PASS',boundary:'practice-pacer',pureModel:true,timerOrchestrationOnly:true},null,2));
}

{ // profile-name-authority-boundary
const host=readScript('source/core/profiles-host.ts');
const from=host.indexOf('function applyStudentName(name'),to=host.indexOf('function getStudentNameFromDisplay()',from);
assert.ok(from>=0&&to>from,'profile-name host boundary is present');
const applyName=host.slice(from,to);
assert.match(applyName,/mine=Profiles\.current\(\)/u,'profile-name mirror resolves the current profile');
assert.match(applyName,/mine&&mine\.name!==clean&&appCanMutate\(\)\)Profiles\.rename\(clean\)/u,'profile-name registry writes require current mutation authority');
assert.ok(applyName.indexOf('Profiles.rename(clean)')<applyName.indexOf("document.querySelectorAll('[data-student-name]')"),'profile registry mirror commits before the UI claims the new name');
assert.doesNotMatch(applyName,/isDefaultStudentName\(clean\).*Profiles\.rename/u,'the factory label is not a forbidden profile name');
console.log(JSON.stringify({status:'PASS',boundary:'profile-name-authority',stableIdentity:true,authorityGuard:true,commitBeforePresentation:true},null,2));
}

{ // plan-authoring-runtime-boundary
const plan=readScript('source/core/plan.ts');
const planHost=readScript('source/core/plan-host.ts');
const host=readHostHtml();
for(const token of ['TimerEngine','TimerState','SessionLifecycle','AppData.activeSession','flushLiveDraft','restoreSessionState','setCurrentTask','Pomodoro','PracticePacer']){
  assert.equal(plan.includes(token),false,`Plan authoring must not absorb live runtime ownership: ${token}`);
}
assert.match(plan,/scheduleGateway\.apply\(parsed,/u,'validated Plan application must cross the scheduleGateway runtime port');
assert.match(plan,/if\(opts\.persistDraft===false\)return apply\(\);/u,'canonical session restoration must retain its synchronous no-draft-write seam');
assert.match(plan,/save\(\{strictDurability:true\}\)/u,'user-authored Apply/Done remains gated by strict durable draft persistence');
assert.match(host,/PlanHostModule\.createData\(/u,'PlanData composition must cross the checked Plan host boundary');
assert.doesNotMatch(host,/const PlanData=\(\(\)=>\{/u,'the legacy untyped PlanData implementation must not return to the host');
assert.match(planHost,/repositories\.plans\.replace\(snapshot\)/u,'browser-data-clear recovery restores Plan draft and library through one canonical replacement');
assert.doesNotMatch(planHost,/TimerEngine|TimerState|SessionLifecycle|activeSession|flushLiveDraft|setCurrentTask|Pomodoro|PracticePacer/u,'Plan host persistence/default composition must not absorb P5.4 live-runtime ownership');
console.log(JSON.stringify({status:'PASS',boundary:'plan-authoring-runtime',runtimePort:'scheduleGateway',directRuntimeOwnership:false,synchronousRestoreSeam:true,checkedPlanHost:true,atomicResetRecovery:true},null,2));
}

{ // presentation-surface-boundary
const app=readHostHtml();
assert.match(app,/<html[^>]*data-presentation="glass"[^>]*data-typography="glass"[^>]*data-shape="glass"[^>]*data-material="glass"[^>]*data-depth="glass"/u,'Glass must be the pre-hydration presentation before bootstrap JavaScript runs.');
const core=fs.readFileSync('source/styles/core.css','utf8');
const glass=fs.readFileSync('source/external/glass.js','utf8');
const insights=fs.readFileSync('source/external/insights.js','utf8');
const editorSource=fs.readFileSync('rich-text/editor.ts','utf8');
const editorBundle=richTextRuntimeSource();

for(const token of ['--sd-material-inset','--sd-material-canvas','--sd-depth-inset','--sd-depth-canvas']){
  assert.match(app,new RegExp(token.replaceAll('-','\\-')),
    `presentation manifest exposes ${token}`);
}
for(const token of ['--sd-shape-inset-radius','--sd-shape-canvas-radius']){
  assert.match(app,new RegExp(token.replaceAll('-','\\-')),
    `presentation manifest exposes ${token}`);
}
assert.match(core,/\.ui-inset\{[^}]*var\(--sd-shape-inset-radius\)[^}]*var\(--sd-material-inset\)/s,
  'shared inset primitive is presentation-token governed');
assert.match(core,/\.ui-canvas\{[^}]*var\(--sd-shape-canvas-radius\)[^}]*var\(--sd-material-canvas\)/s,
  'shared canvas primitive is presentation-token governed');

for(const marker of [
  'reflection-workbench ui-canvas',
  'library-notes-grid ui-canvas',
  'attachment-grid ui-canvas',
  'attachment-progress ui-inset',
  'pomodoro-rhythm ui-panel',
  'focus-rhythm ui-panel',
  'break-meter ui-inset',
  'review-collapse review-blocks-collapse ui-panel'
]) assert.ok(app.includes(marker),`screenshot surface uses shared presentation primitive: ${marker}`);
assert.ok(app.includes('class="focus-setting" id="wake-setting"'),'screen wake shares the aligned settings row');
assert.ok(app.includes('class="focus-setting" id="system-alert-setting"'),'device notifications share the aligned settings row');
assert.doesNotMatch(core,/#pane-execute\[data-session-state="empty"\] \.execute-ops-grid\{display:none/,'settings remain available before a session');
assert.ok(app.includes('library-notes-grid library-diary-grid ui-canvas'),'Diary uses shared content canvas');

assert.doesNotMatch(core,/\.break-meter\{[^}]*(?:background|border):/s,
  'Break elapsed delegates material and geometry to the shared inset primitive');
assert.match(core,/\.review-blocks-collapse\{[^}]*--panel-bg:var\(--sd-material-review-collapse\)[^}]*--panel-padding:[^}]*--panel-shadow:var\(--sd-depth-review-collapse\)/s,
  'Today’s Blocks delegates its panel material, geometry and depth through ui-panel variables');
assert.doesNotMatch(core,/\.review-blocks-collapse\{[^}]*(?:background|border:|clip-path|border-radius):/s,
  'Today’s Blocks cannot bypass the shared panel primitive with local surface geometry');
assert.match(core,/\.review-collapse>summary \.review-section-title\{margin-bottom:0\}/,
  'Review disclosure titles share one alignment reset so Today’s Blocks and Unfinished Note align consistently');
assert.doesNotMatch(core,/\.review-unfinished>summary \.review-section-title\{margin-bottom:0\}/,
  'Review title alignment is not duplicated in the Unfinished Note specialization');
assert.match(core,/\.library-note-nav-item\.support-note\.active\{[^}]*border-left-color:var\(--sd-color-info\)[^}]*background:var\(--sd-state-info-bg\)/s,
  'selected Support Activities note uses the semantic cyan info state');
assert.match(core,/\.library-note-nav-item\.support-note\.active \.library-note-nav-name\{color:var\(--sd-color-info\)\}/,
  'selected Support Activities label is cyan');
assert.doesNotMatch(core,/\.library-note-nav-item\.support-note\.has-note/,
  'Support Activities is not permanently cyan when merely present');

assert.doesNotMatch(core,/\.attachment-grid\{[^}]*--sd-shape-control-radius/s,
  'attachment browser cannot borrow button geometry');
assert.doesNotMatch(core,/\.attachment-progress\{[^}]*--sd-shape-control-radius/s,
  'attachment progress cannot borrow button geometry');
assert.doesNotMatch(core,/\.reflection-workbench\{[^}]*(?:linear-gradient|--sd-color-surface-1)/s,
  'reflection workbench cannot own a hard-coded material');
assert.doesNotMatch(core,/\.library-notes-grid\{[^}]*(?:linear-gradient|--sd-color-surface-1)/s,
  'library notes/diary canvas cannot own a hard-coded material');

assert.match(glass,/--sd-shape-control-radius:11px/,'Glass controls use rounded-rectangle geometry');
assert.match(glass,/--sd-shape-chip-radius:999px/,'Glass chips retain pill geometry');
assert.match(glass,/--sd-shape-canvas-radius:8px/,'Glass content canvases use restrained geometry');
assert.match(glass,/--sd-shape-panel-radius:22px/,'Glass major panels use the major-surface geometry');
assert.match(core,/#cd\.paused\{opacity:var\(--sd-countdown-paused-content-opacity/,
  'paused Timer contrast is presentation-controlled');
assert.match(glass,/--sd-countdown-paused-content-opacity:\.68/,
  'Glass restores paused Timer legibility');
assert.doesNotMatch(glass,/html\[data-material="glass"\] \.library-notes-grid\{/,
  'Glass does not maintain a parallel Library canvas implementation');

// Shared notices use the coordinator's existing compact semantic in every presentation,
// while skin-specific surface geometry remains confined to Glass.
assert.match(foundation,/region\.dataset\['noticeCompact'\]=active&&active\.compact\?'true':'false'/,
  'notice renderer exposes the coordinator compact semantic to presentation CSS');
assert.match(foundation,/function noticeCanCompact\(message\s*\)\{[^}]*text\.length<=160/s,
  'short single-line safety/storage notices are classified compact without a second notice system');
assert.doesNotMatch(app,/kind:'(?:safety|storage)'[^}]*compact:false/,
  'safety/storage notices no longer force the wide notice geometry');
assert.match(core,/\.notice-region\[data-notice-compact="true"\]\{width:fit-content;max-width:min\(680px,calc\(100% - 28px\)\)\}/,
  'shared desktop notice geometry shrinks compact notices to their content');
assert.match(core,/@media \(max-width: 500px\)\{[\s\S]*?\.notice-region,\.notice-region\[data-notice-compact="true"\]\{width:calc\(100% - 20px\);max-width:none/s,
  'compact notices retain the existing near-full-width mobile geometry');
assert.match(glass,/html\[data-presentation="glass"\]\[data-shape="glass"\] \.execute-command-rail \.ctrl-block,[\s\S]*?\.progress-rail\{border-radius:var\(--sd-shape-card-radius\)\}/,
  'Glass rounds Timer command/progress cards through the Glass card token only');
assert.match(glass,/html\[data-presentation="glass"\]\[data-shape="glass"\] \.pwa-update-control,[\s\S]*?\.ownership-banner\{border-radius:var\(--sd-shape-floating-radius\)\}/,
  'Glass rounds direct floating notification surfaces through the Glass floating token only');
assert.doesNotMatch(core,/\.execute-command-rail \.ctrl-block\{[^}]*border-radius|\.progress-rail\{[^}]*border-radius|\.ownership-banner\{[^}]*border-radius|\.pwa-update-control\{[^}]*border-radius/s,
  'Director/core geometry remains free of Glass-specific radius overrides');
assert.match(glass,/html\[data-presentation="glass"\] #pane-execute \.execute-note-desk \.pnote-hdr\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) 26px[\s\S]*?html\[data-presentation="glass"\] #pane-execute \.execute-note-desk \.pnote-title\{[\s\S]*?font-size:var\(--sd-type-role-section-size\)[\s\S]*?letter-spacing:\.01em/s,
  'Glass notes header reserves the sync slot and restores Glass typography at every width');
assert.match(glass,/@media\(max-width:560px\)\{[\s\S]*?#pane-execute \.execute-note-desk \.pnote-title\{font-size:clamp\(1rem,5vw,var\(--sd-type-role-metric-size\)\)\}/s,
  'Glass narrows only the notes title size on small screens');
assert.match(glass,/html\[data-presentation="glass"\] \.focus-rhythm-title,[\s\S]*?\.backup-section-title,[\s\S]*?\.execute-overlay-kicker,[\s\S]*?\.interaction-eyebrow\{letter-spacing:var\(--sd-type-label-tracking\)\}/s,
  'Glass section and overlay labels consume the shared Glass tracking token');
assert.doesNotMatch(core,/pnote-title[^}]*clamp\(1rem,5vw|execute-note-desk \.pnote-hdr[^}]*grid-template-columns:minmax\(0,1fr\) 26px/s,
  'Director notes typography/layout is not changed by the Glass correction');

// Plan draft rows use one coherent control geometry rather than browser/intrinsic sizing.
assert.match(core,/\.plan-draft-fields\{[^}]*--plan-draft-control-height:36px[^}]*grid-template-columns:minmax\(180px,2fr\) repeat\(6,minmax\(88px,1fr\)\)[^}]*align-items:stretch/s,
  'wide fine-pointer Plan draft rows keep the established seven-field semantic grid and own their control-height token');
assert.match(core,/\.si-card\{[^}]*flex:1;min-width:0;/s,
  'schedule cards may shrink within the Plan pane instead of exporting child min-content overflow');
assert.match(core,/\.sched-list\{[^}]*padding-left:88px[^}]*\}[\s\S]*?\.sched-list::before\{[^}]*left:60px[^}]*width:2px[\s\S]*?\.si::before\{[\s\S]*?left:-20px[\s\S]*?\.si-time\{[^}]*left:-88px[^}]*width:54px/s,
  'desktop Plan timeline keeps modest separation between time labels, guide line and block markers');
assert.match(core,/\.plan-draft-field\{[^}]*width:100%[^}]*min-width:0[^}]*height:var\(--plan-draft-control-height\)[^}]*min-height:var\(--plan-draft-control-height\)[^}]*line-height:1\.2/s,
  'Plan draft field types share one explicit outer size contract');
assert.match(core,/@media \(any-pointer:coarse\) and \(min-width:721px\)\{[\s\S]*?#pane-plan \.plan-draft-field\{border:1px solid var\(--field-local-border,var\(--sd-line-neutral-control\)\)\}/s,
  'touch-capable tablet Plan fields use one visual field boundary even when the primary pointer is fine');
assert.match(core,/\.plan-draft-action\{[^}]*width:36px[^}]*height:36px[^}]*display:inline-flex[^}]*align-items:center[^}]*justify-content:center/s,
  'Plan row icon actions share the field-scale control geometry on pointer devices');
assert.match(core,/@media \(max-width: 1319px\)\{[\s\S]*?\.plan-draft-fields\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}[\s\S]*?\.plan-draft-field\.name\{grid-column:1 \/ -1\}/s,
  'generic medium-width Plan rows retain the conservative two-column fallback until a pointer-specific composition overrides it');
assert.match(core,/@media \(any-pointer:coarse\) and \(min-width:721px\)\{[\s\S]*?#pane-plan \.si\.draft \.plan-draft-fields\{[\s\S]*?--plan-draft-control-height:max\(var\(--_sd-touch-min,44px\),var\(--sd-density-touch-target,0px\)\);[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\);[\s\S]*?grid-template-areas:[\s\S]*?"name name name"[\s\S]*?"start dur kind"[\s\S]*?"area measure target"[\s\S]*?#pane-plan \.si\.draft \.si-right\{display:none\}/s,
  'touch-capable tablets use the available width as a three-column editor and enforce one touch-class control height');
assert.match(core,/@media \(hover:none\) and \(pointer:coarse\)\{[\s\S]*?#pane-plan \.plan-draft-fields\{--plan-draft-control-height:max\(var\(--_sd-touch-min,44px\),var\(--sd-density-touch-target,0px\)\)\}/s,
  'coarse-pointer Plan editors use one uniform touch-class control height at every responsive width');
assert.doesNotMatch(core,/@media \(hover:none\) and \(pointer:coarse\) and \(min-width: 901px\)\{[\s\S]*?#pane-plan \.si\.draft \.plan-draft-fields\{[\s\S]*?grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/s,
  'coarse-pointer tablets must not reintroduce the brittle four-column Plan override removed in L18I');
assert.match(core,/@supports \(-webkit-touch-callout:none\)\{[\s\S]*?@media \(min-width:721px\)[\s\S]*?#pane-plan input\.plan-draft-field\[type="time"\]\{[\s\S]*?-webkit-appearance:none;appearance:none;[\s\S]*?height:var\(--plan-draft-control-height\);min-height:var\(--plan-draft-control-height\);max-height:var\(--plan-draft-control-height\);[\s\S]*?::-webkit-date-and-time-value\{[\s\S]*?height:100%;min-height:0[\s\S]*?display:flex;align-items:center[\s\S]*?::-webkit-datetime-edit\{[\s\S]*?padding:0;line-height:1\.2/s,
  'iPadOS Plan start-time controls keep type=time but normalize the closed WebKit chrome to the same field height');
assert.match(core,/@media \(max-width: 560px\)\{[\s\S]*?#pane-plan \.si\.draft \.plan-draft-fields\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\);[\s\S]*?grid-template-areas:[\s\S]*?"name name"[\s\S]*?"start dur"[\s\S]*?"kind kind"[\s\S]*?"area area"[\s\S]*?"measure target"[\s\S]*?gap:9px 8px;[\s\S]*?#pane-plan \.si\.draft \.plan-draft-fields>\.start\{grid-area:start\}[\s\S]*?#pane-plan \.si\.draft \.plan-draft-fields>\.dur\{grid-area:dur\}[\s\S]*?#pane-plan \.si\.draft \.plan-draft-fields>\.measure\{grid-area:measure\}[\s\S]*?#pane-plan \.si\.draft \.plan-draft-fields>\.target\{grid-area:target\}/s,
  'Phone Plan rows explicitly pair Start/Duration and Measure/Target while Task, Kind and Area remain full width');

// Motion is part of the Presentation contract. Native View Transitions are
// reserved for synchronous appearance changes; asynchronous navigation and lazy
// feature surfaces stay snapshot-free so a slow load can never freeze or ghost.
for(const token of ['--sd-motion-workspace-open-duration','--sd-motion-workspace-close-duration','--sd-motion-workspace-ease','--sd-motion-feedback-duration','--sd-motion-feedback-ease','--sd-motion-anchored-transition']){
  assert.ok(app.includes(token),`presentation manifest exposes ${token}`);
  assert.ok(core.includes(token),`core presentation profile defines ${token}`);
}
for(const source of [foundation,insights,readRuntimeSource('source/core/navigation.ts'),fs.readFileSync('source/core/library.js','utf8'),fs.readFileSync('source/external/guide.js','utf8')]){
  assert.doesNotMatch(source,/startViewTransition|viewTransitionName|view-transition-name/,
    'navigation and lazy feature surfaces must not start snapshot transitions');
}
assert.equal((app.match(/startViewTransition\(/g)||[]).length,1,'the app starts native View Transitions from one appearance boundary only');
const appearanceChange=app.slice(app.indexOf('function runAppearanceChange'),app.indexOf('function renderThemeControls'));
assert.match(appearanceChange,/prefers-reduced-motion: reduce[\s\S]*?typeof document\.startViewTransition!=='function'[\s\S]*?document\.startViewTransition\(\(\)=>\{change\(\);\}\)/,
  'appearance transitions fall back to an immediate change under reduced motion or without the API, and only run a synchronous update');
const tabCommit=foundation.slice(foundation.indexOf('async function presentTabCommit'),foundation.indexOf('async function prepareTabDeparture'));
assert.doesNotMatch(tabCommit,/startViewTransition/,'primary tab presentation never waits behind a snapshot');
assert.doesNotMatch(app,/motion:\s*PRESENTATION_KERNEL\.motion|PRESENTATION_KERNEL\.motion/,
  'Presentation does not expose a snapshot-transition runtime API to plugins');
assert.ok(app.includes('present:presentTabCommit'),'navigation retains one presentation boundary for state/focus arbitration');
const tabPresentation=tabCommit;
assert.match(tabPresentation,/const result=await update\(\);/,
  'primary tab presentation commits directly on the live DOM');
assert.ok(insights.includes('ready:view.ready'),'lazy Insights exposes an explicit stable-shell navigation readiness hook');
assert.doesNotMatch(insights,/motion\.replace|presentation\?\.motion/,
  'Insights execution switching cannot reintroduce native snapshot transitions');
assert.match(core,/\.interaction-toast\{[^}]*var\(--sd-motion-feedback-duration\)[^}]*var\(--sd-motion-feedback-ease\)/s,
  'toast feedback timing is owned by the semantic Presentation motion contract');
assert.doesNotMatch(core,/\.interaction-toast\{[^}]*(?:\.15s|150ms)[^}]*\}/s,
  'toast feedback does not retain component-local timing literals');
assert.match(core,/:is\([^)]*\.pnote-info-popover[^)]*\.display-tools-menu[^)]*\.copy-report-menu[^)]*\.plan-field-popover[^)]*\.saved-plan-menu-popover[^)]*\.sd-rte-menu[^)]*\)\{transition:var\(--sd-motion-anchored-transition\);animation:none\}/s,
  'geometry-sensitive anchored menus/popovers remain explicitly immediate');
assert.doesNotMatch(readRuntimeSource('source/core/workspace-overlay.ts'),/presentation\.interrupt|interrupt.*snapshot/,
  'workspace overlays have no dead snapshot-interruption dependency');
assert.doesNotMatch(readRuntimeSource('source/core/interactions.ts'),/presentation.*interrupt|interrupt.*snapshot/,
  'interaction prompts have no dead snapshot-interruption dependency');
assert.doesNotMatch(fs.readFileSync('source/external/guide.js','utf8'),/replaceGuidePanel|motion\.replace|appearance\.presentation\.motion/,
  'Guide structural replacements update the live DOM directly');
assert.doesNotMatch(fs.readFileSync('source/core/library.js','utf8'),/transition\(\{oldElement|motion\.replace/,
  'Library saved-day replacement updates the live DOM directly');
assert.doesNotMatch(app,/FloatingTimer|documentPictureInPicture|minimise-timer|sd-floating-timer/,
  'retired manual/fallback floating-timer and Document PiP UI cannot re-enter the application shell');
assert.doesNotMatch(core,/sd-floating-timer|sd-floating-window/,
  'retired floating-timer presentation styles are fully removed');

// Lazy Insights must consume the same presentation primitives as the host app rather than
// recreating a parallel material/shape system inside its injected stylesheet.
for(const marker of [
  'insights-section-nav ui-inset',
  'insights-section-nav-btn ui-btn',
  'insights-execution-tabs ui-inset',
  'insights-execution-tab ui-btn',
  'insights-coach-evidence ui-inset',
  'insights-coach-evidence-item ui-canvas',
  'insights-definition-item ui-canvas',
  'insights-definition-strip ui-inset',
  'insights-fitness-context ui-inset',
  'insights-dynamics-supporting ui-inset',
  'insights-chart-widget ui-canvas'
]) assert.ok(insights.includes(marker),`Insights consumes shared presentation primitive: ${marker}`);
assert.match(insights,/\.insights-day-structure\{grid-template-columns:1fr\}/,
  'Insights collapses day structure before nested maintenance cards become quarter-width');
assert.match(insights,/\.insights-day-structure \.insights-section-title\{display:grid;gap:4px;align-items:start\}/,
  'Insights section title cannot squeeze its descriptive copy into a narrow horizontal column');
assert.doesNotMatch(glass,/\.insights-(?:section-nav|definition-item|practice|fitness|brain|chart)\b/,
  'Glass does not maintain a parallel Insights component implementation');
assert.doesNotMatch(insights,/border-radius:/,
  'Insights does not own generic component radius geometry outside the presentation system');
assert.match(insights,/\.insights-table\{[^}]*min-width:0[^}]*max-width:100%[^}]*overflow-x:auto[^}]*overscroll-behavior-x:contain/s,
  'Insights tables own bounded internal horizontal scrolling at every viewport width');
assert.match(insights,/\.insights-dossier-section\{[^}]*min-width:0[^}]*max-width:100%/s,
  'Analytics Lab sections cannot expand the page to satisfy table min-content width');
assert.match(insights,/\.insights-dynamics-lab\{[^}]*min-width:0[^}]*max-width:100%/s,
  'Analytics Lab shell participates in min-width containment at desktop widths');
assert.match(insights,/\.insights-dossier-grid\{[^}]*min-width:0[^}]*max-width:100%/s,
  'Analytics Lab dossier grid cannot propagate table min-content width to the page');
assert.match(insights,/\.insights-progressive-host\{[^}]*min-width:0[^}]*max-width:100%/s,
  'progressive Analytics Lab tables remain bounded inside their host');
assert.doesNotMatch(insights,/\.insights-dynamics-lab \.insights-table\{[^}]*overflow-x:auto/s,
  'Analytics Lab does not carry a breakpoint-specific duplicate table scrolling implementation');
assert.doesNotMatch(insights,/\.insights-table\{display:grid;max-width:100%;min-width:0\}/,
  'mobile Insights CSS does not duplicate base table containment declarations');
for(const match of insights.matchAll(/el\('button',\s*(['\"])(.*?)\1/g)){
  assert.match(match[2],/(?:^|\s)ui-btn(?:\s|$)/,`Insights button bypasses shared ui-btn primitive: ${match[2]}`);
}

// Every rich-text surface shares one toolbar contract: the formatting rail may scroll,
// the utility/focus group is a fixed sibling, and scrollability is visibly discoverable.
for(const text of [editorSource,editorBundle]){
  assert.ok(text.includes('sd-rte-toolbar-rail-shell'),'rich-text toolbar has a dedicated overflow shell');
  assert.ok(text.includes('sd-rte-toolbar-rail'),'rich-text formatting controls use a dedicated scroll rail');
  assert.ok(text.includes('sd-rte-toolbar-group-utility'),'rich-text focus control has a fixed utility group');
  assert.ok(text.includes('overflowLeft'),'rich-text toolbar tracks left overflow state');
  assert.ok(text.includes('overflowRight'),'rich-text toolbar tracks right overflow state');
  assert.ok(text.includes('sd-rte-toolbar-group-history'),'rich-text history controls use the compact shared group');
}
assert.match(editorSource,/toolbarRail\.append\([^)]*tableTools/,
  'table controls remain inside the intentional scrolling rail');
assert.match(editorSource,/toolbar\.appendChild\(utilityGroup\)/,
  'Focus Mode remains a sibling of the scrolling rail and therefore permanently reachable');
assert.match(editorSource,/toolbarRail\.scrollLeft=/,
  'table-context auto-reveal intentionally scrolls the formatting rail');
assert.ok(editorSource.includes('.workspace-overlay-rich-text .sd-rte-focus-body>.sd-rte .sd-rte-editor-host{grid-row:1;height:auto;min-height:0;align-self:stretch}'),
  'Focus Mode owns editor-host height with enough specificity to override normal per-surface sizing');
assert.ok(editorBundle.includes('.workspace-overlay-rich-text .sd-rte-focus-body>.sd-rte .sd-rte-editor-host{grid-row:1;height:auto;min-height:0;align-self:stretch}'),
  'generated rich-text bundle preserves the shared Focus Mode height override');


// Execute is the workspace/surface vocabulary; Timer remains reserved for genuine timing behavior.
const guideSource=fs.readFileSync('source/external/guide.js','utf8');
assert.match(guideSource,/GUIDE_ORDER=Object\.freeze\(\['plan','execute','review','library','insights'\]\)/,
  'Guide lifecycle uses Execute as the canonical workspace id');
assert.match(guideSource,/\s*execute:guideSection\(\{\s*label:"Execute"/,
  'Guide section registry exposes the Execute workspace under the Execute key');
assert.doesNotMatch(guideSource,/\s*timer:guideSection\(\{\s*label:"Execute"/,
  'Guide must not retain the historical Timer workspace key');
for(const stale of ['timer-state-overlay','timer-overlay-kicker','timer-overlay-title','timer-overlay-sub','timer-overlay-action','timer-open-plan','data-note-source="timer"','timerIdleDisplayKey','refreshTimerIdleDisplay','showTimerWaitingState','setTimerShellVisible','setTimerControlsEnabled','setTimerOverlay','clearTimerOverlay']){
  assert.ok(!app.includes(stale),`Execute surface must not retain historical ${stale} vocabulary`);
}
for(const stale of ['--sd-color-timer-','--sd-rgb-timer-','--timer-lime','--timer-blue','--timer-amber','--timer-red','--timer-text','--timer-danger']){
  assert.ok(!core.includes(stale)&&!glass.includes(stale),`Execute palette must not retain historical ${stale} tokens`);
}
console.log(JSON.stringify({status:'PASS',boundary:'presentation-surfaces',levels:['panel','inset','canvas'],glassGoverned:true,insightsGoverned:true,editorToolbarGoverned:true},null,2));
}


assert.doesNotMatch(readScript('source/core/timer-engine.ts'),/startCueDelayMs/,'start cue spacing must not rely on delayed callbacks');

{ // Production session/recovery boundaries retained across TS erasure.
const app=readScript('source/core/session-actions.ts'),review=readScript('source/core/review.ts'),background=readScript('source/core/repository-background.ts');
const sessionRestoreBlock=app.slice(app.indexOf('async function restoreSessionStateThroughLifecycle('),app.indexOf('async function verifyRestoredSessionRuntime',app.indexOf('async function restoreSessionStateThroughLifecycle(')));
assert.match(app,/async function restoreSessionStateThroughLifecycle\s*\(importedSession\s*,options\s*=\s*\{\s*\}\s*\)\s*\{\n\s*const session\s*=[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*const keepRunning\s*=options\s*\.keepRunning\s*=\s*=\s*=true&&/u,'Portable Active Session restore must use the lifecycle host without a Plan-draft transport parameter.');
assert.doesNotMatch(sessionRestoreBlock,/PlanData\s*\.writeDraft|enterDraft:true/u,'Active Session restore must not write or enter the independent Plan draft.');
assert.match(review,/async function saveDayRecord\s*\([^)]*\)[\s\S]{0,1600}captureTodayState\s*\(\s*\)[\s\S]{0,420}await flushLiveDraft\s*\(\s*\)[\s\S]{0,420}commitDailyRecord/u,'Save Today must flush Active Session Review state before committing the canonical DailyRecord.');
assert.match(background,/const PRIORITY\s*=freeze\s*\(\s*\{integrity:10,maintenance:20,convergence:30\s*\}\s*\)[\s\S]*scheduled\s*=new Map\s*\(\s*\),active\s*=new Map\s*\(\s*\)/u,'Repository integrity, maintenance and convergence must be explicitly tracked by the shared coordinator so foreground work can pre-empt them.');
assert.doesNotMatch(background,/const PRIORITY\s*=freeze\s*\(\s*\{[^}]*\bautomatic:/u,'The retired automatic background job must not return alongside convergence.');
assert.match(background,/function arm\s*\(entry\s*\)\s*\{[\s\S]*if\s*\(!entry\|\|foreground\|\|suspensions\s*\.size[\s\S]*function beginForeground[\s\S]*suspendTimers\s*\(\s*\)[\s\S]*release:[\s\S]*if\s*\(foreground\s*=\s*=\s*=row\s*\)foreground\s*=null;resolveRelease\?\s*\.\s*\(\s*\);resumeTimers\s*\(\s*\)/u,'Foreground ownership must keep queued repository maintenance disarmed until the foreground operation has fully released and its settlement barrier is resolved.');
}
