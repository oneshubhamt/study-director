import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const app=read('source/app.html'),repository=read('source/core/managed-repository.js'),provider=read('source/core/backup-provider.js'),device=read('source/core/device-backup.js'),host=read('source/core/backup-recovery-host.js'),drive=read('source/external/drive.js');

assert.match(repository,/const REPOSITORY_MANIFEST_FORMAT='study-director\.backup-repository-checkpoint',REPOSITORY_MANIFEST_VERSION=5/u);
assert.match(repository,/function repositoryLogicalIdentityPayload\(value\)[\s\S]*format:'study-director\.managed-backup-logical-state'[\s\S]*objects:freeze\(objects\),assets:freeze\(assets\),deletions:/u);
const identityBody=repository.slice(repository.indexOf('function repositoryLogicalIdentityPayload'),repository.indexOf('async function repositoryLogicalFingerprint'));
for(const excluded of ['checkpointId','installationId','sourceRevision','reconciliationBaseId','objectId','protectionId'])assert.equal(identityBody.includes(excluded),false,`provider/capture artifact must not enter logical-state identity: ${excluded}`);
assert.match(repository,/if\(manifest\.logicalFingerprint&&manifest\.logicalFingerprint!==logicalFingerprint\)throw new Error\('Repository checkpoint logical-state fingerprint failed verification\.'/u);

assert.match(provider,/async function historyRepositoryProvider\(id,options=\{\}\)[\s\S]*repositoryProviderInventory\(scoped,[\s\S]*repositoryInventoryHistoryEntries/u,'provider history must remain independently readable');
assert.match(device,/async function history\(options=\{\}\)[\s\S]*interactive\?beginForegroundController[\s\S]*readCheckpointState\(directories,\{signal\}\)[\s\S]*repository\.projectHistory/u,'Device Folder must expose independent committed history and interactive history must remain cancellable/foreground-safe.');
assert.match(app,/id="managed-version-history"[\s\S]*id="managed-version-history-title">Backup checkpoints/u,'one reusable recovery dialog may render the selected provider history');
assert.match(host,/function sourceDescriptor\(sourceId\)[\s\S]*id==='device-folder'[\s\S]*input\.providers\.list\(\)\.find/u);
assert.match(host,/async function collectSource\(sourceId[\s\S]*source\.kind==='device'\?await input\.device\.history[\s\S]*await input\.providers\.history\(source\.id/u);
assert.doesNotMatch(host,/mergeHistory|sources\.push|for\(const provider of input\.providers\.list/u,'recovery history must stay provider-scoped instead of constructing a global timeline');
assert.match(host,/sourceId==='device-folder'\?await input\.device\.restoreVersion\(options\):await input\.providers\.restoreRepositoryProviderVersion\(sourceId,options\)/u,'Replace must route only through the owning source');
assert.match(host,/sourceId==='device-folder'\?await input\.device\.bringIn\(options\):await input\.providers\.bringInRepositoryProvider\(sourceId,options\)/u,'Combine must route only through the owning source');
assert.match(host,/remove\.dataset\.action='remove-managed-safety'/u);assert.match(host,/sourceId==='device-folder'\?await input\.device\.removeSafetyBackup/u);
assert.match(provider,/async function removeProtectedRepositoryProvider/u);assert.match(device,/async function removeSafetyBackup/u);
for(const forbidden of ['import-file','importLocal','.sdbackup','import-archive'])assert.equal(host.includes(forbidden),false,`standalone file backup/import must stay outside managed provider history: ${forbidden}`);
assert.doesNotMatch(drive,/DeviceBackup|device-backup|projectManagedRepositoryHistory|mergeManagedRepositoryHistory/u,'Google Drive transport must not know about Device Folder');
assert.doesNotMatch(device,/google-drive|Google Drive|BackupProviderRuntime/u,'Device Folder must not know about Drive/provider recovery');

console.log(JSON.stringify({status:'PASS',suite:'managed-version-history-contract',providerScopedHistory:true,independentHistories:true,noCrossProviderDiscovery:true,manualFileExcluded:true,explicitSafetyRemoval:true},null,2));
