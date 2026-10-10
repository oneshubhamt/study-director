import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync('source/app.html','utf8');
const backup=fs.readFileSync('source/core/backup.js','utf8');
const provider=fs.readFileSync('source/core/backup-provider.js','utf8');
const presentation=fs.readFileSync('source/core/backup-presentation.js','utf8');
const device=fs.readFileSync('source/core/device-backup.js','utf8');
const host=fs.readFileSync('source/core/backup-recovery-host.js','utf8');
const guide=fs.readFileSync('source/external/guide.js','utf8');
const styles=fs.readFileSync('source/styles/core.css','utf8');
const reconciliation=fs.readFileSync('source/core/reconciliation.js','utf8');
const reconciliationUi=fs.readFileSync('source/core/reconciliation-ui.js','utf8');

const dataStart=app.indexOf('class="backup-model-disclosure'),dataEnd=app.indexOf('class="library-danger"',dataStart),dataSurface=app.slice(dataStart,dataEnd);
assert.ok(dataStart>=0&&dataEnd>dataStart);
assert.match(dataSurface,/>Backup model</u);assert.match(dataSurface,/Local-first · versioned handoff/u);assert.match(dataSurface,/>Managed checkpoints</u);assert.match(dataSurface,/Device Folder keeps verified versions/u);assert.match(dataSurface,/>Multi-device handoff</u);assert.match(dataSurface,/Google Drive → Versions/u);assert.match(dataSurface,/explicit handoff, not continuous sync/u);assert.match(dataSurface,/>Portable backup</u);assert.match(dataSurface,/one complete <span class="ui-mono">\.sdbackup<\/span> file/u);assert.match(dataSurface,/does not join Device Folder or Google Drive version history/u);assert.match(dataSurface,/Saved Days \/ Diary &amp; Reflections/u);assert.match(dataSurface,/Ongoing Notes/u);assert.match(dataSurface,/Active Session/u);assert.match(dataSurface,/Referenced attachments/u);assert.match(dataSurface,/Independently retained attachments/u);assert.match(dataSurface,/>Automatic backup</u);assert.doesNotMatch(dataSurface,/>What is included\?</u);
assert.match(dataSurface,/>Device Folder</u);assert.match(dataSurface,/>Primary</u);assert.match(dataSurface,/id="recover-device-backup"[^>]*data-action="recover-device-backup"[^>]*>Versions</u);assert.match(dataSurface,/id="device-backup-settings"[^>]*>Settings</u);assert.match(dataSurface,/id="device-backup-settings-panel"/u);
assert.match(dataSurface,/>Google Drive</u);assert.match(dataSurface,/>Optional</u);assert.match(dataSurface,/id="backup-provider-actions"/u);
assert.match(dataSurface,/data-action="toggle-backup-info"/u,'backup explanations must use compact info popovers');
assert.doesNotMatch(dataSurface,/Recovery &amp; history|Restore latest…|View backup history…|Merge from backup…/u,'separate Recovery & History wall must be removed');

assert.match(dataSurface,/class="backup-advanced-disclosure ui-disclosure"/u);assert.doesNotMatch(dataSurface,/class="backup-advanced-disclosure ui-disclosure"[^>]*\sopen(?:\s|>|=)/u,'Advanced must default closed');
assert.match(dataSurface,/id="backup-file-heading">Portable backup</u);assert.match(dataSurface,/>Export backup…</u);assert.match(dataSurface,/>Import backup…</u);
assert.match(dataSurface,/id="security-storage-heading">Security &amp; storage</u);assert.match(dataSurface,/>Backup encryption</u);assert.match(dataSurface,/>Local storage</u);
assert.match(styles,/\.backup-advanced-disclosure>summary/u);assert.doesNotMatch(styles,/\.backup-recovery-/u,'obsolete Recovery & History styling must be removed');

