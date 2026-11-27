import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import {readHostHtml} from '../../../build/host-source.mjs';
import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {richTextRuntimeSource} from '../../helpers/rich-text-runtime.mjs';

const foundation=readRuntimeSource('source/core/foundation-host.ts');

{ // p5.6-document-editor-ownership
const host=readHostHtml();
const documentHost=readScript('source/core/document-host.ts');
const richHost=readScript('source/core/rich-text-host.ts');
const noteExport=readScript('source/core/note-export.ts');
assert.match(host,/INTERNAL_MODULES\.load\('note-export',1,'study-director\.note-export-module',2\)/,'note exporter must load the registry contract version it registers');
assert.match(host,/DocumentHostModule\.createPdfController/,'PDF host composition must use the checked document owner');
assert.match(host,/DocumentHostModule\.createPrinter/,'note print composition must use the checked document owner');
assert.match(host,/DocumentHostModule\.createIntegration/,'attachment/export integration must use the checked document owner');
assert.match(host,/RichTextHostModule\.createRuntime/,'rich editor lifetime must use the checked rich-text host owner');
for(const stale of ['function mutateBackupProtection(','async function refreshDeviceBackgroundPermission(','function openPdfWorkspace(','function openPdfFallback(','async function printNote(','async function insertAttachmentIntoNote(','const RichTextRuntime=(()=>'])assert.ok(!host.includes(stale),`host must not regain P5.6C implementation: ${stale}`);
assert.match(host,/richText:Object\.freeze\s*\(\{assetIds:value=>RichTextApi\.assetIds\(value\),exportDocument:value=>RichTextApi\.exportDocument\(value\)\}\)/,'actual note-export host provider uses exportDocument');
assert.match(documentHost,/function createPdfController/);assert.match(documentHost,/function createPrinter/);assert.match(documentHost,/function createIntegration/);
assert.match(richHost,/function createRuntime/);assert.match(noteExport,/function createExporter/);
assert.match(richHost,/const sameDocument=record\.bindingCurrent\(\)&&fieldRichRevision\(record\.field\)===record\.revision;/u,'a disposed rich editor may restore conflict state only while its original binding and revision still own the textarea');
assert.match(richHost,/JSON\.stringify\(\[fieldRichDocumentId\(field\),\.\.\.keys\.map\(key=>field\.dataset\[key\]\|\|''\)\]\)/u,'binding identity retains the original document and lifecycle/ownership identity');
assert.match(richHost,/bindingCurrent=\(\)=>field\.isConnected&&fieldBinding\(field\)===binding&&\(accepted\|\|pending\.get\(field\)===request\)/u,'editor publication is bound to the connected original field identity');
assert.match(richHost,/function closeField\(field[\s\S]{0,420}clearExternalConflict\(field\);return existed/u,'closing a rich editor clears its conflict marker synchronously before the textarea can be rebound');
assert.doesNotMatch(documentHost,/WG1:|Wordgard|indexedDB|dailyRecords/,'document owner orchestrates checked providers instead of duplicating rich-text/storage codecs or Saved-Day storage');
assert.doesNotMatch(noteExport,/dailyRecords|pendingReviews|activeSession/,'note export remains read-only and cannot mutate Saved-Day evidence');
}


{ // p5.13a-public-api-plugin-boundary
const host=readHostHtml(),owner=readScript('source/core/public-api-host.ts'),publicTypes=fs.readFileSync('types/public-api-host.ts','utf8');
assert.match(host,/const PublicApiHostModule=INTERNAL_MODULES\.load\('public-api-host',1,'study-director\.public-api-host-module',1\)/u,'P5.13a host loads the checked public API owner');
assert.match(host,/const PluginRuntime=PublicApiHostModule\.createRuntime\(Object\.freeze\s*\(\{/u,'optional-plugin runtime must cross the checked P5.13a boundary');
assert.match(host,/const StudyDirectorPublicAPI=PluginRuntime\.createPublicApi\(Object\.freeze\s*\(\{/u,'public capability construction must cross the checked P5.13a boundary');
assert.doesNotMatch(host,/const PluginRuntime=\(\(\)=>\{/u,'unchecked optional-plugin runtime must not remain in main');
assert.doesNotMatch(host,/const StudyDirectorPublicAPI=Object\.freeze\s*\(\{/u,'unchecked public API assembly must not remain in main');
for(const required of ['MAX_LOAD_ATTEMPTS=2','MAX_REGISTRATION_ATTEMPTS=2','function registerPlaceholders','function requestTab','function createPublicApi'])assert.ok(owner.includes(required),`checked public API owner is missing ${required}`);
assert.match(owner,/if\(activeTabId\(\)===tabId\)input\.tabs\.renderTab\(tabId\)/u,'optional plugin completion may rerender only its active tab');
assert.match(owner,/if\(unmet\.length\)[\s\S]{0,520}state:'incompatible'/u,'capability rejection happens before plugin setup');
assert.match(owner,/if\(previous\?\.state==='registered'\)\{[\s\S]{0,260}return true;/u,'successful plugin registration is idempotent while refreshing the optional-tab state');
assert.match(publicTypes,/readonly setup:\(api:StudyDirectorPublicApi\)=>unknown;/u,'plugin setup must use a strict function-property contract rather than a bivariant method signature');
assert.doesNotMatch(publicTypes,/\bsetup\(api:StudyDirectorPublicApi\)/u,'plugin setup must not regress to method bivariance');
for(const file of ['source/external/guide.ts','source/external/drive.ts','source/external/insights-runtime.ts'])
  assert.match(fs.readFileSync(file,'utf8'),/satisfies StudyDirectorPluginDescriptor/u,`${file} must compile against the canonical public plugin descriptor`);
const published=host.indexOf('HOST_WINDOW.StudyDirector=StudyDirectorPublicAPI;'),ready=host.indexOf('window.dispatchEvent(new CustomEvent(STUDY_DIRECTOR_READY_EVENT'),invalidate=host.indexOf("SessionLifecycle.invalidate('app-restart'"),startup=host.indexOf('StartupLifecycle.start();'),pwa=host.indexOf('void PwaRuntime.install();');
assert.ok(published>=0&&published<ready&&ready<invalidate&&invalidate<startup&&startup<pwa,'public API publication and ready event must remain before lifecycle startup and PWA install');
assert.match(owner,/function normalizePluginDescriptor\(value\s*\)/u,'emitted public plugin entry validates untrusted descriptors before setup');
assert.match(owner,/typeof minimum!==['"]number['"][\s\S]{0,120}!Number\.isFinite\(minimum\)[\s\S]{0,120}minimum<0/u,'public plugin capability requirements fail closed on malformed values');
assert.match(owner,/Object\.hasOwn\(input\.configuration\.capabilities,key\)/u,'plugin capability lookup must not inherit Object.prototype entries');
assert.match(owner,/try\{plugin=normalizePluginDescriptor\(value\);\}catch\{return false;\}/u,'descriptor parsing failures must remain contained at the public API boundary');
assert.match(owner,/Reflect\.apply\(plugin\.setup,plugin\.source,\[publicApi\]\)/u,'valid plugin setup must preserve the original descriptor as its method receiver');
assert.match(owner,/Object\.fromEntries\(requirementEntries\)/u,'untrusted capability dictionaries must be materialized without __proto__ setter semantics');
assert.match(owner,/function status\(\)\s*\{return freeze\(\{/u,'public plugin status must publish a frozen snapshot');
}

{ // p5.13b-host-dispatch-and-build-token-closure
const template=fs.readFileSync('source/app.html','utf8'),hostSource=fs.readFileSync('source/host/main.ts','utf8'),buildSource=fs.readFileSync('build/build.mjs','utf8');
const dispatchMaps=[
  ['data-action','CLICK_ACTIONS','CHANGE_ACTIONS'],
  ['data-change','CHANGE_ACTIONS','INPUT_ACTIONS'],
  ['data-input','INPUT_ACTIONS','BLUR_ACTIONS'],
  ['data-blur','BLUR_ACTIONS','KEYDOWN_ACTIONS'],
  ['data-keydown','KEYDOWN_ACTIONS','OWNER_REQUIRED_CLICK_ACTIONS']
];
const handlersByAttribute=new Map();
for(const [attribute,mapName,nextName] of dispatchMaps){
  const start=hostSource.indexOf('const '+mapName+':'),end=hostSource.indexOf('const '+nextName,start+1);
  assert.ok(start>=0&&end>start,mapName+' typed dispatch map must remain in the strict host');
  const handlers=new Set([...hostSource.slice(start,end).matchAll(/^\s*'([^']+)'\s*:/gmu)].map(row=>row[1]));
  handlersByAttribute.set(attribute,handlers);
  const authored=[...new Set([...template.matchAll(new RegExp(attribute+'="([^"]+)"','gu'))].map(row=>row[1]))];
  for(const action of authored)assert.ok(handlers.has(action),attribute+'="'+action+'" must have a typed delegated host handler');
}
const browserConfig=JSON.parse(fs.readFileSync('tsconfig.browser.json','utf8'));
const checkedBrowserSources=browserConfig.files.filter(file=>/^source\/.*\.ts$/u.test(file));
const dynamicBindings=[];
for(const file of checkedBrowserSources){
  const source=fs.readFileSync(file,'utf8');
  const patterns=[
    {regex:/data-(action|change|input|blur|keydown)=["']([^"']+)["']/gu,read:match=>['data-'+match[1],match[2]]},
    {regex:/setAttribute\(\s*["']data-(action|change|input|blur|keydown)["']\s*,\s*["']([^"']+)["']\s*\)/gu,read:match=>['data-'+match[1],match[2]]},
    {regex:/dataset(?:\[['"](action|change|input|blur|keydown)['"]\]|\.(action|change|input|blur|keydown))\s*=\s*["']([^"']+)["']/gu,read:match=>['data-'+(match[1]||match[2]),match[3]]}
  ];
  for(const {regex,read} of patterns)for(const match of source.matchAll(regex)){
    const [attribute,action]=read(match);dynamicBindings.push({file,attribute,action});
    assert.ok(handlersByAttribute.get(attribute)?.has(action),`${file}: dynamic ${attribute}="${action}" must have a typed delegated host handler`);
  }
}
assert.ok(dynamicBindings.some(row=>row.action==='sync-status-action')&&dynamicBindings.some(row=>row.action==='open-library-day')&&dynamicBindings.some(row=>row.action==='set-presentation'),'dynamic delegated-action scan must exercise checked feature-created controls');
assert.match(hostSource,/type DelegatedHostInput=Parameters<typeof FoundationHostModule\.createDelegated>\[0\];/u,'delegated handler maps must derive from the checked host contract');
assert.doesNotMatch(hostSource,/function registerStudyDirectorPlugin\(/u,'dead public-plugin registration wrappers must not remain in the final host');
assert.match(hostSource,/if\(!PluginRuntime\.registerPlaceholders\(\)\)throw new Error\('Study Director optional plugin tabs could not be registered\.'\);/u,'host startup must fail explicitly if required optional-tab placeholders cannot register');
const ownerClickStart=hostSource.indexOf('const OWNER_REQUIRED_CLICK_ACTIONS'),ownerClickEnd=hostSource.indexOf('const OWNER_REQUIRED_CHANGE_ACTIONS',ownerClickStart+1);
assert.ok(ownerClickStart>=0&&ownerClickEnd>ownerClickStart,'final host owner-required click projection must remain explicit');
const ownerClickActions=new Set([...hostSource.slice(ownerClickStart,ownerClickEnd).matchAll(/['"]([^'"]+)['"]/gu)].map(row=>row[1]));
for(const action of ['backup-protection','remove-managed-version','review-kept-versions','rename-profile','recheck-device-integrity','recheck-drive-integrity'])assert.ok(ownerClickActions.has(action),`owner-only action ${action} must remain inside the final host ownership projection`);
const syncStatusOwner=readScript('source/core/sync-status-host.ts');
assert.match(syncStatusOwner,/OWNER_REQUIRED_ACTIONS=freeze\(new Set\(\['sync-now','retry','sign-in','enter-password','unlock-sync','review-sync','review-kept','device-permission','continue-session'\]\)\)/u,'multiplexed sync-status actions must classify their mutating variants explicitly');
assert.match(syncStatusOwner,/if\(ownerRequired\(kind\)&&!input\.canMutate\(\)\)return false/u,'sync-status owner must fail closed before mutating routes reach providers or recovery');
assert.match(syncStatusOwner,/toggleAttribute\('data-owner-mutation',ownerRequired\(kind\)\)/u,'sync-status owner must project mutating variants into the secondary-tab UI fence');
assert.match(syncStatusOwner,/button\.dataset\['syncAction'\]=item\.action;markOwnerRequirement\(button,item\.action\)/u,'status-list mutation buttons must join the same secondary-tab UI fence as primary and connect-card actions');
assert.match(readScript('source/core/backup-provider.ts'),/runExclusive\('remove-backup-version',authority=>removeProviderVersionUnderAuthority\(selected,checkpointId,\{signal:foreground\.signal,assertCurrent:\(\)=>\{assertRequest\(\);authority\.assert\(\);\}\}\)\)/u,'managed-version deletion must enter the authority-only helper through the canonical durable mutation lease');
for(const token of ['PRODUCTION_LIMITS','LOCAL_STORAGE_KEYS','DEVICE_WIDE_LOCAL_STORAGE_KEYS','SESSION_STORAGE_KEYS','APP_META_KEYS','APP_META_REGISTRY','RUNTIME_DATA_CONTRACT','INDEXED_DB_STORE_NAMES','EXTERNAL_REPOSITORY_IDENTITIES']){
  assert.ok(hostSource.includes('@@SD_'+token+'_URI@@'),token+' host input must use a TypeScript-readable encoded token');
  assert.ok(buildSource.includes("encodeURIComponent(JSON.stringify("), 'build renderer must encode structured host tokens from authoritative contracts');
}
assert.doesNotMatch(hostSource,/decodeBuildJson\('@@SD_(?:PRODUCTION_LIMITS|SESSION_STORAGE_KEYS|APP_META_KEYS|APP_META_REGISTRY|RUNTIME_DATA_CONTRACT|INDEXED_DB_STORE_NAMES|EXTERNAL_REPOSITORY_IDENTITIES)@@/u,'strict host must not regress to bare structured build-token expressions');
}

{ // p5.7a-backup-actions-host-boundary
const host=readHostHtml(),owner=readScript('source/core/backup-actions-host.ts'),ownerTypes=fs.readFileSync('types/backup-actions-host.ts','utf8'),deviceTypes=fs.readFileSync('types/device-backup.ts','utf8');
assert.match(host,/const BackupActionsHostModule=INTERNAL_MODULES\.load\('backup-actions-host',1,'study-director\.backup-actions-host-module',1\)/u,'P5.7A host loads the checked backup-actions owner');
assert.match(host,/BackupProtectionStorage=BackupActionsHostModule\.createProtectionStorage\(Object\.freeze\s*\(\{/u,'backup protection metadata mutation crosses the checked P5.7A boundary');
assert.match(host,/BackupProtectionHost=BackupActionsHostModule\.createProtectionHost\(Object\.freeze\s*\(\{/u,'backup protection crosses the checked P5.7A boundary');
assert.match(host,/BackupActions=BackupActionsHostModule\.createControls\(Object\.freeze\s*\(\{/u,'file and location controls cross the checked P5.7A boundary');
assert.match(host,/DeviceBackupHooks=BackupActionsHostModule\.createDeviceHooks\(Object\.freeze\s*\(\{/u,'Device Folder repository-choice and owner callbacks cross the checked P5.7A boundary');
assert.match(host,/DeviceBackup=BackupActionsHostModule\.createDeviceBackup\(Object\.freeze\s*\(\{/u,'Device Folder composition crosses the checked P5.7A boundary');
assert.match(host,/DeviceBackupActivation=BackupActionsHostModule\.createDeviceActivation\(Object\.freeze\s*\(\{/u,'Device Folder permission refresh policy crosses the checked P5.7A boundary');
for(const stale of ['let fileBackupRowReady=false;','const BackupProtection=ExportsModule.createProtection(','DeviceBackup=DeviceBackupModule.createController(','async function backUpEverywhere(){']){
  assert.equal(host.includes(stale),false,`main host must not retain extracted P5.7A owner: ${stale}`);
}
assert.match(owner,/controller\.subscribeStatus\(\(\)=>\{renderFile\(\);syncFileHold\(\);\}\)/u,'standalone file work keeps background-location exclusion behind the checked owner');
const filePicker=owner.slice(owner.indexOf('async function pickImportFile('),owner.indexOf('const cancelStandalone='));
assert.match(filePicker,/assertOrigin=input\.captureActionAuthority\('import a backup'\)/u,'file picker captures original ownership before presenting the native dialog');
const nativeOpen=filePicker.indexOf('await processing.open(');
assert.ok(nativeOpen>0&&!/\bawait\b/.test(filePicker.slice(0,nativeOpen)),'native file-open entry remains synchronous at the checked host boundary');
assert.match(filePicker,/processing\.open\(\{click:\(\)=>\{if\(stillCurrent\(\)\)\{fallback=freeze\(\{node:inputNode,assertOrigin\}\);inputNode\.click\(\);/u,'fallback selection carries its original authority before opening the input');
assert.match(host,/captureActionAuthority:reason=>\{[^\n]*AppOwnership\.issueWriteToken\(reason\);return \(\)=>AppOwnership\.assertWriteToken\(token,reason\)/u,'actual host captures and checks the same write token');
assert.match(owner,/protection\.ask\(\)/u,'locked backup flows retain password prompting');
assert.match(ownerTypes,/readonly environment:DeviceBackupInput\['environment'\]/u,'Device Folder composition consumes the actual checked environment contract');
assert.match(deviceTypes,/showDirectoryPicker:\(\(options:[^\n]+\)\|undefined/u,'the actual Device Backup environment contract represents folder-picker capability explicitly');
assert.match(host,/showDirectoryPicker:typeof Reflect\.get\(window,'showDirectoryPicker'\)==='function'\?async options=>await Reflect\.apply\(Reflect\.get\(window,'showDirectoryPicker'\)[\s\S]{0,420}:undefined/u,'unsupported folder picking uses the typed undefined capability rather than a null sentinel');
assert.match(host,/'export-backup': \(\)=>BackupActions\.exportLocal\(\)/u,'file export caller uses the checked P5.7A entry point');
assert.match(host,/'import-backup': ev=>BackupActions\.importLocal\(ev\)/u,'file import caller uses the checked P5.7A entry point');
console.log(JSON.stringify({status:'PASS',boundary:'p5.7a-backup-actions-host',protection:true,fileEntries:true,deviceComposition:true,foregroundExclusion:true},null,2));
}


{ // p5.7b-reconciliation-and-recovery-owner
const host=readHostHtml(),recovery=readScript('source/core/backup-recovery-host.ts'),reconciliationUi=readScript('source/core/reconciliation-ui.ts'),backup=readScript('source/core/backup.ts');
assert.match(host,/const ReconciliationUIModule=INTERNAL_MODULES\.load\('reconciliation-ui',1,'study-director\.reconciliation-ui-module',1\)/u,'P5.7B reconciliation UI crosses the checked private-module boundary');
assert.match(host,/KeptVersionsView=BackupRecoveryHostModule\.createKeptVersionsView\(Object\.freeze\s*\(\{/u,'Kept Versions banner presentation crosses the checked recovery owner');
assert.match(host,/KeptVersions=BackupRecoveryHostModule\.createKeptVersions\(Object\.freeze\s*\(\{/u,'Kept Versions state is composed through the checked recovery owner');
assert.doesNotMatch(host,/const KeptVersions=\(\(\)=>\{/u,'the untyped host Kept Versions owner is retired');
assert.match(recovery,/function createKeptVersions\(/u,'the recovery host owns kept-version refresh and review');
assert.match(recovery,/resolveConvergedKeptVersions\(\)/u,'verified convergence remains the only automatic kept-version resolution');
assert.match(recovery,/async function settleRecoveryState\(/u,'restore quiescence stays in the checked recovery owner');
assert.match(recovery,/await input\.lifecycle\.flushPlanDraft\(\)/u,'Plan draft is flushed before managed recovery');
assert.match(recovery,/await input\.lifecycle\.canonicalPlanDraft\(\)/u,'visible Plan draft receives a canonical read-back fence before recovery');
assert.match(recovery,/await input\.lifecycle\.settlePlan\(\)/u,'Plan persistence quiescence remains explicit before recovery');
assert.match(recovery,/input\.noteReconciliation\.maintenancePause\.run\(\(\)=>input\.noteReconciliation\.controller\.resolve\(options\)\)/u,'note reconciliation remains read-only with attachment maintenance paused inside the checked Backup runtime owner');
assert.match(recovery,/reconcileNotes:\(importedNotes,deletions=\[\]\)=>input\.recoveryNotes\.lifecycle\.run\('reconciled-notes',[\s\S]*allowDuringRecoveryQuiescence:true/u,'note reconciliation lifecycle semantics live in the checked Backup runtime owner');
assert.match(recovery,/restoreNotesSnapshot:snapshotNotes=>input\.recoveryNotes\.lifecycle\.run\('restored-notes-snapshot',[\s\S]*allowDuringRecoveryQuiescence:true/u,'exact note-snapshot restoration lifecycle semantics live in the checked Backup runtime owner');
assert.doesNotMatch(reconciliationUi,/\bAppData\b|IndexedDb|localStorage|notes\.replace|dailyRecords/u,'scratch reconciliation cannot acquire a canonical persistence path');
const restoreAttemptAt=backup.indexOf('async function restoreBackupAttemptWithOperation'),reconciliationAt=backup.indexOf('noteResult=await NoteReconciliation.resolve',restoreAttemptAt),mutationAt=backup.indexOf('return runRestoreMutation(',reconciliationAt);
const safetyAt=backup.indexOf('captureLocalSafetyCopy(stored',mutationAt),journalAt=backup.indexOf('prepareRestoreJournal({id:restoreId',safetyAt),verificationAt=backup.indexOf('verifyRestoreCommit(expectedCommit',journalAt),journalClearAt=backup.indexOf('retireRestoreJournal(restoreId)',verificationAt);
assert.ok(reconciliationAt>0&&mutationAt>reconciliationAt,'user reconciliation must finish before the managed canonical mutation boundary');
assert.ok(safetyAt>mutationAt&&journalAt>safetyAt,'verified local safety capture must precede restore-journal preparation and canonical writes');
assert.ok(verificationAt>journalAt&&journalClearAt>verificationAt,'restore journal cannot clear before canonical read-back verification succeeds');
assert.match(backup,/async function prepareRestoreJournal[\s\S]*?await AppData\.restoreJournal\.prepare\(value\)/u,'prepared journal wrapper uses the actual repository port');
assert.match(backup,/async function retireRestoreJournal[\s\S]*?assertAuthority\(options\);[\s\S]*?await AppData\.restoreJournal\.clear\(id,options\)/u,'retirement wrapper uses the fenced repository port');
assert.match(backup,/rollbackImportedState\(rollbackJournal,rollbackDeletionState\)/u,'failed post-side-effect restore retains the verified rollback path');
assert.match(backup,/resolvedAssetReferenceIds\(resolvedPlan,signal/u,'attachment publication is derived from the resolved reconciliation plan');
assert.match(backup,/applyResolvedActiveSession\(resolvedPlan,\{clear:clearSession,keepRunning:sync&&session==='graft'\}\)/u,'Active Session reconciliation remains delegated to the checked restore path');
for(const action of ['refresh-version-history','close-version-history','cancel-version-history-operation','recover-managed-version','compare-managed-note','remove-managed-version'])
  assert.match(host,new RegExp(`'${action}': [^\\n]*BackupRecoveryHost\\.history`,'u'),`${action} stays behind the checked history owner`);
console.log(JSON.stringify({status:'PASS',boundary:'p5.7b-reconciliation-recovery',checkedReconciliation:true,checkedKeptVersions:true,independentPlanDraft:true,historyActions:true},null,2));
}

{ // p5.7-parent-source-ownership-closure
const host=readHostHtml(),readiness=readScript('source/core/backup-readiness-host.ts'),recovery=readScript('source/core/backup-recovery-host.ts');
assert.match(host,/BackupReadinessHostModule\.createVerifiedRecovery\(Object\.freeze\s*\(\{/u,'verified backup readiness crosses the checked owner');
assert.match(host,/BackupReadinessHostModule\.createBackupNudge\(Object\.freeze\s*\(\{/u,'backup readiness reminder policy crosses the checked owner');
assert.match(host,/BackupRecoveryHostModule\.createRuntime\(Object\.freeze\s*\(\{/u,'the production Backup runtime adapters cross the checked owner');
assert.match(host,/BackupRecoveryHostModule\.createStorageReset\(Object\.freeze\s*\(\{/u,'browser-data-clear recovery crosses the checked owner');
assert.match(host,/BackupRecoveryHostModule\.createRetainedBackupFiles\(Object\.freeze\s*\(\{/u,'recovery scratch retention crosses the checked owner');
assert.match(readiness,/function createVerifiedRecovery\(/u);assert.match(readiness,/function createBackupNudge\(/u);assert.match(recovery,/function createMaintenancePause\(/u);assert.match(recovery,/function createRevisionFence\(/u);assert.match(recovery,/function createRuntime\s*\(/u);assert.match(recovery,/function createStorageReset\(/u);assert.match(recovery,/function createRetainedBackupFiles\(/u);
for(const stale of [
  'const VERIFIED_RECOVERY_META_KEY=','function recordBackupCopy(','function readVerifiedRecoveryState(','async function reconcileChangeClock(','async function maybePromptBackupNudge(','backupNudgeMessage','backupNudgeCheckedAt','backupNudgeNotifiedDate',
  'const STORAGE_RESET_RETRY_MS=','function beginStorageResetHold(','function restoreMissingAfterStorageReset(','function noteDatabaseRemovedWhileClosed(',
  'async function importBackupAttachments(','function currentBackupSourceRevision(','async function fullBackupSnapshotRevision(','async function backupSnapshotRevision(',
  'const BackupRuntime=BackupModule.createRuntime(','async function quiesceManagedRecoveryRuntime(','managedRecoverySessionQuiescenceDepth','managedRecoveryTimerFrozenSinceMs','function pwaRecoveryReadBackIssue(','function renderKeptVersions(','async function retainedBackupFileNames(','async function withRichTextAssetMaintenancePaused(','async function reconcileNotesThroughLifecycle(','async function restoreNotesSnapshotThroughLifecycle('
])assert.equal(host.includes(stale),false,`main host must not regain substantive P5.7 ownership: ${stale}`);
assert.match(host,/function canonicalLocalRecoveryEmpty\(\)\{return StorageResetRecovery\?StorageResetRecovery\.canonicalEmpty\(\):Promise\.resolve\(null\);\}/u,'remaining storage-reset helper is a thin deferred forwarder');
assert.match(host,/function handleCanonicalCommit\(event\s*\)\{return CanonicalCommitHost\.handle\(event\);\}/u,'canonical commit remains a thin checked forwarder');
assert.match(host,/RecoveryAssetMaintenancePause=BackupRecoveryHostModule\.createMaintenancePause|const RecoveryAssetMaintenancePause=BackupRecoveryHostModule\.createMaintenancePause/u,'attachment-maintenance recovery coordination crosses the checked owner');
assert.match(host,/ManagedRecoveryQuiescence=BackupRecoveryHostModule\.createQuiescence\(Object\.freeze\s*\(\{/u,'timer/rich-text recovery quiescence crosses the checked owner');
console.log(JSON.stringify({status:'PASS',boundary:'p5.7-parent-source-ownership',verifiedRecovery:true,storageReset:true,runtimeAdapters:true,scratchRetention:true,noSubstantiveHostRemainder:true},null,2));
}


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
const libraryClear=readScript('source/core/library-clear.ts');
const mutation=readScript('source/core/mutation-coordinator.ts');

function section(source,start,end){
  const from=source.indexOf(start),to=source.indexOf(end,from+start.length);
  assert.ok(from>=0&&to>from,`Missing architecture section: ${start}`);
  return source.slice(from,to);
}

assert.match(host,/const DecisionClock=Object\.freeze\s*\(\{nowMs:\(\)=>Date\.now\(\)\}\);/,'DecisionClock is a nowMs-only capability');
assert.doesNotMatch(host,/DecisionClock\.nowIso\b/,'DecisionClock must not grow informational timestamp helpers');
assert.match(host,/document,window,now:DecisionClock\.nowMs,randomIdPart,/,'App ownership decisions use the shared DecisionClock');

assert.match(timer,/clock:freeze\(\['nowMs'\]\)/,'Timer engine clock contract is nowMs-only');
assert.match(timer,/function nowIso\(\)\{return new Date\(\)\.toISOString\(\);\}/,'Timer informational timestamps remain ambient wall clock');
assert.doesNotMatch(timer,/clockNowIso|ports\.clock\.nowIso/,'Timer engine must not obtain ISO timestamps from DecisionClock');

assert.doesNotMatch(attachments+libraryClear,/\bp\.clock\b|\bclock\.nowIso\b|DecisionClock|Attachment reference clock/,'Attachment reference rollback must not depend on DecisionClock');
assert.match(libraryClear,/const nowIso=typeof ports\.nowIso==='function'\?ports\.nowIso:\(\)=>new Date\(\)\.toISOString\(\);/,'The reference rewrite owner defaults to ordinary wall-clock metadata');
assert.match(section(host,'const LibraryClearState=LibraryClearModule.createState','const validateAttachmentInsertionValue='),/nowIso:\(\)=>new Date\(\)\.toISOString\(\)/,'The actual Library reference timestamp provider is ordinary wall-clock metadata');
assert.match(libraryClear,/revision:data\.activeSession\.nextRevision\(\),updatedAt:nowIso\(\)/,'Session reference rollback stamps from the wall-clock provider');

assert.match(host,/MutationCoordinatorModule\.createCoordinator\(Object\.freeze\s*\(\{[\s\S]*now:DecisionClock\.nowMs/u,'the extracted mutation coordinator receives the shared DecisionClock as its lease-decision clock');
assert.match(mutation,/const nowMs=\(\)=>\{const value=Number\(input\.environment\.now\(\)\)/u,'mutation lease decisions use the injected decision clock');
assert.match(mutation,/Number\(value\.expiresAt\)>nowMs\(\)/,'foreign mutation-lease expiry uses the injected decision clock');
assert.match(mutation,/const expiresAt=nowMs\(\)\+LEASE_MS;[\s\S]*?input\.durable\.acquire\(\{kind:state\.kind,id:state\.id,owner:state\.owner,expiresAt/u,'one injected-clock expiry is proposed to durable acquisition and renewal');
assert.match(mutation,/value=\{version:1,tabId,pageId,claimId,kind:state\.kind,id:state\.id,expiresAt:state\.expiresAt\}/u,'local mirror uses the acknowledged durable expiry, not a later fresh TTL');
assert.match(mutation,/state\.expiresAt=proof\.expiresAt;writeLease\(state\)/u,'initial acquisition mirrors the durable proof');
assert.match(mutation,/async function refreshAuthority[\s\S]*?state\.expiresAt=proof\.expiresAt;[\s\S]*?writeLease\(state\)/u,'renewal mirrors the renewed durable proof');
assert.match(mutation,/Number\(proof\.result\.holder\?\.expiresAt\)-nowMs\(\)\+50/,'recovery lease wait uses the injected decision clock');
assert.match(mutation,/id:`mutation_\$\{nowMs\(\)\.toString\(36\)\}_[^`]+\$\{\(\+\+sequence\)\.toString\(36\)\}`/,'mutation identifiers use the same injected decision clock and a per-controller sequence');
assert.doesNotMatch(mutation,/startedAt:/,'the unused private mutation start timestamp is retired rather than used for lease decisions');

assert.doesNotMatch(host,/PracticePacer\.pauseFromMain\(PRACTICE_PAUSE_CAUSES\.MAIN\s*,\s*Date\.now\(\)\)/,'host Pacer bridges must not bypass the injected Pacer clock');
assert.equal(((host+execution+executionViews).match(/PracticePacer\.pauseFromMain\(PRACTICE_PAUSE_CAUSES\.MAIN\);/g)||[]).length,2,'both host Pacer pause bridges defer to the Pacer clock');

const runtimePayload=section(execution,'function timerRuntimePayload(', 'function validateTimerRestoreCandidate(');
assert.doesNotMatch(runtimePayload,/Date\.now\(\)/,'persisted timer runtime arithmetic uses DecisionClock');
assert.match(runtimePayload,/DecisionClock\.nowMs\(\)/,'timer runtime captures decision time from DecisionClock');

assert.match(host,/SessionHostModule\.createController\(Object\.freeze\s*\(\{/u,'canonical Active Session composition crosses the checked session host');
const executionComposition=section(host,'const ExecutionRuntime=ExecutionHostModule.createRuntime(Object.freeze','const {\n  TimerState,SessionState');
const hostReviewPort=section(executionComposition,'reviewEvidence:Object.freeze','}),\n    clockEnvironment');
assert.doesNotMatch(hostReviewPort,/buildRealTimeSnapshot|exactTaskCompletionPercent|liveTaskOutcome|resolveTaskCompletion|setTaskDoneState|setTaskSkippedState/u,'execution host must not self-reference runtime exports before ExecutionRuntime is initialized');
assert.match(sessionHost,/strictDurability:true/u,'critical local session transitions require strict repository durability');
assert.doesNotMatch(sessionHost,/Date\.now\(\)/,'session-host decisions use injected clocks rather than ambient Date.now');
assert.match(sessionHost,/clock\.nowMs\(\)/u,'live-draft debounce and timer snapshot cadence use the injected decision clock');
assert.match(sessionHost,/persistence\.recoveryWorkActive\(\)/u,'timer snapshots remain quiesced while managed recovery owns the mutation lane');
for(const token of ['claimSessionOwnership','continueSessionHere','BackupProviderRuntime','sessionHandoff']){
  assert.equal(sessionHost.includes(token),false,`P5.4B session host must not absorb P5.4C distributed ownership: ${token}`);
}
assert.match(host,/SessionHandoffModule\.createController\(Object\.freeze\s*\(\{/u,'distributed session ownership crosses the checked P5.4C handoff boundary');
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
assert.match(finishTransition,/ActiveSessionRuntime\.finishLocal\(\(\)=>\{/u,'finish delegates the complete transition to the checked local-session owner');
const transitionOwner=section(sessionHost,'async function runLocalTransition', 'async function writeNow(');
assert.match(transitionOwner,/rollback=persistence\.snapshotForWrite\(\)[\s\S]*await operation\(transition\)[\s\S]*rollbackLocalTransition\(transition,/u,'local owner captures recoverable evidence before mutation and owns compensation');
const finishOwner=section(sessionHost,'async function finishLocal(', 'async function restoreSuspendedLocal(');
assert.match(finishOwner,/runLocalTransition\('session-finish'[\s\S]*prepare\(\)[\s\S]*saveCanonicalSession\(session,'finishing today’s session',\{expectedCanonical:transition\.before\}/u,'finish strictly saves against the original canonical record');
const rollbackOwner=section(sessionHost,'async function rollbackLocalTransition(', 'async function runLocalTransition');
assert.match(rollbackOwner,/canonical\.same\(latest,before\)[\s\S]*canonical\.same\(latest,attempted\)[\s\S]*expectedCanonical:latest[\s\S]*applyStoredSession\(intended,intended\.snapshot/u,'rollback fences the canonical successor before any runtime reprojection');
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
assert.match(host,/ExecutionHostModule\.createRuntime\(Object\.freeze\s*\(\{/u,'live execution composition crosses the checked execution host');
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
assert.doesNotMatch(plan,/scheduleGateway\.breakState\('end'\)/u,'Plan confirmation does not terminate a break before the checked gateway admits it');
assert.match(executionHost,/const beforeStart=\(\)=>\{[\s\S]*?if\(activeBreak!==null&&breakState\('end'\)!==true\)return false;[\s\S]*?\{current:opts.current\|\|\(\(\)=>true\),beforeStart,cancelled:false\}/u,'the checked admission propagates failed break termination instead of claiming a successful replacement');
assert.doesNotMatch(review,/function setCompletionState\(/u,'Review must consume the checked completion-state owner instead of maintaining a duplicate mutator');
assert.match(review,/resolveTaskCompletion,storeResolvedCompletion,setCompletionState,syncProgressInputsToState/u,'Review completion editing consumes the checked execution evidence port');
const reviewHost=readScript('source/core/review-host.ts');
assert.match(host,/const ReviewHostModule=INTERNAL_MODULES\.load\('review-host',1,'study-director\.review-host-module',1\);/u,'Review composition loads the checked P5.5A host owner');
assert.match(host,/const ReviewSubsystem=ReviewHostModule\.createSubsystem\(Object\.freeze\s*\(\{[\s\S]*?module:ReviewModule,[\s\S]*?subsystem:Object\.freeze\s*\(\{/u,'Review subsystem composition crosses the checked P5.5A host boundary');
assert.doesNotMatch(host,/ReviewModule\.createReviewSubsystem\(/u,'the main host must not bypass the checked Review host boundary');
assert.match(reviewHost,/input\.module\.format!=='study-director\.review'[\s\S]*input\.module\.contractVersion!==1/u,'Review host rejects an incompatible feature module');
assert.match(reviewHost,/!Object\.isFrozen\(input\.subsystem\)/u,'Review host rejects mutable provider composition');
assert.match(reviewHost,/!Object\.isFrozen\(subsystem\)[\s\S]*subsystem\.format!=='study-director\.review-subsystem'[\s\S]*subsystem\.contractVersion!==1/u,'Review host validates the composed subsystem before publication');
assert.match(review,/qualityFields\.some\(field=>[\s\S]{0,420}reviewOwnershipRevision[\s\S]{0,240}getOwnershipRevision\(\)[\s\S]{0,240}reviewLifecycleRevision/u,'quality controls are fenced by both ownership and lifecycle revisions before Review persistence');
const reviewPersistence=readScript('source/core/review-persistence.ts'),repositories=readScript('source/core/repositories.ts'),library=readScript('source/core/library.ts');
assert.match(host,/const ReviewPersistence=ReviewPersistenceModule\.createPersistence\(Object\.freeze\s*\(\{/u,'Daily Reflection and Diary persistence cross the checked P5.5B owner');
assert.doesNotMatch(host,/const DailyReflectionPersistence=\(\(\)=>|const LibraryDiaryEditor=\(\(\)=>/u,'the host must not retain parallel untyped reflection or Diary persistence engines');
assert.match(reviewPersistence,/storage[\s\S]{0,180}indexeddb/u,'reflection persistence refuses fallback-only write receipts');
assert.match(reviewPersistence,/await records\.verifyCanonical\(next\)|await records\.verifyCanonical\(diary\)/u,'reflection persistence requires canonical read-back after writes');
assert.match(reviewPersistence,/await records\.verifyCanonicalAbsent\(date\)/u,'Diary-only deletion requires physical canonical absence');
assert.match(reviewPersistence,/diaryOwnershipRevision[\s\S]{0,300}ownership\.revision\(\)/u,'Diary editor bindings are fenced by ownership revision');
assert.match(review,/expectedCanonical:reflectionOnlyState\.canonical/u,'reflection-only pending writes capture their optimistic-concurrency baseline at scheduling time');
assert.doesNotMatch(review,/const expected=reflectionOnlyState\.date===pending\.date/u,'reflection-only writes must not consult mutable cross-date state when the asynchronous write executes');
assert.match(review,/if\(reviewDate\(getReviewDate\(\)\)===pending\.date\)\{[\s\S]{0,260}reflectionOnlyState=freeze/u,'a completed save updates the live reflection-only state only when its date is still current');
assert.match(review,/followup:reflectionLibraryFollowup\(pending\.date\)/u,'Library refresh is a post-commit follow-up rather than part of the persistence failure path');
assert.match(review,/AppData\.dailyRecords\.save\(doc,\{assertOrigin,expectedCanonical:existing\}\)/u,'Study Day save must compare against the exact Saved-Day record read before its asynchronous commit.');
assert.match(review,/DAILY_RECORD_COMMITTED_UNVERIFIED/u,'Review must distinguish a canonical Saved-Day receipt followed by uncertain read-back from a failed write.');
assert.match(repositories,/if\(idbCommitted\)throw Object\.assign\([\s\S]{0,260}DAILY_RECORD_COMMITTED_UNVERIFIED/u,'a physically committed Saved Day must be classified before the emergency fallback lane.');
assert.match(repositories,/conditional&&String\([\s\S]{0,180}DAILY_RECORD_CHANGED'\)throw e;[\s\S]{0,260}fallbackDailyRecordsGet\(\)/u,'conditional Saved-Day conflicts stay fail-closed while genuine pre-commit IndexedDB failure retains the emergency rescue lane.');
assert.match(library,/function activeSessionOwnsDiaryRecord\s*\(\s*record\s*\)\s*\{\s*const date=activeDate\(\);return record\.recordKind==='study'&&!!date&&date===record\.date;\}/u,'Library has one explicit guard against editing the Study Day owned by retained session state.');
assert.match(library,/startDiaryEdit[\s\S]{0,500}activeSessionOwnsDiaryRecord\(record\)/u,'Diary Edit consults retained-session ownership before binding a Study Day editor.');
assert.match(library,/deleteDiaryEntry[\s\S]{0,500}activeSessionOwnsDiaryRecord\(current\)[\s\S]{0,900}activeSessionOwnsDiaryRecord\(current\)/u,'Diary Delete checks retained-session ownership before and after its confirmation await.');
assert.match(host,/activeDate:\(\)=>String\(sessionPanelSession\?\.date\|\|\(hasBlockingActiveSession\(\)\?TimerState\.studyDate:''\)\|\|''\)/u,'the real Library port includes retained suspended/previous/elsewhere dates plus a live runtime date only while Study Director treats the session as blocking.');
assert.match(library,/bindDiaryEditor\(field,record\.date,record,\{[\s\S]{0,420}assertWrite:\(\)=>\{if\(activeSessionOwnsDiaryRecord\(record\)\)throw new Error/u,'an already-bound Study Day Diary editor carries the retained-session guard into its save lane.');
assert.match(library,/deleteDiaryEntryRecord\(date,\{expectedRecord:deleting,assertWrite:\(\)=>\{if\(!currentOwner\(owner\)\|\|activeSessionOwnsDiaryRecord\(deleting\)\)throw new Error/u,'Diary deletion carries its originating owner and retained-session guard past confirmation into persistence.');
assert.match(reviewPersistence,/const assertOrigin=\(\)=>\{if\(activeState\(field\)!==state\|\|!ownership\.canMutate\(\)\)throw new Error[\s\S]{0,220}state\.assertWrite\?\.\(\);\};assertOrigin\(\);/u,'Diary save composes editor identity, ownership and Library single-writer policy into one origin assertion.');
assert.match(reviewPersistence,/const ownerRevision=ownership\.revision\(\),assertOrigin=\(\)=>\{assertReflectionOwner\(ownerRevision\);options\.assertOrigin\?\.\(\);\};assertOrigin\(\);/u,'direct reflection persistence composes the original owner and caller origin.');
assert.match(reviewPersistence,/records\.save\(next,\{backupCapture,expectedCanonical:current,assertOrigin\}\)/u,'Study Day reflection mutation forwards the composed Diary origin assertion into the canonical repository transaction.');
assert.match(reviewPersistence,/records\.remove\(date,\{backupCapture,expectedCanonical:current,assertOrigin\}\)/u,'Diary-only deletion forwards the composed origin assertion into the canonical repository transaction.');
assert.match(reviewHost,/function createDayState\(/u,'Review date/revision/reminder state has a checked P5.5B owner');
assert.ok(host.indexOf("const FULL_WEEKDAY_NAMES=")<host.indexOf("const ReviewDayState=ReviewHostModule.createDayState"),'Review day-state constants must be initialized before checked host composition');
assert.match(reviewHost,/function createSavedDayCoordinator\(/u,'Saved-Day reminder, acknowledgement, suspended-save and rollover orchestration have one checked P5.5B owner');
for(const stale of ['function savedDayCoversReminderEvidence(','async function savedDayHasUncoveredKeptSession(','const DailyReflectionPersistence=(()=>','const LibraryDiaryEditor=(()=>','let saveReminderDate=']){
  assert.equal(host.includes(stale),false,`main host must not retain extracted P5.5B algorithms: ${stale}`);
}
assert.match(host,/function promptSaveToday\(\.\.\.args\s*\)\{return requireReviewSavedDayRuntime\(\)\.promptSaveToday\(\.\.\.args\);\}/u,'the retained reminder name is a thin deferred host forwarder only');

for(const stale of ['function latestTrackableEndMin(','const TaskSessionState=(()=>','function getRealTimeState(','function rebuildOriginalSchedule(','function resolveTaskCompletion(','function toggleDoneMarker(','function recoveryCaptureActiveBeforeSwitch(','function resolveActivePauseBeforeTimerSwitch(']){
  assert.equal(host.includes(stale),false,`main host must not retain extracted P5.4A runtime logic: ${stale}`);
}
console.log(JSON.stringify({status:'PASS',boundary:'live-execution-host',checkedComposition:true,taskIdentityEvidence:true,noOpSideEffectsGated:true,authorityFenced:true,staleHostRuntimeRemoved:true},null,2));
}

{ // p5.6a-notes-host-boundary
const host=readHostHtml(),notesHost=readScript('source/core/notes-host.ts'),library=fs.readFileSync('source/core/library.ts','utf8');
assert.match(host,/const NotesHostModule=INTERNAL_MODULES\.load\('notes-host',1,'study-director\.notes-host-module',1\);/u,'P5.6A host loads the checked notes owner');
assert.match(host,/NotesRuntime=NotesHostModule\.createController\(Object\.freeze\s*\(\{/u,'note/editor host behavior crosses the checked P5.6A boundary');
assert.match(host,/function taskNoteEditorIsVisible\(field\s*\)\{return NotesRuntime\?NotesRuntime\.editorVisible\(field\):false;\}/u,'rich-text visibility checks retain a thin checked P5.6A host bridge');
assert.match(host,/LibraryNoteWorkflows=NotesHostModule\.createLibraryWorkflows\(Object\.freeze\s*\(\{/u,'Library note mutations and Plan fan-out cross the checked P5.6A boundary');
for(const stale of ["const NOTE_EDITOR_BINDING_VERSION='area-v2'","function taskNoteEditorIdentity(","async function applyNoteRename(entry,value,{inPlans=true}={}){\n      const identity=normalizeNoteArea(value);\n      if(!identity||identity.label===entry.label||!canMutate())return false;\n      const where=planAreaPlaces(planAreaUse(entry.key));\n      const notice=notifications.begin({id:'note-rename',surfaceId:'notes-status',title:'Rename note',message:'Renaming the note…'});\n      try{\n        let outcome=await renameNote(entry.key"]){
  assert.equal(host.includes(stale),false,`main host must not retain legacy P5.6A note owner: ${stale.slice(0,48)}`);
}
assert.match(notesHost,/ownershipRevision:ownership\.revision\(\)/u,'note bindings capture current mutation ownership');
assert.match(notesHost,/owner!==ownership\.revision\(\)\)return stale\(field\)/u,'ownership revision changes fail stale note editors closed');
assert.match(notesHost,/noteId&&\(!entry\|\|entry\.id!==noteId\)\)return stale\(field\)/u,'stable note identity fences deleted, renamed or replaced bindings');
assert.match(notesHost,/repository\.updateValidatedRich\(binding\.key,binding\.label,candidate,binding\.noteRevision\)/u,'validated rich edits preserve optimistic note revision checks');
assert.match(notesHost,/plan\.renameArea\(entry\.key,identity\.label\)/u,'affected Plan Area renames are consumed through the checked Plan controller');
assert.match(notesHost,/catch\(error\)\{planError=error;\}/u,'Plan fan-out failure is an explicit post-note-commit outcome');
assert.doesNotMatch(notesHost,/dailyRecords|DailyRecord|Saved Day|commitDailyRecord/u,'P5.6A does not absorb Diary or Saved-Day persistence');
assert.doesNotMatch(library,/renameAreaInPlans/u,'Library no longer owns an untyped Plan Area rename port');
assert.match(library,/The note change is saved, but/u,'Library reports a committed note rename truthfully when the Plan follow-up fails');
assert.match(host,/rename:\(entry\s*,value\s*,options\s*\)=>LibraryNoteWorkflows\.rename\(entry,value,options\)/u,'Library callers use the checked note workflow rather than the repository rename primitive');
console.log(JSON.stringify({status:'PASS',boundary:'p5.6a-notes-host',ownershipFence:true,noteIdentityFence:true,planFanout:true,diaryOutOfScope:true},null,2));
}

{ // p5.6b-library-navigation-boundary
const host=readHostHtml(),library=readRuntimeSource('source/core/library.ts'),links=readRuntimeSource('source/core/note-links.ts');
assert.match(host,/const NoteLinksModule=INTERNAL_MODULES\.load\('note-links',1,'study-director\.note-links-module',1\);/u,'P5.6B host loads the checked note-links owner');
assert.match(host,/const LibraryModule=INTERNAL_MODULES\.load\('library',1,'study-director\.library-module',1\);/u,'P5.6B host loads the checked Library owner');
assert.match(host,/const NoteLinkNavigation=NoteLinksModule\.createNavigation\(Object\.freeze\s*\(\{/u,'note-link navigation crosses the checked P5.6B boundary');
assert.match(host,/const LibraryView=LibraryModule\.createView\(Object\.freeze\s*\(\{ports:Object\.freeze\s*\(\{/u,'Library navigation and record presentation cross the checked P5.6B boundary');
for(const stale of ['async function openLinkedNote(','function richTextNotes(','async function showNotesTagged(']){
  assert.equal(host.includes(stale),false,`main host must not retain legacy P5.6B link-navigation owner: ${stale}`);
}
assert.match(links,/function createNavigation\(input/u,'note-links owns the checked navigation adapter');
assert.match(links,/await library\.open\(\)/u,'link navigation defers Library opening to its provider');
assert.match(links,/return library\.reveal\(id\)/u,'link navigation delegates note reveal rather than owning Library state');
assert.match(links,/library\.filterTag\(name/u,'tag navigation delegates Library filtering through the checked adapter');
assert.match(library,/let libraryDayRequestToken=0/u,'Saved-Day presentation owns an explicit asynchronous request generation');
assert.match(library,/request!==libraryDayRequestToken/u,'a superseded Saved-Day read cannot publish stale presentation');
assert.match(library,/invalidateLibraryDayRequest\(\);captureLibraryScroll/u,'leaving Library invalidates pending Saved-Day presentation');
assert.match(library,/if\(selection\.savedDays\)invalidateLibraryDayRequest\(\)/u,'clearing Saved Days invalidates pending Saved-Day presentation');
assert.match(library,/createSavedDayTaskReviewCard/u,'Library reuses the checked P5.5 saved-day task presentation');
assert.match(library,/createPomodoroSummaryLine/u,'Library reuses the checked P5.5 pomodoro presentation');
assert.match(library,/populatePracticeRunTable/u,'Library reuses the checked P5.5 practice presentation');
assert.doesNotMatch(library,/function createSavedDayTaskReviewCard\(|function createPomodoroSummaryLine\(|function populatePracticeRunTable\(/u,'Library does not duplicate Review presentation algorithms');
assert.match(library,/const \{exportKeys,cancel:cancelExport\}=ports\.exporter/u,'P5.6B keeps export implementation behind its existing provider for P5.6C');
assert.match(library,/const \{batch:batchAttachments,close:closeAttachments,count:attachmentCount,invalidate:invalidateAttachments,reconcile:reconcileAttachments,refresh:refreshAttachments\}=ports\.attachments/u,'P5.6B keeps attachment lifetime behind its existing provider for P5.6C');
console.log(JSON.stringify({status:'PASS',boundary:'p5.6b-library-navigation',checkedLibrary:true,checkedLinks:true,savedDayGenerationFence:true,sharedReviewPresentation:true,p56cBoundary:true},null,2));
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
assert.match(planHost,/repositories\.plans\.replace\(snapshot,\{ownershipToken:activeToken,/u,'browser-data-clear recovery restores Plan draft and library through one originating-authority canonical replacement');
assert.doesNotMatch(planHost,/TimerEngine|TimerState|SessionLifecycle|activeSession|flushLiveDraft|setCurrentTask|Pomodoro|PracticePacer/u,'Plan host persistence/default composition must not absorb P5.4 live-runtime ownership');
console.log(JSON.stringify({status:'PASS',boundary:'plan-authoring-runtime',runtimePort:'scheduleGateway',directRuntimeOwnership:false,synchronousRestoreSeam:true,checkedPlanHost:true,atomicResetRecovery:true},null,2));
}

{ // presentation-surface-boundary
const app=readHostHtml();
assert.match(app,/<html[^>]*data-presentation="glass"[^>]*data-typography="glass"[^>]*data-shape="glass"[^>]*data-material="glass"[^>]*data-depth="glass"/u,'Glass must be the pre-hydration presentation before bootstrap JavaScript runs.');
const core=fs.readFileSync('source/styles/core.css','utf8');
const glass=readRuntimeSource('source/external/glass.ts');
const presentationHost=readRuntimeSource('source/core/presentation-host.ts');
const insights=readRuntimeSource('source/external/insights-rendering.ts')+'\n'+readRuntimeSource('source/external/insights-runtime.ts');
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
for(const source of [foundation,insights,readRuntimeSource('source/core/navigation.ts'),fs.readFileSync('source/core/library.ts','utf8'),readScript('source/external/guide.ts')]){
  assert.doesNotMatch(source,/startViewTransition|viewTransitionName|view-transition-name/,
    'navigation and lazy feature surfaces must not start snapshot transitions');
}
assert.equal((app.match(/startViewTransition\(/g)||[]).length,0,'unchecked main composition must not own native View Transitions');
assert.equal((presentationHost.match(/startViewTransition\(/g)||[]).length,1,'the checked presentation host starts native View Transitions from one appearance boundary only');
const appearanceChange=presentationHost.slice(presentationHost.indexOf('function runAppearanceChange'),presentationHost.indexOf('function renderThemeControls'));
assert.match(appearanceChange,/prefers-reduced-motion: reduce[\s\S]*?typeof document\.startViewTransition!=='function'[\s\S]*?document\.startViewTransition\(change\)/,
  'appearance transitions fall back to an immediate change under reduced motion or without the API, and only run a synchronous checked update');
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
assert.doesNotMatch(readScript('source/external/guide.ts'),/replaceGuidePanel|motion\.replace|appearance\.presentation\.motion/,
  'Guide structural replacements update the live DOM directly');
assert.doesNotMatch(fs.readFileSync('source/core/library.ts','utf8'),/transition\(\{oldElement|motion\.replace/,
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
const guideSource=readScript('source/external/guide.ts');
assert.match(guideSource,/GUIDE_ORDER\s*=\s*Object\.freeze\(\['plan','execute','review','library','insights'\]\)/,
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
assert.match(review,/async function flushFinalActiveSessionCheckpoint\([^)]*\)[\s\S]{0,520}reflectionLane\.pending\(\)[\s\S]{0,260}writeCanonicalNow\(operation,\{assertOrigin\}\)[\s\S]{0,320}saved\.storage\?\.idb!==true/u,'Save Today uses the strict canonical Active Session writer and verifies the final checkpoint before publication.');
assert.match(review,/async function saveDayRecord\s*\([^)]*\)[\s\S]{0,1900}captureTodayState\s*\(\s*\)[\s\S]{0,420}await flushFinalActiveSessionCheckpoint\([^)]*\)[\s\S]{0,220}if\(closesSession\)activeSessionPersistenceBlocked=true[\s\S]{0,650}commitDailyRecord/u,'Save Today verifies the final Active Session checkpoint before blocking later persistence and committing the canonical DailyRecord.');
assert.match(review,/async function handleStudyDayRollover\(\)[\s\S]{0,1500}saveReviewState\(\{markChanged:false,strict:true\}\)[\s\S]{0,260}await flushFinalActiveSessionCheckpoint\([^)]*\)[\s\S]{0,950}await runLifecycle\('study-day-rollover'[\s\S]{0,700}activeSessionPersistenceBlocked=true[\s\S]{0,420}commitDailyRecord/u,'Automatic rollover verifies its final Active Session checkpoint, awaits lifecycle entry, then blocks later persistence before committing the Saved Day.');
assert.equal((review.match(/clearCanonicalSessionAfterSavedDay\(\{expectedCanonical:checkpoint,assertOrigin:check\}\)/gu)||[]).length,2,'both Review retirement paths must compare the original durable checkpoint under their original authority.');
assert.match(background,/const PRIORITY\s*=freeze\s*\(\s*\{integrity:10,maintenance:20,convergence:30\s*\}\s*\)[\s\S]*scheduled\s*=new Map\s*\(\s*\),active\s*=new Map\s*\(\s*\)/u,'Repository integrity, maintenance and convergence must be explicitly tracked by the shared coordinator so foreground work can pre-empt them.');
assert.doesNotMatch(background,/const PRIORITY\s*=freeze\s*\(\s*\{[^}]*\bautomatic:/u,'The retired automatic background job must not return alongside convergence.');
assert.match(background,/function arm\s*\(entry\s*\)\s*\{[\s\S]*if\s*\(!entry\|\|foreground\|\|suspensions\s*\.size[\s\S]*function beginForeground[\s\S]*suspendTimers\s*\(\s*\)[\s\S]*release:[\s\S]*if\s*\(foreground\s*=\s*=\s*=row\s*\)foreground\s*=null;resolveRelease\?\s*\.\s*\(\s*\);resumeTimers\s*\(\s*\)/u,'Foreground ownership must keep queued repository maintenance disarmed until the foreground operation has fully released and its settlement barrier is resolved.');
}
