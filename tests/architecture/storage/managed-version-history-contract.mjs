import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const read=relative=>readScript(path.join(root,relative));
const app=read('source/app.html'),repository=read('source/core/managed-repository.ts'),provider=read('source/core/backup-provider.js'),device=read('source/core/device-backup.ts'),host=read('source/core/backup-recovery-host.ts'),drive=read('source/external/drive.js');

assert.match(repository,/const REPOSITORY_MANIFEST_FORMAT='study-director\.backup-repository-checkpoint',REPOSITORY_MANIFEST_VERSION=8[;,]/u);
assert.match(repository,/function repositoryLogicalIdentityPayload\(value\s*\)[\s\S]*format:'study-director\.managed-backup-logical-state'[\s\S]*objects:freeze\(objects\),assets:freeze\(assets\),deletions:/u);
const identityBody=repository.slice(repository.indexOf('function repositoryLogicalIdentityPayload'),repository.indexOf('async function repositoryLogicalFingerprint'));
for(const excluded of ['checkpointId','installationId','sourceRevision','reconciliationBaseId','objectId','protectionId'])assert.equal(identityBody.includes(excluded),false,`provider/capture artifact must not enter logical-state identity: ${excluded}`);
assert.match(repository,/if\(manifest\.logicalFingerprint&&manifest\.logicalFingerprint!==logicalFingerprint\)throw unreadableVersion\(new Error\('Repository checkpoint logical-state fingerprint failed verification\.'/u);

assert.match(provider,/async function historyRepositoryProvider\(id,options=\{\}\)[\s\S]*repositoryProviderInventory\(scoped,[\s\S]*repositoryInventoryHistoryEntries/u,'provider history must remain independently readable');
assert.match(provider,/async function historyRepositoryProvider\(id,options=\{\}\)[\s\S]*beginForeground\(selected,options&&options\.signal\|\|null\)[\s\S]*repositoryInventoryHistoryEntries/u,'every location, the Device Folder included, exposes independent committed history; interactive history stays cancellable and foreground-safe.');
assert.match(app,/id="managed-version-history"[\s\S]*id="managed-version-history-title">Version History/u,'one Version History dialog for every location');
assert.match(host,/function sourceDescriptor\(sourceId\s*\)[\s\S]*input\.providers\.list\(\)\.find/u);assert.doesNotMatch(host,/input\.device\b/u,'the recovery host has no Device-only path');
// One list: each connected location's own history is read, then each
// version shows once, read from the Device Folder when it holds it.
assert.match(host,/async function collectAll\([\s\S]*for\(const source of sources\)\{[\s\S]*await input\.providers\.history\(source\.id/u);
assert.match(host,/function connectedSources\(\)\{return input\.providers\.list\(\)\.filter\(item=>item\.connected===true\)\.sort\(\(a,b\)=>Number\(a\.shared===true\)-Number\(b\.shared===true\)\)/u,'the Device Folder is read before Drive');
assert.match(host,/function mergeHistories\(results\s*\)[\s\S]*location\.tier!=='before-restore'[\s\S]*byId\.get\(location\.checkpointId\)\|\|\(entry\.logicalId\?byData\.get\(entry\.logicalId\):null\)/u,'a version two locations hold shows once; each safety version shows on its own');
assert.match(host,/choice==='replace'\?await input\.providers\.restoreRepositoryProviderVersion\(at\.sourceId,options\):await input\.providers\.bringInRepositoryProvider\(at\.sourceId,options\)/u,'Replace and Combine must route only through a location that holds the version');
assert.match(host,/remove\.dataset\['action'\]='remove-managed-version'/u);assert.match(host,/await input\.providers\.removeRepositoryProviderVersion\(sourceId,checkpointId\)/u);
assert.match(provider,/async function removeRepositoryProviderVersion/u);
for(const forbidden of ['import-file','importLocal','.sdbackup','import-archive'])assert.equal(host.includes(forbidden),false,`standalone file backup/import must stay outside managed provider history: ${forbidden}`);
assert.doesNotMatch(drive,/DeviceBackup|device-backup|projectManagedRepositoryHistory|mergeManagedRepositoryHistory/u,'Google Drive transport must not know about Device Folder');
assert.doesNotMatch(device,/google-drive|Google Drive|BackupProviderRuntime/u,'the Device Folder controller must not know about Drive; it reaches the engine only through its injected port');

console.log(JSON.stringify({status:'PASS',suite:'managed-version-history-contract',oneVersionHistory:true,independentHistories:true,noCrossProviderDiscovery:true,manualFileExcluded:true,explicitSafetyRemoval:true},null,2));