assert.match(provider,/backup\.textContent='Back up now'/u);assert.match(provider,/versions\.textContent=connected\?'Versions':'Recover'/u);assert.match(provider,/settings\.textContent=connected\?'Settings':wasConnected\?'Reconnect':'Connect'/u);assert.match(provider,/rowStatus\.textContent=presentation\.locationLabel\(item\.id,\{connected,wasConnected,busy:!!working,foregroundKind:working\?\.kind\}\)/u,'Drive row must use the shared location presentation with connection history');assert.match(presentation,/if\(!state\.connected\)return state\.wasConnected\?'Signed out':'Off'/u,'shared row status must distinguish expired authorization from a never-connected provider');assert.match(provider,/if\(connected\)fragment\.append\(backup,versions,settings\);else if\(wasConnected\)fragment\.append\(settings\);else fragment\.append\(settings,versions\)/u,'expired Drive authorization must collapse stale backup/history/settings actions to one Reconnect action while never-connected Drive still offers Connect or Recover');
assert.match(provider,/subscribeConnection:typeof config\.subscribeConnection==='function'\?config\.subscribeConnection:null/u);assert.match(provider,/connectedOnceByProvider=new Set\(\)/u,'provider UI must remember an authorization that was live in this tab so expiry can become Reconnect rather than a misleading fresh Connect state');assert.match(provider,/normalized\.subscribeConnection\)normalized\.subscribeConnection\(\(\)=>\{[^\n]*renderButtons\(\)/u,'provider UI must subscribe to live authorization changes instead of waiting for the next user action');assert.match(provider,/visibilitychange[^\n]+!document\.hidden\)renderButtons\(\)/u,'returning from a suspended mobile tab must synchronously re-evaluate token validity even if background timers were throttled');
assert.match(app,/id="backup-provider-recover"[^>]*data-action="recover-provider-backup"/u,'Drive settings retains the shared scoped recovery hook even though the row owns the primary Versions action');
assert.match(provider,/recoverButton\.dataset\.providerId=selected\.id/u,'Drive recovery must stay scoped to the provider opened in Settings');
assert.doesNotMatch(provider,/backup-provider-import|importLabel/u,'provider overlay must reuse the shared provider-scoped recovery host rather than a second import implementation');
assert.match(provider,/async function bringInRepositoryProvider\(id,options=\{\}\)[\s\S]*checkpointId:String\(options&&options\.checkpointId\|\|''\)/u,'provider Combine must accept an explicitly selected provider checkpoint');
// The Device Folder restores, combines and lists versions through the engine like every location.
const engine=fs.readFileSync('source/core/backup-provider.js','utf8');
assert.match(engine,/checkpoint-selection-start/u);assert.match(engine,/checkpoint-selection-cancelled/u);assert.match(engine,/checkpoint-selection-failed/u);
assert.match(device,/choose:\(choices,\{mode:kind='restore-version'\}=\{\}\)=>choices\.length<2\?choices\[0\]\?\.id\|\|null:hooks\.chooseCheckpoint/u,'the Device Folder supplies only its version chooser to the shared restore path');
assert.match(provider,/checkpoint-selection-start/u);assert.match(provider,/checkpoint-selection-cancelled/u);assert.match(provider,/checkpoint-selection-failed/u);

