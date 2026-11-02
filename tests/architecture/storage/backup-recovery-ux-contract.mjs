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
assert.match(dataSurface,/>Backup model</u);assert.match(dataSurface,/Local-first · syncs through Drive/u);assert.match(dataSurface,/>Versions</u);assert.match(dataSurface,/Device Folder and Google Drive each keep verified versions independently/u);assert.match(dataSurface,/>Several devices</u);assert.match(dataSurface,/takes in what your other devices changed, then uploads its own changes/u);assert.match(dataSurface,/marked Needs review/u);assert.match(dataSurface,/>Portable backup</u);assert.match(dataSurface,/one complete <span class="ui-mono">\.sdbackup<\/span> file/u);assert.match(dataSurface,/it is not part of Version History/u);assert.match(dataSurface,/Saved Days \/ Diary &amp; Reflections/u);assert.match(dataSurface,/Notes/u);assert.match(dataSurface,/Active Session/u);assert.match(dataSurface,/Referenced attachments/u);assert.match(dataSurface,/Independently retained attachments/u);assert.match(dataSurface,/>Automatic backup</u);assert.doesNotMatch(dataSurface,/>What is included\?</u);
// One Back up now and one Version History for both locations; neither location is ranked.
assert.match(dataSurface,/id="backup-shared-actions"[^>]*hidden>[\s\S]*id="backup-now"[^>]*data-action="backup-now">Back up now<[\s\S]*id="open-version-history"[^>]*data-action="open-version-history"[^>]*>Version History</u);
assert.doesNotMatch(dataSurface,/>Primary<|>Optional<|backup-location-badge|recover-device-backup|recover-drive-backup|device-backup-now|drive-backup-now/u,'no per-location Versions or Back up now, and no ranking badges');
assert.match(dataSurface,/>Device Folder</u);assert.match(dataSurface,/id="device-backup-settings"[^>]*>Settings</u);assert.match(dataSurface,/id="device-backup-settings-panel"/u);assert.match(dataSurface,/id="device-backup-repository-name"/u,'the settings name the backup folder inside the chosen folder');
assert.match(dataSurface,/>Google Drive</u);assert.match(dataSurface,/id="backup-provider-actions"/u);assert.match(dataSurface,/<span>Sync<\/span><strong>While signed in<\/strong>/u);
assert.match(dataSurface,/data-action="toggle-backup-info"/u,'backup explanations must use compact info popovers');
assert.doesNotMatch(dataSurface,/Recovery &amp; history|Restore latest…|View backup history…|Merge from backup…/u,'separate Recovery & History wall must be removed');

assert.match(dataSurface,/class="backup-advanced-disclosure ui-disclosure"/u);assert.doesNotMatch(dataSurface,/class="backup-advanced-disclosure ui-disclosure"[^>]*\sopen(?:\s|>|=)/u,'Advanced must default closed');
assert.match(dataSurface,/id="backup-file-heading">Portable backup</u);assert.match(dataSurface,/>Export backup…</u);assert.match(dataSurface,/>Restore from file…</u);
{
  // How far back versions go is stated once, and matches the retention policy.
  const repository=fs.readFileSync('source/core/managed-repository.js','utf8'),policy=repository.match(/normalLimit:(\d+),dailyDays:(\d+),weeklyPeriods:(\d+),monthlyPeriods:(\d+),hourlyLimit:(\d+),hourlyWindowHours:(\d+),protectedLimit:1,beforeRestoreProtectionMs:(\d+)\*24\*60\*60\*1000/u);
  assert.ok(policy,'retention policy must be readable');const [,normal,daily,weekly,monthly,hourly,hours,protectedDays]=policy;
  assert.match(dataSurface,new RegExp(`id="backup-retention-note">Your backups keep ${normal} versions: the latest, ${daily} daily, ${weekly} weekly and ${monthly} monthly, so about ${['','one','two','three','four','five','six'][Number(monthly)]} to ${['','one','two','three','four','five','six'][Number(monthly)+1]} months back\\. They also keep one version per hour from the last ${hours} hours when your notes changed, up to ${hourly} more\\. Before a restore, each device also keeps a safety version for ${Number(protectedDays)} days\\. The Device Folder and Google Drive use the same retention rules but keep independent version histories\\.<`,'u'),'the retention note must match the retention policy');
  // One verb family for getting data back: Versions, then Restore…, Restore note… or Restore from file….
  assert.match(host,/use\.textContent=noteTarget\?'Restore note…':'Restore…'/u);assert.doesNotMatch(app+host,/Restore \/ Combine|Import backup…/u);
}
assert.match(dataSurface,/id="security-storage-heading">Storage</u);assert.match(dataSurface,/>Backup encryption</u);assert.match(dataSurface,/>Local storage</u);
assert.match(styles,/\.backup-advanced-disclosure>summary/u);assert.doesNotMatch(styles,/\.backup-recovery-/u,'obsolete Recovery & History styling must be removed');