assert.match(host,/async function collectSource\(sourceId/u);
assert.match(host,/const result=await input\.providers\.history\(source\.id,/u,'history must query exactly the chosen source');
assert.doesNotMatch(host,/for\(const provider of input\.providers\.list\(\)\).*input\.providers\.history/u,'explicit recovery must never enumerate every provider');
assert.doesNotMatch(host,/input\.repository\.mergeHistory/u,'provider-scoped recovery must not merge competing histories');
assert.match(host,/backup checkpoint/u);assert.match(host,/Restore \/ Combine…/u);assert.match(host,/Before Clear Library/u,'protected bulk-delete safety checkpoints must be clearly labelled in history');
assert.match(host,/cancelLabel:'Keep current'/u);assert.match(host,/choices:\[presentation\.restoreChoices\.missing,presentation\.restoreChoices\.combine,presentation\.restoreChoices\.replace\]/u);assert.match(presentation,/label:'Replace current data'[\s\S]*Make this backup authoritative/u);assert.match(presentation,/label:'Combine with current data'[\s\S]*review genuine differences/u);assert.match(presentation,/label:'Add only what’s missing'[\s\S]*Nothing you have now changes/u);
assert.match(host,/choice==='replace'\?await input\.providers\.restoreRepositoryProviderVersion\(sourceId,options\):await input\.providers\.bringInRepositoryProvider\(sourceId,options\)/u);
assert.match(app,/id="managed-version-history-progress"[\s\S]*id="managed-version-history-progress-stage"[\s\S]*id="managed-version-history-progress-detail"/u,'Version History must own its structured recovery progress surface.');
assert.match(host,/function setHistoryProgress[\s\S]*progressStage[\s\S]*progressDetail/u,'managed recovery progress must be rendered inside Version History rather than a generic page footer.');
assert.match(styles,/\.managed-version-history\{position:fixed;inset:0;[\s\S]*margin:auto/u,'Version History must be explicitly centered as an application modal.');
assert.match(host,/function close\(\)\{const \{dialog\}=elements\(\);if\(dialog\?\.open\)dialog\.close\(\);return true;\}/u,'Close must only dismiss Version History and must not cancel the active recovery.');
assert.match(app,/id="backup-provider-progress"[\s\S]*id="backup-provider-progress-stage"[\s\S]*id="backup-provider-progress-detail"/u,'Drive management must own its structured operation progress surface.');
assert.match(provider,/function setBusy\(next\)[\s\S]*closeButton\.disabled=false[\s\S]*cancelButton[\s\S]*cancellable=busy&&!!foregroundController/u,'Drive Close must remain presentation-only while Cancel stays coupled to the live foreground controller.');
assert.match(provider,/function close\(\{restoreFocus=true\}=\{\}\)[\s\S]*overlay\.classList\.remove\('on'\)[\s\S]*if\(!busy\)[\s\S]*release\(selected,'close'\)/u,'closing Drive management during work must detach the view without releasing or aborting the operation.');
assert.doesNotMatch(provider,/function close\(\{restoreFocus=true\}=\{\}\)[\s\S]{0,500}(?:abort\(|cancelForeground\(|cancelImport\()/u,'Drive Close must never cancel the active operation.');
assert.match(provider,/async function open\(id,trigger=null\)[\s\S]*if\(busy\)[\s\S]*renderForegroundView\(selected\)[\s\S]*setBusy\(true\)/u,'reopening Drive management must reattach to the live operation snapshot.');
assert.match(provider,/async function connectProvider\(selected\)[\s\S]*connectedNow=true[\s\S]*if\(connectedNow\)\{[^\n]*if\(overlay\?\.classList\.contains\('on'\)&&activeId===selected\.id\)close\(\{restoreFocus:false\}\);\}[\s\S]*else if\(overlay\?\.classList\.contains\('on'\)&&activeId===selected\.id\)presentProvider/u,'a successful one-purpose provider Connect sheet dismisses itself while a failed connection remains visible for diagnosis.');
assert.match(app,/recoveryActive=state\.busy===true&&\['history','restore-version','bring-in'\]\.includes[\s\S]*recover\.disabled=state\.busy===true&&!recoveryActive/u,'Device Versions must remain available to reattach to an active recovery operation.');
assert.match(device,/async function refreshPermission\(\)[\s\S]*permission=await query\(\)[\s\S]*permissionNeeded\(\)/u,'Device Folder must re-check persisted directory permission without prompting automatically.');
assert.doesNotMatch(device,/if\(handle\)\{[\s\S]{0,300}storage\.remove\(config\.metadataKey\)/u,'temporary Device Folder permission loss must never discard the configured directory handle.');
assert.match(app,/connect\.textContent=state\.mode==='permission'\?'Allow access':'Choose folder…'/u,'configured Device Folder permission renewal must be presented as Allow access rather than folder reselection.');
assert.match(app,/AppActivation\.subscribe\(event=>\{[^\n]*void refreshDeviceBackgroundPermission\(event\)/u,'foreground return must delegate to the permission and integrity opportunity handler.');
const deviceActivation=app.slice(app.indexOf('async function refreshDeviceBackgroundPermission('),app.indexOf('AppActivation.subscribe(',app.indexOf('async function refreshDeviceBackgroundPermission(')));
assert.match(deviceActivation,/DeviceBackup\.refreshPermission\(\)/u,'foreground return must refresh Device Folder permission state without opening a permission prompt.');
assert.doesNotMatch(deviceActivation,/requestPermission|DeviceBackup\.connect\(/u,'activation opportunities must not prompt for folder access.');

assert.match(backup,/title:'Use this backup'/u);assert.match(backup,/cancelLabel:'Keep current'/u);assert.match(backup,/choices=\[\.\.\.\(preview\.reconciliationCapable\?\[restoreChoices\.missing\]:\[\]\),restoreChoices\.combine,\.\.\.\(exactCapable\?\[restoreChoices\.replace\]:\[\]\)\]/u);
assert.match(backup,/checkboxes:\[\{id:'safetyCopy',label:'Download an extra standalone safety copy before applying'/u,'optional file safety copy must be a compact checkbox on the existing reconciliation surface');
assert.doesNotMatch(backup,/id:'safetyCopy',label:'Optional extra backup copy'[\s\S]*choices:/u,'optional file safety copy must not render as another radio-choice conflict row');
assert.match(backup,/if\(decisions\.safetyCopy===true\)/u,'checkbox must only trigger the optional standalone download while automatic rollback remains independent');
assert.match(backup,/restoreStandaloneVersion\(candidate,\{confirmed:true\}\)/u,'standalone Replace must use exact verified restore');
assert.match(backup,/restoreBackup\(candidate,\{missingOnly:mode==='missing'\}\)/u,'standalone Combine must keep the reconciliation engine');
assert.match(backup,/exactCapable=Number\(parsed&&parsed\.formatVersion\)>=18&&captureAuthority==='canonical-complete'&&!!parsed&&!!parsed\.protectedCheckpointManifest/u,'standalone Replace must require current complete-capture authority rather than merely a protected manifest');
assert.match(backup,/rescuePartial=captureAuthority==='rescue-partial'/u,'verified rescue-partial standalone backups must remain recoverable without becoming exact-replacement authority');


assert.match(app,/BackupProviderRuntime\.createProtectedSafety\(location\.id,purpose\)/u,'Clear Library must require a verified protected safety version at the connected backup location');
assert.match(app,/Clear Library stopped because the protected \$\{location\.label\} safety backup could not be verified/u);
assert.match(app,/'recover-device-backup': \(\)=>BackupRecoveryHost\.history\.openSource\('device-folder'\)/u);
assert.match(app,/'recover-provider-backup': ev=>BackupRecoveryHost\.history\.openSource/u);
assert.match(app,/'recover-managed-version': ev=>BackupRecoveryHost\.history\.recover\(ev\)/u);
assert.doesNotMatch(app,/'restore-latest-backup'|'open-version-history'|'bring-in-managed-backup'|'restore-managed-version'/u);
assert.match(app,/ACTIVE_SESSION_BLOCKED_CLICK_ACTIONS=new Set\(\[[^\]]*'recover-device-backup'[^\]]*'recover-provider-backup'[^\]]*'recover-managed-version'/u);

assert.match(device,/Existing Study Director backups found\. Choose Versions to recover one, or Back up now to keep this device’s current data\./u);
assert.match(guide,/Local-first, versioned handoff/u);assert.match(guide,/Google Drive is the intended computer ↔ phone\/tablet handoff path/u);assert.match(guide,/\["Recover"/u);assert.match(guide,/Keep current, Add only what’s missing, Combine with current data, or Replace current data/u);assert.match(guide,/\["Replace current data"/u);assert.match(guide,/\["Combine with current data"/u);
assert.doesNotMatch(guide,/\["Restore latest"|\["Backup history"|\["Merge from backup"/u);
assert.match(reconciliation,/label:'Backup copy'/u);assert.match(reconciliationUi,/incomingLabel:String\(item\.incomingLabel\|\|'Backup copy'\)/u);

console.log('Backup/recovery UX architecture contract passed.');