// The host draws Google Drive's row from the engine's status, like the Device Folder row.
assert.doesNotMatch(provider,/document\.createElement\('button'\)|backup-provider-actions/u,'the engine reports status; it never draws location controls');
assert.match(app,/function renderDriveBackup\(\)\{[\s\S]*BackupProviderRuntime\.locationStatus\('google-drive'\)[\s\S]*BackupPresentation\.locationLabel\('google-drive',state\)/u,'Drive row must use the shared location presentation with connection history');
assert.match(app,/BackupProviderRuntime\.subscribeStatus\(renderDriveBackup\)/u);
assert.match(provider,/normalized\.subscribeConnection\)normalized\.subscribeConnection\(\(\)=>\{[^\n]*notifyStatus\(\)/u,'provider UI must subscribe to live authorization changes instead of waiting for the next user action');
assert.match(dataSurface,/id="connect-drive-backup"[\s\S]*id="cancel-drive-backup"[\s\S]*id="drive-backup-settings"[^>]*data-action="toggle-backup-settings"/u,'the Drive row has the same parts as the Device Folder row: connect, cancel and settings');
assert.match(dataSurface,/id="drive-backup-settings-panel"[\s\S]*id="disconnect-drive-backup"[^>]*data-action="disconnect-drive-backup"/u,'Drive settings open in place, as the Device Folder\'s do');
assert.doesNotMatch(provider,/backup-provider-import|importLabel/u,'provider overlay must reuse the shared provider-scoped recovery host rather than a second import implementation');
// Every restore names its version, chosen in Version History; no location has a picker of its own.
assert.match(provider,/if\(!checkpointId&&!missingOnly\)throw new Error\('Choose a version to restore\. Nothing was changed\.'\);/u,'a restore without a chosen version stops before reading anything');
assert.doesNotMatch(provider+device,/checkpoint-selection-start|repository\.choose|chooseCheckpoint/u);

assert.match(host,/async function collectAll\(/u);
assert.doesNotMatch(host,/input\.repository\.mergeHistory/u,'the host merges what the locations return; the repository is not asked to');
assert.match(host,/Every version your backups keep, newest first\. Choose one to restore\./u);assert.match(host,/'Restore…'/u);
assert.ok(host.includes('choices:[presentation.restoreChoices.missing,presentation.restoreChoices.combine,...(partialAttachments?[]:[presentation.restoreChoices.replace])]'),'partial attachment backups must never offer exact Replace');assert.match(presentation,/label:'Replace current data'[\s\S]*Make your data match this backup\. You choose whether to keep what isn’t in it/u);assert.match(presentation,/reach:'Google Drive is connected, so your other devices get the result at their next sync\.'/u,'while Drive syncs, a restore says it reaches every device');assert.match(presentation,/label:'Combine with current data'[\s\S]*changed on one side only since your last sync are taken for you; you choose the rest/u);assert.match(presentation,/label:'Add only what’s missing'[\s\S]*Nothing you have now changes/u);
assert.match(app,/id="managed-version-history-progress"[\s\S]*id="managed-version-history-progress-stage"[\s\S]*id="managed-version-history-progress-detail"/u,'Version History must own its structured recovery progress surface.');
assert.match(host,/function setHistoryProgress[\s\S]*progressStage[\s\S]*progressDetail/u,'managed recovery progress must be rendered inside Version History rather than a generic page footer.');
assert.match(styles,/\.managed-version-history\{position:fixed;inset:0;[\s\S]*margin:auto/u,'Version History must be explicitly centered as an application modal.');
assert.match(host,/function close\(\)\{const \{dialog\}=elements\(\);if\(dialog\?\.open\)dialog\.close\(\);return true;\}/u,'Close must only dismiss Version History and must not cancel the active recovery.');
assert.doesNotMatch(provider,/document\.|getElementById|classList|requestAnimationFrame/u,'the engine draws nothing: the host draws every location from its status and presentation events');
assert.doesNotMatch(app,/backup-provider-overlay|BackupProviderRuntime\.open\(/u,'there is no separate Drive dialog');
assert.match(app,/'cancel-drive-backup': \(\)=>BackupProviderRuntime\.cancelForeground\(undefined,'google-drive'\)/u,'Drive Cancel stays coupled to the live foreground operation');
assert.match(provider,/async function connectProvider\(selected\)[\s\S]*Promise\.all\(\[foreground\.settled,selected\.prepare\?selected\.prepare\(\):null\]\)[\s\S]*statusText\(''\);return true;/u,'Connect prepares sign-in alongside background work giving way, and a success leaves no message: the row says On');
const refreshStart=device.indexOf('async function refreshPermission(){'),refreshEnd=device.indexOf('// The folder picker or permission prompt',refreshStart);
assert.ok(refreshStart>=0&&refreshEnd>refreshStart,'Device Folder must define a passive permission refresh distinct from the user-gesture permission pathway');
const passivePermissionRefresh=device.slice(refreshStart,refreshEnd);
assert.match(passivePermissionRefresh,/permissionNeeded\(\)/u,'a current denied permission must still surface the renewal state');
assert.doesNotMatch(passivePermissionRefresh,/requestPermission\(|showDirectoryPicker\(|await request\(/u,'passive checks must never prompt without a user gesture');
assert.doesNotMatch(device,/if\(handle\)\{[\s\S]{0,300}storage\.remove\(config\.metadataKey\)/u,'temporary Device Folder permission loss must never discard the configured directory handle.');
assert.match(app,/connect\.textContent=state\.mode==='permission'\?'Allow access':'Choose folder…'/u,'configured Device Folder permission renewal must be presented as Allow access rather than folder reselection.');
assert.match(app,/AppActivation\.subscribe\(event=>\{[^\n]*void refreshDeviceBackgroundPermission\(event\)/u,'foreground return must delegate to the permission and integrity opportunity handler.');
const deviceActivation=app.slice(app.indexOf('async function refreshDeviceBackgroundPermission('),app.indexOf('AppActivation.subscribe(',app.indexOf('async function refreshDeviceBackgroundPermission(')));
assert.doesNotMatch(deviceActivation,/requestPermission|DeviceBackup\.connect\(/u,'activation opportunities must not prompt for folder access.');

assert.match(backup,/cancelLabel:'Keep current'/u);assert.match(backup,/choices=\[\.\.\.\(preview\.reconciliationCapable\?\[restoreChoices\.missing\]:\[\]\),restoreChoices\.combine,\.\.\.\(exactCapable\?\[restoreChoices\.replace\]:\[\]\)\]/u);
assert.match(backup,/checkboxes:\[\{id:'safetyCopy',label:'Download an extra standalone safety copy before applying'/u,'optional file safety copy must be a compact checkbox on the existing reconciliation surface');
assert.doesNotMatch(backup,/id:'safetyCopy',label:'Optional extra backup copy'[\s\S]*choices:/u,'optional file safety copy must not render as another radio-choice conflict row');
assert.match(backup,/if\(decisions\.safetyCopy===true\)/u,'checkbox must only trigger the optional standalone download while automatic rollback remains independent');
assert.match(backup,/exactCapable=Number\(parsed&&parsed\.formatVersion\)>=18&&captureAuthority==='canonical-complete'&&!!parsed&&!!parsed\.protectedCheckpointManifest/u,'standalone Replace must require current complete-capture authority rather than merely a protected manifest');
assert.match(backup,/rescuePartial=captureAuthority==='rescue-partial'/u,'verified rescue-partial standalone backups must remain recoverable without becoming exact-replacement authority');


assert.match(app,/BackupProviderRuntime\.createProtectedSafety\(location\.id,purpose\)/u,'Clear Library must require a verified protected safety version at the connected backup location');
assert.match(app,/Clear Library stopped because the \$\{location\.label\} safety version could not be verified/u);
assert.match(app,/'backup-now': \(\)=>backUpEverywhere\(\)/u);assert.match(app,/async function backUpEverywhere\(\)\{[\s\S]*DeviceBackup\.backupNow\(\)[\s\S]*BackupProviderRuntime\.backup\('google-drive'\)/u,'one Back up now: the Device Folder first, so Drive can take its version');
assert.match(app,/'open-version-history': \(\)=>withBackupPassword\(\(\)=>BackupRecoveryHost\.history\.open\(\)\)/u);
assert.match(app,/'recover-managed-version': ev=>BackupRecoveryHost\.history\.recover\(ev\)/u);
assert.doesNotMatch(app,/'restore-latest-backup'|'recover-device-backup'|'recover-provider-backup'|'bring-in-managed-backup'|'restore-managed-version'/u);
assert.match(app,/ACTIVE_SESSION_BLOCKED_CLICK_ACTIONS=new Set\(\[[^\]]*'open-version-history'[^\]]*'recover-managed-version'/u);

assert.match(guide,/Local-first: each device keeps all its data/u);assert.match(guide,/signed in to Google Drive, it syncs/u);assert.match(guide,/\["Recover"/u);assert.match(guide,/Keep current, Add only what’s missing, Combine with current data, or Replace current data/u);assert.match(guide,/\["Replace current data"/u);assert.match(guide,/\["Combine with current data"/u);
assert.doesNotMatch(guide,/\["Restore latest"|\["Backup history"|\["Merge from backup"/u);
assert.match(reconciliation,/label:'Backup copy'/u);assert.match(reconciliationUi,/incomingLabel:String\(item\.incomingLabel\|\|'Backup copy'\)/u);

console.log('Backup/recovery UX architecture contract passed.');
